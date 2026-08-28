import { describe, expect, it } from "vitest";
import {
  comparePayoffOptions,
  isQuoteOutdated,
  monthlyRateOf,
  pricePaymentCents,
  runSchedule,
  simulatePartialAmortization,
  validateModel,
  type PartialAmortizationInput,
} from "@/lib/calculators/partial-amortization";

function input(p: Partial<PartialAmortizationInput> = {}): PartialAmortizationInput {
  return {
    balanceCents: 1_000_000,
    remainingMonths: 12,
    rateValue: 1,
    rateUnit: "mensal",
    system: "price",
    extraPaymentCents: 0,
    ...p,
  };
}

/* ------------------------------------------------------------------ *
 * Validação contra planilha independente
 * ------------------------------------------------------------------ */

describe("conferência contra valores de planilha independentes", () => {
  it("caso I — Price: R$ 10.000 a 1% a.m. em 12x dá parcela de R$ 888,49", () => {
    // PMT = PV·i(1+i)^n / ((1+i)^n − 1) = 10000 × 0,01 × 1,1268250 / 0,1268250
    expect(pricePaymentCents(1_000_000, 0.01, 12)).toBe(88_849);
  });

  it("caso I — o cronograma Price fecha em 12 pagamentos e zera o saldo", () => {
    const s = runSchedule("price", 1_000_000, 0.01, 88_849)!;
    expect(s.months).toBe(12);
    // total pago = saldo + juros, sem sobra nem falta
    expect(s.totalPaidCents).toBe(1_000_000 + s.totalInterestCents);
    // juros de referência da planilha: ~R$ 661,88
    expect(s.totalInterestCents).toBeGreaterThan(66_000);
    expect(s.totalInterestCents).toBeLessThan(66_300);
  });

  it("caso J — SAC: R$ 12.000 a 1% em 12x soma R$ 780,00 de juros", () => {
    // juros SAC = i × PV × (n+1)/2 = 0,01 × 12.000 × 6,5 = 780
    const s = runSchedule("sac", 1_200_000, 0.01, 100_000)!;
    expect(s.months).toBe(12);
    expect(s.totalInterestCents).toBe(78_000);
    expect(s.totalPaidCents).toBe(1_278_000);
    // parcela decrescente: primeira 1.120,00 e última 1.010,00
    expect(s.firstPaymentCents).toBe(112_000);
    expect(s.lastPaymentCents).toBe(101_000);
  });

  it("Price com taxa zero devolve parcela igual ao saldo dividido pelo prazo", () => {
    expect(pricePaymentCents(1_200_000, 0, 12)).toBe(100_000);
  });
});

/* ------------------------------------------------------------------ *
 * Modelabilidade
 * ------------------------------------------------------------------ */

describe("o que a ferramenta se recusa a simular", () => {
  it("caso K — sistema desconhecido não vira projeção", () => {
    const r = simulatePartialAmortization(input({ system: "nao-sei", extraPaymentCents: 200_000 }));
    expect(r.status).toBe("blocked");
    expect(r.warnings).toContain("system-unknown");
    expect(r.reduceTerm).toBeNull();
    expect(r.reducePayment).toBeNull();
  });

  it("caso K — sistema 'outro' também bloqueia, sem assumir Price", () => {
    const r = simulatePartialAmortization(input({ system: "outro", extraPaymentCents: 200_000 }));
    expect(r.status).toBe("blocked");
    expect(r.warnings).toContain("system-unknown");
  });

  it("caso L — amortizar mais que o saldo não passa em silêncio", () => {
    const r = simulatePartialAmortization(input({ extraPaymentCents: 1_500_000 }));
    expect(r.status).toBe("blocked");
    expect(r.warnings).toContain("extra-exceeds-balance");
  });

  it("caso M — amortização igual ao saldo é quitação total, não amortização parcial", () => {
    const r = simulatePartialAmortization(input({ extraPaymentCents: 1_000_000 }));
    expect(r.status).toBe("blocked");
    expect(r.warnings).toContain("extra-equals-balance");
  });

  it("caso N — sem taxa não há simulação", () => {
    const r = simulatePartialAmortization(
      input({ rateValue: null, rateUnit: "mensal", extraPaymentCents: 200_000 }),
    );
    expect(r.status).toBe("blocked");
    expect(r.warnings).toContain("missing-rate");
  });

  it("caso O — taxa anual é convertida por equivalência composta, não por ÷12", () => {
    const mensal = monthlyRateOf(60, "anual")!;
    expect(mensal).toBeCloseTo(0.03994, 4);
    expect(mensal).not.toBeCloseTo(0.05, 3);
  });

  it("caso P — taxa zero declarada funciona e é diferente de taxa ausente", () => {
    expect(monthlyRateOf(null, "sem-juros")).toBe(0);
    expect(monthlyRateOf(null, "mensal")).toBeNull();
    const r = simulatePartialAmortization(
      input({ rateValue: null, rateUnit: "sem-juros", extraPaymentCents: 200_000 }),
    );
    expect(r.status).toBe("simulated");
    expect(r.baseline!.totalInterestCents).toBe(0);
  });

  it("prazo ou saldo ausentes bloqueiam", () => {
    expect(validateModel(input({ remainingMonths: 0 }))).toContain("missing-term");
    expect(validateModel(input({ balanceCents: 0 }))).toContain("missing-balance");
  });
});

/* ------------------------------------------------------------------ *
 * Reduzir prazo × reduzir parcela
 * ------------------------------------------------------------------ */

describe("os dois caminhos da amortização parcial", () => {
  const base = input({ balanceCents: 2_000_000, remainingMonths: 24, rateValue: 1.5, extraPaymentCents: 500_000 });

  it("reduzir prazo encurta o contrato e reduzir parcela mantém o prazo", () => {
    const r = simulatePartialAmortization(base);
    expect(r.status).toBe("simulated");
    expect(r.balanceAfterCents).toBe(1_500_000);
    expect(r.reduceTerm!.months).toBeLessThan(r.baseline!.months);
    expect(r.reducePayment!.months).toBe(r.baseline!.months);
  });

  it("reduzir prazo tende a somar menos juros nesta simulação, sem virar veredito", () => {
    const r = simulatePartialAmortization(base);
    expect(r.reduceTerm!.totalInterestCents).toBeLessThan(r.reducePayment!.totalInterestCents);
    // e a parcela do cenário de alívio é realmente menor
    expect(r.reducePayment!.firstPaymentCents).toBeLessThan(r.reduceTerm!.firstPaymentCents);
  });

  it("os dois cenários fecham a conta: total pago = saldo restante + juros", () => {
    const r = simulatePartialAmortization(base);
    for (const s of [r.reduceTerm!, r.reducePayment!]) {
      expect(s.totalPaidCents).toBe(r.balanceAfterCents! + s.totalInterestCents);
    }
  });

  it("SAC também roda nos dois caminhos", () => {
    const r = simulatePartialAmortization({ ...base, system: "sac" });
    expect(r.status).toBe("simulated");
    expect(r.reduceTerm!.months).toBeLessThan(r.baseline!.months);
    expect(r.reducePayment!.months).toBe(24);
    expect(r.assumptions.join(" ")).toContain("amortização constante");
  });

  it("as hipóteses do modelo são sempre declaradas", () => {
    const r = simulatePartialAmortization(base);
    const texto = r.assumptions.join(" ");
    expect(texto).toContain("Taxa de juros constante");
    expect(texto).toContain("o número oficial é o da instituição");
  });
});

/* ------------------------------------------------------------------ *
 * Comparador de simulações oficiais
 * ------------------------------------------------------------------ */

describe("caso S — comparar as duas simulações da instituição", () => {
  it("calcula os totais e a diferença sem eleger vencedor", () => {
    // opção A: 18 pagamentos de R$ 850 | opção B: 24 pagamentos de R$ 680
    const c = comparePayoffOptions(
      { months: 18, paymentCents: 85_000 },
      { months: 24, paymentCents: 68_000 },
    );
    expect(c.status).toBe("compared");
    expect(c.reduceTerm!.totalCents).toBe(1_530_000);
    expect(c.reducePayment!.totalCents).toBe(1_632_000);
    expect(c.totalDifferenceCents).toBe(102_000);
    expect(c.monthsDifference).toBe(6);
    expect(c.monthlyReliefCents).toBe(17_000);
    const texto = c.sentences.join(" ");
    expect(texto).toContain("R$ 15.300,00");
    expect(texto).toContain("R$ 16.320,00");
    expect(texto).not.toMatch(/melhor opção|recomendamos|vencedor|escolha reduzir/i);
  });

  it("mostra o alívio mensal do cenário de parcela menor", () => {
    const c = comparePayoffOptions(
      { months: 18, paymentCents: 85_000 },
      { months: 24, paymentCents: 68_000 },
    );
    expect(c.sentences.join(" ")).toContain("alivia R$ 170,00 por mês");
  });

  it("com uma das simulações faltando, pede a outra em vez de inventar", () => {
    const c = comparePayoffOptions({ months: 18, paymentCents: 85_000 }, null);
    expect(c.status).toBe("incomplete");
    expect(c.totalDifferenceCents).toBeNull();
    expect(c.sentences.join(" ")).toContain("Informe as duas simulações");
  });

  it("totais iguais são reportados como empate, sem forçar diferença", () => {
    const c = comparePayoffOptions(
      { months: 10, paymentCents: 100_000 },
      { months: 20, paymentCents: 50_000 },
    );
    expect(c.totalDifferenceCents).toBe(0);
    expect(c.sentences.join(" ")).toContain("somam o mesmo total");
  });

  it("caso T — centavos não acumulam erro no comparador", () => {
    const c = comparePayoffOptions(
      { months: 7, paymentCents: 85_337 },
      { months: 13, paymentCents: 47_119 },
    );
    expect(c.reduceTerm!.totalCents).toBe(597_359);
    expect(c.reducePayment!.totalCents).toBe(612_547);
    expect(c.totalDifferenceCents).toBe(15_188);
  });
});

/* ------------------------------------------------------------------ *
 * Validade do saldo informado
 * ------------------------------------------------------------------ */

describe("caso H — validade do valor de quitação", () => {
  it("data anterior a hoje marca o valor como possivelmente desatualizado", () => {
    expect(isQuoteOutdated("2026-08-20", "2026-08-28")).toBe(true);
  });

  it("data de hoje ou futura continua válida", () => {
    expect(isQuoteOutdated("2026-08-28", "2026-08-28")).toBe(false);
    expect(isQuoteOutdated("2026-09-10", "2026-08-28")).toBe(false);
  });

  it("data vazia ou inválida não gera alarme falso", () => {
    expect(isQuoteOutdated("", "2026-08-28")).toBe(false);
    expect(isQuoteOutdated("28/08/2026", "2026-08-28")).toBe(false);
  });
});
