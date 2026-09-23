/**
 * MOTOR DE FLUXO DE CAIXA — a conta do CET, uma só vez para o site inteiro.
 *
 * Convenção de sinais (nunca misturar): o que o CLIENTE RECEBE é positivo; o
 * que o CLIENTE PAGA é negativo. Valores em centavos, sem arredondar.
 *
 * Fórmula da Resolução CMN nº 4.881/2020 (dias corridos ÷ 365):
 *
 *   Σ FCj ÷ (1 + CET)^((dj − d0) ÷ 365) = 0
 *
 * O CET é a taxa ANUAL que zera o valor presente do fluxo. Não há fórmula
 * fechada: a raiz é encontrada por bisseção com intervalo que se expande,
 * que não diverge nem depende de chute inicial. Newton não é usado.
 *
 * Unicidade: com um recebimento na data inicial e só pagamentos depois (uma
 * troca de sinal), a função é monótona e a raiz é única. Com mais de uma
 * troca de sinal, o motor recusa — não escolhe uma taxa arbitrária.
 */

import { daysBetween, isIsoDate } from "./civil-date";

export interface Flow {
  /** AAAA-MM-DD */
  date: string;
  /** Positivo: o cliente recebe. Negativo: o cliente paga. Centavos. */
  amountCents: number;
  description: string;
}

export type FlowProblem =
  | "vazio"
  | "data-invalida"
  | "antes-da-liberacao"
  | "sem-recebimento"
  | "sem-pagamento"
  | "valor-invalido"
  | "fluxo-nao-convencional";

export interface FlowValidation {
  ok: boolean;
  problems: FlowProblem[];
  /** Trocas de sinal na sequência ordenada por data (0 valores ignorados). */
  signChanges: number;
}

/** Agrupa por data e ordena: o que interessa é o saldo de cada dia. */
export function netByDate(flows: Flow[]): Array<{ date: string; amountCents: number }> {
  const map = new Map<string, number>();
  for (const f of flows) map.set(f.date, (map.get(f.date) ?? 0) + f.amountCents);
  return [...map.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([date, amountCents]) => ({ date, amountCents }));
}

export function validateCashFlow(flows: Flow[], d0: string): FlowValidation {
  const problems: FlowProblem[] = [];
  if (flows.length === 0) return { ok: false, problems: ["vazio"], signChanges: 0 };
  if (!isIsoDate(d0) || flows.some((f) => !isIsoDate(f.date))) problems.push("data-invalida");
  if (flows.some((f) => !Number.isFinite(f.amountCents))) problems.push("valor-invalido");
  if (problems.length > 0) return { ok: false, problems, signChanges: 0 };
  if (flows.some((f) => f.date < d0)) problems.push("antes-da-liberacao");
  const net = netByDate(flows).filter((n) => n.amountCents !== 0);
  if (!net.some((n) => n.amountCents > 0)) problems.push("sem-recebimento");
  if (!net.some((n) => n.amountCents < 0)) problems.push("sem-pagamento");
  let changes = 0;
  for (let i = 1; i < net.length; i++) if (Math.sign(net[i]!.amountCents) !== Math.sign(net[i - 1]!.amountCents)) changes++;
  // Fluxo de crédito: recebe primeiro, paga depois. Qualquer outra forma é recusada.
  if (net.length > 0 && (net[0]!.amountCents <= 0 || changes !== 1)) problems.push("fluxo-nao-convencional");
  return { ok: problems.length === 0, problems, signChanges: changes };
}

/** Valor presente do fluxo, na data d0, à taxa anual (fração). */
export function presentValue(flows: Array<{ date: string; amountCents: number }>, d0: string, annualRate: number): number {
  let pv = 0;
  for (const f of flows) pv += f.amountCents / Math.pow(1 + annualRate, daysBetween(d0, f.date) / 365);
  return pv;
}

export type RateOutcome =
  | { kind: "ok"; annualRate: number; residualCents: number; iterations: number }
  | { kind: "invalid"; validation: FlowValidation }
  | { kind: "sem-raiz" };

/**
 * Taxa anual (fração) que zera o valor presente — CET, se o fluxo tiver
 * todos os custos; senão, taxa efetiva do fluxo informado.
 *
 * Tolerância: para quando o intervalo encolhe abaixo de 1e-12 relativo, ou
 * após 400 passos. O resíduo em centavos é devolvido para conferência.
 */
export function solveAnnualRate(flows: Flow[], d0: string): RateOutcome {
  const validation = validateCashFlow(flows, d0);
  if (!validation.ok) return { kind: "invalid", validation };
  const net = netByDate(flows);
  const f = (r: number) => presentValue(net, d0, r);
  // Recebe primeiro e paga depois: f cresce com a taxa (−∞ perto de −100%, → recebimento inicial quando r → ∞).
  let lo = -0.999999;
  let hi = 1;
  let guard = 0;
  while (f(hi) < 0 && guard++ < 200) hi = hi * 2 + 1;
  if (f(hi) < 0 || f(lo) > 0) return { kind: "sem-raiz" };
  let iterations = 0;
  for (; iterations < 400; iterations++) {
    const mid = (lo + hi) / 2;
    if (f(mid) < 0) lo = mid;
    else hi = mid;
    if (hi - lo <= 1e-12 * Math.max(1, Math.abs(mid))) break;
  }
  const rate = (lo + hi) / 2;
  const residual = f(rate);
  if (!Number.isFinite(rate) || !Number.isFinite(residual)) return { kind: "sem-raiz" };
  return { kind: "ok", annualRate: rate, residualCents: residual, iterations };
}

/* -------------------------------------------------------------------------- */
/* Conversões — por equivalência composta, nunca ÷ 12                         */
/* -------------------------------------------------------------------------- */

export function monthlyToAnnual(monthly: number): number {
  return Math.pow(1 + monthly, 12) - 1;
}

export function annualToMonthly(annual: number): number {
  return Math.pow(1 + annual, 1 / 12) - 1;
}

/** Soma do que o cliente paga (positivo). */
export function totalPaidCents(flows: Flow[]): number {
  return flows.reduce((s, f) => s + (f.amountCents < 0 ? -f.amountCents : 0), 0);
}

/** Recebido líquido na data inicial (recebimentos − pagamentos na d0). */
export function netDisbursementCents(flows: Flow[], d0: string): number {
  return flows.filter((f) => f.date === d0).reduce((s, f) => s + f.amountCents, 0);
}
