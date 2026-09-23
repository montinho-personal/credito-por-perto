/**
 * SIMULADOR DE PARCELAMENTO DA FATURA — motor de cálculo
 * ============================================================================
 *
 * A pergunta desta ferramenta é "quanto custa dividir a dívida em parcelas"
 * — não "quanto custa não pagar a fatura" (essa é a calculadora de juros do
 * cartão). Função pura, centavos inteiros, sem rede.
 *
 * NADA DE BIBLIOTECA NOVA
 *
 * - A matemática (parcela Price, taxa implícita, conversão de taxas) vem de
 *   `loan.ts`.
 * - A comparação de 2 ou 3 propostas é a do Comparador de Propostas
 *   (`compareProposals`): menor parcela, menor prazo, menor CET informado,
 *   menor total — os mesmos critérios, a mesma regra de não inventar CET.
 * - O teto de juros e encargos vem de `credit-card-rules.ts`.
 *
 * DEFINIÇÕES (e por que importam)
 *
 *   dívida             valor da fatura que será resolvido com o parcelamento
 *   entrada            pagamento inicial, quando a proposta pede
 *   valor parcelado    dívida − entrada (o que vira parcelas)
 *   total das parcelas parcelas × valor da parcela
 *   desembolso total   entrada + total das parcelas
 *   custo adicional    desembolso total − dívida
 *                    = total das parcelas − valor parcelado
 *
 * A entrada aparece UMA vez: reduz o valor parcelado e soma no desembolso.
 * O custo adicional NÃO é chamado de "juros": sem mais dados, ele pode
 * incluir juros, IOF e tarifas.
 */

import {
  annualToMonthlyRate,
  implicitMonthlyRate,
  monthlyToAnnualRate,
  pricePayment,
} from "@/lib/calculators/loan";
import { compareProposals, type ComparisonResult } from "@/lib/calculators/proposal-comparison";

export type ProposalField =
  | "debtCents"
  | "downCents"
  | "installments"
  | "installmentCents"
  | "monthlyRatePercent"
  | "annualRatePercent"
  | "cetAnnualPercent";

export interface FieldIssue {
  field: ProposalField;
  message: string;
}

/** Uma proposta como aparece na fatura. Só os três primeiros são obrigatórios. */
export interface ProposalData {
  /** Valor da fatura a parcelar (antes da entrada), em centavos. */
  debtCents: number;
  installments: number;
  installmentCents: number;
  downCents?: number;
  /** Taxas e CET como informados — nunca calculados aqui. */
  monthlyRatePercent?: number;
  annualRatePercent?: number;
  cetAnnualPercent?: number;
}

export interface ProposalAnalysis {
  debtCents: number;
  downCents: number;
  financedCents: number;
  installments: number;
  installmentCents: number;
  installmentsTotalCents: number;
  disbursedCents: number;
  extraCostCents: number;
  /** Custo adicional ÷ valor parcelado (0–1). */
  extraShare: number;
  /** Quanto cada R$ 100 da dívida vira no desembolso total. */
  per100Cents: number;
  /** Taxa implícita aproximada nas parcelas (% a.m.); null se não houver. */
  implicitMonthlyPercent: number | null;
  implicitAnnualPercent: number | null;
  monthlyRatePercent: number | null;
  annualRatePercent: number | null;
  cetAnnualPercent: number | null;
  /** Anual equivalente da mensal informada, para conferir coerência. */
  equivalentAnnualOfMonthly: number | null;
  /** As taxas mensal e anual informadas não parecem equivalentes. */
  ratesIncoherent: boolean;
}

export type ProposalOutcome =
  | { kind: "ok"; analysis: ProposalAnalysis }
  | { kind: "invalid"; errors: FieldIssue[] };

export const MAX_DEBT_CENTS = 10_000_000_00;
export const MAX_INSTALLMENTS = 120;
/** Diferença relativa acima da qual mensal e anual informadas são "não equivalentes". */
export const RATE_COHERENCE_TOLERANCE = 0.02;

const isNum = (v: number | undefined): v is number => typeof v === "number" && Number.isFinite(v);

export function validateProposal(p: ProposalData): FieldIssue[] {
  const errors: FieldIssue[] = [];
  if (!isNum(p.debtCents) || p.debtCents <= 0) {
    errors.push({ field: "debtCents", message: "Informe o valor que será parcelado." });
  } else if (p.debtCents > MAX_DEBT_CENTS) {
    errors.push({ field: "debtCents", message: "Valor acima do limite do simulador (R$ 10 milhões)." });
  }
  if (!Number.isInteger(p.installments) || p.installments < 1 || p.installments > MAX_INSTALLMENTS) {
    errors.push({ field: "installments", message: `Informe o número de parcelas (1 a ${MAX_INSTALLMENTS}).` });
  }
  if (!isNum(p.installmentCents) || p.installmentCents <= 0) {
    errors.push({ field: "installmentCents", message: "Informe o valor de cada parcela." });
  } else if (p.installmentCents > MAX_DEBT_CENTS) {
    errors.push({ field: "installmentCents", message: "Parcela acima do limite do simulador." });
  }
  if (p.downCents !== undefined) {
    if (!isNum(p.downCents) || p.downCents < 0) {
      errors.push({ field: "downCents", message: "A entrada precisa ser um valor em reais. Sem entrada, deixe vazio." });
    } else if (isNum(p.debtCents) && p.downCents >= p.debtCents) {
      errors.push({ field: "downCents", message: "A entrada cobre a dívida inteira: não sobra nada para parcelar." });
    }
  }
  for (const field of ["monthlyRatePercent", "annualRatePercent", "cetAnnualPercent"] as const) {
    const v = p[field];
    if (v !== undefined && (!isNum(v) || v < 0)) {
      errors.push({ field, message: "Informe um percentual igual ou maior que zero." });
    }
  }
  return errors;
}

export function analyzeProposal(p: ProposalData): ProposalOutcome {
  const errors = validateProposal(p);
  if (errors.length > 0) return { kind: "invalid", errors };

  const debt = Math.round(p.debtCents);
  const down = Math.round(p.downCents ?? 0);
  const financed = debt - down;
  const installment = Math.round(p.installmentCents);
  const installmentsTotal = installment * p.installments;
  const disbursed = down + installmentsTotal;
  const extra = disbursed - debt;
  const implicit = implicitMonthlyRate(financed, installment, p.installments);

  const monthly = p.monthlyRatePercent ?? null;
  const annual = p.annualRatePercent ?? null;
  const equivalentAnnual = monthly !== null ? monthlyToAnnualRate(monthly) : null;
  const incoherent =
    equivalentAnnual !== null &&
    annual !== null &&
    Math.abs(equivalentAnnual - annual) > Math.max(annual, equivalentAnnual) * RATE_COHERENCE_TOLERANCE &&
    Math.abs(equivalentAnnual - annual) > 0.05;

  return {
    kind: "ok",
    analysis: {
      debtCents: debt,
      downCents: down,
      financedCents: financed,
      installments: p.installments,
      installmentCents: installment,
      installmentsTotalCents: installmentsTotal,
      disbursedCents: disbursed,
      extraCostCents: extra,
      extraShare: financed > 0 ? extra / financed : 0,
      per100Cents: Math.round((disbursed / debt) * 100_00),
      implicitMonthlyPercent: implicit,
      implicitAnnualPercent: implicit === null ? null : monthlyToAnnualRate(implicit),
      monthlyRatePercent: monthly,
      annualRatePercent: annual,
      cetAnnualPercent: p.cetAnnualPercent ?? null,
      equivalentAnnualOfMonthly: equivalentAnnual,
      ratesIncoherent: incoherent,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Comparação de 2 ou 3 propostas — motor do Comparador de Propostas          */
/* -------------------------------------------------------------------------- */

export interface InvoiceComparison {
  analyses: ProposalAnalysis[];
  /** Resultado do motor do Comparador (critérios e diferenças par a par). */
  base: ComparisonResult;
  /** Frases de trade-off, uma por par, sem veredito. */
  tradeoffs: string[];
}

const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const months = (n: number) => (n === 1 ? "1 mês" : `${n} meses`);

/**
 * A frase que ensina sem recomendar: "a Proposta A tem parcela R$ 320 maior,
 * mas termina 6 meses antes e soma R$ 1.840 menos no total".
 */
export function describeTradeoff(
  aLabel: string,
  a: ProposalAnalysis,
  bLabel: string,
  b: ProposalAnalysis,
): string {
  const [low, high, lowLabel, highLabel] =
    a.installmentCents <= b.installmentCents ? [a, b, aLabel, bLabel] : [b, a, bLabel, aLabel];
  const pmtDiff = high.installmentCents - low.installmentCents;
  const termDiff = low.installments - high.installments;
  const totalDiff = low.disbursedCents - high.disbursedCents;
  if (pmtDiff === 0 && termDiff === 0 && totalDiff === 0) {
    return `${aLabel} e ${bLabel} têm a mesma parcela, o mesmo prazo e o mesmo total.`;
  }
  const head =
    pmtDiff === 0
      ? `${lowLabel} e ${highLabel} têm a mesma parcela`
      : `${lowLabel} tem parcela ${brl(pmtDiff)} menor que ${highLabel}`;
  const tail: string[] = [];
  if (termDiff > 0) tail.push(`dura ${months(termDiff)} a mais`);
  else if (termDiff < 0) tail.push(`dura ${months(-termDiff)} a menos`);
  if (totalDiff > 0) tail.push(`soma ${brl(totalDiff)} a mais no total`);
  else if (totalDiff < 0) tail.push(`soma ${brl(-totalDiff)} a menos no total`);
  else tail.push("soma o mesmo total");
  // "mas" só quando há algo a pagar pela parcela menor; senão, "e".
  const conj = termDiff > 0 || totalDiff > 0 ? "mas" : "e";
  return `${head}, ${conj} ${tail.join(" e ")}.`;
}

export function compareInvoiceProposals(
  proposals: Array<{ label: string; data: ProposalData }>,
): { kind: "ok"; comparison: InvoiceComparison } | { kind: "invalid"; errors: Array<{ label: string; errors: FieldIssue[] }> } {
  const outcomes = proposals.map((p) => ({ label: p.label, outcome: analyzeProposal(p.data) }));
  const bad = outcomes.flatMap((o) => (o.outcome.kind === "invalid" ? [{ label: o.label, errors: o.outcome.errors }] : []));
  if (bad.length > 0) return { kind: "invalid", errors: bad };
  const analyses = outcomes.map((o) => (o.outcome as { kind: "ok"; analysis: ProposalAnalysis }).analysis);

  // Mapeamento para o Comparador: "valor recebido" = a dívida resolvida; a
  // entrada é pagamento fora das parcelas. Assim, total pago = desembolso
  // total e custo = desembolso − dívida, as mesmas contas desta ferramenta.
  const base = compareProposals(
    analyses.map((a, i) => ({
      label: proposals[i]!.label,
      netAmountCents: a.debtCents,
      installments: a.installments,
      installmentCents: a.installmentCents,
      cetAnnualPercent: a.cetAnnualPercent ?? undefined,
      interestRate: a.monthlyRatePercent !== null ? { value: a.monthlyRatePercent, period: "monthly" as const } : undefined,
      externalCostsCents: a.downCents,
    })),
  );

  const tradeoffs = base.pairs.map((pair) =>
    describeTradeoff(
      proposals[pair.aIndex]!.label,
      analyses[pair.aIndex]!,
      proposals[pair.bIndex]!.label,
      analyses[pair.bIndex]!,
    ),
  );
  return { kind: "ok", comparison: { analyses, base, tradeoffs } };
}

/* -------------------------------------------------------------------------- */
/* Modo simulação: parcelas constantes a partir de uma taxa                    */
/* -------------------------------------------------------------------------- */

export interface SimulationInput {
  debtCents: number;
  downCents?: number;
  ratePercent: number;
  rateUnit: "am" | "aa";
  installments: number;
}

export type SimulationOutcome =
  | { kind: "ok"; analysis: ProposalAnalysis; monthlyRatePercent: number }
  | { kind: "invalid"; errors: FieldIssue[] };

/** Parcela constante (Price), arredondada ao centavo. Taxa zero: valor ÷ n. */
export function simulatedInstallmentCents(financedCents: number, monthlyRatePercent: number, n: number): number {
  return Math.round(pricePayment(financedCents, monthlyRatePercent / 100, n));
}

export function simulateInstallments(input: SimulationInput): SimulationOutcome {
  const errors: FieldIssue[] = [];
  if (!isNum(input.ratePercent) || input.ratePercent < 0) {
    errors.push({ field: "monthlyRatePercent", message: "Informe a taxa (zero ou mais)." });
  }
  const monthly = isNum(input.ratePercent)
    ? input.rateUnit === "am"
      ? input.ratePercent
      : annualToMonthlyRate(input.ratePercent)
    : Number.NaN;
  if (isNum(monthly) && monthly > 100) {
    errors.push({ field: "monthlyRatePercent", message: "Taxa acima de 100% ao mês. Confira se é ao mês ou ao ano." });
  }
  const debt = input.debtCents;
  const down = input.downCents ?? 0;
  const provisional: ProposalData = {
    debtCents: debt,
    downCents: input.downCents,
    installments: input.installments,
    installmentCents: 1, // só para validar os outros campos
  };
  errors.push(...validateProposal(provisional).filter((e) => e.field !== "installmentCents"));
  if (errors.length > 0) return { kind: "invalid", errors };

  const installment = simulatedInstallmentCents(debt - down, monthly, input.installments);
  const outcome = analyzeProposal({
    debtCents: debt,
    downCents: input.downCents,
    installments: input.installments,
    installmentCents: installment,
    monthlyRatePercent: monthly,
  });
  if (outcome.kind === "invalid") return outcome;
  return { kind: "ok", analysis: outcome.analysis, monthlyRatePercent: monthly };
}

export interface WhatIfRow {
  id: string;
  label: string;
  analysis: ProposalAnalysis;
}

/** Cenários da simulação: menos parcelas, taxa menor, entrada maior. */
export function simulationWhatIfs(input: SimulationInput, monthlyRatePercent: number): WhatIfRow[] {
  const base: SimulationInput = { ...input, ratePercent: monthlyRatePercent, rateUnit: "am" };
  const rows: WhatIfRow[] = [];
  const push = (id: string, label: string, variant: SimulationInput) => {
    const o = simulateInstallments(variant);
    if (o.kind === "ok") rows.push({ id, label, analysis: o.analysis });
  };
  for (const n of [...new Set([Math.round(input.installments * 0.75), Math.round(input.installments / 2)])]) {
    if (n >= 1 && n < input.installments) push(`prazo-${n}`, `${n} parcelas em vez de ${input.installments}`, { ...base, installments: n });
  }
  for (const cut of [1, 2]) {
    if (monthlyRatePercent - cut >= 0) {
      push(`taxa-${cut}`, `Taxa ${cut} ponto${cut > 1 ? "s" : ""} menor ao mês`, { ...base, ratePercent: monthlyRatePercent - cut });
    }
  }
  for (const extra of [500_00, 1_000_00]) {
    const down = (input.downCents ?? 0) + extra;
    if (down < input.debtCents) {
      push(`entrada-${extra}`, `${brl(extra)} a mais de entrada`, { ...base, downCents: down });
    }
  }
  return rows;
}

/* -------------------------------------------------------------------------- */
/* Resumo em texto — sem veredito, sem dado pessoal                           */
/* -------------------------------------------------------------------------- */

const pct = (v: number, digits = 2) =>
  `${v.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;

export function buildInstallmentSummary(items: Array<{ label: string; analysis: ProposalAnalysis }>): string {
  const lines = ["Simulação Crédito por Perto — parcelamento da fatura", ""];
  for (const { label, analysis: a } of items) {
    lines.push(label);
    lines.push(`Valor parcelado: ${brl(a.financedCents)}${a.downCents > 0 ? ` (entrada de ${brl(a.downCents)})` : ""}`);
    lines.push(`Parcelas: ${a.installments}x ${brl(a.installmentCents)}`);
    lines.push(`Total das parcelas: ${brl(a.installmentsTotalCents)}`);
    lines.push(`Custo adicional: ${brl(a.extraCostCents)}`);
    lines.push(`CET informado: ${a.cetAnnualPercent !== null ? `${pct(a.cetAnnualPercent)} ao ano` : "não informado"}`);
    lines.push("");
  }
  lines.push("Simulação educativa. Confira as condições na sua fatura.");
  lines.push("https://www.creditoporperto.com/calculadoras/parcelamento-fatura/");
  return lines.join("\n");
}
