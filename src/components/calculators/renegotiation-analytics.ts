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

interface GtagWindow extends Window {
  gtag?: (...args: unknown[]) => void;
}

function gtag(...args: unknown[]) {
  const w = window as GtagWindow;
  if (typeof w.gtag === "function") w.gtag(...args);
}

export function trackRenegotiationStart() {
  gtag("event", "renegotiation_tool_start");
}

export function trackRenegotiationComplete(meta: {
  offers: 1 | 2 | 3;
  hasCashOffer: boolean;
  hasEntry: boolean;
  hasReferenceBalance: boolean;
  usedVariableInstallments: boolean;
}) {
  gtag("event", "renegotiation_tool_complete", {
    offers: meta.offers,
    has_cash_offer: meta.hasCashOffer,
    has_entry: meta.hasEntry,
    has_reference_balance: meta.hasReferenceBalance,
    variable_installments: meta.usedVariableInstallments,
  });
}

export function trackRenegotiationAddOffer(total: 2 | 3) {
  gtag("event", "renegotiation_offer_add", { offers: total });
}

export function trackRenegotiationDiscountCheck(matches: boolean) {
  /* Só o veredito booleano — nunca os percentuais envolvidos. */
  gtag("event", "renegotiation_discount_check", { matches });
}

export function trackRenegotiationCopySummary() {
  gtag("event", "renegotiation_copy_summary");
}

export function trackRenegotiationClear() {
  gtag("event", "renegotiation_clear");
}

type ToolTarget = "budget" | "debt_plan" | "debt_switch" | "fraud" | "early_payoff";

export function trackRenegotiationToolClick(target: ToolTarget) {
  gtag("event", `renegotiation_${target}_click`);
}
