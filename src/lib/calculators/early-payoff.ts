/**
 * Motor da Calculadora de Quitação Antecipada.
 *
 * O que ele faz: compara a SOMA DOS PAGAMENTOS FUTUROS INFORMADOS com o
 * SALDO PARA QUITAÇÃO INFORMADO PELA INSTITUIÇÃO e mostra a diferença.
 *
 * O que ele NUNCA faz:
 * - inventar/reconstruir o saldo oficial de quitação (parcela × restantes
 *   NÃO é saldo de quitação — a liquidação antecipada reduz
 *   proporcionalmente juros e demais acréscimos, CDC art. 52 §2º e
 *   Res. CMN 3.516/2007);
 * - chamar a diferença de "juros economizados" (pode haver outros
 *   componentes) ou de "desconto do banco" (não é promoção);
 * - multiplicar parcela × quantidade quando as parcelas não são fixas;
 * - recomendar quitar, usar reserva ou contratar crédito.
 *
 * Dinheiro em centavos inteiros; arredondamento só na apresentação.
 */

export type InstallmentsEqual = "yes" | "no" | "unknown";

export interface EarlyPayoffInput {
  /** Saldo para quitação hoje, informado pela instituição */
  payoffBalanceCents: number;
  /** Parcelas restantes (para o caminho de parcela fixa) */
  remainingInstallments: number | null;
  installmentCents: number | null;
  installmentsEqual: InstallmentsEqual;
  /** Soma das parcelas restantes informada pelo usuário (parcelas variáveis) */
  informedFutureTotalCents: number | null;
}

export type EarlyPayoffWarning =
  | "payoff-exceeds-future"
  | "very-large-difference"
  | "variable-without-total";

export interface EarlyPayoffResult {
  /** Soma dos pagamentos futuros usada na comparação (null = sem base) */
  futureTotalCents: number | null;
  /** Origem do total: multiplicação de parcela fixa ou valor informado */
  futureTotalSource: "fixed-installments" | "informed" | null;
  payoffBalanceCents: number;
  /** futuro − saldo (positivo = quitar exige menos desembolso futuro) */
  differenceCents: number | null;
  /** diferença / total futuro × 100 — "redução em relação à soma informada" */
  differencePercent: number | null;
  warnings: EarlyPayoffWarning[];
  sentences: string[];
}

function brl(cents: number): string {
  const abs = Math.abs(cents);
  const reais = Math.floor(abs / 100);
  const c = String(abs % 100).padStart(2, "0");
  return `R$ ${reais.toLocaleString("pt-BR")},${c}`;
}

export function computeEarlyPayoff(input: EarlyPayoffInput): EarlyPayoffResult {
  const warnings: EarlyPayoffWarning[] = [];
  const sentences: string[] = [];

  /* --- soma dos pagamentos futuros --- */
  let futureTotalCents: number | null = null;
  let futureTotalSource: EarlyPayoffResult["futureTotalSource"] = null;

  if (input.installmentsEqual === "no") {
    // Parcelas variáveis: só com a soma informada pelo usuário/instituição.
    if (input.informedFutureTotalCents !== null && input.informedFutureTotalCents > 0) {
      futureTotalCents = input.informedFutureTotalCents;
      futureTotalSource = "informed";
    } else {
      warnings.push("variable-without-total");
    }
  } else if (
    input.installmentCents !== null &&
    input.installmentCents > 0 &&
    input.remainingInstallments !== null &&
    input.remainingInstallments > 0
  ) {
    futureTotalCents = input.installmentCents * input.remainingInstallments;
    futureTotalSource = "fixed-installments";
  } else if (input.informedFutureTotalCents !== null && input.informedFutureTotalCents > 0) {
    futureTotalCents = input.informedFutureTotalCents;
    futureTotalSource = "informed";
  }

  /* --- diferença --- */
  const differenceCents =
    futureTotalCents !== null ? futureTotalCents - input.payoffBalanceCents : null;
  const differencePercent =
    futureTotalCents !== null && futureTotalCents > 0 && differenceCents !== null
      ? (differenceCents / futureTotalCents) * 100
      : null;

  if (differenceCents !== null && differenceCents < 0) {
    warnings.push("payoff-exceeds-future");
  } else if (differencePercent !== null && differencePercent > 60) {
    // Diferença extremamente grande: pedir conferência de digitação.
    warnings.push("very-large-difference");
  }

  /* --- frases determinísticas --- */
  if (futureTotalCents !== null && differenceCents !== null) {
    if (differenceCents > 0) {
      sentences.push(
        `Pelos valores informados, quitar hoje exigiria ${brl(input.payoffBalanceCents)} em vez de ${brl(futureTotalCents)} em pagamentos futuros — uma diferença de aproximadamente ${brl(differenceCents)}.`,
      );
      sentences.push(
        "Essa diferença pode refletir principalmente juros e outros acréscimos que deixariam de ser cobrados com a liquidação antecipada, conforme as condições do contrato — não é necessariamente um desconto promocional, nem é toda composta de juros.",
      );
    } else if (differenceCents === 0) {
      sentences.push(
        `Pelos valores informados, quitar hoje (${brl(input.payoffBalanceCents)}) custaria o mesmo que a soma das parcelas restantes.`,
      );
    } else {
      sentences.push(
        "O saldo de quitação informado ficou maior que a soma das parcelas restantes. Confira se os campos foram preenchidos corretamente ou se existem outras condições e custos no contrato.",
      );
    }
  } else if (warnings.includes("variable-without-total")) {
    sentences.push(
      "Como as parcelas restantes têm valores diferentes, a soma não pode ser calculada multiplicando uma parcela pela quantidade. Peça à instituição a soma dos pagamentos que ainda faltam — ou compare apenas com o saldo para quitação.",
    );
  }

  return {
    futureTotalCents,
    futureTotalSource,
    payoffBalanceCents: input.payoffBalanceCents,
    differenceCents,
    differencePercent,
    warnings,
    sentences,
  };
}
