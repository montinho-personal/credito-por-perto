import { describe, expect, it } from "vitest";
import {
  annualToMonthlyEffective,
  buildPlainSummary,
  compareDebtSwitch,
  type CurrentDebtInput,
  type NewOfferInput,
} from "@/lib/calculators/debt-switch";

function current(partial: Partial<CurrentDebtInput> = {}): CurrentDebtInput {
  return {
    payoffBalanceCents: 800_000,
    installmentCents: 80_000,
    remainingInstallments: 12,
    fixedInstallments: "yes",
    officialFutureTotalCents: null,
    rate: null,
    cetAnnualPercent: null,
    modality: "pessoal",
    ...partial,
  };
}

function offer(partial: Partial<NewOfferInput> = {}): NewOfferInput {
  return {
    amountCents: 800_000,
    installmentCents: 50_000,
    installments: 18,
    rate: null,
    cetAnnualPercent: null,
    externalCostsCents: null,
    cashOut: "no",
    cashOutCents: null,
    upfrontPaymentAsked: false,
    newGuarantee: "no",
    ...partial,
  };
}

describe("casos matemáticos obrigatórios", () => {
  it("caso A: nova dívida mais barata (800×12 → 500×18)", () => {
    const r = compareDebtSwitch(current(), offer());
    expect(r.monthlyDiffCents).toBe(-30_000);
    expect(r.termDiffMonths).toBe(6);
    expect(r.currentFutureTotalCents).toBe(960_000);
    expect(r.newTotalCents).toBe(900_000);
    expect(r.totalDiffCents).toBe(-60_000);
  });

  it("caso B: parcela menor, total maior (800×12 → 400×30)", () => {
    const r = compareDebtSwitch(current(), offer({ installmentCents: 40_000, installments: 30 }));
    expect(r.monthlyDiffCents).toBe(-40_000);
    expect(r.termDiffMonths).toBe(18);
    expect(r.totalDiffCents).toBe(240_000);
    expect(r.sentences.join(" ")).toContain("Menos por mês, mais meses pagando");
    const plain = buildPlainSummary(r)!;
    expect(plain).toContain("R$ 400,00 de folga por mês");
    expect(plain).toContain("mais 18 meses");
    expect(plain).toContain("R$ 2.400,00 a mais");
  });

  it("caso C: parcela maior, dívida termina antes", () => {
    const r = compareDebtSwitch(current(), offer({ installmentCents: 90_000, installments: 10 }));
    expect(r.monthlyDiffCents).toBe(10_000);
    expect(r.termDiffMonths).toBe(-2);
    expect(r.totalDiffCents).toBe(-60_000);
    const plain = buildPlainSummary(r)!;
    expect(plain).toContain("R$ 100,00 a mais por mês");
    expect(plain).toContain("2 meses antes");
  });

  it("caso D: saldo de quitação menor que soma das parcelas — mostrados separados", () => {
    const r = compareDebtSwitch(
      current({ payoffBalanceCents: 843_000, installmentCents: 100_000, remainingInstallments: 10 }),
      offer(),
    );
    expect(r.currentFutureTotalCents).toBe(1_000_000);
    expect(r.payoffVsFutureCents).toBe(157_000);
  });

  it("caso E: dinheiro extra — totais não comparados como equivalentes", () => {
    const r = compareDebtSwitch(
      current(),
      offer({ amountCents: 1_100_000, cashOut: "yes", cashOutCents: 300_000 }),
    );
    expect(r.totalsComparable).toBe(false);
    expect(r.totalDiffCents).toBeNull();
    expect(r.warnings).toContain("cash-out-separation");
    expect(r.sentences.join(" ")).toContain("libera R$ 3.000,00 adicionais");
  });

  it("caso N: nova operação maior que o saldo sem troco declarado → aviso", () => {
    const r = compareDebtSwitch(current(), offer({ amountCents: 1_100_000, cashOut: "unknown" }));
    expect(r.warnings).toContain("possible-undeclared-cash-out");
  });

  it("caso F: CET ausente → resultado parcial", () => {
    const r = compareDebtSwitch(current(), offer());
    expect(r.completeness).toBe("partial");
    expect(r.missing.join(" ")).toContain("CET");
    expect(r.warnings).toContain("cet-missing");
  });

  it("comparação completa quando saldo + CETs presentes", () => {
    const r = compareDebtSwitch(
      current({ cetAnnualPercent: 41.5 }),
      offer({ cetAnnualPercent: 29.2 }),
    );
    expect(r.completeness).toBe("complete");
    expect(r.cetDiffAnnualPP).toBeCloseTo(-12.3, 5);
  });

  it("caso G: taxa ausente — parcela, prazo e total continuam comparáveis", () => {
    const r = compareDebtSwitch(current({ rate: null }), offer({ rate: null }));
    expect(r.monthlyDiffCents).not.toBeNull();
    expect(r.termDiffMonths).not.toBeNull();
    expect(r.totalDiffCents).not.toBeNull();
    expect(r.rateDiffMonthlyPP).toBeNull();
  });

  it("caso H: taxa menor com total maior → trade-off destacado", () => {
    const r = compareDebtSwitch(
      current({ rate: { percent: 4.2, period: "month" } }),
      offer({
        installmentCents: 40_000,
        installments: 30,
        rate: { percent: 2.9, period: "month" },
      }),
    );
    expect(r.rateDiffMonthlyPP).toBeCloseTo(-1.3, 5);
    expect(r.sentences.join(" ")).toContain("A taxa caiu. O custo total informado, não.");
  });

  it("caso I: prazo igual", () => {
    const r = compareDebtSwitch(current(), offer({ installmentCents: 75_000, installments: 12 }));
    expect(r.termDiffMonths).toBe(0);
    expect(r.sentences.join(" ")).toContain("O prazo não muda.");
  });

  it("caso J: cartão rotativo — nenhum total futuro fictício", () => {
    const r = compareDebtSwitch(current({ modality: "cartao" }), offer());
    expect(r.currentFutureTotalCents).toBeNull();
    expect(r.totalDiffCents).toBeNull();
    expect(r.totalsComparable).toBe(false);
    expect(r.warnings).toContain("variable-future-unknown");
    expect(r.sentences.join(" ")).toContain("Não é possível estimar");
  });

  it("caso K: cheque especial — mesmo cuidado", () => {
    const r = compareDebtSwitch(current({ modality: "cheque-especial" }), offer());
    expect(r.currentFutureTotalCents).toBeNull();
  });

  it("caso L: parcelas variáveis — sem multiplicação simples", () => {
    const r = compareDebtSwitch(current({ fixedInstallments: "no" }), offer());
    expect(r.currentFutureTotalCents).toBeNull();
    expect(r.warnings).toContain("variable-future-unknown");
  });

  it("caso M: pagamento antecipado suspeito → alerta para o detector", () => {
    const r = compareDebtSwitch(current(), offer({ upfrontPaymentAsked: true }));
    expect(r.warnings).toContain("upfront-payment-alert");
  });

  it("caso O: entradas ausentes não quebram o motor", () => {
    const r = compareDebtSwitch(
      current({ payoffBalanceCents: null, installmentCents: null, remainingInstallments: null }),
      offer({ installmentCents: null, installments: null, amountCents: null }),
    );
    expect(r.monthlyDiffCents).toBeNull();
    expect(r.totalDiffCents).toBeNull();
    expect(r.completeness).toBe("partial");
  });

  it("caso P: valores muito altos permanecem exatos (centavos inteiros)", () => {
    const r = compareDebtSwitch(
      current({ installmentCents: 10_000_000_00, remainingInstallments: 360 }),
      offer({ installmentCents: 9_000_000_00, installments: 420 }),
    );
    expect(r.currentFutureTotalCents).toBe(10_000_000_00 * 360);
    expect(r.newTotalCents).toBe(9_000_000_00 * 420);
  });

  it("caso Q: centavos não sofrem erro de ponto flutuante", () => {
    const r = compareDebtSwitch(
      current({ installmentCents: 80_337, remainingInstallments: 12 }),
      offer({ installmentCents: 80_337, installments: 12 }),
    );
    expect(r.currentFutureTotalCents).toBe(964_044);
    expect(r.totalDiffCents).toBe(0);
  });
});

describe("regras complementares", () => {
  it("total oficial informado tem prioridade sobre parcela × prazo", () => {
    const r = compareDebtSwitch(current({ officialFutureTotalCents: 950_000 }), offer());
    expect(r.currentFutureTotalCents).toBe(950_000);
    expect(r.currentFutureTotalSource).toBe("official");
  });

  it("custos externos entram no total novo com rótulo próprio", () => {
    const r = compareDebtSwitch(current(), offer({ externalCostsCents: 20_000 }));
    expect(r.newTotalCents).toBe(920_000);
  });

  it("portabilidade com valor/prazo acima do remanescente → revisar tipo de operação", () => {
    const r = compareDebtSwitch(
      current(),
      offer({ amountCents: 900_000 }),
      "portability",
    );
    expect(r.warnings).toContain("portability-limits-check");
  });

  it("garantia nova → aviso de risco não-precificado", () => {
    const r = compareDebtSwitch(current(), offer({ newGuarantee: "yes" }));
    expect(r.warnings).toContain("guarantee-added");
  });

  it("conversão anual→mensal usa juros compostos, não divisão por 12", () => {
    expect(annualToMonthlyEffective(42.576088843)).toBeCloseTo(3.0, 5);
    const r = compareDebtSwitch(
      current({ rate: { percent: 42.576088843, period: "year" } }),
      offer({ rate: { percent: 2.0, period: "month" } }),
    );
    expect(r.rateDiffMonthlyPP).toBeCloseTo(-1.0, 4);
  });

  it("nunca produz linguagem de veredito", () => {
    const scenarios = [
      compareDebtSwitch(current(), offer()),
      compareDebtSwitch(current(), offer({ installmentCents: 40_000, installments: 30 })),
      compareDebtSwitch(current({ modality: "cartao" }), offer()),
    ];
    for (const r of scenarios) {
      const text = r.sentences.join(" ") + (buildPlainSummary(r) ?? "");
      expect(text).not.toMatch(/vale a pena|faça a troca|contrate|melhor opção|você deve aceitar|pode refinanciar/i);
    }
  });
});
