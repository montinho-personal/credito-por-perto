import { describe, expect, it } from "vitest";
import {
  annualReferenceTable,
  buildConversionSentence,
  convertRate,
  formatRatePercent,
  MAX_RATE_PERCENT,
  monthlyFactors,
  monthlyReferenceTable,
  nearbyRates,
  validateRatePercent,
} from "@/lib/calculators/rate-converter";
import { parsePercentBR } from "@/lib/calculators/proposal-comparison";

describe("mensal → anual (valores de referência)", () => {
  const cases: Array<[number, number]> = [
    [0, 0],
    [1, 12.6825],
    [2, 26.8242],
    [3, 42.5761],
    [4, 60.1032],
    [5, 79.5856],
    [10, 213.8428],
  ];
  for (const [monthly, annual] of cases) {
    it(`${monthly}% a.m. → ≈${annual}% a.a.`, () => {
      expect(convertRate(monthly, "monthly-to-annual").outputPercent).toBeCloseTo(annual, 3);
    });
  }

  it("comparação com ×12: 3% → 36% simples vs 42,5761% efetiva (+6,5761 p.p.)", () => {
    const c = convertRate(3, "monthly-to-annual");
    expect(c.naivePercent).toBe(36);
    expect(c.naiveDiffPP).toBeCloseTo(6.5761, 3);
  });
});

describe("anual → mensal", () => {
  const cases: Array<[number, number]> = [
    [12, 0.9489],
    [20, 1.531],
    [30, 2.2104],
    [40, 2.8436],
    [100, 5.9463],
  ];
  for (const [annual, monthly] of cases) {
    it(`${annual}% a.a. → ≈${monthly}% a.m.`, () => {
      expect(convertRate(annual, "annual-to-monthly").outputPercent).toBeCloseTo(monthly, 3);
    });
  }
});

describe("round-trip", () => {
  for (const rate of [0.1, 0.99, 1, 2.5, 3, 4.27, 5, 12, 100]) {
    it(`${rate}% a.m. → a.a. → a.m. volta ao original`, () => {
      const annual = convertRate(rate, "monthly-to-annual").outputPercent;
      const back = convertRate(annual, "annual-to-monthly").outputPercent;
      expect(back).toBeCloseTo(rate, 8);
    });
  }
});

describe("entrada e validação", () => {
  it("aceita 3, 3,0, 3,00 e 3.00", () => {
    for (const raw of ["3", "3,0", "3,00", "3.00", "3,00%"]) {
      expect(parsePercentBR(raw)).toBe(3);
    }
  });

  it("taxa zero: 0% ↔ 0%", () => {
    expect(convertRate(0, "monthly-to-annual").outputPercent).toBe(0);
    expect(convertRate(0, "annual-to-monthly").outputPercent).toBe(0);
  });

  it("negativa e absurda são barradas com erro específico", () => {
    expect(validateRatePercent(parsePercentBR("-3"), "-3")).toBe("negative");
    expect(validateRatePercent(999_999_999, "999999999")).toBe("too-large");
    expect(validateRatePercent(parsePercentBR("abc"), "abc")).toBe("invalid");
    expect(validateRatePercent(null, "")).toBe("empty");
    expect(validateRatePercent(3, "3")).toBeNull();
    expect(validateRatePercent(MAX_RATE_PERCENT, String(MAX_RATE_PERCENT))).toBeNull();
  });

  it("taxas pequenas ganham 4 casas na apresentação", () => {
    expect(formatRatePercent(0.01)).toBe("0,0100%");
    expect(formatRatePercent(0.0995)).toBe("0,0995%");
    expect(formatRatePercent(3)).toBe("3,00%");
    expect(formatRatePercent(42.57609)).toBe("42,58%");
  });

  it("0,1% a.m. converte sem quebrar", () => {
    expect(convertRate(0.1, "monthly-to-annual").outputPercent).toBeCloseTo(1.2066, 3);
  });

  it("300% a.m. (extremo) converte sem quebrar", () => {
    const c = convertRate(300, "monthly-to-annual");
    expect(Number.isFinite(c.outputPercent)).toBe(true);
    expect(c.outputPercent).toBeGreaterThan(c.naivePercent);
  });
});

describe("tabelas e apoios", () => {
  it("tabela mensal é calculada, não hardcoded", () => {
    const table = monthlyReferenceTable();
    const row3 = table.find((r) => r.monthly === 3)!;
    expect(row3.annual).toBeCloseTo(42.5761, 3);
    expect(row3.naive).toBe(36);
    const row8 = table.find((r) => r.monthly === 8)!;
    expect(row8.annual).toBeCloseTo(151.8170, 2);
  });

  it("tabela anual → mensal", () => {
    const row40 = annualReferenceTable().find((r) => r.annual === 40)!;
    expect(row40.monthly).toBeCloseTo(2.8436, 3);
  });

  it("taxas próximas incluem o valor digitado e vizinhas ordenadas", () => {
    const rows = nearbyRates(3.2, "monthly-to-annual");
    const values = rows.map((r) => r.inputPercent);
    expect(values).toContain(3.2);
    expect(values).toEqual([...values].sort((a, b) => a - b));
    expect(rows.length).toBeGreaterThanOrEqual(4);
  });

  it("fatores mês a mês: 3% fecha em 1,42576 no mês 12", () => {
    const rows = monthlyFactors(3);
    expect(rows).toHaveLength(12);
    expect(rows[0]).toBeCloseTo(1.03, 10);
    expect(rows[11]).toBeCloseTo(1.42576, 4);
  });

  it("frase do resultado é tecnicamente precisa", () => {
    const sentence = buildConversionSentence(convertRate(3, "monthly-to-annual"));
    expect(sentence).toBe(
      "3,00% ao mês equivale a aproximadamente 42,58% ao ano em taxa efetiva equivalente com capitalização composta.",
    );
    expect(sentence).not.toMatch(/errado|custo total|CET/);
  });
});
