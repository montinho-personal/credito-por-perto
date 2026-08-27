/**
 * Motor da ferramenta "Minha taxa está cara?".
 *
 * Princípios:
 * - Compara SEMPRE em % a.m. (unidade das séries oficiais usadas). Taxa
 *   anual do usuário vira equivalente mensal composta antes da comparação:
 *   (1 + anual)^(1/12) − 1. Nunca dividir por 12.
 * - Diferenças em PONTOS PERCENTUAIS (taxa − referência) e diferença
 *   RELATIVA ((taxa/referência − 1) × 100), sempre rotuladas.
 * - A classificação (abaixo/próxima/acima/bem acima) é EDITORIAL, com
 *   limiares documentados na metodologia da página. Ela facilita a leitura
 *   da diferença matemática; não é conceito legal e nunca vira "abusiva",
 *   "ilegal", "boa" ou "ruim".
 * - CET não é taxa de juros: quem informa CET não recebe comparação — a UI
 *   explica e redireciona.
 * - Cálculo client-side; a taxa digitada nunca é enviada ou armazenada.
 */

export type RateUnit = "monthly" | "annual";

/**
 * Limiares EDITORIAIS da classificação, sobre a diferença relativa:
 * dentro de ±10% da referência = "próxima"; acima de +100% (mais que o
 * dobro) = "bem acima". Valores documentados na metodologia da página.
 */
export const CLASSIFICATION_THRESHOLDS = {
  nearBandRelativePct: 10,
  farAboveRelativePct: 100,
} as const;

/** Acima disso (% a.m.), pedimos confirmação de digitação (sem bloquear). */
export const CONFIRM_THRESHOLD_MONTHLY = 30;

export type RateClassification =
  | "below_reference"
  | "near_reference"
  | "above_reference"
  | "far_above_reference";

export interface RateComparisonInput {
  /** Taxa informada pelo usuário, em % (na unidade indicada) */
  userRate: number;
  userUnit: RateUnit;
  /** Referência oficial em % a.m. */
  referenceMonthly: number;
}

export interface RateComparisonResult {
  /** Taxa do usuário convertida para % a.m. (igual à digitada se mensal) */
  userMonthly: number;
  /** Equivalente anual composta da taxa do usuário (% a.a.) — não é CET */
  userAnnualEquivalent: number;
  referenceMonthly: number;
  /** Equivalente anual composta da referência (% a.a.) */
  referenceAnnualEquivalent: number;
  /** userMonthly − referenceMonthly, em pontos percentuais ao mês */
  diffPointsMonthly: number;
  /** (userMonthly / referenceMonthly − 1) × 100 — diferença relativa em % */
  diffRelativePct: number;
  classification: RateClassification;
  /** true quando a taxa mensal passa do limiar de confirmação de digitação */
  confirmSuggested: boolean;
}

export function annualToMonthly(annualPercent: number): number {
  return (Math.pow(1 + annualPercent / 100, 1 / 12) - 1) * 100;
}

export function monthlyToAnnual(monthlyPercent: number): number {
  return (Math.pow(1 + monthlyPercent / 100, 12) - 1) * 100;
}

export function classifyDifference(diffRelativePct: number): RateClassification {
  const { nearBandRelativePct, farAboveRelativePct } = CLASSIFICATION_THRESHOLDS;
  if (Math.abs(diffRelativePct) <= nearBandRelativePct) return "near_reference";
  if (diffRelativePct < 0) return "below_reference";
  if (diffRelativePct > farAboveRelativePct) return "far_above_reference";
  return "above_reference";
}

export function validateRateInput(input: RateComparisonInput): string[] {
  const errors: string[] = [];
  if (!Number.isFinite(input.userRate)) {
    errors.push("Informe a taxa como um número (ex.: 4,20).");
  } else if (input.userRate < 0) {
    errors.push("A taxa não pode ser negativa.");
  } else if (input.userRate > 10_000) {
    errors.push("A taxa informada está fora de escala. Confira o número e a unidade.");
  }
  if (!Number.isFinite(input.referenceMonthly) || input.referenceMonthly <= 0) {
    errors.push("Referência oficial indisponível para esta modalidade.");
  }
  return errors;
}

export function compareRate(input: RateComparisonInput): RateComparisonResult {
  const errors = validateRateInput(input);
  if (errors.length > 0) throw new Error(errors.join(" "));

  const userMonthly =
    input.userUnit === "monthly" ? input.userRate : annualToMonthly(input.userRate);
  const diffPointsMonthly = userMonthly - input.referenceMonthly;
  const diffRelativePct = (userMonthly / input.referenceMonthly - 1) * 100;

  return {
    userMonthly,
    userAnnualEquivalent:
      input.userUnit === "annual" ? input.userRate : monthlyToAnnual(input.userRate),
    referenceMonthly: input.referenceMonthly,
    referenceAnnualEquivalent: monthlyToAnnual(input.referenceMonthly),
    diffPointsMonthly,
    diffRelativePct,
    classification: classifyDifference(diffRelativePct),
    confirmSuggested: userMonthly > CONFIRM_THRESHOLD_MONTHLY,
  };
}

/* ---------- Apresentação ---------- */

export function formatRateBR(value: number, digits = 2): string {
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;
}

/** "32,4" / "32.4" → número; null se inválido. */
export function parseRateBR(raw: string): number | null {
  const cleaned = raw.replace(/[%\s]/g, "").replace(",", ".");
  if (cleaned === "" || !/^\d+(\.\d+)?$/.test(cleaned)) return null;
  return Number(cleaned);
}
