/**
 * CALCULADORA SAC x PRICE — motor de cálculo
 * ============================================================================
 *
 * Função pura, sem React e sem rede: roda igual na página da ferramenta, no
 * artigo que a incorpora e nos testes. Nenhum valor digitado sai do
 * navegador. Todos os valores monetários são CENTAVOS INTEIROS.
 *
 * METODOLOGIA
 *
 * Price (sistema francês, prestações fixas), juros compostos mensais — a
 * mesma formulação da Calculadora do Cidadão do Banco Central:
 *
 *     PMT = PV × i / [1 − (1 + i)^(−n)]          (i > 0)
 *     PMT = PV / n                               (i = 0)
 *
 *     juros do mês       = saldo anterior × i
 *     amortização do mês = PMT − juros
 *
 * SAC (sistema de amortização constante):
 *
 *     amortização = PV / n                       (igual todo mês)
 *     juros do mês = saldo anterior × i
 *     parcela      = amortização + juros         (cai todo mês)
 *
 * REGRA DE CONTRATO: a parcela (Price) e a amortização (SAC) são
 * arredondadas ao centavo uma vez; os juros de cada mês, ao centavo; e a
 * ÚLTIMA parcela, nos dois sistemas, absorve o resíduo — o saldo termina
 * em exatamente zero e os totais batem com a soma da tabela, sempre.
 *
 * O resíduo do Price não é sempre de centavos: o centavo arredondado da
 * parcela rende juros até o fim. Em prazo longo com taxa alta, a última
 * parcela pode ficar alguns reais diferente das outras — é o que um contrato
 * com parcela em centavos também faria, e a interface mostra o ajuste. Quando
 * a combinação é tão extrema que o ajuste deixaria de ser ajuste (o saldo
 * zeraria antes do prazo ou a última parcela sairia do lugar), o cálculo é
 * recusado com explicação, em vez de mostrar uma tabela torta.
 *
 * CONVERSÃO DE TAXA
 *
 * Nunca dividir ou multiplicar por 12. Taxa efetiva equivalente composta:
 *     anual  = (1 + mensal)^12 − 1
 *     mensal = (1 + anual)^(1/12) − 1
 */

import {
  annualToMonthlyRate,
  monthlyToAnnualRate,
  pricePayment,
} from "@/lib/calculators/loan";

export type RateUnit = "am" | "aa";
export type AmortizationSystem = "price" | "sac";

export interface SacPriceInput {
  /** Valor financiado, em centavos. */
  principalCents: number;
  /** Taxa de juros efetiva, em %, na unidade indicada. */
  ratePercent: number;
  rateUnit: RateUnit;
  /** Prazo em meses. */
  months: number;
  /** Custo mensal fixo informado pelo usuário (seguro, tarifa), em centavos. */
  monthlyCostsCents?: number;
  /** Custo pago uma vez, à parte, informado pelo usuário, em centavos. */
  upfrontCostsCents?: number;
}

export type SacPriceField =
  | "principalCents"
  | "ratePercent"
  | "months"
  | "monthlyCostsCents"
  | "upfrontCostsCents";

export interface FieldIssue {
  field: SacPriceField;
  message: string;
}

export interface ScheduleRow {
  month: number;
  openingCents: number;
  interestCents: number;
  amortizationCents: number;
  paymentCents: number;
  closingCents: number;
}

export interface YearSummary {
  /** 1 = primeiros 12 meses. */
  year: number;
  firstMonth: number;
  lastMonth: number;
  paidCents: number;
  interestCents: number;
  amortizationCents: number;
  closingCents: number;
}

export interface SystemResult {
  system: AmortizationSystem;
  schedule: ScheduleRow[];
  yearly: YearSummary[];
  firstPaymentCents: number;
  /** Parcela nº ceil(n/2). */
  middlePaymentCents: number;
  lastPaymentCents: number;
  highestPaymentCents: number;
  /** Soma de todas as parcelas. */
  totalPaidCents: number;
  /** Soma dos juros da tabela (= total pago − principal). */
  totalInterestCents: number;
  /**
   * Price: parcela fixa. SAC: amortização constante. Referência para mostrar
   * o ajuste da última parcela.
   */
  fixedCents: number;
}

export interface Milestone {
  /** Mês ao fim do qual o marco é medido. */
  month: number;
  label: string;
  price: MilestoneValues;
  sac: MilestoneValues;
}

export interface MilestoneValues {
  balanceCents: number;
  paidCents: number;
  interestPaidCents: number;
  /** Fração do principal já amortizada (0–1). */
  amortizedShare: number;
}

export interface SacPriceResult {
  principalCents: number;
  months: number;
  monthlyRatePercent: number;
  annualRatePercent: number;
  price: SystemResult;
  sac: SystemResult;
  /** Parcela em que a SAC fica abaixo da Price pela primeira vez; null se nunca. */
  crossoverMonth: number | null;
  /** Mês usado como "meio" do contrato: ceil(n/2). */
  middleMonth: number;
  /** Marcos da tabela lado a lado: 25%, 50% e 75% do prazo. */
  quarterMilestones: Milestone[];
  /** Marcos narrativos adaptados ao prazo: 1 ano, 5 anos, 10 anos, metade. */
  milestones: Milestone[];
  /** Custo mensal e custo à parte, como informados (0 quando vazios). */
  monthlyCostsCents: number;
  upfrontCostsCents: number;
  /** Parcelas + custo mensal × prazo + custo à parte, por sistema. */
  estimatedCostCents: { price: number; sac: number };
}

export type SacPriceOutcome =
  | { kind: "ok"; result: SacPriceResult; warnings: FieldIssue[] }
  | { kind: "invalid"; errors: FieldIssue[] };

/** Acima disso, a interface pergunta se a taxa foi digitada na unidade certa. */
export const SUSPICIOUS_MONTHLY_RATE = 4;
/** Acima disso é erro de digitação, não taxa de financiamento. */
export const MAX_MONTHLY_RATE = 10;
export const MIN_PRINCIPAL_CENTS = 1_000_00;
export const MAX_PRINCIPAL_CENTS = 50_000_000_00;
export const MAX_MONTHS = 420;

function isNumber(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Taxa mensal equivalente, em %, a partir da unidade informada. */
export function toMonthlyRatePercent(ratePercent: number, unit: RateUnit): number {
  return unit === "am" ? ratePercent : annualToMonthlyRate(ratePercent);
}

export function validateSacPrice(input: SacPriceInput): {
  errors: FieldIssue[];
  warnings: FieldIssue[];
} {
  const errors: FieldIssue[] = [];
  const warnings: FieldIssue[] = [];

  if (!isNumber(input.principalCents) || input.principalCents <= 0) {
    errors.push({ field: "principalCents", message: "Informe o valor financiado." });
  } else if (input.principalCents < MIN_PRINCIPAL_CENTS) {
    errors.push({
      field: "principalCents",
      message: "Informe um valor financiado de pelo menos R$ 1.000.",
    });
  } else if (input.principalCents > MAX_PRINCIPAL_CENTS) {
    errors.push({
      field: "principalCents",
      message: "Valor acima do limite da calculadora (R$ 50 milhões).",
    });
  }

  if (!isNumber(input.ratePercent) || input.ratePercent < 0) {
    errors.push({ field: "ratePercent", message: "Informe a taxa de juros (zero ou mais)." });
  } else {
    const monthly = toMonthlyRatePercent(input.ratePercent, input.rateUnit);
    if (monthly > MAX_MONTHLY_RATE) {
      errors.push({
        field: "ratePercent",
        message:
          input.rateUnit === "am"
            ? "Taxa acima de 10% ao mês. Se o contrato informa a taxa ao ano, troque a unidade para “ao ano”."
            : "Taxa anual alta demais para um financiamento. Confira o número digitado.",
      });
    } else if (monthly > SUSPICIOUS_MONTHLY_RATE) {
      warnings.push({
        field: "ratePercent",
        message:
          input.rateUnit === "am"
            ? "Taxa alta para um financiamento. Confira se o contrato informa a taxa ao mês ou ao ano."
            : "Taxa alta para um financiamento. Confira o número digitado.",
      });
    }
  }

  if (
    !isNumber(input.months) ||
    !Number.isInteger(input.months) ||
    input.months < 1 ||
    input.months > MAX_MONTHS
  ) {
    errors.push({ field: "months", message: `Informe um prazo entre 1 e ${MAX_MONTHS} meses.` });
  }

  for (const field of ["monthlyCostsCents", "upfrontCostsCents"] as const) {
    const value = input[field];
    if (value !== undefined && (!isNumber(value) || value < 0)) {
      errors.push({ field, message: "Custos não podem ser negativos." });
    }
  }

  return { errors, warnings };
}

/* -------------------------------------------------------------------------- */
/* Cronogramas                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Monta a tabela mês a mês. Nos meses 1..n−1 vale a regra do sistema; no mês
 * n a amortização é o saldo que restou. Devolve null quando o arredondamento
 * tornaria a tabela incoerente (saldo zerando antes do prazo, amortização
 * negativa, última parcela sem sentido).
 */
function buildSchedule(
  system: AmortizationSystem,
  principalCents: number,
  i: number,
  n: number,
): SystemResult | null {
  const fixedCents =
    system === "price"
      ? Math.round(pricePayment(principalCents, i, n))
      : Math.round(principalCents / n);
  if (fixedCents <= 0) return null;

  const schedule: ScheduleRow[] = [];
  let balance = principalCents;
  let totalPaid = 0;
  let totalInterest = 0;

  for (let month = 1; month <= n; month++) {
    const interest = Math.round(balance * i);
    const isLast = month === n;
    const amortization = isLast
      ? balance
      : system === "price"
        ? fixedCents - interest
        : fixedCents;
    // Antes do último mês, a amortização precisa ser positiva e menor que o
    // saldo; senão o arredondamento já tomou conta da tabela.
    if (!isLast && (amortization <= 0 || amortization >= balance)) return null;
    const payment = interest + amortization;
    schedule.push({
      month,
      openingCents: balance,
      interestCents: interest,
      amortizationCents: amortization,
      paymentCents: payment,
      closingCents: balance - amortization,
    });
    balance -= amortization;
    totalPaid += payment;
    totalInterest += interest;
  }

  const last = schedule[n - 1]!;
  // Ajuste da última parcela: aceito enquanto for resíduo, não outra parcela.
  if (last.amortizationCents <= 0) return null;
  if (system === "price" && n > 1) {
    const drift = Math.abs(last.paymentCents - fixedCents);
    if (drift > fixedCents * 0.5) return null;
  }

  const yearly: YearSummary[] = [];
  for (let start = 0; start < n; start += 12) {
    const slice = schedule.slice(start, start + 12);
    const sum = (pick: (r: ScheduleRow) => number) => slice.reduce((s, r) => s + pick(r), 0);
    yearly.push({
      year: start / 12 + 1,
      firstMonth: slice[0]!.month,
      lastMonth: slice[slice.length - 1]!.month,
      paidCents: sum((r) => r.paymentCents),
      interestCents: sum((r) => r.interestCents),
      amortizationCents: sum((r) => r.amortizationCents),
      closingCents: slice[slice.length - 1]!.closingCents,
    });
  }

  return {
    system,
    schedule,
    yearly,
    firstPaymentCents: schedule[0]!.paymentCents,
    middlePaymentCents: schedule[Math.ceil(n / 2) - 1]!.paymentCents,
    lastPaymentCents: last.paymentCents,
    highestPaymentCents: schedule.reduce((m, r) => Math.max(m, r.paymentCents), 0),
    totalPaidCents: totalPaid,
    totalInterestCents: totalInterest,
    fixedCents,
  };
}

function milestoneValues(result: SystemResult, principalCents: number, month: number): MilestoneValues {
  const rows = result.schedule.slice(0, month);
  const balance = rows[rows.length - 1]!.closingCents;
  return {
    balanceCents: balance,
    paidCents: rows.reduce((s, r) => s + r.paymentCents, 0),
    interestPaidCents: rows.reduce((s, r) => s + r.interestCents, 0),
    amortizedShare: (principalCents - balance) / principalCents,
  };
}

/** Saldo, pago e % amortizado nos dois sistemas ao fim de um mês qualquer. */
export function milestoneAt(
  result: Pick<SacPriceResult, "price" | "sac" | "principalCents">,
  month: number,
  label: string,
): Milestone {
  return {
    month,
    label,
    price: milestoneValues(result.price, result.principalCents, month),
    sac: milestoneValues(result.sac, result.principalCents, month),
  };
}

/** Rótulo de um mês em linguagem do leitor: "12 meses (1 ano)". */
export function describeMonths(months: number): string {
  if (months < 12 || months % 12 !== 0) {
    return months === 1 ? "1 mês" : `${months} meses`;
  }
  const years = months / 12;
  return `${months} meses (${years} ${years === 1 ? "ano" : "anos"})`;
}

/**
 * Marcos narrativos, só os que cabem no prazo: 1 ano, 5 anos, 10 anos e a
 * metade do contrato. Um marco igual ao fim do contrato não diz nada — o
 * saldo ali é zero nos dois — e fica de fora.
 */
export function milestoneMonths(n: number): Array<{ month: number; label: string }> {
  const out: Array<{ month: number; label: string }> = [];
  const add = (month: number, label: string) => {
    if (month >= 1 && month < n && !out.some((m) => m.month === month)) out.push({ month, label });
  };
  add(12, "Depois de 1 ano");
  add(60, "Depois de 5 anos");
  add(120, "Depois de 10 anos");
  add(Math.ceil(n / 2), "Na metade do prazo");
  return out.sort((a, b) => a.month - b.month);
}

export function simulateSacPrice(input: SacPriceInput): SacPriceOutcome {
  const { errors, warnings } = validateSacPrice(input);
  if (errors.length > 0) return { kind: "invalid", errors };

  const principal = Math.round(input.principalCents);
  const n = input.months;
  const monthlyRatePercent = toMonthlyRatePercent(input.ratePercent, input.rateUnit);
  const i = monthlyRatePercent / 100;

  const price = buildSchedule("price", principal, i, n);
  const sac = buildSchedule("sac", principal, i, n);
  if (!price || !sac) {
    return {
      kind: "invalid",
      errors: [
        {
          field: "months",
          message:
            "Com esse valor, essa taxa e esse prazo, os centavos arredondados da parcela, somados com juros mês a mês, deixariam a última parcela muito diferente das outras. Confira a taxa ou reduza o prazo.",
        },
      ],
    };
  }

  let crossoverMonth: number | null = null;
  for (let k = 0; k < n; k++) {
    if (sac.schedule[k]!.paymentCents < price.schedule[k]!.paymentCents) {
      crossoverMonth = k + 1;
      break;
    }
  }

  const at = (month: number, label: string) =>
    milestoneAt({ price, sac, principalCents: principal }, month, label);

  const quarterMilestones =
    n >= 4
      ? ([0.25, 0.5, 0.75] as const).map((share) => {
          const month = Math.max(1, Math.round(n * share));
          return at(month, `Após ${Math.round(share * 100)}% do prazo`);
        })
      : [];

  const monthlyCosts = Math.round(input.monthlyCostsCents ?? 0);
  const upfrontCosts = Math.round(input.upfrontCostsCents ?? 0);
  const extra = monthlyCosts * n + upfrontCosts;

  return {
    kind: "ok",
    warnings,
    result: {
      principalCents: principal,
      months: n,
      monthlyRatePercent,
      annualRatePercent: monthlyToAnnualRate(monthlyRatePercent),
      price,
      sac,
      crossoverMonth,
      middleMonth: Math.ceil(n / 2),
      quarterMilestones,
      milestones: milestoneMonths(n).map((m) => at(m.month, m.label)),
      monthlyCostsCents: monthlyCosts,
      upfrontCostsCents: upfrontCosts,
      estimatedCostCents: {
        price: price.totalPaidCents + extra,
        sac: sac.totalPaidCents + extra,
      },
    },
  };
}

/* -------------------------------------------------------------------------- */
/* "E se?" — consequência matemática, nunca recomendação                       */
/* -------------------------------------------------------------------------- */

export type WhatIfId = "prazo-menor" | "taxa-menor" | "valor-menor";

export interface WhatIfScenario {
  id: WhatIfId;
  label: string;
  result: SacPriceResult | null;
  unavailableReason?: string;
}

/**
 * Três variações da simulação atual. A taxa cai 0,1 ponto AO MÊS sobre a
 * taxa mensal equivalente — o mesmo corte para quem digitou a.m. ou a.a.
 */
export function buildWhatIfScenarios(input: SacPriceInput): WhatIfScenario[] {
  const monthly = toMonthlyRatePercent(input.ratePercent, input.rateUnit);
  const base: SacPriceInput = { ...input, ratePercent: monthly, rateUnit: "am" };
  const run = (variant: SacPriceInput) => {
    const outcome = simulateSacPrice(variant);
    return outcome.kind === "ok" ? outcome.result : null;
  };

  const cut = input.months > 120 ? 60 : 12;
  const shorter = input.months - cut;
  const prazo: WhatIfScenario =
    shorter >= 6
      ? {
          id: "prazo-menor",
          label: cut === 60 ? `5 anos a menos (${shorter} meses)` : `12 meses a menos (${shorter} meses)`,
          result: run({ ...base, months: shorter }),
        }
      : {
          id: "prazo-menor",
          label: "Prazo menor",
          result: null,
          unavailableReason: "O prazo já é curto demais para reduzir.",
        };

  const taxa: WhatIfScenario =
    monthly >= 0.1
      ? {
          id: "taxa-menor",
          label: "Taxa 0,1 ponto menor ao mês",
          result: run({ ...base, ratePercent: monthly - 0.1 }),
        }
      : {
          id: "taxa-menor",
          label: "Taxa menor",
          result: null,
          unavailableReason: "A taxa já está abaixo de 0,1% ao mês.",
        };

  const smaller = Math.round(input.principalCents * 0.9);
  const valor: WhatIfScenario = {
    id: "valor-menor",
    label: "Financiar 10% a menos",
    result: smaller >= MIN_PRINCIPAL_CENTS ? run({ ...base, principalCents: smaller }) : null,
    ...(smaller < MIN_PRINCIPAL_CENTS ? { unavailableReason: "O valor já é o mínimo da calculadora." } : {}),
  };

  return [prazo, taxa, valor];
}

/* -------------------------------------------------------------------------- */
/* Resumo em texto — sem veredito                                             */
/* -------------------------------------------------------------------------- */

const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

const pct = (value: number, digits = 2) =>
  `${value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;

export function buildSacPriceSummary(result: SacPriceResult): string {
  const { price, sac } = result;
  const lines = [
    "Simulação SAC x Price — Crédito por Perto",
    `Valor financiado: ${brl(result.principalCents)}`,
    `Taxa: ${pct(result.monthlyRatePercent, 4)} ao mês (${pct(result.annualRatePercent)} ao ano, equivalente)`,
    `Prazo: ${describeMonths(result.months)}`,
    "",
    `Price — 1ª parcela ${brl(price.firstPaymentCents)}; última ${brl(price.lastPaymentCents)}; juros ${brl(price.totalInterestCents)}; total ${brl(price.totalPaidCents)}`,
    `SAC — 1ª parcela ${brl(sac.firstPaymentCents)}; última ${brl(sac.lastPaymentCents)}; juros ${brl(sac.totalInterestCents)}; total ${brl(sac.totalPaidCents)}`,
  ];
  if (result.crossoverMonth !== null) {
    lines.push(`A parcela SAC fica abaixo da Price a partir da parcela nº ${result.crossoverMonth}.`);
  }
  if (result.monthlyCostsCents > 0 || result.upfrontCostsCents > 0) {
    lines.push(
      `Custo estimado com os valores informados: Price ${brl(result.estimatedCostCents.price)}; SAC ${brl(result.estimatedCostCents.sac)}`,
    );
  }
  lines.push(
    "",
    "Cálculo de referência: não inclui seguros, tarifas, IOF nem correção do saldo (TR, IPCA). Não é proposta nem CET.",
    "https://www.creditoporperto.com/calculadoras/sac-x-price/",
  );
  return lines.join("\n");
}
