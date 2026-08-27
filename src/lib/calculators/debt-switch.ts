/**
 * Motor da ferramenta "Vale a pena trocar esta dívida?".
 *
 * Compara DÍVIDA ATUAL × NOVA CONDIÇÃO em três eixos — parcela, prazo e
 * total — sem jamais emitir veredito ("vale a pena" não existe aqui).
 *
 * Princípios de cálculo:
 * - Dinheiro em centavos inteiros; arredondamento só na apresentação.
 * - "Saldo para quitação" e "soma das parcelas restantes" são coisas
 *   DIFERENTES e aparecem separadas (CDC art. 52 §2º + Res. CMN 3.516/2007:
 *   liquidação antecipada tem redução proporcional de juros e tarifa vedada).
 * - Parcela variável (cartão rotativo, cheque especial, contratos variáveis):
 *   NUNCA multiplicar parcela × prazo — o motor recusa o total futuro e diz
 *   por quê, em vez de produzir número enganoso.
 * - Dinheiro extra (troco): totais não são comparados como equivalentes
 *   quando os valores financiados diferem.
 * - Conversão de taxas: anual = (1+m)^12 − 1; mensal = (1+a)^(1/12) − 1.
 *   Diferenças sempre em PONTOS PERCENTUAIS.
 * - Nada aqui usa IA: cada frase do resultado é regra determinística.
 */

export type SwitchType =
  | "portability"
  | "renegotiation"
  | "new-loan"
  | "unknown";

export type DebtModality =
  | "pessoal"
  | "consignado"
  | "cartao"
  | "cheque-especial"
  | "financiamento"
  | "outra"
  | "nao-sei";

export interface RateInput {
  percent: number;
  period: "month" | "year";
}

export interface CurrentDebtInput {
  /** Saldo atualizado para quitação hoje (preferencial) */
  payoffBalanceCents: number | null;
  installmentCents: number | null;
  remainingInstallments: number | null;
  /** As parcelas restantes têm o mesmo valor? */
  fixedInstallments: "yes" | "no" | "unknown";
  /** Total restante oficial informado pela instituição (alternativa à multiplicação) */
  officialFutureTotalCents: number | null;
  rate: RateInput | null;
  cetAnnualPercent: number | null;
  modality: DebtModality;
}

export interface NewOfferInput {
  /** Valor total da nova operação */
  amountCents: number | null;
  installmentCents: number | null;
  installments: number | null;
  rate: RateInput | null;
  cetAnnualPercent: number | null;
  /** Custos pagos fora das parcelas (legítimos, ex.: tarifa/registro) */
  externalCostsCents: number | null;
  /** A nova operação libera dinheiro extra? */
  cashOut: "yes" | "no" | "unknown";
  cashOutCents: number | null;
  /** Pediram pagamento ANTES de liberar o dinheiro? */
  upfrontPaymentAsked: boolean;
  /** A nova operação exige garantia que a atual não possui? */
  newGuarantee: "yes" | "no" | "unknown";
}

export type WarningCode =
  | "variable-future-unknown"
  | "cash-out-separation"
  | "possible-undeclared-cash-out"
  | "upfront-payment-alert"
  | "cet-missing"
  | "payoff-missing"
  | "guarantee-added"
  | "portability-limits-check";

export interface DebtSwitchResult {
  /** nova parcela − parcela atual (negativo = alívio mensal) */
  monthlyDiffCents: number | null;
  /** novo prazo − prazo restante (positivo = mais meses pagando) */
  termDiffMonths: number | null;
  /** Soma nominal das parcelas restantes informadas (ou total oficial) */
  currentFutureTotalCents: number | null;
  /** Origem do total atual: "official" | "installments" */
  currentFutureTotalSource: "official" | "installments" | null;
  /** nova parcela × novo prazo + custos externos */
  newTotalCents: number | null;
  /** novo total − total atual; null quando não comparável */
  totalDiffCents: number | null;
  /** false quando os valores financiados diferem (troco) ou parcela variável */
  totalsComparable: boolean;
  /** soma das parcelas restantes − saldo para quitação (didático) */
  payoffVsFutureCents: number | null;
  /** diferença de taxa em p.p. ao mês (negativo = nova taxa menor) */
  rateDiffMonthlyPP: number | null;
  /** diferença de CET em p.p. ao ano */
  cetDiffAnnualPP: number | null;
  /** dinheiro extra declarado */
  cashOutCents: number | null;
  completeness: "complete" | "partial";
  missing: string[];
  warnings: WarningCode[];
  /** Frases determinísticas do resultado, em ordem */
  sentences: string[];
}

/* ------------------------------------------------------------------ */
/* Conversão de taxas                                                 */
/* ------------------------------------------------------------------ */

export function annualToMonthlyEffective(annualPercent: number): number {
  return (Math.pow(1 + annualPercent / 100, 1 / 12) - 1) * 100;
}

export function monthlyRateOf(rate: RateInput): number {
  return rate.period === "month" ? rate.percent : annualToMonthlyEffective(rate.percent);
}

/* ------------------------------------------------------------------ */
/* Formatação (apresentação)                                          */
/* ------------------------------------------------------------------ */

function brl(cents: number): string {
  const abs = Math.abs(cents);
  const reais = Math.floor(abs / 100);
  const c = String(abs % 100).padStart(2, "0");
  const grouped = reais.toLocaleString("pt-BR");
  return `R$ ${grouped},${c}`;
}

function months(n: number): string {
  const abs = Math.abs(n);
  return abs === 1 ? "1 mês" : `${abs} meses`;
}

/* ------------------------------------------------------------------ */
/* Motor                                                              */
/* ------------------------------------------------------------------ */

export function isVariableDebt(current: CurrentDebtInput): boolean {
  return (
    current.modality === "cartao" ||
    current.modality === "cheque-especial" ||
    current.fixedInstallments === "no"
  );
}

export function compareDebtSwitch(
  current: CurrentDebtInput,
  offer: NewOfferInput,
  switchType: SwitchType = "unknown",
): DebtSwitchResult {
  const warnings: WarningCode[] = [];
  const missing: string[] = [];
  const sentences: string[] = [];

  const variable = isVariableDebt(current);

  /* --- parcela --- */
  const monthlyDiffCents =
    current.installmentCents !== null && offer.installmentCents !== null
      ? offer.installmentCents - current.installmentCents
      : null;

  /* --- prazo --- */
  const termDiffMonths =
    current.remainingInstallments !== null && offer.installments !== null && !variable
      ? offer.installments - current.remainingInstallments
      : null;

  /* --- total atual --- */
  let currentFutureTotalCents: number | null = null;
  let currentFutureTotalSource: DebtSwitchResult["currentFutureTotalSource"] = null;
  if (!variable) {
    if (current.officialFutureTotalCents !== null) {
      currentFutureTotalCents = current.officialFutureTotalCents;
      currentFutureTotalSource = "official";
    } else if (current.installmentCents !== null && current.remainingInstallments !== null) {
      currentFutureTotalCents = current.installmentCents * current.remainingInstallments;
      currentFutureTotalSource = "installments";
    }
  } else {
    warnings.push("variable-future-unknown");
  }

  /* --- total novo --- */
  const newTotalCents =
    offer.installmentCents !== null && offer.installments !== null
      ? offer.installmentCents * offer.installments + (offer.externalCostsCents ?? 0)
      : null;

  /* --- troco / valores financiados diferentes --- */
  const cashOutCents = offer.cashOut === "yes" ? (offer.cashOutCents ?? null) : null;
  const hasCashOut = cashOutCents !== null && cashOutCents > 0;
  if (hasCashOut) warnings.push("cash-out-separation");
  if (
    offer.cashOut !== "yes" &&
    current.payoffBalanceCents !== null &&
    offer.amountCents !== null &&
    offer.amountCents > current.payoffBalanceCents
  ) {
    warnings.push("possible-undeclared-cash-out");
  }

  const totalsComparable =
    currentFutureTotalCents !== null && newTotalCents !== null && !hasCashOut && !variable;

  const totalDiffCents = totalsComparable
    ? newTotalCents! - currentFutureTotalCents!
    : null;

  /* --- saldo de quitação vs soma das parcelas --- */
  const payoffVsFutureCents =
    current.payoffBalanceCents !== null && currentFutureTotalCents !== null
      ? currentFutureTotalCents - current.payoffBalanceCents
      : null;

  /* --- taxas --- */
  let rateDiffMonthlyPP: number | null = null;
  if (current.rate && offer.rate) {
    rateDiffMonthlyPP = monthlyRateOf(offer.rate) - monthlyRateOf(current.rate);
  }
  const cetDiffAnnualPP =
    current.cetAnnualPercent !== null && offer.cetAnnualPercent !== null
      ? offer.cetAnnualPercent - current.cetAnnualPercent
      : null;

  /* --- alertas adicionais --- */
  if (offer.upfrontPaymentAsked) warnings.push("upfront-payment-alert");
  if (offer.newGuarantee === "yes") warnings.push("guarantee-added");
  if (current.cetAnnualPercent === null || offer.cetAnnualPercent === null) {
    warnings.push("cet-missing");
  }
  if (current.payoffBalanceCents === null) warnings.push("payoff-missing");
  if (
    switchType === "portability" &&
    ((current.payoffBalanceCents !== null &&
      offer.amountCents !== null &&
      offer.amountCents > current.payoffBalanceCents) ||
      (current.remainingInstallments !== null &&
        offer.installments !== null &&
        offer.installments > current.remainingInstallments))
  ) {
    warnings.push("portability-limits-check");
  }

  /* --- completude --- */
  if (current.payoffBalanceCents === null) missing.push("saldo para quitação da dívida atual");
  if (current.cetAnnualPercent === null) missing.push("CET da dívida atual");
  if (offer.cetAnnualPercent === null) missing.push("CET da nova operação");
  if (variable) missing.push("total futuro da dívida atual (parcela variável)");
  const completeness: DebtSwitchResult["completeness"] =
    missing.length === 0 ? "complete" : "partial";

  /* --- frases determinísticas --- */
  if (monthlyDiffCents !== null && monthlyDiffCents !== 0) {
    sentences.push(
      monthlyDiffCents < 0
        ? `Sua parcela cairia ${brl(monthlyDiffCents)} por mês.`
        : `Sua parcela subiria ${brl(monthlyDiffCents)} por mês.`,
    );
  } else if (monthlyDiffCents === 0) {
    sentences.push("A parcela mensal não muda.");
  }

  if (termDiffMonths !== null && termDiffMonths !== 0) {
    sentences.push(
      termDiffMonths > 0
        ? `Você ficaria ${months(termDiffMonths)} a mais pagando.`
        : `A dívida terminaria ${months(termDiffMonths)} antes.`,
    );
  } else if (termDiffMonths === 0) {
    sentences.push("O prazo não muda.");
  }

  if (totalDiffCents !== null && totalDiffCents !== 0) {
    sentences.push(
      totalDiffCents > 0
        ? `Pelos valores informados, os pagamentos da nova condição somariam ${brl(totalDiffCents)} a mais.`
        : `Pelos valores informados, os pagamentos da nova condição somariam ${brl(totalDiffCents)} a menos.`,
    );
  } else if (totalDiffCents === 0) {
    sentences.push("O total dos pagamentos informados não muda.");
  }

  if (hasCashOut) {
    sentences.push(
      `A nova operação não está apenas substituindo a dívida: ela também libera ${brl(cashOutCents!)} adicionais. Por isso os totais não são comparados como equivalentes.`,
    );
  }

  if (variable) {
    sentences.push(
      "Não é possível estimar com precisão o custo futuro da dívida atual apenas com esses dados: em modalidades de parcela variável, o custo depende da utilização e dos encargos de cada mês.",
    );
  }

  // Trade-offs especiais — só quando matematicamente sustentados.
  if (
    rateDiffMonthlyPP !== null &&
    rateDiffMonthlyPP < 0 &&
    totalDiffCents !== null &&
    totalDiffCents > 0
  ) {
    sentences.push("A taxa caiu. O custo total informado, não.");
  }
  if (
    monthlyDiffCents !== null &&
    monthlyDiffCents < 0 &&
    termDiffMonths !== null &&
    termDiffMonths > 0 &&
    totalDiffCents !== null &&
    totalDiffCents > 0
  ) {
    sentences.push("Menos por mês, mais meses pagando: a parcela cai porque o prazo aumenta.");
  }
  if (
    monthlyDiffCents !== null &&
    monthlyDiffCents < 0 &&
    termDiffMonths !== null &&
    termDiffMonths <= 0 &&
    totalDiffCents !== null &&
    totalDiffCents < 0
  ) {
    sentences.push(
      "Com os dados informados, a nova condição apresenta parcela menor, prazo igual ou menor e menor total de pagamentos. A ferramenta não avalia as demais condições contratuais nem recomenda contratação.",
    );
  }

  return {
    monthlyDiffCents,
    termDiffMonths,
    currentFutureTotalCents,
    currentFutureTotalSource,
    newTotalCents,
    totalDiffCents,
    totalsComparable,
    payoffVsFutureCents,
    rateDiffMonthlyPP,
    cetDiffAnnualPP,
    cashOutCents,
    completeness,
    missing,
    warnings,
    sentences,
  };
}

/** Frase única "em português claro" para o topo do resultado. */
export function buildPlainSummary(result: DebtSwitchResult): string | null {
  const parts: string[] = [];
  if (result.monthlyDiffCents !== null && result.monthlyDiffCents < 0) {
    parts.push(`você ganharia ${brl(result.monthlyDiffCents)} de folga por mês`);
  } else if (result.monthlyDiffCents !== null && result.monthlyDiffCents > 0) {
    parts.push(`você pagaria ${brl(result.monthlyDiffCents)} a mais por mês`);
  }
  if (result.termDiffMonths !== null && result.termDiffMonths > 0) {
    parts.push(`passaria mais ${months(result.termDiffMonths)} pagando`);
  } else if (result.termDiffMonths !== null && result.termDiffMonths < 0) {
    parts.push(`terminaria a dívida ${months(result.termDiffMonths)} antes`);
  }
  if (result.totalDiffCents !== null && result.totalDiffCents > 0) {
    parts.push(
      `desembolsaria aproximadamente ${brl(result.totalDiffCents)} a mais no total informado`,
    );
  } else if (result.totalDiffCents !== null && result.totalDiffCents < 0) {
    parts.push(
      `reduziria o total informado em aproximadamente ${brl(result.totalDiffCents)}`,
    );
  }
  if (parts.length === 0) return null;
  const first = parts[0]!;
  const sentence =
    parts.length === 1
      ? `${first.charAt(0).toUpperCase()}${first.slice(1)}.`
      : `${first.charAt(0).toUpperCase()}${first.slice(1)}, mas ${parts.slice(1).join(" e ")}.`;
  // "mas" só faz sentido quando há contraste; se tudo melhora, troque por "e".
  const allGood =
    (result.monthlyDiffCents ?? 0) <= 0 &&
    (result.termDiffMonths ?? 0) <= 0 &&
    (result.totalDiffCents ?? 0) <= 0;
  const allBad =
    (result.monthlyDiffCents ?? 0) >= 0 &&
    (result.termDiffMonths ?? 0) >= 0 &&
    (result.totalDiffCents ?? 0) >= 0;
  if ((allGood || allBad) && parts.length > 1) {
    return `${first.charAt(0).toUpperCase()}${first.slice(1)}, ${parts.slice(1).join(" e ")}.`;
  }
  return sentence;
}
