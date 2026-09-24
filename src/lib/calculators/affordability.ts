/**
 * QUANTO CONSIGO FINANCIAR? — motor de cálculo
 * ============================================================================
 *
 * A pergunta começa pela parcela: "cabe R$ X no meu mês; com esta taxa e
 * este prazo, quanto isso financia?". É a conta do valor presente, a mesma
 * da Calculadora do Cidadão do Banco Central (financiamento com prestações
 * fixas): juros compostos, capitalização mensal, primeira parcela um mês
 * depois da contratação (não paga no ato).
 *
 *   Price: PV = PMT × [1 − (1 + i)^(−n)] ÷ i        (i = 0: PMT × n)
 *   SAC:   PV = P1 ÷ (1/n + i)                      (P1 = 1ª parcela, a maior)
 *
 * O valor é arredondado ao centavo e conferido: a parcela contratual desse
 * valor (arredondada, como em sac-price.ts) nunca passa da informada.
 *
 * Totais pagos e juros saem da TABELA MÊS A MÊS de sac-price.ts — a mesma da
 * Calculadora SAC x Price. Na SAC, nunca pela fórmula da Price.
 *
 * Este módulo é o núcleo "parcela → valor" do site inteiro: o modo
 * "Quanto consigo financiar" do simulador imobiliário usa as mesmas funções
 * (priceFinanceableCents, sacFinanceableCents).
 *
 * É MATEMÁTICA, NÃO APROVAÇÃO: o valor que uma instituição aprova depende
 * de análise de crédito, renda, garantias e política própria. Não entram
 * IOF, seguros, tarifas, TR ou outros indexadores — por isso o total pago
 * aqui não é o CET.
 *
 * Função pura, centavos inteiros, sem rede. Nada sai do navegador.
 */

import { monthlyToAnnualRate, pricePayment } from "@/lib/calculators/loan";
import { buildSchedule, toMonthlyRatePercent, type AmortizationSystem, type RateUnit } from "@/lib/calculators/sac-price";

export type { AmortizationSystem, RateUnit };

/** Parcela acima disso é erro de digitação, não orçamento. */
export const MAX_PAYMENT_CENTS = 1_000_000_00;
/**
 * Proteção técnica da ferramenta, não regra de banco: acima disso a
 * interface pede para conferir o prazo.
 */
export const MAX_AFFORD_MONTHS = 1_200;
/** Acima disso ao mês, a interface pergunta se a unidade (mês/ano) está certa. */
export const HIGH_MONTHLY_RATE_PERCENT = 10;
/** Acima disso ao mês, a taxa sai do limite técnico da ferramenta. */
export const MAX_MONTHLY_RATE_PERCENT = 1_000;

export type AssetType = "imovel" | "veiculo" | "outro";

export type EntryInput = { kind: "reais"; cents: number } | { kind: "percent"; percent: number };

export type AffordField = "paymentCents" | "ratePercent" | "months" | "entry" | "assetCents";

export interface AffordIssue {
  field: AffordField;
  message: string;
}

export interface AffordabilityInput {
  /** Parcela máxima que a pessoa quer testar, em centavos. */
  paymentCents: number;
  ratePercent: number;
  rateUnit: RateUnit;
  months: number;
  entry?: EntryInput | null;
}

export interface SystemCapacity {
  system: AmortizationSystem;
  /** Valor financiável (valor presente das parcelas). */
  financedCents: number;
  /** Price: parcela fixa. SAC: 1ª parcela (a maior). */
  firstPaymentCents: number;
  lastPaymentCents: number;
  /** Soma das parcelas da tabela. Não é CET. */
  totalPaidCents: number;
  totalInterestCents: number;
  /** Entrada em reais (0 sem entrada). */
  entryCents: number;
  /** Valor financiável + entrada. */
  assetCents: number;
  /**
   * true: totais da tabela mês a mês com arredondamento de contrato.
   * false: combinação extrema demais para a tabela ao centavo — totais pela
   * fórmula, sem arredondar parcela a parcela.
   */
  fromSchedule: boolean;
}

export interface AffordabilityResult {
  paymentCents: number;
  months: number;
  ratePercent: number;
  rateUnit: RateUnit;
  /** Taxa mensal efetiva (fração). */
  monthlyRate: number;
  monthlyRatePercent: number;
  annualRatePercent: number;
  entry: EntryInput | null;
  price: SystemCapacity;
  sac: SystemCapacity;
}

export type AffordabilityOutcome =
  | { kind: "ok"; result: AffordabilityResult; warnings: AffordIssue[] }
  | { kind: "invalid"; errors: AffordIssue[] };

const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/* -------------------------------------------------------------------------- */
/* Núcleo: parcela → valor                                                     */
/* -------------------------------------------------------------------------- */

/** Fator de valor presente de n parcelas iguais postecipadas. */
export function annuityFactor(i: number, n: number): number {
  return i === 0 ? n : (1 - Math.pow(1 + i, -n)) / i;
}

/** Parcela contratual da Price para um valor: arredondada ao centavo. */
export function pricePaymentCents(principalCents: number, i: number, n: number): number {
  return Math.round(pricePayment(principalCents, i, n));
}

/** 1ª parcela contratual da SAC: amortização e juros arredondados, como na tabela. */
export function sacFirstPaymentCents(principalCents: number, i: number, n: number): number {
  return Math.round(principalCents / n) + Math.round(principalCents * i);
}

/**
 * Recua centavo a centavo até a parcela contratual caber. Com a fórmula
 * fechada arredondada, o recuo é de zero ou poucos centavos; o limite de
 * passos só existe para que nenhuma entrada trave a página.
 */
function fitDown(estimateCents: number, target: number, payment: (pv: number) => number): number {
  let pv = Math.max(0, Math.round(estimateCents));
  for (let step = 0; step < 10_000 && pv > 0 && payment(pv) > target; step++) pv--;
  return pv;
}

/** Price: PV = PMT × [1 − (1 + i)^(−n)] ÷ i — centavos. */
export function priceFinanceableCents(paymentCents: number, i: number, n: number): number {
  return fitDown(paymentCents * annuityFactor(i, n), paymentCents, (pv) => pricePaymentCents(pv, i, n));
}

/** SAC: PV = P1 ÷ (1/n + i) — P1 é a 1ª parcela, a maior. Centavos. */
export function sacFinanceableCents(firstPaymentCents: number, i: number, n: number): number {
  return fitDown(firstPaymentCents / (1 / n + i), firstPaymentCents, (pv) => sacFirstPaymentCents(pv, i, n));
}

export function financeableCents(system: AmortizationSystem, paymentCents: number, i: number, n: number): number {
  return system === "price" ? priceFinanceableCents(paymentCents, i, n) : sacFinanceableCents(paymentCents, i, n);
}

/* -------------------------------------------------------------------------- */
/* Validação                                                                   */
/* -------------------------------------------------------------------------- */

export function validateAffordability(input: AffordabilityInput): { errors: AffordIssue[]; warnings: AffordIssue[] } {
  const errors: AffordIssue[] = [];
  const warnings: AffordIssue[] = [];

  if (!isNumber(input.paymentCents) || input.paymentCents <= 0) {
    errors.push({ field: "paymentCents", message: "Informe a parcela que quer testar, maior que zero." });
  } else if (input.paymentCents > MAX_PAYMENT_CENTS) {
    errors.push({ field: "paymentCents", message: "Parcela acima do limite técnico da ferramenta (R$ 1 milhão por mês). Confira o número." });
  }

  if (!isNumber(input.ratePercent)) {
    errors.push({ field: "ratePercent", message: "Informe a taxa de juros. Pode ser zero." });
  } else if (input.ratePercent < 0) {
    errors.push({ field: "ratePercent", message: "A taxa não pode ser negativa nesta calculadora." });
  } else {
    const monthly = toMonthlyRatePercent(input.ratePercent, input.rateUnit);
    if (monthly > MAX_MONTHLY_RATE_PERCENT) {
      errors.push({ field: "ratePercent", message: "Taxa fora do limite técnico da ferramenta. Confira o número e a unidade (mês ou ano)." });
    } else if (monthly > HIGH_MONTHLY_RATE_PERCENT) {
      warnings.push({ field: "ratePercent", message: "Taxa muito alta. Confira se selecionou mês ou ano corretamente." });
    }
  }

  if (!isNumber(input.months) || !Number.isInteger(input.months)) {
    errors.push({ field: "months", message: "Informe o prazo em meses inteiros (ou anos inteiros)." });
  } else if (input.months < 1) {
    errors.push({ field: "months", message: "O prazo precisa ter pelo menos 1 mês." });
  } else if (input.months > MAX_AFFORD_MONTHS) {
    errors.push({
      field: "months",
      message: `Prazo acima de ${MAX_AFFORD_MONTHS.toLocaleString("pt-BR")} meses, o limite técnico desta ferramenta. Não é um limite de banco.`,
    });
  }

  const entry = input.entry;
  if (entry) {
    if (entry.kind === "reais" && (!isNumber(entry.cents) || entry.cents < 0)) {
      errors.push({ field: "entry", message: "A entrada precisa ser um valor em reais, zero ou mais." });
    }
    if (entry.kind === "percent" && (!isNumber(entry.percent) || entry.percent < 0 || entry.percent >= 100)) {
      errors.push({ field: "entry", message: "A entrada em percentual precisa ficar entre 0% e menos de 100% do valor do bem." });
    }
  }

  return { errors, warnings };
}

/* -------------------------------------------------------------------------- */
/* Cálculo principal                                                           */
/* -------------------------------------------------------------------------- */

/** Entrada e valor do bem a partir do valor financiável. */
export function assetFromFinanced(financedCents: number, entry: EntryInput | null | undefined): { entryCents: number; assetCents: number } {
  if (!entry) return { entryCents: 0, assetCents: financedCents };
  if (entry.kind === "reais") {
    const e = Math.round(entry.cents);
    return { entryCents: e, assetCents: financedCents + e };
  }
  // financiamento = bem × (1 − e)  →  bem = financiamento ÷ (1 − e)
  const share = entry.percent / 100;
  const assetCents = Math.round(financedCents / (1 - share));
  return { entryCents: assetCents - financedCents, assetCents };
}

function capacityFor(system: AmortizationSystem, paymentCents: number, i: number, n: number, entry: EntryInput | null): SystemCapacity {
  const financedCents = financeableCents(system, paymentCents, i, n);
  const { entryCents, assetCents } = assetFromFinanced(financedCents, entry);
  const base = { system, financedCents, entryCents, assetCents };
  if (financedCents <= 0) {
    return { ...base, firstPaymentCents: 0, lastPaymentCents: 0, totalPaidCents: 0, totalInterestCents: 0, fromSchedule: true };
  }
  const table = buildSchedule(system, financedCents, i, n);
  if (table) {
    return {
      ...base,
      firstPaymentCents: table.firstPaymentCents,
      lastPaymentCents: table.lastPaymentCents,
      totalPaidCents: table.totalPaidCents,
      totalInterestCents: table.totalInterestCents,
      fromSchedule: true,
    };
  }
  // Combinação extrema (taxa altíssima, prazo enorme): a tabela ao centavo
  // deixaria de ser coerente. Totais pela fórmula, sem arredondar mês a mês.
  if (system === "price") {
    const fixed = pricePayment(financedCents, i, n);
    const total = Math.round(fixed * n);
    return {
      ...base,
      firstPaymentCents: Math.round(fixed),
      lastPaymentCents: Math.round(fixed),
      totalPaidCents: total,
      totalInterestCents: total - financedCents,
      fromSchedule: false,
    };
  }
  const interest = Math.round((i * financedCents * (n + 1)) / 2);
  return {
    ...base,
    firstPaymentCents: Math.round(financedCents / n + financedCents * i),
    lastPaymentCents: Math.round((financedCents / n) * (1 + i)),
    totalPaidCents: financedCents + interest,
    totalInterestCents: interest,
    fromSchedule: false,
  };
}

export function calculateAffordability(input: AffordabilityInput): AffordabilityOutcome {
  const { errors, warnings } = validateAffordability(input);
  if (errors.length > 0) return { kind: "invalid", errors };

  const monthlyRatePercent = toMonthlyRatePercent(input.ratePercent, input.rateUnit);
  const i = monthlyRatePercent / 100;
  const n = input.months;
  const p = Math.round(input.paymentCents);
  const entry = input.entry ?? null;

  return {
    kind: "ok",
    warnings,
    result: {
      paymentCents: p,
      months: n,
      ratePercent: input.ratePercent,
      rateUnit: input.rateUnit,
      monthlyRate: i,
      monthlyRatePercent,
      annualRatePercent: monthlyToAnnualRate(monthlyRatePercent),
      entry,
      price: capacityFor("price", p, i, n, entry),
      sac: capacityFor("sac", p, i, n, entry),
    },
  };
}

/* -------------------------------------------------------------------------- */
/* "Tenho um bem de R$ X em mente"                                             */
/* -------------------------------------------------------------------------- */

export type TermNeeded =
  | { kind: "ok"; months: number; withinLimit: boolean }
  /** A parcela não cobre nem os juros do 1º mês: nenhum prazo resolve. */
  | { kind: "nao-amortiza" };

export type RateNeeded =
  | { kind: "ok"; monthlyRatePercent: number; annualRatePercent: number }
  /** Nem com taxa zero a parcela, nesse prazo, chega ao valor. */
  | { kind: "sem-taxa" };

export interface GoalResult {
  system: AmortizationSystem;
  assetCents: number;
  /** Entrada informada, em reais (no modo % é calculada sobre o bem). */
  entryCents: number;
  /** Bem − entrada: o que precisaria ser financiado. */
  neededFinancedCents: number;
  financeableCents: number;
  /** Quanto falta (> 0) ou sobra (≤ 0) entre o necessário e o financiável. */
  gapCents: number;
  reachable: boolean;
  /** Parcela (Price) ou 1ª parcela (SAC) para financiar o necessário, mantendo taxa e prazo. */
  paymentNeededCents: number;
  termNeeded: TermNeeded;
  rateNeeded: RateNeeded;
  /** Entrada que fecharia a conta mantendo parcela, taxa e prazo. */
  entryNeededCents: number;
}

/** Menor prazo (meses) em que a parcela financia o valor. */
export function termNeeded(system: AmortizationSystem, financedCents: number, paymentCents: number, i: number): TermNeeded {
  if (financedCents <= 0) return { kind: "ok", months: 0, withinLimit: true };
  const interestFirst = financedCents * i;
  let months: number;
  if (i === 0) {
    months = Math.ceil(financedCents / paymentCents - 1e-9);
  } else if (paymentCents <= interestFirst) {
    return { kind: "nao-amortiza" };
  } else if (system === "price") {
    // n = −ln(1 − PV × i ÷ PMT) ÷ ln(1 + i)
    const exact = -Math.log(1 - interestFirst / paymentCents) / Math.log(1 + i);
    months = Math.ceil(exact - 1e-9);
  } else {
    // P1 = PV/n + PV × i ≤ PMT  →  n ≥ PV ÷ (PMT − PV × i)
    months = Math.ceil(financedCents / (paymentCents - interestFirst) - 1e-9);
  }
  months = Math.max(1, months);
  // Conferência com o arredondamento ao centavo: no máximo alguns passos.
  for (let step = 0; step < 24 && months <= MAX_AFFORD_MONTHS && financeableCents(system, paymentCents, i, months) < financedCents; step++) months++;
  return { kind: "ok", months, withinLimit: months <= MAX_AFFORD_MONTHS };
}

/** Maior taxa mensal com que a parcela, no prazo, ainda financia o valor. */
export function rateNeeded(system: AmortizationSystem, financedCents: number, paymentCents: number, n: number): RateNeeded {
  if (financedCents <= 0 || paymentCents * n < financedCents) return { kind: "sem-taxa" };
  let monthly: number;
  if (system === "sac") {
    // P1 = PV × (1/n + i)  →  i = P1 ÷ PV − 1/n
    monthly = paymentCents / financedCents - 1 / n;
  } else {
    // PV(i) cai com a taxa: bisseção entre 0 e PMT ÷ PV (acima disso, PV < PMT ÷ i < PV).
    let lo = 0;
    let hi = paymentCents / financedCents;
    for (let step = 0; step < 200; step++) {
      const mid = (lo + hi) / 2;
      if (paymentCents * annuityFactor(mid, n) >= financedCents) lo = mid;
      else hi = mid;
    }
    monthly = lo;
  }
  if (!(monthly >= 0) || !Number.isFinite(monthly)) return { kind: "sem-taxa" };
  const monthlyRatePercent = monthly * 100;
  return { kind: "ok", monthlyRatePercent, annualRatePercent: monthlyToAnnualRate(monthlyRatePercent) };
}

export function analyzeGoal(result: AffordabilityResult, system: AmortizationSystem, assetCents: number): GoalResult {
  const cap = result[system];
  const i = result.monthlyRate;
  const n = result.months;
  const entry = result.entry;
  const entryCents =
    !entry ? 0 : entry.kind === "reais" ? Math.round(entry.cents) : Math.round((assetCents * entry.percent) / 100);
  const needed = Math.max(0, assetCents - entryCents);
  const financeable = cap.financedCents;
  const gap = needed - financeable;

  let paymentNeeded = 0;
  if (needed > 0) {
    // Menor parcela (centavos) cujo valor financiável cobre o necessário.
    const exact = system === "price" ? pricePayment(needed, i, n) : needed / n + needed * i;
    paymentNeeded = Math.max(1, Math.ceil(exact - 1e-9));
    for (let step = 0; step < 1_000 && financeableCents(system, paymentNeeded, i, n) < needed; step++) paymentNeeded++;
  }

  return {
    system,
    assetCents,
    entryCents,
    neededFinancedCents: needed,
    financeableCents: financeable,
    gapCents: gap,
    reachable: gap <= 0,
    paymentNeededCents: paymentNeeded,
    termNeeded: termNeeded(system, needed, result.paymentCents, i),
    rateNeeded: rateNeeded(system, needed, result.paymentCents, n),
    entryNeededCents: Math.max(0, assetCents - financeable),
  };
}

/* -------------------------------------------------------------------------- */
/* Cenários: uma variável por vez                                              */
/* -------------------------------------------------------------------------- */

export type ScenarioChange =
  | { kind: "parcela"; deltaCents: number }
  | { kind: "prazo"; months: number }
  | { kind: "taxa"; deltaPp: number };

export interface ScenarioOutcome {
  change: ScenarioChange;
  input: AffordabilityInput;
  /** null quando a variação sai do domínio (taxa negativa, prazo acima do limite). */
  after: AffordabilityResult | null;
  unavailableReason?: string;
}

export function applyScenario(input: AffordabilityInput, change: ScenarioChange): ScenarioOutcome {
  let next: AffordabilityInput;
  if (change.kind === "parcela") next = { ...input, paymentCents: input.paymentCents + change.deltaCents };
  else if (change.kind === "prazo") next = { ...input, months: change.months };
  else {
    const rate = Math.round((input.ratePercent + change.deltaPp) * 1e6) / 1e6;
    if (rate < 0) return { change, input, after: null, unavailableReason: "A taxa ficaria abaixo de zero." };
    next = { ...input, ratePercent: rate };
  }
  const outcome = calculateAffordability(next);
  if (outcome.kind === "invalid") {
    return { change, input: next, after: null, unavailableReason: outcome.errors[0]?.message };
  }
  return { change, input: next, after: outcome.result };
}

/** Prazos de referência do gráfico, por tipo de bem — pontos de ilustração, não limites de mercado. */
export const TERM_POINTS: Record<AssetType, readonly number[]> = {
  imovel: [60, 120, 180, 240, 300, 360, 420],
  veiculo: [12, 24, 36, 48, 60, 72],
  outro: [6, 12, 24, 36, 48, 60],
};

/** Prazos a mais para o cenário "+ prazo", por tipo de bem. */
export const TERM_STEPS: Record<AssetType, readonly number[]> = {
  imovel: [60, 120],
  veiculo: [12, 24],
  outro: [12, 24],
};

/**
 * Sem tipo de bem escolhido, os prazos de referência seguem a ordem de
 * grandeza do prazo digitado: 240 meses pede a régua de imóvel, 48 a de
 * veículo. É só a escala do gráfico e dos cenários, não um palpite sobre o bem.
 */
export function termScaleFor(asset: AssetType | null, months: number): AssetType {
  if (asset) return asset;
  if (months > 72) return "imovel";
  if (months > 24) return "veiculo";
  return "outro";
}

export interface CurvePoint {
  months: number;
  ratePercent: number;
  financedCents: number;
  totalPaidCents: number;
  totalInterestCents: number;
  current: boolean;
}

/** Mesma parcela e mesma taxa em vários prazos (inclui o prazo da pessoa). */
export function termCurve(input: AffordabilityInput, system: AmortizationSystem, points: readonly number[]): CurvePoint[] {
  const terms = [...new Set([...points, input.months])].filter((m) => m >= 1 && m <= MAX_AFFORD_MONTHS).sort((a, b) => a - b);
  return terms.flatMap((months) => {
    const o = calculateAffordability({ ...input, months });
    if (o.kind !== "ok") return [];
    const c = o.result[system];
    return [{ months, ratePercent: input.ratePercent, financedCents: c.financedCents, totalPaidCents: c.totalPaidCents, totalInterestCents: c.totalInterestCents, current: months === input.months }];
  });
}

/**
 * Mesma parcela e mesmo prazo, com a taxa variando em passos de `stepPp`
 * pontos percentuais na unidade digitada (−2 a +2 passos; negativas saem).
 */
export function rateCurve(input: AffordabilityInput, system: AmortizationSystem, stepPp: number): CurvePoint[] {
  return [-2, -1, 0, 1, 2].flatMap((k) => {
    const ratePercent = Math.round((input.ratePercent + k * stepPp) * 1e6) / 1e6;
    if (ratePercent < 0) return [];
    const o = calculateAffordability({ ...input, ratePercent });
    if (o.kind !== "ok") return [];
    const c = o.result[system];
    return [{ months: input.months, ratePercent, financedCents: c.financedCents, totalPaidCents: c.totalPaidCents, totalInterestCents: c.totalInterestCents, current: k === 0 }];
  });
}

/** Passo de taxa do gráfico e da sensibilidade: 0,5 p.p. na unidade digitada. */
export const RATE_STEP_PP = 0.5;

/* -------------------------------------------------------------------------- */
/* Renda (opcional): só relação matemática                                     */
/* -------------------------------------------------------------------------- */

export interface IncomeContext {
  /** Parcela ÷ renda (fração). */
  paymentShare: number;
  /** (Parcela + outros compromissos) ÷ renda (fração). */
  totalShare: number;
  /** Renda − parcela − outros compromissos. Pode ser negativo. */
  remainingCents: number;
}

export function incomeContext(paymentCents: number, incomeCents: number, otherCents = 0): IncomeContext | null {
  if (!isNumber(incomeCents) || incomeCents <= 0 || !isNumber(otherCents) || otherCents < 0) return null;
  return {
    paymentShare: paymentCents / incomeCents,
    totalShare: (paymentCents + otherCents) / incomeCents,
    remainingCents: incomeCents - paymentCents - otherCents,
  };
}

/* -------------------------------------------------------------------------- */
/* Texto para copiar                                                           */
/* -------------------------------------------------------------------------- */

const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const pctText = (v: number, digits = 2) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export function buildAffordabilitySummary(result: AffordabilityResult, system: AmortizationSystem): string {
  const c = result[system];
  const unit = result.rateUnit === "am" ? "a.m." : "a.a.";
  const lines = [
    "Crédito por Perto — Quanto consigo financiar?",
    "",
    `Parcela: ${brl(result.paymentCents)}${system === "sac" ? " (1ª parcela, a maior na SAC)" : ""}`,
    `Taxa: ${pctText(result.ratePercent)}% ${unit}`,
    `Prazo: ${result.months} ${result.months === 1 ? "mês" : "meses"}`,
    `Sistema: ${system === "price" ? "Price" : "SAC"}`,
    "",
    `Valor financiável estimado: ${brl(c.financedCents)}`,
  ];
  if (result.entry) {
    lines.push(`Entrada: ${brl(c.entryCents)}`, `Valor aproximado do bem: ${brl(c.assetCents)}`);
  }
  lines.push(
    `Total das parcelas: ${brl(c.totalPaidCents)}`,
    `Juros estimados: ${brl(c.totalInterestCents)}`,
    "",
    "Simulação matemática. Não representa aprovação de crédito.",
    "Não inclui IOF, seguros, tarifas nem indexadores.",
  );
  return lines.join("\n");
}
