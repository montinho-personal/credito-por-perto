/**
 * Motor do "Plano para sair das dívidas".
 *
 * Organiza várias dívidas informadas pelo usuário, separa prioridade
 * MATEMÁTICA (avalanche/bola de neve) de prioridade PRÁTICA (atraso,
 * garantia, bem essencial, situação urgente) e — somente quando os dados
 * permitem — projeta a quitação.
 *
 * Estrutura em módulos, conforme a arquitetura pedida:
 *   1. DebtNormalizer     — normaliza taxas e classifica modelabilidade
 *   2. DebtPriorityEngine — ordena por avalanche e por bola de neve
 *   3. DebtWarningEngine  — atenções por dívida e do plano como um todo
 *   4. DebtSimulationEngine — projeção mês a mês com efeito cascata
 *   5. DebtPlanFormatter  — texto exportável do plano
 *
 * O que este motor NUNCA faz:
 * - prometer data de quitação (tudo é estimativa, com hipóteses declaradas);
 * - diagnosticar "superendividamento" (conceito jurídico, não aritmético);
 * - dizer qual dívida deixar de pagar quando o dinheiro não cobre tudo;
 * - apresentar avalanche ou bola de neve como o método correto para todos;
 * - inventar taxa não informada (taxa ausente ≠ taxa zero);
 * - misturar silenciosamente as prioridades práticas na ordem matemática.
 *
 * Dinheiro em centavos inteiros; arredondamento apenas na apresentação.
 * Taxas sempre convertidas por equivalência composta, nunca ×12.
 */

import { annualToMonthlyEffective } from "./debt-switch";

/* ------------------------------------------------------------------ *
 * Tipos
 * ------------------------------------------------------------------ */

export type DebtType =
  | "cartao"
  | "cheque-especial"
  | "emprestimo-pessoal"
  | "consignado"
  | "financiamento-veiculo"
  | "financiamento-imobiliario"
  | "parcelamento"
  | "renegociada"
  | "crediario"
  | "outro";

/** Natureza do valor mensal informado — muda o que dá para projetar. */
export type PaymentKind = "parcela-fixa" | "minimo" | "costumo-pagar" | "nao-sei";

export type RateUnit = "mensal" | "anual" | "sem-juros" | "nao-sei";

export type TriState = "yes" | "no" | "unknown";

export type UrgentFlag =
  | "nenhuma"
  | "nao-sei"
  | "acordo-vencendo"
  | "cobranca-judicial"
  | "risco-perda-bem"
  | "servico-interrupcao";

export interface DebtInput {
  id: string;
  /** Apelido livre; nunca pedimos o nome da instituição */
  label: string;
  type: DebtType;
  balanceCents: number;
  /** Pagamento mensal atual; pode ser 0 (dívida atrasada, por exemplo) */
  monthlyPaymentCents: number;
  paymentKind: PaymentKind;
  /** Percentual informado (ex.: 4.5 para 4,5%) */
  rateValue: number | null;
  rateUnit: RateUnit;
  overdue: boolean;
  overdueDays: number | null;
  essential: TriState;
  collateral: TriState;
  urgent: UrgentFlag;
}

/** Motivos pelos quais uma dívida entra em "revisar antes da ordem". */
export type AttentionReason =
  | "atraso"
  | "garantia"
  | "bem-essencial"
  | "acordo-vencendo"
  | "cobranca-judicial"
  | "risco-perda-bem"
  | "servico-interrupcao"
  | "nao-amortiza";

export interface NormalizedDebt extends DebtInput {
  /** Taxa mensal efetiva em decimal (0.045 = 4,5% a.m.); null = não informada */
  monthlyRate: number | null;
  /** Dívida de saldo rotativo (uso pode variar) — muda as hipóteses */
  revolving: boolean;
  /** Dá para projetar a evolução do saldo com os dados informados? */
  modelable: boolean;
  attentionReasons: AttentionReason[];
}

export interface PriorityResult {
  method: "avalanche" | "snowball";
  /** Ids na ordem de prioridade do método */
  orderedIds: string[];
  /** Ids que o método não consegue ordenar (avalanche sem taxa) */
  unrankedIds: string[];
  status: "complete" | "incomplete";
}

export type PlanWarningCode =
  | "budget-deficit"
  | "budget-exact"
  | "no-rates"
  | "some-rates-missing"
  | "non-amortizing-debt"
  | "extreme-rate"
  | "single-debt";

export interface MonthAllocation {
  debtId: string;
  cents: number;
}

export interface MonthRow {
  month: number;
  /** Preenchido apenas nos primeiros meses (o resto é resumo) */
  allocations: MonthAllocation[];
  remainingTotalCents: number;
}

export interface SimulationResult {
  method: "avalanche" | "snowball" | "baseline";
  /** null quando não quita dentro do horizonte usado */
  monthsToPayoff: number | null;
  totalInterestCents: number;
  totalPaidCents: number;
  /** Mês estimado de quitação de cada dívida */
  payoffMonthByDebt: Record<string, number>;
  /** Primeiros meses detalhados, para o calendário */
  calendar: MonthRow[];
  reachedHorizon: boolean;
}

export interface DebtPlanBudget {
  availableCents: number | null;
  requiredCents: number;
  /** disponível − necessário (positivo = sobra para acelerar) */
  additionalCents: number | null;
  status: "surplus" | "exact" | "deficit" | "unknown";
}

export interface DebtPlanInput {
  debts: DebtInput[];
  monthlyAvailableCents: number | null;
  lumpSumCents: number | null;
}

export interface DebtPlanResult {
  debts: NormalizedDebt[];
  totals: {
    count: number;
    balanceCents: number;
    basePaymentsCents: number;
  };
  budget: DebtPlanBudget;
  /** Dívidas que merecem revisão antes de seguir a ordem matemática */
  attentionIds: string[];
  avalanche: PriorityResult;
  snowball: PriorityResult;
  projection: {
    status: "full" | "priority-only";
    /** Por que a projeção não foi feita */
    blockers: string[];
    avalanche: SimulationResult | null;
    snowball: SimulationResult | null;
    /** Cenário sem o valor adicional, para medir o efeito do extra */
    baseline: SimulationResult | null;
  };
  warnings: PlanWarningCode[];
  /** Hipóteses da simulação, sempre exibidas junto do resultado */
  assumptions: string[];
}

/* ------------------------------------------------------------------ *
 * 1. DebtNormalizer
 * ------------------------------------------------------------------ */

/** Tipos cujo saldo é rotativo: o uso pode mudar de um mês para o outro. */
const REVOLVING_TYPES: ReadonlySet<DebtType> = new Set<DebtType>([
  "cartao",
  "cheque-especial",
]);

/** Acima disso pedimos confirmação de digitação — sem bloquear. */
export const EXTREME_MONTHLY_RATE = 0.35;

/** Horizonte da simulação; além disso não projetamos. */
export const MAX_SIMULATION_MONTHS = 360;

/** Meses com alocação detalhada no calendário. */
const DETAILED_MONTHS = 12;

export function normalizeDebt(debt: DebtInput): NormalizedDebt {
  let monthlyRate: number | null = null;
  if (debt.rateUnit === "sem-juros") {
    monthlyRate = 0;
  } else if (
    debt.rateValue !== null &&
    Number.isFinite(debt.rateValue) &&
    debt.rateValue >= 0
  ) {
    if (debt.rateUnit === "mensal") {
      monthlyRate = debt.rateValue / 100;
    } else if (debt.rateUnit === "anual") {
      // annualToMonthlyEffective trabalha em percentual (60 → 3,995)
      monthlyRate = annualToMonthlyEffective(debt.rateValue) / 100;
    }
  }

  const revolving = REVOLVING_TYPES.has(debt.type);
  const modelable =
    monthlyRate !== null &&
    debt.balanceCents > 0 &&
    debt.monthlyPaymentCents > 0;

  const attentionReasons: AttentionReason[] = [];
  if (debt.overdue) attentionReasons.push("atraso");
  if (debt.collateral === "yes") attentionReasons.push("garantia");
  if (debt.essential === "yes") attentionReasons.push("bem-essencial");
  if (debt.urgent === "acordo-vencendo") attentionReasons.push("acordo-vencendo");
  if (debt.urgent === "cobranca-judicial") attentionReasons.push("cobranca-judicial");
  if (debt.urgent === "risco-perda-bem") attentionReasons.push("risco-perda-bem");
  if (debt.urgent === "servico-interrupcao") attentionReasons.push("servico-interrupcao");

  // Pagamento que não cobre nem os encargos do mês: o saldo não cairia.
  if (
    monthlyRate !== null &&
    debt.monthlyPaymentCents > 0 &&
    debt.balanceCents > 0 &&
    Math.round(debt.balanceCents * monthlyRate) >= debt.monthlyPaymentCents
  ) {
    attentionReasons.push("nao-amortiza");
  }

  return { ...debt, monthlyRate, revolving, modelable, attentionReasons };
}

/* ------------------------------------------------------------------ *
 * 2. DebtPriorityEngine
 * ------------------------------------------------------------------ */

/**
 * Avalanche: maior taxa mensal equivalente primeiro.
 * Empate de taxa → menor saldo primeiro → ordem de cadastro.
 * Dívidas sem taxa informada NÃO são ordenadas (nunca assumimos zero).
 */
export function orderByAvalanche(debts: NormalizedDebt[]): PriorityResult {
  const ranked = debts.filter((d) => d.monthlyRate !== null);
  const unranked = debts.filter((d) => d.monthlyRate === null);
  const index = new Map(debts.map((d, i) => [d.id, i]));
  const sorted = [...ranked].sort((a, b) => {
    if (b.monthlyRate! !== a.monthlyRate!) return b.monthlyRate! - a.monthlyRate!;
    if (a.balanceCents !== b.balanceCents) return a.balanceCents - b.balanceCents;
    return index.get(a.id)! - index.get(b.id)!;
  });
  return {
    method: "avalanche",
    orderedIds: sorted.map((d) => d.id),
    unrankedIds: unranked.map((d) => d.id),
    status: unranked.length === 0 ? "complete" : "incomplete",
  };
}

/**
 * Bola de neve: menor saldo primeiro.
 * Empate de saldo → maior taxa primeiro (sem taxa vai por último no
 * desempate) → ordem de cadastro. Funciona mesmo sem nenhuma taxa.
 */
export function orderBySnowball(debts: NormalizedDebt[]): PriorityResult {
  const index = new Map(debts.map((d, i) => [d.id, i]));
  const sorted = [...debts].sort((a, b) => {
    if (a.balanceCents !== b.balanceCents) return a.balanceCents - b.balanceCents;
    const ra = a.monthlyRate ?? -1;
    const rb = b.monthlyRate ?? -1;
    if (rb !== ra) return rb - ra;
    return index.get(a.id)! - index.get(b.id)!;
  });
  return {
    method: "snowball",
    orderedIds: sorted.map((d) => d.id),
    unrankedIds: [],
    status: "complete",
  };
}

/* ------------------------------------------------------------------ *
 * 3. DebtWarningEngine
 * ------------------------------------------------------------------ */

function buildBudget(
  debts: NormalizedDebt[],
  availableCents: number | null,
): DebtPlanBudget {
  const requiredCents = debts.reduce((sum, d) => sum + d.monthlyPaymentCents, 0);
  if (availableCents === null) {
    return { availableCents: null, requiredCents, additionalCents: null, status: "unknown" };
  }
  const additionalCents = availableCents - requiredCents;
  const status =
    additionalCents > 0 ? "surplus" : additionalCents === 0 ? "exact" : "deficit";
  return { availableCents, requiredCents, additionalCents, status };
}

function collectWarnings(
  debts: NormalizedDebt[],
  budget: DebtPlanBudget,
): PlanWarningCode[] {
  const warnings: PlanWarningCode[] = [];
  if (debts.length < 2) warnings.push("single-debt");
  const withRate = debts.filter((d) => d.monthlyRate !== null).length;
  if (withRate === 0) warnings.push("no-rates");
  else if (withRate < debts.length) warnings.push("some-rates-missing");
  if (debts.some((d) => d.attentionReasons.includes("nao-amortiza"))) {
    warnings.push("non-amortizing-debt");
  }
  if (debts.some((d) => d.monthlyRate !== null && d.monthlyRate > EXTREME_MONTHLY_RATE)) {
    warnings.push("extreme-rate");
  }
  if (budget.status === "deficit") warnings.push("budget-deficit");
  if (budget.status === "exact") warnings.push("budget-exact");
  return warnings;
}

/* ------------------------------------------------------------------ *
 * 4. DebtSimulationEngine
 * ------------------------------------------------------------------ */

interface SimState {
  id: string;
  balance: number;
  basePayment: number;
  rate: number;
}

/**
 * Projeta a evolução dos saldos mês a mês, com efeito cascata: quando uma
 * dívida é quitada, o pagamento dela passa a reforçar a próxima da ordem.
 *
 * Hipóteses do modelo (declaradas ao usuário): sem novas compras ou novo
 * uso do limite, taxa constante, pagamentos mensais constantes, sem
 * tarifas/multas extraordinárias e sem renegociação no período.
 *
 * Retorna null quando alguma dívida não é modelável.
 */
export function simulatePlan(
  debts: NormalizedDebt[],
  orderedIds: string[],
  monthlyExtraCents: number,
  lumpSumCents: number,
  method: SimulationResult["method"],
): SimulationResult | null {
  if (debts.length === 0 || debts.some((d) => !d.modelable)) return null;

  const state: SimState[] = debts.map((d) => ({
    id: d.id,
    balance: d.balanceCents,
    basePayment: d.monthlyPaymentCents,
    rate: d.monthlyRate!,
  }));
  const byId = new Map(state.map((s) => [s.id, s]));
  // Ordem de destino do dinheiro extra: a do método, e o que ficar de fora
  // (sem taxa, no caso da avalanche) entra depois, na ordem de cadastro.
  const targetOrder = [
    ...orderedIds,
    ...state.map((s) => s.id).filter((id) => !orderedIds.includes(id)),
  ];

  const payoffMonthByDebt: Record<string, number> = {};
  const calendar: MonthRow[] = [];
  let totalInterestCents = 0;
  let totalPaidCents = 0;
  let freed = 0;
  let month = 0;
  let reachedHorizon = false;

  while (month < MAX_SIMULATION_MONTHS) {
    const active = state.filter((s) => s.balance > 0);
    if (active.length === 0) break;
    month += 1;

    // Encargos do mês
    for (const s of active) {
      const interest = Math.round(s.balance * s.rate);
      s.balance += interest;
      totalInterestCents += interest;
    }

    const allocations = new Map<string, number>();
    const pay = (id: string, cents: number) => {
      if (cents <= 0) return;
      allocations.set(id, (allocations.get(id) ?? 0) + cents);
      totalPaidCents += cents;
    };

    // Pagamentos base — a sobra da parcela de uma dívida quase quitada
    // não se perde: volta para o bolo do mês.
    let pool = monthlyExtraCents + freed + (month === 1 ? lumpSumCents : 0);
    for (const s of active) {
      const amount = Math.min(s.basePayment, s.balance);
      s.balance -= amount;
      pool += s.basePayment - amount;
      pay(s.id, amount);
    }

    // Dinheiro adicional segue a ordem de prioridade do método
    for (const id of targetOrder) {
      if (pool <= 0) break;
      const s = byId.get(id);
      if (!s || s.balance <= 0) continue;
      const amount = Math.min(pool, s.balance);
      s.balance -= amount;
      pool -= amount;
      pay(s.id, amount);
    }

    for (const s of state) {
      if (s.balance <= 0 && payoffMonthByDebt[s.id] === undefined) {
        payoffMonthByDebt[s.id] = month;
        freed += s.basePayment;
      }
    }

    const remainingTotalCents = state.reduce((sum, s) => sum + Math.max(0, s.balance), 0);
    calendar.push({
      month,
      allocations:
        month <= DETAILED_MONTHS
          ? [...allocations.entries()].map(([debtId, cents]) => ({ debtId, cents }))
          : [],
      remainingTotalCents,
    });
  }

  const settled = state.every((s) => s.balance <= 0);
  if (!settled) reachedHorizon = true;

  return {
    method,
    monthsToPayoff: settled ? month : null,
    totalInterestCents,
    totalPaidCents,
    payoffMonthByDebt,
    calendar,
    reachedHorizon,
  };
}

/* ------------------------------------------------------------------ *
 * Orquestrador
 * ------------------------------------------------------------------ */

function buildAssumptions(debts: NormalizedDebt[]): string[] {
  const assumptions = [
    "Taxa de juros constante durante todo o período.",
    "Pagamentos mensais informados mantidos até a quitação de cada dívida.",
    "Sem tarifas, multas ou encargos extraordinários no período.",
    "Sem renegociação, novo crédito ou mudança de contrato no período.",
  ];
  if (debts.some((d) => d.revolving)) {
    assumptions.push(
      "Nas dívidas de saldo rotativo (cartão e cheque especial), nenhuma compra nova e nenhum uso novo do limite.",
    );
  }
  if (debts.some((d) => !d.revolving)) {
    assumptions.push(
      "Nos contratos de parcela fixa, o valor adicional é tratado como amortização que reduz o prazo, mantendo a parcela — a instituição pode oferecer também a redução da parcela, e o pedido precisa ser feito a ela.",
    );
  }
  return assumptions;
}

/**
 * Monta o plano completo. Nunca lança: dados insuficientes reduzem o que é
 * mostrado (plano de prioridade em vez de projeção), nunca inventam número.
 */
export function buildDebtPlan(input: DebtPlanInput): DebtPlanResult {
  const debts = input.debts.map(normalizeDebt);
  const budget = buildBudget(debts, input.monthlyAvailableCents);
  const warnings = collectWarnings(debts, budget);

  const avalanche = orderByAvalanche(debts);
  const snowball = orderBySnowball(debts);

  const totals = {
    count: debts.length,
    balanceCents: debts.reduce((sum, d) => sum + d.balanceCents, 0),
    basePaymentsCents: budget.requiredCents,
  };

  /* Projeção só quando os dados sustentam. */
  const blockers: string[] = [];
  const notModelable = debts.filter((d) => !d.modelable);
  for (const d of notModelable) {
    if (d.monthlyRate === null) {
      blockers.push(`${d.label}: taxa de juros não informada`);
    } else if (d.monthlyPaymentCents <= 0) {
      blockers.push(`${d.label}: sem valor de pagamento mensal informado`);
    } else if (d.balanceCents <= 0) {
      blockers.push(`${d.label}: saldo não informado`);
    }
  }
  if (budget.status === "deficit") {
    blockers.push(
      "O valor disponível por mês não cobre os pagamentos informados — o plano começa por aí, não pela ordem de ataque.",
    );
  }
  if (budget.status === "unknown") {
    blockers.push("Valor disponível por mês não informado");
  }

  const canProject = blockers.length === 0;
  const monthlyExtra = Math.max(0, budget.additionalCents ?? 0);
  const lump = Math.max(0, input.lumpSumCents ?? 0);

  const projection: DebtPlanResult["projection"] = {
    status: canProject ? "full" : "priority-only",
    blockers,
    avalanche: canProject
      ? simulatePlan(debts, avalanche.orderedIds, monthlyExtra, lump, "avalanche")
      : null,
    snowball: canProject
      ? simulatePlan(debts, snowball.orderedIds, monthlyExtra, lump, "snowball")
      : null,
    baseline:
      canProject && (monthlyExtra > 0 || lump > 0)
        ? simulatePlan(debts, avalanche.orderedIds, 0, 0, "baseline")
        : null,
  };

  return {
    debts,
    totals,
    budget,
    attentionIds: debts.filter((d) => d.attentionReasons.length > 0).map((d) => d.id),
    avalanche,
    snowball,
    projection,
    warnings,
    assumptions: buildAssumptions(debts),
  };
}

/* ------------------------------------------------------------------ *
 * 5. DebtPlanFormatter
 * ------------------------------------------------------------------ */

const ATTENTION_LABEL: Record<AttentionReason, string> = {
  atraso: "dívida em atraso",
  garantia: "garantia vinculada",
  "bem-essencial": "ligada a bem ou serviço essencial",
  "acordo-vencendo": "acordo com prazo para vencer",
  "cobranca-judicial": "cobrança judicial informada",
  "risco-perda-bem": "risco informado de perda do bem",
  "servico-interrupcao": "serviço sujeito a interrupção",
  "nao-amortiza": "o pagamento informado não cobriria os encargos estimados",
};

export function attentionLabel(reason: AttentionReason): string {
  return ATTENTION_LABEL[reason];
}

/** "12" → "1 ano" | "14" → "1 ano e 2 meses" */
export function formatMonths(months: number): string {
  if (months < 12) return `${months} ${months === 1 ? "mês" : "meses"}`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const yearPart = `${years} ${years === 1 ? "ano" : "anos"}`;
  if (rest === 0) return yearPart;
  return `${yearPart} e ${rest} ${rest === 1 ? "mês" : "meses"}`;
}

/**
 * Texto do plano para a função "copiar". Usa apenas os apelidos que o
 * próprio usuário escreveu e os valores que ele informou.
 */
export function buildPlanText(
  result: DebtPlanResult,
  method: "avalanche" | "snowball",
): string {
  const order = method === "avalanche" ? result.avalanche : result.snowball;
  const byId = new Map(result.debts.map((d) => [d.id, d]));
  const brl = (cents: number) =>
    `R$ ${Math.floor(cents / 100).toLocaleString("pt-BR")},${String(Math.abs(cents % 100)).padStart(2, "0")}`;

  const lines: string[] = [];
  lines.push(
    method === "avalanche"
      ? "PLANO — ORDEM PELO MÉTODO AVALANCHE (maior taxa primeiro)"
      : "PLANO — ORDEM PELO MÉTODO BOLA DE NEVE (menor saldo primeiro)",
  );
  lines.push("");
  order.orderedIds.forEach((id, i) => {
    const d = byId.get(id);
    if (!d) return;
    const rate =
      d.monthlyRate === null
        ? "taxa não informada"
        : `${(d.monthlyRate * 100).toFixed(2).replace(".", ",")}% a.m.`;
    lines.push(`${i + 1}. ${d.label} — saldo ${brl(d.balanceCents)} — ${rate}`);
  });
  if (order.unrankedIds.length > 0) {
    lines.push("");
    lines.push("Sem taxa informada (fora da ordem por juros):");
    for (const id of order.unrankedIds) {
      const d = byId.get(id);
      if (d) lines.push(`- ${d.label} — saldo ${brl(d.balanceCents)}`);
    }
  }
  lines.push("");
  lines.push(`Saldo total informado: ${brl(result.totals.balanceCents)}`);
  lines.push(`Pagamentos mensais informados: ${brl(result.totals.basePaymentsCents)}`);
  if (result.budget.availableCents !== null) {
    lines.push(`Valor disponível por mês: ${brl(result.budget.availableCents)}`);
  }
  if (result.budget.additionalCents !== null && result.budget.additionalCents > 0) {
    lines.push(`Valor adicional por mês: ${brl(result.budget.additionalCents)}`);
  }
  if (result.attentionIds.length > 0) {
    lines.push("");
    lines.push("Revisar antes de seguir a ordem:");
    for (const id of result.attentionIds) {
      const d = byId.get(id);
      if (!d) continue;
      lines.push(`- ${d.label}: ${d.attentionReasons.map(attentionLabel).join("; ")}`);
    }
  }
  lines.push("");
  lines.push("Simulação educativa baseada nos valores informados. Estimativas, não previsões.");
  return lines.join("\n");
}
