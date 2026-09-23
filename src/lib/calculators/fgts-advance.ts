/**
 * MOTOR DA ANTECIPAÇÃO DO SAQUE-ANIVERSÁRIO.
 *
 * A cadeia que o simulador explica, nesta ordem:
 *
 *   saldo → Saque-Aniversário da tabela → valor cedível (R$ 100 a R$ 500)
 *   → quantidade permitida na data → fluxos futuros datados → desconto pela
 *   taxa → valor estimado hoje → diferença.
 *
 * PREMISSAS (declaradas na página, porque mudam o número):
 *
 * - Saldo informado hoje, sem depósitos futuros e sem remuneração do FGTS.
 * - O saldo cai, a cada aniversário, pelo Saque-Aniversário inteiro: a parte
 *   cedida vai para a instituição e o restante fica disponível para saque.
 *   Se a pessoa não sacar o restante, o saldo cai menos; o motor calcula as
 *   duas hipóteses e a página avisa quando elas dão resultados diferentes.
 * - Cede-se o máximo permitido em cada competência: o menor entre o saque e
 *   R$ 500. A instituição pode oferecer menos.
 * - Competência abaixo de R$ 100 não entra — e as seguintes, com saldo
 *   menor, também não. O motor nunca arredonda para cima até o mínimo.
 * - Primeiro saque: o do ano da simulação, se o mês de aniversário ainda não
 *   chegou; senão, o do ano seguinte.
 * - Repasse no 5º dia útil do mês de aniversário, contando sábados,
 *   domingos e feriados nacionais fixos. Feriados móveis e locais podem
 *   deslocar a data em um ou dois dias.
 * - Desconto composto pela taxa mensal, com expoente dias corridos ÷ 30.
 *   Instituições podem usar outra convenção (dias úteis, ano de 360 dias) e
 *   somam IOF e tarifas, que ficam no CET — por isso o resultado é estimativa.
 *
 * NÃO CALCULADO: o valor bloqueado no FGTS. A regra oficial bloqueia a base
 * de saldo necessária para gerar os saques cedidos, mas a forma exata de
 * compor essa base ao longo de vários anos não está publicada em detalhe;
 * o motor só mostra, pela tabela, o saldo que gera um saque de determinado
 * valor (`balanceForSaqueCents`).
 */

import { ADVANCE_RULES, SAQUE_TABLE, advanceRulesAt, isIsoDate, type AdvancePeriod } from "./fgts-rules";

const DAY_MS = 86_400_000;

/* -------------------------------------------------------------------------- */
/* Tabela                                                                     */
/* -------------------------------------------------------------------------- */

/** Faixa da tabela que se aplica ao saldo. */
export function bracketFor(balanceCents: number) {
  return SAQUE_TABLE.brackets.find((b) => b.upToCents === null || balanceCents <= b.upToCents)!;
}

/** Saldo × alíquota + parcela adicional, em centavos, sem arredondar. */
export function exactSaqueCents(balanceCents: number): number {
  if (!(balanceCents > 0)) return 0;
  const b = bracketFor(balanceCents);
  return balanceCents * b.rate + b.addCents;
}

/** Saque-Aniversário do saldo, arredondado ao centavo. */
export function saqueAniversarioCents(balanceCents: number): number {
  return Math.round(exactSaqueCents(balanceCents));
}

/**
 * Menor saldo que, pela tabela, gera um Saque-Aniversário de pelo menos
 * `targetCents`. É conta da tabela — não é o valor que o FGTS bloqueia.
 */
export function balanceForSaqueCents(targetCents: number): number | null {
  if (!(targetCents > 0)) return null;
  let lowerCents = 0;
  for (const b of SAQUE_TABLE.brackets) {
    const needed = Math.ceil((targetCents - b.addCents) / b.rate);
    const candidate = Math.max(needed, lowerCents + 1);
    if (b.upToCents === null || candidate <= b.upToCents) {
      // Conta exata, sem o arredondamento do saque: 1e-6 absorve o erro de ponto flutuante.
      if (exactSaqueCents(candidate) >= targetCents - 1e-6) return candidate;
    }
    if (b.upToCents !== null) lowerCents = b.upToCents;
  }
  return null;
}

/** Quanto do saque pode ser cedido: 0 abaixo do mínimo; no máximo o teto. */
export function cedibleCents(saqueCents: number): number {
  if (saqueCents < ADVANCE_RULES.minPerSaqueCents) return 0;
  return Math.min(saqueCents, ADVANCE_RULES.maxPerSaqueCents);
}

/* -------------------------------------------------------------------------- */
/* Datas                                                                      */
/* -------------------------------------------------------------------------- */

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
export const toIso = (d: Date) => d.toISOString().slice(0, 10);
const fromIso = (s: string) => new Date(`${s}T00:00:00Z`);

/** Feriados nacionais fixos (Leis 662/1949, 6.802/1980 e 14.759/2023). */
function isFixedNationalHoliday(d: Date): boolean {
  const md = `${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
  if (md === "11-20") return d.getUTCFullYear() >= 2024;
  return ["1-1", "4-21", "5-1", "9-7", "10-12", "11-2", "11-15", "12-25"].includes(md);
}

export function isBusinessDay(d: Date): boolean {
  const wd = d.getUTCDay();
  return wd !== 0 && wd !== 6 && !isFixedNationalHoliday(d);
}

/** N-ésimo dia útil do mês (1 = janeiro). */
export function nthBusinessDay(year: number, month: number, n: number): Date {
  let count = 0;
  for (let day = 1; day <= 31; day++) {
    const d = utc(year, month, day);
    if (d.getUTCMonth() !== month - 1) break;
    if (isBusinessDay(d) && ++count === n) return d;
  }
  throw new Error("mês sem dias úteis suficientes");
}

/** Dias corridos entre duas datas ISO. */
export function daysBetween(fromIsoDate: string, toIsoDate: string): number {
  return Math.round((fromIso(toIsoDate).getTime() - fromIso(fromIsoDate).getTime()) / DAY_MS);
}

/** Soma dias corridos a uma data ISO. */
export function addDays(isoDate: string, days: number): string {
  return toIso(new Date(fromIso(isoDate).getTime() + days * DAY_MS));
}

/** Ano da primeira competência que ainda pode ser cedida. */
export function firstCompetenceYear(simDate: string, birthMonth: number): number {
  const [y, m] = simDate.split("-").map(Number) as [number, number];
  return m < birthMonth ? y : y + 1;
}

/** Data estimada do repasse da competência. */
export function transferDate(year: number, birthMonth: number): string {
  return toIso(nthBusinessDay(year, birthMonth, ADVANCE_RULES.transferBusinessDay));
}

/* -------------------------------------------------------------------------- */
/* Taxas e valor presente                                                     */
/* -------------------------------------------------------------------------- */

export type RateUnit = "am" | "aa";

/** Taxa mensal equivalente, em %. Anual → mensal por equivalência composta. */
export function toMonthlyPercent(rate: number, unit: RateUnit): number {
  return unit === "am" ? rate : (Math.pow(1 + rate / 100, 1 / 12) - 1) * 100;
}

export function annualEquivalentPercent(monthlyPercent: number): number {
  return (Math.pow(1 + monthlyPercent / 100, 12) - 1) * 100;
}

/** Valor presente de um fluxo, em centavos (sem arredondar). */
export function discount(cents: number, days: number, monthlyPercent: number): number {
  return cents / Math.pow(1 + monthlyPercent / 100, days / 30);
}

/* -------------------------------------------------------------------------- */
/* Projeção dos saques                                                        */
/* -------------------------------------------------------------------------- */

export interface SaqueRow {
  /** 1 = primeiro saque cedido. */
  index: number;
  /** Ano da competência. */
  year: number;
  /** Data estimada do repasse (AAAA-MM-DD). */
  date: string;
  /** Dias corridos da simulação até o repasse. */
  days: number;
  balanceBeforeCents: number;
  saqueCents: number;
  cededCents: number;
}

export interface Projection {
  rows: SaqueRow[];
  /** Competências pedidas que ficaram de fora porque o saque ficaria abaixo de R$ 100. */
  belowMinimum: number;
}

/**
 * Projeta até `count` competências a partir da data. `withdrawRest`: o
 * saldo cai pelo saque inteiro (padrão) ou só pela parte cedida.
 */
export function projectSaques(input: {
  balanceCents: number;
  birthMonth: number;
  simDate: string;
  count: number;
  withdrawRest?: boolean;
}): Projection {
  const { birthMonth, simDate, count } = input;
  const withdrawRest = input.withdrawRest ?? true;
  const first = firstCompetenceYear(simDate, birthMonth);
  let balance = input.balanceCents;
  const rows: SaqueRow[] = [];
  for (let k = 0; k < count; k++) {
    const saque = saqueAniversarioCents(balance);
    const ceded = cedibleCents(saque);
    if (ceded === 0) return { rows, belowMinimum: count - k };
    const year = first + k;
    const date = transferDate(year, birthMonth);
    rows.push({ index: k + 1, year, date, days: daysBetween(simDate, date), balanceBeforeCents: balance, saqueCents: saque, cededCents: ceded });
    balance -= withdrawRest ? saque : ceded;
  }
  return { rows, belowMinimum: 0 };
}

export interface PricedRow extends SaqueRow {
  /** Valor presente, sem arredondar (centavos). */
  presentCents: number;
}

export interface Priced {
  rows: PricedRow[];
  nominalCents: number;
  /** Valor estimado hoje, arredondado ao centavo só no fim. */
  presentCents: number;
  /** nominal − presente. */
  differenceCents: number;
}

export function price(rows: SaqueRow[], monthlyPercent: number): Priced {
  const priced = rows.map((r) => ({ ...r, presentCents: discount(r.cededCents, r.days, monthlyPercent) }));
  const nominal = rows.reduce((s, r) => s + r.cededCents, 0);
  const present = Math.round(priced.reduce((s, r) => s + r.presentCents, 0));
  return { rows: priced, nominalCents: nominal, presentCents: present, differenceCents: nominal - present };
}

/* -------------------------------------------------------------------------- */
/* Simulação                                                                  */
/* -------------------------------------------------------------------------- */

export const MAX_BALANCE_CENTS = 100_000_000_00;
/** Acima disso a taxa ao mês é recusada como provável erro de digitação. */
export const MAX_MONTHLY_RATE = 10;
/** Acima disso a simulação avisa para conferir a taxa. */
export const SUSPICIOUS_MONTHLY_RATE = 4;

export type SimField = "balanceCents" | "birthMonth" | "simDate" | "rate" | "count";
export interface SimIssue {
  field: SimField;
  message: string;
}

export interface SimulationInput {
  balanceCents: number;
  birthMonth: number;
  rate: number;
  rateUnit: RateUnit;
  count: number;
  simDate: string;
}

export interface CountScenario {
  count: number;
  priced: Priced;
  lastYear: number | null;
}

export interface RateScenario {
  reductionPp: number;
  monthlyPercent: number;
  presentCents: number;
  gainCents: number;
}

export interface SimulationResult {
  period: AdvancePeriod;
  monthlyPercent: number;
  annualPercent: number;
  /** Saque-Aniversário da primeira competência, pelo saldo informado. */
  firstSaqueCents: number;
  firstCedibleCents: number;
  firstYear: number;
  projection: Projection;
  priced: Priced;
  /** Resultado se o saldo cair só pela parte cedida, quando for diferente. */
  ifRestStays: Priced | null;
  byCount: CountScenario[];
  byRate: RateScenario[];
  rateWarning: boolean;
}

export type SimulationOutcome = { kind: "ok"; result: SimulationResult } | { kind: "invalid"; errors: SimIssue[] };

export function simulateAdvance(input: SimulationInput): SimulationOutcome {
  const errors: SimIssue[] = [];
  const period = isIsoDate(input.simDate) ? advanceRulesAt(input.simDate) : null;
  if (!isIsoDate(input.simDate)) errors.push({ field: "simDate", message: "Informe uma data válida." });
  else if (!period) errors.push({ field: "simDate", message: "O simulador usa as regras vigentes desde 01/11/2025." });
  if (!Number.isFinite(input.balanceCents) || input.balanceCents <= 0) errors.push({ field: "balanceCents", message: "Informe o saldo do FGTS." });
  else if (input.balanceCents > MAX_BALANCE_CENTS) errors.push({ field: "balanceCents", message: "Confira o saldo: o valor está alto demais." });
  if (!Number.isInteger(input.birthMonth) || input.birthMonth < 1 || input.birthMonth > 12) errors.push({ field: "birthMonth", message: "Escolha o mês de aniversário." });
  if (!Number.isFinite(input.rate) || input.rate < 0) errors.push({ field: "rate", message: "Informe a taxa da proposta." });
  const monthly = Number.isFinite(input.rate) && input.rate >= 0 ? toMonthlyPercent(input.rate, input.rateUnit) : NaN;
  if (Number.isFinite(monthly) && monthly > MAX_MONTHLY_RATE) errors.push({ field: "rate", message: "Confira a taxa: acima de 10% ao mês parece erro de digitação." });
  if (period && (!Number.isInteger(input.count) || input.count < 1 || input.count > period.maxSaques)) {
    errors.push({ field: "count", message: `Pelas regras desta data, escolha de 1 a ${period.maxSaques} saques.` });
  }
  if (errors.length > 0 || !period) return { kind: "invalid", errors };

  const base = { balanceCents: input.balanceCents, birthMonth: input.birthMonth, simDate: input.simDate };
  const projection = projectSaques({ ...base, count: input.count });
  const priced = price(projection.rows, monthly);

  const alt = price(projectSaques({ ...base, count: input.count, withdrawRest: false }).rows, monthly);
  const ifRestStays = alt.nominalCents !== priced.nominalCents ? alt : null;

  const full = projectSaques({ ...base, count: period.maxSaques });
  const byCount: CountScenario[] = [];
  for (let n = 1; n <= period.maxSaques; n++) {
    const rows = full.rows.slice(0, n);
    if (rows.length < n) break;
    byCount.push({ count: n, priced: price(rows, monthly), lastYear: rows.at(-1)?.year ?? null });
  }

  const byRate: RateScenario[] = [0.25, 0.5, 1].flatMap((pp) => {
    const m = monthly - pp;
    if (m < 0) return [];
    const p = price(projection.rows, m).presentCents;
    return [{ reductionPp: pp, monthlyPercent: m, presentCents: p, gainCents: p - priced.presentCents }];
  });

  const firstSaque = saqueAniversarioCents(input.balanceCents);
  return {
    kind: "ok",
    result: {
      period,
      monthlyPercent: monthly,
      annualPercent: annualEquivalentPercent(monthly),
      firstSaqueCents: firstSaque,
      firstCedibleCents: cedibleCents(firstSaque),
      firstYear: firstCompetenceYear(input.simDate, input.birthMonth),
      projection,
      priced,
      ifRestStays,
      byCount,
      byRate,
      rateWarning: monthly > SUSPICIOUS_MONTHLY_RATE,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Carência                                                                   */
/* -------------------------------------------------------------------------- */

export interface WaitingResult {
  eligibleFrom: string;
  fulfilled: boolean;
  daysLeft: number;
}

/** Data a partir da qual a autorização pode ser dada: adesão + 90 dias corridos. */
export function waitingPeriod(adhesionDate: string, simDate: string): WaitingResult | null {
  if (!isIsoDate(adhesionDate) || !isIsoDate(simDate)) return null;
  const eligibleFrom = addDays(adhesionDate, ADVANCE_RULES.waitingDays);
  const daysLeft = Math.max(0, daysBetween(simDate, eligibleFrom));
  return { eligibleFrom, fulfilled: simDate >= eligibleFrom, daysLeft };
}

/* -------------------------------------------------------------------------- */
/* Proposta recebida                                                          */
/* -------------------------------------------------------------------------- */

export interface OfferData {
  receivedCents: number;
  count: number;
  cededTotalCents: number;
  monthlyRatePercent?: number;
  cetAnnualPercent?: number;
}

export type OfferField = keyof OfferData;
export interface OfferIssue {
  field: OfferField;
  message: string;
}

export interface OfferAnalysis {
  receivedCents: number;
  count: number;
  cededTotalCents: number;
  differenceCents: number;
  /** Fluxos datados usados na taxa implícita (divisão igual do total). */
  flows: Array<{ year: number; date: string; days: number; cents: number }>;
  implicitMonthlyPercent: number | null;
  implicitAnnualPercent: number | null;
  monthlyRatePercent: number | null;
  cetAnnualPercent: number | null;
  /** Mais saques que a regra da data permite. */
  aboveCountLimit: boolean;
  /** Média por saque acima do teto de R$ 500. */
  aboveValueLimit: boolean;
}

/** Divide o total em `count` fluxos iguais; o centavo que sobra vai no último. */
export function splitEvenly(totalCents: number, count: number): number[] {
  const each = Math.floor(totalCents / count);
  return Array.from({ length: count }, (_, i) => (i === count - 1 ? totalCents - each * (count - 1) : each));
}

/**
 * Taxa mensal que iguala o valor presente dos fluxos ao valor recebido, na
 * mesma convenção de desconto do simulador (expoente dias ÷ 30). Bisseção
 * limitada: nunca trava. null quando não existe taxa não negativa.
 */
export function implicitMonthlyRate(receivedCents: number, flows: Array<{ days: number; cents: number }>): number | null {
  const total = flows.reduce((s, f) => s + f.cents, 0);
  if (!(receivedCents > 0) || flows.length === 0 || receivedCents > total) return null;
  if (receivedCents === total) return 0;
  const pv = (m: number) => flows.reduce((s, f) => s + discount(f.cents, f.days, m), 0);
  let lo = 0;
  let hi = 50;
  if (pv(hi) > receivedCents) return null;
  for (let step = 0; step < 200 && hi - lo > 1e-10; step++) {
    const mid = (lo + hi) / 2;
    if (pv(mid) > receivedCents) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export type OfferOutcome = { kind: "ok"; analysis: OfferAnalysis } | { kind: "invalid"; errors: OfferIssue[] };

export function analyzeOffer(data: OfferData, birthMonth: number, simDate: string): OfferOutcome {
  const errors: OfferIssue[] = [];
  const period = advanceRulesAt(simDate);
  if (!Number.isFinite(data.receivedCents) || data.receivedCents <= 0) errors.push({ field: "receivedCents", message: "Informe o valor que você recebe hoje." });
  if (!Number.isInteger(data.count) || data.count < 1 || data.count > 10) errors.push({ field: "count", message: "Informe quantos saques a proposta cede." });
  if (!Number.isFinite(data.cededTotalCents) || data.cededTotalCents <= 0) errors.push({ field: "cededTotalCents", message: "Informe a soma dos saques cedidos." });
  else if (Number.isFinite(data.receivedCents) && data.receivedCents > data.cededTotalCents) {
    errors.push({ field: "receivedCents", message: "O valor recebido não pode passar da soma dos saques cedidos. Confira os números." });
  }
  if (data.monthlyRatePercent !== undefined && (!Number.isFinite(data.monthlyRatePercent) || data.monthlyRatePercent < 0 || data.monthlyRatePercent > MAX_MONTHLY_RATE)) {
    errors.push({ field: "monthlyRatePercent", message: "Confira a taxa informada." });
  }
  if (data.cetAnnualPercent !== undefined && (!Number.isFinite(data.cetAnnualPercent) || data.cetAnnualPercent < 0 || data.cetAnnualPercent > 1_000)) {
    errors.push({ field: "cetAnnualPercent", message: "Confira o CET informado." });
  }
  if (errors.length > 0 || !period || !(birthMonth >= 1 && birthMonth <= 12)) return { kind: "invalid", errors };

  const first = firstCompetenceYear(simDate, birthMonth);
  const flows = splitEvenly(data.cededTotalCents, data.count).map((cents, k) => {
    const date = transferDate(first + k, birthMonth);
    return { year: first + k, date, days: daysBetween(simDate, date), cents };
  });
  const implicit = implicitMonthlyRate(data.receivedCents, flows);
  return {
    kind: "ok",
    analysis: {
      receivedCents: data.receivedCents,
      count: data.count,
      cededTotalCents: data.cededTotalCents,
      differenceCents: data.cededTotalCents - data.receivedCents,
      flows,
      implicitMonthlyPercent: implicit,
      implicitAnnualPercent: implicit === null ? null : annualEquivalentPercent(implicit),
      monthlyRatePercent: data.monthlyRatePercent ?? null,
      cetAnnualPercent: data.cetAnnualPercent ?? null,
      aboveCountLimit: data.count > period.maxSaques,
      aboveValueLimit: data.cededTotalCents > data.count * ADVANCE_RULES.maxPerSaqueCents,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Comparação de propostas — critérios independentes, sem vencedora           */
/* -------------------------------------------------------------------------- */

export type OfferCriterion = "maiorRecebido" | "menorDiferenca" | "menorTaxa" | "menorCet" | "menorTaxaImplicita";

export interface OfferCriterionResult {
  key: OfferCriterion;
  label: string;
  /** Índices das propostas que atendem (empates incluídos). Vazio se indisponível. */
  holders: number[];
  available: boolean;
}

export function compareOffers(list: OfferAnalysis[]): OfferCriterionResult[] {
  const pick = (key: OfferCriterion, label: string, value: (a: OfferAnalysis) => number | null, higher = false): OfferCriterionResult => {
    const values = list.map(value);
    if (list.length < 2 || values.some((v) => v === null)) return { key, label, holders: [], available: false };
    const nums = values as number[];
    const best = higher ? Math.max(...nums) : Math.min(...nums);
    const holders = nums.flatMap((v, i) => (Math.abs(v - best) < 1e-9 ? [i] : []));
    // Todas iguais: o critério não distingue ninguém.
    return { key, label, holders: holders.length === list.length ? [] : holders, available: true };
  };
  return [
    pick("maiorRecebido", "Maior valor recebido hoje", (a) => a.receivedCents, true),
    pick("menorDiferenca", "Menor diferença", (a) => a.differenceCents),
    pick("menorTaxa", "Menor taxa informada", (a) => a.monthlyRatePercent),
    pick("menorCet", "Menor CET informado", (a) => a.cetAnnualPercent),
    pick("menorTaxaImplicita", "Menor taxa implícita", (a) => a.implicitMonthlyPercent),
  ];
}
