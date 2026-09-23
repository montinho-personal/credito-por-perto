/**
 * SIMULADOR DE FINANCIAMENTO DE VEÍCULO — motor de cálculo
 * ============================================================================
 *
 * Função pura, sem React e sem rede: o mesmo código roda na página da
 * ferramenta, no artigo que a incorpora e nos testes. Nenhum valor digitado
 * sai do navegador.
 *
 * METODOLOGIA
 *
 * Prestações fixas (sistema francês, "Tabela Price"), juros compostos com
 * capitalização mensal — a mesma formulação da Calculadora do Cidadão do
 * Banco Central para financiamento com prestações fixas:
 *
 *     PMT = PV × i / [1 − (1 + i)^(−n)]          (i > 0)
 *     PMT = PV / n                               (i = 0)
 *
 * PV é o saldo financiado: valor do veículo − entrada + custos que o próprio
 * usuário informar como financiados. Nada é somado sem que ele informe —
 * este motor não conhece tarifa, seguro nem IOF de contrato nenhum.
 *
 * A simulação PRESSUPÕE prestações fixas. Nem todo contrato é assim, e a
 * página diz isso com todas as letras.
 *
 * POR QUE CENTAVOS INTEIROS NA TABELA
 *
 * Contrato real cobra em centavos. Se a tabela for montada em ponto
 * flutuante, a soma das parcelas exibidas difere do "total pago" exibido em
 * um ou dois centavos, e o saldo final fica em −0,00 ou 0,01. Parece
 * detalhe; para quem está conferindo a conta, é sinal de que a ferramenta
 * não é confiável. Aqui a parcela é arredondada ao centavo uma vez, cada
 * linha é calculada em centavos inteiros, e a última parcela absorve o
 * resíduo — o saldo termina em exatamente zero e os totais batem com a
 * soma da tabela, sempre.
 *
 * CONVERSÃO DE TAXA
 *
 * Nunca dividir ou multiplicar por 12. Taxa equivalente composta:
 *     anual = (1 + mensal)^12 − 1
 *     mensal = (1 + anual)^(1/12) − 1
 */

import {
  annualToMonthlyRate,
  monthlyToAnnualRate,
  pricePayment,
} from "@/lib/calculators/loan";

export type RateUnit = "am" | "aa";

export interface VehicleFinancingInput {
  /** Preço do veículo, em reais. */
  vehiclePrice: number;
  /** Entrada, em reais (a interface converte % → R$ antes de chamar). */
  downPayment: number;
  /** Taxa de juros, em porcentagem, na unidade indicada. */
  ratePercent: number;
  rateUnit: RateUnit;
  /** Prazo em meses. */
  months: number;
  /** Custos que o usuário sabe que entram no saldo financiado. */
  financedCosts?: number;
  /** Custos que o usuário sabe que paga à parte, na assinatura. */
  upfrontCosts?: number;
}

export type VehicleField =
  | "vehiclePrice"
  | "downPayment"
  | "ratePercent"
  | "months"
  | "financedCosts"
  | "upfrontCosts";

export interface FieldIssue {
  field: VehicleField;
  message: string;
}

export interface ScheduleRow {
  month: number;
  openingBalance: number;
  interest: number;
  amortization: number;
  payment: number;
  closingBalance: number;
}

export interface YearSummary {
  /** 1 = primeiros 12 meses. */
  year: number;
  firstMonth: number;
  lastMonth: number;
  paid: number;
  interest: number;
  amortization: number;
  closingBalance: number;
}

export interface VehicleFinancingResult {
  monthlyRatePercent: number;
  annualRatePercent: number;
  vehiclePrice: number;
  downPayment: number;
  /** Entrada como fração do preço (0–1). */
  downPaymentShare: number;
  financedCosts: number;
  upfrontCosts: number;
  /** Saldo financiado: preço − entrada + custos financiados. */
  financedAmount: number;
  /** Parcela fixa, em reais, arredondada ao centavo. */
  payment: number;
  /** Última parcela, que absorve o resíduo de arredondamento. */
  lastPayment: number;
  months: number;
  /** Soma de todas as parcelas. */
  totalInstallments: number;
  /** Juros: soma das parcelas − saldo financiado. */
  totalInterest: number;
  /** Tudo que sai do bolso: entrada + parcelas + custos pagos à parte. */
  totalOutlay: number;
  schedule: ScheduleRow[];
  yearly: YearSummary[];
}

export type VehicleFinancingOutcome =
  | { kind: "ok"; result: VehicleFinancingResult; warnings: FieldIssue[] }
  | { kind: "nothing-to-finance"; warnings: FieldIssue[] }
  | { kind: "invalid"; errors: FieldIssue[] };

/** Acima disso, a interface pergunta se a taxa foi digitada na unidade certa. */
export const SUSPICIOUS_MONTHLY_RATE = 8;
/** Acima disso é erro de digitação, não taxa — o cálculo é recusado. */
export const MAX_MONTHLY_RATE = 30;
export const MAX_VEHICLE_PRICE = 10_000_000;
export const MAX_MONTHS = 120;

function isNumber(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Taxa mensal equivalente, em %, a partir da unidade informada. */
export function toMonthlyRatePercent(ratePercent: number, unit: RateUnit): number {
  return unit === "am" ? ratePercent : annualToMonthlyRate(ratePercent);
}

export function validateVehicleFinancing(input: VehicleFinancingInput): {
  errors: FieldIssue[];
  warnings: FieldIssue[];
} {
  const errors: FieldIssue[] = [];
  const warnings: FieldIssue[] = [];

  if (!isNumber(input.vehiclePrice) || input.vehiclePrice <= 0) {
    errors.push({ field: "vehiclePrice", message: "Informe o valor do veículo." });
  } else if (input.vehiclePrice > MAX_VEHICLE_PRICE) {
    errors.push({
      field: "vehiclePrice",
      message: "Valor acima do limite do simulador (R$ 10 milhões).",
    });
  }

  if (!isNumber(input.downPayment) || input.downPayment < 0) {
    errors.push({
      field: "downPayment",
      message: "A entrada não pode ser negativa. Sem entrada, informe zero.",
    });
  } else if (isNumber(input.vehiclePrice) && input.downPayment > input.vehiclePrice) {
    errors.push({
      field: "downPayment",
      message: "A entrada está maior que o valor do veículo.",
    });
  }

  if (!isNumber(input.ratePercent) || input.ratePercent < 0) {
    errors.push({
      field: "ratePercent",
      message: "Informe a taxa de juros (zero ou mais).",
    });
  } else {
    const monthly = toMonthlyRatePercent(input.ratePercent, input.rateUnit);
    if (monthly > MAX_MONTHLY_RATE) {
      errors.push({
        field: "ratePercent",
        message:
          input.rateUnit === "am"
            ? "Taxa acima de 30% ao mês. Se a proposta informa a taxa ao ano, troque a unidade para “ao ano”."
            : "Taxa anual alta demais para um financiamento. Confira o número digitado.",
      });
    } else if (monthly > SUSPICIOUS_MONTHLY_RATE) {
      warnings.push({
        field: "ratePercent",
        message:
          input.rateUnit === "am"
            ? "Taxa alta para um financiamento de veículo. Confira se a proposta informa a taxa ao mês ou ao ano."
            : "Taxa alta para um financiamento de veículo. Confira o número digitado.",
      });
    }
  }

  if (
    !isNumber(input.months) ||
    !Number.isInteger(input.months) ||
    input.months < 1 ||
    input.months > MAX_MONTHS
  ) {
    errors.push({
      field: "months",
      message: `Informe um prazo entre 1 e ${MAX_MONTHS} meses.`,
    });
  }

  for (const field of ["financedCosts", "upfrontCosts"] as const) {
    const value = input[field];
    if (value !== undefined && (!isNumber(value) || value < 0)) {
      errors.push({ field, message: "Custos não podem ser negativos." });
    }
  }

  return { errors, warnings };
}

const toCents = (reais: number) => Math.round(reais * 100);
const toReais = (cents: number) => cents / 100;

export function simulateVehicleFinancing(
  input: VehicleFinancingInput,
): VehicleFinancingOutcome {
  const { errors, warnings } = validateVehicleFinancing(input);
  if (errors.length > 0) return { kind: "invalid", errors };

  const financedCosts = input.financedCosts ?? 0;
  const upfrontCosts = input.upfrontCosts ?? 0;
  const financedCents =
    toCents(input.vehiclePrice) - toCents(input.downPayment) + toCents(financedCosts);

  if (financedCents <= 0) return { kind: "nothing-to-finance", warnings };

  const monthlyRatePercent = toMonthlyRatePercent(input.ratePercent, input.rateUnit);
  const i = monthlyRatePercent / 100;
  const n = input.months;

  const paymentCents = Math.round(pricePayment(financedCents, i, n));

  const schedule: ScheduleRow[] = [];
  let balance = financedCents;
  let totalCents = 0;
  for (let month = 1; month <= n; month++) {
    const interest = Math.round(balance * i);
    const isLast = month === n;
    // A última parcela zera o saldo: absorve o resíduo de arredondamento.
    const amortization = isLast ? balance : paymentCents - interest;
    const payment = interest + amortization;
    const opening = balance;
    balance -= amortization;
    totalCents += payment;
    schedule.push({
      month,
      openingBalance: toReais(opening),
      interest: toReais(interest),
      amortization: toReais(amortization),
      payment: toReais(payment),
      closingBalance: toReais(balance),
    });
  }

  const yearly: YearSummary[] = [];
  for (let start = 0; start < schedule.length; start += 12) {
    const slice = schedule.slice(start, start + 12);
    const cents = (pick: (r: ScheduleRow) => number) =>
      slice.reduce((sum, r) => sum + toCents(pick(r)), 0);
    yearly.push({
      year: start / 12 + 1,
      firstMonth: slice[0]!.month,
      lastMonth: slice[slice.length - 1]!.month,
      paid: toReais(cents((r) => r.payment)),
      interest: toReais(cents((r) => r.interest)),
      amortization: toReais(cents((r) => r.amortization)),
      closingBalance: slice[slice.length - 1]!.closingBalance,
    });
  }

  const downCents = toCents(input.downPayment);
  const upfrontCents = toCents(upfrontCosts);
  const priceCents = toCents(input.vehiclePrice);

  return {
    kind: "ok",
    warnings,
    result: {
      monthlyRatePercent,
      annualRatePercent: monthlyToAnnualRate(monthlyRatePercent),
      vehiclePrice: toReais(priceCents),
      downPayment: toReais(downCents),
      downPaymentShare: priceCents > 0 ? downCents / priceCents : 0,
      financedCosts: toReais(toCents(financedCosts)),
      upfrontCosts: toReais(upfrontCents),
      financedAmount: toReais(financedCents),
      payment: toReais(paymentCents),
      lastPayment: schedule[schedule.length - 1]!.payment,
      months: n,
      totalInstallments: toReais(totalCents),
      totalInterest: toReais(totalCents - financedCents),
      totalOutlay: toReais(downCents + totalCents + upfrontCents),
      schedule,
      yearly,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* "E se?" — consequência matemática, nunca recomendação                       */
/* -------------------------------------------------------------------------- */

export type WhatIfId =
  | "entrada-5000"
  | "entrada-10000"
  | "prazo-menos-12"
  | "taxa-menos-025"
  | "taxa-menos-050";

export interface WhatIfScenario {
  id: WhatIfId;
  label: string;
  /** Resultado alternativo; null quando o cenário não se aplica. */
  result: VehicleFinancingResult | null;
  /** Por que o cenário não se aplica, em linguagem do leitor. */
  unavailableReason?: string;
}

/**
 * Cenários contrafactuais sobre a simulação atual. A taxa é reduzida em
 * pontos percentuais AO MÊS, sempre sobre a taxa mensal equivalente — reduzir
 * 0,25 p.p. de uma taxa anual seria outra coisa, e a comparação ficaria
 * incoerente entre quem digitou a.m. e quem digitou a.a.
 */
export function buildWhatIfScenarios(input: VehicleFinancingInput): WhatIfScenario[] {
  const monthly = toMonthlyRatePercent(input.ratePercent, input.rateUnit);
  const base: VehicleFinancingInput = { ...input, ratePercent: monthly, rateUnit: "am" };

  const run = (variant: VehicleFinancingInput) => {
    const outcome = simulateVehicleFinancing(variant);
    return outcome.kind === "ok" ? outcome.result : null;
  };

  const withDown = (extra: number, id: WhatIfId, label: string): WhatIfScenario => {
    const down = input.downPayment + extra;
    if (down >= input.vehiclePrice) {
      return {
        id,
        label,
        result: null,
        unavailableReason: "Com esse acréscimo, a entrada cobriria o veículo inteiro.",
      };
    }
    return { id, label, result: run({ ...base, downPayment: down }) };
  };

  const withRate = (cut: number, id: WhatIfId, label: string): WhatIfScenario => {
    if (monthly - cut < 0) {
      return { id, label, result: null, unavailableReason: "A taxa já está abaixo desse corte." };
    }
    return { id, label, result: run({ ...base, ratePercent: monthly - cut }) };
  };

  const shorter = input.months - 12;

  return [
    withDown(5_000, "entrada-5000", "R$ 5 mil a mais de entrada"),
    withDown(10_000, "entrada-10000", "R$ 10 mil a mais de entrada"),
    shorter >= 6
      ? {
          id: "prazo-menos-12",
          label: `${shorter} meses em vez de ${input.months}`,
          result: run({ ...base, months: shorter }),
        }
      : {
          id: "prazo-menos-12",
          label: "12 meses a menos",
          result: null,
          unavailableReason: "O prazo já é curto demais para reduzir 12 meses.",
        },
    withRate(0.25, "taxa-menos-025", "Taxa 0,25 ponto menor ao mês"),
    withRate(0.5, "taxa-menos-050", "Taxa 0,50 ponto menor ao mês"),
  ];
}

/**
 * Mesma operação em prazos diferentes. É o bloco que mostra, sem sermão, que
 * parcela menor não é financiamento mais barato: a parcela cai e os juros
 * sobem na mesma tabela.
 */
export const TERM_COMPARISON = [24, 36, 48, 60] as const;

export function compareTerms(
  input: VehicleFinancingInput,
  terms: readonly number[] = TERM_COMPARISON,
): Array<{ months: number; current: boolean; result: VehicleFinancingResult }> {
  const all = [...new Set([...terms, input.months])]
    .filter((m) => m >= 1 && m <= MAX_MONTHS)
    .sort((a, b) => a - b);
  const rows: Array<{ months: number; current: boolean; result: VehicleFinancingResult }> = [];
  for (const months of all) {
    const outcome = simulateVehicleFinancing({ ...input, months });
    if (outcome.kind === "ok") {
      rows.push({ months, current: months === input.months, result: outcome.result });
    }
  }
  return rows;
}
