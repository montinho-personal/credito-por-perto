import { readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { describe, expect, it } from "vitest";
import {
  analyzeRenegotiation,
  checkAnnouncedDiscount,
  computeOffer,
  emptyOffer,
  validateOffer,
  type RenegotiationOffer,
} from "@/lib/calculators/debt-renegotiation";

/**
 * `Intl.NumberFormat` separa "R$" do número com espaço não separável (U+00A0).
 * Comparar com espaço comum falha silenciosamente, então todo texto conferido
 * aqui passa por esta normalização.
 */
const nb = (value: string) => value.replace(/\u00A0/g, " ");

function cash(id: string, cents: number, extra = 0): RenegotiationOffer {
  return { ...emptyOffer(id), type: "cash", cashCents: cents, extraCostsCents: extra };
}

function parcelado(
  id: string,
  count: number,
  installmentCents: number,
  entryCents = 0,
  extra = 0,
): RenegotiationOffer {
  return {
    ...emptyOffer(id),
    type: entryCents > 0 ? "entry-installments" : "installments-only",
    cashCents: null,
    entryCents,
    installmentMode: "uniform",
    installmentCount: count,
    installmentCents,
    extraCostsCents: extra,
  };
}

/* ------------------------------------------------------------------ *
 * Aritmética do acordo
 * ------------------------------------------------------------------ */

describe("casos A–D — o total do acordo", () => {
  it("caso A — à vista: R$ 10.000 de saldo, oferta de R$ 4.000, redução de 60%", () => {
    const r = computeOffer(cash("a", 400_000), 1_000_000);
    expect(r.totalCents).toBe(400_000);
    expect(r.upfrontCents).toBe(400_000);
    expect(r.reductionCents).toBe(600_000);
    expect(r.reductionPercent).toBeCloseTo(60, 10);
    expect(r.relationToReference).toBe("below");
  });

  it("caso B — entrada + parcelas: R$ 1.000 + 18 × R$ 300 = R$ 6.400", () => {
    const r = computeOffer(parcelado("b", 18, 30_000, 100_000), 1_000_000);
    expect(r.upfrontCents).toBe(100_000);
    expect(r.installmentsTotalCents).toBe(540_000);
    expect(r.totalCents).toBe(640_000);
    expect(r.reductionCents).toBe(360_000);
    expect(r.reductionPercent).toBeCloseTo(36, 10);
  });

  it("caso B — a entrada nunca some do total", () => {
    const semEntrada = computeOffer(parcelado("x", 18, 30_000, 0), null);
    const comEntrada = computeOffer(parcelado("y", 18, 30_000, 100_000), null);
    expect(comEntrada.totalCents - semEntrada.totalCents).toBe(100_000);
  });

  it("caso C — sem entrada: 24 × R$ 250 = R$ 6.000", () => {
    const r = computeOffer(parcelado("c", 24, 25_000), null);
    expect(r.upfrontCents).toBe(0);
    expect(r.totalCents).toBe(600_000);
  });

  it("caso D — total acima do saldo é reportado como fato, sem adjetivo", () => {
    const r = computeOffer(parcelado("d", 36, 17_000), 500_000);
    expect(r.totalCents).toBe(612_000);
    expect(r.reductionCents).toBe(-112_000);
    expect(r.relationToReference).toBe("above");

    const out = analyzeRenegotiation({
      referenceBalanceCents: 500_000,
      offers: [parcelado("d", 36, 17_000)],
    });
    const texto = nb(out.notes.join(" "));
    expect(texto).toContain("R$ 1.120,00");
    expect(texto).toMatch(/maior que o saldo/);
    expect(texto).not.toMatch(/abusiv|absurd|golpe/i);
  });

  it("caso M — custos adicionais entram no total e ficam visíveis à parte", () => {
    const r = computeOffer(parcelado("m", 12, 20_000, 50_000, 15_000), null);
    expect(r.extraCostsCents).toBe(15_000);
    expect(r.totalCents).toBe(50_000 + 240_000 + 15_000);
  });

  it("caso L — centavos não acumulam erro", () => {
    const r = computeOffer(parcelado("l", 7, 33_333), null);
    expect(r.totalCents).toBe(233_331);
  });

  it("caso N — parcelas diferentes usam o total informado, sem multiplicar a primeira", () => {
    const offer: RenegotiationOffer = {
      ...emptyOffer("n"),
      type: "entry-installments",
      cashCents: null,
      entryCents: 100_000,
      installmentMode: "total",
      installmentCount: 10,
      installmentCents: null,
      installmentsTotalCents: 480_000,
      extraCostsCents: 0,
    };
    const r = computeOffer(offer, null);
    expect(r.installmentsTotalCents).toBe(480_000);
    expect(r.totalCents).toBe(580_000);
    /* sem valor único de parcela, a ferramenta não inventa um */
    expect(r.installmentCents).toBeNull();
  });
});

/* ------------------------------------------------------------------ *
 * Validação
 * ------------------------------------------------------------------ */

describe("casos I e J — o que a ferramenta se recusa a calcular", () => {
  it("caso I — proposta à vista de zero não passa em silêncio", () => {
    expect(validateOffer(cash("i", 0))).toContain("missing-cash-amount");
    const out = analyzeRenegotiation({
      referenceBalanceCents: 1_000_000,
      offers: [cash("i", 0)],
    });
    expect(out.status).toBe("blocked");
  });

  it("caso J — saldo zero é bloqueado", () => {
    const out = analyzeRenegotiation({
      referenceBalanceCents: 0,
      offers: [cash("j", 400_000)],
    });
    expect(out.status).toBe("blocked");
    expect(out.blockingReasons.join(" ")).toContain("maior que zero");
  });

  it("parcelado sem quantidade ou sem valor de parcela é incompleto", () => {
    expect(validateOffer(parcelado("x", 0, 30_000))).toContain("missing-installment-count");
    expect(validateOffer(parcelado("y", 12, 0))).toContain("missing-installment-amount");
  });

  it("sem saldo de referência a comparação continua funcionando", () => {
    const out = analyzeRenegotiation({
      referenceBalanceCents: null,
      offers: [cash("a", 400_000), parcelado("b", 12, 40_000)],
    });
    expect(out.status).toBe("ok");
    expect(out.offers[0]!.reductionPercent).toBeNull();
    expect(out.notes.join(" ")).toContain("não para calcular a redução");
  });
});

/* ------------------------------------------------------------------ *
 * Comparação entre propostas
 * ------------------------------------------------------------------ */

describe("caso E — três propostas, quatro rótulos factuais", () => {
  const out = analyzeRenegotiation({
    referenceBalanceCents: 1_200_000,
    offers: [
      cash("a", 580_000),
      parcelado("b", 18, 34_000, 100_000),
      parcelado("c", 36, 24_500),
    ],
  });

  it("os totais batem com o exemplo do briefing", () => {
    const byId = Object.fromEntries(out.offers.map((o) => [o.id, o]));
    expect(byId.a!.totalCents).toBe(580_000);
    expect(byId.b!.totalCents).toBe(712_000);
    expect(byId.c!.totalCents).toBe(882_000);
  });

  it("os percentuais de redução batem", () => {
    const byId = Object.fromEntries(out.offers.map((o) => [o.id, o]));
    expect(byId.a!.reductionPercent).toBeCloseTo(51.67, 2);
    expect(byId.b!.reductionPercent).toBeCloseTo(40.67, 2);
    expect(byId.c!.reductionPercent).toBeCloseTo(26.5, 2);
  });

  it("menor total é a à vista; menor parcela e menor prazo são das parceladas", () => {
    expect(out.labels.a).toContain("lowest-total");
    expect(out.labels.c).toContain("lowest-installment");
    expect(out.labels.b).toContain("shortest-term");
  });

  it("menor desembolso inicial é a que não pede entrada", () => {
    expect(out.labels.c).toContain("lowest-upfront");
    expect(out.labels.b).not.toContain("lowest-upfront");
  });

  it("nenhum rótulo elege vencedor", () => {
    const texto = JSON.stringify(out).toLowerCase();
    for (const proibido of [
      "melhor",
      "ideal",
      "recomendad",
      "vencedor",
      "vale a pena",
      "aceite",
      "economia garantida",
    ]) {
      expect(texto).not.toContain(proibido);
    }
  });

  it("o trade-off central é dito em uma frase", () => {
    const texto = nb(out.tradeoffs.join(" "));
    expect(texto).toContain("menor parcela");
    expect(texto).toContain("R$ 3.020,00");
  });

  it("a entrada é destacada como valor que sai no ato", () => {
    expect(nb(out.tradeoffs.join(" "))).toContain("R$ 1.000,00");
  });

  it("a diferença de prazo entre as parceladas é explicitada", () => {
    expect(out.tradeoffs.join(" ")).toContain("18 meses antes");
  });
});

describe("casos F, G e H — empates e bordas", () => {
  it("caso F — mesma parcela em duas propostas dá o rótulo às duas", () => {
    const out = analyzeRenegotiation({
      referenceBalanceCents: 1_000_000,
      offers: [parcelado("a", 12, 30_000), parcelado("b", 24, 30_000)],
    });
    expect(out.labels.a).toContain("lowest-installment");
    expect(out.labels.b).toContain("lowest-installment");
  });

  it("caso G — mesmo total é empate, não desempate inventado", () => {
    const out = analyzeRenegotiation({
      referenceBalanceCents: 1_000_000,
      offers: [parcelado("a", 10, 50_000), parcelado("b", 20, 25_000)],
    });
    expect(out.labels.a).toContain("lowest-total");
    expect(out.labels.b).toContain("lowest-total");
  });

  it("caso H — entrada zero funciona normalmente", () => {
    const r = computeOffer(parcelado("h", 12, 30_000, 0), 500_000);
    expect(r.upfrontCents).toBe(0);
    expect(r.totalCents).toBe(360_000);
  });

  it("caso K — saldo menor que a oferta é mostrado sem acusação", () => {
    const out = analyzeRenegotiation({
      referenceBalanceCents: 300_000,
      offers: [cash("k", 400_000)],
    });
    expect(out.status).toBe("ok");
    expect(out.offers[0]!.relationToReference).toBe("above");
    expect(out.notes.join(" ")).not.toMatch(/abusiv|ilegal|irregular/i);
  });

  it("uma proposta só não recebe rótulo de comparação", () => {
    const out = analyzeRenegotiation({
      referenceBalanceCents: 1_000_000,
      offers: [cash("a", 400_000)],
    });
    expect(out.labels.a).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * À vista × parcelado
 * ------------------------------------------------------------------ */

describe("quanto custa parcelar", () => {
  it("R$ 4.000 à vista contra 24 × R$ 220 dá +R$ 1.280 e +32%", () => {
    const out = analyzeRenegotiation({
      referenceBalanceCents: 1_000_000,
      offers: [cash("a", 400_000), parcelado("b", 24, 22_000)],
    });
    const c = out.cashVsInstallment!;
    expect(c.cashTotalCents).toBe(400_000);
    expect(c.installmentTotalCents).toBe(528_000);
    expect(c.differenceCents).toBe(128_000);
    expect(c.differencePercent).toBeCloseTo(32, 10);
  });

  it("a frase nunca chama a diferença de juros", () => {
    const out = analyzeRenegotiation({
      referenceBalanceCents: 1_000_000,
      offers: [cash("a", 400_000), parcelado("b", 24, 22_000)],
    });
    const frase = nb(out.cashVsInstallment!.sentence);
    expect(frase).toContain("R$ 1.280,00");
    expect(frase).not.toMatch(/juros|taxa de/i);
  });

  it("compara com a parcelada de maior total quando há três propostas", () => {
    const out = analyzeRenegotiation({
      referenceBalanceCents: 1_200_000,
      offers: [
        cash("a", 580_000),
        parcelado("b", 18, 34_000, 100_000),
        parcelado("c", 36, 24_500),
      ],
    });
    expect(out.cashVsInstallment!.installmentOfferId).toBe("c");
    expect(out.cashVsInstallment!.differenceCents).toBe(302_000);
  });

  it("sem proposta à vista, a seção não aparece", () => {
    const out = analyzeRenegotiation({
      referenceBalanceCents: 1_000_000,
      offers: [parcelado("a", 12, 30_000), parcelado("b", 24, 20_000)],
    });
    expect(out.cashVsInstallment).toBeNull();
  });
});

/* ------------------------------------------------------------------ *
 * Conferidor do desconto anunciado
 * ------------------------------------------------------------------ */

describe("caso O — o desconto anunciado bate com os valores?", () => {
  it("anunciado 70%, calculado 60%: explica a base antes de suspeitar", () => {
    const check = checkAnnouncedDiscount(70, 1_000_000, 400_000)!;
    expect(check.calculatedPercent).toBeCloseTo(60, 10);
    expect(check.matches).toBe(false);
    const texto = check.sentences.join(" ");
    expect(texto).toContain("60,00%");
    expect(texto).toContain("outra base");
    expect(texto).not.toMatch(/enganos|fraude|mentira|ilegal/i);
  });

  it("diferença dentro da tolerância é tratada como arredondamento", () => {
    const check = checkAnnouncedDiscount(60, 1_000_000, 400_500)!;
    expect(check.matches).toBe(true);
    expect(check.sentences.join(" ")).toContain("próxima do percentual anunciado");
  });

  it("sem saldo de referência não há o que conferir", () => {
    expect(checkAnnouncedDiscount(70, null, 400_000)).toBeNull();
  });

  it("o conferidor é acionado pelo orquestrador", () => {
    const out = analyzeRenegotiation({
      referenceBalanceCents: 1_000_000,
      announcedDiscountPercent: 70,
      offers: [cash("a", 400_000)],
    });
    expect(out.discountCheck!.calculatedPercent).toBeCloseTo(60, 10);
  });
});

/* ------------------------------------------------------------------ *
 * Base do percentual
 * ------------------------------------------------------------------ */

describe("caso P — a dívida original é contexto, nunca base de cálculo", () => {
  const out = analyzeRenegotiation({
    referenceBalanceCents: 1_200_000,
    originalDebtCents: 600_000,
    offers: [cash("a", 580_000)],
  });

  it("a redução continua sendo calculada sobre o saldo apresentado", () => {
    expect(out.offers[0]!.reductionPercent).toBeCloseTo(51.67, 2);
  });

  it("o resultado explica qual base foi usada e por quê", () => {
    const texto = nb(out.notes.join(" "));
    expect(texto).toContain("R$ 6.000,00");
    expect(texto).toContain("R$ 12.000,00");
    expect(texto).toContain("só como contexto");
  });

  it("o aviso obrigatório sobre a base do percentual está presente", () => {
    expect(out.notes.join(" ")).toContain(
      "não representa necessariamente desconto sobre o valor originalmente emprestado",
    );
  });
});

/* ------------------------------------------------------------------ *
 * Área protegida de publicidade
 * ------------------------------------------------------------------ */

describe("a área da ferramenta é protegida de anúncio", () => {
  const arquivos = [
    "src/components/calculators/RenegotiationCalculator.tsx",
    "src/app/calculadoras/renegociacao-de-dividas/page.tsx",
  ];

  it("nenhum slot de AdSense é montado na ferramenta nem na página", () => {
    /*
     * Um anúncio de "limpe seu nome" ou "crédito para negativado" ao lado de
     * três cards de proposta seria lido como uma quarta proposta. É o erro
     * mais caro que esta página poderia cometer.
     */
    for (const arquivo of arquivos) {
      const fonte = readFileSync(resolvePath(process.cwd(), arquivo), "utf8");
      expect(fonte, arquivo).not.toMatch(/AdSlot|adsbygoogle|shouldRenderAd/);
    }
  });

  it("nem a ferramenta nem a página elegem proposta vencedora", () => {
    /*
     * Comentários são removidos antes da checagem: os próprios cabeçalhos
     * destes arquivos citam os termos proibidos para explicar por que não são
     * usados. O que importa é o texto que chega ao leitor.
     */
    const semComentarios = (fonte: string) =>
      fonte.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

    for (const arquivo of arquivos) {
      const fonte = semComentarios(readFileSync(resolvePath(process.cwd(), arquivo), "utf8"));
      expect(fonte, arquivo).not.toMatch(
        /melhor (proposta|op[çc][ãa]o|acordo)|proposta ideal|recomendada|vale a pena fechar/i,
      );
    }
  });
});
