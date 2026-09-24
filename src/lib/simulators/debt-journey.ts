/**
 * QUANDO FICO LIVRE DAS DÍVIDAS? — motor de trajetória
 * ============================================================================
 *
 * Um SIMULADOR responde "o que acontece ao longo do tempo": estado inicial,
 * regras, passagem dos meses, eventos (uma dívida termina, entra um
 * dinheiro extra), marcos e estado final. Este módulo é a fundação da
 * família /simuladores/: `simulateJourney` roda o portfólio mês a mês e
 * `compareJourneys` mede o que uma mudança faz com a rota.
 *
 * NEM TODA DÍVIDA É IGUAL. Cada dívida passa por um ADAPTADOR que decide a
 * dinâmica do mês:
 *
 *   - "juros-sobre-saldo": empréstimo, consignado, cheque especial, cartão
 *     já parcelado com taxa, "outro". Juros do mês = saldo × i; o que passa
 *     dos juros (e das tarifas) amortiza. É a mesma conta da Price: com
 *     parcela fixa, a tabela é a Price (loan.ts).
 *   - "sac": amortização constante = saldo ÷ parcelas restantes; a parcela
 *     cai a cada mês. Um valor extra reduz o prazo e mantém a amortização.
 *   - "cronograma": parcelas restantes conhecidas, taxa desconhecida (acordo,
 *     parcelamento). Sabemos o desembolso e a data final; NÃO sabemos o custo
 *     financeiro, e o motor diz isso em vez de inventar taxa. Dinheiro extra
 *     não é aplicado nela: sem taxa, não dá para saber o que a antecipação
 *     abate.
 *   - cartão no rotativo NÃO é simulado como empréstimo de longo prazo: a
 *     regra do CMN limita o rotativo ao vencimento da fatura seguinte
 *     (credit-card-rules.ts). A dívida fica fora da rota, com aviso e
 *     caminho para a Calculadora de Juros do Cartão.
 *
 * ORDEM DE EVENTOS DE CADA MÊS (documentada e testada):
 *   1. encargos do mês em cada dívida ativa (adaptador);
 *   2. pagamento obrigatório de cada dívida (nunca além do saldo + encargos;
 *      a sobra da parcela de uma dívida quase quitada volta ao bolo do mês);
 *   3. o bolo do mês (valor extra mensal, aporte único do mês, pagamentos de
 *      dívidas já quitadas quando a pessoa mantém o orçamento, sobras do
 *      passo 2) vai à dívida prioritária da estratégia, depois à seguinte;
 *   4. dívidas que zeraram têm o pagamento liberado: redirecionado (se
 *      "manter o orçamento") ou devolvido ao bolso (registrado como renda
 *      liberada);
 *   5. registro do mês.
 *
 * DESEMPATE DETERMINÍSTICO: maior taxa → menor saldo → ordem de cadastro;
 * menor saldo → maior taxa → ordem de cadastro (as mesmas regras do Plano
 * para sair das dívidas). Dívidas de cronograma nunca recebem extra.
 *
 * O que o motor nunca faz: prometer data, diagnosticar superendividamento,
 * inventar taxa, escolher estratégia sozinho, somar custo conhecido com custo
 * desconhecido como se fosse um só. Centavos inteiros; sem aleatoriedade.
 */

import { annualToMonthlyEffective } from "@/lib/calculators/debt-switch";
import { addMonths } from "@/lib/calculators/civil-date";
import { pricePayment } from "@/lib/calculators/loan";

/* -------------------------------------------------------------------------- */
/* Tipos                                                                       */
/* -------------------------------------------------------------------------- */

export type JourneyDebtType =
  | "cartao-rotativo"
  | "cartao-parcelado"
  | "emprestimo"
  | "financiamento"
  | "cheque-especial"
  | "parcelamento"
  | "acordo"
  | "consignado"
  | "outro";

export type RateUnit = "am" | "aa";
export type AmortizationSystem = "price" | "sac" | "nao-sei";
export type Strategy = "maior-taxa" | "menor-saldo" | "manual";

export interface JourneyDebt {
  id: string;
  /** Apelido escolhido pela pessoa; nunca pedimos o credor. */
  label: string;
  type: JourneyDebtType;
  /** Saldo devedor atual. Pode ser null quando só se conhece o cronograma. */
  balanceCents: number | null;
  /** Taxa informada; null = "não sei". */
  ratePercent: number | null;
  rateUnit: RateUnit;
  /** Pagamento mensal atual, tudo que sai do bolso (inclui tarifas). */
  paymentCents: number | null;
  /** Parcelas restantes, quando conhecidas. */
  remainingPayments: number | null;
  system: AmortizationSystem;
  /** Seguro/tarifa dentro da parcela: sai do bolso, não amortiza. */
  recurringFeesCents: number;
}

export type DebtModel = "juros-sobre-saldo" | "sac" | "cronograma" | "rotativo" | "invalida";

export type DebtIssueCode =
  | "saldo"
  | "pagamento"
  | "taxa-negativa"
  | "taxa-extrema"
  | "taxa-fora-do-limite"
  | "parcelas"
  | "tarifa"
  | "dados-insuficientes";

export interface DebtIssue {
  debtId: string;
  code: DebtIssueCode;
  message: string;
  /** true bloqueia a simulação; false é aviso. */
  blocking: boolean;
}

export type DebtWarningCode = "nao-amortiza" | "saldo-cresce" | "custo-desconhecido" | "extra-nao-aplicado" | "rotativo-excluido";

export interface LumpSum {
  cents: number;
  /** Mês da simulação em que entra (1 = primeiro mês). */
  month: number;
  /** "estrategia" segue a ordem escolhida; ou o id de uma dívida. */
  target: "estrategia" | string;
}

export interface JourneyInput {
  debts: JourneyDebt[];
  /** Quando uma dívida termina, o pagamento dela continua indo às outras? */
  keepBudget: boolean;
  strategy: Strategy;
  /** Ordem manual (ids), usada quando strategy = "manual". */
  manualOrder?: string[];
  monthlyExtraCents: number;
  lumpSum?: LumpSum | null;
  /** AAAA-MM-DD de hoje; o mês 1 é o mês seguinte. */
  startIso: string;
}

export interface DebtMonth {
  month: number;
  openingCents: number;
  interestCents: number;
  feesCents: number;
  paidCents: number;
  /** Do que foi pago, o que reduziu o saldo. */
  amortizedCents: number;
  closingCents: number;
}

export interface DebtOutcome {
  id: string;
  label: string;
  type: JourneyDebtType;
  model: DebtModel;
  initialCents: number;
  /** Pagamento obrigatório do 1º mês (SAC e cronograma calculam). */
  requiredPaymentCents: number;
  payoffMonth: number | null;
  paidCents: number;
  interestCents: number;
  feesCents: number;
  /** false quando a taxa não é conhecida: juros não calculados. */
  costKnown: boolean;
  history: DebtMonth[];
  warnings: DebtWarningCode[];
}

export type MilestoneKind = "primeira-quitada" | "metade" | "tres-quartos" | "ultima-quitada" | "saldo-zero";

export interface Milestone {
  kind: MilestoneKind;
  month: number;
  dateIso: string;
  /** Dívida envolvida, quando houver. */
  debtId?: string;
  remainingCents: number;
}

export interface Release {
  month: number;
  dateIso: string;
  debtId: string;
  /** Quanto por mês deixa de estar comprometido com essa dívida. */
  cents: number;
  /** true: redirecionado às outras dívidas nesta simulação. */
  redirected: boolean;
}

export interface YearRow {
  year: number;
  firstMonth: number;
  lastMonth: number;
  openingCents: number;
  paidCents: number;
  /** Só das dívidas com custo conhecido. */
  costCents: number;
  closingCents: number;
}

export interface JourneyResult {
  startIso: string;
  initialCents: number;
  /** Soma dos pagamentos obrigatórios do 1º mês. */
  monthlyPaymentCents: number;
  monthlyExtraCents: number;
  months: number | null;
  endDateIso: string | null;
  reachedHorizon: boolean;
  totalPaidCents: number;
  /** Juros + tarifas das dívidas com custo conhecido. */
  costKnownCents: number;
  costUnknownDebtIds: string[];
  /** Saldo total ao fim de cada mês (índice 0 = mês 1). */
  balanceSeries: number[];
  debts: DebtOutcome[];
  /** Ids na ordem em que zeram. */
  payoffOrder: string[];
  milestones: Milestone[];
  releases: Release[];
  years: YearRow[];
  /** Aporte único que sobrou depois de zerar tudo. */
  unusedLumpCents: number;
  warnings: DebtWarningCode[];
  excludedDebtIds: string[];
}

export type JourneyOutcome =
  | { kind: "ok"; result: JourneyResult; issues: DebtIssue[] }
  | { kind: "invalid"; issues: DebtIssue[] };

/** Horizonte técnico: além disso a rota não é apresentada. */
export const MAX_JOURNEY_MONTHS = 1_200;
/** Saldo acima disso é explosão numérica (taxa extrema): a simulação para. */
const BALANCE_CAP = 1e17;
/**
 * Resíduo de arredondamento absorvido na última parcela, como num contrato:
 * até 2% do pagamento obrigatório.
 */
const LAST_PAYMENT_TOLERANCE = 0.02;
/** Acima disso ao mês, pedimos para conferir a unidade. */
export const EXTREME_MONTHLY_RATE = 0.35;
/** Acima disso ao mês, é erro de digitação. */
export const MAX_MONTHLY_RATE = 10;

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/* -------------------------------------------------------------------------- */
/* Adaptadores                                                                 */
/* -------------------------------------------------------------------------- */

/** Taxa mensal (fração) ou null quando não informada. */
export function monthlyRateOf(debt: Pick<JourneyDebt, "ratePercent" | "rateUnit">): number | null {
  if (!isNum(debt.ratePercent) || debt.ratePercent < 0) return null;
  return debt.rateUnit === "am" ? debt.ratePercent / 100 : annualToMonthlyEffective(debt.ratePercent) / 100;
}

/** Que dinâmica esta dívida segue, com os dados que a pessoa tem. */
export function resolveModel(debt: JourneyDebt): DebtModel {
  if (debt.type === "cartao-rotativo") return "rotativo";
  const rate = monthlyRateOf(debt);
  const hasBalance = isNum(debt.balanceCents) && debt.balanceCents > 0;
  const hasPayment = isNum(debt.paymentCents) && debt.paymentCents > 0;
  const hasTerm = Number.isInteger(debt.remainingPayments) && (debt.remainingPayments as number) > 0;
  if (rate !== null && hasBalance) {
    if (debt.system === "sac") return hasTerm ? "sac" : "invalida";
    return hasPayment || hasTerm ? "juros-sobre-saldo" : "invalida";
  }
  if (rate === null && hasPayment && hasTerm) return "cronograma";
  return "invalida";
}

interface State {
  debt: JourneyDebt;
  model: DebtModel;
  rate: number;
  balance: number;
  /** Pagamento obrigatório fixo (juros-sobre-saldo e cronograma). */
  payment: number;
  /** Amortização constante (SAC). */
  sacAmortization: number;
  fees: number;
  remaining: number;
  /** Saldo no início do mês corrente, antes dos encargos (desempate da estratégia). */
  opening: number;
  outcome: DebtOutcome;
  /** Tomou extra em algum mês (SAC recalcula o prazo). */
  acceptsExtra: boolean;
}

function initialState(debt: JourneyDebt, model: DebtModel): State {
  const rate = monthlyRateOf(debt) ?? 0;
  const fees = Math.max(0, Math.round(debt.recurringFeesCents || 0));
  let balance = Math.round(debt.balanceCents ?? 0);
  let payment = Math.round(debt.paymentCents ?? 0);
  const n = debt.remainingPayments ?? 0;
  let sacAmortization = 0;
  if (model === "cronograma") {
    // Sem taxa: o "saldo" é o desembolso restante, e é isso que a tela diz.
    balance = payment * n;
  } else if (model === "sac") {
    sacAmortization = Math.round(balance / n);
    payment = sacAmortization + Math.round(balance * rate) + fees;
  } else if (model === "juros-sobre-saldo" && payment <= 0 && n > 0) {
    // Parcela não informada, prazo sim: a parcela da Price para esse saldo.
    payment = Math.round(pricePayment(balance, rate, n)) + fees;
  }
  return {
    debt,
    model,
    rate,
    balance,
    payment,
    sacAmortization,
    fees,
    remaining: n,
    opening: balance,
    acceptsExtra: model === "juros-sobre-saldo" || model === "sac",
    outcome: {
      id: debt.id,
      label: debt.label,
      type: debt.type,
      model,
      initialCents: balance,
      requiredPaymentCents: payment,
      payoffMonth: null,
      paidCents: 0,
      interestCents: 0,
      feesCents: 0,
      costKnown: model !== "cronograma",
      history: [],
      warnings: [],
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Validação                                                                   */
/* -------------------------------------------------------------------------- */

export function validateDebt(debt: JourneyDebt): DebtIssue[] {
  const issues: DebtIssue[] = [];
  const push = (code: DebtIssueCode, message: string, blocking = true) => issues.push({ debtId: debt.id, code, message, blocking });
  if (debt.type === "cartao-rotativo") return issues;
  if (debt.balanceCents !== null && (!isNum(debt.balanceCents) || debt.balanceCents < 0)) push("saldo", "Informe o saldo atual em reais.");
  if (debt.paymentCents !== null && (!isNum(debt.paymentCents) || debt.paymentCents < 0)) push("pagamento", "Informe o pagamento mensal em reais.");
  if (debt.remainingPayments !== null && (!Number.isInteger(debt.remainingPayments) || debt.remainingPayments < 1 || debt.remainingPayments > MAX_JOURNEY_MONTHS)) {
    push("parcelas", `Informe as parcelas restantes como número inteiro, de 1 a ${MAX_JOURNEY_MONTHS.toLocaleString("pt-BR")}.`);
  }
  if (!isNum(debt.recurringFeesCents) || debt.recurringFeesCents < 0) push("tarifa", "Seguro ou tarifa precisa ser zero ou mais.");
  if (debt.ratePercent !== null) {
    if (!isNum(debt.ratePercent) || debt.ratePercent < 0) push("taxa-negativa", "A taxa não pode ser negativa. Se não souber, marque “não sei a taxa”.");
    else {
      const monthly = monthlyRateOf(debt) ?? 0;
      if (monthly > MAX_MONTHLY_RATE) push("taxa-fora-do-limite", "Taxa fora do limite técnico. Confira se informou ao mês ou ao ano.");
      else if (monthly > EXTREME_MONTHLY_RATE) push("taxa-extrema", "Taxa muito alta. Confira se a taxa foi informada ao mês ou ao ano.", false);
    }
  }
  if (issues.some((i) => i.blocking)) return issues;
  const model = resolveModel(debt);
  if (model === "invalida") {
    const rate = monthlyRateOf(debt);
    if (rate === null) push("dados-insuficientes", "Sem a taxa, informe o valor da parcela e quantas faltam: assim dá para simular o cronograma (sem calcular juros).");
    else if (debt.system === "sac") push("dados-insuficientes", "Na SAC, informe o saldo e quantas parcelas faltam.");
    else push("dados-insuficientes", "Informe o saldo atual e o pagamento mensal (ou as parcelas restantes).");
  }
  if (model === "juros-sobre-saldo" && isNum(debt.paymentCents) && debt.paymentCents > 0 && debt.recurringFeesCents >= debt.paymentCents) {
    push("tarifa", "O seguro ou tarifa não pode ser igual ou maior que o pagamento.");
  }
  return issues;
}

function validateInput(input: JourneyInput): DebtIssue[] {
  const issues = input.debts.flatMap(validateDebt);
  const push = (code: DebtIssueCode, message: string) => issues.push({ debtId: "", code, message, blocking: true });
  if (!isNum(input.monthlyExtraCents) || input.monthlyExtraCents < 0) push("pagamento", "O valor extra mensal precisa ser zero ou mais.");
  if (input.lumpSum) {
    if (!isNum(input.lumpSum.cents) || input.lumpSum.cents < 0) push("pagamento", "O aporte único precisa ser zero ou mais.");
    if (!Number.isInteger(input.lumpSum.month) || input.lumpSum.month < 1) push("pagamento", "O mês do aporte precisa ser 1 ou mais.");
  }
  const simulated = input.debts.filter((d) => resolveModel(d) !== "rotativo");
  if (simulated.length === 0) push("dados-insuficientes", "Adicione pelo menos uma dívida que possa ser simulada ao longo do tempo.");
  return issues;
}

/* -------------------------------------------------------------------------- */
/* Estratégia                                                                  */
/* -------------------------------------------------------------------------- */

/** Ordem de destino do dinheiro extra. Só dívidas que aceitam extra. */
export function priorityOrder(states: State[], strategy: Strategy, manualOrder: string[] = []): string[] {
  const index = new Map(states.map((s, i) => [s.debt.id, i]));
  const eligible = states.filter((s) => s.acceptsExtra);
  if (strategy === "manual") {
    const listed = manualOrder.filter((id) => eligible.some((s) => s.debt.id === id));
    const rest = eligible.map((s) => s.debt.id).filter((id) => !listed.includes(id));
    return [...listed, ...rest];
  }
  const sorted = [...eligible].sort((a, b) => {
    if (strategy === "maior-taxa") {
      if (b.rate !== a.rate) return b.rate - a.rate;
      if (a.opening !== b.opening) return a.opening - b.opening;
    } else {
      if (a.opening !== b.opening) return a.opening - b.opening;
      if (b.rate !== a.rate) return b.rate - a.rate;
    }
    return index.get(a.debt.id)! - index.get(b.debt.id)!;
  });
  return sorted.map((s) => s.debt.id);
}

/* -------------------------------------------------------------------------- */
/* Simulação                                                                   */
/* -------------------------------------------------------------------------- */

/** Mês k da simulação → AAAA-MM-01 (k = 1 é o mês seguinte a hoje). */
export function monthDate(startIso: string, month: number): string {
  return addMonths(`${startIso.slice(0, 7)}-01`, month);
}

export function simulateJourney(input: JourneyInput): JourneyOutcome {
  const issues = validateInput(input);
  if (issues.some((i) => i.blocking)) return { kind: "invalid", issues };

  const excludedDebtIds = input.debts.filter((d) => resolveModel(d) === "rotativo").map((d) => d.id);
  const states = input.debts.filter((d) => resolveModel(d) !== "rotativo").map((d) => initialState(d, resolveModel(d)));
  const byId = new Map(states.map((s) => [s.debt.id, s]));
  const warnings = new Set<DebtWarningCode>();
  if (excludedDebtIds.length > 0) warnings.add("rotativo-excluido");

  const initialCents = states.reduce((sum, s) => sum + s.balance, 0);
  const monthlyPaymentCents = states.reduce((sum, s) => sum + s.payment, 0);
  const lump = input.lumpSum && input.lumpSum.cents > 0 ? input.lumpSum : null;

  const balanceSeries: number[] = [];
  const payoffOrder: string[] = [];
  const releases: Release[] = [];
  const milestones: Milestone[] = [];
  let totalPaid = 0;
  let unusedLump = 0;
  let redirectedPool = 0;
  let month = 0;
  let reachedHorizon = false;

  const pay = (s: State, cents: number, kind: "obrigatorio" | "extra", row: DebtMonth) => {
    if (cents <= 0) return 0;
    const amount = Math.min(cents, s.balance);
    s.balance -= amount;
    row.paidCents += amount;
    row.amortizedCents += amount;
    s.outcome.paidCents += amount;
    totalPaid += amount;
    if (kind === "extra" && s.model === "sac") s.remaining = Math.max(1, Math.ceil(s.balance / Math.max(1, s.sacAmortization)));
    return amount;
  };

  while (month < MAX_JOURNEY_MONTHS) {
    const active = states.filter((s) => s.balance > 0);
    if (active.length === 0) break;
    month += 1;
    const rows = new Map<string, DebtMonth>();
    let pool = input.monthlyExtraCents + (input.keepBudget ? redirectedPool : 0);
    let lumpPool = lump && lump.month === month ? lump.cents : 0;

    /* 1. Encargos. */
    for (const s of active) {
      s.opening = s.balance;
      const row: DebtMonth = { month, openingCents: s.balance, interestCents: 0, feesCents: 0, paidCents: 0, amortizedCents: 0, closingCents: 0 };
      rows.set(s.debt.id, row);
      if (s.model === "cronograma") continue;
      const interest = Math.round(s.balance * s.rate);
      s.balance += interest;
      row.interestCents = interest;
      s.outcome.interestCents += interest;
    }

    /* 2. Pagamento obrigatório (tarifa sai do bolso, não amortiza). */
    for (const s of active) {
      const row = rows.get(s.debt.id)!;
      const fees = s.model === "cronograma" ? 0 : s.fees;
      const required = s.model === "sac" ? s.sacAmortization + row.interestCents + fees : s.payment;
      let toBalance = Math.max(0, required - fees);
      // Última parcela absorve o resíduo de centavos, como num contrato.
      if (s.model !== "cronograma" && s.balance > toBalance && s.balance - toBalance <= Math.round(toBalance * LAST_PAYMENT_TOLERANCE)) toBalance = s.balance;
      const paid = pay(s, toBalance, "obrigatorio", row);
      if (paid > 0 && fees > 0) {
        row.feesCents = fees;
        row.paidCents += fees;
        s.outcome.feesCents += fees;
        totalPaid += fees;
      }
      // Sobra da parcela de uma dívida que zerou neste mês volta ao bolo.
      pool += toBalance - paid;
      if (s.model === "cronograma") s.remaining -= 1;
    }

    /* 3. Aporte único dirigido, depois o bolo pela estratégia. */
    if (lumpPool > 0 && lump && lump.target !== "estrategia") {
      const target = byId.get(lump.target);
      if (target && target.balance > 0 && target.acceptsExtra) lumpPool -= pay(target, lumpPool, "extra", rows.get(target.debt.id)!);
    }
    pool += lumpPool;
    lumpPool = 0;
    for (const id of priorityOrder(states, input.strategy, input.manualOrder)) {
      if (pool <= 0) break;
      const s = byId.get(id)!;
      if (s.balance <= 0) continue;
      pool -= pay(s, pool, "extra", rows.get(id)!);
    }
    if (pool > 0 && states.every((s) => s.balance <= 0 || !s.acceptsExtra)) {
      // Sobrou dinheiro e nenhuma dívida aceita extra: só o aporte fica "não usado".
      if (lump && lump.month === month) unusedLump += Math.min(pool, lump.cents);
    }

    /* 4. Quitações e liberação de pagamento. */
    for (const s of active) {
      const row = rows.get(s.debt.id)!;
      row.closingCents = s.balance;
      row.amortizedCents = Math.max(0, row.paidCents - row.feesCents - row.interestCents);
      s.outcome.history.push(row);
      if (s.balance <= 0 && s.outcome.payoffMonth === null) {
        s.outcome.payoffMonth = month;
        payoffOrder.push(s.debt.id);
        const freed = s.model === "sac" ? s.outcome.requiredPaymentCents : s.payment;
        releases.push({ month, dateIso: monthDate(input.startIso, month), debtId: s.debt.id, cents: freed, redirected: input.keepBudget });
        if (input.keepBudget) redirectedPool += freed;
      }
    }

    /* 5. Registro. */
    const remaining = states.reduce((sum, s) => sum + Math.max(0, s.balance), 0);
    balanceSeries.push(remaining);

    if (month === 1) {
      for (const s of active) {
        if (s.model === "cronograma") continue;
        if (s.balance >= s.outcome.initialCents && s.outcome.payoffMonth === null) {
          s.outcome.warnings.push("nao-amortiza");
          warnings.add("nao-amortiza");
        }
      }
    }
    if (month === 12 && remaining > initialCents) warnings.add("saldo-cresce");
    if (remaining > BALANCE_CAP) {
      warnings.add("saldo-cresce");
      break;
    }
  }

  const settled = states.every((s) => s.balance <= 0);
  if (!settled) reachedHorizon = true;

  /* Marcos, calculados da série real. */
  const firstAt = (pred: (remaining: number) => boolean) => balanceSeries.findIndex(pred) + 1;
  if (payoffOrder.length > 0) {
    const first = byId.get(payoffOrder[0]!)!;
    milestones.push({ kind: "primeira-quitada", month: first.outcome.payoffMonth!, dateIso: monthDate(input.startIso, first.outcome.payoffMonth!), debtId: first.debt.id, remainingCents: balanceSeries[first.outcome.payoffMonth! - 1]! });
  }
  const half = firstAt((r) => r <= initialCents / 2);
  if (half > 0) milestones.push({ kind: "metade", month: half, dateIso: monthDate(input.startIso, half), remainingCents: balanceSeries[half - 1]! });
  const quarter = firstAt((r) => r <= initialCents / 4);
  if (quarter > 0 && quarter !== half) milestones.push({ kind: "tres-quartos", month: quarter, dateIso: monthDate(input.startIso, quarter), remainingCents: balanceSeries[quarter - 1]! });
  if (settled) {
    const lastId = payoffOrder[payoffOrder.length - 1]!;
    if (payoffOrder.length > 1) milestones.push({ kind: "ultima-quitada", month, dateIso: monthDate(input.startIso, month), debtId: lastId, remainingCents: 0 });
    milestones.push({ kind: "saldo-zero", month, dateIso: monthDate(input.startIso, month), remainingCents: 0 });
  }
  milestones.sort((a, b) => a.month - b.month);

  /* Resumo anual. */
  const years: YearRow[] = [];
  for (let start = 0; start < balanceSeries.length; start += 12) {
    const end = Math.min(start + 12, balanceSeries.length);
    let paid = 0;
    let cost = 0;
    for (const s of states) {
      for (const row of s.outcome.history) {
        if (row.month > start && row.month <= end) {
          paid += row.paidCents;
          if (s.outcome.costKnown) cost += row.interestCents + row.feesCents;
        }
      }
    }
    years.push({ year: start / 12 + 1, firstMonth: start + 1, lastMonth: end, openingCents: start === 0 ? initialCents : balanceSeries[start - 1]!, paidCents: paid, costCents: cost, closingCents: balanceSeries[end - 1]! });
  }

  const debts = states.map((s) => s.outcome);
  for (const d of debts) {
    if (!d.costKnown) {
      d.warnings.push("custo-desconhecido", "extra-nao-aplicado");
      warnings.add("custo-desconhecido");
    }
  }

  return {
    kind: "ok",
    issues,
    result: {
      startIso: input.startIso,
      initialCents,
      monthlyPaymentCents,
      monthlyExtraCents: input.monthlyExtraCents,
      months: settled ? month : null,
      endDateIso: settled ? monthDate(input.startIso, month) : null,
      reachedHorizon,
      totalPaidCents: totalPaid,
      costKnownCents: debts.filter((d) => d.costKnown).reduce((sum, d) => sum + d.interestCents + d.feesCents, 0),
      costUnknownDebtIds: debts.filter((d) => !d.costKnown).map((d) => d.id),
      balanceSeries,
      debts,
      payoffOrder,
      milestones,
      releases,
      years,
      unusedLumpCents: unusedLump,
      warnings: [...warnings],
      excludedDebtIds,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Cenários                                                                    */
/* -------------------------------------------------------------------------- */

export interface JourneyComparison {
  base: JourneyResult;
  alternative: JourneyResult;
  /** Meses recuperados (positivo = termina antes). null se um dos dois não quita. */
  monthsSaved: number | null;
  costSavedCents: number;
  paidDiffCents: number;
}

export function compareJourneys(base: JourneyResult, alternative: JourneyResult): JourneyComparison {
  return {
    base,
    alternative,
    monthsSaved: base.months !== null && alternative.months !== null ? base.months - alternative.months : null,
    costSavedCents: base.costKnownCents - alternative.costKnownCents,
    paidDiffCents: base.totalPaidCents - alternative.totalPaidCents,
  };
}

/** Cenário = o mesmo ponto de partida com UMA mudança. Nunca altera o base. */
export function withMonthlyExtra(input: JourneyInput, extraCents: number): JourneyInput {
  return { ...input, debts: input.debts.map((d) => ({ ...d })), monthlyExtraCents: input.monthlyExtraCents + extraCents };
}

export function withLumpSum(input: JourneyInput, lumpSum: LumpSum): JourneyInput {
  return { ...input, debts: input.debts.map((d) => ({ ...d })), lumpSum };
}

/**
 * Efeito marginal: o que cada R$ 100 a mais por mês faz com a rota, a
 * partir do cenário informado. null quando o base não quita ou quando a
 * diferença não é mensurável.
 */
export function marginalEffect(input: JourneyInput, stepCents = 10_000): { monthsSaved: number; costSavedCents: number } | null {
  const base = simulateJourney(input);
  const alt = simulateJourney(withMonthlyExtra(input, stepCents));
  if (base.kind !== "ok" || alt.kind !== "ok" || base.result.months === null || alt.result.months === null) return null;
  return { monthsSaved: base.result.months - alt.result.months, costSavedCents: base.result.costKnownCents - alt.result.costKnownCents };
}

/* -------------------------------------------------------------------------- */
/* Texto                                                                       */
/* -------------------------------------------------------------------------- */

const brl = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

/** "AAAA-MM-01" → "setembro de 2029". */
export function monthLabel(iso: string): string {
  const [y, m] = iso.split("-").map(Number) as [number, number];
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
}

/** "AAAA-MM-01" → "09/2029". */
export function monthShort(iso: string): string {
  const [y, m] = iso.split("-");
  return `${m}/${y}`;
}

export function buildJourneySummary(result: JourneyResult, comparison?: JourneyComparison | null): string {
  const lines = [
    "Simulação Crédito por Perto — Quando fico livre das dívidas?",
    "",
    `Dívida total atual: ${brl(result.initialCents)}`,
    `Pagamento mensal: ${brl(result.monthlyPaymentCents)}${result.monthlyExtraCents > 0 ? ` + ${brl(result.monthlyExtraCents)} extra` : ""}`,
    `Quitação estimada: ${result.endDateIso ? monthShort(result.endDateIso) : "não chega a zero no horizonte simulado"}`,
    `Prazo: ${result.months !== null ? `${result.months} meses` : "—"}`,
    `Total desembolsado estimado: ${brl(result.totalPaidCents)}`,
    `Custo financeiro calculado: ${brl(result.costKnownCents)}${result.costUnknownDebtIds.length > 0 ? " (algumas dívidas sem taxa: juros não calculados)" : ""}`,
  ];
  if (comparison && comparison.alternative !== result) {
    const alt = comparison.alternative;
    lines.push(
      "",
      `Cenário com +${brl(alt.monthlyExtraCents - result.monthlyExtraCents)}/mês:`,
      `Quitação estimada: ${alt.endDateIso ? monthShort(alt.endDateIso) : "—"}`,
      `Tempo economizado: ${comparison.monthsSaved !== null ? `${comparison.monthsSaved} meses` : "—"}`,
      `Economia estimada: ${brl(comparison.costSavedCents)}`,
    );
  }
  lines.push("", "Simulação educativa baseada nas premissas informadas. Não é previsão nem plano personalizado.");
  return lines.join("\n");
}
