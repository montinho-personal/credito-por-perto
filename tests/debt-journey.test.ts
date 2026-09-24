import { describe, expect, it } from "vitest";
import {
  buildJourneySummary,
  compareJourneys,
  marginalEffect,
  monthDate,
  monthLabel,
  monthlyRateOf,
  resolveModel,
  simulateJourney,
  validateDebt,
  withLumpSum,
  withMonthlyExtra,
  type JourneyDebt,
  type JourneyInput,
  type JourneyResult,
} from "@/lib/simulators/debt-journey";
import { pricePayment } from "@/lib/calculators/loan";

const debt = (over: Partial<JourneyDebt> = {}): JourneyDebt => ({
  id: over.id ?? "d1",
  label: over.label ?? "Dívida",
  type: "emprestimo",
  balanceCents: 1_000_000,
  ratePercent: 2,
  rateUnit: "am",
  paymentCents: 100_000,
  remainingPayments: null,
  system: "nao-sei",
  recurringFeesCents: 0,
  ...over,
});

const input = (over: Partial<JourneyInput> = {}): JourneyInput => ({
  debts: [debt()],
  keepBudget: true,
  strategy: "maior-taxa",
  monthlyExtraCents: 0,
  lumpSum: null,
  startIso: "2026-09-24",
  ...over,
});

function run(i: JourneyInput): JourneyResult {
  const o = simulateJourney(i);
  if (o.kind !== "ok") throw new Error(JSON.stringify(o.issues));
  return o.result;
}

/*
 * Referências independentes (Python, decimal de 50 dígitos), com a mesma
 * ordem de eventos: juros do mês sobre o saldo, depois o pagamento.
 */

describe("uma dívida: casos de borda do briefing", () => {
  it("taxa zero: R$ 10.000 pagando R$ 1.000 terminam em 10 meses", () => {
    const r = run(input({ debts: [debt({ ratePercent: 0 })] }));
    expect(r.months).toBe(10);
    expect(r.totalPaidCents).toBe(1_000_000);
    expect(r.costKnownCents).toBe(0);
  });

  it("pagamento maior que o saldo: quita no 1º mês, sem pagar além do saldo + encargos", () => {
    const r = run(input({ debts: [debt({ balanceCents: 50_000, paymentCents: 100_000, ratePercent: 2 })] }));
    expect(r.months).toBe(1);
    // 500 × 1,02 = 510: é o que sai do bolso, não os 1.000 informados.
    expect(r.totalPaidCents).toBe(51_000);
    expect(r.costKnownCents).toBe(1_000);
  });

  it("pagamento igual aos juros: o saldo não diminui e o motor avisa", () => {
    // 10.000 × 2% = 200 = pagamento.
    const r = run(input({ debts: [debt({ paymentCents: 20_000 })] }));
    expect(r.months).toBeNull();
    expect(r.reachedHorizon).toBe(true);
    expect(r.warnings).toContain("nao-amortiza");
    expect(r.debts[0]!.warnings).toContain("nao-amortiza");
  });

  it("pagamento menor que os juros: o saldo cresce e o motor avisa", () => {
    const r = run(input({ debts: [debt({ paymentCents: 10_000 })] }));
    expect(r.warnings).toContain("nao-amortiza");
    expect(r.warnings).toContain("saldo-cresce");
    expect(r.balanceSeries[11]!).toBeGreaterThan(r.initialCents);
    expect(r.balanceSeries.length).toBeLessThanOrEqual(1_200);
  });

  it("referência: R$ 10.000 a 2% a.m. pagando R$ 1.000 → 12 meses, juros R$ 1.270,32", () => {
    // Python (decimal): juros do mês arredondados ao centavo, depois o pagamento; o
    // 12º mês paga só o que resta. Juros somados: R$ 1.270,32.
    const r = run(input());
    expect(r.months).toBe(12);
    expect(r.costKnownCents).toBe(127_032);
    expect(r.totalPaidCents).toBe(1_127_032);
    expect(r.debts[0]!.history[0]).toMatchObject({ openingCents: 1_000_000, interestCents: 20_000, paidCents: 100_000, closingCents: 920_000 });
  });

  it("parcela fixa com taxa e prazo bate com a Price", () => {
    const n = 24;
    const pmt = Math.round(pricePayment(2_000_000, 0.015, n));
    const r = run(input({ debts: [debt({ balanceCents: 2_000_000, ratePercent: 1.5, paymentCents: pmt })] }));
    expect(r.months).toBe(n);
    // Sem parcela informada, o motor calcula a da Price a partir do prazo.
    const r2 = run(input({ debts: [debt({ balanceCents: 2_000_000, ratePercent: 1.5, paymentCents: null, remainingPayments: n })] }));
    expect(r2.monthlyPaymentCents).toBe(pmt);
    expect(r2.months).toBe(n);
  });

  it("SAC: amortização constante, parcela cai e o prazo fecha", () => {
    const r = run(input({ debts: [debt({ balanceCents: 1_200_000, ratePercent: 1, system: "sac", remainingPayments: 12, paymentCents: null })] }));
    expect(r.months).toBe(12);
    const h = r.debts[0]!.history;
    expect(h[0]!.paidCents).toBe(100_000 + 12_000);
    expect(h[11]!.paidCents).toBeLessThan(h[0]!.paidCents);
    expect(h.every((row) => row.amortizedCents === 100_000 || row.month === 12)).toBe(true);
  });

  it("tarifa dentro da parcela sai do bolso e não amortiza", () => {
    const r = run(input({ debts: [debt({ ratePercent: 0, paymentCents: 110_000, recurringFeesCents: 10_000 })] }));
    expect(r.months).toBe(10);
    expect(r.totalPaidCents).toBe(1_100_000);
    expect(r.costKnownCents).toBe(100_000);
  });

  it("cronograma sem taxa: desembolso e data conhecidos, custo não calculado, extra não aplicado", () => {
    const r = run(input({ debts: [debt({ type: "acordo", balanceCents: null, ratePercent: null, paymentCents: 50_000, remainingPayments: 8 })], monthlyExtraCents: 100_000 }));
    expect(r.months).toBe(8);
    expect(r.totalPaidCents).toBe(400_000);
    expect(r.costUnknownDebtIds).toEqual(["d1"]);
    expect(r.debts[0]!.costKnown).toBe(false);
    expect(r.debts[0]!.warnings).toContain("extra-nao-aplicado");
  });

  it("rotativo não entra na rota: fica excluído com aviso", () => {
    const o = simulateJourney(input({ debts: [debt({ type: "cartao-rotativo" }), debt({ id: "d2" })] }));
    expect(o.kind).toBe("ok");
    if (o.kind !== "ok") return;
    expect(o.result.excludedDebtIds).toEqual(["d1"]);
    expect(o.result.warnings).toContain("rotativo-excluido");
    expect(o.result.debts.map((d) => d.id)).toEqual(["d2"]);
    // Só rotativo: nada para simular.
    expect(simulateJourney(input({ debts: [debt({ type: "cartao-rotativo" })] })).kind).toBe("invalid");
  });
});

describe("várias dívidas", () => {
  const two = () => [
    debt({ id: "a", label: "Cartão parcelado", type: "cartao-parcelado", balanceCents: 300_000, ratePercent: 8, paymentCents: 60_000 }),
    debt({ id: "b", label: "Empréstimo", balanceCents: 1_000_000, ratePercent: 2, paymentCents: 100_000 }),
  ];

  it("quando uma termina, o pagamento dela vai para a próxima (manter orçamento)", () => {
    const keep = run(input({ debts: two(), keepBudget: true }));
    const release = run(input({ debts: two(), keepBudget: false }));
    const aKeep = keep.debts.find((d) => d.id === "a")!;
    expect(aKeep.payoffMonth).not.toBeNull();
    // Depois que "a" zera, "b" recebe mais que os R$ 1.000 obrigatórios.
    const after = keep.debts.find((d) => d.id === "b")!.history[aKeep.payoffMonth!]!;
    expect(after.paidCents).toBeGreaterThan(100_000);
    expect(keep.months!).toBeLessThan(release.months!);
    expect(keep.costKnownCents).toBeLessThan(release.costKnownCents);
    // Sem redirecionar, "b" segue só com a própria parcela.
    const afterRelease = release.debts.find((d) => d.id === "b")!.history[aKeep.payoffMonth!]!;
    expect(afterRelease.paidCents).toBe(100_000);
    expect(release.releases[0]).toMatchObject({ debtId: "a", cents: 60_000, redirected: false });
    expect(keep.releases[0]!.redirected).toBe(true);
  });

  it("a sobra da parcela no mês em que uma dívida zera não se perde", () => {
    const debts = [debt({ id: "a", balanceCents: 30_000, ratePercent: 0, paymentCents: 100_000 }), debt({ id: "b", balanceCents: 500_000, ratePercent: 0, paymentCents: 50_000 })];
    const r = run(input({ debts, keepBudget: true }));
    // Mês 1: "a" leva 300 dos 1.000; os 700 restantes vão para "b" (500 obrigatório + 700).
    expect(r.debts.find((d) => d.id === "b")!.history[0]!.paidCents).toBe(120_000);
    expect(r.months).toBe(4);
  });

  it("cinco dívidas: ordem de quitação e pagamentos determinísticos", () => {
    const debts = [1, 2, 3, 4, 5].map((k) => debt({ id: `d${k}`, balanceCents: 100_000 * k, ratePercent: k, paymentCents: 20_000 * k }));
    const a = run(input({ debts, strategy: "maior-taxa", monthlyExtraCents: 50_000 }));
    const b = run(input({ debts, strategy: "maior-taxa", monthlyExtraCents: 50_000 }));
    expect(a).toEqual(b);
    expect(a.payoffOrder.length).toBe(5);
    expect(new Set(a.payoffOrder).size).toBe(5);
    expect(a.months).not.toBeNull();
  });

  it("maior taxa primeiro: o extra vai à dívida mais cara; menor saldo: à menor", () => {
    const debts = [debt({ id: "cara", balanceCents: 800_000, ratePercent: 6, paymentCents: 80_000 }), debt({ id: "pequena", balanceCents: 200_000, ratePercent: 1, paymentCents: 30_000 })];
    const taxa = run(input({ debts, strategy: "maior-taxa", monthlyExtraCents: 30_000 }));
    const saldo = run(input({ debts, strategy: "menor-saldo", monthlyExtraCents: 30_000 }));
    expect(taxa.debts.find((d) => d.id === "cara")!.history[0]!.paidCents).toBe(110_000);
    expect(saldo.debts.find((d) => d.id === "pequena")!.history[0]!.paidCents).toBe(60_000);
    expect(saldo.payoffOrder[0]).toBe("pequena");
    expect(taxa.costKnownCents).toBeLessThanOrEqual(saldo.costKnownCents);
  });

  it("empate: maior taxa → menor saldo → cadastro; menor saldo → maior taxa → cadastro", () => {
    const debts = [debt({ id: "x", balanceCents: 500_000, ratePercent: 3, paymentCents: 60_000 }), debt({ id: "y", balanceCents: 400_000, ratePercent: 3, paymentCents: 60_000 })];
    const t = run(input({ debts, strategy: "maior-taxa", monthlyExtraCents: 10_000 }));
    expect(t.debts.find((d) => d.id === "y")!.history[0]!.paidCents).toBe(70_000);
    const debts2 = [debt({ id: "p", balanceCents: 400_000, ratePercent: 2, paymentCents: 60_000 }), debt({ id: "q", balanceCents: 400_000, ratePercent: 5, paymentCents: 60_000 })];
    const s = run(input({ debts: debts2, strategy: "menor-saldo", monthlyExtraCents: 10_000 }));
    expect(s.debts.find((d) => d.id === "q")!.history[0]!.paidCents).toBe(70_000);
  });

  it("ordem manual é respeitada", () => {
    const debts = two();
    const r = run(input({ debts, strategy: "manual", manualOrder: ["b", "a"], monthlyExtraCents: 20_000 }));
    expect(r.debts.find((d) => d.id === "b")!.history[0]!.paidCents).toBe(120_000);
  });
});

describe("cenários", () => {
  it("extra zero iguala o base; extra negativo é recusado", () => {
    const base = run(input());
    expect(run(withMonthlyExtra(input(), 0))).toEqual(base);
    expect(simulateJourney(input({ monthlyExtraCents: -1 })).kind).toBe("invalid");
  });

  it("+R$ 300/mês termina antes e custa menos; a comparação mede os dois", () => {
    const base = run(input());
    const alt = run(withMonthlyExtra(input(), 30_000));
    const c = compareJourneys(base, alt);
    expect(c.monthsSaved!).toBeGreaterThan(0);
    expect(c.costSavedCents).toBeGreaterThan(0);
    expect(alt.months!).toBe(base.months! - c.monthsSaved!);
  });

  it("o cenário não altera o base (snapshot)", () => {
    const i = input();
    withMonthlyExtra(i, 50_000);
    withLumpSum(i, { cents: 100_000, month: 2, target: "estrategia" });
    expect(i.monthlyExtraCents).toBe(0);
    expect(i.lumpSum).toBeNull();
  });

  it("aporte único no mês escolhido, dirigido a uma dívida", () => {
    const debts = [debt({ id: "a", balanceCents: 300_000, ratePercent: 3, paymentCents: 50_000 }), debt({ id: "b", balanceCents: 500_000, ratePercent: 1, paymentCents: 50_000 })];
    const r = run(withLumpSum(input({ debts }), { cents: 200_000, month: 3, target: "b" }));
    const b = r.debts.find((d) => d.id === "b")!;
    expect(b.history[2]!.paidCents).toBe(250_000);
    expect(b.history[1]!.paidCents).toBe(50_000);
  });

  it("aporte maior que toda a dívida quita tudo e informa o excedente", () => {
    const r = run(withLumpSum(input({ debts: [debt({ balanceCents: 100_000, ratePercent: 1, paymentCents: 20_000 })] }), { cents: 500_000, month: 1, target: "estrategia" }));
    expect(r.months).toBe(1);
    // 1.000 × 1,01 = 1.010; 200 obrigatórios + 810 do aporte; sobram 4.190.
    expect(r.totalPaidCents).toBe(101_000);
    expect(r.unusedLumpCents).toBe(419_000);
  });

  it("efeito marginal de R$ 100/mês", () => {
    const m = marginalEffect(input());
    expect(m).not.toBeNull();
    expect(m!.monthsSaved).toBeGreaterThanOrEqual(1);
    expect(m!.costSavedCents).toBeGreaterThan(0);
    expect(marginalEffect(input({ debts: [debt({ paymentCents: 20_000 })] }))).toBeNull();
  });
});

describe("marcos, datas e liberação de renda", () => {
  it("datas: mês 1 é o mês seguinte a hoje, sem fuso", () => {
    expect(monthDate("2026-09-24", 1)).toBe("2026-10-01");
    expect(monthDate("2026-12-31", 2)).toBe("2027-02-01");
    expect(monthLabel("2029-09-01")).toBe("setembro de 2029");
  });

  it("marcos saem da série real: primeira quitada, metade, última, zero", () => {
    const debts = [debt({ id: "a", balanceCents: 200_000, ratePercent: 2, paymentCents: 50_000 }), debt({ id: "b", balanceCents: 800_000, ratePercent: 2, paymentCents: 80_000 })];
    const r = run(input({ debts }));
    const kinds = r.milestones.map((m) => m.kind);
    expect(kinds).toEqual(["primeira-quitada", "metade", "tres-quartos", "ultima-quitada", "saldo-zero"]);
    const first = r.milestones[0]!;
    expect(first.debtId).toBe("a");
    expect(first.month).toBe(r.debts.find((d) => d.id === "a")!.payoffMonth);
    const half = r.milestones.find((m) => m.kind === "metade")!;
    expect(half.remainingCents).toBeLessThanOrEqual(r.initialCents / 2);
    expect(r.balanceSeries[half.month - 2]!).toBeGreaterThan(r.initialCents / 2);
    expect(r.milestones.at(-1)!.month).toBe(r.months);
    expect(r.endDateIso).toBe(monthDate("2026-09-24", r.months!));
  });

  it("renda liberada aos poucos quando o orçamento não é mantido", () => {
    const debts = [debt({ id: "a", balanceCents: 100_000, ratePercent: 0, paymentCents: 50_000 }), debt({ id: "b", balanceCents: 600_000, ratePercent: 0, paymentCents: 100_000 })];
    const r = run(input({ debts, keepBudget: false }));
    expect(r.releases.map((x) => [x.debtId, x.month, x.cents])).toEqual([
      ["a", 2, 50_000],
      ["b", 6, 100_000],
    ]);
  });

  it("resumo anual fecha com a série", () => {
    const r = run(input({ debts: [debt({ balanceCents: 3_000_000, ratePercent: 1.5, paymentCents: 100_000 })] }));
    expect(r.years.length).toBe(Math.ceil(r.months! / 12));
    expect(r.years[0]!.openingCents).toBe(r.initialCents);
    expect(r.years.at(-1)!.closingCents).toBe(0);
    const paid = r.years.reduce((s, y) => s + y.paidCents, 0);
    expect(paid).toBe(r.totalPaidCents);
    expect(r.years.reduce((s, y) => s + y.costCents, 0)).toBe(r.costKnownCents);
  });
});

describe("validação e robustez", () => {
  it("modelo por dívida", () => {
    expect(resolveModel(debt())).toBe("juros-sobre-saldo");
    expect(resolveModel(debt({ type: "cartao-rotativo" }))).toBe("rotativo");
    expect(resolveModel(debt({ ratePercent: null, remainingPayments: 6 }))).toBe("cronograma");
    expect(resolveModel(debt({ ratePercent: null }))).toBe("invalida");
    expect(resolveModel(debt({ system: "sac", remainingPayments: 10 }))).toBe("sac");
    expect(resolveModel(debt({ system: "sac" }))).toBe("invalida");
  });

  it("taxa anual vira mensal por equivalência", () => {
    expect(monthlyRateOf({ ratePercent: 12.682503013196972, rateUnit: "aa" })!).toBeCloseTo(0.01, 12);
    expect(monthlyRateOf({ ratePercent: null, rateUnit: "am" })).toBeNull();
  });

  it("taxa extrema avisa sem bloquear; fora do limite bloqueia; negativa bloqueia", () => {
    expect(validateDebt(debt({ ratePercent: 50 })).map((i) => [i.code, i.blocking])).toEqual([["taxa-extrema", false]]);
    expect(validateDebt(debt({ ratePercent: 5_000 }))[0]!.blocking).toBe(true);
    expect(validateDebt(debt({ ratePercent: -1 }))[0]!.code).toBe("taxa-negativa");
    expect(validateDebt(debt({ ratePercent: null }))[0]!.code).toBe("dados-insuficientes");
    expect(validateDebt(debt({ paymentCents: 100_000, recurringFeesCents: 100_000 }))[0]!.code).toBe("tarifa");
  });

  it("nunca NaN, Infinity ou saldo negativo", () => {
    for (const rate of [0, 0.5, 3, 12, 35, 300]) {
      for (const payment of [1, 100_00, 999_00, 50_000_00]) {
        const r = run(input({ debts: [debt({ balanceCents: 1_234_567, ratePercent: rate, paymentCents: payment })], monthlyExtraCents: 12_345 }));
        for (const v of [r.totalPaidCents, r.costKnownCents, r.initialCents, ...r.balanceSeries]) {
          expect(Number.isFinite(v)).toBe(true);
          expect(v).toBeGreaterThanOrEqual(0);
        }
        for (const row of r.debts[0]!.history) expect(row.closingCents).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("resumo para copiar não leva apelido de credor e diz que é estimativa", () => {
    const base = run(input({ debts: [debt({ label: "Banco Tal" })] }));
    const alt = run(withMonthlyExtra(input({ debts: [debt({ label: "Banco Tal" })] }), 30_000));
    const text = buildJourneySummary(base, compareJourneys(base, alt)).replace(/ /g, " ");
    expect(text).not.toContain("Banco Tal");
    expect(text).toContain("Dívida total atual: R$ 10.000,00");
    expect(text).toContain("Cenário com +R$ 300,00/mês");
    expect(text).toContain("Simulação educativa");
  });
});
