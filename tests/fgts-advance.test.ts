import { describe, expect, it } from "vitest";

import {
  analyzeOffer,
  balanceForSaqueCents,
  cedibleCents,
  compareOffers,
  exactSaqueCents,
  firstCompetenceYear,
  implicitMonthlyRate,
  nthBusinessDay,
  price,
  projectSaques,
  saqueAniversarioCents,
  simulateAdvance,
  toIso,
  toMonthlyPercent,
  transferDate,
  waitingPeriod,
  type OfferAnalysis,
} from "@/lib/calculators/fgts-advance";
import { ADVANCE_RULES, SAQUE_TABLE, advanceRulesAt, nextAdvanceChange, todayInBrazil } from "@/lib/calculators/fgts-rules";

/*
 * Referências de valor presente conferidas à parte (Python, decimal de 50
 * dígitos): 500 / (1 + i)^(dias/30), somados antes de arredondar.
 */

describe("tabela do Saque-Aniversário (Lei 8.036/1990, Anexo)", () => {
  it("teste 94 — limites exatos de cada faixa", () => {
    const cases: Array<[number, number]> = [
      [500_00, 250_00],
      [500_01, 250_00], // 200,004 + 50 = 250,004 → R$ 250,00
      [1_000_00, 450_00],
      [1_000_01, 450_00], // 300,003 + 150
      [5_000_00, 1_650_00],
      [5_000_01, 1_650_00], // 1.000,002 + 650
      [10_000_00, 2_650_00],
      [10_000_01, 2_650_00], // 1.500,0015 + 1.150
      [15_000_00, 3_400_00],
      [15_000_01, 3_400_00], // 1.500,001 + 1.900
      [20_000_00, 3_900_00],
      [20_000_01, 3_900_00], // 1.000,0005 + 2.900
    ];
    for (const [balance, saque] of cases) expect(saqueAniversarioCents(balance), `saldo ${balance}`).toBe(saque);
  });

  it("faixas: a alíquota muda só depois do limite", () => {
    expect(saqueAniversarioCents(600_00)).toBe(290_00); // 40% + 50
    expect(saqueAniversarioCents(30_000_00)).toBe(4_400_00); // 5% + 2.900
    expect(saqueAniversarioCents(0)).toBe(0);
  });

  it("teste 95 — exemplo oficial: saldo R$ 1.000 → R$ 450", () => {
    expect(saqueAniversarioCents(SAQUE_TABLE.officialExample.balanceCents)).toBe(SAQUE_TABLE.officialExample.saqueCents);
  });

  it("saldo que gera um saque (inversa da tabela)", () => {
    expect(balanceForSaqueCents(500_00)).toBe(1_166_67); // (500 − 150) ÷ 30%
    expect(balanceForSaqueCents(450_00)).toBe(1_000_00);
    expect(balanceForSaqueCents(100_00)).toBe(200_00);
    for (const t of [100_00, 333_33, 500_00, 2_000_00]) {
      const b = balanceForSaqueCents(t)!;
      expect(exactSaqueCents(b)).toBeGreaterThanOrEqual(t - 1e-6);
      expect(exactSaqueCents(b - 1)).toBeLessThan(t);
    }
  });
});

describe("limites da antecipação", () => {
  it("teste 96 — saque de R$ 450 cede R$ 450; saque de R$ 1.500 cede R$ 500", () => {
    expect(cedibleCents(450_00)).toBe(450_00);
    expect(cedibleCents(1_500_00)).toBe(500_00);
    expect(cedibleCents(1_650_00)).toBe(ADVANCE_RULES.maxPerSaqueCents);
  });

  it("teste 97 — abaixo de R$ 100 não é forçado para o mínimo", () => {
    expect(cedibleCents(99_99)).toBe(0);
    expect(cedibleCents(100_00)).toBe(100_00);
    // Saldo R$ 1.000: 450, 270, 140 — o quarto (R$ 70) fica de fora, e o quinto também.
    const p = projectSaques({ balanceCents: 1_000_00, birthMonth: 3, simDate: "2026-09-23", count: 5 });
    expect(p.rows.map((r) => r.cededCents)).toEqual([450_00, 270_00, 140_00]);
    expect(p.belowMinimum).toBe(2);
  });

  it("teste 98 — em 31/10/2026, até 5 saques", () => {
    expect(advanceRulesAt("2026-10-31")?.maxSaques).toBe(5);
    expect(advanceRulesAt("2026-09-23")?.maxSaques).toBe(5);
  });

  it("teste 99 — a partir de 01/11/2026, até 3 saques", () => {
    expect(advanceRulesAt("2026-11-01")?.maxSaques).toBe(3);
    expect(advanceRulesAt("2030-01-01")?.maxSaques).toBe(3);
    expect(nextAdvanceChange("2026-09-23")).toEqual({ from: "2026-11-01", maxSaques: 3 });
    expect(nextAdvanceChange("2026-11-01")).toBeNull();
  });

  it("antes de 01/11/2025 o simulador não tem regra modelada", () => {
    expect(advanceRulesAt("2025-10-31")).toBeNull();
    const o = simulateAdvance({ balanceCents: 10_000_00, birthMonth: 3, rate: 2, rateUnit: "am", count: 3, simDate: "2025-10-31" });
    expect(o.kind).toBe("invalid");
  });

  it("a interface acompanha a data: 4 saques é recusado em 01/11/2026 e aceito em 31/10/2026", () => {
    const at = (simDate: string) => simulateAdvance({ balanceCents: 10_000_00, birthMonth: 3, rate: 2, rateUnit: "am", count: 4, simDate });
    expect(at("2026-10-31").kind).toBe("ok");
    const after = at("2026-11-01");
    expect(after.kind).toBe("invalid");
    if (after.kind === "invalid") expect(after.errors[0]!.field).toBe("count");
    const ok = simulateAdvance({ balanceCents: 10_000_00, birthMonth: 3, rate: 2, rateUnit: "am", count: 3, simDate: "2026-11-01" });
    if (ok.kind !== "ok") throw new Error();
    expect(ok.result.byCount.map((c) => c.count)).toEqual([1, 2, 3]);
  });
});

describe("carência de 90 dias", () => {
  it("teste 100 — adesão em 10/01/2026: autorização a partir de 10/04/2026 (90 dias corridos)", () => {
    expect(waitingPeriod("2026-01-10", "2026-04-09")).toEqual({ eligibleFrom: "2026-04-10", fulfilled: false, daysLeft: 1 });
    expect(waitingPeriod("2026-01-10", "2026-04-10")).toEqual({ eligibleFrom: "2026-04-10", fulfilled: true, daysLeft: 0 });
  });

  it("teste 101 — 90 dias não são 3 meses", () => {
    // 01/12/2025 + 90 dias = 01/03/2026; 3 meses dariam a mesma data só por acaso.
    expect(waitingPeriod("2025-12-01", "2026-01-01")!.eligibleFrom).toBe("2026-03-01");
    expect(waitingPeriod("2026-06-15", "2026-06-15")!.eligibleFrom).toBe("2026-09-13"); // 3 meses seriam 15/09
    expect(waitingPeriod("data", "2026-01-01")).toBeNull();
  });
});

describe("datas do repasse", () => {
  it("5º dia útil com fim de semana e feriado nacional fixo", () => {
    expect(toIso(nthBusinessDay(2026, 11, 5))).toBe("2026-11-09"); // 02/11 é Finados
    expect(toIso(nthBusinessDay(2027, 3, 5))).toBe("2027-03-05");
    expect(toIso(nthBusinessDay(2027, 1, 5))).toBe("2027-01-08"); // 01/01 é feriado
    expect(toIso(nthBusinessDay(2027, 5, 5))).toBe("2027-05-07"); // 01/05 é sábado
  });

  it("primeira competência: o ano corrente só se o mês de aniversário ainda não chegou", () => {
    expect(firstCompetenceYear("2026-09-23", 10)).toBe(2026);
    expect(firstCompetenceYear("2026-09-23", 9)).toBe(2027);
    expect(firstCompetenceYear("2026-09-23", 3)).toBe(2027);
    expect(transferDate(2026, 10)).toBe("2026-10-07");
  });

  it("teste 102 — aniversário a 1 mês vale mais hoje que aniversário a 11 meses", () => {
    const at = (birthMonth: number) => simulateAdvance({ balanceCents: 10_000_00, birthMonth, rate: 2, rateUnit: "am", count: 3, simDate: "2026-09-23" });
    const near = at(10); // repasse em 07/10/2026
    const far = at(8); // repasse em agosto de 2027
    if (near.kind !== "ok" || far.kind !== "ok") throw new Error();
    expect(near.result.priced.rows[0]!.days).toBe(14);
    expect(far.result.priced.rows[0]!.days).toBeGreaterThan(300);
    expect(near.result.priced.presentCents).toBeGreaterThan(far.result.priced.presentCents);
  });
});

describe("valor presente", () => {
  const base = { balanceCents: 10_000_00, birthMonth: 3, rateUnit: "am" as const, count: 5, simDate: "2026-09-23" };

  it("referência: R$ 10.000, março, 5 saques a 2% a.m. → R$ 1.466,37 hoje por R$ 2.500 cedidos", () => {
    const o = simulateAdvance({ ...base, rate: 2 });
    if (o.kind !== "ok") throw new Error();
    const r = o.result;
    expect(r.priced.rows.map((x) => x.days)).toEqual([163, 531, 896, 1261, 1626]);
    expect(r.priced.nominalCents).toBe(2_500_00);
    expect(r.priced.presentCents).toBe(1_466_37);
    expect(r.priced.differenceCents).toBe(1_033_63);
    expect(r.firstSaqueCents).toBe(2_650_00);
    expect(r.firstCedibleCents).toBe(500_00);
  });

  it("teste 103 — taxa zero: valor hoje = soma dos saques cedidos", () => {
    const o = simulateAdvance({ ...base, rate: 0 });
    if (o.kind !== "ok") throw new Error();
    expect(o.result.priced.presentCents).toBe(o.result.priced.nominalCents);
    expect(o.result.priced.differenceCents).toBe(0);
  });

  it("teste 104 — taxa positiva: recebe menos que o cedido", () => {
    const o = simulateAdvance({ ...base, rate: 0.5 });
    if (o.kind !== "ok") throw new Error();
    expect(o.result.priced.presentCents).toBeLessThan(o.result.priced.nominalCents);
  });

  it("teste 105 — arredonda só no fim", () => {
    const o = simulateAdvance({ ...base, rate: 2 });
    if (o.kind !== "ok") throw new Error();
    const raw = o.result.priced.rows.reduce((s, r) => s + r.presentCents, 0);
    expect(o.result.priced.presentCents).toBe(Math.round(raw));
    expect(Number.isInteger(o.result.priced.rows[0]!.presentCents)).toBe(false);
  });

  it("taxa anual convertida por equivalência, nunca ÷ 12", () => {
    expect(toMonthlyPercent(26.824179456, "aa")).toBeCloseTo(2, 6);
    const a = simulateAdvance({ ...base, rate: 26.824179456, rateUnit: "aa" });
    const m = simulateAdvance({ ...base, rate: 2 });
    if (a.kind !== "ok" || m.kind !== "ok") throw new Error();
    expect(a.result.priced.presentCents).toBe(m.result.priced.presentCents);
  });

  it("cenários de taxa e de quantidade", () => {
    const o = simulateAdvance({ ...base, rate: 2 });
    if (o.kind !== "ok") throw new Error();
    expect(o.result.byRate.map((s) => [s.reductionPp, s.presentCents])).toEqual([
      [0.25, 1_557_03],
      [0.5, 1_656_35],
      [1, 1_885_07],
    ]);
    expect(o.result.byCount.map((c) => c.priced.presentCents)).toEqual([449_00, 801_16, 1_077_93, 1_295_44, 1_466_37]);
    expect(o.result.byCount.map((c) => c.lastYear)).toEqual([2027, 2028, 2029, 2030, 2031]);
    // Taxa de 0,5% não gera cenário de −1 p.p. (taxa negativa).
    const low = simulateAdvance({ ...base, rate: 0.5 });
    if (low.kind !== "ok") throw new Error();
    expect(low.result.byRate.map((s) => s.reductionPp)).toEqual([0.25, 0.5]);
  });
});

describe("evolução do saldo", () => {
  it("teste 91/92 — o saque de cada ano sai do saldo que sobrou, e a faixa é recalculada", () => {
    const p = projectSaques({ balanceCents: 5_000_00, birthMonth: 3, simDate: "2026-09-23", count: 5 });
    expect(p.rows.map((r) => [r.balanceBeforeCents, r.saqueCents, r.cededCents])).toEqual([
      [5_000_00, 1_650_00, 500_00],
      [3_350_00, 1_155_00, 500_00],
      [2_195_00, 808_50, 500_00],
      [1_386_50, 565_95, 500_00],
      [820_55, 378_22, 378_22],
    ]);
  });

  it("se a parte não cedida ficar na conta, o saldo cai menos e o motor mostra a diferença", () => {
    const o = simulateAdvance({ balanceCents: 5_000_00, birthMonth: 3, rate: 2, rateUnit: "am", count: 5, simDate: "2026-09-23" });
    if (o.kind !== "ok") throw new Error();
    expect(o.result.priced.nominalCents).toBe(2_378_22);
    expect(o.result.ifRestStays?.nominalCents).toBe(2_500_00);
    const big = simulateAdvance({ balanceCents: 30_000_00, birthMonth: 3, rate: 2, rateUnit: "am", count: 5, simDate: "2026-09-23" });
    if (big.kind !== "ok") throw new Error();
    expect(big.result.ifRestStays).toBeNull();
  });
});

describe("proposta recebida", () => {
  const offer = (receivedCents: number, extra: Partial<Parameters<typeof analyzeOffer>[0]> = {}): OfferAnalysis => {
    const o = analyzeOffer({ receivedCents, count: 5, cededTotalCents: 2_500_00, ...extra }, 3, "2026-09-23");
    if (o.kind !== "ok") throw new Error(JSON.stringify(o.errors));
    return o.analysis;
  };

  it("teste 83/84 — taxa implícita recupera a taxa usada no desconto", () => {
    const a = offer(1_466_37);
    expect(a.differenceCents).toBe(1_033_63);
    expect(a.implicitMonthlyPercent!).toBeCloseTo(2, 3);
    expect(a.flows.map((f) => f.cents)).toEqual([500_00, 500_00, 500_00, 500_00, 500_00]);
  });

  it("taxa implícita: zero, impossível e fluxos datados", () => {
    expect(implicitMonthlyRate(2_500_00, [{ days: 100, cents: 2_500_00 }])).toBe(0);
    expect(implicitMonthlyRate(2_600_00, [{ days: 100, cents: 2_500_00 }])).toBeNull();
    const flows = price(projectSaques({ balanceCents: 5_000_00, birthMonth: 7, simDate: "2026-09-23", count: 3 }).rows, 1.5);
    expect(implicitMonthlyRate(flows.presentCents, flows.rows.map((r) => ({ days: r.days, cents: r.cededCents })))).toBeCloseTo(1.5, 3);
  });

  it("CET é o informado; limites da regra viram aviso, não erro", () => {
    const a = offer(1_500_00, { cetAnnualPercent: 30, monthlyRatePercent: 1.8 });
    expect(a.cetAnnualPercent).toBe(30);
    expect(a.monthlyRatePercent).toBe(1.8);
    const old = analyzeOffer({ receivedCents: 3_000_00, count: 7, cededTotalCents: 5_000_00 }, 3, "2026-11-10");
    if (old.kind !== "ok") throw new Error();
    expect(old.analysis.aboveCountLimit).toBe(true);
    expect(old.analysis.aboveValueLimit).toBe(true);
  });

  it("validações", () => {
    const errs = (d: Partial<Parameters<typeof analyzeOffer>[0]>) => {
      const o = analyzeOffer({ receivedCents: 1_000_00, count: 3, cededTotalCents: 1_500_00, ...d }, 3, "2026-09-23");
      return o.kind === "invalid" ? o.errors.map((e) => e.field) : [];
    };
    expect(errs({ receivedCents: 0 })).toContain("receivedCents");
    expect(errs({ receivedCents: 2_000_00 })).toContain("receivedCents");
    expect(errs({ count: 0 })).toContain("count");
    expect(errs({ cededTotalCents: 0 })).toContain("cededTotalCents");
    expect(errs({ cetAnnualPercent: -1 })).toContain("cetAnnualPercent");
  });

  it("comparação: critérios independentes, sem vencedora", () => {
    const A = offer(1_500_00, { monthlyRatePercent: 1.8, cetAnnualPercent: 26 });
    const B = offer(1_420_00, { monthlyRatePercent: 2.1, cetAnnualPercent: 31 });
    const c = compareOffers([A, B]);
    expect(c.find((x) => x.key === "maiorRecebido")!.holders).toEqual([0]);
    expect(c.find((x) => x.key === "menorCet")!.holders).toEqual([0]);
    const C = offer(1_450_00);
    expect(compareOffers([A, B, C]).find((x) => x.key === "menorCet")!.available).toBe(false);
    expect(compareOffers([A, A]).find((x) => x.key === "maiorRecebido")!.holders).toEqual([]);
  });
});

describe("validações da simulação", () => {
  const fields = (d: Partial<Parameters<typeof simulateAdvance>[0]>) => {
    const o = simulateAdvance({ balanceCents: 10_000_00, birthMonth: 3, rate: 2, rateUnit: "am", count: 3, simDate: "2026-09-23", ...d });
    return o.kind === "invalid" ? o.errors.map((e) => e.field) : [];
  };
  it("recusa entradas inválidas", () => {
    expect(fields({ balanceCents: 0 })).toContain("balanceCents");
    expect(fields({ birthMonth: 13 })).toContain("birthMonth");
    expect(fields({ rate: -1 })).toContain("rate");
    expect(fields({ rate: Number.NaN })).toContain("rate");
    expect(fields({ rate: 12 })).toContain("rate");
    expect(fields({ count: 6 })).toContain("count");
    expect(fields({ simDate: "2026-02-30" })).toContain("simDate");
  });
  it("hoje no fuso de Brasília", () => {
    expect(todayInBrazil(new Date("2026-11-01T02:00:00Z"))).toBe("2026-10-31");
    expect(todayInBrazil(new Date("2026-11-01T03:00:00Z"))).toBe("2026-11-01");
  });
});
