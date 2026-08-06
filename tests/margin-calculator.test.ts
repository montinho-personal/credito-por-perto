import { describe, expect, it } from "vitest";
import {
  calculateMargin,
  MARGIN_RULES,
  validateMarginInput,
} from "@/lib/calculators/margin";

describe("calculateMargin", () => {
  it("calcula as fatias do INSS (exemplo do artigo: R$ 2.000)", () => {
    const result = calculateMargin({
      profile: "inss",
      netIncome: 2000,
      currentLoanPayments: 450,
    });
    expect(result.loanLimit).toBeCloseTo(700, 6); // 35%
    expect(result.loanAvailable).toBeCloseTo(250, 6); // exemplo citado no artigo
    expect(result.cardReserve).toBeCloseTo(100, 6); // 5%
    expect(result.benefitCardReserve).toBeCloseTo(100, 6); // 5%
    expect(result.totalCommittable).toBeCloseTo(900, 6); // 45%
  });

  it("CLT usa 35% + 5% de cartão, sem cartão benefício", () => {
    const result = calculateMargin({
      profile: "clt",
      netIncome: 3000,
      currentLoanPayments: 0,
    });
    expect(result.loanLimit).toBeCloseTo(1050, 6);
    expect(result.cardReserve).toBeCloseTo(150, 6);
    expect(result.benefitCardReserve).toBe(0);
  });

  it("margem disponível nunca fica negativa", () => {
    const result = calculateMargin({
      profile: "inss",
      netIncome: 1000,
      currentLoanPayments: 900,
    });
    expect(result.loanAvailable).toBe(0);
  });

  it("rejeita entradas inválidas", () => {
    expect(
      validateMarginInput({ profile: "inss", netIncome: 0, currentLoanPayments: 0 }),
    ).not.toHaveLength(0);
    expect(() =>
      calculateMargin({ profile: "clt", netIncome: 1000, currentLoanPayments: -1 }),
    ).toThrow();
  });

  it("as regras têm data de verificação registrada", () => {
    expect(MARGIN_RULES.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
