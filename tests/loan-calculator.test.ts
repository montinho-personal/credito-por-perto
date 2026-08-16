import { describe, expect, it } from "vitest";
import {
  annualToMonthlyRate,
  calculateLoan,
  monthlyToAnnualRate,
  pricePayment,
  validateLoanInput,
} from "@/lib/calculators/loan";

describe("pricePayment", () => {
  it("calcula a parcela do exemplo editorial (R$ 3.000, 2% a.m., 10x)", () => {
    expect(pricePayment(3000, 0.02, 10)).toBeCloseTo(333.98, 1);
  });

  it("divide igualmente quando a taxa é zero", () => {
    expect(pricePayment(1200, 0, 12)).toBe(100);
  });

  it("com 1 parcela, cobra principal + um mês de juros", () => {
    expect(pricePayment(1000, 0.05, 1)).toBeCloseTo(1050, 6);
  });
});

describe("calculateLoan", () => {
  it("amortiza até saldo zero e soma juros corretamente", () => {
    const result = calculateLoan({
      principal: 5000,
      monthlyRatePercent: 3,
      installments: 12,
    });
    expect(result.schedule).toHaveLength(12);
    expect(result.schedule[11]!.balance).toBeCloseTo(0, 6);
    expect(result.totalPaid).toBeCloseTo(
      result.financedAmount + result.totalInterest,
      6,
    );
    // Exemplo citado no artigo de empréstimo pessoal (~R$ 502/parcela)
    expect(result.installmentValue).toBeGreaterThan(495);
    expect(result.installmentValue).toBeLessThan(510);
  });

  it("inclui taxas adicionais no valor financiado", () => {
    const withFees = calculateLoan({
      principal: 1000,
      monthlyRatePercent: 2,
      installments: 6,
      additionalFees: 100,
    });
    expect(withFees.financedAmount).toBe(1100);
  });

  it("juros do primeiro mês incidem sobre o valor financiado", () => {
    const result = calculateLoan({
      principal: 3000,
      monthlyRatePercent: 2,
      installments: 10,
    });
    expect(result.schedule[0]!.interest).toBeCloseTo(60, 6);
  });

  it("rejeita entradas inválidas", () => {
    expect(() =>
      calculateLoan({ principal: -1, monthlyRatePercent: 2, installments: 10 }),
    ).toThrow();
    expect(
      validateLoanInput({ principal: 1000, monthlyRatePercent: 2, installments: 0 }),
    ).not.toHaveLength(0);
    expect(
      validateLoanInput({ principal: 1000, monthlyRatePercent: 40, installments: 10 }),
    ).not.toHaveLength(0);
  });
});

describe("conversão de taxas", () => {
  it("3% a.m. equivale a 42,58% a.a. (valor citado nos artigos)", () => {
    expect(monthlyToAnnualRate(3)).toBeCloseTo(42.576, 2);
  });

  it("1% a.m. equivale a 12,68% a.a.", () => {
    expect(monthlyToAnnualRate(1)).toBeCloseTo(12.6825, 3);
  });

  it("8% a.m. (teto do cheque especial) equivale a ~151,8% a.a. (valor citado no artigo)", () => {
    expect(monthlyToAnnualRate(8)).toBeCloseTo(151.817, 2);
  });

  it("12% a.m. equivale a 289,6% a.a. (tabela do artigo)", () => {
    expect(monthlyToAnnualRate(12)).toBeCloseTo(289.598, 1);
  });

  it("conversões são inversas", () => {
    expect(annualToMonthlyRate(monthlyToAnnualRate(2.5))).toBeCloseTo(2.5, 8);
  });

  it("taxa zero permanece zero", () => {
    expect(monthlyToAnnualRate(0)).toBe(0);
    expect(annualToMonthlyRate(0)).toBe(0);
  });
});
