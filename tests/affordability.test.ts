import { describe, expect, it } from "vitest";
import {
  analyzeGoal,
  annuityFactor,
  applyScenario,
  assetFromFinanced,
  buildAffordabilitySummary,
  calculateAffordability,
  incomeContext,
  priceFinanceableCents,
  pricePaymentCents,
  rateCurve,
  rateNeeded,
  sacFinanceableCents,
  sacFirstPaymentCents,
  termCurve,
  termNeeded,
  type AffordabilityInput,
  type AffordabilityResult,
} from "@/lib/calculators/affordability";
import { maxFinanceable } from "@/lib/calculators/home-financing";
import { simulateSacPrice } from "@/lib/calculators/sac-price";

/*
 * Referências independentes calculadas em Python com decimal de 50 dígitos
 * (fórmula do valor presente, sem arredondamento intermediário).
 */

const base = (over: Partial<AffordabilityInput> = {}): AffordabilityInput => ({
  paymentCents: 200_000,
  ratePercent: 1,
  rateUnit: "am",
  months: 240,
  ...over,
});

function run(input: AffordabilityInput): AffordabilityResult {
  const o = calculateAffordability(input);
  if (o.kind !== "ok") throw new Error(JSON.stringify(o.errors));
  return o.result;
}

const plain = (s: string) => s.replace(/ /g, " ");

describe("validação contra a Calculadora do Cidadão (Banco Central)", () => {
  it("24 prestações de R$ 935 a 1,99% a.m. financiam R$ 17.704,57", () => {
    // Python: 935 × (1 − 1,0199^−24) ÷ 0,0199 = 17.704,5700436…
    const r = run({ paymentCents: 93_500, ratePercent: 1.99, rateUnit: "am", months: 24 });
    expect(r.price.financedCents).toBe(1_770_457);
    // A parcela contratual desse valor é exatamente a informada.
    expect(pricePaymentCents(1_770_457, 0.0199, 24)).toBe(93_500);
  });

  it("premissa: parcelas postecipadas (1ª um mês depois), juros compostos mensais", () => {
    // Valor presente de cada parcela descontada k meses, somado: é o mesmo número.
    let pv = 0;
    for (let k = 1; k <= 24; k++) pv += 935 / Math.pow(1.0199, k);
    expect(Math.round(pv * 100)).toBe(1_770_457);
  });
});

describe("Price inverso", () => {
  it("fórmula fechada, ao centavo", () => {
    // Python: 2000 × (1 − 1,01^−240) ÷ 0,01 = 181.638,83
    expect(run(base()).price.financedCents).toBe(18_163_883);
    // Python: 3000 × a(0,8%, 360) = 353.706,86 · a(1,2%, 360) = 246.588,42
    expect(priceFinanceableCents(300_000, 0.008, 360)).toBe(35_370_686);
    expect(priceFinanceableCents(300_000, 0.012, 360)).toBe(24_658_842);
  });

  it("ida e volta: PV conhecido → parcela → PV", () => {
    for (const [pv, i, n] of [
      [25_000_000, 0.009, 240],
      [4_500_000, 0.0189, 48],
      [1_000_000, 0.05, 12],
      [80_000_000, 0.0075, 420],
    ] as const) {
      const pmt = pricePaymentCents(pv, i, n);
      const back = priceFinanceableCents(pmt, i, n);
      // A parcela ao centavo carrega meio centavo de arredondamento; no valor, vira até meio fator.
      expect(Math.abs(back - pv)).toBeLessThanOrEqual(Math.ceil(annuityFactor(i, n) / 2) + 1);
      expect(pricePaymentCents(back, i, n)).toBeLessThanOrEqual(pmt);
    }
  });

  it("taxa zero: PMT × n — R$ 1.000 × 12 = R$ 12.000 nos dois sistemas", () => {
    const r = run(base({ paymentCents: 100_000, ratePercent: 0, months: 12 }));
    expect(r.price.financedCents).toBe(1_200_000);
    expect(r.sac.financedCents).toBe(1_200_000);
    expect(r.price.totalInterestCents).toBe(0);
    expect(r.sac.totalInterestCents).toBe(0);
    expect(r.sac.totalPaidCents).toBe(1_200_000);
  });
});

describe("SAC inverso", () => {
  it("PV = P1 ÷ (1/n + i), ao centavo", () => {
    // Python: 2000 ÷ (1/240 + 0,01) = 141.176,47
    expect(run(base()).sac.financedCents).toBe(14_117_647);
  });

  it("ida e volta: PV conhecido → 1ª parcela → PV", () => {
    for (const [pv, i, n] of [
      [30_000_000, 0.01, 360],
      [5_000_000, 0.015, 60],
      [12_345_678, 0.0079, 300],
    ] as const) {
      const p1 = sacFirstPaymentCents(pv, i, n);
      const back = sacFinanceableCents(p1, i, n);
      expect(Math.abs(back - pv)).toBeLessThanOrEqual(Math.ceil(1 / (1 / n + i)) + 1);
      expect(sacFirstPaymentCents(back, i, n)).toBeLessThanOrEqual(p1);
    }
  });

  it("juros da SAC vêm da tabela mês a mês, não da fórmula da Price", () => {
    const r = run(base());
    const table = simulateSacPrice({ principalCents: r.sac.financedCents, ratePercent: 1, rateUnit: "am", months: 240 });
    if (table.kind !== "ok") throw new Error();
    expect(r.sac.totalPaidCents).toBe(table.result.sac.totalPaidCents);
    expect(r.sac.totalInterestCents).toBe(table.result.sac.totalInterestCents);
    expect(r.sac.firstPaymentCents).toBeLessThanOrEqual(200_000);
    expect(r.sac.lastPaymentCents).toBeLessThan(r.sac.firstPaymentCents);
    // Total da Price: a tabela também (parcela fixa × n, com o ajuste da última).
    const priceTable = simulateSacPrice({ principalCents: r.price.financedCents, ratePercent: 1, rateUnit: "am", months: 240 });
    if (priceTable.kind !== "ok") throw new Error();
    expect(r.price.totalPaidCents).toBe(priceTable.result.price.totalPaidCents);
    expect(r.price.totalInterestCents).toBe(r.price.totalPaidCents - r.price.financedCents);
  });

  it("com taxa positiva, a mesma parcela financia mais na Price; com 1 parcela, igual", () => {
    const r = run(base());
    expect(r.price.financedCents).toBeGreaterThan(r.sac.financedCents);
    const one = run(base({ months: 1 }));
    expect(one.price.financedCents).toBe(one.sac.financedCents);
  });
});

describe("taxa e unidade", () => {
  it("1% a.m. equivale a (1,01)^12 − 1 ao ano", () => {
    expect(run(base()).annualRatePercent).toBeCloseTo(12.682503013196972, 10);
  });

  it("taxa anual vira mensal equivalente (nunca ÷ 12)", () => {
    const r = run(base({ ratePercent: 12.682503013196972, rateUnit: "aa" }));
    expect(r.monthlyRatePercent).toBeCloseTo(1, 10);
    expect(r.price.financedCents).toBe(18_163_883);
  });
});

describe("entrada e valor do bem", () => {
  it("entrada em reais: R$ 100.000 financiáveis + R$ 20.000 = bem de R$ 120.000", () => {
    // Taxa zero, 100 × R$ 1.000 = R$ 100.000 financiáveis.
    const r = run({ paymentCents: 100_000, ratePercent: 0, rateUnit: "am", months: 100, entry: { kind: "reais", cents: 2_000_000 } });
    expect(r.price.financedCents).toBe(10_000_000);
    expect(r.price.entryCents).toBe(2_000_000);
    expect(r.price.assetCents).toBe(12_000_000);
  });

  it("entrada em percentual: bem = financiamento ÷ (1 − e)", () => {
    const r = run({ paymentCents: 100_000, ratePercent: 0, rateUnit: "am", months: 100, entry: { kind: "percent", percent: 20 } });
    expect(r.price.assetCents).toBe(12_500_000);
    expect(r.price.entryCents).toBe(2_500_000);
    // Volta: financiamento = bem × (1 − e).
    expect(r.price.assetCents * 0.8).toBe(r.price.financedCents);
  });

  it("sem entrada, o bem é o próprio valor financiável", () => {
    expect(assetFromFinanced(123_45, null)).toEqual({ entryCents: 0, assetCents: 123_45 });
    expect(assetFromFinanced(10_000, { kind: "percent", percent: 0 })).toEqual({ entryCents: 0, assetCents: 10_000 });
  });

  it("recusa entrada negativa e percentual de 100% ou mais", () => {
    expect(calculateAffordability(base({ entry: { kind: "reais", cents: -1 } })).kind).toBe("invalid");
    expect(calculateAffordability(base({ entry: { kind: "percent", percent: 100 } })).kind).toBe("invalid");
    expect(calculateAffordability(base({ entry: { kind: "percent", percent: -5 } })).kind).toBe("invalid");
  });
});

describe("tenho um bem em mente", () => {
  it("prazo necessário: recupera um prazo conhecido (Price e SAC)", () => {
    // Python: parcela de R$ 100.000 a 1% a.m. em 120 meses = 1.434,7095 → R$ 1.434,71.
    expect(termNeeded("price", 10_000_000, 143_471, 0.01)).toEqual({ kind: "ok", months: 120, withinLimit: true });
    // SAC: 1ª parcela exata de R$ 1.833,333… → R$ 1.833,34 (com R$ 1.833,33 o valor não fecha).
    const p1 = Math.ceil(10_000_000 / 120 + 10_000_000 * 0.01);
    expect(termNeeded("sac", 10_000_000, p1, 0.01)).toEqual({ kind: "ok", months: 120, withinLimit: true });
    expect(termNeeded("price", 1_200_000, 100_000, 0)).toEqual({ kind: "ok", months: 12, withinLimit: true });
  });

  it("domínio: parcela que não cobre os juros do 1º mês não tem prazo", () => {
    // R$ 300.000 a 1% a.m.: juros do 1º mês = R$ 3.000.
    expect(termNeeded("price", 30_000_000, 300_000, 0.01)).toEqual({ kind: "nao-amortiza" });
    expect(termNeeded("price", 30_000_000, 299_999, 0.01)).toEqual({ kind: "nao-amortiza" });
    expect(termNeeded("sac", 30_000_000, 300_000, 0.01)).toEqual({ kind: "nao-amortiza" });
    const barely = termNeeded("price", 30_000_000, 300_001, 0.01);
    expect(barely.kind).toBe("ok");
    if (barely.kind === "ok") {
      expect(Number.isFinite(barely.months)).toBe(true);
      expect(barely.withinLimit).toBe(false);
    }
  });

  it("taxa necessária: recupera uma taxa conhecida numericamente", () => {
    const pmt = pricePaymentCents(20_000_000, 0.008, 240);
    const r = rateNeeded("price", 20_000_000, pmt, 240);
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") expect(r.monthlyRatePercent).toBeCloseTo(0.8, 4);
    const s = rateNeeded("sac", 20_000_000, sacFirstPaymentCents(20_000_000, 0.008, 240), 240);
    if (s.kind !== "ok") throw new Error();
    expect(s.monthlyRatePercent).toBeCloseTo(0.8, 4);
  });

  it("R$ 200 mil em 240 meses pagando até R$ 2.000: taxa máxima 0,8770% a.m.", () => {
    // Python (bisseção em decimal de 50 dígitos): 0,877009…% a.m. = 11,0469% a.a.
    const r = rateNeeded("price", 20_000_000, 200_000, 240);
    if (r.kind !== "ok") throw new Error();
    expect(r.monthlyRatePercent).toBeCloseTo(0.877009239, 6);
    expect(r.annualRatePercent).toBeCloseTo(11.046883738, 5);
  });

  it("sem taxa possível quando nem com juros zero a parcela chega lá", () => {
    expect(rateNeeded("price", 50_000_000, 200_000, 240)).toEqual({ kind: "sem-taxa" });
  });

  it("objetivo: diferença, parcela, prazo, taxa e entrada que fechariam a conta", () => {
    const r = run(base({ entry: { kind: "reais", cents: 5_000_000 } }));
    const g = analyzeGoal(r, "price", 24_000_000);
    expect(g.neededFinancedCents).toBe(19_000_000);
    expect(g.gapCents).toBe(19_000_000 - 18_163_883);
    expect(g.reachable).toBe(false);
    // Parcela que financiaria os R$ 190 mil, mesma taxa e prazo.
    expect(priceFinanceableCents(g.paymentNeededCents, 0.01, 240)).toBeGreaterThanOrEqual(19_000_000);
    expect(priceFinanceableCents(g.paymentNeededCents - 1, 0.01, 240)).toBeLessThan(19_000_000);
    // Entrada que fecharia: bem − financiável.
    expect(g.entryNeededCents).toBe(24_000_000 - 18_163_883);
    expect(g.termNeeded.kind).toBe("ok");
    if (g.termNeeded.kind === "ok") {
      expect(priceFinanceableCents(200_000, 0.01, g.termNeeded.months)).toBeGreaterThanOrEqual(19_000_000);
      expect(priceFinanceableCents(200_000, 0.01, g.termNeeded.months - 1)).toBeLessThan(19_000_000);
    }
    expect(g.rateNeeded.kind).toBe("ok");
    if (g.rateNeeded.kind === "ok") expect(g.rateNeeded.monthlyRatePercent).toBeLessThan(1);
  });

  it("objetivo na SAC: a 1ª parcela necessária financia o valor inteiro", () => {
    const g = analyzeGoal(run(base()), "sac", 15_000_000);
    expect(sacFinanceableCents(g.paymentNeededCents, 0.01, 240)).toBeGreaterThanOrEqual(15_000_000);
    expect(sacFinanceableCents(g.paymentNeededCents - 1, 0.01, 240)).toBeLessThan(15_000_000);
  });

  it("objetivo cuja parcela não cobre os juros: prazo nenhum resolve", () => {
    // R$ 250 mil a 1% a.m.: juros do 1º mês de R$ 2.500 > parcela de R$ 2.000.
    const g = analyzeGoal(run(base()), "price", 25_000_000);
    expect(g.termNeeded).toEqual({ kind: "nao-amortiza" });
  });

  it("objetivo ao alcance: sobra, não falta", () => {
    const g = analyzeGoal(run(base()), "sac", 10_000_000);
    expect(g.reachable).toBe(true);
    expect(g.gapCents).toBeLessThanOrEqual(0);
    expect(g.entryNeededCents).toBe(0);
  });

  it("objetivo com entrada em percentual calcula a entrada sobre o bem", () => {
    const g = analyzeGoal(run(base({ entry: { kind: "percent", percent: 20 } })), "price", 25_000_000);
    expect(g.entryCents).toBe(5_000_000);
    expect(g.neededFinancedCents).toBe(20_000_000);
  });
});

describe("cenários: uma variável por vez", () => {
  it("+ R$ 500 de parcela aumenta o financiável na proporção do fator", () => {
    const s = applyScenario(base(), { kind: "parcela", deltaCents: 50_000 });
    expect(s.after?.paymentCents).toBe(250_000);
    expect(s.after?.price.financedCents).toBe(priceFinanceableCents(250_000, 0.01, 240));
  });

  it("+ prazo aumenta o financiável E o total pago", () => {
    const before = run(base());
    const s = applyScenario(base(), { kind: "prazo", months: 300 });
    expect(s.after!.price.financedCents).toBeGreaterThan(before.price.financedCents);
    expect(s.after!.price.totalPaidCents).toBeGreaterThan(before.price.totalPaidCents);
    expect(s.after!.price.totalInterestCents).toBeGreaterThan(before.price.totalInterestCents);
  });

  it("taxa menor: − 0,5 p.p. na unidade digitada; nunca negativa", () => {
    const s = applyScenario(base(), { kind: "taxa", deltaPp: -0.5 });
    expect(s.after?.ratePercent).toBe(0.5);
    expect(s.after!.price.financedCents).toBeGreaterThan(run(base()).price.financedCents);
    const neg = applyScenario(base({ ratePercent: 0.2 }), { kind: "taxa", deltaPp: -0.25 });
    expect(neg.after).toBeNull();
    expect(neg.unavailableReason).toMatch(/abaixo de zero/);
  });

  it("prazo além do limite técnico vira cenário indisponível, não erro", () => {
    const s = applyScenario(base(), { kind: "prazo", months: 1_300 });
    expect(s.after).toBeNull();
    expect(s.unavailableReason).toMatch(/limite técnico/);
  });

  it("curva de prazo inclui o prazo da pessoa e cresce com o prazo", () => {
    const pts = termCurve(base({ months: 200 }), "price", [60, 120, 240, 360]);
    expect(pts.map((p) => p.months)).toEqual([60, 120, 200, 240, 360]);
    expect(pts.find((p) => p.current)?.months).toBe(200);
    for (let k = 1; k < pts.length; k++) {
      expect(pts[k]!.financedCents).toBeGreaterThan(pts[k - 1]!.financedCents);
      expect(pts[k]!.totalInterestCents).toBeGreaterThan(pts[k - 1]!.totalInterestCents);
    }
  });

  it("curva de taxa cai conforme a taxa sobe e descarta taxas negativas", () => {
    const pts = rateCurve(base({ ratePercent: 0.7 }), "sac", 0.5);
    expect(pts.map((p) => p.ratePercent)).toEqual([0.2, 0.7, 1.2, 1.7]);
    for (let k = 1; k < pts.length; k++) expect(pts[k]!.financedCents).toBeLessThan(pts[k - 1]!.financedCents);
  });
});

describe("validações e robustez", () => {
  it("parcela zero, prazo zero e taxa negativa: erro amigável no campo certo", () => {
    const fields = (i: AffordabilityInput) => {
      const o = calculateAffordability(i);
      return o.kind === "invalid" ? o.errors.map((e) => e.field) : [];
    };
    expect(fields(base({ paymentCents: 0 }))).toEqual(["paymentCents"]);
    expect(fields(base({ months: 0 }))).toEqual(["months"]);
    expect(fields(base({ ratePercent: -1 }))).toEqual(["ratePercent"]);
    expect(fields(base({ ratePercent: Number.NaN }))).toEqual(["ratePercent"]);
    expect(fields(base({ months: 12.5 }))).toEqual(["months"]);
    expect(fields(base({ months: 1_201 }))).toEqual(["months"]);
  });

  it("taxa de 50% a.m. avisa sobre a unidade, mas calcula", () => {
    const o = calculateAffordability(base({ ratePercent: 50 }));
    expect(o.kind).toBe("ok");
    if (o.kind !== "ok") return;
    expect(o.warnings[0]!.message).toMatch(/mês ou ano/);
    // PV ≈ PMT ÷ i quando n é grande: R$ 2.000 ÷ 0,5 = R$ 4.000.
    expect(o.result.price.financedCents).toBe(400_000);
  });

  it("nunca produz NaN, Infinity ou valor negativo", () => {
    const rates = [0, 0.01, 0.5, 1, 2.5, 9.99, 50, 300];
    const terms = [1, 2, 12, 60, 360, 1_200];
    const payments = [1, 99, 100_000, 99_999_999];
    for (const ratePercent of rates)
      for (const months of terms)
        for (const paymentCents of payments) {
          const r = run({ paymentCents, ratePercent, rateUnit: "am", months, entry: { kind: "percent", percent: 35 } });
          for (const c of [r.price, r.sac]) {
            for (const v of [c.financedCents, c.totalPaidCents, c.totalInterestCents, c.firstPaymentCents, c.lastPaymentCents, c.assetCents, c.entryCents]) {
              expect(Number.isFinite(v)).toBe(true);
              expect(v).toBeGreaterThanOrEqual(0);
            }
            expect(c.totalPaidCents).toBeGreaterThanOrEqual(c.financedCents);
          }
          if (ratePercent > 0 && months > 1) {
            expect(r.price.financedCents).toBeGreaterThanOrEqual(r.sac.financedCents);
            // A página afirma: com a mesma parcela máxima, a SAC paga menos juros.
            if (r.sac.financedCents > 0) expect(r.sac.totalInterestCents).toBeLessThanOrEqual(r.price.totalInterestCents);
          }
        }
  });

  it("o simulador imobiliário usa o mesmo núcleo", () => {
    const home = maxFinanceable({ paymentCents: 300_000, ratePercent: 1, rateUnit: "am", months: 360 });
    if (home.kind !== "ok") throw new Error();
    const r = run({ paymentCents: 300_000, ratePercent: 1, rateUnit: "am", months: 360 });
    expect(home.result.priceMaxCents).toBe(r.price.financedCents);
    expect(home.result.sacMaxCents).toBe(r.sac.financedCents);
  });
});

describe("renda (opcional) e texto para copiar", () => {
  it("renda: só a relação matemática e o que restaria antes de outros gastos", () => {
    const c = incomeContext(200_000, 800_000, 50_000)!;
    expect(c.paymentShare).toBe(0.25);
    expect(c.totalShare).toBeCloseTo(0.3125, 10);
    expect(c.remainingCents).toBe(550_000);
    expect(incomeContext(200_000, 0)).toBeNull();
  });

  it("resumo segue o modelo e avisa que não é aprovação", () => {
    const text = plain(buildAffordabilitySummary(run(base()), "price"));
    expect(text).toContain("Crédito por Perto — Quanto consigo financiar?");
    expect(text).toContain("Parcela: R$ 2.000,00");
    expect(text).toContain("Taxa: 1,00% a.m.");
    expect(text).toContain("Prazo: 240 meses");
    expect(text).toContain("Sistema: Price");
    expect(text).toContain("Valor financiável estimado: R$ 181.638,83");
    expect(text).toContain("Simulação matemática. Não representa aprovação de crédito.");
    expect(plain(buildAffordabilitySummary(run(base()), "sac"))).toContain("1ª parcela, a maior na SAC");
  });
});
