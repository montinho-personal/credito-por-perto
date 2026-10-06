import { describe, expect, it } from "vitest";
import {
  BPP_RULES,
  RATE_SCENARIOS,
  SOURCES,
  ageInDays,
  capForProfile,
} from "@/lib/calculators/bpp-rules";
import {
  annualFromMonthly,
  buildSchedule,
  costsInCents,
  diagnose,
  internalRate,
  pricePaymentCents,
  simulateBpp,
  validateBpp,
  type BppInput,
  type DiagnosisInput,
} from "@/lib/calculators/bpp-simulator";

const base: BppInput = {
  profile: "mei",
  amountCents: 10_000_00,
  months: 36,
  graceMonths: 0,
  monthlyRatePercent: 0.35,
};

function ok(input: BppInput) {
  const o = simulateBpp(input);
  if (o.kind !== "ok") throw new Error(`esperava ok: ${JSON.stringify(o.errors)}`);
  return o;
}

describe("regras: cada número tem fonte e data", () => {
  it("todas as fontes têm URL https e data DD/MM/AAAA", () => {
    for (const s of Object.values(SOURCES)) {
      expect(s.url).toMatch(/^https:\/\//);
      expect(s.checkedAt).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    }
    expect(BPP_RULES.verifiedAt).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });

  it("limites estaduais: R$ 200 a R$ 21.000, a partir de 0,35% ao mês, até 36 meses", () => {
    expect(BPP_RULES.amount.minCents).toBe(200_00);
    expect(BPP_RULES.amount.maxCents).toBe(21_000_00);
    expect(BPP_RULES.rate.fromMonthlyPercent).toBe(0.35);
    expect(BPP_RULES.term.maxMonths).toBe(36);
    expect(BPP_RULES.amount.level).toBe("estadual");
  });

  it("cenários de taxa só usam taxas com fonte oficial", () => {
    expect(RATE_SCENARIOS.map((s) => s.monthlyPercent)).toEqual([0.35, 1]);
  });

  it("teto por perfil: sem CNPJ R$ 15 mil, com CNPJ R$ 21 mil, sem saber R$ 21 mil", () => {
    expect(capForProfile("sem-cnpj").capCents).toBe(15_000_00);
    expect(capForProfile("mei").capCents).toBe(21_000_00);
    expect(capForProfile("empresa").capCents).toBe(21_000_00);
    expect(capForProfile("nao-sei").capCents).toBe(21_000_00);
  });

  it("idade da verificação em dias", () => {
    expect(ageInDays("01/10/2026", new Date(Date.UTC(2026, 9, 11)))).toBe(10);
  });
});

describe("parcela pelo sistema Price (referência com 60 dígitos)", () => {
  it("R$ 10 mil, 0,35% ao mês, 36 meses → R$ 296,13", () => {
    expect(pricePaymentCents(10_000_00, 0.0035, 36)).toBe(296_13);
  });
  it("R$ 10 mil, 1% ao mês, 24 meses → R$ 470,73", () => {
    expect(pricePaymentCents(10_000_00, 0.01, 24)).toBe(470_73);
  });
  it("R$ 10 mil, 1% ao mês, 36 meses → R$ 332,14", () => {
    expect(pricePaymentCents(10_000_00, 0.01, 36)).toBe(332_14);
  });
  it("taxa zero divide o valor pelo prazo", () => {
    expect(pricePaymentCents(1_200_00, 0, 12)).toBe(100_00);
  });
});

describe("tabela e totais", () => {
  it("saldo termina em zero e os totais batem com a soma da tabela", () => {
    const { result } = ok(base);
    const last = result.schedule[result.schedule.length - 1]!;
    expect(last.balanceCents).toBe(0);
    const sum = result.schedule.reduce((a, r) => a + r.paymentCents, 0);
    expect(result.totalPaidCents).toBe(sum);
    const amort = result.schedule.reduce((a, r) => a + r.amortizationCents, 0);
    expect(amort).toBe(10_000_00);
    expect(result.totalInterestCents).toBe(result.totalPaidCents - 10_000_00);
    expect(result.paymentCents).toBe(296_13);
    expect(Math.abs(result.lastPaymentCents - result.paymentCents)).toBeLessThanOrEqual(36);
  });

  it("o total fica perto de parcela × prazo (diferença só de arredondamento)", () => {
    const { result } = ok({ ...base, monthlyRatePercent: 1 });
    expect(Math.abs(result.totalPaidCents - 332_14 * 36)).toBeLessThanOrEqual(36);
  });

  it("taxa anual equivalente por juros compostos", () => {
    expect(annualFromMonthly(1)).toBeCloseTo(12.6825, 3);
    expect(ok(base).result.annualRatePercent).toBeCloseTo(4.2818, 3);
  });
});

describe("carência: juros entram no saldo (premissa prudente)", () => {
  it("3 meses a 1% → saldo R$ 10.303,01 e parcela de R$ 485,00 em 24 meses", () => {
    const { result } = ok({ ...base, months: 24, graceMonths: 3, monthlyRatePercent: 1 });
    expect(result.balanceAfterGraceCents).toBe(10_303_01);
    expect(result.graceInterestCents).toBe(303_01);
    expect(result.paymentCents).toBe(485_00);
    expect(result.firstPaymentMonth).toBe(4);
    expect(result.schedule.filter((r) => r.phase === "carencia").every((r) => r.paymentCents === 0)).toBe(true);
    expect(result.schedule).toHaveLength(27);
  });

  it("com carência, a parcela e os juros totais ficam maiores", () => {
    const sem = ok({ ...base, months: 24, monthlyRatePercent: 1 }).result;
    const com = ok({ ...base, months: 24, graceMonths: 3, monthlyRatePercent: 1 }).result;
    expect(com.paymentCents).toBeGreaterThan(sem.paymentCents);
    expect(com.totalInterestCents).toBeGreaterThan(sem.totalInterestCents);
  });

  it("carência + parcelas acima de 36 meses gera aviso, não erro", () => {
    const o = ok({ ...base, months: 36, graceMonths: 2 });
    expect(o.warnings.some((w) => w.field === "grace")).toBe(true);
  });

  it("buildSchedule sem carência não tem linha de carência", () => {
    expect(buildSchedule(1_000_00, 0.01, 0, 6).every((r) => r.phase === "parcela")).toBe(true);
  });
});

describe("validação: nada de NaN, infinito ou valor fora do limite", () => {
  const errorsOf = (input: Partial<BppInput>) => validateBpp({ ...base, ...input }).errors.map((e) => e.field);

  it("valor vazio, zero, negativo, NaN ou infinito", () => {
    for (const v of [null, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(errorsOf({ amountCents: v as number | null })).toContain("amount");
    }
  });
  it("valor abaixo do mínimo e acima do máximo", () => {
    expect(errorsOf({ amountCents: 199_99 })).toContain("amount");
    expect(errorsOf({ amountCents: 21_000_01 })).toContain("amount");
    expect(errorsOf({ amountCents: 21_000_00 })).not.toContain("amount");
    expect(errorsOf({ amountCents: 200_00 })).not.toContain("amount");
  });
  it("sem CNPJ: acima de R$ 15 mil é recusado com mensagem própria", () => {
    const { errors } = validateBpp({ ...base, profile: "sem-cnpj", amountCents: 15_000_01 });
    expect(errors[0]?.message).toMatch(/sem CNPJ/);
  });
  it("perfil 'não sei' acima de R$ 15 mil gera aviso", () => {
    const { errors, warnings } = validateBpp({ ...base, profile: "nao-sei", amountCents: 18_000_00 });
    expect(errors).toHaveLength(0);
    expect(warnings.some((w) => w.field === "amount")).toBe(true);
  });
  it("prazo: vazio, zero, fracionado e acima de 36", () => {
    for (const m of [null, 0, 12.5, 37, Number.NaN]) {
      expect(errorsOf({ months: m as number | null })).toContain("months");
    }
    expect(errorsOf({ months: 36 })).not.toContain("months");
  });
  it("carência: negativa, fracionada e acima de 3", () => {
    for (const g of [-1, 1.5, 4, Number.NaN]) expect(errorsOf({ graceMonths: g })).toContain("grace");
  });
  it("taxa: vazia, zero, negativa e gigante", () => {
    for (const r of [null, 0, -0.5, 11, Number.POSITIVE_INFINITY]) {
      expect(errorsOf({ monthlyRatePercent: r as number | null })).toContain("rate");
    }
  });
  it("taxa fora da faixa divulgada gera aviso, não erro", () => {
    expect(validateBpp({ ...base, monthlyRatePercent: 0.2 }).warnings.map((w) => w.field)).toContain("rate");
    expect(validateBpp({ ...base, monthlyRatePercent: 2 }).warnings.map((w) => w.field)).toContain("rate");
    expect(validateBpp({ ...base, monthlyRatePercent: 0.5 }).warnings).toHaveLength(0);
  });
  it("custos negativos, maiores que o valor ou percentual inválido", () => {
    expect(errorsOf({ costs: { kind: "reais", cents: -1 } })).toContain("costs");
    expect(errorsOf({ costs: { kind: "reais", cents: 10_000_00 } })).toContain("costs");
    expect(errorsOf({ costs: { kind: "percent", percent: 100 } })).toContain("costs");
  });
  it("valores extremos válidos não produzem NaN", () => {
    for (const input of [
      { ...base, amountCents: 200_00, months: 1, monthlyRatePercent: 0.01 },
      { ...base, amountCents: 21_000_00, months: 36, graceMonths: 3, monthlyRatePercent: 10 },
    ]) {
      const { result } = ok(input);
      for (const v of [result.paymentCents, result.totalPaidCents, result.totalInterestCents, result.annualRatePercent]) {
        expect(Number.isFinite(v)).toBe(true);
      }
      expect(result.schedule.at(-1)!.balanceCents).toBe(0);
    }
  });
});

describe("CET: só com todos os custos", () => {
  it("sem confirmação, não há CET e há o motivo", () => {
    const { result } = ok({ ...base, costs: { kind: "reais", cents: 100_00 } });
    expect(result.cet).toBeNull();
    expect(result.cetUnavailableReason).toMatch(/Não é possível estimar o CET/);
  });
  it("sem custos e confirmado, o CET mensal é a própria taxa (a menos do arredondamento)", () => {
    const { result } = ok({ ...base, monthlyRatePercent: 1, costsComplete: true });
    expect(result.cet!.monthlyPercent).toBeCloseTo(1, 2);
  });
  it("custo na liberação eleva o CET acima da taxa", () => {
    const { result } = ok({ ...base, monthlyRatePercent: 1, costs: { kind: "percent", percent: 1 }, costsComplete: true });
    expect(result.costsCents).toBe(100_00);
    expect(result.cet!.monthlyPercent).toBeGreaterThan(1);
    expect(result.cet!.annualPercent).toBeGreaterThan(annualFromMonthly(1));
  });
  it("costsInCents converte percentual sobre o valor", () => {
    expect(costsInCents({ kind: "percent", percent: 2.5 }, 10_000_00)).toBe(250_00);
    expect(costsInCents(null, 10_000_00)).toBe(0);
  });
  it("taxa interna recupera 1% ao mês de uma série Price", () => {
    const pay = pricePaymentCents(10_000_00, 0.01, 12);
    expect(internalRate(10_000_00, Array(12).fill(pay))! * 100).toBeCloseTo(1, 3);
    expect(internalRate(0, [100])).toBeNull();
  });
});

describe("diagnóstico: nunca aprovação", () => {
  const all: DiagnosisInput = {
    purpose: "capital-de-giro",
    hasActivity: "sim",
    activityInCity: "sim",
    nameClear: "sim",
    training: "sim",
    sixMonths: "sim",
  };
  it("tudo atendido → aparentemente compatível", () => {
    expect(diagnose(all).verdict).toBe("aparentemente-compativel");
  });
  it("nome com restrição → possível impedimento", () => {
    expect(diagnose({ ...all, nameClear: "nao" }).verdict).toBe("possivel-impedimento");
  });
  it("dívida pessoal ou despesa da casa → possível impedimento", () => {
    expect(diagnose({ ...all, purpose: "divida-pessoal" }).verdict).toBe("possivel-impedimento");
    expect(diagnose({ ...all, purpose: "consumo" }).verdict).toBe("possivel-impedimento");
  });
  it("sem capacitação ou sem saber → precisa verificar", () => {
    expect(diagnose({ ...all, training: "nao" }).verdict).toBe("precisa-verificar");
    expect(diagnose({ ...all, nameClear: "nao-sei" }).verdict).toBe("precisa-verificar");
  });
  it("nenhum texto do diagnóstico promete aprovação", () => {
    const answers: DiagnosisInput[] = [all, { ...all, nameClear: "nao" }, { ...all, training: "nao" }];
    for (const a of answers) {
      for (const item of diagnose(a).items) {
        expect(item.text).not.toMatch(/aprovad|pré-aprovad|garantid|liberad/i);
      }
    }
  });
});

describe("correções da auditoria", () => {
  it("meio centavo exato arredonda para cima mesmo a 0,35% (0,35 ÷ 100 em binário)", () => {
    const { result } = ok({ ...base, amountCents: 210_00, months: 1, monthlyRatePercent: 0.35 });
    expect(result.schedule[0]!.interestCents).toBe(74);
    expect(result.paymentCents).toBe(210_74);
  });
  it("R$ 200, 0,35%, 2 meses de carência, 21 parcelas: última parcela de R$ 10,04", () => {
    const { result } = ok({ ...base, amountCents: 200_00, months: 21, graceMonths: 2, monthlyRatePercent: 0.35 });
    expect(result.lastPaymentCents).toBe(10_04);
  });
  it("CET acima de 100% ao mês é calculado, não some", () => {
    const { result } = ok({ ...base, months: 1, monthlyRatePercent: 10, costs: { kind: "percent", percent: 46 }, costsComplete: true });
    expect(result.cet).not.toBeNull();
    expect(result.cet!.monthlyPercent).toBeGreaterThan(100);
  });
  it("custo percentual que arredonda para o valor inteiro é recusado", () => {
    const { errors } = validateBpp({ ...base, amountCents: 200_00, costs: { kind: "percent", percent: 99.999 } });
    expect(errors.map((e) => e.field)).toContain("costs");
  });
  it("entradas ilegíveis têm mensagem própria", () => {
    const v = (p: Partial<BppInput>) => validateBpp({ ...base, ...p }).errors.map((e) => e.message).join(" ");
    expect(v({ amountCents: Number.NaN })).toMatch(/só com números/);
    expect(v({ monthlyRatePercent: Number.NaN })).toMatch(/só com números/);
    expect(v({ costs: { kind: "reais", cents: Number.NaN } })).toMatch(/só com números/);
  });
  it("avisos de taxa citam os valores das regras", () => {
    expect(validateBpp({ ...base, monthlyRatePercent: 0.2 }).warnings[0]!.message).toMatch(/0,35%/);
    expect(validateBpp({ ...base, monthlyRatePercent: 2 }).warnings[0]!.message).toMatch(/1%/);
  });
});
