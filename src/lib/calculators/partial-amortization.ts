/**
 * Modo 2 da Calculadora de Quitação Antecipada: AMORTIZAÇÃO PARCIAL.
 *
 * Dois submodos, com níveis de confiança deliberadamente diferentes:
 *
 * 1. COMPARAR SIMULAÇÕES OFICIAIS (`comparePayoffOptions`)
 *    O usuário traz os dois cenários que a instituição calculou — reduzir
 *    prazo e reduzir parcela — e a ferramenta só organiza a comparação.
 *    É o caminho mais confiável: os números vieram do contrato real.
 *
 * 2. SIMULAÇÃO EDUCACIONAL (`simulatePartialAmortization`)
 *    Só roda quando o usuário escolhe explicitamente Price ou SAC e informa
 *    saldo, taxa e prazo. Sistema "não sei"/"outro" NÃO é adivinhado.
 *
 * O que este motor nunca faz:
 * - reproduzir "a fórmula do Banco Central": os arts. 2º e 3º da Resolução
 *   CMN 3.516/2007, que traziam o cálculo do valor presente, foram
 *   revogados em 02/05/2022 pela Resolução CMN 5.004/2022. Não existe
 *   fórmula normativa única a copiar, e nós não fingimos que existe;
 * - dizer que reduzir prazo é sempre melhor que reduzir parcela;
 * - apresentar simulação própria como saldo oficial da instituição;
 * - assumir Price como padrão de qualquer contrato.
 *
 * Dinheiro em centavos inteiros; cronogramas iterados (sem fórmula fechada)
 * para que o arredondamento de cada parcela seja explícito e conferível.
 */

import { annualToMonthlyEffective } from "./debt-switch";

/* ------------------------------------------------------------------ *
 * Tipos
 * ------------------------------------------------------------------ */

/** Sistemas que sabemos modelar. "outro"/"nao-sei" bloqueiam a simulação. */
export type AmortizationSystem = "price" | "sac" | "outro" | "nao-sei";

export type RateUnit = "mensal" | "anual" | "sem-juros";

/** O que a amortização extraordinária faz com o contrato. */
export type AmortizationEffect = "reduzir-prazo" | "reduzir-parcela";

export interface ScheduleSummary {
  /** Número de pagamentos até o fim */
  months: number;
  totalPaidCents: number;
  totalInterestCents: number;
  firstPaymentCents: number;
  lastPaymentCents: number;
}

export interface PartialAmortizationInput {
  balanceCents: number;
  remainingMonths: number;
  rateValue: number | null;
  rateUnit: RateUnit;
  system: AmortizationSystem;
  extraPaymentCents: number;
}

export type PartialWarning =
  | "system-unknown"
  | "extra-exceeds-balance"
  | "extra-equals-balance"
  | "missing-rate"
  | "missing-balance"
  | "missing-term"
  | "payment-below-interest";

export interface PartialAmortizationResult {
  status: "simulated" | "blocked";
  warnings: PartialWarning[];
  /** Cenário sem amortização, para servir de base de comparação */
  baseline: ScheduleSummary | null;
  reduceTerm: ScheduleSummary | null;
  reducePayment: ScheduleSummary | null;
  /** Saldo depois do aporte */
  balanceAfterCents: number | null;
  assumptions: string[];
}

/* ------------------------------------------------------------------ *
 * LoanModelValidator
 * ------------------------------------------------------------------ */

export function monthlyRateOf(value: number | null, unit: RateUnit): number | null {
  if (unit === "sem-juros") return 0;
  if (value === null || !Number.isFinite(value) || value < 0) return null;
  if (unit === "mensal") return value / 100;
  // annualToMonthlyEffective trabalha em percentual (60 → 3,995)
  return annualToMonthlyEffective(value) / 100;
}

/** Um contrato só é modelável com sistema declarado, saldo, prazo e taxa. */
export function validateModel(input: PartialAmortizationInput): PartialWarning[] {
  const problems: PartialWarning[] = [];
  if (input.system === "outro" || input.system === "nao-sei") problems.push("system-unknown");
  if (input.balanceCents <= 0) problems.push("missing-balance");
  if (input.remainingMonths <= 0) problems.push("missing-term");
  if (monthlyRateOf(input.rateValue, input.rateUnit) === null) problems.push("missing-rate");
  if (input.extraPaymentCents > input.balanceCents) problems.push("extra-exceeds-balance");
  else if (input.extraPaymentCents === input.balanceCents && input.balanceCents > 0) {
    problems.push("extra-equals-balance");
  }
  return problems;
}

/* ------------------------------------------------------------------ *
 * Cronogramas (iterados, não fórmula fechada)
 * ------------------------------------------------------------------ */

const MAX_SCHEDULE_MONTHS = 600;

/** Parcela teórica do sistema Price: PMT = PV·i(1+i)^n / ((1+i)^n − 1). */
export function pricePaymentCents(
  balanceCents: number,
  monthlyRate: number,
  months: number,
): number {
  if (months <= 0) return 0;
  if (monthlyRate === 0) return Math.round(balanceCents / months);
  const f = Math.pow(1 + monthlyRate, months);
  return Math.round((balanceCents * monthlyRate * f) / (f - 1));
}

/**
 * Roda o cronograma mês a mês até quitar.
 * - Price: parcela fixa informada; a última é ajustada ao saldo restante.
 * - SAC: amortização constante informada; parcela = amortização + juros.
 */
export function runSchedule(
  system: "price" | "sac",
  balanceCents: number,
  monthlyRate: number,
  fixedCents: number,
): ScheduleSummary | null {
  if (balanceCents <= 0 || fixedCents <= 0) return null;
  // Price só converge se a parcela cobrir os juros do primeiro mês.
  if (system === "price" && fixedCents <= Math.round(balanceCents * monthlyRate)) return null;

  let balance = balanceCents;
  let months = 0;
  let totalPaid = 0;
  let totalInterest = 0;
  let first = 0;
  let last = 0;

  while (balance > 0 && months < MAX_SCHEDULE_MONTHS) {
    months += 1;
    const interest = Math.round(balance * monthlyRate);
    let payment: number;
    if (system === "price") {
      payment = Math.min(fixedCents, balance + interest);
    } else {
      const amortization = Math.min(fixedCents, balance);
      payment = amortization + interest;
    }
    const principal = payment - interest;
    balance -= principal;
    if (balance < 0) {
      payment += balance;
      balance = 0;
    }
    totalInterest += interest;
    totalPaid += payment;
    if (months === 1) first = payment;
    last = payment;
  }

  if (balance > 0) return null;
  return {
    months,
    totalPaidCents: totalPaid,
    totalInterestCents: totalInterest,
    firstPaymentCents: first,
    lastPaymentCents: last,
  };
}

/* ------------------------------------------------------------------ *
 * PartialAmortizationEngine
 * ------------------------------------------------------------------ */

function buildAssumptions(system: "price" | "sac"): string[] {
  return [
    system === "price"
      ? "Sistema Price: parcela constante, com a última ajustada ao saldo restante."
      : "Sistema SAC: amortização constante, com parcela decrescente.",
    "Taxa de juros constante durante todo o período.",
    "Amortização aplicada imediatamente sobre o saldo informado.",
    "Sem seguros, tarifas, tributos, indexadores ou carência no cálculo.",
    "Períodos mensais regulares, sem contagem de dias entre vencimentos.",
    "O contrato real pode divergir — o número oficial é o da instituição.",
  ];
}

/**
 * Simula o efeito de uma amortização extraordinária nos dois caminhos.
 * Retorna status "blocked" (sem números) quando o modelo não se sustenta.
 */
export function simulatePartialAmortization(
  input: PartialAmortizationInput,
): PartialAmortizationResult {
  const warnings = validateModel(input);
  const rate = monthlyRateOf(input.rateValue, input.rateUnit);
  const blocked =
    warnings.includes("system-unknown") ||
    warnings.includes("missing-balance") ||
    warnings.includes("missing-term") ||
    warnings.includes("missing-rate") ||
    warnings.includes("extra-exceeds-balance") ||
    warnings.includes("extra-equals-balance");

  if (blocked || rate === null || (input.system !== "price" && input.system !== "sac")) {
    return {
      status: "blocked",
      warnings,
      baseline: null,
      reduceTerm: null,
      reducePayment: null,
      balanceAfterCents: null,
      assumptions: [],
    };
  }

  const system = input.system;
  const n = input.remainingMonths;
  const balanceAfter = input.balanceCents - input.extraPaymentCents;

  // Valor "fixo" do contrato original: parcela (Price) ou amortização (SAC)
  const originalFixed =
    system === "price"
      ? pricePaymentCents(input.balanceCents, rate, n)
      : Math.round(input.balanceCents / n);

  const baseline = runSchedule(system, input.balanceCents, rate, originalFixed);
  if (!baseline) {
    return {
      status: "blocked",
      warnings: [...warnings, "payment-below-interest"],
      baseline: null,
      reduceTerm: null,
      reducePayment: null,
      balanceAfterCents: balanceAfter,
      assumptions: [],
    };
  }

  // REDUZIR PRAZO: mantém o valor fixo original sobre o saldo menor
  const reduceTerm = runSchedule(system, balanceAfter, rate, originalFixed);

  // REDUZIR PARCELA: mantém o prazo original, recalcula o valor fixo
  const newFixed =
    system === "price"
      ? pricePaymentCents(balanceAfter, rate, n)
      : Math.round(balanceAfter / n);
  const reducePayment = runSchedule(system, balanceAfter, rate, newFixed);

  return {
    status: "simulated",
    warnings,
    baseline,
    reduceTerm,
    reducePayment,
    balanceAfterCents: balanceAfter,
    assumptions: buildAssumptions(system),
  };
}

/* ------------------------------------------------------------------ *
 * PayoffComparisonEngine — comparar simulações OFICIAIS
 * ------------------------------------------------------------------ */

export interface OfficialOption {
  /** Prazo informado pela instituição, em pagamentos */
  months: number;
  /** Valor da parcela informado pela instituição */
  paymentCents: number;
}

export interface OfficialComparison {
  status: "compared" | "incomplete";
  reduceTerm: { months: number; paymentCents: number; totalCents: number } | null;
  reducePayment: { months: number; paymentCents: number; totalCents: number } | null;
  /** total do cenário "reduzir parcela" menos o de "reduzir prazo" */
  totalDifferenceCents: number | null;
  monthsDifference: number | null;
  monthlyReliefCents: number | null;
  sentences: string[];
}

function brl(cents: number): string {
  const abs = Math.abs(cents);
  return `R$ ${Math.floor(abs / 100).toLocaleString("pt-BR")},${String(abs % 100).padStart(2, "0")}`;
}

/**
 * Compara os dois cenários que a instituição calculou. Aritmética simples e
 * verificável: total = parcela × prazo, em cada opção. Não elege vencedor.
 */
export function comparePayoffOptions(
  term: OfficialOption | null,
  payment: OfficialOption | null,
): OfficialComparison {
  const valid = (o: OfficialOption | null) =>
    o !== null && o.months > 0 && o.paymentCents > 0 ? o : null;
  const a = valid(term);
  const b = valid(payment);

  const reduceTerm = a ? { ...a, totalCents: a.months * a.paymentCents } : null;
  const reducePayment = b ? { ...b, totalCents: b.months * b.paymentCents } : null;

  if (!reduceTerm || !reducePayment) {
    return {
      status: "incomplete",
      reduceTerm,
      reducePayment,
      totalDifferenceCents: null,
      monthsDifference: null,
      monthlyReliefCents: null,
      sentences: [
        "Informe as duas simulações da instituição — prazo e parcela de cada opção — para comparar os cenários lado a lado.",
      ],
    };
  }

  const totalDifference = reducePayment.totalCents - reduceTerm.totalCents;
  const monthsDifference = reducePayment.months - reduceTerm.months;
  const monthlyRelief = reduceTerm.paymentCents - reducePayment.paymentCents;

  const sentences: string[] = [];
  sentences.push(
    `Pelos valores informados, reduzir o prazo somaria ${brl(reduceTerm.totalCents)} em ${reduceTerm.months} pagamentos, e reduzir a parcela somaria ${brl(reducePayment.totalCents)} em ${reducePayment.months} pagamentos.`,
  );
  if (totalDifference > 0) {
    sentences.push(
      `A diferença entre os dois totais é de ${brl(totalDifference)}, a favor da opção de reduzir o prazo.`,
    );
  } else if (totalDifference < 0) {
    sentences.push(
      `A diferença entre os dois totais é de ${brl(totalDifference)}, a favor da opção de reduzir a parcela.`,
    );
  } else {
    sentences.push("Pelos valores informados, os dois cenários somam o mesmo total.");
  }
  if (monthlyRelief > 0) {
    sentences.push(
      `Em compensação, reduzir a parcela alivia ${brl(monthlyRelief)} por mês no orçamento e mantém a dívida por ${Math.abs(monthsDifference)} ${Math.abs(monthsDifference) === 1 ? "pagamento" : "pagamentos"} a mais.`,
    );
  }
  sentences.push(
    "Menos tempo pagando ou menos compromisso por mês são objetivos diferentes — a escolha depende do que aperta mais no seu caso.",
  );

  return {
    status: "compared",
    reduceTerm,
    reducePayment,
    totalDifferenceCents: totalDifference,
    monthsDifference,
    monthlyReliefCents: monthlyRelief,
    sentences,
  };
}

/* ------------------------------------------------------------------ *
 * Validade do saldo informado
 * ------------------------------------------------------------------ */

/**
 * O valor de quitação costuma valer só para uma data. Comparar a data de
 * validade com hoje evita que alguém pague por um número vencido.
 * Datas em "YYYY-MM-DD".
 */
export function isQuoteOutdated(validUntil: string, today: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(validUntil)) return false;
  return validUntil < today;
}
