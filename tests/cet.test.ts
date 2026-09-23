import { describe, expect, it } from "vitest";

import { annualToMonthly, monthlyToAnnual, presentValue, solveAnnualRate, validateCashFlow, type Flow } from "@/lib/calculators/cash-flow";
import { analyzeProposal, compareCet, type ProposalInput, type ProposalResult } from "@/lib/calculators/cet";
import { addMonths } from "@/lib/calculators/civil-date";

/*
 * Referências conferidas por script independente (Python, decimal de 50
 * dígitos, bisseção própria, dias corridos ÷ 365) — não pelo motor do site.
 */

const base: ProposalInput = {
  receivedCents: 10_000_00,
  installments: 12,
  installmentCents: 945_60, // Price de R$ 10.000 a 2% a.m.
  releaseDate: "2026-09-23",
  firstDueDate: "2026-10-23",
  costs: [],
  allCostsInformed: false,
  indexer: "nenhum",
  operation: "definida",
};

function ok(p: Partial<ProposalInput>): ProposalResult {
  const o = analyzeProposal({ ...base, ...p });
  if (o.kind !== "ok") throw new Error(JSON.stringify(o));
  return o.result;
}
const pct = (r: ProposalResult) => r.annualRate * 100;

describe("motor de fluxo", () => {
  it("teste 78 — recupera a taxa de um fluxo gerado com taxa conhecida", () => {
    const d0 = "2026-03-10";
    const rate = 0.2735;
    const pays: Flow[] = [5, 40, 97, 190, 400, 731].map((days, i) => {
      const date = new Date(Date.UTC(2026, 2, 10 + days)).toISOString().slice(0, 10);
      return { date, amountCents: -(300_00 + i * 17_31), description: `p${i}` };
    });
    const pvOfPays = -presentValue(pays, d0, rate);
    const o = solveAnnualRate([{ date: d0, amountCents: pvOfPays, description: "recebe" }, ...pays], d0);
    expect(o.kind).toBe("ok");
    if (o.kind === "ok") {
      expect(o.annualRate).toBeCloseTo(rate, 10);
      expect(Math.abs(o.residualCents)).toBeLessThan(1e-6);
    }
  });

  it("teste 83 — taxa zero: recebe 12.000, paga 12 × 1.000", () => {
    expect(pct(ok({ receivedCents: 12_000_00, installmentCents: 1_000_00 }))).toBeCloseTo(0, 8);
  });

  it("fluxo simples: Price 2% a.m. em 12x → 26,895231% a.a.", () => {
    expect(pct(ok({}))).toBeCloseTo(26.895231, 5);
  });

  it("teste 79 — datas irregulares: 05/01 → 10/02, 10/03, 10/04", () => {
    const r = ok({ receivedCents: 3_000_00, installments: 3, installmentCents: 1_050_00, releaseDate: "2026-01-05", firstDueDate: "2026-02-10" });
    expect(r.flows.filter((f) => f.amountCents < 0).map((f) => f.date)).toEqual(["2026-02-10", "2026-03-10", "2026-04-10"]);
    expect(pct(r)).toBeCloseTo(31.639894, 5);
  });

  it("teste 80 — ano bissexto: dias corridos ÷ 365, sem trocar por 366", () => {
    expect(pct(ok({ receivedCents: 5_000_00, installments: 6, installmentCents: 900_00, releaseDate: "2027-12-15", firstDueDate: "2028-01-15" }))).toBeCloseTo(30.390003, 5);
  });

  it("teste 81/82 — primeira parcela longa e curta", () => {
    const longa = ok({ receivedCents: 5_000_00, installments: 6, installmentCents: 900_00, releaseDate: "2026-01-01", firstDueDate: "2026-03-15" });
    const curta = ok({ receivedCents: 5_000_00, installments: 6, installmentCents: 900_00, releaseDate: "2026-01-01", firstDueDate: "2026-01-15" });
    expect(pct(longa)).toBeCloseTo(20.778331, 5);
    expect(pct(curta)).toBeCloseTo(37.598127, 5);
  });

  it("teste 88 — parcelas irregulares 500, 500, 750, 800", () => {
    const r = ok({ receivedCents: 2_000_00, irregularInstallmentsCents: [500_00, 500_00, 750_00, 800_00] });
    expect(r.installmentsTotalCents).toBe(2_550_00);
    expect(pct(r)).toBeCloseTo(198.212406, 4);
  });

  it("taxa elevada em prazo curtíssimo não é erro: 1.000 → 1.030 em 15 dias", () => {
    const r = ok({ receivedCents: 1_000_00, installments: 1, installmentCents: 1_030_00, firstDueDate: "2026-10-08" });
    expect(pct(r)).toBeCloseTo(105.292209, 4);
    expect(r.totalPaidCents - r.receivedCents).toBe(30_00);
  });

  it("prazo longo: 420 parcelas resolve sem NaN", () => {
    const r = ok({ receivedCents: 200_000_00, installments: 420, installmentCents: 2_100_00 });
    expect(Number.isFinite(r.annualRate)).toBe(true);
    expect(r.annualRate).toBeGreaterThan(0);
  });

  it("conversões por equivalência, nunca ÷ 12", () => {
    expect(monthlyToAnnual(0.015)).toBeCloseTo(0.195618, 6);
    expect(annualToMonthly(monthlyToAnnual(0.02))).toBeCloseTo(0.02, 12);
  });
});

describe("custos", () => {
  it("teste 84 — tarifa de R$ 500 paga à parte: FC0 = 9.500 e o CET sobe (40,137647%)", () => {
    const r = ok({ costs: [{ kind: "tarifa", amountCents: 500_00, mode: "antecipado" }] });
    expect(r.netInitialCents).toBe(9_500_00);
    expect(pct(r)).toBeCloseTo(40.137647, 5);
    expect(r.annualRate).toBeGreaterThan(ok({}).annualRate);
  });

  it("teste 85 — tarifa financiada: parcela maior, CET diferente do caso antecipado (39,455355%)", () => {
    const r = ok({ installmentCents: 992_88, costs: [{ kind: "tarifa", amountCents: 500_00, mode: "financiado" }] });
    expect(r.financedCents).toBe(10_500_00);
    expect(r.netInitialCents).toBe(10_000_00); // financiado não sai de novo do fluxo
    expect(pct(r)).toBeCloseTo(39.455355, 5);
  });

  it("teste 86 — seguro de R$ 20 cobrado junto com cada parcela (32,115589%)", () => {
    const r = ok({ costs: [{ kind: "seguro", amountCents: 20_00, mode: "por-parcela" }] });
    expect(r.costsByKind.seguro).toBe(240_00);
    expect(pct(r)).toBeCloseTo(32.115589, 5);
  });

  it("teste 87 — IOF pago à parte x IOF financiado dão CETs diferentes", () => {
    const antecipado = ok({ costs: [{ kind: "iof", amountCents: 300_00, mode: "antecipado" }] });
    const financiado = ok({ installmentCents: 973_96, costs: [{ kind: "iof", amountCents: 300_00, mode: "financiado" }] });
    expect(antecipado.annualRate).not.toBeCloseTo(financiado.annualRate, 4);
  });

  it("descontado do valor liberado: não muda o fluxo, explica o solicitado", () => {
    const r = ok({ costs: [{ kind: "iof", amountCents: 250_00, mode: "descontado" }] });
    expect(r.requestedCents).toBe(10_250_00);
    expect(r.annualRate).toBeCloseTo(ok({}).annualRate, 12);
  });

  it("custo em outra data entra naquela data", () => {
    const r = ok({ costs: [{ kind: "registro", amountCents: 150_00, mode: "data", date: "2026-11-05" }] });
    expect(r.flows.some((f) => f.date === "2026-11-05" && f.amountCents === -150_00)).toBe(true);
    expect(r.annualRate).toBeGreaterThan(ok({}).annualRate);
  });

  it("nomenclatura: CET só com todos os custos confirmados", () => {
    expect(ok({}).label).toBe("taxa-do-fluxo");
    expect(ok({ allCostsInformed: true }).label).toBe("cet");
  });

  it("total pago não é CET: acréscimo nominal e taxa são números diferentes", () => {
    const r = ok({});
    const nominal = (r.totalPaidCents - r.receivedCents) / r.receivedCents;
    expect(Math.abs(nominal - r.annualRate)).toBeGreaterThan(0.1);
  });
});

describe("conferência com a proposta", () => {
  it("CET informado: diferença em pontos percentuais", () => {
    const r = ok({ cetInformedPercent: 26.9 });
    expect(r.cetDiffPp!).toBeCloseTo(-0.004769, 5);
  });

  it("valor financiado sem custos que expliquem → diferença não explicada", () => {
    const r = ok({ financedInformedCents: 10_800_00 });
    expect(r.unexplainedFinancedCents).toBe(800_00);
    const r2 = ok({ financedInformedCents: 10_800_00, costs: [{ kind: "iof", amountCents: 300_00, mode: "financiado" }, { kind: "seguro", amountCents: 500_00, mode: "financiado" }] });
    expect(r2.unexplainedFinancedCents).toBe(0);
  });

  it("taxa anunciada ao mês vira anual equivalente para comparar", () => {
    const r = ok({ announcedRate: { value: 1.5, unit: "am" } });
    expect(r.announcedAnnual!).toBeCloseTo(0.195618, 6);
  });
});

describe("fluxos inválidos e fora do escopo", () => {
  it("teste 133 — inválidos: sem recebimento, pagamento antes da liberação, sinais trocados", () => {
    expect(validateCashFlow([{ date: "2026-01-01", amountCents: -100, description: "" }], "2026-01-01").problems).toContain("sem-recebimento");
    const weird: Flow[] = [
      { date: "2026-01-01", amountCents: 1000, description: "" },
      { date: "2026-02-01", amountCents: -600, description: "" },
      { date: "2026-03-01", amountCents: 400, description: "" },
      { date: "2026-04-01", amountCents: -900, description: "" },
    ];
    expect(solveAnnualRate(weird, "2026-01-01").kind).toBe("invalid");
    expect(validateCashFlow([{ date: "2025-12-01", amountCents: -1, description: "" }, { date: "2026-01-01", amountCents: 1, description: "" }], "2026-01-01").problems).toContain("antes-da-liberacao");
  });

  it("recusa entradas inválidas e primeira parcela antes da liberação", () => {
    const fields = (p: Partial<ProposalInput>) => {
      const o = analyzeProposal({ ...base, ...p });
      return o.kind === "invalid" ? o.errors.map((e) => e.field) : [];
    };
    expect(fields({ receivedCents: 0 })).toContain("receivedCents");
    expect(fields({ installments: 0 })).toContain("installments");
    expect(fields({ installmentCents: Number.NaN })).toContain("installmentCents");
    expect(fields({ firstDueDate: "2026-09-23" })).toContain("firstDueDate");
    expect(fields({ releaseDate: "2026-02-30" })).toContain("releaseDate");
  });

  it("antecipado maior que o recebido gera fluxo sem recebimento líquido", () => {
    const o = analyzeProposal({ ...base, costs: [{ kind: "tarifa", amountCents: 20_000_00, mode: "antecipado" }] });
    expect(o.kind).toBe("fluxo-invalido");
  });

  it("rotativo e crédito rural não usam a metodologia padrão", () => {
    expect(analyzeProposal({ ...base, operation: "rotativo" }).kind).toBe("rotativo");
    expect(analyzeProposal({ ...base, operation: "rural" }).kind).toBe("fora-do-escopo");
  });

  it("fim de mês: 31/01 + 1 mês = 28/02, sem virar 03/03", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    const r = ok({ releaseDate: "2025-12-31", firstDueDate: "2026-01-31", installments: 3 });
    expect(r.flows.filter((f) => f.amountCents < 0).map((f) => f.date)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  });
});

describe("comparação", () => {
  it("critérios independentes, sem vencedora", () => {
    const A = ok({ cetInformedPercent: 27 });
    const B = ok({ costs: [{ kind: "tarifa", amountCents: 700_00, mode: "antecipado" }], cetInformedPercent: 45 });
    const c = compareCet([A, B]);
    expect(c.find((x) => x.key === "menorCetCalculado")!.holders).toEqual([0]);
    expect(c.find((x) => x.key === "menorParcela")!.holders).toEqual([]); // empate
  });
});
