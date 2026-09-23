import { describe, expect, it } from "vitest";

import { amountScenarios, calculateIof, termScenarios, type IofInput, type IofResult } from "@/lib/calculators/iof-credit";
import { IOF_REGIMES, iofRegimeAt } from "@/lib/calculators/iof-credit-rules";
import { addMonths, daysBetween } from "@/lib/calculators/civil-date";

/*
 * Referências conferidas à parte (Python, decimal de 40 dígitos):
 *   parcela diária = Σ principal_k × alíquota × min(dias_k, 365)
 *   adicional      = valor × alíquota adicional
 */

const base: IofInput = {
  amountCents: 10_000_00,
  term: 30,
  termUnit: "dias",
  schedule: "unico",
  releaseDate: "2026-09-23",
  borrower: "pf",
  operation: "comum",
  payment: "descontado",
};

function ok(input: Partial<IofInput>): IofResult {
  const o = calculateIof({ ...base, ...input });
  if (o.kind !== "ok") throw new Error(JSON.stringify(o));
  return o.result;
}

describe("pessoa física, pagamento único", () => {
  it("teste 71 — curto prazo: 1, 10, 30 e 90 dias", () => {
    const at = (term: number) => ok({ term }).breakdown;
    expect(at(1).dailyCents).toBe(82); // 10.000 × 0,0082% × 1
    expect(at(10).dailyCents).toBe(8_20);
    expect(at(30).dailyCents).toBe(24_60);
    expect(at(90).dailyCents).toBe(73_80);
    expect(at(90).totalCents).toBe(111_80);
  });

  it("teste 75 — adicional separado, sem depender do prazo", () => {
    expect(ok({ term: 1 }).breakdown.additionalCents).toBe(38_00);
    expect(ok({ term: 700 }).breakdown.additionalCents).toBe(38_00);
  });

  it("teste 72/73/74 — 365, 366 e 730 dias: a parcela diária para no limite", () => {
    const d365 = ok({ term: 365 }).breakdown;
    const d366 = ok({ term: 366 }).breakdown;
    const d730 = ok({ term: 730 }).breakdown;
    expect(d365.dailyCents).toBe(299_30);
    expect(d365.totalCents).toBe(337_30);
    expect(d365.capped).toBe(false);
    expect(d366.dailyCents).toBe(299_30);
    expect(d366.capped).toBe(true);
    expect(d730.totalCents).toBe(337_30);
    expect(d730.dailyWithoutCapCents).toBe(598_60);
  });

  it("prazo em meses vira dias reais entre as datas", () => {
    const r = ok({ term: 3, termUnit: "meses" });
    expect(r.lastDueDate).toBe("2026-12-23");
    expect(r.totalDays).toBe(91);
    expect(r.breakdown.dailyCents).toBe(74_62); // 10.000 × 0,0082% × 91
  });
});

describe("pessoa física, parcelas mensais", () => {
  it("teste 76 — amortização igual: R$ 12.000 em 12 parcelas → R$ 239,69", () => {
    const r = ok({ amountCents: 12_000_00, term: 12, termUnit: "meses", schedule: "parcelas" });
    expect(r.breakdown.rows.map((x) => x.days)).toEqual([30, 61, 91, 122, 153, 181, 212, 242, 273, 303, 334, 365]);
    expect(r.breakdown.dailyCents).toBe(194_09); // 1.000 × 0,0082% × 2.367 dias
    expect(r.breakdown.additionalCents).toBe(45_60);
    expect(r.breakdown.totalCents).toBe(239_69);
  });

  it("Price a 2% a.m.: principal concentrado no fim → IOF maior (R$ 205,61)", () => {
    const r = ok({ term: 12, termUnit: "meses", schedule: "parcelas", monthlyRatePercent: 2 });
    const sum = r.breakdown.rows.reduce((s, x) => s + x.principalCents, 0);
    expect(sum).toBeCloseTo(10_000_00, 6);
    expect(r.breakdown.totalCents).toBe(205_61);
    const sac = ok({ term: 12, termUnit: "meses", schedule: "parcelas" });
    expect(r.breakdown.totalCents).toBeGreaterThan(sac.breakdown.totalCents);
  });

  it("nunca 'valor total × dias do contrato': 48 parcelas ficam abaixo do teto de 3,38%", () => {
    const r = ok({ term: 48, termUnit: "meses", schedule: "parcelas" });
    expect(r.breakdown.capped).toBe(true);
    expect(r.breakdown.totalCents).toBeLessThan(337_30);
    for (const row of r.breakdown.rows) expect(row.countedDays).toBeLessThanOrEqual(365);
  });

  it("vencimento no fim do mês: 31/01 + 1 mês = 28/02", () => {
    expect(addMonths("2027-01-31", 1)).toBe("2027-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(daysBetween("2026-10-01", "2026-10-02")).toBe(1);
  });
});

describe("IOF financiado", () => {
  it("F = L ÷ (1 − k): recebe R$ 10.000, financia R$ 10.349,07", () => {
    const r = ok({ term: 365, payment: "financiado" });
    expect(r.receivedCents).toBe(10_000_00);
    // A forma fechada dá 10.349,07; o ajuste de centavo sobe para 10.349,08, o menor F que cobre o IOF.
    expect(r.contractedCents).toBe(10_349_08);
    expect(r.contractedCents - r.breakdown.totalCents).toBeGreaterThanOrEqual(10_000_00);
  });

  it("descontado: contrata R$ 10.000 e recebe R$ 10.000 − IOF", () => {
    const r = ok({ term: 365 });
    expect(r.contractedCents).toBe(10_000_00);
    expect(r.receivedCents).toBe(10_000_00 - 337_30);
  });

  it("financiado em parcelas também fecha", () => {
    const r = ok({ term: 24, termUnit: "meses", schedule: "parcelas", monthlyRatePercent: 3, payment: "financiado" });
    expect(Math.abs(r.contractedCents - r.receivedCents - r.breakdown.totalCents)).toBeLessThanOrEqual(1);
  });
});

describe("pessoa jurídica e Simples/MEI", () => {
  it("teste 77 — PJ: 0,0082% ao dia + 0,95%; 400 dias → R$ 3.943 sobre R$ 100 mil", () => {
    const r = ok({ amountCents: 100_000_00, term: 400, borrower: "pj" });
    expect(r.breakdown.dailyCents).toBe(2_993_00);
    expect(r.breakdown.additionalCents).toBe(950_00);
    expect(r.breakdown.totalCents).toBe(3_943_00);
  });

  it("teste 78 — Simples/MEI: fontes divergentes, sem número até a conferência oficial", () => {
    expect(calculateIof({ ...base, amountCents: 20_000_00, term: 365, borrower: "simples" }).kind).toBe("simples-pendente");
    expect(calculateIof({ ...base, amountCents: 30_000_01, borrower: "simples" }).kind).toBe("acima-do-limite-simples");
  });

  it("financiado: sempre cobre o valor pedido, sem sobrar mais de um centavo", () => {
    for (const p of [{ term: 60, termUnit: "meses" as const, schedule: "parcelas" as const, monthlyRatePercent: 3 }, { term: 480, termUnit: "meses" as const, schedule: "parcelas" as const, borrower: "pj" as const }]) {
      const r = ok({ ...p, payment: "financiado" });
      const net = r.contractedCents - r.breakdown.totalCents;
      expect(net).toBeGreaterThanOrEqual(10_000_00);
      expect(net).toBeLessThanOrEqual(10_000_01);
    }
  });

  it("meio centavo não cai para baixo: R$ 250 em 30 dias → diária R$ 0,62", () => {
    expect(ok({ amountCents: 250_00, term: 30 }).breakdown.dailyCents).toBe(62);
  });
});

describe("tipo de operação", () => {
  it("teste 70/79 — isenção habitacional e alíquota zero rural: R$ 0", () => {
    const hab = calculateIof({ ...base, operation: "habitacional" });
    const rural = calculateIof({ ...base, operation: "rural" });
    expect(hab.kind).toBe("zero");
    expect(rural.kind).toBe("zero");
    if (hab.kind === "zero") expect(hab.operation.reference).toContain("art. 9º");
    if (rural.kind === "zero") expect(rural.operation.reference).toContain("art. 8º");
  });

  it("teste 80 — portabilidade, renegociação e rotativo: sem número, análise específica", () => {
    for (const operation of ["portabilidade", "renegociacao", "rotativo"] as const) {
      expect(calculateIof({ ...base, operation }).kind).toBe("especifica");
    }
  });
});

describe("regra pela data", () => {
  it("teste 81 — data histórica fora da cobertura não usa a regra atual", () => {
    expect(calculateIof({ ...base, releaseDate: "2021-12-31" }).kind).toBe("fora-da-cobertura");
    expect(calculateIof({ ...base, releaseDate: "2021-06-01", operation: "habitacional" }).kind).toBe("zero");
    expect(calculateIof({ ...base, releaseDate: "2022-01-01" }).kind).toBe("ok");
    expect(calculateIof({ ...base, releaseDate: "2025-07-15", borrower: "pj" }).kind).toBe("fora-da-cobertura");
    expect(calculateIof({ ...base, releaseDate: "2025-07-16", borrower: "pj" }).kind).toBe("ok");
  });

  it("todo regime tem fonte, limite de 365 dias e alíquotas positivas", () => {
    for (const r of IOF_REGIMES) {
      expect(r.source.url).toMatch(/^https:\/\/www\.planalto\.gov\.br\//);
      expect(r.capDays).toBe(365);
      expect(r.dailyRate).toBeGreaterThan(0);
      expect(r.additionalRate).toBeGreaterThan(0);
      expect(typeof r.verified).toBe("boolean");
    }
    expect(iofRegimeAt("2026-09-23", "pf", 1).kind).toBe("ok");
  });
});

describe("cenários e validações", () => {
  it("prazo × IOF: cresce até 365 dias e para", () => {
    const s = termScenarios(base);
    expect(s.map((x) => x.totalCents)).toEqual([62_60, 111_80, 185_60, 337_30, 337_30]);
    expect(s.map((x) => x.capped)).toEqual([false, false, false, false, true]);
  });

  it("valores: R$ 5, 10 e 20 mil no mesmo prazo", () => {
    expect(amountScenarios({ ...base, term: 365 }).map((x) => x.totalCents)).toEqual([168_65, 337_30, 674_60]);
  });

  it("recusa entradas inválidas", () => {
    const fields = (d: Partial<IofInput>) => {
      const o = calculateIof({ ...base, ...d });
      return o.kind === "invalid" ? o.errors.map((e) => e.field) : [];
    };
    expect(fields({ amountCents: 0 })).toContain("amountCents");
    expect(fields({ term: 0 })).toContain("term");
    expect(fields({ term: 2.5 })).toContain("term");
    expect(fields({ schedule: "parcelas", termUnit: "dias" })).toContain("term");
    expect(fields({ releaseDate: "2026-02-30" })).toContain("releaseDate");
    expect(fields({ monthlyRatePercent: -1 })).toContain("monthlyRatePercent");
  });
});
