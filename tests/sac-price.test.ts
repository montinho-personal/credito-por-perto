import { describe, expect, it } from "vitest";
import {
  buildSacPriceSummary,
  buildWhatIfScenarios,
  describeMonths,
  milestoneMonths,
  simulateSacPrice,
  toMonthlyRatePercent,
  type SacPriceInput,
  type SacPriceResult,
  type SystemResult,
} from "@/lib/calculators/sac-price";

/**
 * Os valores esperados NÃO saíram deste código. Foram calculados à parte, em
 * Python com `decimal` de 60 dígitos, com a mesma regra de contrato: parcela
 * (Price) e amortização (SAC) ao centavo, juros ao centavo, última parcela
 * absorve o resíduo. Conferências externas:
 *   - SAC, R$ 110.500, 360 meses, 0,72% a.m.: amortização R$ 306,94,
 *     1ª parcela R$ 1.102,54 e 2ª R$ 1.100,33 (publicados ao centavo);
 *   - R$ 64 mil, 48 meses, 1,49% a.m.: Price R$ 1.875,99 (publicado ao
 *     centavo; a mesma fórmula da Calculadora do Cidadão do BC);
 *   - R$ 240 mil, 360 meses, 12% a.a.: totais publicados sem arredondamento
 *     (SAC R$ 651.054,51; Price R$ 848.140,89). Com parcela e juros ao
 *     centavo, o total fica alguns reais abaixo — o teste mede essa distância.
 */

function ok(input: SacPriceInput): SacPriceResult {
  const outcome = simulateSacPrice(input);
  if (outcome.kind !== "ok") {
    throw new Error(`esperava ok, veio ${JSON.stringify(outcome.errors)}`);
  }
  return outcome.result;
}

const input = (over: Partial<SacPriceInput> = {}): SacPriceInput => ({
  principalCents: 30_000_000,
  ratePercent: 0.95,
  rateUnit: "am",
  months: 360,
  ...over,
});

describe("SAC x Price — cenários contra referência independente", () => {
  const cases: Array<{
    name: string;
    input: SacPriceInput;
    price: { first: number; last: number; interest: number };
    sac: { first: number; second: number; last: number; interest: number };
    crossover: number | null;
  }> = [
    {
      name: "taxa zero: as duas tabelas são iguais",
      input: input({ principalCents: 12_000_000, ratePercent: 0, months: 120 }),
      price: { first: 100_000, last: 100_000, interest: 0 },
      sac: { first: 100_000, second: 100_000, last: 100_000, interest: 0 },
      crossover: null,
    },
    {
      name: "imóvel, 360 meses, 0,72% a.m. (SAC publicada ao centavo)",
      input: input({ principalCents: 11_050_000, ratePercent: 0.72, months: 360 }),
      price: { first: 86_064, last: 85_567, interest: 19_932_543 },
      sac: { first: 110_254, second: 110_033, last: 31_076, interest: 14_360_783 },
      crossover: 111,
    },
    {
      name: "taxa anual convertida por equivalência (12% a.a.)",
      input: input({ principalCents: 24_000_000, ratePercent: 12, rateUnit: "aa", months: 360 }),
      price: { first: 235_595, last: 234_588, interest: 60_813_193 },
      sac: { first: 294_398, second: 293_765, last: 67_178, interest: 41_105_246 },
      crossover: 94,
    },
    {
      name: "Price igual à Calculadora do Cidadão: R$ 64 mil, 48x, 1,49%",
      input: input({ principalCents: 6_400_000, ratePercent: 1.49, months: 48 }),
      price: { first: 187_599, last: 187_593, interest: 2_604_746 },
      sac: { first: 228_693, second: 226_706, last: 135_336, interest: 2_336_325 },
      crossover: 22,
    },
    {
      name: "prazo curto: R$ 10 mil em 6 meses a 2%",
      input: input({ principalCents: 1_000_000, ratePercent: 2, months: 6 }),
      price: { first: 178_526, last: 178_524, interest: 71_154 },
      sac: { first: 186_667, second: 183_334, last: 169_998, interest: 70_000 },
      crossover: 4,
    },
    {
      name: "prazo máximo: 420 meses",
      input: input({ principalCents: 30_000_000, ratePercent: 0.95, months: 420 }),
      price: { first: 290_476, last: 289_818, interest: 91_999_262 },
      sac: { first: 356_429, second: 355_750, last: 71_926, interest: 59_992_141 },
      crossover: 99,
    },
    {
      name: "valor do bem menos entrada: R$ 500 mil − R$ 100 mil, 11% a.a.",
      input: input({ principalCents: 50_000_000 - 10_000_000, ratePercent: 11, rateUnit: "aa", months: 360 }),
      price: { first: 365_343, last: 365_316, interest: 91_523_453 },
      sac: { first: 460_495, second: 459_524, last: 112_122, interest: 63_063_833 },
      crossover: 100,
    },
    {
      name: "uma parcela só: os dois sistemas coincidem",
      input: input({ principalCents: 100_000, ratePercent: 1, months: 1 }),
      price: { first: 101_000, last: 101_000, interest: 1_000 },
      sac: { first: 101_000, second: 101_000, last: 101_000, interest: 1_000 },
      crossover: null,
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      const r = ok(c.input);
      expect(r.price.firstPaymentCents).toBe(c.price.first);
      expect(r.price.lastPaymentCents).toBe(c.price.last);
      expect(r.price.totalInterestCents).toBe(c.price.interest);
      expect(r.sac.firstPaymentCents).toBe(c.sac.first);
      if (c.input.months > 1) expect(r.sac.schedule[1]!.paymentCents).toBe(c.sac.second);
      expect(r.sac.lastPaymentCents).toBe(c.sac.last);
      expect(r.sac.totalInterestCents).toBe(c.sac.interest);
      expect(r.crossoverMonth).toBe(c.crossover);
    });
  }

  it("SAC publicada: amortização de R$ 306,94", () => {
    const r = ok(input({ principalCents: 11_050_000, ratePercent: 0.72, months: 360 }));
    expect(r.sac.fixedCents).toBe(30_694);
    expect(r.sac.schedule[0]!.amortizationCents).toBe(30_694);
  });

  it("totais sem arredondamento publicados ficam a poucos reais dos totais em centavos", () => {
    const r = ok(input({ principalCents: 24_000_000, ratePercent: 12, rateUnit: "aa", months: 360 }));
    expect(Math.abs(r.sac.totalPaidCents - 65_105_451)).toBeLessThan(1_500);
    expect(Math.abs(r.price.totalPaidCents - 84_814_089)).toBeLessThan(1_500);
  });
});

describe("conversão de taxa", () => {
  it("anual → mensal por equivalência composta, nunca ÷ 12", () => {
    expect(toMonthlyRatePercent(12, "aa")).toBeCloseTo(0.948879, 5);
    expect(toMonthlyRatePercent(12, "aa")).not.toBeCloseTo(1, 3);
  });

  it("a taxa anual exibida é a equivalente da mensal", () => {
    const r = ok(input({ ratePercent: 1, rateUnit: "am" }));
    expect(r.annualRatePercent).toBeCloseTo(12.6825, 3);
  });

  it("digitar a mensal equivalente dá a mesma tabela que digitar a anual", () => {
    const anual = ok(input({ ratePercent: 12, rateUnit: "aa" }));
    const mensal = ok(input({ ratePercent: toMonthlyRatePercent(12, "aa"), rateUnit: "am" }));
    expect(mensal.price.totalPaidCents).toBe(anual.price.totalPaidCents);
    expect(mensal.sac.totalPaidCents).toBe(anual.sac.totalPaidCents);
  });
});

function assertInvariants(system: SystemResult, principal: number, n: number) {
  const s = system.schedule;
  expect(s).toHaveLength(n);
  let paid = 0;
  let interest = 0;
  let amortized = 0;
  for (let k = 0; k < n; k++) {
    const row = s[k]!;
    expect(Number.isInteger(row.paymentCents)).toBe(true);
    // juros + amortização = parcela
    expect(row.interestCents + row.amortizationCents).toBe(row.paymentCents);
    // saldo final = saldo inicial − amortização, e encadeia com o mês seguinte
    expect(row.closingCents).toBe(row.openingCents - row.amortizationCents);
    if (k > 0) expect(row.openingCents).toBe(s[k - 1]!.closingCents);
    expect(row.closingCents).toBeGreaterThanOrEqual(0);
    expect(row.amortizationCents).toBeGreaterThan(0);
    paid += row.paymentCents;
    interest += row.interestCents;
    amortized += row.amortizationCents;
  }
  expect(s[0]!.openingCents).toBe(principal);
  expect(s[n - 1]!.closingCents).toBe(0);
  expect(amortized).toBe(principal);
  expect(paid).toBe(system.totalPaidCents);
  expect(interest).toBe(system.totalInterestCents);
  expect(system.totalPaidCents).toBe(principal + system.totalInterestCents);
  // Resumo anual soma o mesmo que a tabela.
  expect(system.yearly.reduce((t, y) => t + y.paidCents, 0)).toBe(paid);
  expect(system.yearly.reduce((t, y) => t + y.interestCents, 0)).toBe(interest);
}

describe("invariantes em 360 cenários", () => {
  const principals = [1_000_00, 1_000_000, 12_345_678, 30_000_000, 250_000_000, 1_000_000_000];
  const terms = [1, 2, 12, 48, 60, 120, 240, 360, 420];
  const rates: Array<[number, "am" | "aa"]> = [
    [0, "am"],
    [0.5, "am"],
    [0.95, "am"],
    [1.99, "am"],
    [12, "aa"],
    [30, "aa"],
  ];

  for (const [rate, unit] of rates) {
    it(`taxa ${rate}% ${unit}`, () => {
      for (const principalCents of principals) {
        for (const months of terms) {
          const outcome = simulateSacPrice(input({ principalCents, ratePercent: rate, rateUnit: unit, months }));
          if (outcome.kind !== "ok") {
            // Só combinações extremas podem ser recusadas — valor pequeno com
            // prazo longo, ou taxa alta por 30 anos ou mais — e sempre com
            // explicação.
            const monthly = toMonthlyRatePercent(rate, unit);
            expect(principalCents <= 1_000_000 || (monthly >= 1.9 && months >= 360)).toBe(true);
            expect(outcome.errors[0]!.message.length).toBeGreaterThan(20);
            continue;
          }
          const r = outcome.result;
          assertInvariants(r.price, principalCents, months);
          assertInvariants(r.sac, principalCents, months);

          // SAC: amortização constante (menos a última, que absorve o resíduo).
          const a = r.sac.fixedCents;
          for (const row of r.sac.schedule.slice(0, -1)) expect(row.amortizationCents).toBe(a);
          expect(Math.abs(r.sac.schedule[months - 1]!.amortizationCents - a)).toBeLessThanOrEqual(months);

          // SAC: parcelas não crescem.
          for (let k = 1; k < months - 1; k++) {
            expect(r.sac.schedule[k]!.paymentCents).toBeLessThanOrEqual(r.sac.schedule[k - 1]!.paymentCents);
          }

          // Price: parcela constante (menos a última).
          for (const row of r.price.schedule.slice(0, -1)) expect(row.paymentCents).toBe(r.price.fixedCents);

          // Com juros e mais de uma parcela, a SAC começa acima e paga menos
          // juros. Em valor pequeno e prazo de 2 meses, a diferença some no
          // arredondamento e os juros podem empatar.
          if (rate > 0 && months > 1) {
            expect(r.sac.firstPaymentCents).toBeGreaterThan(r.price.firstPaymentCents);
            expect(r.sac.totalInterestCents).toBeLessThanOrEqual(r.price.totalInterestCents);
            if (months >= 12) expect(r.sac.totalInterestCents).toBeLessThan(r.price.totalInterestCents);
            expect(r.crossoverMonth).not.toBeNull();
            expect(r.crossoverMonth!).toBeGreaterThan(1);
          }
          if (rate === 0) {
            expect(r.sac.totalInterestCents).toBe(0);
            expect(r.price.totalInterestCents).toBe(0);
          }
        }
      }
    });
  }
});

describe("marcos e comparação", () => {
  it("marcos se adaptam ao prazo e nunca repetem o fim do contrato", () => {
    expect(milestoneMonths(360).map((m) => m.month)).toEqual([12, 60, 120, 180]);
    expect(milestoneMonths(48).map((m) => m.month)).toEqual([12, 24]);
    expect(milestoneMonths(12).map((m) => m.month)).toEqual([6]);
    expect(milestoneMonths(1)).toEqual([]);
    expect(milestoneMonths(120).map((m) => m.month)).toEqual([12, 60]);
  });

  it("saldo e % amortizado batem com a tabela", () => {
    const r = ok(input());
    const m = r.milestones.find((x) => x.month === 60)!;
    expect(m.price.balanceCents).toBe(r.price.schedule[59]!.closingCents);
    expect(m.sac.balanceCents).toBe(r.sac.schedule[59]!.closingCents);
    expect(m.sac.amortizedShare).toBeCloseTo(60 / 360, 3);
    // Após 5 anos, o saldo da SAC é menor: ela amortiza mais no início.
    expect(m.sac.balanceCents).toBeLessThan(m.price.balanceCents);
    expect(m.price.interestPaidCents + (r.principalCents - m.price.balanceCents)).toBe(m.price.paidCents);
  });

  it("marcos de 25/50/75% do prazo", () => {
    const r = ok(input({ months: 360 }));
    expect(r.quarterMilestones.map((m) => m.month)).toEqual([90, 180, 270]);
    expect(ok(input({ months: 3 })).quarterMilestones).toEqual([]);
  });

  it("parcela do meio é a nº ceil(n/2)", () => {
    const r = ok(input({ months: 361 }));
    expect(r.middleMonth).toBe(181);
    expect(r.sac.middlePaymentCents).toBe(r.sac.schedule[180]!.paymentCents);
  });

  it("virada: antes dela a SAC é maior ou igual; nela, menor", () => {
    const r = ok(input());
    const k = r.crossoverMonth!;
    for (let m = 1; m < k; m++) {
      expect(r.sac.schedule[m - 1]!.paymentCents).toBeGreaterThanOrEqual(r.price.schedule[m - 1]!.paymentCents);
    }
    expect(r.sac.schedule[k - 1]!.paymentCents).toBeLessThan(r.price.schedule[k - 1]!.paymentCents);
  });

  it("custos informados entram no custo estimado dos dois lados, igual", () => {
    const sem = ok(input());
    const com = ok(input({ monthlyCostsCents: 5_000, upfrontCostsCents: 300_000 }));
    const extra = 5_000 * 360 + 300_000;
    expect(com.estimatedCostCents.price).toBe(sem.price.totalPaidCents + extra);
    expect(com.estimatedCostCents.sac).toBe(sem.sac.totalPaidCents + extra);
    // E não mexem na tabela.
    expect(com.price.totalInterestCents).toBe(sem.price.totalInterestCents);
  });
});

describe("validação", () => {
  const errorsOf = (over: Partial<SacPriceInput>) => {
    const outcome = simulateSacPrice(input(over));
    return outcome.kind === "invalid" ? outcome.errors.map((e) => e.field) : [];
  };

  it("recusa valores fora do intervalo", () => {
    expect(errorsOf({ principalCents: 0 })).toContain("principalCents");
    expect(errorsOf({ principalCents: 99_999 })).toContain("principalCents");
    expect(errorsOf({ principalCents: 6_000_000_000 })).toContain("principalCents");
    expect(errorsOf({ ratePercent: -1 })).toContain("ratePercent");
    expect(errorsOf({ ratePercent: 11 })).toContain("ratePercent");
    expect(errorsOf({ ratePercent: Number.NaN })).toContain("ratePercent");
    expect(errorsOf({ months: 0 })).toContain("months");
    expect(errorsOf({ months: 421 })).toContain("months");
    expect(errorsOf({ months: 12.5 })).toContain("months");
    expect(errorsOf({ monthlyCostsCents: -1 })).toContain("monthlyCostsCents");
  });

  it("taxa alta avisa, mas calcula", () => {
    const outcome = simulateSacPrice(input({ ratePercent: 5, months: 60 }));
    expect(outcome.kind).toBe("ok");
    if (outcome.kind === "ok") expect(outcome.warnings[0]!.field).toBe("ratePercent");
  });

  it("combinação extrema é recusada com explicação, não com tabela torta", () => {
    const outcome = simulateSacPrice(input({ principalCents: 100_000, ratePercent: 9, months: 420 }));
    expect(outcome.kind).toBe("invalid");
  });
});

describe("E se?", () => {
  it("prazo menor, taxa menor e valor menor, sobre a taxa mensal equivalente", () => {
    const base = input({ ratePercent: 12, rateUnit: "aa", months: 360 });
    const [prazo, taxa, valor] = buildWhatIfScenarios(base);
    expect(prazo!.result!.months).toBe(300);
    expect(taxa!.result!.monthlyRatePercent).toBeCloseTo(toMonthlyRatePercent(12, "aa") - 0.1, 10);
    expect(valor!.result!.principalCents).toBe(27_000_000);
    const atual = ok(base);
    expect(taxa!.result!.sac.totalInterestCents).toBeLessThan(atual.sac.totalInterestCents);
    expect(prazo!.result!.price.firstPaymentCents).toBeGreaterThan(atual.price.firstPaymentCents);
  });

  it("prazo curto: corte de 12 meses; curto demais: indisponível com motivo", () => {
    expect(buildWhatIfScenarios(input({ months: 48 }))[0]!.result!.months).toBe(36);
    const [prazo] = buildWhatIfScenarios(input({ months: 12 }));
    expect(prazo!.result).toBeNull();
    expect(prazo!.unavailableReason).toBeTruthy();
  });

  it("taxa zero: não há o que cortar", () => {
    const [, taxa] = buildWhatIfScenarios(input({ ratePercent: 0 }));
    expect(taxa!.result).toBeNull();
  });
});

describe("resumo em texto", () => {
  it("traz os números e nenhum veredito", () => {
    const text = buildSacPriceSummary(ok(input()));
    expect(text).toContain("SAC");
    expect(text).toContain("Price");
    expect(text).toContain("não inclui seguros");
    expect(text).not.toMatch(/melhor|recomend|vale a pena|vantajos/i);
  });

  it("descreve prazos", () => {
    expect(describeMonths(360)).toBe("360 meses (30 anos)");
    expect(describeMonths(1)).toBe("1 mês");
    expect(describeMonths(18)).toBe("18 meses");
  });
});
