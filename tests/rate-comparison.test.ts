import { describe, expect, it } from "vitest";
import {
  annualToMonthly,
  classifyDifference,
  compareRate,
  monthlyToAnnual,
  parseRateBR,
  validateRateInput,
} from "../src/lib/calculators/rate-comparison";
import {
  parseSgsRow,
  validateSeriesPayload,
  formatRefMonth,
} from "../src/lib/bcb/rates-service";
import { BCB_SERIES_REGISTRY, getSeries } from "../src/lib/bcb/series-registry";

describe("motor — exemplo canônico do briefing", () => {
  it("4,20% a.m. contra referência 3,10% a.m.", () => {
    const r = compareRate({ userRate: 4.2, userUnit: "monthly", referenceMonthly: 3.1 });
    expect(r.diffPointsMonthly).toBeCloseTo(1.1, 10);
    expect(r.diffRelativePct).toBeCloseTo(35.48, 1);
    expect(r.classification).toBe("above_reference");
    expect(r.confirmSuggested).toBe(false);
  });

  it("equivalente anual de 4,20% a.m. = (1,042)^12 − 1", () => {
    expect(monthlyToAnnual(4.2)).toBeCloseTo((Math.pow(1.042, 12) - 1) * 100, 8);
    expect(monthlyToAnnual(3)).toBeCloseTo(42.576, 2);
  });
});

describe("casos A–L do escopo", () => {
  it("A/B: unidade mensal e anual comparam na mesma base", () => {
    const mensal = compareRate({ userRate: 3, userUnit: "monthly", referenceMonthly: 3 });
    // 42,576% a.a. equivale exatamente a 3% a.m.
    const anual = compareRate({
      userRate: monthlyToAnnual(3),
      userUnit: "annual",
      referenceMonthly: 3,
    });
    expect(mensal.diffPointsMonthly).toBeCloseTo(0, 10);
    expect(anual.userMonthly).toBeCloseTo(3, 8);
    expect(anual.diffPointsMonthly).toBeCloseTo(0, 8);
  });

  it("conversão anual→mensal nunca é ÷12", () => {
    expect(annualToMonthly(42.58)).toBeCloseTo(3.0, 2);
    expect(annualToMonthly(42.58)).not.toBeCloseTo(42.58 / 12, 2);
  });

  it("H: taxa acima da referência", () => {
    expect(
      compareRate({ userRate: 5, userUnit: "monthly", referenceMonthly: 3 }).classification,
    ).toBe("above_reference");
  });

  it("I: taxa abaixo da referência", () => {
    expect(
      compareRate({ userRate: 2, userUnit: "monthly", referenceMonthly: 3 }).classification,
    ).toBe("below_reference");
  });

  it("J: taxa igual à referência = próxima (banda editorial de ±10% relativa)", () => {
    expect(
      compareRate({ userRate: 3, userUnit: "monthly", referenceMonthly: 3 }).classification,
    ).toBe("near_reference");
    expect(classifyDifference(9.9)).toBe("near_reference");
    expect(classifyDifference(-9.9)).toBe("near_reference");
    expect(classifyDifference(10.1)).toBe("above_reference");
  });

  it("classificação 'bem acima' exige mais que o dobro da referência", () => {
    expect(classifyDifference(100)).toBe("above_reference");
    expect(classifyDifference(100.1)).toBe("far_above_reference");
    const r = compareRate({ userRate: 6.5, userUnit: "monthly", referenceMonthly: 3.1 });
    expect(r.classification).toBe("far_above_reference");
  });

  it("K: taxa absurda pede confirmação sem bloquear", () => {
    const r = compareRate({ userRate: 400, userUnit: "monthly", referenceMonthly: 3.1 });
    expect(r.confirmSuggested).toBe(true);
    expect(Number.isFinite(r.diffPointsMonthly)).toBe(true);
  });

  it("L: 0% compara normalmente, sem acusação de fraude", () => {
    const r = compareRate({ userRate: 0, userUnit: "monthly", referenceMonthly: 3.1 });
    expect(r.classification).toBe("below_reference");
    expect(r.diffRelativePct).toBeCloseTo(-100, 8);
  });

  it("valida entradas quebradas com mensagens específicas", () => {
    expect(validateRateInput({ userRate: Number.NaN, userUnit: "monthly", referenceMonthly: 3 }).join(" ")).toMatch(/número/);
    expect(validateRateInput({ userRate: -1, userUnit: "monthly", referenceMonthly: 3 }).join(" ")).toMatch(/negativa/);
    expect(validateRateInput({ userRate: 3, userUnit: "monthly", referenceMonthly: 0 }).join(" ")).toMatch(/indisponível/);
    expect(() => compareRate({ userRate: 3, userUnit: "monthly", referenceMonthly: Number.NaN })).toThrow();
  });

  it("parse pt-BR aceita vírgula", () => {
    expect(parseRateBR("4,20")).toBe(4.2);
    expect(parseRateBR("4.2%")).toBe(4.2);
    expect(parseRateBR("x")).toBeNull();
    expect(parseRateBR("-2")).toBeNull();
  });
});

describe("serviço BCB — parsing e validação do payload SGS", () => {
  const serie = getSeries("pessoal-nao-consignado")!;

  it("parseia o formato oficial dd/MM/yyyy + valor com vírgula ou ponto", () => {
    expect(parseSgsRow({ data: "01/07/2026", valor: "6,32" })).toEqual({ refMonth: "2026-07", value: 6.32 });
    expect(parseSgsRow({ data: "01/07/2026", valor: "6.32" })).toEqual({ refMonth: "2026-07", value: 6.32 });
    expect(parseSgsRow({ data: "2026-07-01", valor: "6,32" })).toBeNull();
    expect(parseSgsRow({ data: "01/07/2026", valor: "abc" })).toBeNull();
  });

  it("rejeita payload vazio, zerado ou fora da faixa de sanidade", () => {
    expect(validateSeriesPayload(serie, [])).toBeNull();
    expect(validateSeriesPayload(serie, "html de erro")).toBeNull();
    expect(validateSeriesPayload(serie, [{ data: "01/07/2026", valor: "0" }])).toBeNull();
    expect(validateSeriesPayload(serie, [{ data: "01/07/2026", valor: "80" }])).toBeNull();
  });

  it("aceita payload plausível e mantém a ordem cronológica", () => {
    const rows = [
      { data: "01/06/2026", valor: "6,45" },
      { data: "01/07/2026", valor: "6,32" },
    ];
    const points = validateSeriesPayload(serie, rows)!;
    expect(points).toHaveLength(2);
    expect(points[1]).toEqual({ refMonth: "2026-07", value: 6.32 });
  });

  it("formata o mês de referência por extenso", () => {
    expect(formatRefMonth("2026-07")).toBe("julho de 2026");
  });
});

describe("registro de séries", () => {
  it("todas as séries são mensais, % a.m., com fonte oficial e faixa de sanidade", () => {
    for (const s of BCB_SERIES_REGISTRY) {
      expect(s.unit).toBe("% a.m.");
      expect(s.periodicity).toBe("mensal");
      expect(s.sourceUrl).toMatch(/^https:\/\/dadosabertos\.bcb\.gov\.br\/dataset\/\d+/);
      expect(String(s.monthlySeries)).toMatch(/^2\d{4}$/);
      expect(s.sourceUrl).toContain(String(s.monthlySeries));
      expect(s.sanity.min).toBeLessThan(s.sanity.max);
      expect(s.methodology).toMatch(/ponderada/);
    }
  });

  it("não há códigos duplicados", () => {
    const codes = BCB_SERIES_REGISTRY.map((s) => s.monthlySeries);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
