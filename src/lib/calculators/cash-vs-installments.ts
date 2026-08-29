/**
 * À VISTA OU PARCELADO? — MOTOR
 * ============================================================================
 *
 * A pessoa está diante de uma COMPRA e recebeu duas ou três condições de
 * pagamento. Esta ferramenta responde quanto cada uma custa até o fim, e
 * quanto sai do bolso em cada momento — sem escolher por ela.
 *
 * DUAS PERGUNTAS DIFERENTES, QUE O MOTOR NÃO MISTURA
 *
 *   1. qual opção custa menos?
 *   2. qual opção preserva mais caixa agora?
 *
 * Elas raramente têm a mesma resposta, e é justamente aí que mora a decisão.
 * Uma ferramenta que responde só a primeira acaba dizendo "pague à vista"
 * para quem não tem o dinheiro à vista.
 *
 * DUAS BASES DE PERCENTUAL, QUE O MOTOR TAMBÉM NÃO MISTURA
 *
 *   DESCONTO À VISTA   = (preço de referência − preço à vista) ÷ referência
 *   CUSTO DE PARCELAR  = (total parcelado − preço à vista) ÷ preço à vista
 *
 * A loja anuncia a primeira; o bolso sente a segunda. Confundi-las é o erro
 * mais comum na hora de comparar, e cada uma aparece aqui com o denominador
 * declarado.
 *
 * O QUE O MOTOR NUNCA FAZ
 *
 * - não diz "pague à vista" nem "parcele". Diz qual tem menor total, menor
 *   desembolso imediato, menor parcela e menor prazo — fatos verificáveis;
 * - não chama a diferença de "juros". Sem a estrutura do parcelamento, o que
 *   se sabe é quanto o parcelamento acrescenta, não a que título;
 * - não calcula CET: nem sempre há operação de crédito, e nunca há dados
 *   suficientes;
 * - não trata "parcelado sem juros" como equivalente econômico ao pagamento
 *   à vista. Os totais nominais podem ser iguais; o momento do desembolso,
 *   não;
 * - não julga comportamento ("se você não tem disciplina, pague à vista").
 *
 * Dinheiro em centavos inteiros. Percentuais arredondados só na exibição.
 */

import {
  formatCentsBRL,
  formatPercentBR,
} from "@/lib/calculators/proposal-comparison";

/* ========================================================================== *
 * 1. Tipos
 * ========================================================================== */

export type PaymentType = "cash" | "installments";

/** Igual ao motor de renegociação: parcelas variáveis usam o total informado. */
export type InstallmentMode = "uniform" | "total";

/** Só rótulo visual — não altera nenhuma conta. */
export type PaymentMethod = "pix" | "dinheiro" | "debito" | "boleto" | "cartao" | "outro";

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  debito: "Débito",
  boleto: "Boleto",
  cartao: "Cartão",
  outro: "Outro",
};

export interface PaymentOption {
  id: string;
  label?: string;
  type: PaymentType;
  method?: PaymentMethod;
  /** Pagamento único. */
  cashCents: number | null;
  /** Entrada do parcelamento. Zero quando não há. */
  entryCents: number;
  installmentMode: InstallmentMode;
  installmentCount: number;
  installmentCents: number | null;
  installmentsTotalCents: number | null;
  /** Custo obrigatório que só existe nesta forma de pagamento. */
  extraCostsCents: number;
}

export interface PurchaseInput {
  /**
   * Preço "normal" anunciado antes do desconto à vista. Opcional e usado
   * apenas como base do desconto — nunca como o preço real da compra.
   */
  referencePriceCents?: number | null;
  options: PaymentOption[];
  /** Modo avançado: taxa de oportunidade líquida informada pela pessoa. */
  opportunityRate?: OpportunityRate | null;
}

export interface OpportunityRate {
  /** Percentual informado. */
  value: number;
  unit: "mensal" | "anual";
  /** Quando vence a primeira parcela — muda a conta e não se presume. */
  firstInstallment: "hoje" | "em-um-mes";
}

export type OptionWarning =
  | "missing-cash-amount"
  | "missing-installment-amount"
  | "missing-installments-total"
  | "missing-installment-count";

export interface OptionResult {
  id: string;
  label: string;
  type: PaymentType;
  method?: PaymentMethod;
  /** O que sai no ato: preço à vista ou entrada. */
  upfrontCents: number;
  installmentsTotalCents: number;
  installmentCents: number | null;
  installmentCount: number;
  extraCostsCents: number;
  /** upfront + parcelas + custos. O preço até o fim. */
  totalCents: number;
  warnings: OptionWarning[];
  sentence: string;
}

export type ComparisonLabel =
  | "lowest-total"
  | "lowest-upfront"
  | "lowest-installment"
  | "shortest-term";

export const COMPARISON_LABEL_TEXT: Record<ComparisonLabel, string> = {
  "lowest-total": "Menor total",
  "lowest-upfront": "Menor desembolso imediato",
  "lowest-installment": "Menor parcela",
  "shortest-term": "Menor prazo",
};

/** Comparação entre a opção à vista e uma parcelada. */
export interface CashVsInstallmentsResult {
  cashOptionId: string;
  installmentOptionId: string;
  cashTotalCents: number;
  installmentTotalCents: number;
  /** parcelado − à vista. Negativo quando o parcelado soma menos. */
  differenceCents: number;
  /** diferença ÷ preço à vista × 100. Nunca chamado de taxa de juros. */
  differencePercent: number;
  relation: "installments-cost-more" | "equal" | "installments-cost-less";
  sentences: string[];
}

/** Desconto à vista, calculado sobre o preço de referência anunciado. */
export interface CashDiscountResult {
  referencePriceCents: number;
  cashPriceCents: number;
  discountCents: number;
  discountPercent: number;
  sentence: string;
}

export interface PresentValueResult {
  monthlyRate: number;
  firstInstallment: "hoje" | "em-um-mes";
  /** Valor presente do plano parcelado, incluindo entrada e custos. */
  presentValueCents: number;
  nominalTotalCents: number;
  cashPriceCents: number;
  /** VP do parcelado − preço à vista. */
  differenceCents: number;
  /** Preço à vista que igualaria as duas opções nesta taxa. */
  breakEvenCashPriceCents: number;
  sentences: string[];
}

export interface PurchaseResult {
  status: "ok" | "blocked";
  blockingReasons: string[];
  options: OptionResult[];
  labels: Record<string, ComparisonLabel[]>;
  cashVsInstallments: CashVsInstallmentsResult | null;
  cashDiscount: CashDiscountResult | null;
  presentValue: PresentValueResult | null;
  tradeoffs: string[];
  notes: string[];
}

/* ========================================================================== *
 * 2. Construção e validação
 * ========================================================================== */

export function emptyOption(id: string, type: PaymentType = "cash"): PaymentOption {
  return {
    id,
    type,
    cashCents: null,
    entryCents: 0,
    installmentMode: "uniform",
    installmentCount: 0,
    installmentCents: null,
    installmentsTotalCents: null,
    extraCostsCents: 0,
  };
}

export function validateOption(option: PaymentOption): OptionWarning[] {
  const warnings: OptionWarning[] = [];

  if (option.type === "cash") {
    /* Caso L: preço zero não vira "total: R$ 0,00" em silêncio. */
    if (option.cashCents === null || option.cashCents <= 0) {
      warnings.push("missing-cash-amount");
    }
    return warnings;
  }

  if (option.installmentCount <= 0) warnings.push("missing-installment-count");

  if (option.installmentMode === "uniform") {
    /* Caso K: parcela negativa ou zero é dado inválido, não promoção. */
    if (option.installmentCents === null || option.installmentCents <= 0) {
      warnings.push("missing-installment-amount");
    }
  } else if (
    option.installmentsTotalCents === null ||
    option.installmentsTotalCents <= 0
  ) {
    warnings.push("missing-installments-total");
  }

  return warnings;
}

function installmentsSum(option: PaymentOption): number {
  if (option.type === "cash") return 0;
  if (option.installmentMode === "total") return option.installmentsTotalCents ?? 0;
  return (option.installmentCents ?? 0) * option.installmentCount;
}

function defaultLabel(option: PaymentOption): string {
  if (option.label && option.label.trim() !== "") return option.label.trim();
  if (option.type === "cash") {
    return option.method && option.method !== "outro"
      ? `À vista (${PAYMENT_METHOD_LABEL[option.method]})`
      : "À vista";
  }
  if (option.installmentCount > 0) {
    return option.entryCents > 0
      ? `Entrada + ${option.installmentCount}x`
      : `${option.installmentCount}x`;
  }
  return "Parcelado";
}

/* ========================================================================== *
 * 3. Cálculo de uma opção
 * ========================================================================== */

export function computeOption(option: PaymentOption): OptionResult {
  const isCash = option.type === "cash";
  const upfrontCents = isCash ? (option.cashCents ?? 0) : option.entryCents;
  const installmentsTotalCents = installmentsSum(option);
  const totalCents = upfrontCents + installmentsTotalCents + option.extraCostsCents;

  return {
    id: option.id,
    label: defaultLabel(option),
    type: option.type,
    method: option.method,
    upfrontCents,
    installmentsTotalCents,
    installmentCents:
      isCash || option.installmentMode === "total" ? null : option.installmentCents,
    installmentCount: isCash ? 0 : option.installmentCount,
    extraCostsCents: option.extraCostsCents,
    totalCents,
    warnings: validateOption(option),
    sentence: describeOption(option, upfrontCents, installmentsTotalCents, totalCents),
  };
}

function describeOption(
  option: PaymentOption,
  upfrontCents: number,
  installmentsTotalCents: number,
  totalCents: number,
): string {
  const custos =
    option.extraCostsCents > 0
      ? ` Inclui ${formatCentsBRL(option.extraCostsCents)} de custo adicional informado.`
      : "";

  if (option.type === "cash") {
    return `Pagamento único de ${formatCentsBRL(totalCents)}.${custos}`;
  }

  const parcelas =
    option.installmentMode === "uniform" && option.installmentCents
      ? `${option.installmentCount} parcelas de ${formatCentsBRL(option.installmentCents)}`
      : `${option.installmentCount} parcelas somando ${formatCentsBRL(installmentsTotalCents)}`;

  const entrada =
    upfrontCents > 0
      ? `${formatCentsBRL(upfrontCents)} de entrada e depois ${parcelas}`
      : `${parcelas}, sem entrada`;

  return `${entrada}. O total até o fim é ${formatCentsBRL(totalCents)}.${custos}`;
}

/* ========================================================================== *
 * 4. Rótulos factuais
 * ========================================================================== */

function assignLabels(options: OptionResult[]): Record<string, ComparisonLabel[]> {
  const labels: Record<string, ComparisonLabel[]> = {};
  for (const option of options) labels[option.id] = [];
  if (options.length < 2) return labels;

  const add = (
    candidates: OptionResult[],
    pick: (o: OptionResult) => number,
    label: ComparisonLabel,
  ) => {
    if (candidates.length < 2) return;
    const best = Math.min(...candidates.map(pick));
    /* Empate recebe o rótulo nas duas: inventar desempate criaria hierarquia
       onde os números não criam. */
    for (const option of candidates) {
      if (pick(option) === best) labels[option.id]!.push(label);
    }
  };

  add(options, (o) => o.totalCents, "lowest-total");
  add(options, (o) => o.upfrontCents, "lowest-upfront");

  const parceladas = options.filter((o) => o.type === "installments" && o.installmentCount > 0);
  add(
    parceladas.filter((o) => o.installmentCents !== null),
    (o) => o.installmentCents ?? Number.POSITIVE_INFINITY,
    "lowest-installment",
  );
  add(parceladas, (o) => o.installmentCount, "shortest-term");

  return labels;
}

/* ========================================================================== *
 * 5. À vista × parcelado
 * ========================================================================== */

function compareCashVsInstallments(
  options: OptionResult[],
): CashVsInstallmentsResult | null {
  const cash = options.find((o) => o.type === "cash" && o.totalCents > 0);
  const parceladas = options.filter((o) => o.type === "installments" && o.totalCents > 0);
  if (!cash || parceladas.length === 0) return null;

  /* Com mais de uma parcelada, comparamos com a de maior total: é a que
     evidencia melhor o custo de esticar o pagamento. */
  const alvo = parceladas.reduce((a, b) => (b.totalCents > a.totalCents ? b : a));

  const differenceCents = alvo.totalCents - cash.totalCents;
  const differencePercent = (differenceCents / cash.totalCents) * 100;
  const sentences: string[] = [];

  let relation: CashVsInstallmentsResult["relation"];
  if (differenceCents > 0) {
    relation = "installments-cost-more";
    sentences.push(
      `Parcelar distribui o pagamento em ${alvo.installmentCount} vezes, mas aumenta o desembolso total em ${formatCentsBRL(differenceCents)} — ${formatPercentBR(differencePercent)} a mais que o preço à vista informado.`,
    );
    sentences.push(
      `Pagar à vista exige ${formatCentsBRL(cash.totalCents)} de uma vez; parcelar distribui ${formatCentsBRL(alvo.totalCents)} ao longo do prazo.`,
    );
  } else if (differenceCents === 0) {
    relation = "equal";
    sentences.push(
      "Pelos valores informados, as duas opções têm o mesmo custo nominal até o fim.",
    );
    /*
     * O ponto que quase toda calculadora erra. Totais iguais não significam
     * equivalência econômica: o dinheiro sai em momentos diferentes, e isso
     * tem valor — para os dois lados. Dizer "então parcele" seria tão
     * arbitrário quanto dizer "então pague à vista".
     */
    sentences.push(
      "A diferença está em quando o dinheiro sai do seu bolso, não em quanto. Pagar à vista libera o compromisso agora; parcelar mantém o valor com você por mais tempo — e também mantém o compromisso em aberto.",
    );
  } else {
    relation = "installments-cost-less";
    sentences.push(
      `Pelos valores informados, o parcelamento totaliza ${formatCentsBRL(Math.abs(differenceCents))} a menos que o preço à vista. Isso acontece em promoções específicas — vale conferir se os valores foram digitados corretamente.`,
    );
  }

  return {
    cashOptionId: cash.id,
    installmentOptionId: alvo.id,
    cashTotalCents: cash.totalCents,
    installmentTotalCents: alvo.totalCents,
    differenceCents,
    differencePercent,
    relation,
    sentences,
  };
}

/* ========================================================================== *
 * 6. Desconto à vista (base diferente!)
 * ========================================================================== */

/**
 * Desconto sobre o PREÇO DE REFERÊNCIA anunciado — não sobre o total
 * parcelado. São bases diferentes e produzem percentuais diferentes; o
 * resultado sempre nomeia qual está usando.
 */
export function computeCashDiscount(
  referencePriceCents: number,
  cashPriceCents: number,
): CashDiscountResult | null {
  if (referencePriceCents <= 0 || cashPriceCents <= 0) return null;

  const discountCents = referencePriceCents - cashPriceCents;
  const discountPercent = (discountCents / referencePriceCents) * 100;

  const sentence =
    discountCents > 0
      ? `O desconto à vista informado é de ${formatCentsBRL(discountCents)} — ${formatPercentBR(discountPercent)} sobre o preço de referência de ${formatCentsBRL(referencePriceCents)}.`
      : discountCents === 0
        ? "O preço à vista informado é igual ao preço de referência: não há desconto à vista nos valores digitados."
        : `O preço à vista informado é ${formatCentsBRL(Math.abs(discountCents))} maior que o preço de referência. Vale reconferir os valores.`;

  return {
    referencePriceCents,
    cashPriceCents,
    discountCents,
    discountPercent,
    sentence,
  };
}

/* ========================================================================== *
 * 7. Modo avançado — valor do dinheiro no tempo
 * ========================================================================== */

/** Converte a taxa informada para mensal, por equivalência composta. */
export function toMonthlyRate(rate: OpportunityRate): number {
  const decimal = rate.value / 100;
  if (rate.unit === "mensal") return decimal;
  /* Anual → mensal: (1+i)^(1/12) − 1. Nunca dividir por 12. */
  return Math.pow(1 + decimal, 1 / 12) - 1;
}

/**
 * Valor presente de uma série de parcelas iguais.
 *
 * `hoje` produz anuidade ANTECIPADA (a primeira parcela não é descontada);
 * `em-um-mes`, POSTECIPADA. A diferença entre as duas é exatamente um fator
 * (1+i), e assumir uma delas sem perguntar seria errar por silêncio — por
 * isso o modo avançado pergunta.
 */
export function presentValueOfInstallments(
  installmentCents: number,
  count: number,
  monthlyRate: number,
  firstInstallment: "hoje" | "em-um-mes",
): number {
  if (count <= 0) return 0;
  if (monthlyRate === 0) return installmentCents * count;

  const postecipado =
    (installmentCents * (1 - Math.pow(1 + monthlyRate, -count))) / monthlyRate;
  return firstInstallment === "hoje" ? postecipado * (1 + monthlyRate) : postecipado;
}

export function computePresentValue(
  cash: OptionResult,
  installments: OptionResult,
  rate: OpportunityRate,
): PresentValueResult | null {
  if (installments.installmentCents === null || installments.installmentCount <= 0) {
    return null;
  }

  const monthlyRate = toMonthlyRate(rate);
  const pvParcelas = presentValueOfInstallments(
    installments.installmentCents,
    installments.installmentCount,
    monthlyRate,
    rate.firstInstallment,
  );
  /* Entrada e custos adicionais saem hoje: valor presente igual ao de face. */
  const presentValueCents = Math.round(
    pvParcelas + installments.upfrontCents + installments.extraCostsCents,
  );
  const differenceCents = presentValueCents - cash.totalCents;

  const sentences = [
    `Usando a taxa de referência que você informou, o valor presente estimado do plano parcelado é ${formatCentsBRL(presentValueCents)}, contra ${formatCentsBRL(installments.totalCents)} em valor nominal.`,
    differenceCents > 0
      ? `Nesse cenário, o parcelamento continua ${formatCentsBRL(differenceCents)} acima do preço à vista informado.`
      : differenceCents === 0
        ? "Nesse cenário, as duas opções ficam equivalentes."
        : `Nesse cenário, o valor presente do parcelamento fica ${formatCentsBRL(Math.abs(differenceCents))} abaixo do preço à vista informado.`,
    `Cenário matemático com a taxa informada, não recomendação. Rendimento não é garantido, e imposto, liquidez e o uso que você daria ao dinheiro mudam a conta.`,
  ];

  return {
    monthlyRate,
    firstInstallment: rate.firstInstallment,
    presentValueCents,
    nominalTotalCents: installments.totalCents,
    cashPriceCents: cash.totalCents,
    differenceCents,
    /* O preço à vista que igualaria as duas opções nesta taxa. */
    breakEvenCashPriceCents: presentValueCents,
    sentences,
  };
}

/* ========================================================================== *
 * 8. Trade-offs
 * ========================================================================== */

function buildTradeoffs(
  options: OptionResult[],
  labels: Record<string, ComparisonLabel[]>,
): string[] {
  const out: string[] = [];
  if (options.length < 2) return out;

  const menorTotal = options.filter((o) => labels[o.id]?.includes("lowest-total"));
  const menorParcela = options.filter((o) => labels[o.id]?.includes("lowest-installment"));

  if (menorParcela.length === 1 && menorTotal.length === 1) {
    const parcela = menorParcela[0]!;
    const total = menorTotal[0]!;
    if (parcela.id !== total.id && parcela.totalCents > total.totalCents) {
      out.push(
        `"${parcela.label}" tem a menor parcela, mas custa ${formatCentsBRL(parcela.totalCents - total.totalCents)} a mais no total que "${total.label}".`,
      );
    }
  }

  for (const option of options.filter((o) => o.type === "installments" && o.upfrontCents > 0)) {
    out.push(
      `Em "${option.label}", ${formatCentsBRL(option.upfrontCents)} saem no ato como entrada — esse valor entra no total e some quando você soma só as parcelas.`,
    );
  }

  const parceladas = options.filter((o) => o.installmentCount > 0);
  if (parceladas.length >= 2) {
    const curta = parceladas.reduce((a, b) => (b.installmentCount < a.installmentCount ? b : a));
    const longa = parceladas.reduce((a, b) => (b.installmentCount > a.installmentCount ? b : a));
    if (curta.id !== longa.id) {
      const meses = longa.installmentCount - curta.installmentCount;
      out.push(
        `"${curta.label}" termina ${meses} ${meses === 1 ? "mês" : "meses"} antes de "${longa.label}".`,
      );
    }
  }

  return out;
}

/* ========================================================================== *
 * 9. Orquestração
 * ========================================================================== */

export function comparePaymentOptions(input: PurchaseInput): PurchaseResult {
  const blockingReasons: string[] = [];

  const usable = input.options.filter((o) => validateOption(o).length === 0);
  if (usable.length === 0) {
    blockingReasons.push(
      "Informe ao menos uma forma de pagamento completa: o preço à vista, ou a quantidade e o valor das parcelas.",
    );
  }

  const options = usable.map(computeOption);

  if (blockingReasons.length > 0) {
    return {
      status: "blocked",
      blockingReasons,
      options,
      labels: {},
      cashVsInstallments: null,
      cashDiscount: null,
      presentValue: null,
      tradeoffs: [],
      notes: [],
    };
  }

  const labels = assignLabels(options);
  const cashVsInstallments = compareCashVsInstallments(options);
  const tradeoffs = buildTradeoffs(options, labels);

  const cashOption = options.find((o) => o.type === "cash");
  const cashDiscount =
    input.referencePriceCents && input.referencePriceCents > 0 && cashOption
      ? computeCashDiscount(input.referencePriceCents, cashOption.totalCents)
      : null;

  let presentValue: PresentValueResult | null = null;
  if (input.opportunityRate && cashOption && cashVsInstallments) {
    const alvo = options.find((o) => o.id === cashVsInstallments.installmentOptionId);
    if (alvo) presentValue = computePresentValue(cashOption, alvo, input.opportunityRate);
  }

  return {
    status: "ok",
    blockingReasons: [],
    options,
    labels,
    cashVsInstallments,
    cashDiscount,
    presentValue,
    tradeoffs,
    notes: buildNotes(cashDiscount, cashVsInstallments),
  };
}

function buildNotes(
  discount: CashDiscountResult | null,
  comparison: CashVsInstallmentsResult | null,
): string[] {
  const notes: string[] = [];

  /*
   * A nota mais importante da ferramenta. Quando existem as duas métricas,
   * elas usam denominadores diferentes e chegam a percentuais diferentes
   * para a mesma compra. Deixar isso implícito é a origem da confusão que
   * esta página existe para desfazer.
   */
  if (discount && comparison) {
    notes.push(
      `São dois percentuais com bases diferentes: o desconto à vista (${formatPercentBR(discount.discountPercent)}) é calculado sobre o preço de referência, e o custo de parcelar (${formatPercentBR(Math.abs(comparison.differencePercent))}) é calculado sobre o preço à vista. Eles respondem a perguntas distintas e não devem ser somados nem comparados entre si.`,
    );
  }

  if (discount) {
    notes.push(
      "O preço de referência é o valor anunciado antes do desconto. Ele serve de base para o percentual, mas não é necessariamente o preço que a compra teria sem a promoção.",
    );
  }

  notes.push(
    "A diferença entre as opções não é chamada aqui de juros: sem conhecer a estrutura do parcelamento, o que dá para afirmar é quanto ele acrescenta ao preço, não a que título.",
  );

  return notes;
}

/* ========================================================================== *
 * 10. Formatação
 * ========================================================================== */

export {
  formatCentsBRL,
  formatPercentBR,
  parseBRLToCents,
} from "@/lib/calculators/proposal-comparison";
