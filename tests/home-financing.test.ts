import { describe, expect, it } from "vitest";
import {
  downScenarios,
  incomeForPayment,
  maxFinanceable,
  monthsInWords,
  simulateHome,
  termScenarios,
  type CapacityResult,
  type HomeInput,
} from "@/lib/calculators/home-financing";
import { simulateSacPrice } from "@/lib/calculators/sac-price";

const home = (over: Partial<HomeInput> = {}): HomeInput => ({
  propertyCents: 50_000_000,
  downCents: 10_000_000,
  ratePercent: 12,
  rateUnit: "aa",
  months: 360,
  ...over,
});

function capacity(paymentCents: number, ratePercent: number, rateUnit: "am" | "aa", months: number): CapacityResult {
  const outcome = maxFinanceable({ paymentCents, ratePercent, rateUnit, months });
  if (outcome.kind !== "ok") throw new Error(JSON.stringify(outcome.errors));
  return outcome.result;
}

describe("imóvel e entrada → valor financiado", () => {
  it("financia o imóvel menos a entrada, com a mesma tabela da SAC x Price", () => {
    const outcome = simulateHome(home());
    expect(outcome.kind).toBe("ok");
    if (outcome.kind !== "ok") return;
    const direct = simulateSacPrice({ principalCents: 40_000_000, ratePercent: 12, rateUnit: "aa", months: 360 });
    if (direct.kind !== "ok") throw new Error();
    expect(outcome.result.financed.principalCents).toBe(40_000_000);
    expect(outcome.result.financed.sac.totalPaidCents).toBe(direct.result.sac.totalPaidCents);
    expect(outcome.result.financed.price.firstPaymentCents).toBe(direct.result.price.firstPaymentCents);
    expect(outcome.result.downShare).toBeCloseTo(0.2, 10);
  });

  it("entrada maior ou igual ao imóvel não financia nada", () => {
    const outcome = simulateHome(home({ downCents: 50_000_000 }));
    expect(outcome.kind).toBe("invalid");
    if (outcome.kind === "invalid") expect(outcome.errors[0]!.field).toBe("downCents");
  });

  it("erros do motor chegam no campo certo", () => {
    const outcome = simulateHome(home({ months: 500, ratePercent: -1 }));
    expect(outcome.kind).toBe("invalid");
    if (outcome.kind === "invalid") {
      const fields = outcome.errors.map((e) => e.field);
      expect(fields).toContain("months");
      expect(fields).toContain("ratePercent");
    }
  });

  it("sem entrada é válido", () => {
    expect(simulateHome(home({ downCents: 0 })).kind).toBe("ok");
  });
});

describe("modo inverso: parcela → quanto consigo financiar", () => {
  const cases: Array<[number, number, "am" | "aa", number]> = [
    [300_000, 12, "aa", 360],
    [500_000, 11, "aa", 420],
    [200_000, 1, "am", 240],
    [300_000, 0, "am", 360],
    [123_456, 0.87, "am", 300],
    [1_000_000, 13.5, "aa", 120],
  ];

  for (const [payment, rate, unit, months] of cases) {
    it(`parcela ${payment / 100} a ${rate}% ${unit} em ${months} meses: o valor é o maior possível`, () => {
      const r = capacity(payment, rate, unit, months);
      const run = (principalCents: number) => {
        const o = simulateSacPrice({ principalCents, ratePercent: rate, rateUnit: unit, months });
        if (o.kind !== "ok") throw new Error("simulação falhou");
        return o.result;
      };
      // Com o valor encontrado, a parcela fixa da Price e a 1ª da SAC cabem…
      expect(run(r.priceMaxCents).price.fixedCents).toBeLessThanOrEqual(payment);
      expect(run(r.sacMaxCents).sac.firstPaymentCents).toBeLessThanOrEqual(payment);
      // …e é o valor presente da parcela: com um centavo a mais de parcela
      // (≈ fator de valor presente em centavos a mais de valor), já não cabem.
      const i = r.monthlyRatePercent / 100;
      const factor = i === 0 ? months : (1 - Math.pow(1 + i, -months)) / i;
      const bump = Math.ceil(factor) + 1;
      expect(run(r.priceMaxCents + bump).price.fixedCents).toBeGreaterThan(payment);
      expect(run(r.sacMaxCents + months + 1).sac.firstPaymentCents).toBeGreaterThan(payment);
      // A última parcela da Price acerta o arredondamento: fica a poucos
      // reais da fixa, para cima ou para baixo — a interface avisa.
      const last = run(r.priceMaxCents).price.lastPaymentCents;
      expect(Math.abs(last - run(r.priceMaxCents).price.fixedCents)).toBeLessThan(payment * 0.02);
      // A mesma parcela financia mais na Price (a 1ª parcela da SAC é a maior).
      if (rate > 0) expect(r.priceMaxCents).toBeGreaterThan(r.sacMaxCents);
    });
  }

  it("taxa zero: parcela × prazo", () => {
    const r = capacity(300_000, 0, "am", 360);
    // PV = PMT × n, exatamente: R$ 3.000 × 360 = R$ 1.080.000.
    expect(r.priceMaxCents).toBe(108_000_000);
    expect(r.sacMaxCents).toBe(108_000_000);
  });

  it("referência independente: R$ 3.000 a 1% a.m. em 360 meses", () => {
    // Price: 3000 × (1 − 1,01^−360) / 0,01 = 291.654,99 (Python, decimal de 40 dígitos).
    // SAC: 3000 / (1/360 + 0,01) = 234.782,61. Os dois ao centavo, sem folga:
    // o núcleo é a fórmula fechada de affordability.ts.
    const r = capacity(300_000, 1, "am", 360);
    expect(r.priceMaxCents).toBe(29_165_499);
    expect(r.sacMaxCents).toBe(23_478_261);
  });

  it("auditoria: parcela absurda não trava — é recusada; parcela minúscula dá zero", () => {
    expect(maxFinanceable({ paymentCents: 9_999_999_999_999, ratePercent: 14.28, rateUnit: "aa", months: 360 }).kind).toBe("invalid");
    expect(capacity(500, 14.28, "aa", 360).priceMaxCents).toBe(0);
  });

  it("auditoria: parcela enorme bate no limite da calculadora e avisa", () => {
    const r = capacity(90_000_000, 1, "aa", 420);
    expect(r.capped).toBe(true);
    expect(r.priceMaxCents).toBeLessThanOrEqual(50_000_000_00);
  });

  it("taxa alta avisa no modo inverso", () => {
    const o = maxFinanceable({ paymentCents: 300_000, ratePercent: 5, rateUnit: "am", months: 360 });
    expect(o.kind).toBe("ok");
    if (o.kind === "ok") expect(o.warnings[0]!.field).toBe("ratePercent");
  });

  it("recusa entrada inválida", () => {
    expect(maxFinanceable({ paymentCents: 0, ratePercent: 1, rateUnit: "am", months: 360 }).kind).toBe("invalid");
    expect(maxFinanceable({ paymentCents: 100_000, ratePercent: 20, rateUnit: "am", months: 360 }).kind).toBe("invalid");
    expect(maxFinanceable({ paymentCents: 100_000, ratePercent: 1, rateUnit: "am", months: 421 }).kind).toBe("invalid");
  });
});

describe("renda e cenários", () => {
  it("renda para um teto de 30%: arredonda para cima", () => {
    expect(incomeForPayment(300_000, 0.3)).toBe(1_000_000);
    expect(incomeForPayment(300_001, 0.3)).toBe(1_000_004);
    expect(incomeForPayment(300_001, 0.3) * 0.3).toBeGreaterThanOrEqual(300_001);
  });

  it("prazos: parcela cai e juros sobem com o prazo, nos dois sistemas", () => {
    const rows = termScenarios(30_000_000, 12, "aa");
    expect(rows.map((r) => r.months)).toEqual([240, 300, 360, 420]);
    for (let k = 1; k < rows.length; k++) {
      expect(rows[k]!.result.price.firstPaymentCents).toBeLessThan(rows[k - 1]!.result.price.firstPaymentCents);
      expect(rows[k]!.result.sac.firstPaymentCents).toBeLessThan(rows[k - 1]!.result.sac.firstPaymentCents);
      expect(rows[k]!.result.price.totalInterestCents).toBeGreaterThan(rows[k - 1]!.result.price.totalInterestCents);
      expect(rows[k]!.result.sac.totalInterestCents).toBeGreaterThan(rows[k - 1]!.result.sac.totalInterestCents);
    }
  });

  it("entradas: financiado = imóvel − entrada; mais entrada, menos parcela e menos juros", () => {
    const rows = downScenarios(50_000_000, 12, "aa", 360);
    expect(rows.map((r) => r.downCents)).toEqual([5_000_000, 10_000_000, 15_000_000, 20_000_000]);
    for (const r of rows) expect(r.principalCents + r.downCents!).toBe(50_000_000);
    for (let k = 1; k < rows.length; k++) {
      expect(rows[k]!.result.sac.firstPaymentCents).toBeLessThan(rows[k - 1]!.result.sac.firstPaymentCents);
      expect(rows[k]!.result.price.totalInterestCents).toBeLessThan(rows[k - 1]!.result.price.totalInterestCents);
    }
  });

  it("auditoria: a entrada exata da pessoa sempre tem linha própria, marcada", async () => {
    const { downScenariosWithCurrent } = await import("@/lib/calculators/home-financing");
    const rows = downScenariosWithCurrent(35_000_000, 7_777_700, 14.28, "aa", 360);
    const mine = rows.filter((r) => r.current);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.downCents).toBe(7_777_700);
    expect(rows.map((r) => r.downCents)).toEqual([3_500_000, 7_000_000, 7_777_700, 10_500_000, 14_000_000]);
    // Entrada igual a uma fração de referência não duplica a linha.
    const same = downScenariosWithCurrent(50_000_000, 10_000_000, 12, "aa", 360);
    expect(same.filter((r) => r.downCents === 10_000_000)).toHaveLength(1);
    expect(same.find((r) => r.downCents === 10_000_000)!.current).toBe(true);
  });

  it("prazo em palavras", () => {
    expect(monthsInWords(420)).toBe("35 anos");
    expect(monthsInWords(12)).toBe("1 ano");
    expect(monthsInWords(30)).toBe("2 anos e 6 meses");
    expect(monthsInWords(7)).toBe("7 meses");
  });
});

describe("taxa média do BC para financiamento imobiliário (SGS 20772)", () => {
  const now = new Date("2026-09-23T12:00:00Z");

  it("aceita % a.a. plausível e recente, com mês de referência", async () => {
    const { parseHousingRows } = await import("@/lib/bcb/housing-rate");
    const r = parseHousingRows([{ data: "01/06/2026", valor: "11,2" }, { data: "01/07/2026", valor: "11,45" }], now);
    expect(r?.annualRatePercent).toBe(11.45);
    expect(r?.refMonthLabel).toBe("julho de 2026");
  });

  it("recusa a mesma taxa expressa ao mês (unidade errada)", async () => {
    const { parseHousingRows } = await import("@/lib/bcb/housing-rate");
    expect(parseHousingRows([{ data: "01/07/2026", valor: "0,91" }], now)).toBeNull();
  });

  it("recusa dado velho, vazio ou quebrado", async () => {
    const { parseHousingRows } = await import("@/lib/bcb/housing-rate");
    expect(parseHousingRows([{ data: "01/01/2026", valor: "11,4" }], now)).toBeNull();
    expect(parseHousingRows([], now)).toBeNull();
    expect(parseHousingRows([{ data: "2026-07", valor: "11" }], now)).toBeNull();
    expect(parseHousingRows({ erro: true }, now)).toBeNull();
  });
});
