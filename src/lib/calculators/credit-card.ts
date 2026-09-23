/**
 * CALCULADORA DE JUROS DO CARTÃO — motor de cálculo
 * ============================================================================
 *
 * Função pura, centavos inteiros, sem rede. Nada do que a pessoa digita sai
 * do navegador.
 *
 * O QUE ESTE MOTOR SIMULA — E O QUE NÃO SIMULA
 *
 * Um ciclo: da fatura atual até a próxima. A regra do crédito rotativo (ver
 * `credit-card-rules.ts`) limita a permanência do saldo no rotativo até o
 * vencimento da fatura seguinte; depois disso ele é quitado ou financiado em
 * outra modalidade. Por isso não existe aqui "12 meses de rotativo": seria
 * uma dívida que a regra não permite, com um número que assusta e não
 * acontece.
 *
 * Três situações diferentes, com contas diferentes:
 *   - quitada: pagou o total, não há saldo nem juros;
 *   - rotativo: pagou pelo menos o mínimo e menos que o total;
 *   - abaixo do mínimo / sem pagamento: há atraso, com encargos de atraso
 *     que NÃO são a mesma coisa que os juros do rotativo — calculados à
 *     parte, em `calculateLateCharges`, com os percentuais que a pessoa
 *     informar.
 *
 * FÓRMULAS
 *
 *   saldo em aberto   S0 = max(F − P, 0)
 *   juros do ciclo    J  = S0 × i                (i = taxa efetiva mensal)
 *   saldo estimado    S1 = S0 + J + encargos informados
 *
 * Taxa anual informada vira mensal equivalente: (1 + a)^(1/12) − 1. Nunca
 * ÷ 12. Juros arredondados ao centavo, uma vez.
 *
 * O resultado NÃO é o valor da próxima fatura: ela traz também compras
 * novas, parcelas, tarifas e IOF, que este motor não conhece.
 */

import { annualToMonthlyRate, monthlyToAnnualRate } from "@/lib/calculators/loan";

export type RateUnit = "am" | "aa";

export type Situation = "quitada" | "rotativo" | "abaixo-do-minimo" | "sem-pagamento";

export type CardField = "invoiceCents" | "paidCents" | "minimumCents" | "ratePercent";

export interface CardIssue {
  field: CardField;
  message: string;
}

export interface CardInput {
  /** Valor total da fatura, em centavos. */
  invoiceCents: number;
  /** Quanto foi pago, em centavos (0 = não pagou). */
  paidCents: number;
  /** Pagamento mínimo informado na fatura, em centavos (opcional). */
  minimumCents?: number;
  /** Taxa do crédito rotativo, em %, na unidade indicada. */
  ratePercent: number;
  rateUnit: RateUnit;
}

export interface CycleResult {
  situation: Situation;
  invoiceCents: number;
  paidCents: number;
  minimumCents: number | null;
  /** Saldo que ficou em aberto: max(fatura − pago, 0). */
  openCents: number;
  monthlyRatePercent: number;
  annualRatePercent: number;
  /** Juros do rotativo para um ciclo mensal completo sobre o saldo em aberto. */
  interestCents: number;
  /** Saldo em aberto + juros do ciclo (sem outros encargos). */
  balanceAfterCents: number;
  /** Quando não se sabe o mínimo, "rotativo" é presumido, e a interface avisa. */
  minimumUnknown: boolean;
}

export type CycleOutcome =
  | { kind: "ok"; result: CycleResult; warnings: CardIssue[] }
  | { kind: "invalid"; errors: CardIssue[] };

/** Acima disso ao mês, a interface pergunta se a taxa não foi digitada ao ano. */
export const SUSPICIOUS_MONTHLY_RATE = 30;
/** Limite técnico do campo — não é juízo sobre o mercado. */
export const MAX_MONTHLY_RATE = 100;
export const MAX_INVOICE_CENTS = 10_000_000_00;

const isNumber = (v: number | undefined): v is number => typeof v === "number" && Number.isFinite(v);

export function toMonthlyRatePercent(ratePercent: number, unit: RateUnit): number {
  return unit === "am" ? ratePercent : annualToMonthlyRate(ratePercent);
}

/** Juros de um ciclo mensal completo, em centavos: saldo × taxa efetiva mensal. */
export function calculateInterest(balanceCents: number, monthlyRatePercent: number): number {
  if (balanceCents <= 0 || monthlyRatePercent <= 0) return 0;
  return Math.round((balanceCents * monthlyRatePercent) / 100);
}

/**
 * Em que situação a fatura ficou. Sem o mínimo informado, pagamento parcial
 * é tratado como rotativo, com a ressalva `minimumUnknown`.
 */
export function classifyPayment(
  invoiceCents: number,
  paidCents: number,
  minimumCents?: number,
): { situation: Situation; minimumUnknown: boolean } {
  if (paidCents >= invoiceCents) return { situation: "quitada", minimumUnknown: false };
  if (paidCents <= 0) return { situation: "sem-pagamento", minimumUnknown: minimumCents === undefined };
  if (minimumCents !== undefined && paidCents < minimumCents) {
    return { situation: "abaixo-do-minimo", minimumUnknown: false };
  }
  return { situation: "rotativo", minimumUnknown: minimumCents === undefined };
}

export function validateCard(input: CardInput): { errors: CardIssue[]; warnings: CardIssue[] } {
  const errors: CardIssue[] = [];
  const warnings: CardIssue[] = [];

  if (!isNumber(input.invoiceCents) || input.invoiceCents <= 0) {
    errors.push({ field: "invoiceCents", message: "Informe o valor total da fatura." });
  } else if (input.invoiceCents > MAX_INVOICE_CENTS) {
    errors.push({ field: "invoiceCents", message: "Valor acima do limite da calculadora (R$ 10 milhões)." });
  }

  if (!isNumber(input.paidCents) || input.paidCents < 0) {
    errors.push({ field: "paidCents", message: "Informe quanto você pagou. Se não pagou nada, informe zero." });
  } else if (isNumber(input.invoiceCents) && input.invoiceCents > 0 && input.paidCents > input.invoiceCents) {
    errors.push({ field: "paidCents", message: "O valor pago é maior que a fatura informada. Confira os dados." });
  }

  if (input.minimumCents !== undefined) {
    if (!isNumber(input.minimumCents) || input.minimumCents < 0) {
      errors.push({ field: "minimumCents", message: "O pagamento mínimo precisa ser um valor em reais." });
    } else if (isNumber(input.invoiceCents) && input.minimumCents > input.invoiceCents) {
      errors.push({ field: "minimumCents", message: "O mínimo informado é maior que a fatura. Confira os dados." });
    }
  }

  if (!isNumber(input.ratePercent) || input.ratePercent < 0) {
    errors.push({ field: "ratePercent", message: "Informe a taxa do rotativo (zero ou mais)." });
  } else {
    const monthly = toMonthlyRatePercent(input.ratePercent, input.rateUnit);
    if (monthly > MAX_MONTHLY_RATE) {
      errors.push({
        field: "ratePercent",
        message: "Taxa acima de 100% ao mês. Confira se digitou a taxa ao mês ou ao ano.",
      });
    } else if (input.rateUnit === "am" && monthly > SUSPICIOUS_MONTHLY_RATE) {
      warnings.push({
        field: "ratePercent",
        message: "Taxa muito alta para um mês. Confira se a fatura informa a taxa ao mês ou ao ano.",
      });
    }
  }

  return { errors, warnings };
}

export function simulateCycle(input: CardInput): CycleOutcome {
  const { errors, warnings } = validateCard(input);
  if (errors.length > 0) return { kind: "invalid", errors };

  const invoice = Math.round(input.invoiceCents);
  const paid = Math.round(input.paidCents);
  const minimum = input.minimumCents === undefined ? undefined : Math.round(input.minimumCents);
  const { situation, minimumUnknown } = classifyPayment(invoice, paid, minimum);
  const open = Math.max(invoice - paid, 0);
  const monthly = toMonthlyRatePercent(input.ratePercent, input.rateUnit);
  const interest = situation === "quitada" ? 0 : calculateInterest(open, monthly);

  return {
    kind: "ok",
    warnings,
    result: {
      situation,
      invoiceCents: invoice,
      paidCents: paid,
      minimumCents: minimum ?? null,
      openCents: open,
      monthlyRatePercent: monthly,
      annualRatePercent: monthlyToAnnualRate(monthly),
      interestCents: interest,
      balanceAfterCents: open + interest,
      minimumUnknown,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* "E se?" — consequência matemática, nunca recomendação                       */
/* -------------------------------------------------------------------------- */

export interface ExtraPaymentScenario {
  extraCents: number;
  /** Pagamento total no cenário (limitado à fatura). */
  paidCents: number;
  openCents: number;
  interestCents: number;
  /** Juros a menos que na simulação atual. */
  savedCents: number;
}

/**
 * Pagar mais agora: mesma fatura, mesma taxa, pagamento maior. Valores que
 * passariam da fatura são descartados, e o último cenário é sempre "pagar o
 * total", para a comparação factual com zero de juros.
 */
export function extraPaymentScenarios(
  result: CycleResult,
  extras: readonly number[] = [100_00, 500_00, 1_000_00],
): ExtraPaymentScenario[] {
  if (result.openCents <= 0) return [];
  const rows = extras
    .filter((e) => e > 0 && e < result.openCents)
    .map((extraCents) => {
      const open = result.openCents - extraCents;
      const interest = calculateInterest(open, result.monthlyRatePercent);
      return {
        extraCents,
        paidCents: result.paidCents + extraCents,
        openCents: open,
        interestCents: interest,
        savedCents: result.interestCents - interest,
      };
    });
  rows.push({
    extraCents: result.openCents,
    paidCents: result.invoiceCents,
    openCents: 0,
    interestCents: 0,
    savedCents: result.interestCents,
  });
  return rows;
}

export interface LowerRateScenario {
  cutPoints: number;
  monthlyRatePercent: number;
  interestCents: number;
  savedCents: number;
}

/** Mesma dívida, taxa menor em pontos percentuais AO MÊS. */
export function lowerRateScenarios(result: CycleResult, cuts: readonly number[] = [1, 2]): LowerRateScenario[] {
  if (result.openCents <= 0) return [];
  return cuts
    .filter((c) => c > 0 && result.monthlyRatePercent - c >= 0)
    .map((cutPoints) => {
      const rate = result.monthlyRatePercent - cutPoints;
      const interest = calculateInterest(result.openCents, rate);
      return { cutPoints, monthlyRatePercent: rate, interestCents: interest, savedCents: result.interestCents - interest };
    });
}
