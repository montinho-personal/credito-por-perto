/**
 * SIMULADOR DE AMORTIZAÇÃO DE FINANCIAMENTO — motor
 * ============================================================================
 *
 * A pergunta: "o contrato já existe; o que muda se eu colocar dinheiro extra
 * no saldo?". O motor parte de onde o contrato está HOJE (saldo, taxa, prazo
 * restante e sistema) e roda o cronograma mês a mês em três versões:
 *
 *   base       — sem nenhum extra (o contrafactual, sempre presente);
 *   prazo      — o extra reduz o prazo: a prestação-base (Price) ou a quota
 *                de amortização (SAC) do contrato continuam as mesmas, e o
 *                saldo menor acaba antes;
 *   prestacao  — o extra reduz a prestação: o prazo restante continua o
 *                mesmo, e a prestação-base (Price) ou a quota (SAC) são
 *                recalculadas sobre o saldo menor a cada aporte.
 *
 * ORDEM DOS EVENTOS EM CADA MÊS k (documentada e testada):
 *   0. (só no início) o aporte de "hoje" sai do saldo antes da próxima parcela;
 *   1. juros do mês sobre o saldo de abertura: round(saldo × i);
 *   2. prestação contratual: Price = parcela fixa (a última absorve o
 *      resíduo); SAC = quota fixa de amortização + juros;
 *   3. amortizações extras do mês (mensal, anual, personalizada), limitadas
 *      ao saldo que sobrou;
 *   4. no modo "prestacao", recálculo da parcela/quota para o prazo que falta.
 *
 * O mesmo miolo do motor de amortização parcial da Calculadora de Quitação
 * Antecipada (`partial-amortization.ts`): mesmos arredondamentos, mesma
 * parcela Price (`pricePaymentCents`), mesma regra de "reduzir prazo" no SAC
 * (quota constante). Os testes exigem que, com um único aporte de hoje, os
 * dois motores deem exatamente os mesmos números, e que o cenário base bata
 * com o `buildSchedule` do SAC × Price.
 *
 * O que o motor NÃO faz (e a página declara):
 * - indexadores (TR, IPCA), seguros e tarifas: taxa constante, prestação
 *   financeira pura;
 * - dias corridos entre vencimentos: períodos mensais regulares;
 * - valor oficial de liquidação ou recálculo da instituição.
 *
 * Dinheiro em centavos inteiros. Datas civis (AAAA-MM-DD) sem fuso.
 */

import { addMonths } from "@/lib/calculators/civil-date";
import { pricePaymentCents } from "@/lib/calculators/partial-amortization";

/* ------------------------------------------------------------------ *
 * Tipos
 * ------------------------------------------------------------------ */

export type AmortSystem = "price" | "sac";
/** "aa" = anual efetiva; "aa-nominal" = anual nominal com capitalização mensal. */
export type AmortRateUnit = "am" | "aa" | "aa-nominal";
export type AmortMode = "prazo" | "prestacao";

export interface ContractInput {
  balanceCents: number;
  ratePercent: number;
  rateUnit: AmortRateUnit;
  remainingMonths: number;
  system: AmortSystem;
  /** Vencimento da próxima parcela (AAAA-MM-DD). */
  firstDueIso: string;
}

export interface CustomExtra {
  /** Mês do aporte, "AAAA-MM": entra junto com a parcela que vence nesse mês. */
  month: string;
  cents: number;
}

export interface ExtraPlan {
  /** Aporte de hoje, antes da próxima parcela. */
  lumpCents: number;
  /** Extra todo mês, a partir da próxima parcela. */
  monthlyCents: number;
  /** Extra uma vez por ano, no mês escolhido (1 a 12). */
  annual: { cents: number; month: number } | null;
  custom: CustomExtra[];
}

export const NO_EXTRAS: ExtraPlan = { lumpCents: 0, monthlyCents: 0, annual: null, custom: [] };

export interface AmortRow {
  k: number;
  dueIso: string;
  openingCents: number;
  interestCents: number;
  /** Amortização contratual (dentro da prestação). */
  principalCents: number;
  /** Prestação financeira (juros + amortização contratual). */
  paymentCents: number;
  /** Amortização extraordinária aplicada neste mês. */
  extraCents: number;
  closingCents: number;
}

export interface ContractRun {
  mode: AmortMode;
  rows: AmortRow[];
  /** Saldo logo depois do aporte de hoje. */
  balanceAfterLumpCents: number;
  lumpAppliedCents: number;
  /** Quantidade de prestações até zerar. */
  months: number;
  /** Vencimento da última prestação (null se o aporte de hoje quitou). */
  lastDueIso: string | null;
  totalPaymentsCents: number;
  totalInterestCents: number;
  /** Todos os extras efetivamente aplicados, aporte de hoje incluído. */
  totalExtrasCents: number;
  /** Prestações + extras: tudo o que sai do bolso a partir de hoje. */
  totalOutlayCents: number;
  /** Primeira prestação depois de hoje. */
  firstPaymentCents: number;
  lastPaymentCents: number;
  /** Extras que não couberam: excesso sobre o saldo no último mês e aportes em datas depois da quitação. */
  unusedExtrasCents: number;
  /** Aportes personalizados fora do período do contrato. */
  ignoredCustom: number;
  /** Aportes personalizados marcados para depois da quitação. */
  customAfterEnd: number;
}

export type AmortField = "balance" | "rate" | "months" | "firstDue" | "lump" | "monthly" | "annual" | "custom";

export interface AmortIssue {
  field: AmortField;
  message: string;
}

/* ------------------------------------------------------------------ *
 * Limites e taxa
 * ------------------------------------------------------------------ */

export const MAX_BALANCE_CENTS = 50_000_000_00;
export const MAX_MONTHS = 600;
/** Acima disso a taxa quase certamente foi digitada na unidade errada. */
export const MAX_MONTHLY_RATE_PERCENT = 10;
/** Diferença a partir da qual a prestação informada "não bate" com a calculada. */
export const PAYMENT_TOLERANCE = 0.03;

/** Taxa mensal decimal. Anual efetiva: (1+a)^(1/12)−1, nunca a÷12. Nominal: a÷12. */
export function monthlyRate(ratePercent: number, unit: AmortRateUnit): number {
  if (unit === "am") return ratePercent / 100;
  if (unit === "aa-nominal") return ratePercent / 100 / 12;
  return Math.pow(1 + ratePercent / 100, 1 / 12) - 1;
}

/** Anual efetiva equivalente a uma taxa mensal decimal: (1+i)^12−1. */
export function effectiveAnnual(i: number): number {
  return Math.pow(1 + i, 12) - 1;
}

export function validateContract(input: ContractInput, extras: ExtraPlan = NO_EXTRAS): AmortIssue[] {
  const issues: AmortIssue[] = [];
  const { balanceCents: b, ratePercent: r, remainingMonths: n } = input;
  if (!Number.isFinite(b) || b <= 0) issues.push({ field: "balance", message: "Informe o saldo devedor atual." });
  else if (b > MAX_BALANCE_CENTS) issues.push({ field: "balance", message: "O saldo passa do limite do simulador (R$ 50 milhões)." });
  if (!Number.isFinite(r) || r < 0) issues.push({ field: "rate", message: "Informe a taxa de juros do contrato (pode ser 0)." });
  else if (monthlyRate(r, input.rateUnit) * 100 > MAX_MONTHLY_RATE_PERCENT) {
    issues.push({ field: "rate", message: "Taxa acima de 10% ao mês. Confira se a unidade (ao mês ou ao ano) está certa." });
  }
  if (!Number.isInteger(n) || n < 1) issues.push({ field: "months", message: "Informe quantas parcelas ainda faltam (número inteiro)." });
  else if (n > MAX_MONTHS) issues.push({ field: "months", message: `O simulador vai até ${MAX_MONTHS} parcelas restantes.` });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.firstDueIso)) issues.push({ field: "firstDue", message: "Data da próxima parcela inválida." });
  const lump = extras.lumpCents;
  if (!Number.isFinite(lump) || lump < 0) issues.push({ field: "lump", message: "Informe um valor de amortização válido." });
  else if (Number.isFinite(b) && b > 0 && lump > b) {
    issues.push({ field: "lump", message: "A amortização passa do saldo devedor. Para zerar o saldo, o valor é o próprio saldo." });
  }
  if (!Number.isFinite(extras.monthlyCents) || extras.monthlyCents < 0) issues.push({ field: "monthly", message: "Valor extra mensal inválido." });
  if (extras.annual && (!Number.isFinite(extras.annual.cents) || extras.annual.cents < 0 || extras.annual.month < 1 || extras.annual.month > 12)) {
    issues.push({ field: "annual", message: "Aporte anual inválido." });
  }
  if (extras.custom.some((c) => !/^\d{4}-\d{2}$/.test(c.month) || !Number.isFinite(c.cents) || c.cents <= 0)) {
    issues.push({ field: "custom", message: "Confira os aportes personalizados: mês e valor." });
  }
  return issues;
}

/* ------------------------------------------------------------------ *
 * Cronograma
 * ------------------------------------------------------------------ */

/** Parcela fixa (Price) ou quota de amortização (SAC) para um saldo e prazo. */
export function fixedFor(system: AmortSystem, balanceCents: number, i: number, months: number): number {
  if (months <= 0 || balanceCents <= 0) return 0;
  return system === "price" ? pricePaymentCents(balanceCents, i, months) : Math.round(balanceCents / months);
}

export function dueDate(firstDueIso: string, k: number): string {
  return addMonths(firstDueIso, k - 1);
}

/**
 * Roda o contrato mês a mês com o plano de extras e o modo escolhido.
 * Supõe entrada validada (`validateContract`).
 */
export function runContract(input: ContractInput, extras: ExtraPlan, mode: AmortMode): ContractRun {
  const i = monthlyRate(input.ratePercent, input.rateUnit);
  const n = input.remainingMonths;
  const firstMonth = input.firstDueIso.slice(0, 7);
  const lastMonth = dueDate(input.firstDueIso, n).slice(0, 7);
  const custom = new Map<string, number>();
  let ignoredCustom = 0;
  let unused = 0;
  for (const c of extras.custom) {
    if (c.month < firstMonth || c.month > lastMonth) {
      ignoredCustom += 1;
      continue;
    }
    custom.set(c.month, (custom.get(c.month) ?? 0) + c.cents);
  }

  const lumpApplied = Math.min(Math.max(extras.lumpCents, 0), input.balanceCents);
  let balance = input.balanceCents - lumpApplied;
  // Reduzir prazo mantém a parcela/quota de ANTES do aporte; reduzir
  // prestação recalcula sobre o saldo novo.
  let fixed = fixedFor(input.system, mode === "prazo" ? input.balanceCents : balance, i, n);

  const rows: AmortRow[] = [];
  let totalPayments = 0;
  let totalInterest = 0;
  let totalExtras = lumpApplied;

  for (let k = 1; k <= n && balance > 0; k++) {
    const dueIso = dueDate(input.firstDueIso, k);
    const opening = balance;
    const interest = Math.round(balance * i);
    let principal: number;
    if (k === n) principal = balance;
    else if (input.system === "price") principal = Math.min(fixed, balance + interest) - interest;
    else principal = Math.min(fixed, balance);
    // Arredondamento extremo (taxa alta, saldo mínimo) nunca faz o saldo crescer.
    principal = Math.max(0, Math.min(principal, balance));
    balance -= principal;

    let wanted = extras.monthlyCents;
    if (extras.annual && extras.annual.cents > 0 && Number(dueIso.slice(5, 7)) === extras.annual.month) wanted += extras.annual.cents;
    wanted += custom.get(dueIso.slice(0, 7)) ?? 0;
    const extra = Math.min(wanted, balance);
    unused += wanted - extra;
    balance -= extra;
    if (mode === "prestacao" && extra > 0 && balance > 0) fixed = fixedFor(input.system, balance, i, n - k);

    const payment = principal + interest;
    rows.push({ k, dueIso, openingCents: opening, interestCents: interest, principalCents: principal, paymentCents: payment, extraCents: extra, closingCents: balance });
    totalPayments += payment;
    totalInterest += interest;
    totalExtras += extra;
  }
  // Aportes em datas marcadas para depois da quitação não chegam a entrar.
  const lastPaid = rows[rows.length - 1]?.dueIso.slice(0, 7) ?? "";
  let customAfterEnd = 0;
  for (const [month, cents] of custom) {
    if (month > lastPaid) {
      customAfterEnd += 1;
      unused += cents;
    }
  }

  const last = rows[rows.length - 1];
  return {
    mode,
    rows,
    balanceAfterLumpCents: input.balanceCents - lumpApplied,
    lumpAppliedCents: lumpApplied,
    months: rows.length,
    lastDueIso: last ? last.dueIso : null,
    totalPaymentsCents: totalPayments,
    totalInterestCents: totalInterest,
    totalExtrasCents: totalExtras,
    totalOutlayCents: totalPayments + totalExtras,
    firstPaymentCents: rows[0]?.paymentCents ?? 0,
    lastPaymentCents: last?.paymentCents ?? 0,
    unusedExtrasCents: unused + Math.max(extras.lumpCents - lumpApplied, 0),
    ignoredCustom,
    customAfterEnd,
  };
}

/* ------------------------------------------------------------------ *
 * Comparações
 * ------------------------------------------------------------------ */

export interface RunComparison {
  monthsSaved: number;
  /** Juros futuros que deixam de incidir (a "economia" de verdade). */
  interestAvoidedCents: number;
  /** Diferença no desembolso total, com o extra somado. Igual aos juros evitados. */
  outlayDifferenceCents: number;
  /** Primeira prestação: base − cenário (positivo = caiu). */
  firstPaymentDropCents: number;
}

export function compareRuns(base: ContractRun, alt: ContractRun): RunComparison {
  return {
    monthsSaved: base.months - alt.months,
    interestAvoidedCents: base.totalInterestCents - alt.totalInterestCents,
    outlayDifferenceCents: base.totalOutlayCents - alt.totalOutlayCents,
    firstPaymentDropCents: base.firstPaymentCents - alt.firstPaymentCents,
  };
}

export interface AmortizationResult {
  base: ContractRun;
  prazo: ContractRun;
  prestacao: ContractRun;
  prazoVsBase: RunComparison;
  prestacaoVsBase: RunComparison;
  monthlyRate: number;
}

export type AmortizationOutcome = { kind: "ok"; result: AmortizationResult } | { kind: "invalid"; issues: AmortIssue[] };

/** Base + os dois caminhos, com o mesmo plano de extras. */
export function simulateAmortization(input: ContractInput, extras: ExtraPlan): AmortizationOutcome {
  const issues = validateContract(input, extras);
  if (issues.length > 0) return { kind: "invalid", issues };
  const base = runContract(input, NO_EXTRAS, "prazo");
  const prazo = runContract(input, extras, "prazo");
  const prestacao = runContract(input, extras, "prestacao");
  return {
    kind: "ok",
    result: {
      base,
      prazo,
      prestacao,
      prazoVsBase: compareRuns(base, prazo),
      prestacaoVsBase: compareRuns(base, prestacao),
      monthlyRate: monthlyRate(input.ratePercent, input.rateUnit),
    },
  };
}

/** Saldo ao fim de cada mês, começando pelo saldo de hoje e o saldo após o aporte (o "degrau"). */
export function balanceSeries(input: ContractInput, run: ContractRun): number[] {
  return [input.balanceCents, run.balanceAfterLumpCents, ...run.rows.map((r) => r.closingCents)];
}

/** Primeiro vencimento em que o saldo fica em até `thresholdCents` (null se nunca). */
export function dateBalanceBelow(run: ContractRun, thresholdCents: number): string | null {
  if (run.balanceAfterLumpCents <= thresholdCents) return null;
  return run.rows.find((r) => r.closingCents <= thresholdCents)?.dueIso ?? null;
}

/* ------------------------------------------------------------------ *
 * Sensibilidade: quanto cada valor compra em tempo e juros
 * ------------------------------------------------------------------ */

const LADDER_CENTS = [500_00, 1_000_00, 2_000_00, 5_000_00, 10_000_00, 20_000_00, 50_000_00, 100_000_00, 200_000_00, 500_000_00, 1_000_000_00];

/**
 * Até 4 valores redondos de aporte, todos até 25% do saldo: cenários, não
 * sugestão. Saldo de R$ 284 mil → 5, 10, 20 e 50 mil.
 */
export function lumpLadder(balanceCents: number): number[] {
  return LADDER_CENTS.filter((v) => v <= balanceCents * 0.25).slice(-4);
}

export interface SensitivityRow {
  lumpCents: number;
  monthsSaved: number;
  interestAvoidedCents: number;
  /** Meses a mais que o degrau anterior elimina. */
  marginalMonths: number;
  marginalInterestCents: number;
  lastDueIso: string | null;
}

export function sensitivity(input: ContractInput, amounts: number[], mode: AmortMode = "prazo"): SensitivityRow[] {
  const base = runContract(input, NO_EXTRAS, "prazo");
  let prevMonths = 0;
  let prevInterest = 0;
  return amounts.map((lumpCents) => {
    const run = runContract(input, { ...NO_EXTRAS, lumpCents }, mode);
    const c = compareRuns(base, run);
    const row: SensitivityRow = {
      lumpCents,
      monthsSaved: c.monthsSaved,
      interestAvoidedCents: c.interestAvoidedCents,
      marginalMonths: c.monthsSaved - prevMonths,
      marginalInterestCents: c.interestAvoidedCents - prevInterest,
      lastDueIso: run.lastDueIso,
    };
    prevMonths = c.monthsSaved;
    prevInterest = c.interestAvoidedCents;
    return row;
  });
}

/* ------------------------------------------------------------------ *
 * Metas reversas
 * ------------------------------------------------------------------ */

export type GoalAnswer =
  | { kind: "valor"; cents: number; run: ContractRun }
  /** A meta já é atendida sem extra. */
  | { kind: "ja-atende" }
  /** Só zerando o saldo hoje. */
  | { kind: "quitacao"; cents: number }
  /** Meta que um extra mensal não alcança (precisa de aporte hoje). */
  | { kind: "precisa-aporte" };

/** Menor valor inteiro em [lo, hi] com ok(v) verdadeiro (ok monotônica). */
function smallest(lo: number, hi: number, ok: (v: number) => boolean): number {
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (ok(mid)) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

/** Arredonda para o real de cima e confirma que a meta continua atendida. */
function toReais(cents: number, ok: (v: number) => boolean, cap: number): number {
  const up = Math.min(Math.ceil(cents / 100) * 100, cap);
  return ok(up) ? up : cents;
}

/** Quanto amortizar hoje para terminar `monthsEarlier` meses antes (reduzindo prazo). */
export function lumpForMonthsEarlier(input: ContractInput, monthsEarlier: number): GoalAnswer {
  const base = runContract(input, NO_EXTRAS, "prazo");
  const goal = base.months - monthsEarlier;
  if (monthsEarlier <= 0) return { kind: "ja-atende" };
  if (goal <= 0) return { kind: "quitacao", cents: input.balanceCents };
  const ok = (v: number) => runContract(input, { ...NO_EXTRAS, lumpCents: v }, "prazo").months <= goal;
  const cents = toReais(smallest(0, input.balanceCents, ok), ok, input.balanceCents);
  if (cents >= input.balanceCents) return { kind: "quitacao", cents: input.balanceCents };
  return { kind: "valor", cents, run: runContract(input, { ...NO_EXTRAS, lumpCents: cents }, "prazo") };
}

/** Quantas prestações vencem até o fim do mês "AAAA-MM". */
export function installmentsUntil(input: ContractInput, targetMonth: string): number {
  let count = 0;
  for (let k = 1; k <= input.remainingMonths; k++) {
    if (dueDate(input.firstDueIso, k).slice(0, 7) <= targetMonth) count = k;
    else break;
  }
  return count;
}

/** Quanto amortizar hoje para a última parcela vencer até o mês "AAAA-MM". */
export function lumpForEndMonth(input: ContractInput, targetMonth: string): GoalAnswer {
  const base = runContract(input, NO_EXTRAS, "prazo");
  const goal = installmentsUntil(input, targetMonth);
  return lumpForMonthsEarlier(input, base.months - goal);
}

/** Quanto amortizar hoje para a primeira prestação ficar em até `targetCents` (mantendo o prazo). */
export function lumpForPayment(input: ContractInput, targetCents: number): GoalAnswer {
  const base = runContract(input, NO_EXTRAS, "prazo");
  if (targetCents >= base.firstPaymentCents) return { kind: "ja-atende" };
  if (targetCents <= 0) return { kind: "quitacao", cents: input.balanceCents };
  const ok = (v: number) => runContract(input, { ...NO_EXTRAS, lumpCents: v }, "prestacao").firstPaymentCents <= targetCents;
  const cents = toReais(smallest(0, input.balanceCents, ok), ok, input.balanceCents);
  if (cents >= input.balanceCents) return { kind: "quitacao", cents: input.balanceCents };
  return { kind: "valor", cents, run: runContract(input, { ...NO_EXTRAS, lumpCents: cents }, "prestacao") };
}

/** Quanto pagar a mais todo mês para terminar `monthsEarlier` meses antes. */
export function monthlyForMonthsEarlier(input: ContractInput, monthsEarlier: number): GoalAnswer {
  const base = runContract(input, NO_EXTRAS, "prazo");
  const goal = base.months - monthsEarlier;
  if (monthsEarlier <= 0) return { kind: "ja-atende" };
  if (goal <= 0) return { kind: "precisa-aporte" };
  const ok = (v: number) => runContract(input, { ...NO_EXTRAS, monthlyCents: v }, "prazo").months <= goal;
  const cents = toReais(smallest(0, input.balanceCents, ok), ok, input.balanceCents);
  return { kind: "valor", cents, run: runContract(input, { ...NO_EXTRAS, monthlyCents: cents }, "prazo") };
}

/* ------------------------------------------------------------------ *
 * Prestação informada × calculada
 * ------------------------------------------------------------------ */

export type PaymentCheck = "proxima" | "informada-maior" | "informada-menor";

/**
 * A prestação que a pessoa paga pode ter seguro, tarifa ou correção por
 * indexador. Nunca forçamos o cálculo a bater: só avisamos a diferença.
 */
export function checkInformedPayment(informedCents: number, computedCents: number): PaymentCheck {
  if (informedCents > computedCents * (1 + PAYMENT_TOLERANCE)) return "informada-maior";
  if (informedCents < computedCents * (1 - PAYMENT_TOLERANCE)) return "informada-menor";
  return "proxima";
}

/* ------------------------------------------------------------------ *
 * Rótulos de data
 * ------------------------------------------------------------------ */

const MONTHS_PT = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2046-09-10" → "setembro de 2046". */
export function monthYearLong(iso: string): string {
  return `${MONTHS_PT[Number(iso.slice(5, 7)) - 1]} de ${iso.slice(0, 4)}`;
}

/** "2046-09-10" → "set/2046". */
export function monthYearShort(iso: string): string {
  return `${MONTHS_SHORT[Number(iso.slice(5, 7)) - 1]}/${iso.slice(0, 4)}`;
}
