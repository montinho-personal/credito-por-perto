/**
 * Eventos da Calculadora de Renegociação.
 *
 * Mesmo contrato de privacidade das demais ferramentas: medimos USO, nunca
 * CONTEÚDO. Aqui o cuidado é maior que o normal, porque os números digitados
 * — saldo em aberto, valor do acordo, tamanho da entrada — descrevem em
 * detalhe a situação financeira de quem está endividado. Nada disso sai do
 * navegador.
 *
 * O que pode ser medido: formato da proposta (à vista / com entrada / só
 * parcelas), quantidade de propostas comparadas e quais integrações foram
 * abertas. Faixas em vez de valores, sempre.
 */

import { track } from "@/lib/analytics/track";

export function trackRenegotiationStart() {
  track("renegotiation_tool_start");
}

export function trackRenegotiationComplete(meta: {
  offers: 1 | 2 | 3;
  hasCashOffer: boolean;
  hasEntry: boolean;
  hasReferenceBalance: boolean;
  usedVariableInstallments: boolean;
}) {
  track("renegotiation_tool_complete", {
    offers: meta.offers,
    has_cash_offer: meta.hasCashOffer,
    has_entry: meta.hasEntry,
    has_reference_balance: meta.hasReferenceBalance,
    variable_installments: meta.usedVariableInstallments,
  });
}

export function trackRenegotiationAddOffer(total: 2 | 3) {
  track("renegotiation_offer_add", { offers: total });
}

export function trackRenegotiationDiscountCheck(matches: boolean) {
  /* Só o veredito booleano — nunca os percentuais envolvidos. */
  track("renegotiation_discount_check", { matches });
}

export function trackRenegotiationCopySummary() {
  track("renegotiation_copy_summary");
}

export function trackRenegotiationClear() {
  track("renegotiation_clear");
}

type ToolTarget = "budget" | "debt_plan" | "debt_switch" | "fraud" | "early_payoff";

export function trackRenegotiationToolClick(target: ToolTarget) {
  /* Era `renegotiation_${target}_click`: cinco nomes montados em tempo de
     execução para medir uma ação só. O nome montado não aparecia em busca
     nenhuma no código, e cada um gastava uma das 500 vagas de nome de evento
     da propriedade. Um nome, o alvo como parâmetro — e o relatório passa a
     somar e comparar as cinco saídas na mesma linha. */
  track("renegotiation_tool_click", { target });
}
