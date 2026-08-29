import { readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { describe, expect, it } from "vitest";
import {
  comparePaymentOptions,
  computeCashDiscount,
  computeOption,
  emptyOption,
  presentValueOfInstallments,
  toMonthlyRate,
  validateOption,
  type PaymentOption,
} from "@/lib/calculators/cash-vs-installments";

/** `Intl` usa espaço não separável depois de "R$". */
const nb = (value: string) => value.replace(/ /g, " ");

function aVista(id: string, cents: number, extra = 0): PaymentOption {
  return { ...emptyOption(id), type: "cash", cashCents: cents, extraCostsCents: extra };
}

function parcelado(
  id: string,
  count: number,
  installmentCents: number,
  entryCents = 0,
  extra = 0,
): PaymentOption {
  return {
    ...emptyOption(id, "installments"),
    entryCents,
    installmentMode: "uniform",
    installmentCount: count,
    installmentCents,
    extraCostsCents: extra,
  };
}

/* ------------------------------------------------------------------ *
 * Aritmética nominal — casos A a G
 * ------------------------------------------------------------------ */

describe("casos A–D — o preço até o fim", () => {
  it("caso A — R$ 4.500 à vista contra 12 × R$ 425 dá +R$ 600 e 13,33%", () => {
    const out = comparePaymentOptions({
      options: [aVista("a", 450_000), parcelado("b", 12, 42_500)],
    });
    const c = out.cashVsInstallments!;
    expect(c.cashTotalCents).toBe(450_000);
    expect(c.installmentTotalCents).toBe(510_000);
    expect(c.differenceCents).toBe(60_000);
    expect(c.differencePercent).toBeCloseTo(13.3333, 3);
    expect(c.relation).toBe("installments-cost-more");
  });

  it("caso B — totais iguais são reportados como custo nominal igual", () => {
    const out = comparePaymentOptions({
      options: [aVista("a", 480_000), parcelado("b", 12, 40_000)],
    });
    const c = out.cashVsInstallments!;
    expect(c.differenceCents).toBe(0);
    expect(c.relation).toBe("equal");
    const texto = c.sentences.join(" ");
    expect(texto).toContain("mesmo custo nominal");
    /* o ponto central: totais iguais não são equivalência econômica */
    expect(texto).toContain("quando o dinheiro sai");
  });

  it("caso B — total igual nunca vira recomendação de parcelar", () => {
    const out = comparePaymentOptions({
      options: [aVista("a", 480_000), parcelado("b", 12, 40_000)],
    });
    const texto = JSON.stringify(out).toLowerCase();
    expect(texto).not.toMatch(/melhor parcelar|vale a pena parcelar|prefira parcelar/);
    expect(texto).not.toMatch(/sem custo|de gra[çc]a|gratuito/);
  });

  it("caso C — parcelado mais barato funciona e pede conferência", () => {
    const out = comparePaymentOptions({
      options: [aVista("a", 500_000), parcelado("b", 12, 10_000)],
    });
    const c = out.cashVsInstallments!;
    expect(c.relation).toBe("installments-cost-less");
    expect(c.differenceCents).toBe(-380_000);
    expect(c.sentences.join(" ")).toContain("digitados corretamente");
    /* não acusa erro nem promoção falsa */
    expect(c.sentences.join(" ")).not.toMatch(/erro|inv[áa]lido|imposs[íi]vel/i);
  });

  it("caso D — entrada de R$ 1.000 + 10 × R$ 400 soma R$ 5.000", () => {
    const r = computeOption(parcelado("d", 10, 40_000, 100_000));
    expect(r.upfrontCents).toBe(100_000);
    expect(r.installmentsTotalCents).toBe(400_000);
    expect(r.totalCents).toBe(500_000);
  });

  it("caso D — a entrada nunca some do total", () => {
    const sem = computeOption(parcelado("x", 10, 40_000, 0));
    const com = computeOption(parcelado("y", 10, 40_000, 100_000));
    expect(com.totalCents - sem.totalCents).toBe(100_000);
  });

  it("caso E — entrada maior que o preço à vista é aceita e comparada", () => {
    const out = comparePaymentOptions({
      options: [aVista("a", 300_000), parcelado("b", 6, 20_000, 400_000)],
    });
    expect(out.status).toBe("ok");
    expect(out.options[1]!.totalCents).toBe(520_000);
    expect(out.labels.a).toContain("lowest-upfront");
  });

  it("caso F — parcelas variáveis usam o total informado", () => {
    const option: PaymentOption = {
      ...emptyOption("f", "installments"),
      entryCents: 50_000,
      installmentMode: "total",
      installmentCount: 24,
      installmentCents: null,
      installmentsTotalCents: 600_000,
      extraCostsCents: 0,
    };
    const r = computeOption(option);
    expect(r.installmentsTotalCents).toBe(600_000);
    expect(r.totalCents).toBe(650_000);
    expect(r.installmentCents).toBeNull();
  });

  it("caso G — custo adicional entra no total e fica visível", () => {
    const r = computeOption(parcelado("g", 12, 40_000, 0, 5_000));
    expect(r.extraCostsCents).toBe(5_000);
    expect(r.totalCents).toBe(485_000);
    expect(nb(r.sentence)).toContain("R$ 50,00");
  });

  it("caso M — centavos não acumulam erro", () => {
    const r = computeOption(parcelado("m", 7, 33_333));
    expect(r.totalCents).toBe(233_331);
  });

  it("caso N — 100 parcelas funcionam", () => {
    const r = computeOption(parcelado("n", 100, 10_000));
    expect(r.installmentCount).toBe(100);
    expect(r.totalCents).toBe(1_000_000);
  });
});

/* ------------------------------------------------------------------ *
 * Desconto à vista — as duas bases
 * ------------------------------------------------------------------ */

describe("casos H e I — desconto à vista não é o custo de parcelar", () => {
  it("caso H — R$ 5.000 de referência e R$ 4.600 à vista dá R$ 400 e 8%", () => {
    const d = computeCashDiscount(500_000, 460_000)!;
    expect(d.discountCents).toBe(40_000);
    expect(d.discountPercent).toBeCloseTo(8, 10);
    expect(nb(d.sentence)).toContain("preço de referência");
  });

  it("caso I — as duas métricas convivem com bases declaradas", () => {
    /* referência 5.000; à vista 4.600; parcelado 5.280 */
    const out = comparePaymentOptions({
      referencePriceCents: 500_000,
      options: [aVista("a", 460_000), parcelado("b", 12, 44_000)],
    });
    expect(out.cashDiscount!.discountCents).toBe(40_000);
    expect(out.cashDiscount!.discountPercent).toBeCloseTo(8, 10);

    const c = out.cashVsInstallments!;
    expect(c.differenceCents).toBe(68_000);
    expect(c.differencePercent).toBeCloseTo(14.7826, 3);
  });

  it("caso I — o resultado avisa que as bases são diferentes", () => {
    const out = comparePaymentOptions({
      referencePriceCents: 500_000,
      options: [aVista("a", 460_000), parcelado("b", 12, 44_000)],
    });
    const nota = out.notes.join(" ");
    expect(nota).toContain("bases diferentes");
    expect(nota).toContain("preço de referência");
    expect(nota).toContain("preço à vista");
    expect(nota).toContain("não devem ser somados");
  });

  it("sem preço de referência não há desconto calculado", () => {
    const out = comparePaymentOptions({
      options: [aVista("a", 460_000), parcelado("b", 12, 44_000)],
    });
    expect(out.cashDiscount).toBeNull();
  });

  it("preço à vista igual à referência não inventa desconto", () => {
    const d = computeCashDiscount(500_000, 500_000)!;
    expect(d.discountCents).toBe(0);
    expect(d.sentence).toContain("não há desconto");
  });
});

/* ------------------------------------------------------------------ *
 * Validação
 * ------------------------------------------------------------------ */

describe("casos J, K e L — o que a ferramenta se recusa a calcular", () => {
  it("caso J — zero parcelas é dado incompleto", () => {
    expect(validateOption(parcelado("j", 0, 40_000))).toContain("missing-installment-count");
  });

  it("caso K — parcela zero ou negativa é bloqueada", () => {
    expect(validateOption(parcelado("k", 12, 0))).toContain("missing-installment-amount");
    expect(validateOption(parcelado("k2", 12, -100))).toContain("missing-installment-amount");
  });

  it("caso L — preço à vista zero não passa em silêncio", () => {
    expect(validateOption(aVista("l", 0))).toContain("missing-cash-amount");
    const out = comparePaymentOptions({ options: [aVista("l", 0)] });
    expect(out.status).toBe("blocked");
  });

  it("nenhuma opção completa bloqueia com motivo legível", () => {
    const out = comparePaymentOptions({ options: [aVista("a", 0), parcelado("b", 0, 0)] });
    expect(out.status).toBe("blocked");
    expect(out.blockingReasons.join(" ")).toContain("ao menos uma forma de pagamento");
  });

  it("uma opção só não recebe rótulo de comparação", () => {
    const out = comparePaymentOptions({ options: [aVista("a", 450_000)] });
    expect(out.status).toBe("ok");
    expect(out.labels.a).toEqual([]);
    expect(out.cashVsInstallments).toBeNull();
  });
});

/* ------------------------------------------------------------------ *
 * Três formas de pagamento
 * ------------------------------------------------------------------ */

describe("caso O — três formas de pagamento e rótulos factuais", () => {
  const out = comparePaymentOptions({
    options: [
      { ...aVista("a", 450_000), method: "pix" },
      parcelado("b", 6, 78_000),
      parcelado("c", 12, 42_500),
    ],
  });

  it("identifica menor total, menor desembolso e menor prazo", () => {
    expect(out.labels.a).toContain("lowest-total");
    expect(out.labels.b).toContain("shortest-term");
    expect(out.labels.c).toContain("lowest-installment");
  });

  it("o menor desembolso imediato é de quem não pede nada no ato", () => {
    /* as duas parceladas têm entrada zero: empate legítimo */
    expect(out.labels.b).toContain("lowest-upfront");
    expect(out.labels.c).toContain("lowest-upfront");
  });

  it("compara a à vista com a parcelada de maior total", () => {
    expect(out.cashVsInstallments!.installmentOptionId).toBe("c");
  });

  it("o rótulo do Pix é apenas visual e não muda conta nenhuma", () => {
    const comPix = computeOption({ ...aVista("x", 450_000), method: "pix" });
    const semPix = computeOption(aVista("y", 450_000));
    expect(comPix.totalCents).toBe(semPix.totalCents);
    expect(comPix.label).toContain("Pix");
  });

  it("nenhuma saída elege vencedor nem recomenda forma de pagamento", () => {
    const texto = JSON.stringify(out).toLowerCase();
    for (const proibido of [
      "melhor",
      "ideal",
      "recomendad",
      "vencedor",
      "prefira",
      "pague à vista",
      "vale a pena",
      "pix é sempre",
    ]) {
      expect(texto).not.toContain(proibido);
    }
  });

  it("o trade-off entre menor parcela e menor total é dito", () => {
    const tres = comparePaymentOptions({
      options: [aVista("a", 450_000), parcelado("b", 6, 78_000), parcelado("c", 12, 42_500)],
    });
    expect(nb(tres.tradeoffs.join(" "))).toContain("menor parcela");
  });
});

/* ------------------------------------------------------------------ *
 * Modo avançado — valor presente
 * ------------------------------------------------------------------ */

describe("valor do dinheiro no tempo", () => {
  it("taxa anual vira mensal por equivalência composta, nunca ÷ 12", () => {
    const mensal = toMonthlyRate({ value: 12.6825, unit: "anual", firstInstallment: "em-um-mes" });
    expect(mensal).toBeCloseTo(0.01, 6);
    expect(mensal).not.toBeCloseTo(12.6825 / 12 / 100, 4);
  });

  it("taxa zero devolve a soma nominal das parcelas", () => {
    expect(presentValueOfInstallments(40_000, 12, 0, "em-um-mes")).toBe(480_000);
    expect(presentValueOfInstallments(40_000, 12, 0, "hoje")).toBe(480_000);
  });

  it("postecipada: 12 × R$ 400 a 1% a.m. vale R$ 4.502,03 hoje", () => {
    /* PV = 400 × (1 − 1,01^−12) / 0,01 = 4.502,0288… */
    const pv = presentValueOfInstallments(40_000, 12, 0.01, "em-um-mes");
    expect(pv / 100).toBeCloseTo(4502.03, 1);
  });

  it("antecipada é exatamente (1+i) vezes a postecipada", () => {
    const post = presentValueOfInstallments(40_000, 12, 0.01, "em-um-mes");
    const ante = presentValueOfInstallments(40_000, 12, 0.01, "hoje");
    expect(ante).toBeCloseTo(post * 1.01, 6);
  });

  it("a primeira parcela hoje encarece o plano em valor presente", () => {
    const post = presentValueOfInstallments(40_000, 12, 0.01, "em-um-mes");
    const ante = presentValueOfInstallments(40_000, 12, 0.01, "hoje");
    expect(ante).toBeGreaterThan(post);
  });

  it("com totais nominais iguais, o valor presente do parcelado fica abaixo", () => {
    const out = comparePaymentOptions({
      options: [aVista("a", 480_000), parcelado("b", 12, 40_000)],
      opportunityRate: { value: 1, unit: "mensal", firstInstallment: "em-um-mes" },
    });
    const pv = out.presentValue!;
    expect(pv.nominalTotalCents).toBe(480_000);
    expect(pv.presentValueCents).toBeLessThan(480_000);
    expect(pv.differenceCents).toBeLessThan(0);
  });

  it("o resultado avançado é rotulado como cenário, não recomendação", () => {
    const out = comparePaymentOptions({
      options: [aVista("a", 480_000), parcelado("b", 12, 40_000)],
      opportunityRate: { value: 1, unit: "mensal", firstInstallment: "em-um-mes" },
    });
    const texto = out.presentValue!.sentences.join(" ");
    expect(texto).toContain("Cenário matemático");
    expect(texto).toContain("não recomendação");
    expect(texto).toContain("não é garantido");
    expect(texto).not.toMatch(/melhor parcelar|prefira|deve parcelar/i);
  });

  it("a entrada não é descontada: sai hoje, vale o valor de face", () => {
    const out = comparePaymentOptions({
      options: [aVista("a", 500_000), parcelado("b", 10, 40_000, 100_000)],
      opportunityRate: { value: 1, unit: "mensal", firstInstallment: "em-um-mes" },
    });
    const pv = out.presentValue!;
    const pvParcelas = presentValueOfInstallments(40_000, 10, 0.01, "em-um-mes");
    expect(pv.presentValueCents).toBe(Math.round(pvParcelas + 100_000));
  });

  it("sem taxa informada, o modo avançado não roda", () => {
    const out = comparePaymentOptions({
      options: [aVista("a", 480_000), parcelado("b", 12, 40_000)],
    });
    expect(out.presentValue).toBeNull();
  });

  it("o break-even é o preço à vista que iguala as duas opções", () => {
    const out = comparePaymentOptions({
      options: [aVista("a", 480_000), parcelado("b", 12, 40_000)],
      opportunityRate: { value: 1, unit: "mensal", firstInstallment: "em-um-mes" },
    });
    const pv = out.presentValue!;
    expect(pv.breakEvenCashPriceCents).toBe(pv.presentValueCents);
  });
});

/* ------------------------------------------------------------------ *
 * Sanidade
 * ------------------------------------------------------------------ */

describe("sanidade: a direção dos números nunca inverte", () => {
  it("parcela maior nunca reduz o total", () => {
    const menor = computeOption(parcelado("a", 12, 40_000));
    const maior = computeOption(parcelado("b", 12, 45_000));
    expect(maior.totalCents).toBeGreaterThan(menor.totalCents);
  });

  it("mais parcelas com o mesmo valor nunca reduzem o total", () => {
    const curto = computeOption(parcelado("a", 6, 40_000));
    const longo = computeOption(parcelado("b", 12, 40_000));
    expect(longo.totalCents).toBeGreaterThan(curto.totalCents);
  });

  it("custo adicional nunca reduz o total", () => {
    const sem = computeOption(parcelado("a", 12, 40_000, 0, 0));
    const com = computeOption(parcelado("b", 12, 40_000, 0, 10_000));
    expect(com.totalCents).toBeGreaterThan(sem.totalCents);
  });

  it("taxa de oportunidade maior nunca aumenta o valor presente", () => {
    const baixa = presentValueOfInstallments(40_000, 12, 0.005, "em-um-mes");
    const alta = presentValueOfInstallments(40_000, 12, 0.02, "em-um-mes");
    expect(alta).toBeLessThan(baixa);
  });
});

/* ------------------------------------------------------------------ *
 * Área protegida
 * ------------------------------------------------------------------ */

describe("a área da ferramenta é protegida de anúncio", () => {
  const arquivos = [
    "src/components/calculators/CashVsInstallmentsCalculator.tsx",
    "src/app/calculadoras/a-vista-ou-parcelado/page.tsx",
  ];
  const semComentarios = (fonte: string) =>
    fonte.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

  it("nenhum slot de AdSense na ferramenta nem na página", () => {
    /*
     * Um anúncio de cartão de crédito entre as formas de pagamento seria
     * lido como uma terceira opção. É o erro que esta página não pode
     * cometer.
     */
    for (const arquivo of arquivos) {
      expect(
        readFileSync(resolvePath(process.cwd(), arquivo), "utf8"),
        arquivo,
      ).not.toMatch(/AdSlot|adsbygoogle|shouldRenderAd/);
    }
  });

  it("nem a ferramenta nem a página recomendam forma de pagamento", () => {
    for (const arquivo of arquivos) {
      const fonte = semComentarios(readFileSync(resolvePath(process.cwd(), arquivo), "utf8"));
      expect(fonte, arquivo).not.toMatch(
        /pague à vista|prefira parcelar|melhor forma de pagamento|opção recomendada/i,
      );
    }
  });
});
