import { describe, expect, it } from "vitest";
import {
  computeBudgetImpact,
  type BudgetInput,
} from "@/lib/calculators/budget-impact";

function input(partial: Partial<BudgetInput> = {}): BudgetInput {
  return {
    monthlyNetIncomeCents: 600_000,
    recurringExpensesCents: 320_000,
    existingDebtPaymentsCents: 90_000,
    monthlyProvisionsCents: 0,
    desiredBufferCents: null,
    newInstallmentCents: 75_000,
    incomeVaries: false,
    ...partial,
  };
}

describe("casos obrigatórios", () => {
  it("caso A: orçamento com folga (6000/3200/900, reserva 500, parcela 750)", () => {
    const r = computeBudgetImpact(input({ desiredBufferCents: 50_000 }));
    expect(r.freeCashBeforeCents).toBe(190_000);
    expect(r.freeCashAfterCents).toBe(115_000);
    expect(r.freeCashAfterBufferCents).toBe(65_000);
    expect(r.installmentIncomeRatio).toBeCloseTo(12.5, 5);
    expect(r.installmentFreeCashRatio).toBeCloseTo(39.47, 1);
    expect(r.monthlyDeficitCents).toBe(0);
    expect(r.sentences.join(" ")).toContain("reduziria sua folga mensal de R$ 1.900,00 para R$ 1.150,00");
  });

  it("caso B: parcela consome toda a folga (5000/3500/500, parcela 1000)", () => {
    const r = computeBudgetImpact(
      input({
        monthlyNetIncomeCents: 500_000,
        recurringExpensesCents: 350_000,
        existingDebtPaymentsCents: 50_000,
        newInstallmentCents: 100_000,
      }),
    );
    expect(r.freeCashAfterCents).toBe(0);
    expect(r.warnings).toContain("consumes-all-free-cash");
    expect(r.sentences.join(" ")).toContain("consumiria toda a folga informada");
    expect(r.sentences.join(" ")).toContain("não significa automaticamente inadimplência");
  });

  it("caso C: nova parcela deixa o orçamento negativo (folga 500, parcela 700)", () => {
    const r = computeBudgetImpact(
      input({
        monthlyNetIncomeCents: 500_000,
        recurringExpensesCents: 400_000,
        existingDebtPaymentsCents: 50_000,
        newInstallmentCents: 70_000,
      }),
    );
    expect(r.freeCashBeforeCents).toBe(50_000);
    expect(r.monthlyDeficitCents).toBe(20_000);
    expect(r.warnings).toContain("installment-exceeds-free-cash");
    expect(r.sentences.join(" ")).toContain("ultrapassaria a folga mensal informada em aproximadamente R$ 200,00");
  });

  it("caso D: orçamento já negativo antes da parcela — factual, sem julgamento", () => {
    const r = computeBudgetImpact(
      input({
        monthlyNetIncomeCents: 500_000,
        recurringExpensesCents: 480_000,
        existingDebtPaymentsCents: 60_000,
        newInstallmentCents: 30_000,
      }),
    );
    expect(r.freeCashBeforeCents).toBe(-40_000);
    expect(r.warnings).toContain("already-negative");
    const text = r.sentences.join(" ");
    expect(text).toContain("já está negativo em aproximadamente R$ 400,00 antes da nova parcela");
    expect(text).toContain("aumentaria esse déficit");
    expect(text).not.toMatch(/falido|culpa|irrespons/i);
  });

  it("caso E: sem outras dívidas funciona", () => {
    const r = computeBudgetImpact(input({ existingDebtPaymentsCents: 0 }));
    expect(r.freeCashBeforeCents).toBe(280_000);
    expect(r.totalDebtIncomeRatio).toBeCloseTo(12.5, 5);
  });

  it("caso F: sem reserva definida funciona", () => {
    const r = computeBudgetImpact(input({ desiredBufferCents: null }));
    expect(r.freeCashAfterBufferCents).toBeNull();
  });

  it("caso G: renda variável gera aviso contextual", () => {
    const r = computeBudgetImpact(input({ incomeVaries: true }));
    expect(r.warnings).toContain("income-varies");
    expect(r.sentences.join(" ")).toContain("mês mais fraco");
  });

  it("caso I: renda zero — sem divisão, com explicação", () => {
    const r = computeBudgetImpact(input({ monthlyNetIncomeCents: 0 }));
    expect(r.installmentIncomeRatio).toBeNull();
    expect(r.totalDebtIncomeRatio).toBeNull();
    expect(r.warnings).toContain("income-zero");
    expect(r.sentences.join(" ")).toContain("Sem renda mensal informada");
  });

  it("caso J: parcela zero — resultado neutro", () => {
    const r = computeBudgetImpact(input({ newInstallmentCents: 0 }));
    expect(r.freeCashAfterCents).toBe(r.freeCashBeforeCents);
    expect(r.sentences.join(" ")).toContain("Sem nova parcela");
  });

  it("caso K: centavos exatos", () => {
    const r = computeBudgetImpact(
      input({
        monthlyNetIncomeCents: 512_345,
        recurringExpensesCents: 300_017,
        existingDebtPaymentsCents: 10_003,
        newInstallmentCents: 7_777,
      }),
    );
    expect(r.freeCashBeforeCents).toBe(202_325);
    expect(r.freeCashAfterCents).toBe(194_548);
  });

  it("caso L: reserva maior que a folga restante — mostrada, não bloqueada", () => {
    const r = computeBudgetImpact(input({ desiredBufferCents: 200_000 }));
    // folga após parcela = 1150; reserva 2000 → -850
    expect(r.freeCashAfterBufferCents).toBe(-85_000);
    expect(r.warnings).toContain("buffer-not-preserved");
    expect(r.sentences.join(" ")).toContain("R$ 850,00 a menos do que a margem de R$ 2.000,00");
  });

  it("caso M: parcela excede a folga — valor exato exibido", () => {
    const r = computeBudgetImpact(input({ newInstallmentCents: 250_000 }));
    expect(r.monthlyDeficitCents).toBe(60_000);
  });

  it("caso N: comprometimento total alto — percentual mostrado sem rótulo de perigo", () => {
    const r = computeBudgetImpact(
      input({ existingDebtPaymentsCents: 200_000, newInstallmentCents: 100_000 }),
    );
    expect(r.totalDebtIncomeRatio).toBeCloseTo(50, 5);
    expect(r.sentences.join(" ")).not.toMatch(/perigoso|arriscado|impossível/i);
  });

  it("provisão mensal entra na folga", () => {
    const r = computeBudgetImpact(input({ monthlyProvisionsCents: 40_000 }));
    expect(r.freeCashBeforeCents).toBe(150_000);
  });
});

describe("teste do usuário leigo (5000 / 4000 / 600)", () => {
  const r = computeBudgetImpact(
    input({
      monthlyNetIncomeCents: 500_000,
      recurringExpensesCents: 340_000,
      existingDebtPaymentsCents: 60_000,
      newInstallmentCents: 60_000,
    }),
  );

  it("quanto sobra hoje? R$ 1.000", () => {
    expect(r.freeCashBeforeCents).toBe(100_000);
  });

  it("quanto sobra depois? R$ 400", () => {
    expect(r.freeCashAfterCents).toBe(40_000);
  });

  it("a lição central: 12% da renda, mas 60% da folga", () => {
    expect(r.installmentIncomeRatio).toBeCloseTo(12, 5);
    expect(r.installmentFreeCashRatio).toBeCloseTo(60, 5);
    expect(r.sentences.join(" ")).toContain("Pela renda, a parcela representa 12,0%. Pela folga informada, ela consome 60,0%.");
  });
});

describe("nunca produz veredito nem regra dos 30%", () => {
  it("cenários variados sem linguagem proibida", () => {
    const scenarios = [
      computeBudgetImpact(input()),
      computeBudgetImpact(input({ newInstallmentCents: 250_000 })),
      computeBudgetImpact(input({ newInstallmentCents: 10_000 })),
    ];
    for (const r of scenarios) {
      const text = r.sentences.join(" ");
      expect(text).not.toMatch(
        /você pode pagar|parcela (é )?segura|pode contratar|aprovada|limite ideal|30% da renda|cabe no seu bolso|deve comprometer/i,
      );
    }
  });
});
