/**
 * REGRAS DO CARTÃO DE CRÉDITO — um lugar só
 * ============================================================================
 *
 * Toda regra regulatória usada pela calculadora de juros do cartão mora
 * aqui, com vigência, fonte e data de verificação. Nenhum outro arquivo
 * escreve "100%" ou "03/01/2024" por conta própria: quando a norma mudar,
 * muda-se aqui, e os testes dizem o que quebrou.
 *
 * O QUE ENTRA
 *
 * Só regra com fonte oficial já conferida no site (as mesmas do guia "Como
 * sair do rotativo", verificadas em 16/08/2026). Multa, juros de mora e IOF
 * NÃO têm percentual fixo aqui: a pesquisa de 23/09/2026 não conseguiu ler
 * o texto oficial, e a calculadora pede esses valores à pessoa, com os
 * números do contrato ou da fatura. Lacuna declarada, não preenchida.
 */

export interface RegulatoryRule {
  id: string;
  /** O que a regra diz, em uma frase, como aparece na página. */
  summary: string;
  source: { organization: string; title: string; url: string };
  /** DD/MM/AAAA */
  verifiedAt: string;
}

const AGENCIA_GOV_5112 =
  "https://agenciagov.ebc.com.br/noticias/202312/bc-regula-medidas-decorrentes-da-lei-14-690-2023-incluindo-a-portabilidade-do-credito-rotativo";

/** Teto dos juros e encargos financeiros do rotativo e do parcelamento da fatura. */
export const INTEREST_CAP = {
  id: "teto-100-por-cento",
  /** Primeiro dia em que o teto vale. */
  effectiveFrom: "2024-01-03",
  /** Juros + encargos financeiros acumulados ≤ esta fração do valor original. */
  shareOfOriginal: 1,
  /** O IOF fica fora do limite. */
  excludesIof: true,
  summary:
    "Desde 03/01/2024, os juros e encargos financeiros do rotativo e do parcelamento da fatura não podem passar de 100% do valor original da dívida; o IOF fica fora do limite.",
  source: {
    organization: "Agência Gov (EBC) / Banco Central do Brasil",
    title: "BC regula medidas decorrentes da Lei 14.690/2023 (Resolução CMN nº 5.112/2023)",
    url: AGENCIA_GOV_5112,
  },
  verifiedAt: "16/08/2026",
} as const satisfies RegulatoryRule & Record<string, unknown>;

/** Quanto tempo o saldo pode ficar no rotativo. */
export const ROTATIVO_DURATION = {
  id: "rotativo-ate-proxima-fatura",
  summary:
    "O saldo não pago só pode permanecer no crédito rotativo até o vencimento da fatura seguinte; a partir daí, a instituição deve oferecer parcelamento em condições mais vantajosas que as do rotativo.",
  source: {
    organization: "Conselho Monetário Nacional / Banco Central do Brasil",
    title: "Resolução CMN nº 4.549/2017",
    url: "https://www.bcb.gov.br",
  },
  verifiedAt: "16/08/2026",
} as const satisfies RegulatoryRule;

/** Portabilidade do saldo do rotativo e do parcelamento da fatura. */
export const PORTABILITY = {
  id: "portabilidade-rotativo",
  summary:
    "A regulamentação da Lei 14.690/2023 previu a portabilidade da dívida do rotativo e do parcelamento da fatura para outra instituição.",
  source: {
    organization: "Agência Gov (EBC) / Banco Central do Brasil",
    title: "BC regula medidas decorrentes da Lei 14.690/2023",
    url: AGENCIA_GOV_5112,
  },
  verifiedAt: "16/08/2026",
} as const satisfies RegulatoryRule;

/**
 * O teto não recomeça quando o saldo do rotativo vira parcelamento: o valor
 * original continua sendo o que entrou no rotativo.
 *
 * Conferida pelo proprietário no PDF do Banco Central (instruções do
 * documento 3060, "Juros acumulados no cartão") em 23/09/2026. O tipo aceita
 * null de propósito: sem data de verificação, a página e o simulador escondem
 * a regra em vez de publicá-la sem conferência.
 */
export const CAP_CONTINUITY = {
  id: "teto-continua-no-parcelamento",
  summary:
    "Quando o saldo do rotativo passa para o parcelamento da fatura, o limite de juros e encargos não recomeça: o valor original continua sendo o que entrou no rotativo.",
  source: {
    organization: "Banco Central do Brasil",
    title: "Instruções de preenchimento do documento 3060 — juros acumulados no cartão",
    url: "https://www.bcb.gov.br/content/estabilidadefinanceira/Leiaute_de_documentos/3060/Instrucoes-preenchimento-Juros-acumulados-cartao.pdf",
  },
  verifiedAt: "23/09/2026" as string | null,
} as const;

/** Liquidação antecipada com redução proporcional dos juros (CDC). */
export const EARLY_PAYOFF = {
  id: "quitacao-reducao-proporcional",
  summary:
    "O Código de Defesa do Consumidor assegura a liquidação antecipada do débito, total ou parcial, com redução proporcional dos juros e demais acréscimos (art. 52, §2º).",
  source: {
    organization: "Presidência da República",
    title: "Código de Defesa do Consumidor (Lei nº 8.078/1990), art. 52, §2º",
    url: "https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm",
  },
  verifiedAt: "28/08/2026",
} as const satisfies RegulatoryRule;

/** Taxas médias do rotativo por instituição, publicadas pelo BC. */
export const BC_RATES_PAGE = "https://www.bcb.gov.br/estatisticas/txjuros";

export const CARD_RULES: readonly RegulatoryRule[] = [INTEREST_CAP, ROTATIVO_DURATION, PORTABILITY, EARLY_PAYOFF];

/* -------------------------------------------------------------------------- */
/* Aplicação do teto                                                          */
/* -------------------------------------------------------------------------- */

/** A dívida começou (entrou no rotativo) a partir da vigência do teto? */
export type DebtStart = "depois" | "antes" | "nao-sei";

export interface CapInput {
  /** Valor original da dívida alcançada pela regra, em centavos. */
  originalCents: number;
  /** Juros e encargos financeiros já cobrados sobre essa dívida (sem IOF). */
  alreadyChargedCents: number;
  /** Juros e encargos financeiros desta simulação (sem IOF). */
  newChargesCents: number;
  start: DebtStart;
}

export type CapResult =
  | { status: "nao-se-aplica"; reason: "antes-da-vigencia" }
  | { status: "incerto"; capCents: number; roomCents: number; wouldExceed: boolean; excessCents: number }
  | { status: "dentro"; capCents: number; roomCents: number }
  | { status: "ultrapassaria"; capCents: number; roomCents: number; excessCents: number };

/**
 * Compara os encargos acumulados com o teto. NÃO recalcula a dívida nem
 * "corrige" a cobrança: só diz se, pelos números informados, a soma passaria
 * do limite — a página pede para conferir origem e valores, nunca acusa.
 *
 * O teto limita encargos ACUMULADOS; a taxa do contrato continua sendo a
 * informada. Nunca usar 100% como taxa.
 */
export function applyRegulatoryCap(input: CapInput): CapResult {
  const capCents = Math.round(input.originalCents * INTEREST_CAP.shareOfOriginal);
  const roomCents = Math.max(capCents - Math.max(input.alreadyChargedCents, 0), 0);
  const excessCents = Math.max(input.newChargesCents - roomCents, 0);
  if (input.start === "antes") return { status: "nao-se-aplica", reason: "antes-da-vigencia" };
  if (input.start === "nao-sei") {
    return { status: "incerto", capCents, roomCents, wouldExceed: excessCents > 0, excessCents };
  }
  return excessCents > 0
    ? { status: "ultrapassaria", capCents, roomCents, excessCents }
    : { status: "dentro", capCents, roomCents };
}

/** "2024-01-03" → "03/01/2024" */
export function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
