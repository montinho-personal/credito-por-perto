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

/**
 * Taxa mensal implícita de uma série de parcelas iguais: o `i` que resolve
 *   PV = PMT × [1 − (1 + i)^(−n)] ÷ i
 * dados o valor financiado, a parcela e o número de parcelas.
 *
 * Bisseção: o valor da parcela cresce com a taxa, então existe no máximo
 * uma raiz. Número de passos fixo — nunca trava — e precisão de 1e−12 na
 * taxa decimal. Devolve a taxa em % ao mês, ou null quando não há taxa
 * positiva que explique os números (parcelas somando menos que o valor
 * financiado, ou taxa acima de 1.000% ao mês, que é erro de digitação).
 *
 * É a taxa IMPLÍCITA NAS PARCELAS: não é a taxa do contrato nem o CET — as
 * parcelas podem embutir tributos e tarifas, e pode haver custos fora delas.
 */
export function implicitMonthlyRate(
  principal: number,
  installment: number,
  installments: number,
): number | null {
  if (!(principal > 0) || !(installment > 0) || !Number.isInteger(installments) || installments < 1) {
    return null;
  }
  const total = installment * installments;
  if (total < principal) return null;
  if (total === principal) return 0;
  if (installments === 1) return (installment / principal - 1) * 100;

  let lo = 0;
  let hi = 10; // 1.000% ao mês
  if (pricePayment(principal, hi, installments) < installment) return null;
  for (let step = 0; step < 200 && hi - lo > 1e-12; step++) {
    const mid = (lo + hi) / 2;
    if (pricePayment(principal, mid, installments) < installment) lo = mid;
    else hi = mid;
  }
  return ((lo + hi) / 2) * 100;
}
