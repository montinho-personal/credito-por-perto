/**
 * REGRAS DO IOF-CRÉDITO — módulo único e versionado.
 *
 * Nenhuma alíquota de IOF mora fora deste arquivo. Cada regime tem início,
 * fim (se houver), tomador, alíquotas, limite temporal, fonte e data de
 * verificação; `iofRegimeAt` escolhe o regime pela DATA da operação.
 *
 * COBERTURA DECLARADA (e não histórico incompleto):
 *
 * - Pessoa física: desde 01/01/2022. Antes disso houve alíquotas temporárias
 *   (Decreto 10.797/2021, de 20/09 a 31/12/2021) e reduções de 2020, que
 *   este módulo não modela.
 * - Pessoa jurídica e Simples/MEI: desde 16/07/2025, quando a decisão
 *   cautelar do STF na ADC 96 restabeleceu o Decreto 12.499/2025. Entre
 *   23/05 e 15/07/2025 vigoraram textos diferentes (Decretos 12.466 e
 *   12.499), houve suspensão pelo Decreto Legislativo 176/2025 e a cobrança
 *   majorada foi afastada entre 26/06 e 16/07/2025 — período fora do
 *   simulador.
 *
 * VERIFICAÇÃO. Pessoa física: registrada no artigo do site a partir do
 * Planalto em 29/08/2026. Pessoa jurídica: trechos oficiais e alertas
 * jurídicos lidos por busca em 23/09/2026 — a leitura integral do Decreto
 * 12.499 no Planalto está pendente e a página declara isso. Simples/MEI:
 * fontes divergentes, regime marcado como não verificado.
 * `audit:sources` avisa quando `verifiedAt` envelhece.
 */

export interface IofSource {
  organization: string;
  title: string;
  url: string;
}

export type Borrower = "pf" | "pj" | "simples";

export interface IofRegime {
  id: string;
  borrower: Borrower;
  /** Primeiro dia (AAAA-MM-DD). */
  from: string;
  /** Último dia, ou null. */
  to: string | null;
  /** Alíquota diária, em fração (0,0082% = 0,000082). */
  dailyRate: number;
  /** Alíquota adicional, em fração (0,38% = 0,0038). */
  additionalRate: number;
  /** A parcela diária conta no máximo esses dias por principal. */
  capDays: number;
  /** Teto do valor da operação para o regime (Simples/MEI), em centavos. */
  maxAmountCents?: number;
  /**
   * false: as alíquotas não fecharam em fonte oficial e o regime não gera
   * número (a calculadora declara a lacuna em vez de estimar).
   */
  verified: boolean;
  label: string;
  source: IofSource;
}

const DECRETO_6306: IofSource = {
  organization: "Presidência da República",
  title: "Decreto nº 6.306/2007 (Regulamento do IOF), art. 7º — texto compilado",
  url: "https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2007/decreto/d6306compilado.htm",
};

const DECRETO_12499: IofSource = {
  organization: "Presidência da República",
  title: "Decreto nº 12.499/2025, que alterou o art. 7º do Decreto nº 6.306/2007",
  url: "https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/decreto/d12499.htm",
};

export const IOF_REGIMES: readonly IofRegime[] = [
  {
    id: "pf-2022",
    borrower: "pf",
    from: "2022-01-01",
    to: null,
    dailyRate: 0.000082,
    additionalRate: 0.0038,
    capDays: 365,
    verified: true,
    label: "Pessoa física",
    source: DECRETO_6306,
  },
  {
    id: "pj-2025",
    borrower: "pj",
    from: "2025-07-16",
    to: null,
    dailyRate: 0.000082,
    additionalRate: 0.0095,
    capDays: 365,
    verified: true,
    label: "Pessoa jurídica",
    source: DECRETO_12499,
  },
  {
    id: "simples-2025",
    borrower: "simples",
    from: "2025-07-16",
    to: null,
    dailyRate: 0.0000274,
    additionalRate: 0.0038,
    capDays: 365,
    maxAmountCents: 30_000_00,
    // As fontes consultadas divergem na alíquota adicional (0,38% ou 0,95%):
    // sem leitura do texto oficial, o regime fica sem número.
    verified: false,
    label: "Optante do Simples Nacional ou MEI, operação de até R$ 30.000",
    source: DECRETO_12499,
  },
];

/** Início da cobertura por tomador. */
export const COVERAGE_FROM: Record<Borrower, string> = { pf: "2022-01-01", pj: "2025-07-16", simples: "2025-07-16" };

/** O limite de 365 dias, na redação do regulamento. */
export const CAP_RULE = {
  summary:
    "Nas operações cuja base não é o somatório de saldos devedores diários, o IOF não pode passar da alíquota diária aplicada a cada valor de principal por 365 dias, mais a alíquota adicional — ainda que a operação seja parcelada.",
  reference: "Decreto nº 6.306/2007, art. 7º, § 1º",
  source: DECRETO_6306,
} as const;

/** Decisão judicial que afeta os regimes de pessoa jurídica. */
export const JUDICIAL_RECORD = {
  process: "STF — ADC 96 (com as ADIs 7.827 e 7.839), relator ministro Alexandre de Moraes",
  decidedAt: "2025-07-16",
  effect:
    "Decisão cautelar restabeleceu a eficácia do Decreto nº 12.499/2025, salvo a equiparação do “risco sacado” a operação de crédito. Em 18/07/2025, a decisão foi ajustada para afastar a cobrança majorada entre 26/06/2025 (Decreto Legislativo nº 176/2025) e 16/07/2025. O julgamento pelo Plenário estava pendente na última verificação.",
  affects: "Alíquotas de pessoa jurídica e de Simples/MEI (Decreto nº 6.306/2007, art. 7º, com a redação do Decreto nº 12.499/2025)",
  source: {
    organization: "Supremo Tribunal Federal",
    title: "STF restabelece parcialmente decreto que eleva alíquotas do IOF",
    url: "https://noticias.stf.jus.br/postsnoticias/stf-restabelece-parcialmente-decreto-que-eleva-aliquotas-do-iof/",
  } satisfies IofSource,
} as const;

/* -------------------------------------------------------------------------- */
/* Tipos de operação                                                          */
/* -------------------------------------------------------------------------- */

export type OperationKind = "comum" | "habitacional" | "rural" | "portabilidade" | "renegociacao" | "rotativo";

export interface OperationRule {
  kind: OperationKind;
  label: string;
  /** "calcula": regime normal; "zero": R$ 0 com a hipótese; "especifica": sem número. */
  treatment: "calcula" | "zero" | "especifica";
  explanation: string;
  reference?: string;
  source?: IofSource;
}

export const OPERATION_RULES: readonly OperationRule[] = [
  {
    kind: "comum",
    label: "Empréstimo ou financiamento com valor definido",
    treatment: "calcula",
    explanation: "Crédito com principal definido: empréstimo pessoal, consignado, financiamento de veículo e outras operações com valor e vencimentos conhecidos.",
  },
  {
    kind: "habitacional",
    label: "Financiamento habitacional",
    treatment: "zero",
    explanation:
      "A operação de crédito para fins habitacionais, inclusive a destinada a infraestrutura e saneamento básico de programas com a mesma finalidade, é isenta de IOF. A finalidade habitacional precisa ser comprovada; o enquadramento é feito pela instituição.",
    reference: "Decreto nº 6.306/2007, art. 9º, I (Decreto-Lei nº 2.407/1988)",
    source: DECRETO_6306,
  },
  {
    kind: "rural",
    label: "Crédito rural (custeio, investimento ou comercialização)",
    treatment: "zero",
    explanation:
      "A operação de crédito rural destinada a investimento, custeio ou comercialização tem alíquota zero. Se as condições não forem cumpridas ou houver desvio de finalidade, o IOF passa a ser devido desde a contratação.",
    reference: "Decreto nº 6.306/2007, art. 8º",
    source: DECRETO_6306,
  },
  {
    kind: "portabilidade",
    label: "Portabilidade de crédito",
    treatment: "especifica",
    explanation:
      "A portabilidade tem tratamento próprio no regulamento, e um eventual dinheiro adicional pode ter base separada. Esta situação exige análise específica da operação.",
  },
  {
    kind: "renegociacao",
    label: "Renegociação, prorrogação ou novação",
    treatment: "especifica",
    explanation: "Renegociações, novações, prorrogações e portabilidades podem seguir regras específicas. Esta situação exige análise específica da operação.",
  },
  {
    kind: "rotativo",
    label: "Cheque especial, rotativo ou limite de crédito",
    treatment: "especifica",
    explanation:
      "Também paga IOF, mas sem principal definido a base é o somatório dos saldos devedores diários, com outra metodologia. Esta calculadora trata só de crédito com principal definido.",
  },
];

export const IOF_RULES_VERIFIED_AT = "23/09/2026";

/* -------------------------------------------------------------------------- */
/* Consultas                                                                  */
/* -------------------------------------------------------------------------- */

export type RegimeLookup =
  | { kind: "ok"; regime: IofRegime }
  | { kind: "fora-da-cobertura"; coverageFrom: string }
  | { kind: "acima-do-limite-simples"; limitCents: number };

export function iofRegimeAt(isoDate: string, borrower: Borrower, amountCents: number): RegimeLookup {
  const regime = IOF_REGIMES.find((r) => r.borrower === borrower && isoDate >= r.from && (r.to === null || isoDate <= r.to));
  if (!regime) return { kind: "fora-da-cobertura", coverageFrom: COVERAGE_FROM[borrower] };
  if (regime.maxAmountCents !== undefined && amountCents > regime.maxAmountCents) return { kind: "acima-do-limite-simples", limitCents: regime.maxAmountCents };
  return { kind: "ok", regime };
}

export function operationRule(kind: OperationKind): OperationRule {
  return OPERATION_RULES.find((o) => o.kind === kind)!;
}

/** Fração → "0,0082%" sem zeros à direita inúteis. */
export function formatRate(fraction: number): string {
  const pct = fraction * 100;
  const digits = pct < 0.01 ? 5 : 2;
  return `${pct.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: digits })}%`;
}
