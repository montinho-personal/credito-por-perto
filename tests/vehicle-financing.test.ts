import { describe, expect, it } from "vitest";
import {
  buildWhatIfScenarios,
  compareTerms,
  simulateVehicleFinancing,
  toMonthlyRatePercent,
  type VehicleFinancingInput,
  type VehicleFinancingResult,
} from "@/lib/calculators/vehicle-financing";

/**
 * Os valores esperados NÃO saíram deste código. Foram calculados à parte, em
 * Python com `decimal` de 50 dígitos, seguindo a mesma regra de contrato
 * (parcela ao centavo, juros ao centavo, última parcela absorve o resíduo).
 * Dois cenários batem ainda com simulações publicadas por terceiros:
 *   - R$ 64 mil, 48 meses, 1,49% a.m. → R$ 1.875,99 (publicado ao centavo);
 *   - R$ 60 mil, 60 meses, 2% a.m.    → R$ 1.726,08 (publicado como R$ 1.726).
 */

function ok(input: VehicleFinancingInput): VehicleFinancingResult {
  const outcome = simulateVehicleFinancing(input);
  if (outcome.kind !== "ok") throw new Error(`esperava ok, veio ${outcome.kind}`);
  return outcome.result;
}

const base = (over: Partial<VehicleFinancingInput> = {}): VehicleFinancingInput => ({
  vehiclePrice: 80_000,
  downPayment: 20_000,
  ratePercent: 2,
  rateUnit: "am",
  months: 60,
  ...over,
});

describe("simulador de financiamento — cenários contra referência independente", () => {
  const cases: Array<{
    name: string;
    input: VehicleFinancingInput;
    payment: number;
    total: number;
    interest: number;
  }> = [
    {
      name: "taxa zero: parcela = financiado / prazo",
      input: base({ vehiclePrice: 80_000, downPayment: 20_000, ratePercent: 0, months: 48 }),
      payment: 1250,
      total: 60_000,
      interest: 0,
    },
    {
      name: "financiamento pequeno (moto), 24 meses",
      input: base({ vehiclePrice: 8_000, downPayment: 3_000, ratePercent: 1.99, months: 24 }),
      payment: 264.06,
      total: 6337.33,
      interest: 1337.33,
    },
    {
      name: "24 meses com entrada",
      input: base({ vehiclePrice: 50_000, downPayment: 10_000, ratePercent: 1.5, months: 24 }),
      payment: 1996.96,
      total: 47_927.19,
      interest: 7927.19,
    },
    {
      name: "48 meses — confere com simulação publicada (R$ 1.875,99)",
      input: base({ vehiclePrice: 80_000, downPayment: 16_000, ratePercent: 1.49, months: 48 }),
      payment: 1875.99,
      total: 90_047.46,
      interest: 26_047.46,
    },
    {
      name: "60 meses — confere com simulação publicada (R$ 1.726)",
      input: base({ vehiclePrice: 80_000, downPayment: 20_000, ratePercent: 2, months: 60 }),
      payment: 1726.08,
      total: 103_564.56,
      interest: 43_564.56,
    },
    {
      name: "tarifa financiada entra no saldo",
      input: base({
        vehiclePrice: 100_000,
        downPayment: 20_000,
        ratePercent: 1.8,
        months: 60,
        financedCosts: 1_500,
      }),
      payment: 2232.45,
      total: 133_946.54,
      interest: 52_446.54,
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      const r = ok(c.input);
      expect(r.payment).toBe(c.payment);
      expect(r.totalInstallments).toBe(c.total);
      expect(r.totalInterest).toBe(c.interest);
    });
  }
});

describe("tabela de amortização", () => {
  it("termina com saldo exatamente zero", () => {
    for (const months of [1, 12, 24, 36, 48, 60, 72, 120]) {
      const r = ok(base({ months }));
      expect(r.schedule).toHaveLength(months);
      expect(r.schedule.at(-1)!.closingBalance).toBe(0);
    }
  });

  it("a soma das parcelas da tabela é o total exibido, ao centavo", () => {
    const r = ok(base({ ratePercent: 1.87, months: 57 }));
    const cents = r.schedule.reduce((s, row) => s + Math.round(row.payment * 100), 0);
    expect(cents / 100).toBe(r.totalInstallments);
  });

  it("cada linha fecha: saldo inicial − amortização = saldo final; juros + amortização = parcela", () => {
    const r = ok(base({ ratePercent: 1.63, months: 48 }));
    for (const row of r.schedule) {
      expect(Math.round((row.openingBalance - row.amortization) * 100)).toBe(
        Math.round(row.closingBalance * 100),
      );
      expect(Math.round((row.interest + row.amortization) * 100)).toBe(
        Math.round(row.payment * 100),
      );
    }
  });

  it("só a última parcela pode diferir da parcela fixa, e por centavos", () => {
    const r = ok(base({ ratePercent: 1.87, months: 57 }));
    for (const row of r.schedule.slice(0, -1)) expect(row.payment).toBe(r.payment);
    expect(Math.abs(r.lastPayment - r.payment)).toBeLessThan(0.5);
  });

  it("o resumo anual soma o mesmo que a tabela mensal", () => {
    const r = ok(base({ months: 50 }));
    expect(r.yearly).toHaveLength(5);
    const paid = r.yearly.reduce((s, y) => s + Math.round(y.paid * 100), 0) / 100;
    expect(paid).toBe(r.totalInstallments);
    expect(r.yearly.at(-1)!.lastMonth).toBe(50);
    expect(r.yearly.at(-1)!.closingBalance).toBe(0);
  });

  it("juros caem e amortização sobe ao longo do Price", () => {
    const r = ok(base());
    expect(r.schedule[0]!.interest).toBeGreaterThan(r.schedule[30]!.interest);
    expect(r.schedule[0]!.amortization).toBeLessThan(r.schedule[30]!.amortization);
  });
});

describe("os números que não podem ser confundidos", () => {
  it("financiado ≠ total desembolsado ≠ preço (exemplo do brief)", () => {
    const r = ok(base({ vehiclePrice: 100_000, downPayment: 20_000 }));
    expect(r.vehiclePrice).toBe(100_000);
    expect(r.financedAmount).toBe(80_000);
    expect(r.totalOutlay).toBe(20_000 + r.totalInstallments);
  });

  it("custo pago à parte entra no desembolso, não no saldo nem nos juros", () => {
    const sem = ok(base());
    const com = ok(base({ upfrontCosts: 900 }));
    expect(com.financedAmount).toBe(sem.financedAmount);
    expect(com.totalInterest).toBe(sem.totalInterest);
    expect(com.totalOutlay).toBe(sem.totalOutlay + 900);
  });

  it("invariante: total desembolsado = preço + juros + custos (a entrada se anula)", () => {
    for (const downPayment of [0, 10_000, 35_000]) {
      const r = ok(base({ downPayment, financedCosts: 700, upfrontCosts: 300 }));
      expect(Math.round(r.totalOutlay * 100)).toBe(
        Math.round((r.vehiclePrice + r.totalInterest + r.financedCosts + r.upfrontCosts) * 100),
      );
    }
  });

  it("mais entrada reduz o desembolso exatamente no valor dos juros poupados", () => {
    const atual = ok(base());
    const mais = buildWhatIfScenarios(base()).find((s) => s.id === "entrada-10000")!.result!;
    expect(Math.round((atual.totalOutlay - mais.totalOutlay) * 100)).toBe(
      Math.round((atual.totalInterest - mais.totalInterest) * 100),
    );
  });

  it("entrada em fração do preço", () => {
    expect(ok(base({ vehiclePrice: 80_000, downPayment: 20_000 })).downPaymentShare).toBe(0.25);
  });
});

describe("conversão de taxa: equivalente composta, nunca ÷ 12", () => {
  it("24% a.a. equivale a ~1,8088% a.m. (referência Decimal: 1,8087582)", () => {
    expect(toMonthlyRatePercent(24, "aa")).toBeCloseTo(1.8087582, 6);
    expect(toMonthlyRatePercent(24, "aa")).not.toBeCloseTo(2, 2);
  });

  it("1,8% a.m. equivale a ~23,87% a.a. (referência Decimal: 23,8720532)", () => {
    expect(ok(base({ ratePercent: 1.8 })).annualRatePercent).toBeCloseTo(23.8720532, 6);
  });

  it("digitar a taxa ao ano ou a equivalente ao mês dá o mesmo resultado", () => {
    const mensal = ok(base({ ratePercent: 1.8, rateUnit: "am" }));
    const anual = ok(base({ ratePercent: 23.8720532, rateUnit: "aa" }));
    expect(anual.payment).toBe(mensal.payment);
  });
});

describe("validações", () => {
  const fields = (input: VehicleFinancingInput) => {
    const o = simulateVehicleFinancing(input);
    return o.kind === "invalid" ? o.errors.map((e) => e.field) : [];
  };

  it("entrada igual ao veículo: nada a financiar", () => {
    expect(simulateVehicleFinancing(base({ downPayment: 80_000 })).kind).toBe(
      "nothing-to-finance",
    );
  });

  it("entrada igual ao veículo, mas com custo financiado: ainda há saldo", () => {
    const r = ok(base({ downPayment: 80_000, financedCosts: 1_000 }));
    expect(r.financedAmount).toBe(1_000);
  });

  it("entrada maior que o veículo é erro", () => {
    expect(fields(base({ downPayment: 90_000 }))).toContain("downPayment");
  });

  it("prazo zero, fracionário ou acima do limite é erro", () => {
    expect(fields(base({ months: 0 }))).toContain("months");
    expect(fields(base({ months: 12.5 }))).toContain("months");
    expect(fields(base({ months: 121 }))).toContain("months");
  });

  it("taxa negativa é erro", () => {
    expect(fields(base({ ratePercent: -1 }))).toContain("ratePercent");
  });

  it("campos vazios (NaN) dão erro amigável, não NaN no resultado", () => {
    const f = fields({
      vehiclePrice: Number.NaN,
      downPayment: Number.NaN,
      ratePercent: Number.NaN,
      rateUnit: "am",
      months: Number.NaN,
    });
    expect(f).toEqual(expect.arrayContaining(["vehiclePrice", "downPayment", "ratePercent", "months"]));
  });

  it("taxa alta demais para ser taxa é recusada; taxa alta plausível só avisa", () => {
    expect(fields(base({ ratePercent: 35 }))).toContain("ratePercent");
    const alta = simulateVehicleFinancing(base({ ratePercent: 9 }));
    expect(alta.kind).toBe("ok");
    expect(alta.kind === "ok" && alta.warnings.map((w) => w.field)).toContain("ratePercent");
  });

  it("valores muito grandes não quebram: resultado finito", () => {
    const r = ok(base({ vehiclePrice: 10_000_000, downPayment: 0, ratePercent: 3, months: 120 }));
    for (const v of [r.payment, r.totalInstallments, r.totalInterest, r.totalOutlay]) {
      expect(Number.isFinite(v)).toBe(true);
    }
    expect(r.schedule.at(-1)!.closingBalance).toBe(0);
  });

  it("custos negativos são erro", () => {
    expect(fields(base({ financedCosts: -1 }))).toContain("financedCosts");
    expect(fields(base({ upfrontCosts: -1 }))).toContain("upfrontCosts");
  });
});

describe("cenários 'e se?'", () => {
  it("mais entrada reduz parcela e juros", () => {
    const atual = ok(base());
    const mais = buildWhatIfScenarios(base()).find((s) => s.id === "entrada-10000")!.result!;
    expect(mais.payment).toBeLessThan(atual.payment);
    expect(mais.totalInterest).toBeLessThan(atual.totalInterest);
  });

  it("prazo menor sobe a parcela e reduz os juros", () => {
    const atual = ok(base());
    const curto = buildWhatIfScenarios(base()).find((s) => s.id === "prazo-menos-12")!.result!;
    expect(curto.months).toBe(48);
    expect(curto.payment).toBeGreaterThan(atual.payment);
    expect(curto.totalInterest).toBeLessThan(atual.totalInterest);
  });

  it("corte de taxa é em pontos AO MÊS, também quando a taxa foi digitada ao ano", () => {
    const anual = base({ ratePercent: 23.8720532, rateUnit: "aa" });
    const corte = buildWhatIfScenarios(anual).find((s) => s.id === "taxa-menos-050")!.result!;
    expect(corte.monthlyRatePercent).toBeCloseTo(1.3, 6);
  });

  it("cenário impossível vira indisponível, não número falso", () => {
    const quase = base({ vehiclePrice: 30_000, downPayment: 26_000 });
    const s = buildWhatIfScenarios(quase).find((x) => x.id === "entrada-5000")!;
    expect(s.result).toBeNull();
    expect(s.unavailableReason).toBeTruthy();
    const curto = buildWhatIfScenarios(base({ months: 12 })).find((x) => x.id === "prazo-menos-12")!;
    expect(curto.result).toBeNull();
  });
});

describe("comparação de prazos", () => {
  it("inclui o prazo atual e ordena; parcela cai e juros sobem com o prazo", () => {
    const rows = compareTerms(base({ months: 54 }));
    expect(rows.map((r) => r.months)).toEqual([24, 36, 48, 54, 60]);
    expect(rows.find((r) => r.current)!.months).toBe(54);
    for (let k = 1; k < rows.length; k++) {
      expect(rows[k]!.result.payment).toBeLessThan(rows[k - 1]!.result.payment);
      expect(rows[k]!.result.totalInterest).toBeGreaterThan(rows[k - 1]!.result.totalInterest);
    }
  });
});
