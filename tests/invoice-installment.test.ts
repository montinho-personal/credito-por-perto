import { describe, expect, it } from "vitest";

import {
  analyzeProposal,
  buildInstallmentSummary,
  compareInvoiceProposals,
  describeTradeoff,
  simulateInstallments,
  simulationWhatIfs,
  type ProposalAnalysis,
  type ProposalData,
} from "@/lib/calculators/invoice-installment";

/** Intl.NumberFormat usa espaço não separável depois de "R$". */
const plain = (s: string) => s.replace(/\u00a0/g, " ");

function ok(p: ProposalData): ProposalAnalysis {
  const o = analyzeProposal(p);
  if (o.kind !== "ok") throw new Error(JSON.stringify(o.errors));
  return o.analysis;
}

describe("proposta da fatura", () => {
  it("teste 1 — R$ 5.000 em 12x de R$ 500: total R$ 6.000, custo R$ 1.000", () => {
    const a = ok({ debtCents: 5_000_00, installments: 12, installmentCents: 500_00 });
    expect(a.installmentsTotalCents).toBe(6_000_00);
    expect(a.disbursedCents).toBe(6_000_00);
    expect(a.extraCostCents).toBe(1_000_00);
    expect(a.extraShare).toBeCloseTo(0.2, 10);
    expect(a.per100Cents).toBe(120_00);
  });

  it("exemplo do brief: R$ 4.800 em 12x de R$ 529,90", () => {
    const a = ok({ debtCents: 4_800_00, installments: 12, installmentCents: 529_90 });
    expect(a.installmentsTotalCents).toBe(6_358_80);
    expect(a.extraCostCents).toBe(1_558_80);
    // Taxa implícita conferida à parte (Python, decimal de 40 dígitos,
    // bisseção): 4,616113% a.m.
    expect(a.implicitMonthlyPercent!).toBeCloseTo(4.616113, 5);
  });

  it("teste 86 — entrada aparece uma vez: dívida 5.000, entrada 1.000 → parcelado 4.000", () => {
    const a = ok({ debtCents: 5_000_00, downCents: 1_000_00, installments: 10, installmentCents: 450_00 });
    expect(a.financedCents).toBe(4_000_00);
    expect(a.installmentsTotalCents).toBe(4_500_00);
    expect(a.disbursedCents).toBe(5_500_00); // 1.000 + 4.500, não 6.500
    expect(a.extraCostCents).toBe(500_00); // 5.500 − 5.000 = 4.500 − 4.000
    expect(a.extraCostCents).toBe(a.installmentsTotalCents - a.financedCents);
  });

  it("sem acréscimo: taxa implícita zero; parcelas abaixo do valor: sem taxa implícita", () => {
    expect(ok({ debtCents: 6_000_00, installments: 12, installmentCents: 500_00 }).implicitMonthlyPercent).toBe(0);
    const low = ok({ debtCents: 6_000_00, installments: 12, installmentCents: 400_00 });
    expect(low.implicitMonthlyPercent).toBeNull();
    expect(low.extraCostCents).toBe(-1_200_00);
  });

  it("taxas mensal e anual informadas: detecta quando não são equivalentes", () => {
    expect(ok({ debtCents: 5_000_00, installments: 12, installmentCents: 500_00, monthlyRatePercent: 5, annualRatePercent: 79.59 }).ratesIncoherent).toBe(false);
    expect(ok({ debtCents: 5_000_00, installments: 12, installmentCents: 500_00, monthlyRatePercent: 5, annualRatePercent: 60 }).ratesIncoherent).toBe(true);
    // Só uma das duas: nada a conferir.
    expect(ok({ debtCents: 5_000_00, installments: 12, installmentCents: 500_00, monthlyRatePercent: 5 }).ratesIncoherent).toBe(false);
  });

  it("CET é o informado — nunca calculado", () => {
    expect(ok({ debtCents: 5_000_00, installments: 12, installmentCents: 500_00 }).cetAnnualPercent).toBeNull();
    expect(ok({ debtCents: 5_000_00, installments: 12, installmentCents: 500_00, cetAnnualPercent: 120.5 }).cetAnnualPercent).toBe(120.5);
  });

  it("validações: zero, negativo, parcelas fracionárias, entrada ≥ dívida, CET negativo", () => {
    const fields = (p: Partial<ProposalData>) => {
      const o = analyzeProposal({ debtCents: 5_000_00, installments: 12, installmentCents: 500_00, ...p });
      return o.kind === "invalid" ? o.errors.map((e) => e.field) : [];
    };
    expect(fields({ debtCents: 0 })).toContain("debtCents");
    expect(fields({ debtCents: -1 })).toContain("debtCents");
    expect(fields({ installments: 0 })).toContain("installments");
    expect(fields({ installments: -3 })).toContain("installments");
    expect(fields({ installments: 2.5 })).toContain("installments");
    expect(fields({ installmentCents: 0 })).toContain("installmentCents");
    expect(fields({ downCents: 5_000_00 })).toContain("downCents");
    expect(fields({ cetAnnualPercent: -1 })).toContain("cetAnnualPercent");
    expect(fields({ monthlyRatePercent: Number.NaN })).toContain("monthlyRatePercent");
    expect(fields({ debtCents: 1e15 })).toContain("debtCents");
  });
});

describe("modo simulação", () => {
  it("teste 2 — sem juros: R$ 6.000 em 12 parcelas de R$ 500", () => {
    const o = simulateInstallments({ debtCents: 6_000_00, ratePercent: 0, rateUnit: "am", installments: 12 });
    expect(o.kind).toBe("ok");
    if (o.kind === "ok") {
      expect(o.analysis.installmentCents).toBe(500_00);
      expect(o.analysis.extraCostCents).toBe(0);
    }
  });

  it("teste 3 — Price contra referência: R$ 5.000, 8,99% a.m., 12x → R$ 697,90", () => {
    // 5000 × 0,0899 / (1 − 1,0899^−12) = 697,9016… (Python, decimal de 40 dígitos)
    const o = simulateInstallments({ debtCents: 5_000_00, ratePercent: 8.99, rateUnit: "am", installments: 12 });
    expect(o.kind).toBe("ok");
    if (o.kind === "ok") {
      expect(o.analysis.installmentCents).toBe(697_90);
      expect(o.analysis.implicitMonthlyPercent!).toBeCloseTo(8.99, 2);
    }
  });

  it("taxa anual convertida por equivalência, com entrada descontada", () => {
    const o = simulateInstallments({ debtCents: 5_000_00, downCents: 1_000_00, ratePercent: 100, rateUnit: "aa", installments: 12 });
    expect(o.kind).toBe("ok");
    if (o.kind === "ok") {
      expect(o.monthlyRatePercent).toBeCloseTo((Math.pow(2, 1 / 12) - 1) * 100, 10);
      expect(o.analysis.financedCents).toBe(4_000_00);
    }
  });

  it("e se: menos parcelas, taxa menor, entrada maior — todos com menos custo", () => {
    const input = { debtCents: 5_000_00, ratePercent: 8, rateUnit: "am" as const, installments: 12 };
    const base = simulateInstallments(input);
    if (base.kind !== "ok") throw new Error();
    const rows = simulationWhatIfs(input, base.monthlyRatePercent);
    expect(rows.map((r) => r.id)).toEqual(["prazo-9", "prazo-6", "taxa-1", "taxa-2", "entrada-50000", "entrada-100000"]);
    for (const r of rows) expect(r.analysis.extraCostCents).toBeLessThan(base.analysis.extraCostCents);
    expect(rows[1]!.analysis.installmentCents).toBeGreaterThan(base.analysis.installmentCents);
  });
});

describe("comparação de propostas (motor do Comparador)", () => {
  const A = { label: "Proposta A", data: { debtCents: 5_000_00, installments: 6, installmentCents: 980_00 } };
  const B = { label: "Proposta B", data: { debtCents: 5_000_00, installments: 12, installmentCents: 600_00 } };
  const C = { label: "Proposta C", data: { debtCents: 5_000_00, installments: 18, installmentCents: 450_00, cetAnnualPercent: 150 } };

  it("teste 87 — totais, diferenças e prazos", () => {
    const o = compareInvoiceProposals([A, B]);
    expect(o.kind).toBe("ok");
    if (o.kind !== "ok") return;
    const [a, b] = o.comparison.analyses;
    expect(a!.disbursedCents).toBe(5_880_00);
    expect(b!.disbursedCents).toBe(7_200_00);
    const pair = o.comparison.base.pairs[0]!;
    expect(pair.totalPaidDiffCents).toBe(1_320_00);
    expect(pair.termDiffMonths).toBe(6);
    expect(pair.installmentDiffCents).toBe(-380_00);
    const lowestTotal = o.comparison.base.criteria.find((c) => c.key === "lowestTotalPaid")!;
    expect(lowestTotal.winners).toEqual([0]);
  });

  it("CET ausente em alguma proposta: critério de CET indisponível, nunca inventado", () => {
    const o = compareInvoiceProposals([A, B, C]);
    if (o.kind !== "ok") throw new Error();
    expect(o.comparison.base.criteria.find((c) => c.key === "lowestCet")!.available).toBe(false);
  });

  it("frase de trade-off sem veredito", () => {
    const o = compareInvoiceProposals([A, B]);
    if (o.kind !== "ok") throw new Error();
    expect(plain(o.comparison.tradeoffs[0]!)).toBe(
      "Proposta B tem parcela R$ 380,00 menor que Proposta A, mas dura 6 meses a mais e soma R$ 1.320,00 a mais no total.",
    );
    expect(o.comparison.tradeoffs.join(" ")).not.toMatch(/melhor|recomend|escolha|vale a pena/i);
  });

  it("parcela menor e também mais barata: 'e', não 'mas'", () => {
    const a = ok({ debtCents: 5_000_00, installments: 12, installmentCents: 500_00 });
    const b = ok({ debtCents: 5_000_00, installments: 12, installmentCents: 520_00 });
    expect(plain(describeTradeoff("A", a, "B", b))).toBe("A tem parcela R$ 20,00 menor que B, e soma R$ 240,00 a menos no total.");
  });

  it("entrada entra no desembolso de cada proposta, uma vez", () => {
    const o = compareInvoiceProposals([
      { label: "A", data: { debtCents: 5_000_00, downCents: 1_000_00, installments: 10, installmentCents: 450_00 } },
      { label: "B", data: { debtCents: 5_000_00, installments: 12, installmentCents: 520_00 } },
    ]);
    if (o.kind !== "ok") throw new Error();
    expect(o.comparison.base.proposals[0]!.totalPaidCents).toBe(5_500_00);
    expect(o.comparison.base.warnings.differentNetAmounts).toBe(false);
  });

  it("resumo copiável sem veredito e sem dado pessoal", () => {
    const text = plain(buildInstallmentSummary([{ label: "Proposta A", analysis: ok(A.data) }]));
    expect(text).toContain("Total das parcelas: R$ 5.880,00");
    expect(text).toContain("CET informado: não informado");
    expect(text).not.toMatch(/melhor|recomend/i);
  });
});
