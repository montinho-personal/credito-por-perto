/**
 * MOTOR DO IOF-CRÉDITO (principal definido).
 *
 * Metodologia do Decreto nº 6.306/2007, art. 7º:
 *
 * - Parcela diária: incide sobre o valor do principal de CADA parcela, pelo
 *   número de dias corridos entre a liberação e o vencimento daquela parcela,
 *   limitado a 365 dias por principal (§ 1º). Nunca "valor total × dias".
 * - Adicional: alíquota única sobre o valor da operação (§ 15), sem prazo.
 * - Total = diária + adicional, arredondados ao centavo só no fim.
 *
 * CRONOGRAMA. Parcelas mensais no mesmo dia da liberação (dia inexistente vai
 * para o último do mês), dias reais entre datas civis. Sem a taxa de juros,
 * a amortização é igual em todas as parcelas; com a taxa, segue a Price
 * (parcelas iguais), cujo principal se concentra no fim — o IOF sobe um
 * pouco. O SAC é amortização igual por definição.
 *
 * IOF FINANCIADO. Como o IOF é linear no principal para um mesmo formato de
 * cronograma (Price e SAC escalam com o valor), o valor financiado F que
 * cobre o valor recebido L mais o próprio IOF tem forma fechada:
 * F = L ÷ (1 − k), com k = IOF(L) ÷ L. Sem iteração e sem circularidade.
 */

import { pricePayment } from "./loan";
import { addDays, addMonths, daysBetween, isIsoDate } from "./civil-date";
import { iofRegimeAt, operationRule, type Borrower, type IofRegime, type OperationKind, type OperationRule } from "./iof-credit-rules";

export type Schedule = "parcelas" | "unico";
export type Payment = "descontado" | "financiado";

export interface IofInput {
  amountCents: number;
  /** Número de parcelas mensais (parcelas) ou dias até o vencimento (único). */
  term: number;
  termUnit: "meses" | "dias";
  schedule: Schedule;
  /** Juros ao mês, em %, para a Price. Vazio: amortização igual (SAC). */
  monthlyRatePercent?: number;
  releaseDate: string;
  borrower: Borrower;
  operation: OperationKind;
  payment: Payment;
}

export interface PrincipalRow {
  index: number;
  dueDate: string;
  days: number;
  /** Dias que entram na conta (no máximo 365). */
  countedDays: number;
  principalCents: number;
  /** IOF diário desta parcela, sem arredondar. */
  dailyCents: number;
}

export interface IofBreakdown {
  /** Valor sobre o qual o IOF incide (o valor financiado quando o IOF é incorporado). */
  baseCents: number;
  rows: PrincipalRow[];
  dailyCents: number;
  additionalCents: number;
  totalCents: number;
  /** Alguma parcela passou de 365 dias e foi limitada. */
  capped: boolean;
  /** Parte diária sem o limite — para mostrar o efeito dele. */
  dailyWithoutCapCents: number;
}

export interface IofResult {
  regime: IofRegime;
  operation: OperationRule;
  breakdown: IofBreakdown;
  /** Descontado: contratado = valor; recebido = valor − IOF. Financiado: recebido = valor; financiado = valor + IOF. */
  contractedCents: number;
  receivedCents: number;
  /** Percentual do IOF sobre o valor informado. */
  sharePercent: number;
  lastDueDate: string;
  totalDays: number;
}

export type IofOutcome =
  | { kind: "ok"; result: IofResult }
  | { kind: "zero"; operation: OperationRule; amountCents: number }
  | { kind: "especifica"; operation: OperationRule }
  | { kind: "fora-da-cobertura"; coverageFrom: string }
  | { kind: "acima-do-limite-simples"; limitCents: number }
  | { kind: "invalid"; errors: IofIssue[] };

export type IofField = "amountCents" | "term" | "releaseDate" | "monthlyRatePercent";
export interface IofIssue {
  field: IofField;
  message: string;
}

export const MAX_AMOUNT_CENTS = 100_000_000_00;
export const MAX_MONTHS = 480;
export const MAX_DAYS = 3_650;

/* -------------------------------------------------------------------------- */
/* Cronograma de principal                                                    */
/* -------------------------------------------------------------------------- */

/** Principais (centavos, sem arredondar) e vencimentos. */
export function principalSchedule(
  amountCents: number,
  input: Pick<IofInput, "term" | "termUnit" | "schedule" | "monthlyRatePercent" | "releaseDate">,
): Array<{ dueDate: string; principalCents: number }> {
  if (input.schedule === "unico") {
    const days = input.termUnit === "dias" ? input.term : daysBetween(input.releaseDate, addMonths(input.releaseDate, input.term));
    const due = input.termUnit === "dias" ? addDays(input.releaseDate, days) : addMonths(input.releaseDate, input.term);
    return [{ dueDate: due, principalCents: amountCents }];
  }
  const n = input.term;
  const rate = (input.monthlyRatePercent ?? 0) / 100;
  const out: Array<{ dueDate: string; principalCents: number }> = [];
  if (rate > 0) {
    const pmt = pricePayment(amountCents, rate, n);
    let balance = amountCents;
    for (let k = 1; k <= n; k++) {
      const amort = k === n ? balance : pmt - balance * rate;
      balance -= amort;
      out.push({ dueDate: addMonths(input.releaseDate, k), principalCents: amort });
    }
  } else {
    for (let k = 1; k <= n; k++) out.push({ dueDate: addMonths(input.releaseDate, k), principalCents: amountCents / n });
  }
  return out;
}

/** IOF de um valor, pelo regime e pelo formato de cronograma. */
export function iofFor(amountCents: number, input: IofInput, regime: IofRegime): IofBreakdown {
  const schedule = principalSchedule(amountCents, input);
  let capped = false;
  let daily = 0;
  let uncapped = 0;
  const rows = schedule.map((s, i) => {
    const days = daysBetween(input.releaseDate, s.dueDate);
    const counted = Math.min(days, regime.capDays);
    if (days > regime.capDays) capped = true;
    const d = s.principalCents * regime.dailyRate * counted;
    daily += d;
    uncapped += s.principalCents * regime.dailyRate * days;
    return { index: i + 1, dueDate: s.dueDate, days, countedDays: counted, principalCents: s.principalCents, dailyCents: d };
  });
  const dailyCents = Math.round(daily);
  const additionalCents = Math.round(amountCents * regime.additionalRate);
  return {
    baseCents: amountCents,
    rows,
    dailyCents,
    additionalCents,
    totalCents: dailyCents + additionalCents,
    capped,
    dailyWithoutCapCents: Math.round(uncapped),
  };
}

/* -------------------------------------------------------------------------- */
/* Cálculo                                                                    */
/* -------------------------------------------------------------------------- */

export function validateIof(input: IofInput): IofIssue[] {
  const errors: IofIssue[] = [];
  if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) errors.push({ field: "amountCents", message: "Informe o valor do empréstimo." });
  else if (input.amountCents > MAX_AMOUNT_CENTS) errors.push({ field: "amountCents", message: "Confira o valor: está alto demais." });
  const maxTerm = input.termUnit === "meses" ? MAX_MONTHS : MAX_DAYS;
  if (!Number.isInteger(input.term) || input.term < 1 || input.term > maxTerm) {
    errors.push({ field: "term", message: input.termUnit === "meses" ? `Informe o prazo em meses, de 1 a ${MAX_MONTHS}.` : `Informe o prazo em dias, de 1 a ${MAX_DAYS}.` });
  }
  if (input.schedule === "parcelas" && input.termUnit === "dias") errors.push({ field: "term", message: "Parcelas mensais pedem o prazo em meses." });
  if (!isIsoDate(input.releaseDate)) errors.push({ field: "releaseDate", message: "Informe a data da operação." });
  if (input.monthlyRatePercent !== undefined && (!Number.isFinite(input.monthlyRatePercent) || input.monthlyRatePercent < 0 || input.monthlyRatePercent > 30)) {
    errors.push({ field: "monthlyRatePercent", message: "Confira a taxa de juros ao mês." });
  }
  return errors;
}

export function calculateIof(input: IofInput): IofOutcome {
  const errors = validateIof(input);
  if (errors.length > 0) return { kind: "invalid", errors };

  const operation = operationRule(input.operation);
  if (operation.treatment === "especifica") return { kind: "especifica", operation };
  const lookup = iofRegimeAt(input.releaseDate, input.borrower, input.amountCents);
  if (lookup.kind === "fora-da-cobertura") return lookup;
  if (lookup.kind === "acima-do-limite-simples") return lookup;
  if (operation.treatment === "zero") return { kind: "zero", operation, amountCents: input.amountCents };

  const regime = lookup.regime;
  let breakdown = iofFor(input.amountCents, input, regime);
  let contracted = input.amountCents;
  let received = input.amountCents - breakdown.totalCents;

  if (input.payment === "financiado") {
    // F = L ÷ (1 − k): o IOF sobre F é exatamente F − L (a menos de um centavo de arredondamento).
    const k = iofFor(input.amountCents, input, regime);
    const exact = k.rows.reduce((s, r) => s + r.dailyCents, 0) + input.amountCents * regime.additionalRate;
    const share = exact / input.amountCents;
    const financed = Math.round(input.amountCents / (1 - share));
    breakdown = iofFor(financed, input, regime);
    contracted = financed;
    received = input.amountCents;
  }

  const last = breakdown.rows.at(-1)!;
  return {
    kind: "ok",
    result: {
      regime,
      operation,
      breakdown,
      contractedCents: contracted,
      receivedCents: received,
      sharePercent: (breakdown.totalCents / input.amountCents) * 100,
      lastDueDate: last.dueDate,
      totalDays: last.days,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Cenários                                                                   */
/* -------------------------------------------------------------------------- */

export interface TermScenario {
  term: number;
  unit: "meses" | "dias";
  days: number;
  totalCents: number;
  dailyCents: number;
  capped: boolean;
}

/** O mesmo empréstimo em prazos diferentes (mesmo formato de pagamento). */
export function termScenarios(input: IofInput): TermScenario[] {
  const terms = input.schedule === "unico" ? [30, 90, 180, 365, 730] : [3, 6, 12, 24, 36, 48];
  const unit = input.schedule === "unico" ? ("dias" as const) : ("meses" as const);
  return terms.flatMap((term) => {
    const o = calculateIof({ ...input, term, termUnit: unit, payment: "descontado" });
    if (o.kind !== "ok") return [];
    const b = o.result.breakdown;
    return [{ term, unit, days: o.result.totalDays, totalCents: b.totalCents, dailyCents: b.dailyCents, capped: b.capped }];
  });
}

/** Valores diferentes no mesmo prazo. */
export function amountScenarios(input: IofInput, amounts = [5_000_00, 10_000_00, 20_000_00]): Array<{ amountCents: number; totalCents: number }> {
  return amounts.flatMap((amountCents) => {
    const o = calculateIof({ ...input, amountCents, payment: "descontado" });
    return o.kind === "ok" ? [{ amountCents, totalCents: o.result.breakdown.totalCents }] : [];
  });
}
