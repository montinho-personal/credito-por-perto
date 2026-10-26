/**
 * POSSO USAR MEU FGTS NA CASA PRÓPRIA?
 * ============================================================================
 *
 * Confere as respostas da pessoa com as condições que a Caixa (agente
 * operador do FGTS) publica na página "Utilização do FGTS na Casa Própria" e
 * com a Lei nº 8.036/1990, art. 20, V a VII. Lidas em 16/10/2026.
 *
 * O resultado é por forma de uso e tem três estados: atende ao que foi
 * respondido, não atende (com o motivo) ou falta confirmar ("não sei"). Nunca
 * diz que o uso está aprovado: a Caixa verifica o enquadramento a cada
 * movimentação, pelo Manual de Moradia Própria, e pode exigir condições que
 * esta lista não cobre.
 */

/** Teto de avaliação do imóvel para uso do saldo na moradia, segundo a Caixa. */
export const MAX_PROPERTY_VALUE_CENTS = 2_250_000_00;
/** Parte máxima da prestação que o FGTS pode pagar (Lei 8.036, art. 20, V, c). */
export const MAX_INSTALLMENT_SHARE = 0.8;
/** Meses mínimos do abatimento das prestações (art. 20, V, b). */
export const INSTALLMENT_MONTHS = 12;
/** Intervalo mínimo entre usos para amortizar ou quitar (art. 20, VI). */
export const AMORTIZATION_INTERVAL_YEARS = 2;

export const FGTS_HOME_SOURCES = {
  caixa: {
    title: "Caixa — Utilização do FGTS na Casa Própria",
    url: "https://www.caixa.gov.br/voce/habitacao/paginas/utilizacao-fgts.aspx",
  },
  lei: {
    title: "Lei nº 8.036/1990, art. 20",
    url: "https://www.planalto.gov.br/ccivil_03/leis/l8036consol.htm",
  },
  verifiedAt: "16/10/2026",
} as const;

export type Answer = "sim" | "nao" | "nao-sei";

export type Goal = "comprar" | "amortizar" | "prestacao";

export type Purpose =
  | "residencial-urbano"
  | "comercial"
  | "rural"
  | "reforma"
  | "terreno"
  | "material"
  | "para-outra-pessoa";

export interface FgtsHomeAnswers {
  goal: Goal;
  /** 3 anos ou mais de trabalho sob o FGTS, somando todos os períodos. */
  threeYears?: Answer;
  /** Tem financiamento ativo no SFH, em qualquer parte do país. */
  activeSfh?: Answer;
  /** Tem imóvel residencial urbano onde mora, onde trabalha, vizinhos ou mesma região metropolitana. */
  propertyInRegion?: Answer;
  /** Para que o FGTS seria usado. */
  purpose?: Purpose;
  /** O imóvel é para a moradia do próprio titular. */
  ownHome?: Answer;
  /** Valor de avaliação do imóvel, em centavos (opcional). */
  propertyValueCents?: number | null;
  /** O imóvel foi comprado com FGTS há menos de 3 anos. */
  boughtWithFgtsRecently?: Answer;
  /** O contrato é do SFH (ou do SFI, assinado a partir de 12/06/2021, dentro do limite do SFH). */
  contractEligible?: Answer;
  /** Usou o FGTS para amortizar ou quitar este contrato há menos de 2 anos. */
  usedForAmortizationRecently?: Answer;
}

export type CheckState = "atende" | "nao-atende" | "confirmar";

export interface Check {
  id: string;
  label: string;
  state: CheckState;
  /** Explicação curta, citando a regra. */
  detail: string;
}

export type Verdict = "atende" | "nao-atende" | "confirmar";

export interface FgtsHomeResult {
  goal: Goal;
  checks: Check[];
  /** Resumo: algum "não atende" decide; senão, algum "confirmar"; senão, atende. */
  summary: Verdict;
}

const PURPOSE_BLOCKED: Record<Exclude<Purpose, "residencial-urbano">, string> = {
  comercial: "A Caixa lista imóvel comercial entre os usos não permitidos.",
  rural: "A Caixa lista imóvel rural entre os usos não permitidos.",
  reforma: "Concluir, reformar, melhorar ou aumentar o imóvel está entre os usos não permitidos.",
  terreno: "Comprar terreno sem construção está entre os usos não permitidos.",
  material: "Comprar material de construção está entre os usos não permitidos.",
  "para-outra-pessoa": "Imóvel para familiares, dependentes ou outras pessoas está entre os usos não permitidos.",
};

function fromAnswer(
  answer: Answer | undefined,
  okWhen: "sim" | "nao",
  id: string,
  label: string,
  ok: string,
  fail: string,
): Check {
  if (answer === undefined || answer === "nao-sei") {
    return { id, label, state: "confirmar", detail: `Falta confirmar. ${ok}` };
  }
  return answer === okWhen
    ? { id, label, state: "atende", detail: ok }
    : { id, label, state: "nao-atende", detail: fail };
}

function summarize(checks: Check[]): Verdict {
  if (checks.some((c) => c.state === "nao-atende")) return "nao-atende";
  if (checks.some((c) => c.state === "confirmar")) return "confirmar";
  return "atende";
}

export function checkFgtsHome(a: FgtsHomeAnswers): FgtsHomeResult {
  const checks: Check[] = [];

  const threeYears = fromAnswer(
    a.threeYears,
    "sim",
    "tres-anos",
    "3 anos de trabalho sob o FGTS",
    "É preciso ter no mínimo 3 anos de trabalho sob o regime do FGTS, somando todos os períodos.",
    "Com menos de 3 anos de trabalho sob o FGTS, somando todos os períodos, o uso não é permitido.",
  );

  if (a.goal === "comprar") {
    checks.push(threeYears);
    checks.push(
      fromAnswer(
        a.activeSfh,
        "nao",
        "sfh-ativo",
        "Sem financiamento ativo no SFH",
        "Não pode haver financiamento ativo no Sistema Financeiro da Habitação, em qualquer parte do país.",
        "Quem tem financiamento ativo no SFH, em qualquer parte do país, não pode usar o FGTS na compra.",
      ),
    );
    checks.push(
      fromAnswer(
        a.propertyInRegion,
        "nao",
        "imovel-na-regiao",
        "Sem imóvel residencial na região",
        "Não pode ter imóvel residencial urbano no município onde mora ou trabalha, nos vizinhos ou na mesma região metropolitana.",
        "Quem já tem imóvel residencial urbano onde mora ou trabalha, nos municípios vizinhos ou na mesma região metropolitana, não pode usar o FGTS para comprar outro ali.",
      ),
    );
    if (a.purpose === undefined) {
      checks.push({ id: "finalidade", label: "Finalidade permitida", state: "confirmar", detail: "Falta informar para que o FGTS seria usado." });
    } else if (a.purpose === "residencial-urbano") {
      checks.push({ id: "finalidade", label: "Finalidade permitida", state: "atende", detail: "Compra ou construção de imóvel residencial urbano está entre os usos permitidos." });
    } else {
      checks.push({ id: "finalidade", label: "Finalidade permitida", state: "nao-atende", detail: PURPOSE_BLOCKED[a.purpose] });
    }
    checks.push(
      fromAnswer(
        a.ownHome,
        "sim",
        "moradia-propria",
        "Imóvel para a sua moradia",
        "O imóvel precisa se destinar à moradia do titular.",
        "O imóvel precisa se destinar à moradia do titular do FGTS.",
      ),
    );
    const value = a.propertyValueCents;
    if (value === undefined || value === null || !Number.isFinite(value) || value <= 0) {
      checks.push({ id: "valor", label: "Avaliação de até R$ 2.250.000", state: "confirmar", detail: "Falta confirmar. O valor de avaliação do imóvel deve ser de até R$ 2.250.000, para uso do saldo na moradia." });
    } else if (value <= MAX_PROPERTY_VALUE_CENTS) {
      checks.push({ id: "valor", label: "Avaliação de até R$ 2.250.000", state: "atende", detail: "O valor informado está dentro do limite de R$ 2.250.000 para uso do saldo. O que vale é a avaliação feita pelo agente financeiro." });
    } else {
      checks.push({ id: "valor", label: "Avaliação de até R$ 2.250.000", state: "nao-atende", detail: "Acima de R$ 2.250.000 de avaliação, o saldo do FGTS não pode ser usado na moradia." });
    }
    checks.push(
      fromAnswer(
        a.boughtWithFgtsRecently,
        "nao",
        "fgts-3-anos-imovel",
        "Imóvel sem uso de FGTS há menos de 3 anos",
        "O imóvel não pode ter sido comprado com FGTS há menos de 3 anos, contados do registro na matrícula.",
        "Se o imóvel foi comprado com FGTS há menos de 3 anos do registro, só pode ser comprado de novo com FGTS depois desse prazo.",
      ),
    );
  } else {
    checks.push(
      fromAnswer(
        a.contractEligible,
        "sim",
        "contrato",
        "Contrato do SFH (ou SFI dentro do limite)",
        "Vale para contratos do SFH e, se assinados a partir de 12/06/2021, do SFI com imóvel avaliado dentro do limite do SFH.",
        "Pela regra publicada pela Caixa, o uso vale para contratos do SFH e para os do SFI assinados a partir de 12/06/2021 dentro do limite do SFH.",
      ),
    );
    if (a.goal === "prestacao") {
      checks.push(threeYears);
    } else {
      checks.push(
        fromAnswer(
          a.usedForAmortizationRecently,
          "nao",
          "intervalo-2-anos",
          "2 anos desde o último uso para amortizar",
          "A lei exige intervalo mínimo de 2 anos entre cada uso do FGTS para amortizar ou quitar.",
          "A lei exige intervalo mínimo de 2 anos entre cada uso do FGTS para amortizar ou quitar o saldo devedor.",
        ),
      );
    }
  }

  return { goal: a.goal, checks, summary: summarize(checks) };
}

export interface InstallmentCover {
  /** Quanto o FGTS pode pagar por mês: até 80% da prestação. */
  monthlyCents: number;
  /** Quanto isso soma em 12 meses. */
  twelveMonthsCents: number;
  /** Meses que o saldo informado cobre, no máximo 12 por pedido. */
  monthsCovered: number;
}

/**
 * Até 80% da prestação, por 12 meses (art. 20, V). Com o saldo informado,
 * quantos meses ele cobre. Sem saldo, devolve só o teto mensal.
 */
export function installmentCover(installmentCents: number, balanceCents: number | null): InstallmentCover | null {
  if (!Number.isFinite(installmentCents) || installmentCents <= 0) return null;
  const monthlyCents = Math.floor(installmentCents * MAX_INSTALLMENT_SHARE);
  const twelveMonthsCents = monthlyCents * INSTALLMENT_MONTHS;
  const monthsCovered =
    balanceCents === null || !Number.isFinite(balanceCents) || balanceCents <= 0 || monthlyCents === 0
      ? 0
      : Math.min(INSTALLMENT_MONTHS, Math.floor(balanceCents / monthlyCents));
  return { monthlyCents, twelveMonthsCents, monthsCovered };
}
