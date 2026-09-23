import { describe, expect, it } from "vitest";
import {
  calculateInterest,
  classifyPayment,
  extraPaymentScenarios,
  lowerRateScenarios,
  simulateCycle,
  toMonthlyRatePercent,
  type CardInput,
  type CycleResult,
} from "@/lib/calculators/credit-card";

const card = (over: Partial<CardInput> = {}): CardInput => ({
  invoiceCents: 5_000_00,
  paidCents: 2_000_00,
  ratePercent: 10,
  rateUnit: "am",
  ...over,
});

function ok(input: CardInput): CycleResult {
  const o = simulateCycle(input);
  if (o.kind !== "ok") throw new Error(JSON.stringify(o.errors));
  return o.result;
}

describe("ciclo do rotativo", () => {
  it("teste 1 — fatura paga inteira: sem saldo, sem juros", () => {
    const r = ok(card({ invoiceCents: 1_000_00, paidCents: 1_000_00 }));
    expect(r.situation).toBe("quitada");
    expect(r.openCents).toBe(0);
    expect(r.interestCents).toBe(0);
    expect(r.balanceAfterCents).toBe(0);
  });

  it("teste 2 — fatura 1.000, pago 500, taxa 10%: saldo 500, juros 50", () => {
    const r = ok(card({ invoiceCents: 1_000_00, paidCents: 500_00, ratePercent: 10 }));
    expect(r.situation).toBe("rotativo");
    expect(r.openCents).toBe(500_00);
    expect(r.interestCents).toBe(50_00);
    expect(r.balanceAfterCents).toBe(550_00);
  });

  it("teste 3 — taxa zero: juros zero, sem quebrar", () => {
    const r = ok(card({ ratePercent: 0 }));
    expect(r.interestCents).toBe(0);
    expect(r.balanceAfterCents).toBe(r.openCents);
  });

  it("teste 4 — pagamento maior que a fatura: erro, nunca saldo negativo", () => {
    const o = simulateCycle(card({ invoiceCents: 1_000_00, paidCents: 1_500_00 }));
    expect(o.kind).toBe("invalid");
    if (o.kind === "invalid") expect(o.errors[0]!.field).toBe("paidCents");
  });

  it("teste 5 — pagamento abaixo do mínimo: situação de atraso, não rotativo comum", () => {
    const r = ok(card({ invoiceCents: 5_000_00, paidCents: 500_00, minimumCents: 750_00 }));
    expect(r.situation).toBe("abaixo-do-minimo");
  });

  it("teste 6 — nenhum pagamento: situação própria", () => {
    const r = ok(card({ paidCents: 0 }));
    expect(r.situation).toBe("sem-pagamento");
    expect(r.openCents).toBe(5_000_00);
  });

  it("pagamento igual ao mínimo é rotativo; sem mínimo informado, presume rotativo e avisa", () => {
    expect(classifyPayment(5_000_00, 750_00, 750_00)).toEqual({ situation: "rotativo", minimumUnknown: false });
    expect(classifyPayment(5_000_00, 2_000_00)).toEqual({ situation: "rotativo", minimumUnknown: true });
  });

  it("exemplo da página: fatura 5.000, pago 2.000, 14,9% a.m. → 447 de juros", () => {
    const r = ok(card({ ratePercent: 14.9 }));
    expect(r.openCents).toBe(3_000_00);
    expect(r.interestCents).toBe(447_00);
  });
});

describe("taxa", () => {
  it("teste 9 — anual → mensal por equivalência composta, nunca ÷ 12", () => {
    const monthly = toMonthlyRatePercent(300, "aa");
    expect(monthly).toBeCloseTo((Math.pow(4, 1 / 12) - 1) * 100, 10);
    expect(monthly).not.toBeCloseTo(25, 1);
  });

  it("mensal → anual equivalente no resultado", () => {
    const r = ok(card({ ratePercent: 10 }));
    expect(r.annualRatePercent).toBeCloseTo((Math.pow(1.1, 12) - 1) * 100, 8);
  });

  it("taxa negativa é erro; taxa muito alta ao mês avisa, mas calcula", () => {
    expect(simulateCycle(card({ ratePercent: -1 })).kind).toBe("invalid");
    const high = simulateCycle(card({ ratePercent: 40 }));
    expect(high.kind).toBe("ok");
    if (high.kind === "ok") expect(high.warnings[0]!.field).toBe("ratePercent");
    expect(simulateCycle(card({ ratePercent: 150 })).kind).toBe("invalid");
  });

  it("teste 10 — arredondamento: juros ao centavo, meio centavo para cima", () => {
    expect(calculateInterest(333, 15)).toBe(50); // 49,95 → 50
    expect(calculateInterest(1_234_567, 14.9)).toBe(183_950); // 1.839,50483
    expect(calculateInterest(1, 14.9)).toBe(0);
  });
});

describe("e se?", () => {
  it("pagar mais agora reduz o saldo e os juros na mesma taxa; o último cenário é quitar", () => {
    const r = ok(card({ ratePercent: 10 }));
    const rows = extraPaymentScenarios(r);
    expect(rows.map((x) => x.extraCents)).toEqual([100_00, 500_00, 1_000_00, 3_000_00]);
    expect(rows[1]).toMatchObject({ openCents: 2_500_00, interestCents: 250_00, savedCents: 50_00 });
    expect(rows[3]).toMatchObject({ openCents: 0, interestCents: 0, savedCents: 300_00 });
  });

  it("valores maiores que o saldo em aberto não viram cenário", () => {
    const r = ok(card({ invoiceCents: 1_000_00, paidCents: 700_00 }));
    expect(extraPaymentScenarios(r).map((x) => x.extraCents)).toEqual([100_00, 300_00]);
  });

  it("taxa menor em pontos ao mês", () => {
    const r = ok(card({ ratePercent: 10 }));
    const rows = lowerRateScenarios(r);
    expect(rows).toEqual([
      { cutPoints: 1, monthlyRatePercent: 9, interestCents: 270_00, savedCents: 30_00 },
      { cutPoints: 2, monthlyRatePercent: 8, interestCents: 240_00, savedCents: 60_00 },
    ]);
  });

  it("fatura quitada não gera cenários", () => {
    const r = ok(card({ paidCents: 5_000_00 }));
    expect(extraPaymentScenarios(r)).toEqual([]);
    expect(lowerRateScenarios(r)).toEqual([]);
  });
});

describe("atraso: encargos em linhas separadas", () => {
  it("multa e mora só com o que foi informado; mora proporcional aos dias", async () => {
    const { calculateLateCharges } = await import("@/lib/calculators/credit-card");
    const r = calculateLateCharges({ baseCents: 3_000_00, finePercent: 2, moraMonthlyPercent: 1, daysLate: 15 });
    expect(r.fineCents).toBe(60_00);
    expect(r.moraCents).toBe(15_00);
    expect(r.totalCents).toBe(75_00);
  });

  it("sem percentuais informados, nada é inventado", async () => {
    const { calculateLateCharges } = await import("@/lib/calculators/credit-card");
    const r = calculateLateCharges({ baseCents: 3_000_00 });
    expect(r).toEqual({ fineCents: null, moraCents: null, otherCents: 0, iofCents: 0, totalCents: 0 });
  });

  it("IOF e outros encargos só entram como valor informado, em linha própria", async () => {
    const { calculateLateCharges } = await import("@/lib/calculators/credit-card");
    const r = calculateLateCharges({ baseCents: 1_000_00, iofCents: 12_34, otherCents: 5_00 });
    expect(r.iofCents).toBe(12_34);
    expect(r.totalCents).toBe(17_34);
  });
});

describe("teto regulatório (módulo separado)", () => {
  it("teste 7 — dentro e acima do teto", async () => {
    const { applyRegulatoryCap } = await import("@/lib/calculators/credit-card-rules");
    expect(applyRegulatoryCap({ originalCents: 1_000_00, alreadyChargedCents: 600_00, newChargesCents: 300_00, start: "depois" }))
      .toEqual({ status: "dentro", capCents: 1_000_00, roomCents: 400_00 });
    expect(applyRegulatoryCap({ originalCents: 1_000_00, alreadyChargedCents: 900_00, newChargesCents: 300_00, start: "depois" }))
      .toEqual({ status: "ultrapassaria", capCents: 1_000_00, roomCents: 100_00, excessCents: 200_00 });
  });

  it("teste 8 — dívida anterior à vigência não é alcançada; data desconhecida fica incerta", async () => {
    const { applyRegulatoryCap } = await import("@/lib/calculators/credit-card-rules");
    expect(applyRegulatoryCap({ originalCents: 1_000_00, alreadyChargedCents: 2_000_00, newChargesCents: 100_00, start: "antes" }).status)
      .toBe("nao-se-aplica");
    const r = applyRegulatoryCap({ originalCents: 1_000_00, alreadyChargedCents: 950_00, newChargesCents: 100_00, start: "nao-sei" });
    expect(r).toEqual({ status: "incerto", capCents: 1_000_00, roomCents: 50_00, wouldExceed: true, excessCents: 50_00 });
  });

  it("o teto limita encargos acumulados, não vira taxa: encargos já acima do teto deixam folga zero", async () => {
    const { applyRegulatoryCap } = await import("@/lib/calculators/credit-card-rules");
    const r = applyRegulatoryCap({ originalCents: 1_000_00, alreadyChargedCents: 1_200_00, newChargesCents: 0, start: "depois" });
    expect(r).toEqual({ status: "dentro", capCents: 1_000_00, roomCents: 0 });
  });

  it("a regra é configuração com fonte e data", async () => {
    const { INTEREST_CAP, formatIsoDate } = await import("@/lib/calculators/credit-card-rules");
    expect(formatIsoDate(INTEREST_CAP.effectiveFrom)).toBe("03/01/2024");
    expect(INTEREST_CAP.shareOfOriginal).toBe(1);
    expect(INTEREST_CAP.excludesIof).toBe(true);
    expect(INTEREST_CAP.source.url).toMatch(/^https:\/\//);
  });
});
