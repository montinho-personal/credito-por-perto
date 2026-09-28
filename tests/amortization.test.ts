import { describe, expect, it } from "vitest";
import {
  balanceSeries,
  checkInformedPayment,
  compareRuns,
  dateBalanceBelow,
  dueDate,
  effectiveAnnual,
  installmentsUntil,
  lumpForEndMonth,
  lumpForMonthsEarlier,
  lumpForPayment,
  lumpLadder,
  monthlyForMonthsEarlier,
  monthlyRate,
  monthYearLong,
  monthYearShort,
  NO_EXTRAS,
  runContract,
  sensitivity,
  simulateAmortization,
  validateContract,
  type ContractInput,
  type ContractRun,
  type ExtraPlan,
} from "@/lib/simulators/amortization";
import { simulatePartialAmortization } from "@/lib/calculators/partial-amortization";
import { buildSchedule } from "@/lib/calculators/sac-price";

const contract = (over: Partial<ContractInput> = {}): ContractInput => ({
  balanceCents: 284_000_00,
  ratePercent: 1,
  rateUnit: "am",
  remainingMonths: 278,
  system: "price",
  firstDueIso: "2026-10-10",
  ...over,
});
const lump = (cents: number): ExtraPlan => ({ ...NO_EXTRAS, lumpCents: cents });

/** Invariantes que valem para qualquer cronograma. */
function checkInvariants(input: ContractInput, run: ContractRun) {
  const i = monthlyRate(input.ratePercent, input.rateUnit);
  let principal = run.lumpAppliedCents;
  let prev = run.balanceAfterLumpCents;
  for (const r of run.rows) {
    expect(r.openingCents).toBe(prev);
    expect(r.interestCents).toBe(Math.round(r.openingCents * i));
    expect(r.paymentCents).toBe(r.principalCents + r.interestCents);
    expect(r.closingCents).toBe(r.openingCents - r.principalCents - r.extraCents);
    expect(r.closingCents).toBeGreaterThanOrEqual(0);
    expect(r.principalCents).toBeGreaterThanOrEqual(0);
    principal += r.principalCents + r.extraCents;
    prev = r.closingCents;
  }
  // Tudo o que foi amortizado (contratual + extras + aporte) é exatamente o saldo.
  expect(principal).toBe(input.balanceCents);
  expect(prev).toBe(0);
  expect(run.totalOutlayCents).toBe(input.balanceCents + run.totalInterestCents);
  expect(run.months).toBeLessThanOrEqual(input.remainingMonths);
}

/* ------------------------------------------------------------------ *
 * Oráculo independente, em ponto flutuante e fórmula fechada
 * ------------------------------------------------------------------ */

const pmtFloat = (pv: number, i: number, n: number) => (i === 0 ? pv / n : (pv * i) / (1 - Math.pow(1 + i, -n)));
/** Price, reduzir prazo: n_new = −ln(1 − PV·i/PMT) / ln(1+i). */
const priceTermFloat = (pv: number, i: number, pmt: number) => -Math.log(1 - (pv * i) / pmt) / Math.log(1 + i);

describe("taxa", () => {
  it("anual efetiva usa (1+a)^(1/12)−1, nunca a÷12", () => {
    expect(monthlyRate(12, "aa")).toBeCloseTo(Math.pow(1.12, 1 / 12) - 1, 12);
    expect(monthlyRate(12, "aa")).toBeLessThan(0.01);
    expect(monthlyRate(12, "aa-nominal")).toBeCloseTo(0.01, 12);
    expect(effectiveAnnual(0.01)).toBeCloseTo(0.12682503, 8);
  });

  it("taxa anual e mensal equivalentes dão o mesmo resultado", () => {
    const m = runContract(contract({ ratePercent: 0.8 }), lump(30_000_00), "prazo");
    const a = runContract(contract({ ratePercent: effectiveAnnual(0.008) * 100, rateUnit: "aa" }), lump(30_000_00), "prazo");
    expect(a.months).toBe(m.months);
    expect(Math.abs(a.totalInterestCents - m.totalInterestCents)).toBeLessThanOrEqual(a.months);
  });
});

describe("cenário base", () => {
  it.each([
    ["price", 360, 0.75],
    ["sac", 360, 0.75],
    ["price", 48, 1.9],
    ["sac", 120, 0.95],
    ["price", 420, 0.6],
  ] as const)("%s em %i meses a %d%% a.m. bate com o buildSchedule do SAC × Price", (system, n, rate) => {
    const input = contract({ system, remainingMonths: n, ratePercent: rate, balanceCents: 300_000_00 });
    const base = runContract(input, NO_EXTRAS, "prazo");
    const ref = buildSchedule(system, input.balanceCents, rate / 100, n)!;
    expect(base.months).toBe(n);
    expect(base.totalInterestCents).toBe(ref.totalInterestCents);
    expect(base.totalPaymentsCents).toBe(ref.totalPaidCents);
    expect(base.firstPaymentCents).toBe(ref.firstPaymentCents);
    expect(base.lastPaymentCents).toBe(ref.lastPaymentCents);
    checkInvariants(input, base);
  });

  it("360 meses: Price bate com a fórmula fechada e termina em 360", () => {
    const input = contract({ remainingMonths: 360, ratePercent: 9, rateUnit: "aa", balanceCents: 400_000_00 });
    const base = runContract(input, NO_EXTRAS, "prazo");
    const i = monthlyRate(9, "aa");
    const pmt = pmtFloat(400_000_00, i, 360);
    expect(base.months).toBe(360);
    expect(Math.abs(base.firstPaymentCents - pmt)).toBeLessThanOrEqual(1);
    expect(Math.abs(base.totalPaymentsCents - pmt * 360)).toBeLessThanOrEqual(360);
    expect(Math.abs(base.lastPaymentCents - pmt)).toBeLessThanOrEqual(360);
    checkInvariants(input, base);
  });

  it("aporte zero dá exatamente o cenário base, nos dois caminhos", () => {
    const input = contract();
    const base = runContract(input, NO_EXTRAS, "prazo");
    expect(runContract(input, lump(0), "prazo")).toEqual(base);
    expect({ ...runContract(input, lump(0), "prestacao"), mode: "prazo" }).toEqual(base);
  });
});

describe("aporte único: mesmo resultado do motor da Quitação Antecipada", () => {
  const cases: Array<[ContractInput, number]> = [
    [contract(), 30_000_00],
    [contract({ system: "sac" }), 30_000_00],
    [contract({ system: "sac", remainingMonths: 360, ratePercent: 10.5, rateUnit: "aa", balanceCents: 500_000_00 }), 50_000_00],
    [contract({ remainingMonths: 60, ratePercent: 2.1, balanceCents: 40_000_00 }), 10_000_00],
    [contract({ remainingMonths: 24, ratePercent: 0, balanceCents: 12_000_00 }), 3_000_00],
  ];
  it.each(cases)("%# prazo e prestação", (input, extra) => {
    const ref = simulatePartialAmortization({
      balanceCents: input.balanceCents,
      remainingMonths: input.remainingMonths,
      rateValue: input.ratePercent,
      rateUnit: input.ratePercent === 0 ? "sem-juros" : input.rateUnit === "am" ? "mensal" : "anual",
      system: input.system,
      extraPaymentCents: extra,
    });
    const out = simulateAmortization(input, lump(extra));
    expect(out.kind).toBe("ok");
    if (out.kind !== "ok") return;
    const { base, prazo, prestacao } = out.result;
    for (const [mine, theirs] of [
      [base, ref.baseline!],
      [prazo, ref.reduceTerm!],
      [prestacao, ref.reducePayment!],
    ] as const) {
      expect(mine.months).toBe(theirs.months);
      expect(mine.totalInterestCents).toBe(theirs.totalInterestCents);
      expect(mine.totalPaymentsCents).toBe(theirs.totalPaidCents);
      expect(mine.firstPaymentCents).toBe(theirs.firstPaymentCents);
      expect(mine.lastPaymentCents).toBe(theirs.lastPaymentCents);
    }
    checkInvariants(input, prazo);
    checkInvariants(input, prestacao);
  });
});

describe("reduzir prazo", () => {
  it("Price: quantidade de parcelas bate com n = −ln(1 − PV·i/PMT)/ln(1+i)", () => {
    const input = contract();
    const i = 0.01;
    const run = runContract(input, lump(30_000_00), "prazo");
    const pmt = runContract(input, NO_EXTRAS, "prazo").firstPaymentCents;
    const nFloat = priceTermFloat(254_000_00, i, pmt);
    expect(run.months).toBe(Math.ceil(nFloat));
    // A prestação continua a mesma e a última é só o resíduo.
    expect(run.firstPaymentCents).toBe(pmt);
    expect(run.lastPaymentCents).toBeLessThan(pmt);
    expect(run.lastPaymentCents).toBeGreaterThan(0);
  });

  it("SAC: quota constante, prazo = ⌈saldo novo ÷ quota⌉ e última parcela residual", () => {
    const input = contract({ system: "sac", balanceCents: 300_000_00, remainingMonths: 300 });
    const run = runContract(input, lump(25_000_00), "prazo");
    const quota = 1_000_00;
    expect(run.months).toBe(Math.ceil(275_000_00 / quota));
    expect(run.rows[0]!.principalCents).toBe(quota);
    expect(run.rows[0]!.paymentCents).toBe(quota + Math.round(275_000_00 * 0.01));
    checkInvariants(input, run);
  });

  it("juros evitados = diferença do desembolso total, com o aporte somado", () => {
    const input = contract();
    const base = runContract(input, NO_EXTRAS, "prazo");
    const run = runContract(input, lump(20_000_00), "prazo");
    const c = compareRuns(base, run);
    expect(c.interestAvoidedCents).toBeGreaterThan(0);
    expect(c.outlayDifferenceCents).toBe(c.interestAvoidedCents);
    // Proibido: comparar só as parcelas, sem somar o aporte, exageraria a "economia".
    expect(base.totalPaymentsCents - run.totalPaymentsCents).toBe(c.interestAvoidedCents + 20_000_00);
  });
});

describe("reduzir prestação", () => {
  it("Price: nova parcela = PV·i / (1 − (1+i)^−n) e o prazo não muda", () => {
    const input = contract();
    const run = runContract(input, lump(30_000_00), "prestacao");
    expect(run.months).toBe(278);
    expect(Math.abs(run.firstPaymentCents - pmtFloat(254_000_00, 0.01, 278))).toBeLessThanOrEqual(1);
    checkInvariants(input, run);
  });

  it("SAC: quota recalculada e prestações seguem decrescentes", () => {
    const input = contract({ system: "sac", balanceCents: 300_000_00, remainingMonths: 300 });
    const run = runContract(input, lump(30_000_00), "prestacao");
    expect(run.months).toBe(300);
    expect(run.rows[0]!.principalCents).toBe(90_000);
    expect(run.firstPaymentCents).toBe(90_000 + 270_000);
    for (let k = 1; k < run.rows.length - 1; k++) {
      expect(run.rows[k]!.paymentCents).toBeLessThanOrEqual(run.rows[k - 1]!.paymentCents);
    }
    checkInvariants(input, run);
  });
});

describe("casos-limite", () => {
  it("taxa zero: amortizar reduz prazo, mas juros evitados são zero", () => {
    const input = contract({ ratePercent: 0, remainingMonths: 100, balanceCents: 100_000_00 });
    const out = simulateAmortization(input, lump(20_000_00));
    if (out.kind !== "ok") throw new Error("esperava ok");
    expect(out.result.prazo.months).toBe(80);
    expect(out.result.prazoVsBase.interestAvoidedCents).toBe(0);
    expect(out.result.prestacaoVsBase.interestAvoidedCents).toBe(0);
    expect(out.result.prestacao.firstPaymentCents).toBe(800_00);
  });

  it("aporte igual ao saldo quita: nenhuma parcela resta", () => {
    const input = contract();
    const run = runContract(input, lump(input.balanceCents), "prazo");
    expect(run.months).toBe(0);
    expect(run.lastDueIso).toBeNull();
    expect(run.totalInterestCents).toBe(0);
    checkInvariants(input, run);
  });

  it("aporte maior que o saldo é bloqueado na validação", () => {
    const issues = validateContract(contract(), lump(284_000_01));
    expect(issues.map((x) => x.field)).toContain("lump");
  });

  it("valida saldo, taxa, prazo e unidade provável", () => {
    expect(validateContract(contract({ balanceCents: 0 })).map((x) => x.field)).toContain("balance");
    expect(validateContract(contract({ remainingMonths: 0 })).map((x) => x.field)).toContain("months");
    expect(validateContract(contract({ remainingMonths: 601 })).map((x) => x.field)).toContain("months");
    expect(validateContract(contract({ ratePercent: 12, rateUnit: "am" })).map((x) => x.field)).toContain("rate");
    expect(validateContract(contract({ ratePercent: 12, rateUnit: "aa" }))).toEqual([]);
  });

  it("última parcela fecha o saldo em zero, sem parcela de centavos", () => {
    for (const n of [12, 59, 60, 61, 180, 359]) {
      for (const system of ["price", "sac"] as const) {
        const input = contract({ system, remainingMonths: n, ratePercent: 1.37, balanceCents: 123_456_78 });
        const base = runContract(input, NO_EXTRAS, "prazo");
        expect(base.months).toBe(n);
        checkInvariants(input, base);
        const run = runContract(input, { ...NO_EXTRAS, lumpCents: 7_777_77, monthlyCents: 333_33 }, "prazo");
        checkInvariants(input, run);
        expect(run.lastPaymentCents).toBeGreaterThan(0);
      }
    }
  });
});

describe("aportes recorrentes e personalizados", () => {
  it("R$ 500 por mês: extra aplicado todo mês depois da parcela, até quitar", () => {
    const input = contract();
    const run = runContract(input, { ...NO_EXTRAS, monthlyCents: 500_00 }, "prazo");
    const base = runContract(input, NO_EXTRAS, "prazo");
    expect(run.months).toBeLessThan(base.months);
    for (const r of run.rows.slice(0, -1)) expect(r.extraCents).toBe(500_00);
    // Recalcula mês a mês de forma independente: saldo·(1+i) − PMT − 500.
    const pmt = base.firstPaymentCents;
    let bal = 284_000_00;
    let k = 0;
    while (bal > 0) {
      k += 1;
      const interest = Math.round(bal * 0.01);
      const principal = Math.min(pmt - interest, bal);
      bal -= principal;
      bal -= Math.min(500_00, bal);
    }
    expect(run.months).toBe(k);
    checkInvariants(input, run);
    expect(run.totalExtrasCents).toBe(run.rows.reduce((s, r) => s + r.extraCents, 0));
  });

  it("desembolso mensal total = prestação + extra", () => {
    const run = runContract(contract(), { ...NO_EXTRAS, monthlyCents: 500_00 }, "prazo");
    const first = run.rows[0]!;
    expect(first.paymentCents + first.extraCents).toBe(run.firstPaymentCents + 500_00);
  });

  it("aporte anual cai só nas parcelas de dezembro", () => {
    const input = contract({ firstDueIso: "2026-10-10" });
    const run = runContract(input, { ...NO_EXTRAS, annual: { cents: 10_000_00, month: 12 } }, "prazo");
    const withExtra = run.rows.filter((r) => r.extraCents > 0);
    expect(withExtra.length).toBeGreaterThan(0);
    for (const r of withExtra.slice(0, -1)) {
      expect(r.dueIso.slice(5, 7)).toBe("12");
      expect(r.extraCents).toBe(10_000_00);
    }
    expect(withExtra[0]!.dueIso).toBe("2026-12-10");
    checkInvariants(input, run);
  });

  it("vários aportes personalizados em ordem cronológica, somados no mesmo mês e ignorados fora do prazo", () => {
    const input = contract({ remainingMonths: 60, balanceCents: 60_000_00 });
    const run = runContract(
      input,
      {
        ...NO_EXTRAS,
        custom: [
          { month: "2027-12", cents: 5_000_00 },
          { month: "2026-12", cents: 3_000_00 },
          { month: "2026-12", cents: 1_000_00 },
          { month: "2019-01", cents: 1_000_00 },
          { month: "2090-01", cents: 1_000_00 },
        ],
      },
      "prazo",
    );
    expect(run.ignoredCustom).toBe(2);
    expect(run.rows.find((r) => r.dueIso.startsWith("2026-12"))!.extraCents).toBe(4_000_00);
    expect(run.rows.find((r) => r.dueIso.startsWith("2027-12"))!.extraCents).toBe(5_000_00);
    checkInvariants(input, run);
  });

  it("extras que passariam do saldo são limitados e o excesso é informado", () => {
    const input = contract({ remainingMonths: 12, balanceCents: 10_000_00 });
    const run = runContract(input, { ...NO_EXTRAS, monthlyCents: 5_000_00 }, "prazo");
    expect(run.unusedExtrasCents).toBeGreaterThan(0);
    expect(run.customAfterEnd).toBe(0);
    checkInvariants(input, run);
    // Aporte marcado para depois da quitação (mas dentro do prazo original) não entra.
    const late = runContract(input, { ...NO_EXTRAS, monthlyCents: 5_000_00, custom: [{ month: "2027-08", cents: 1_000_00 }] }, "prazo");
    expect(late.customAfterEnd).toBe(1);
    expect(late.ignoredCustom).toBe(0);
    checkInvariants(input, late);
  });

  it("reduzir prestação com extra mensal: prestações caindo; no fim, o extra fixo zera o saldo um pouco antes", () => {
    const input = contract();
    const run = runContract(input, { ...NO_EXTRAS, monthlyCents: 500_00 }, "prestacao");
    const base = runContract(input, NO_EXTRAS, "prazo");
    expect(run.months).toBeLessThanOrEqual(base.months);
    expect(run.months).toBeGreaterThan(base.months - 12);
    expect(run.rows[100]!.paymentCents).toBeLessThan(base.rows[100]!.paymentCents);
    checkInvariants(input, run);
  });
});

describe("datas", () => {
  it("próxima parcela em 31/01 não quebra o calendário", () => {
    expect(dueDate("2027-01-31", 1)).toBe("2027-01-31");
    expect(dueDate("2027-01-31", 2)).toBe("2027-02-28");
    expect(dueDate("2027-01-31", 3)).toBe("2027-03-31");
    expect(dueDate("2028-01-31", 2)).toBe("2028-02-29");
    expect(dueDate("2027-01-31", 13)).toBe("2028-01-31");
  });

  it("data civil não depende de fuso", () => {
    const run = runContract(contract({ firstDueIso: "2026-10-01", remainingMonths: 3, balanceCents: 3_000_00 }), NO_EXTRAS, "prazo");
    expect(run.rows.map((r) => r.dueIso)).toEqual(["2026-10-01", "2026-11-01", "2026-12-01"]);
    expect(monthYearLong("2046-09-01")).toBe("setembro de 2046");
    expect(monthYearShort("2046-09-01")).toBe("set/2046");
  });

  it("parcelas até um mês-alvo", () => {
    expect(installmentsUntil(contract({ firstDueIso: "2026-10-10" }), "2026-12")).toBe(3);
    expect(installmentsUntil(contract({ firstDueIso: "2026-10-10" }), "2026-09")).toBe(0);
  });
});

describe("sensibilidade e retorno marginal", () => {
  it("degraus adaptados ao saldo, até 25% dele", () => {
    expect(lumpLadder(284_000_00)).toEqual([5_000_00, 10_000_00, 20_000_00, 50_000_00]);
    expect(lumpLadder(30_000_00)).toEqual([500_00, 1_000_00, 2_000_00, 5_000_00]);
    expect(lumpLadder(1_000_000_00)).toEqual([20_000_00, 50_000_00, 100_000_00, 200_000_00]);
  });

  it("mais aporte elimina mais meses; marginais somam o total", () => {
    const rows = sensitivity(contract(), lumpLadder(284_000_00));
    let months = 0;
    let interest = 0;
    for (const r of rows) {
      expect(r.monthsSaved).toBeGreaterThanOrEqual(months);
      months += r.marginalMonths;
      interest += r.marginalInterestCents;
      expect(months).toBe(r.monthsSaved);
      expect(interest).toBe(r.interestAvoidedCents);
    }
  });
});

describe("metas reversas", () => {
  const input = contract();
  const base = runContract(input, NO_EXTRAS, "prazo");

  it("quanto amortizar hoje para terminar 5 anos antes (valor mínimo em reais)", () => {
    const g = lumpForMonthsEarlier(input, 60);
    if (g.kind !== "valor") throw new Error(g.kind);
    expect(g.cents % 100).toBe(0);
    expect(g.run.months).toBeLessThanOrEqual(base.months - 60);
    expect(runContract(input, lump(g.cents - 100), "prazo").months).toBeGreaterThan(base.months - 60);
  });

  it("terminar até um mês-alvo", () => {
    const g = lumpForEndMonth(input, "2040-12");
    if (g.kind !== "valor") throw new Error(g.kind);
    expect(g.run.lastDueIso! <= "2040-12-31").toBe(true);
  });

  it("quanto amortizar para a prestação cair a um valor", () => {
    const target = base.firstPaymentCents - 500_00;
    const g = lumpForPayment(input, target);
    if (g.kind !== "valor") throw new Error(g.kind);
    expect(g.run.firstPaymentCents).toBeLessThanOrEqual(target);
    expect(runContract(input, lump(g.cents - 100), "prestacao").firstPaymentCents).toBeGreaterThan(target);
    expect(lumpForPayment(input, base.firstPaymentCents + 1)).toEqual({ kind: "ja-atende" });
  });

  it("quanto pagar a mais por mês para terminar 5 anos antes", () => {
    const g = monthlyForMonthsEarlier(input, 60);
    if (g.kind !== "valor") throw new Error(g.kind);
    expect(g.run.months).toBeLessThanOrEqual(base.months - 60);
    expect(runContract(input, { ...NO_EXTRAS, monthlyCents: g.cents - 100 }, "prazo").months).toBeGreaterThan(base.months - 60);
  });

  it("metas que exigem quitar hoje ou já atendidas", () => {
    expect(lumpForMonthsEarlier(input, 0)).toEqual({ kind: "ja-atende" });
    expect(lumpForMonthsEarlier(input, 278)).toEqual({ kind: "quitacao", cents: input.balanceCents });
    expect(monthlyForMonthsEarlier(input, 278)).toEqual({ kind: "precisa-aporte" });
  });
});

describe("marcos e prestação informada", () => {
  it("data em que o saldo cai pela metade chega antes com aporte", () => {
    const input = contract();
    const base = runContract(input, NO_EXTRAS, "prazo");
    const run = runContract(input, { ...NO_EXTRAS, monthlyCents: 500_00 }, "prazo");
    const half = input.balanceCents / 2;
    expect(dateBalanceBelow(run, half)! < dateBalanceBelow(base, half)!).toBe(true);
    expect(balanceSeries(input, run).slice(0, 2)).toEqual([284_000_00, 284_000_00]);
  });

  it("prestação informada com seguro fica acima da calculada", () => {
    expect(checkInformedPayment(3_100_00, 2_900_00)).toBe("informada-maior");
    expect(checkInformedPayment(2_910_00, 2_900_00)).toBe("proxima");
    expect(checkInformedPayment(2_500_00, 2_900_00)).toBe("informada-menor");
  });
});
