/**
 * Eventos do Comparador de Propostas — mesmo contrato de privacidade da
 * busca: medimos USO, nunca CONTEÚDO. Jamais enviar valores, parcelas,
 * CET, taxas ou apelidos digitados; esses dados revelam a situação
 * financeira da pessoa. Só dispara se o GA4 já estiver carregado (o que
 * depende do gate de consentimento existente).
 */

interface GtagWindow extends Window {
  gtag?: (...args: unknown[]) => void;
}

function gtag(...args: unknown[]) {
  const w = window as GtagWindow;
  if (typeof w.gtag === "function") w.gtag(...args);
}

export function trackCompareStart() {
  gtag("event", "credit_compare_start");
}

export function trackCompareComplete(meta: {
  proposals: 2 | 3;
  cetInformed: "all" | "some" | "none";
  advancedUsed: boolean;
  exampleUsed: boolean;
}) {
  gtag("event", "credit_compare_complete", {
    proposals: meta.proposals,
    cet_informed: meta.cetInformed,
    advanced_used: meta.advancedUsed,
    example_used: meta.exampleUsed,
  });
}

export function trackCompareAddThird() {
  gtag("event", "credit_compare_add_third");
}

export function trackCompareCopySummary() {
  gtag("event", "credit_compare_copy_summary");
}

export function trackCompareScamWarningView() {
  gtag("event", "credit_compare_scam_warning_view");
}
