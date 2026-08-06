/**
 * Cálculos financeiros da calculadora de empréstimo.
 *
 * Sistema de amortização: Price (parcelas fixas), com juros compostos.
 * Todos os resultados são estimativas educativas — o custo real depende
 * do CET, IOF, tarifas, seguros e da política de cada instituição.
 */

export interface LoanInput {
  /** Valor solicitado, em reais */
  principal: number;
  /** Taxa de juros mensal, em porcentagem (ex.: 3 = 3% a.m.) */
  monthlyRatePercent: number;
  /** Número de parcelas mensais */
  installments: number;
  /** Taxas/tarifas adicionais fixas somadas ao valor financiado (opcional) */
  additionalFees?: number;
}

export interface AmortizationRow {
  month: number;
  payment: number;
  interest: number;
  amortization: number;
  balance: number;
}

export interface LoanResult {
  installmentValue: number;
  totalPaid: number;
  totalInterest: number;
  financedAmount: number;
  schedule: AmortizationRow[];
}

export function validateLoanInput(input: LoanInput): string[] {
  const errors: string[] = [];
  if (!Number.isFinite(input.principal) || input.principal <= 0) {
    errors.push("Informe um valor solicitado maior que zero.");
  }
  if (input.principal > 10_000_000) {
    errors.push("Valor solicitado acima do limite da calculadora.");
  }
  if (
    !Number.isFinite(input.monthlyRatePercent) ||
    input.monthlyRatePercent < 0
  ) {
    errors.push("Informe uma taxa de juros mensal igual ou maior que zero.");
  }
  if (input.monthlyRatePercent > 30) {
    errors.push(
      "Taxa mensal acima de 30% — confira se o valor foi digitado em % ao mês.",
    );
  }
  if (
    !Number.isInteger(input.installments) ||
    input.installments < 1 ||
    input.installments > 480
  ) {
    errors.push("Informe um número de parcelas entre 1 e 480.");
  }
  if (
    input.additionalFees !== undefined &&
    (!Number.isFinite(input.additionalFees) || input.additionalFees < 0)
  ) {
    errors.push("Taxas adicionais não podem ser negativas.");
  }
  return errors;
}

/** Parcela fixa pelo sistema Price: PMT = PV * i / (1 - (1+i)^-n). */
export function pricePayment(
  principal: number,
  monthlyRate: number,
  installments: number,
): number {
  if (monthlyRate === 0) return principal / installments;
  const factor = Math.pow(1 + monthlyRate, -installments);
  return (principal * monthlyRate) / (1 - factor);
}

export function calculateLoan(input: LoanInput): LoanResult {
  const errors = validateLoanInput(input);
  if (errors.length > 0) {
    throw new Error(errors.join(" "));
  }
  const financedAmount = input.principal + (input.additionalFees ?? 0);
  const rate = input.monthlyRatePercent / 100;
  const payment = pricePayment(financedAmount, rate, input.installments);

  const schedule: AmortizationRow[] = [];
  let balance = financedAmount;
  let totalInterest = 0;
  for (let month = 1; month <= input.installments; month++) {
    const interest = balance * rate;
    let amortization = payment - interest;
    // Última parcela absorve resíduos de arredondamento.
    if (month === input.installments) {
      amortization = balance;
    }
    balance = Math.max(0, balance - amortization);
    totalInterest += interest;
    schedule.push({
      month,
      payment: interest + amortization,
      interest,
      amortization,
      balance,
    });
  }

  const totalPaid = schedule.reduce((sum, row) => sum + row.payment, 0);
  return {
    installmentValue: payment,
    totalPaid,
    totalInterest,
    financedAmount,
    schedule,
  };
}

/** Conversão de taxa mensal para anual equivalente (juros compostos). */
export function monthlyToAnnualRate(monthlyRatePercent: number): number {
  return (Math.pow(1 + monthlyRatePercent / 100, 12) - 1) * 100;
}

/** Conversão de taxa anual para mensal equivalente (juros compostos). */
export function annualToMonthlyRate(annualRatePercent: number): number {
  return (Math.pow(1 + annualRatePercent / 100, 1 / 12) - 1) * 100;
}

export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}
