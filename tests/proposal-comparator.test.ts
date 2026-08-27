import { describe, expect, it } from "vitest";
import {
  buildSummaryText,
  compareProposals,
  formatCentsBRL,
  monthlyToEquivalentAnnual,
  parseBRLToCents,
  parsePercentBR,
  validateProposal,
  type ProposalInput,
} from "../src/lib/calculators/proposal-comparison";

function proposal(overrides: Partial<ProposalInput> = {}): ProposalInput {
  return {
    label: "Proposta A",
    netAmountCents: 10_000_00,
    installments: 24,
    installmentCents: 620_00,
    cetAnnualPercent: 32.4,
    ...overrides,
  };
}

describe("comparador de propostas — exemplo canônico do briefing", () => {
  const A = proposal({ label: "Proposta A", installments: 24, installmentCents: 620_00, cetAnnualPercent: 32 });
  const B = proposal({ label: "Proposta B", installments: 36, installmentCents: 470_00, cetAnnualPercent: 28 });

  it("calcula total pago e custo em reais", () => {
    const r = compareProposals([A, B]);
    expect(r.proposals[0]!.totalPaidCents).toBe(14_880_00);
    expect(r.proposals[0]!.nominalCostCents).toBe(4_880_00);
    expect(r.proposals[1]!.totalPaidCents).toBe(16_920_00);
    expect(r.proposals[1]!.nominalCostCents).toBe(6_920_00);
  });

  it("calcula as diferenças do trade-off", () => {
    const r = compareProposals([A, B]);
    const pair = r.pairs[0]!;
    expect(pair.installmentDiffCents).toBe(-150_00); // B paga R$150 a menos/mês
    expect(pair.termDiffMonths).toBe(12); // B fica 12 meses a mais
    expect(pair.totalPaidDiffCents).toBe(2_040_00); // B custa R$2.040 a mais
    expect(pair.cetDiffPoints).toBe(-4); // B tem CET 4 p.p. menor
  });

  it("atribui os critérios sem eleger vencedor único", () => {
    const r = compareProposals([A, B]);
    const byKey = Object.fromEntries(r.criteria.map((c) => [c.key, c]));
    expect(byKey.lowestInstallment!.winners).toEqual([1]);
    expect(byKey.shortestTerm!.winners).toEqual([0]);
    expect(byKey.lowestCet!.winners).toEqual([1]);
    expect(byKey.lowestTotalPaid!.winners).toEqual([0]);
    expect(r.dominantIndex).toBeNull(); // cada uma ganha num critério
  });
});

describe("casos A–M do escopo", () => {
  it("A: mesmo valor recebido e prazos diferentes — sem alerta de valores", () => {
    const r = compareProposals([proposal(), proposal({ label: "Proposta B", installments: 36, installmentCents: 470_00 })]);
    expect(r.warnings.differentNetAmounts).toBe(false);
  });

  it("B: valores recebidos diferentes — alerta e sem dominância", () => {
    const r = compareProposals([
      proposal({ netAmountCents: 10_000_00 }),
      proposal({ label: "Proposta B", netAmountCents: 15_000_00, installmentCents: 900_00 }),
    ]);
    expect(r.warnings.differentNetAmounts).toBe(true);
    expect(r.warnings.netAmountSpread).toBeCloseTo(1 / 3, 5);
    expect(r.dominantIndex).toBeNull();
  });

  it("C: CET ausente em uma — critério de CET indisponível, resto funciona", () => {
    const r = compareProposals([proposal(), proposal({ label: "Proposta B", cetAnnualPercent: undefined })]);
    const cet = r.criteria.find((c) => c.key === "lowestCet")!;
    expect(cet.available).toBe(false);
    expect(r.warnings.missingCet).toBe(true);
    expect(r.warnings.allMissingCet).toBe(false);
    expect(r.pairs[0]!.cetDiffPoints).toBeNull();
  });

  it("D: CET ausente nas duas", () => {
    const r = compareProposals([
      proposal({ cetAnnualPercent: undefined }),
      proposal({ label: "Proposta B", cetAnnualPercent: undefined }),
    ]);
    expect(r.warnings.allMissingCet).toBe(true);
  });

  it("E: mesma parcela — empate declarado nas duas", () => {
    const r = compareProposals([proposal(), proposal({ label: "Proposta B", installments: 30 })]);
    const inst = r.criteria.find((c) => c.key === "lowestInstallment")!;
    expect(inst.winners).toEqual([0, 1]);
  });

  it("F: mesmo total pago — empate no critério de total", () => {
    const r = compareProposals([
      proposal({ installments: 24, installmentCents: 620_00 }),
      proposal({ label: "Proposta B", installments: 12, installmentCents: 1_240_00 }),
    ]);
    const total = r.criteria.find((c) => c.key === "lowestTotalPaid")!;
    expect(total.winners).toEqual([0, 1]);
  });

  it("G: custo externo entra no total pago e no custo em reais", () => {
    const r = compareProposals([
      proposal({ externalCostsCents: 200_00 }),
      proposal({ label: "Proposta B" }),
    ]);
    expect(r.proposals[0]!.totalPaidCents).toBe(24 * 620_00 + 200_00);
    expect(r.proposals[0]!.nominalCostCents).toBe(24 * 620_00 + 200_00 - 10_000_00);
  });

  it("H: três propostas — três pares de diferenças", () => {
    const r = compareProposals([
      proposal(),
      proposal({ label: "Proposta B", installments: 36, installmentCents: 470_00 }),
      proposal({ label: "Proposta C", installments: 18, installmentCents: 700_00 }),
    ]);
    expect(r.proposals).toHaveLength(3);
    expect(r.pairs).toHaveLength(3);
  });

  it("I: valores decimais em centavos exatos (sem erro de float)", () => {
    const r = compareProposals([
      proposal({ installmentCents: 33_333, installments: 3, netAmountCents: 90_000 }),
      proposal({ label: "Proposta B", installmentCents: 10_01, installments: 100, netAmountCents: 90_000 }),
    ]);
    expect(r.proposals[0]!.totalPaidCents).toBe(99_999);
    expect(r.proposals[1]!.totalPaidCents).toBe(100_100);
  });

  it("J: taxa mensal vira equivalente anual composta (≠ ×12)", () => {
    expect(monthlyToEquivalentAnnual(3)).toBeCloseTo(42.576, 2);
    const r = compareProposals([
      proposal({ interestRate: { value: 3, period: "monthly" } }),
      proposal({ label: "Proposta B" }),
    ]);
    expect(r.proposals[0]!.equivalentAnnualPercent).toBeCloseTo(42.576, 2);
  });

  it("K: taxa anual é preservada como anual", () => {
    const r = compareProposals([
      proposal({ interestRate: { value: 28, period: "annual" } }),
      proposal({ label: "Proposta B" }),
    ]);
    expect(r.proposals[0]!.equivalentAnnualPercent).toBe(28);
  });

  it("L: input inválido produz mensagens específicas e nunca NaN", () => {
    expect(validateProposal(proposal({ installmentCents: 0 })).join(" ")).toMatch(/parcela/);
    expect(validateProposal(proposal({ installments: 0 })).join(" ")).toMatch(/parcelas/);
    expect(validateProposal(proposal({ netAmountCents: -100 })).join(" ")).toMatch(/recebe/);
    expect(validateProposal(proposal({ cetAnnualPercent: -1 })).join(" ")).toMatch(/CET/);
    expect(() =>
      compareProposals([proposal({ installmentCents: Number.NaN as unknown as number }), proposal({ label: "Proposta B" })]),
    ).toThrow();
  });

  it("M: total pago menor que o recebido gera pedido de revisão, não erro", () => {
    const r = compareProposals([
      proposal({ installments: 2, installmentCents: 100_00 }), // total R$200 < R$10.000
      proposal({ label: "Proposta B" }),
    ]);
    expect(r.warnings.totalBelowNet).toEqual([0]);
  });
});

describe("dominância factual", () => {
  it("declara dominância apenas quando uma proposta vence todos os critérios avaliáveis", () => {
    const r = compareProposals([
      proposal({ installments: 24, installmentCents: 600_00, cetAnnualPercent: 28 }),
      proposal({ label: "Proposta B", installments: 36, installmentCents: 620_00, cetAnnualPercent: 32 }),
    ]);
    expect(r.dominantIndex).toBe(0);
  });
});

describe("parsing e formatação pt-BR", () => {
  it("aceita entradas humanas de dinheiro", () => {
    expect(parseBRLToCents("10000")).toBe(1_000_000);
    expect(parseBRLToCents("R$ 10.000,00")).toBe(1_000_000);
    expect(parseBRLToCents("620,50")).toBe(62_050);
    expect(parseBRLToCents("1234.56")).toBe(123_456);
    expect(parseBRLToCents("abc")).toBeNull();
    expect(parseBRLToCents("-10")).toBeNull();
  });

  it("aceita percentuais com vírgula", () => {
    expect(parsePercentBR("32,4")).toBe(32.4);
    expect(parsePercentBR("32.4%")).toBe(32.4);
    expect(parsePercentBR("x")).toBeNull();
  });

  it("formata centavos como moeda pt-BR", () => {
    expect(formatCentsBRL(1_488_000).replace(/ /g, " ")).toBe("R$ 14.880,00");
  });
});

describe("resumo copiável", () => {
  it("descreve sem recomendar", () => {
    const r = compareProposals([
      proposal({ installments: 24, installmentCents: 620_00, cetAnnualPercent: 32 }),
      proposal({ label: "Proposta B", installments: 36, installmentCents: 470_00, cetAnnualPercent: 28 }),
    ]);
    const text = buildSummaryText(r);
    expect(text).toContain("24x");
    expect(text).toContain("36x");
    expect(text).toContain("12 meses antes");
    expect(text).toContain("não é recomendação");
    expect(text.toLowerCase()).not.toContain("contrate");
    expect(text.toLowerCase()).not.toContain("melhor proposta");
  });
});
