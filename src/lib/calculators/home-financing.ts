/**
 * SIMULADOR DE FINANCIAMENTO IMOBILIÁRIO — motor de cálculo
 * ============================================================================
 *
 * Camada fina sobre `sac-price.ts`: a tabela mês a mês, o arredondamento e
 * as invariantes são as mesmas da Calculadora SAC x Price — uma conta só no
 * site inteiro. Aqui mora o que é próprio do imóvel:
 *
 * - valor do imóvel e entrada → valor financiado;
 * - o modo inverso: "tenho R$ X por mês, quanto consigo financiar?";
 * - a renda que uma parcela representa sob um critério de comprometimento
 *   informado pela pessoa (a página cita o da Caixa, 30% da renda bruta,
 *   como critério DE INSTITUIÇÃO — não é lei);
 * - as tabelas "e se o prazo fosse outro?" e "e se a entrada fosse outra?".
 *
 * Função pura, centavos inteiros, sem rede.
 */

import { pricePayment } from "@/lib/calculators/loan";
import {
  MAX_MONTHS,
  MIN_PRINCIPAL_CENTS,
  simulateSacPrice,
  toMonthlyRatePercent,
  type FieldIssue,
  type RateUnit,
  type SacPriceResult,
} from "@/lib/calculators/sac-price";

export { MAX_MONTHS, MIN_PRINCIPAL_CENTS, toMonthlyRatePercent };
export type { RateUnit };

export const MAX_PROPERTY_CENTS = 50_000_000_00;

/** Prazos das tabelas de exemplo: 20, 25, 30 e 35 anos. */
export const TERM_SCENARIOS = [240, 300, 360, 420] as const;
/** Entradas das tabelas de exemplo, como fração do valor do imóvel. */
export const DOWN_SCENARIOS = [0.1, 0.2, 0.3, 0.4] as const;

export type HomeField = "propertyCents" | "downCents" | "ratePercent" | "months" | "paymentCents";

export interface HomeIssue {
  field: HomeField;
  message: string;
}

export interface HomeInput {
  propertyCents: number;
  downCents: number;
  ratePercent: number;
  rateUnit: RateUnit;
  months: number;
}

export interface HomeResult {
  propertyCents: number;
  downCents: number;
  /** Entrada como fração do valor do imóvel (0–1). */
  downShare: number;
  financed: SacPriceResult;
}

export type HomeOutcome =
  | { kind: "ok"; result: HomeResult; warnings: HomeIssue[] }
  | { kind: "invalid"; errors: HomeIssue[] };

const isNumber = (v: number) => typeof v === "number" && Number.isFinite(v);

function mapIssue(issue: FieldIssue): HomeIssue {
  return {
    field: issue.field === "principalCents" ? "propertyCents" : (issue.field as HomeField),
    message: issue.message,
  };
}

export function simulateHome(input: HomeInput): HomeOutcome {
  const errors: HomeIssue[] = [];
  if (!isNumber(input.propertyCents) || input.propertyCents <= 0) {
    errors.push({ field: "propertyCents", message: "Informe o valor do imóvel." });
  } else if (input.propertyCents > MAX_PROPERTY_CENTS) {
    errors.push({ field: "propertyCents", message: "Valor acima do limite do simulador (R$ 50 milhões)." });
  }
  if (!isNumber(input.downCents) || input.downCents < 0) {
    errors.push({ field: "downCents", message: "A entrada precisa ser um valor em reais. Sem entrada, deixe vazio." });
  } else if (isNumber(input.propertyCents) && input.propertyCents > 0) {
    if (input.downCents >= input.propertyCents) {
      errors.push({ field: "downCents", message: "A entrada cobre o imóvel inteiro: não sobra nada para financiar." });
    } else if (input.propertyCents - input.downCents < MIN_PRINCIPAL_CENTS) {
      errors.push({ field: "downCents", message: "O valor financiado (imóvel menos entrada) precisa ser de pelo menos R$ 1.000." });
    }
  }

  const outcome = simulateSacPrice({
    principalCents: input.propertyCents - input.downCents,
    ratePercent: input.ratePercent,
    rateUnit: input.rateUnit,
    months: input.months,
  });

  if (outcome.kind === "invalid") {
    for (const e of outcome.errors) {
      const mapped = mapIssue(e);
      // Erro de valor financiado já foi explicado em termos de imóvel e entrada.
      if (mapped.field === "propertyCents" && errors.length > 0) continue;
      if (!errors.some((x) => x.field === mapped.field)) errors.push(mapped);
    }
  }
  if (errors.length > 0 || outcome.kind === "invalid") return { kind: "invalid", errors };

  return {
    kind: "ok",
    warnings: outcome.warnings.map(mapIssue),
    result: {
      propertyCents: input.propertyCents,
      downCents: input.downCents,
      downShare: input.downCents / input.propertyCents,
      financed: outcome.result,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Modo inverso: parcela → valor financiável                                   */
/* -------------------------------------------------------------------------- */

export interface CapacityInput {
  /** Parcela que a pessoa diz caber no mês, em centavos. */
  paymentCents: number;
  ratePercent: number;
  rateUnit: RateUnit;
  months: number;
}

export interface CapacityResult {
  paymentCents: number;
  months: number;
  monthlyRatePercent: number;
  /** Maior valor financiado cuja parcela Price não passa da informada. */
  priceMaxCents: number;
  /** Maior valor financiado cuja 1ª parcela SAC não passa da informada. */
  sacMaxCents: number;
}

export type CapacityOutcome =
  | { kind: "ok"; result: CapacityResult }
  | { kind: "invalid"; errors: HomeIssue[] };

/** 1ª parcela da SAC, com o mesmo arredondamento da tabela. */
function sacFirstPaymentCents(principal: number, i: number, n: number): number {
  return Math.round(principal / n) + Math.round(principal * i);
}

function pricePaymentCents(principal: number, i: number, n: number): number {
  return Math.round(pricePayment(principal, i, n));
}

/**
 * Inverte a fórmula e confere com a própria regra de arredondamento: o valor
 * devolvido gera uma parcela MENOR OU IGUAL à informada, e um centavo a mais
 * já a ultrapassaria.
 *
 *   Price: PV = PMT × [1 − (1 + i)^(−n)] ÷ i        (i = 0: PMT × n)
 *   SAC:   PV = P1 ÷ (1/n + i)                      (1ª parcela)
 */
function invert(target: number, estimate: number, payment: (pv: number) => number): number {
  let pv = Math.max(0, Math.floor(estimate));
  while (pv > 0 && payment(pv) > target) pv -= 1;
  while (payment(pv + 1) <= target) pv += 1;
  return pv;
}

export function maxFinanceable(input: CapacityInput): CapacityOutcome {
  const errors: HomeIssue[] = [];
  if (!isNumber(input.paymentCents) || input.paymentCents <= 0) {
    errors.push({ field: "paymentCents", message: "Informe a parcela que cabe no seu mês." });
  }
  if (!isNumber(input.ratePercent) || input.ratePercent < 0) {
    errors.push({ field: "ratePercent", message: "Informe a taxa de juros (zero ou mais)." });
  } else if (toMonthlyRatePercent(input.ratePercent, input.rateUnit) > 10) {
    errors.push({ field: "ratePercent", message: "Taxa alta demais para um financiamento imobiliário. Confira o número e a unidade." });
  }
  if (!Number.isInteger(input.months) || input.months < 1 || input.months > MAX_MONTHS) {
    errors.push({ field: "months", message: `Informe um prazo entre 1 e ${MAX_MONTHS} meses.` });
  }
  if (errors.length > 0) return { kind: "invalid", errors };

  const monthlyRatePercent = toMonthlyRatePercent(input.ratePercent, input.rateUnit);
  const i = monthlyRatePercent / 100;
  const n = input.months;
  const p = Math.round(input.paymentCents);

  const priceEstimate = i === 0 ? p * n : (p * (1 - Math.pow(1 + i, -n))) / i;
  const sacEstimate = p / (1 / n + i);

  return {
    kind: "ok",
    result: {
      paymentCents: p,
      months: n,
      monthlyRatePercent,
      priceMaxCents: invert(p, priceEstimate, (pv) => pricePaymentCents(pv, i, n)),
      sacMaxCents: invert(p, sacEstimate, (pv) => sacFirstPaymentCents(pv, i, n)),
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Renda e tabelas de cenário                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Renda bruta mínima para que a parcela caiba num teto de comprometimento.
 * `share` é o teto como fração (0,30 = 30%). Arredonda para cima: com um
 * centavo a menos, a parcela passaria do teto.
 */
export function incomeForPayment(paymentCents: number, share: number): number {
  return Math.ceil(paymentCents / share);
}

export interface ScenarioRow {
  months: number;
  principalCents: number;
  downCents?: number;
  result: SacPriceResult;
}

/** Mesmo valor e mesma taxa em vários prazos. */
export function termScenarios(
  principalCents: number,
  ratePercent: number,
  rateUnit: RateUnit,
  terms: readonly number[] = TERM_SCENARIOS,
): ScenarioRow[] {
  return terms.flatMap((months) => {
    const outcome = simulateSacPrice({ principalCents, ratePercent, rateUnit, months });
    return outcome.kind === "ok" ? [{ months, principalCents, result: outcome.result }] : [];
  });
}

/** Mesmo imóvel, mesma taxa e mesmo prazo, com entradas diferentes. */
export function downScenarios(
  propertyCents: number,
  ratePercent: number,
  rateUnit: RateUnit,
  months: number,
  shares: readonly number[] = DOWN_SCENARIOS,
): ScenarioRow[] {
  return shares.flatMap((share) => {
    const downCents = Math.round(propertyCents * share);
    const outcome = simulateSacPrice({
      principalCents: propertyCents - downCents,
      ratePercent,
      rateUnit,
      months,
    });
    return outcome.kind === "ok"
      ? [{ months, principalCents: propertyCents - downCents, downCents, result: outcome.result }]
      : [];
  });
}

/** "30 anos", "35 anos", "18 meses", "2 anos e 6 meses". */
export function monthsInWords(months: number): string {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const y = years === 1 ? "1 ano" : `${years} anos`;
  const m = rest === 1 ? "1 mês" : `${rest} meses`;
  if (years === 0) return m;
  if (rest === 0) return y;
  return `${y} e ${m}`;
}
