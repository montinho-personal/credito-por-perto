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

  it("confere o infográfico do efeito do prazo (R$ 5.000, 4,5% a.m.)", () => {
    // Números publicados no artigo de empréstimo pessoal (imagem + exemplo).
    expect(pricePayment(5000, 0.045, 12)).toBeCloseTo(548.33, 2);
    expect(pricePayment(5000, 0.045, 24)).toBeCloseTo(344.94, 2);
    const totalDiff = pricePayment(5000, 0.045, 24) * 24 - pricePayment(5000, 0.045, 12) * 12;
    expect(totalDiff).toBeCloseTo(1698.47, 1);
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

describe("taxa implícita nas parcelas", () => {
  it("ida e volta: parcela gerada por uma taxa conhecida devolve a mesma taxa", async () => {
    const { implicitMonthlyRate, pricePayment } = await import("@/lib/calculators/loan");
    for (const [pv, rate, n] of [
      [5_000, 0.0899, 12],
      [3_000, 0.05, 6],
      [10_000, 0.12, 24],
      [1_000, 0.001, 18],
      [48_000, 0.0199, 10],
    ] as const) {
      const pmt = pricePayment(pv, rate, n);
      expect(implicitMonthlyRate(pv, pmt, n)!).toBeCloseTo(rate * 100, 8);
    }
  });

  it("parcela arredondada ao centavo: a taxa volta com erro desprezível", async () => {
    const { implicitMonthlyRate, pricePayment } = await import("@/lib/calculators/loan");
    const pmt = Math.round(pricePayment(4_800, 0.0799, 12) * 100) / 100;
    expect(implicitMonthlyRate(4_800, pmt, 12)!).toBeCloseTo(7.99, 2);
  });

  it("sem acréscimo, taxa zero; parcelas abaixo do valor, sem taxa possível", async () => {
    const { implicitMonthlyRate } = await import("@/lib/calculators/loan");
    expect(implicitMonthlyRate(6_000, 500, 12)).toBe(0);
    expect(implicitMonthlyRate(6_000, 400, 12)).toBeNull();
  });

  it("uma parcela só: taxa = parcela ÷ valor − 1", async () => {
    const { implicitMonthlyRate } = await import("@/lib/calculators/loan");
    expect(implicitMonthlyRate(1_000, 1_150, 1)!).toBeCloseTo(15, 10);
  });

  it("entradas inválidas não travam nem devolvem NaN", async () => {
    const { implicitMonthlyRate } = await import("@/lib/calculators/loan");
    expect(implicitMonthlyRate(0, 500, 12)).toBeNull();
    expect(implicitMonthlyRate(5_000, 0, 12)).toBeNull();
    expect(implicitMonthlyRate(5_000, 500, 0)).toBeNull();
    expect(implicitMonthlyRate(5_000, 500, 2.5)).toBeNull();
    expect(implicitMonthlyRate(5_000, 1e15, 12)).toBeNull();
  });
});
