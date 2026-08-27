/**
 * Motor do conversor de taxa de juros mensal ↔ anual.
 *
 * Converte TAXAS EFETIVAS EQUIVALENTES sob capitalização composta,
 * assumindo 12 períodos mensais em um ano:
 *   mensal → anual: (1 + iₘ)¹² − 1
 *   anual → mensal: (1 + iₐ)^(1/12) − 1
 *
 * O que este motor NÃO faz — e a interface repete:
 * - não calcula CET, parcela, juros totais ou custo de contrato algum;
 * - não representa convenções específicas (dias úteis, indexadores etc.);
 * - não trata a multiplicação por 12 como "sempre errada" — ela corresponde
 *   ao conceito de taxa nominal proporcional; apenas não é a equivalência
 *   efetiva composta que esta ferramenta entrega.
 *
 * Precisão: cálculo em ponto flutuante de dupla precisão sem arredondar
 * etapas intermediárias; arredondamento só na apresentação.
 */

import { monthlyToEquivalentAnnual } from "@/lib/calculators/proposal-comparison";
import { annualToMonthlyEffective } from "@/lib/calculators/debt-switch";

export type RateDirection = "monthly-to-annual" | "annual-to-monthly";

/** Limite de proteção técnica (percentual). Não é juízo sobre o mercado. */
export const MAX_RATE_PERCENT = 10_000;

export interface RateConversion {
  direction: RateDirection;
  inputPercent: number;
  /** Taxa efetiva equivalente no outro período */
  outputPercent: number;
  /** Proporcional simples: ×12 (mensal→anual) ou ÷12 (anual→mensal) */
  naivePercent: number;
  /** equivalente − proporcional, em pontos percentuais */
  naiveDiffPP: number;
}

export type RateInputError = "empty" | "invalid" | "negative" | "too-large";

export function validateRatePercent(value: number | null, raw: string): RateInputError | null {
  if (raw.trim() === "") return "empty";
  if (raw.includes("-")) return "negative";
  if (value === null || !Number.isFinite(value)) return "invalid";
  if (value > MAX_RATE_PERCENT) return "too-large";
  return null;
}

export function convertRate(inputPercent: number, direction: RateDirection): RateConversion {
  const outputPercent =
    direction === "monthly-to-annual"
      ? monthlyToEquivalentAnnual(inputPercent)
      : annualToMonthlyEffective(inputPercent);
  const naivePercent =
    direction === "monthly-to-annual" ? inputPercent * 12 : inputPercent / 12;
  return {
    direction,
    inputPercent,
    outputPercent,
    naivePercent,
    naiveDiffPP: outputPercent - naivePercent,
  };
}

/**
 * Formata percentual pt-BR com precisão adaptativa: 2 casas por padrão,
 * até 4 quando o valor é pequeno demais para 2 casas dizerem algo.
 */
export function formatRatePercent(value: number): string {
  const abs = Math.abs(value);
  const digits = abs > 0 && abs < 0.1 ? 4 : 2;
  return `${value.toFixed(digits).replace(".", ",")}%`;
}

/** Frase pronta do resultado (usada no aria-live e no botão copiar). */
export function buildConversionSentence(c: RateConversion): string {
  const [from, to] =
    c.direction === "monthly-to-annual" ? ["ao mês", "ao ano"] : ["ao ano", "ao mês"];
  return `${formatRatePercent(c.inputPercent)} ${from} equivale a aproximadamente ${formatRatePercent(c.outputPercent)} ${to} em taxa efetiva equivalente com capitalização composta.`;
}

/* ------------------------------------------------------------------ */
/* Tabelas de referência — calculadas, nunca hardcoded                */
/* ------------------------------------------------------------------ */

export const REFERENCE_MONTHLY_RATES = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12] as const;
export const REFERENCE_ANNUAL_RATES = [12, 20, 30, 40, 50, 100] as const;

export function monthlyReferenceTable() {
  return REFERENCE_MONTHLY_RATES.map((monthly) => ({
    monthly,
    annual: monthlyToEquivalentAnnual(monthly),
    naive: monthly * 12,
  }));
}

export function annualReferenceTable() {
  return REFERENCE_ANNUAL_RATES.map((annual) => ({
    annual,
    monthly: annualToMonthlyEffective(annual),
  }));
}

/** Taxas próximas ao valor digitado (para a mini-tabela do resultado). */
export function nearbyRates(inputPercent: number, direction: RateDirection): RateConversion[] {
  const step = inputPercent >= 10 ? 2 : inputPercent >= 2 ? 0.5 : 0.25;
  const values = new Set<number>();
  for (const delta of [-2 * step, -step, 0, step, 2 * step]) {
    const v = Math.round((inputPercent + delta) * 100) / 100;
    if (v >= 0 && v <= MAX_RATE_PERCENT) values.add(v);
  }
  return [...values].sort((a, b) => a - b).map((v) => convertRate(v, direction));
}

/** Fatores mês a mês para o accordion "ver como o cálculo funciona". */
export function monthlyFactors(monthlyPercent: number): number[] {
  const factor = 1 + monthlyPercent / 100;
  const rows: number[] = [];
  let acc = 1;
  for (let month = 1; month <= 12; month += 1) {
    acc *= factor;
    rows.push(acc);
  }
  return rows;
}
