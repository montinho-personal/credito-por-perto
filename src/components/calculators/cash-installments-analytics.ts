/**
 * Eventos de "À vista ou parcelado?".
 *
 * Mesmo contrato das demais ferramentas: medimos USO, nunca CONTEÚDO.
 * Preço, parcela, número de parcelas, desconto, produto e loja ficam no
 * navegador — juntos, descrevem o que a pessoa está comprando e por quanto.
 */

interface GtagWindow extends Window {
  gtag?: (...args: unknown[]) => void;
}

function gtag(...args: unknown[]) {
  const w = window as GtagWindow;
  if (typeof w.gtag === "function") w.gtag(...args);
}

export function trackCashStart() {
  gtag("event", "cash_installment_start");
}

export function trackCashComplete(meta: {
  options: 1 | 2 | 3;
  hasCashOption: boolean;
  hasEntry: boolean;
  hasReferencePrice: boolean;
  variableInstallments: boolean;
  /* Relação, não valores: mais caro, igual ou mais barato. */
  relation: "installments-cost-more" | "equal" | "installments-cost-less" | "none";
}) {
  gtag("event", "cash_installment_complete", {
    options: meta.options,
    has_cash_option: meta.hasCashOption,
    has_entry: meta.hasEntry,
    has_reference_price: meta.hasReferencePrice,
    variable_installments: meta.variableInstallments,
    relation: meta.relation,
  });
}

export function trackCashAddOption(total: 2 | 3) {
  gtag("event", "cash_installment_extra_option_add", { options: total });
}

export function trackCashAdvancedOpen() {
  gtag("event", "cash_installment_advanced_open");
}

export function trackCashCopySummary() {
  gtag("event", "cash_installment_copy_summary");
}

export function trackCashClear() {
  gtag("event", "cash_installment_clear");
}

export function trackCashBudgetClick() {
  gtag("event", "cash_installment_budget_click");
}
