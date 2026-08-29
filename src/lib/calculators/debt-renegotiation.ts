/**
 * CALCULADORA DE RENEGOCIAÇÃO DE DÍVIDAS — MOTOR
 * ============================================================================
 *
 * Desmonta uma proposta de acordo nos quatro números que a pessoa precisa
 * para decidir: quanto sai agora, quanto sai por mês, por quanto tempo e
 * quanto sai no total. Compara até três condições e nomeia os trade-offs.
 *
 * O QUE ESTE MOTOR NUNCA FAZ
 *
 * 1. NÃO ELEGE VENCEDOR. Ele diz "menor total", "menor parcela", "menor
 *    prazo", "menor desembolso inicial" — fatos verificáveis. Nunca "melhor",
 *    "ideal", "recomendada" ou "vale a pena". Qual desses eixos importa mais
 *    depende do bolso de quem decide, não da aritmética;
 *
 * 2. NÃO CHAMA A DIFERENÇA DE JUROS. Não sabemos a composição do saldo
 *    apresentado — quanto é principal, quanto é encargo, quanto é multa. Por
 *    isso a diferença entre parcelado e à vista é "quanto o parcelamento
 *    acrescenta", nunca "juros do acordo";
 *
 * 3. NÃO CALCULA CET. CET tem definição normativa e pressupõe operação de
 *    crédito com fluxo de caixa datado. Derivar um número de entrada e
 *    parcelas e chamá-lo de CET seria falsa precisão;
 *
 * 4. NÃO USA A DÍVIDA ORIGINAL COMO BASE. Se a pessoa souber quanto pegou
 *    emprestado no começo, isso é informação de contexto — a redução é sempre
 *    calculada sobre o saldo que o credor apresentou para negociar, e o
 *    resultado diz isso com todas as letras;
 *
 * 5. NÃO ACUSA PROPAGANDA ENGANOSA. Quando o percentual anunciado não bate
 *    com o calculado, a explicação mais provável é base de cálculo diferente,
 *    não fraude. O motor mostra os dois números e diz isso.
 *
 * Dinheiro em centavos inteiros o tempo todo. Percentuais em ponto flutuante,
 * arredondados só na exibição.
 */

import {
  formatCentsBRL,
  formatPercentBR,
} from "@/lib/calculators/proposal-comparison";

/* ========================================================================== *
 * 1. Tipos
 * ========================================================================== */

export type OfferType = "cash" | "entry-installments" | "installments-only";

/**
 * Como as parcelas foram informadas.
 *
 * `uniform` — quantidade × valor, o caso comum.
 * `total`   — a pessoa informou o total parcelado porque as parcelas têm
 *             valores diferentes. Multiplicar a primeira parcela pelo número
 *             de parcelas daria um número errado, então nem oferecemos isso.
 */
export type InstallmentMode = "uniform" | "total";

export interface RenegotiationOffer {
  id: string;
  /** Rótulo editorial; quando ausente, é derivado do formato da proposta. */
  label?: string;
  type: OfferType;
  /** Valor único da proposta à vista. */
  cashCents: number | null;
  /** Entrada. Zero quando não há. */
  entryCents: number;
  installmentMode: InstallmentMode;
  installmentCount: number;
  /** Modo `uniform`. */
  installmentCents: number | null;
  /** Modo `total`: soma de todas as parcelas, informada pela pessoa. */
  installmentsTotalCents: number | null;
  /** Custos informados fora de entrada e parcelas. */
  extraCostsCents: number;
}

export interface RenegotiationInput {
  /**
   * Saldo que o credor apresentou como base da negociação. Pode faltar: sem
   * ele ainda dá para comparar as propostas entre si, só não dá para calcular
   * redução percentual.
   */
  referenceBalanceCents: number | null;
  /** Contexto apenas. Nunca vira base de cálculo de redução. */
  originalDebtCents?: number | null;
  /** Percentual que a oferta anuncia, para o conferidor. */
  announcedDiscountPercent?: number | null;
  offers: RenegotiationOffer[];
}

export type OfferWarning =
  | "missing-cash-amount"
  | "missing-installment-amount"
  | "missing-installments-total"
  | "missing-installment-count"
  | "empty-offer";

export type RelationToReference = "below" | "equal" | "above" | "unknown";

export interface OfferResult {
  id: string;
  label: string;
  type: OfferType;
  /** O que sai do bolso no ato: pagamento à vista ou entrada. */
  upfrontCents: number;
  /** Soma de todas as parcelas. Zero na proposta à vista. */
  installmentsTotalCents: number;
  /** Valor de cada parcela — null quando as parcelas variam ou não há. */
  installmentCents: number | null;
  installmentCount: number;
  extraCostsCents: number;
  /** entrada + parcelas + custos informados. O número que quase ninguém soma. */
  totalCents: number;
  /** saldo − total. Null sem saldo de referência. */
  reductionCents: number | null;
  reductionPercent: number | null;
  relationToReference: RelationToReference;
  warnings: OfferWarning[];
  /** Frase determinística descrevendo a proposta. */
  sentence: string;
}

export type ComparisonLabel =
  | "lowest-total"
  | "lowest-installment"
  | "lowest-upfront"
  | "shortest-term";

export const COMPARISON_LABEL_TEXT: Record<ComparisonLabel, string> = {
  "lowest-total": "Menor total",
  "lowest-installment": "Menor parcela",
  "lowest-upfront": "Menor desembolso inicial",
  "shortest-term": "Menor prazo",
};

export interface CashVsInstallmentComparison {
  cashOfferId: string;
  installmentOfferId: string;
  cashTotalCents: number;
  installmentTotalCents: number;
  /** Quanto o parcelamento acrescenta. Negativo se o parcelado somar menos. */
  differenceCents: number;
  /** (parcelado / à vista − 1) × 100. Nunca chamado de taxa de juros. */
  differencePercent: number;
  sentence: string;
}

export interface DiscountCheck {
  announcedPercent: number;
  calculatedPercent: number;
  /** Diferença em pontos percentuais, em módulo. */
  gapPoints: number;
  matches: boolean;
  sentences: string[];
}

export interface RenegotiationResult {
  status: "ok" | "blocked";
  blockingReasons: string[];
  referenceBalanceCents: number | null;
  offers: OfferResult[];
  /** Rótulos factuais por proposta. Empates recebem o mesmo rótulo. */
  labels: Record<string, ComparisonLabel[]>;
  cashVsInstallment: CashVsInstallmentComparison | null;
  discountCheck: DiscountCheck | null;
  tradeoffs: string[];
  notes: string[];
}

/* ========================================================================== *
 * 2. Construção e validação de uma proposta
 * ========================================================================== */

export function emptyOffer(id: string): RenegotiationOffer {
  return {
    id,
    type: "cash",
    cashCents: null,
    entryCents: 0,
    installmentMode: "uniform",
    installmentCount: 0,
    installmentCents: null,
    installmentsTotalCents: null,
    extraCostsCents: 0,
  };
}

export function validateOffer(offer: RenegotiationOffer): OfferWarning[] {
  const warnings: OfferWarning[] = [];

  if (offer.type === "cash") {
    /*
     * Caso I: proposta à vista de R$ 0 não passa em silêncio. Ou a pessoa
     * ainda não preencheu, ou digitou errado — em nenhum dos dois casos
     * devolver "total: R$ 0,00" ajuda.
     */
    if (offer.cashCents === null || offer.cashCents <= 0) {
      warnings.push("missing-cash-amount");
    }
    return warnings;
  }

  if (offer.installmentCount <= 0) warnings.push("missing-installment-count");

  if (offer.installmentMode === "uniform") {
    if (offer.installmentCents === null || offer.installmentCents <= 0) {
      warnings.push("missing-installment-amount");
    }
  } else if (
    offer.installmentsTotalCents === null ||
    offer.installmentsTotalCents <= 0
  ) {
    warnings.push("missing-installments-total");
  }

  if (
    offer.type === "installments-only" &&
    offer.entryCents === 0 &&
    warnings.length === 0
  ) {
    return warnings;
  }

  return warnings;
}

function installmentsSum(offer: RenegotiationOffer): number {
  if (offer.type === "cash") return 0;
  if (offer.installmentMode === "total") return offer.installmentsTotalCents ?? 0;
  return (offer.installmentCents ?? 0) * offer.installmentCount;
}

function defaultLabel(offer: RenegotiationOffer): string {
  if (offer.label && offer.label.trim() !== "") return offer.label.trim();
  if (offer.type === "cash") return "À vista";
  if (offer.installmentCount > 0) {
    return offer.entryCents > 0
      ? `Entrada + ${offer.installmentCount}x`
      : `${offer.installmentCount}x`;
  }
  return "Parcelado";
}

/* ========================================================================== *
 * 3. Cálculo de uma proposta
 * ========================================================================== */

export function computeOffer(
  offer: RenegotiationOffer,
  referenceBalanceCents: number | null,
): OfferResult {
  const warnings = validateOffer(offer);
  const isCash = offer.type === "cash";

  const upfrontCents = isCash ? (offer.cashCents ?? 0) : offer.entryCents;
  const installmentsTotalCents = installmentsSum(offer);
  const totalCents = upfrontCents + installmentsTotalCents + offer.extraCostsCents;

  let reductionCents: number | null = null;
  let reductionPercent: number | null = null;
  let relationToReference: RelationToReference = "unknown";

  if (referenceBalanceCents !== null && referenceBalanceCents > 0) {
    reductionCents = referenceBalanceCents - totalCents;
    reductionPercent = (reductionCents / referenceBalanceCents) * 100;
    relationToReference =
      reductionCents > 0 ? "below" : reductionCents === 0 ? "equal" : "above";
  }

  return {
    id: offer.id,
    label: defaultLabel(offer),
    type: offer.type,
    upfrontCents,
    installmentsTotalCents,
    installmentCents:
      isCash || offer.installmentMode === "total" ? null : offer.installmentCents,
    installmentCount: isCash ? 0 : offer.installmentCount,
    extraCostsCents: offer.extraCostsCents,
    totalCents,
    reductionCents,
    reductionPercent,
    relationToReference,
    warnings,
    sentence: describeOffer(offer, upfrontCents, installmentsTotalCents, totalCents),
  };
}

function describeOffer(
  offer: RenegotiationOffer,
  upfrontCents: number,
  installmentsTotalCents: number,
  totalCents: number,
): string {
  if (offer.type === "cash") {
    const extra =
      offer.extraCostsCents > 0
        ? ` Com os custos adicionais informados, o total fica em ${formatCentsBRL(totalCents)}.`
        : "";
    return `Pagamento único de ${formatCentsBRL(upfrontCents)}.${extra}`;
  }

  const parcelas =
    offer.installmentMode === "uniform" && offer.installmentCents
      ? `${offer.installmentCount} parcelas de ${formatCentsBRL(offer.installmentCents)}`
      : `${offer.installmentCount} parcelas somando ${formatCentsBRL(installmentsTotalCents)}`;

  const entrada =
    upfrontCents > 0
      ? `Exige ${formatCentsBRL(upfrontCents)} de entrada e depois ${parcelas}.`
      : `São ${parcelas}, sem entrada.`;

  const custos =
    offer.extraCostsCents > 0
      ? ` Somando os ${formatCentsBRL(offer.extraCostsCents)} de custos adicionais informados,`
      : "";

  return `${entrada}${custos} O total informado é ${formatCentsBRL(totalCents)}.`;
}

/* ========================================================================== *
 * 4. Comparação entre propostas
 * ========================================================================== */

/**
 * Rótulos factuais. Empate recebe o mesmo rótulo em ambas as propostas —
 * inventar desempate seria criar hierarquia onde os números não criam.
 */
function assignLabels(offers: OfferResult[]): Record<string, ComparisonLabel[]> {
  const labels: Record<string, ComparisonLabel[]> = {};
  for (const offer of offers) labels[offer.id] = [];
  if (offers.length < 2) return labels;

  const add = (
    candidates: OfferResult[],
    pick: (o: OfferResult) => number,
    label: ComparisonLabel,
  ) => {
    if (candidates.length < 2) return;
    const best = Math.min(...candidates.map(pick));
    for (const offer of candidates) {
      if (pick(offer) === best) labels[offer.id]!.push(label);
    }
  };

  add(offers, (o) => o.totalCents, "lowest-total");
  add(offers, (o) => o.upfrontCents, "lowest-upfront");

  /* Parcela e prazo só existem entre propostas parceladas. */
  const parceladas = offers.filter((o) => o.type !== "cash" && o.installmentCount > 0);
  add(
    parceladas.filter((o) => o.installmentCents !== null),
    (o) => o.installmentCents ?? Number.POSITIVE_INFINITY,
    "lowest-installment",
  );
  add(parceladas, (o) => o.installmentCount, "shortest-term");

  return labels;
}

function compareCashVsInstallment(
  offers: OfferResult[],
): CashVsInstallmentComparison | null {
  const cash = offers.find((o) => o.type === "cash" && o.totalCents > 0);
  if (!cash) return null;

  /* Entre as parceladas, comparamos com a de maior total: é a que evidencia
     melhor o custo de esticar o prazo. */
  const parceladas = offers.filter((o) => o.type !== "cash" && o.totalCents > 0);
  if (parceladas.length === 0) return null;
  const alvo = parceladas.reduce((a, b) => (b.totalCents > a.totalCents ? b : a));

  const differenceCents = alvo.totalCents - cash.totalCents;
  const differencePercent = (alvo.totalCents / cash.totalCents - 1) * 100;

  let sentence: string;
  if (differenceCents > 0) {
    sentence = `A opção "${alvo.label}" reduz o desembolso imediato, mas totaliza ${formatCentsBRL(differenceCents)} a mais que a proposta à vista informada — ${formatPercentBR(differencePercent)} acima dela.`;
  } else if (differenceCents === 0) {
    sentence = `A opção "${alvo.label}" e a proposta à vista somam o mesmo total informado.`;
  } else {
    sentence = `Pelos valores informados, a opção "${alvo.label}" totaliza ${formatCentsBRL(Math.abs(differenceCents))} a menos que a proposta à vista. Vale reconferir os números com o credor.`;
  }

  return {
    cashOfferId: cash.id,
    installmentOfferId: alvo.id,
    cashTotalCents: cash.totalCents,
    installmentTotalCents: alvo.totalCents,
    differenceCents,
    differencePercent,
    sentence,
  };
}

/** Trade-offs entre pares — o que muda de uma proposta para outra. */
function buildTradeoffs(
  offers: OfferResult[],
  labels: Record<string, ComparisonLabel[]>,
): string[] {
  const out: string[] = [];
  if (offers.length < 2) return out;

  const menorTotal = offers.filter((o) => labels[o.id]?.includes("lowest-total"));
  const menorParcela = offers.filter((o) =>
    labels[o.id]?.includes("lowest-installment"),
  );

  /*
   * O trade-off central da renegociação: a proposta de parcela mais leve
   * costuma ser a mais cara no fim. Dizer isso em uma frase é o principal
   * serviço desta ferramenta.
   */
  if (menorParcela.length === 1 && menorTotal.length === 1) {
    const parcela = menorParcela[0]!;
    const total = menorTotal[0]!;
    if (parcela.id !== total.id) {
      const diferenca = parcela.totalCents - total.totalCents;
      if (diferenca > 0) {
        out.push(
          `"${parcela.label}" tem a menor parcela, mas exige ${formatCentsBRL(diferenca)} a mais no total que "${total.label}".`,
        );
      }
    }
  }

  const comEntrada = offers.filter((o) => o.type !== "cash" && o.upfrontCents > 0);
  for (const offer of comEntrada) {
    out.push(
      `Em "${offer.label}", ${formatCentsBRL(offer.upfrontCents)} saem no ato como entrada — esse valor entra no total e é fácil de esquecer ao somar só as parcelas.`,
    );
  }

  const prazos = offers.filter((o) => o.installmentCount > 0);
  if (prazos.length >= 2) {
    const curto = prazos.reduce((a, b) => (b.installmentCount < a.installmentCount ? b : a));
    const longo = prazos.reduce((a, b) => (b.installmentCount > a.installmentCount ? b : a));
    if (curto.id !== longo.id) {
      const meses = longo.installmentCount - curto.installmentCount;
      out.push(
        `"${curto.label}" termina ${meses} ${meses === 1 ? "mês" : "meses"} antes de "${longo.label}".`,
      );
    }
  }

  return out;
}

/* ========================================================================== *
 * 5. Conferidor do desconto anunciado
 * ========================================================================== */

/** Diferença acima disso deixa de ser arredondamento e vira base diferente. */
export const DISCOUNT_TOLERANCE_POINTS = 1;

export function checkAnnouncedDiscount(
  announcedPercent: number,
  referenceBalanceCents: number | null,
  offerTotalCents: number,
): DiscountCheck | null {
  if (referenceBalanceCents === null || referenceBalanceCents <= 0) return null;

  const calculatedPercent =
    ((referenceBalanceCents - offerTotalCents) / referenceBalanceCents) * 100;
  const gapPoints = Math.abs(announcedPercent - calculatedPercent);
  const matches = gapPoints <= DISCOUNT_TOLERANCE_POINTS;

  const sentences: string[] = [];
  if (matches) {
    sentences.push(
      `Pelos valores informados, a redução é de ${formatPercentBR(calculatedPercent)} — próxima do percentual anunciado de ${formatPercentBR(announcedPercent, 0)}.`,
    );
  } else {
    sentences.push(
      `Pelos valores que você informou, a redução é de aproximadamente ${formatPercentBR(calculatedPercent)}, e não ${formatPercentBR(announcedPercent, 0)}.`,
    );
    /*
     * Antes de qualquer suspeita: a explicação mais comum é base de cálculo
     * diferente. O credor pode estar calculando sobre um saldo atualizado
     * maior, ou sobre outra referência. Acusar propaganda enganosa exigiria
     * análise jurídica que uma calculadora não faz.
     */
    sentences.push(
      "O percentual anunciado pode estar sendo calculado sobre outra base — um saldo atualizado diferente do que você informou, por exemplo. Vale perguntar ao credor sobre qual valor o desconto foi calculado.",
    );
  }
  return { announcedPercent, calculatedPercent, gapPoints, matches, sentences };
}

/* ========================================================================== *
 * 6. Orquestração
 * ========================================================================== */

export function analyzeRenegotiation(input: RenegotiationInput): RenegotiationResult {
  const blockingReasons: string[] = [];

  const usable = input.offers.filter((o) => validateOffer(o).length === 0);
  if (usable.length === 0) {
    blockingReasons.push(
      "Informe ao menos uma proposta completa: o valor à vista, ou a quantidade e o valor das parcelas.",
    );
  }
  if (input.referenceBalanceCents !== null && input.referenceBalanceCents <= 0) {
    blockingReasons.push("O saldo apresentado precisa ser maior que zero.");
  }

  const reference =
    input.referenceBalanceCents !== null && input.referenceBalanceCents > 0
      ? input.referenceBalanceCents
      : null;

  const offers = usable.map((o) => computeOffer(o, reference));

  if (blockingReasons.length > 0) {
    return {
      status: "blocked",
      blockingReasons,
      referenceBalanceCents: reference,
      offers,
      labels: {},
      cashVsInstallment: null,
      discountCheck: null,
      tradeoffs: [],
      notes: [],
    };
  }

  const labels = assignLabels(offers);
  const cashVsInstallment = compareCashVsInstallment(offers);
  const tradeoffs = buildTradeoffs(offers, labels);

  const discountCheck =
    input.announcedDiscountPercent != null && offers.length > 0
      ? checkAnnouncedDiscount(
          input.announcedDiscountPercent,
          reference,
          offers[0]!.totalCents,
        )
      : null;

  return {
    status: "ok",
    blockingReasons: [],
    referenceBalanceCents: reference,
    offers,
    labels,
    cashVsInstallment,
    discountCheck,
    tradeoffs,
    notes: buildNotes(offers, reference, input.originalDebtCents ?? null),
  };
}

function buildNotes(
  offers: OfferResult[],
  reference: number | null,
  originalDebtCents: number | null,
): string[] {
  const notes: string[] = [];

  if (reference === null) {
    notes.push(
      "Sem o saldo apresentado pelo credor, dá para comparar as propostas entre si, mas não para calcular a redução em relação à dívida.",
    );
  } else {
    notes.push(
      "O percentual abaixo compara a proposta com o saldo que você informou. Ele não representa necessariamente desconto sobre o valor originalmente emprestado nem redução exclusiva de juros.",
    );
  }

  /* Caso D/K: total acima do saldo. Fato, sem adjetivo. */
  for (const offer of offers) {
    if (offer.relationToReference === "above" && offer.reductionCents !== null) {
      notes.push(
        `O total da proposta "${offer.label}" é ${formatCentsBRL(Math.abs(offer.reductionCents))} maior que o saldo usado como referência. Isso acontece em parcelamentos longos.`,
      );
    }
    if (offer.relationToReference === "equal") {
      notes.push(
        `O total da proposta "${offer.label}" é igual ao saldo usado como referência.`,
      );
    }
  }

  if (originalDebtCents !== null && originalDebtCents > 0 && reference !== null) {
    notes.push(
      `Você informou que a dívida original era de ${formatCentsBRL(originalDebtCents)}. Esse valor aparece só como contexto: a redução acima é calculada sobre o saldo de ${formatCentsBRL(reference)} apresentado para negociação, porque é sobre ele que a proposta foi feita.`,
    );
  }

  return notes;
}

/* ========================================================================== *
 * 7. Formatação
 * ========================================================================== */

/** Reexportada para a UI consumir daqui, sem depender de outro motor. */
export {
  formatCentsBRL,
  formatPercentBR,
  parseBRLToCents,
} from "@/lib/calculators/proposal-comparison";
