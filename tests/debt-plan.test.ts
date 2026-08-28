import { describe, expect, it } from "vitest";
import {
  buildDebtPlan,
  buildPlanText,
  formatMonths,
  normalizeDebt,
  orderByAvalanche,
  orderBySnowball,
  simulatePlan,
  type DebtInput,
  type DebtPlanInput,
} from "@/lib/calculators/debt-plan";

function debt(partial: Partial<DebtInput> & { id: string }): DebtInput {
  return {
    label: partial.id,
    type: "emprestimo-pessoal",
    balanceCents: 100_000,
    monthlyPaymentCents: 10_000,
    paymentKind: "parcela-fixa",
    rateValue: null,
    rateUnit: "nao-sei",
    overdue: false,
    overdueDays: null,
    essential: "no",
    collateral: "no",
    urgent: "nenhuma",
    ...partial,
  };
}

function plan(partial: Partial<DebtPlanInput> & { debts: DebtInput[] }): DebtPlanInput {
  return { monthlyAvailableCents: null, lumpSumCents: null, ...partial };
}

const A = debt({ id: "A", balanceCents: 1_000_000, rateValue: 5, rateUnit: "mensal" });
const B = debt({ id: "B", balanceCents: 300_000, rateValue: 10, rateUnit: "mensal" });
const C = debt({ id: "C", balanceCents: 1_500_000, rateValue: 2, rateUnit: "mensal" });

function norm(list: DebtInput[]) {
  return list.map(normalizeDebt);
}

describe("casos obrigatórios de ordenação", () => {
  it("caso A: avalanche ordena por maior taxa (B, A, C)", () => {
    expect(orderByAvalanche(norm([A, B, C])).orderedIds).toEqual(["B", "A", "C"]);
  });

  it("caso B: bola de neve ordena por menor saldo (B, A, C)", () => {
    expect(orderBySnowball(norm([A, B, C])).orderedIds).toEqual(["B", "A", "C"]);
  });

  it("caso C: métodos divergem — menor saldo tem taxa menor", () => {
    const pequena = debt({ id: "P", balanceCents: 100_000, rateValue: 2, rateUnit: "mensal" });
    const grande = debt({ id: "G", balanceCents: 800_000, rateValue: 10, rateUnit: "mensal" });
    const debts = norm([pequena, grande]);
    expect(orderByAvalanche(debts).orderedIds[0]).toBe("G");
    expect(orderBySnowball(debts).orderedIds[0]).toBe("P");
  });

  it("caso D: taxa ausente deixa a avalanche incompleta, sem assumir zero", () => {
    const semTaxa = debt({ id: "X", balanceCents: 500_000 });
    const r = orderByAvalanche(norm([A, semTaxa]));
    expect(r.status).toBe("incomplete");
    expect(r.unrankedIds).toEqual(["X"]);
    expect(r.orderedIds).not.toContain("X");
    expect(normalizeDebt(semTaxa).monthlyRate).toBeNull();
  });

  it("caso E: nenhuma taxa informada — bola de neve funciona, avalanche não", () => {
    const d1 = debt({ id: "1", balanceCents: 500_000 });
    const d2 = debt({ id: "2", balanceCents: 200_000 });
    const debts = norm([d1, d2]);
    expect(orderBySnowball(debts).orderedIds).toEqual(["2", "1"]);
    expect(orderByAvalanche(debts).orderedIds).toEqual([]);
    expect(buildDebtPlan(plan({ debts: [d1, d2] })).warnings).toContain("no-rates");
  });

  it("caso K: empate de taxa → menor saldo primeiro (regra documentada)", () => {
    const grande = debt({ id: "G", balanceCents: 900_000, rateValue: 4, rateUnit: "mensal" });
    const pequena = debt({ id: "P", balanceCents: 200_000, rateValue: 4, rateUnit: "mensal" });
    expect(orderByAvalanche(norm([grande, pequena])).orderedIds).toEqual(["P", "G"]);
  });

  it("caso L: empate de saldo → maior taxa primeiro (regra documentada)", () => {
    const baixa = debt({ id: "baixa", balanceCents: 400_000, rateValue: 2, rateUnit: "mensal" });
    const alta = debt({ id: "alta", balanceCents: 400_000, rateValue: 9, rateUnit: "mensal" });
    expect(orderBySnowball(norm([baixa, alta])).orderedIds).toEqual(["alta", "baixa"]);
  });

  it("converte taxa anual por equivalência composta, nunca dividindo por 12", () => {
    const anual = normalizeDebt(debt({ id: "an", rateValue: 60, rateUnit: "anual" }));
    // (1,60)^(1/12) − 1 ≈ 0,0399 — e não 60/12 = 5%
    expect(anual.monthlyRate!).toBeCloseTo(0.03994, 4);
    expect(anual.monthlyRate!).not.toBeCloseTo(0.05, 3);
  });

  it("caso J: taxa zero declarada é aceita e diferente de taxa ausente", () => {
    const semJuros = normalizeDebt(debt({ id: "z", rateUnit: "sem-juros" }));
    expect(semJuros.monthlyRate).toBe(0);
    expect(semJuros.modelable).toBe(true);
  });
});

describe("motor de orçamento", () => {
  it("caso F: disponível maior que o necessário gera valor adicional", () => {
    const d1 = debt({ id: "1", monthlyPaymentCents: 100_000, rateValue: 3, rateUnit: "mensal" });
    const d2 = debt({ id: "2", monthlyPaymentCents: 50_000, rateValue: 2, rateUnit: "mensal" });
    const r = buildDebtPlan(plan({ debts: [d1, d2], monthlyAvailableCents: 200_000 }));
    expect(r.budget.requiredCents).toBe(150_000);
    expect(r.budget.additionalCents).toBe(50_000);
    expect(r.budget.status).toBe("surplus");
  });

  it("caso G: disponível menor que o necessário não roda estratégia normal", () => {
    const d1 = debt({ id: "1", monthlyPaymentCents: 120_000, rateValue: 3, rateUnit: "mensal" });
    const d2 = debt({ id: "2", monthlyPaymentCents: 80_000, rateValue: 2, rateUnit: "mensal" });
    const r = buildDebtPlan(plan({ debts: [d1, d2], monthlyAvailableCents: 150_000 }));
    expect(r.budget.status).toBe("deficit");
    expect(r.budget.additionalCents).toBe(-50_000);
    expect(r.warnings).toContain("budget-deficit");
    expect(r.projection.status).toBe("priority-only");
    expect(r.projection.avalanche).toBeNull();
    // continua entregando a ordem, mas sem fingir normalidade
    expect(r.avalanche.orderedIds.length).toBe(2);
  });

  it("disponível exatamente igual ao necessário não inventa aceleração", () => {
    const d1 = debt({ id: "1", monthlyPaymentCents: 100_000, rateValue: 3, rateUnit: "mensal" });
    const r = buildDebtPlan(plan({ debts: [d1], monthlyAvailableCents: 100_000 }));
    expect(r.budget.status).toBe("exact");
    expect(r.budget.additionalCents).toBe(0);
    expect(r.warnings).toContain("budget-exact");
  });
});

describe("atenções antes da ordem matemática", () => {
  it("caso H: atraso com garantia entra em revisão, sem reordenar em silêncio", () => {
    const risco = debt({
      id: "carro",
      balanceCents: 2_000_000,
      rateValue: 1.8,
      rateUnit: "mensal",
      overdue: true,
      overdueDays: 40,
      collateral: "yes",
      essential: "yes",
      urgent: "risco-perda-bem",
    });
    const cartao = debt({ id: "cartao", balanceCents: 300_000, rateValue: 12, rateUnit: "mensal" });
    const r = buildDebtPlan(plan({ debts: [risco, cartao] }));
    expect(r.attentionIds).toContain("carro");
    const reasons = r.debts.find((d) => d.id === "carro")!.attentionReasons;
    expect(reasons).toEqual(
      expect.arrayContaining(["atraso", "garantia", "bem-essencial", "risco-perda-bem"]),
    );
    // a ordem matemática NÃO é alterada pela atenção
    expect(r.avalanche.orderedIds[0]).toBe("cartao");
  });

  it("caso I: pagamento que não cobre os encargos é sinalizado", () => {
    const d = normalizeDebt(
      debt({ id: "ce", balanceCents: 1_000_000, rateValue: 10, rateUnit: "mensal", monthlyPaymentCents: 50_000 }),
    );
    expect(d.attentionReasons).toContain("nao-amortiza");
    const r = buildDebtPlan(plan({ debts: [d] }));
    expect(r.warnings).toContain("non-amortizing-debt");
  });

  it("taxa extremamente alta pede conferência, sem bloquear", () => {
    const r = buildDebtPlan(plan({ debts: [debt({ id: "x", rateValue: 50, rateUnit: "mensal" })] }));
    expect(r.warnings).toContain("extreme-rate");
    expect(r.avalanche.orderedIds).toEqual(["x"]);
  });
});

describe("motor de simulação", () => {
  const modelaveis = [
    debt({ id: "cartao", type: "cartao", balanceCents: 400_000, monthlyPaymentCents: 80_000, rateValue: 12, rateUnit: "mensal" }),
    debt({ id: "emprestimo", balanceCents: 1_000_000, monthlyPaymentCents: 65_000, rateValue: 4, rateUnit: "mensal" }),
  ];

  it("caso T: com todos os dados, projeta prazo e juros estimados", () => {
    const r = buildDebtPlan(plan({ debts: modelaveis, monthlyAvailableCents: 160_000 }));
    expect(r.projection.status).toBe("full");
    expect(r.projection.avalanche!.monthsToPayoff).toBeGreaterThan(0);
    expect(r.projection.avalanche!.totalInterestCents).toBeGreaterThan(0);
    expect(r.projection.avalanche!.calendar.length).toBeGreaterThan(0);
  });

  it("caso S: dívida sem taxa bloqueia a projeção, mas não o plano de prioridade", () => {
    const semTaxa = debt({ id: "sem", balanceCents: 200_000, monthlyPaymentCents: 20_000 });
    const r = buildDebtPlan(plan({ debts: [...modelaveis, semTaxa], monthlyAvailableCents: 200_000 }));
    expect(r.projection.status).toBe("priority-only");
    expect(r.projection.avalanche).toBeNull();
    expect(r.projection.blockers.join(" ")).toContain("taxa de juros não informada");
    expect(r.snowball.orderedIds.length).toBe(3);
  });

  it("caso M: dinheiro extra encurta o prazo estimado em relação ao cenário base", () => {
    const comExtra = buildDebtPlan(plan({ debts: modelaveis, monthlyAvailableCents: 160_000 }));
    const base = comExtra.projection.baseline!;
    const acelerado = comExtra.projection.avalanche!;
    expect(acelerado.monthsToPayoff!).toBeLessThan(base.monthsToPayoff!);
  });

  it("caso N: sobra da parcela de uma dívida quase quitada vai para a próxima", () => {
    // a dívida "quase" quita no primeiro mês e sobra parcela para a outra
    const quase = debt({ id: "quase", balanceCents: 10_000, monthlyPaymentCents: 50_000, rateUnit: "sem-juros" });
    const outra = debt({ id: "outra", balanceCents: 500_000, monthlyPaymentCents: 50_000, rateUnit: "sem-juros" });
    const sim = simulatePlan(norm([quase, outra]), ["quase", "outra"], 0, 0, "avalanche")!;
    expect(sim.payoffMonthByDebt["quase"]).toBe(1);
    const mes1 = sim.calendar[0]!.allocations;
    const pagoOutra = mes1.find((a) => a.debtId === "outra")!.cents;
    // 50.000 da parcela + 40.000 que sobraram da dívida quitada
    expect(pagoOutra).toBe(90_000);
  });

  it("caso O: centavos não acumulam erro — total pago = saldo + juros", () => {
    const d1 = debt({ id: "1", balanceCents: 333_337, monthlyPaymentCents: 51_111, rateValue: 1.37, rateUnit: "mensal" });
    const d2 = debt({ id: "2", balanceCents: 777_779, monthlyPaymentCents: 83_333, rateValue: 2.11, rateUnit: "mensal" });
    const sim = simulatePlan(norm([d1, d2]), ["2", "1"], 0, 0, "avalanche")!;
    expect(sim.totalPaidCents).toBe(333_337 + 777_779 + sim.totalInterestCents);
    expect(Number.isInteger(sim.totalPaidCents)).toBe(true);
  });

  it("caso P: 10 dívidas rodam sem estourar o horizonte", () => {
    const muitas = Array.from({ length: 10 }, (_, i) =>
      debt({
        id: `d${i}`,
        balanceCents: 100_000 * (i + 1),
        monthlyPaymentCents: 20_000,
        rateValue: 1 + i * 0.5,
        rateUnit: "mensal",
      }),
    );
    const r = buildDebtPlan(plan({ debts: muitas, monthlyAvailableCents: 250_000 }));
    expect(r.totals.count).toBe(10);
    expect(r.projection.status).toBe("full");
    expect(r.projection.avalanche!.monthsToPayoff).not.toBeNull();
  });

  it("dívida que não converge não trava: interrompe no horizonte e avisa", () => {
    const impossivel = debt({
      id: "cresce",
      balanceCents: 1_000_000,
      monthlyPaymentCents: 50_000,
      rateValue: 10,
      rateUnit: "mensal",
    });
    const sim = simulatePlan(norm([impossivel]), ["cresce"], 0, 0, "avalanche")!;
    expect(sim.monthsToPayoff).toBeNull();
    expect(sim.reachedHorizon).toBe(true);
    expect(sim.calendar.length).toBeLessThanOrEqual(360);
  });

  it("caso Q e R: hipóteses do cartão e do contrato fixo são declaradas", () => {
    const r = buildDebtPlan(
      plan({
        debts: [
          debt({ id: "cartao", type: "cartao", rateValue: 12, rateUnit: "mensal" }),
          debt({ id: "fixo", type: "consignado", rateValue: 2, rateUnit: "mensal" }),
        ],
        monthlyAvailableCents: 30_000,
      }),
    );
    const texto = r.assumptions.join(" ");
    expect(texto).toContain("nenhuma compra nova");
    expect(texto).toContain("amortização que reduz o prazo");
    expect(r.debts.find((d) => d.id === "cartao")!.revolving).toBe(true);
    expect(r.debts.find((d) => d.id === "fixo")!.revolving).toBe(false);
  });
});

describe("teste do usuário leigo", () => {
  const cartao = debt({ id: "cartao", label: "Cartão", type: "cartao", balanceCents: 400_000, monthlyPaymentCents: 30_000, rateValue: 12, rateUnit: "mensal" });
  const emprestimo = debt({ id: "emprestimo", label: "Empréstimo", balanceCents: 1_000_000, monthlyPaymentCents: 65_000, rateValue: 4, rateUnit: "mensal" });
  const financiamento = debt({ id: "financiamento", label: "Financiamento", type: "financiamento-veiculo", balanceCents: 2_000_000, monthlyPaymentCents: 90_000, rateValue: 2, rateUnit: "mensal" });

  it("avalanche prioriza o cartão, porque tem a maior taxa", () => {
    const r = buildDebtPlan(
      plan({ debts: [cartao, emprestimo, financiamento], monthlyAvailableCents: 225_000 }),
    );
    expect(r.avalanche.orderedIds[0]).toBe("cartao");
    expect(r.budget.additionalCents).toBe(40_000);
  });

  it("com saldos trocados, bola de neve prioriza o empréstimo, porque é o menor saldo", () => {
    const cartaoGrande = { ...cartao, balanceCents: 900_000, rateValue: 3 };
    const emprestimoPequeno = { ...emprestimo, balanceCents: 200_000, rateValue: 2 };
    const r = buildDebtPlan(plan({ debts: [cartaoGrande, emprestimoPequeno] }));
    expect(r.snowball.orderedIds[0]).toBe("emprestimo");
    expect(r.avalanche.orderedIds[0]).toBe("cartao");
  });
});

describe("linguagem: sem promessa, sem veredito, sem diagnóstico jurídico", () => {
  it("o texto exportado não promete quitação nem elege método vencedor", () => {
    const r = buildDebtPlan(
      plan({
        debts: [
          debt({ id: "a", label: "Cartão", type: "cartao", rateValue: 12, rateUnit: "mensal" }),
          debt({ id: "b", label: "Empréstimo", balanceCents: 500_000, rateValue: 3, rateUnit: "mensal" }),
        ],
        monthlyAvailableCents: 30_000,
      }),
    );
    const texto = buildPlanText(r, "avalanche");
    expect(texto).not.toMatch(/você ficará sem dívidas|vencedor|melhor método|garantimos|superendivid/i);
    expect(texto).toContain("Estimativas, não previsões");
  });

  it("dívidas sem taxa aparecem como não informadas no texto, nunca como 0%", () => {
    const r = buildDebtPlan(
      plan({ debts: [debt({ id: "a", label: "Carnê" }), debt({ id: "b", label: "Cartão", balanceCents: 900_000 })] }),
    );
    const texto = buildPlanText(r, "snowball");
    expect(texto).toContain("taxa não informada");
    expect(texto).not.toContain("0,00% a.m.");
  });

  it("formatMonths escreve prazo legível", () => {
    expect(formatMonths(1)).toBe("1 mês");
    expect(formatMonths(8)).toBe("8 meses");
    expect(formatMonths(12)).toBe("1 ano");
    expect(formatMonths(14)).toBe("1 ano e 2 meses");
    expect(formatMonths(25)).toBe("2 anos e 1 mês");
  });
});
