/**
 * Eventos de uso da busca — SEM a consulta bruta (tema financeiro é
 * sensível; medimos uso, nunca conteúdo). Só dispara se o GA4 já estiver
 * carregado, o que por sua vez só acontece após consentimento.
 */
export type SearchSource =
  | "header"
  | "home"
  | "busca-page"
  | "404"
  | "atalho";

interface GtagWindow extends Window {
  gtag?: (...args: unknown[]) => void;
}

function gtag(...args: unknown[]) {
  const w = window as GtagWindow;
  if (typeof w.gtag === "function") w.gtag(...args);
}

export function trackSearchOpen(source: SearchSource) {
  gtag("event", "search_open", { source });
}

export function trackSearchPerformed(
  source: SearchSource,
  resultsCount: number,
  queryLength: number,
) {
  gtag("event", "search_performed", {
    source,
    results_count: resultsCount,
    query_length: queryLength,
  });
}

export function trackSearchResultClick(
  source: SearchSource,
  position: number,
  resultType: string,
) {
  gtag("event", "search_result_click", {
    source,
    result_position: position,
    result_type: resultType,
  });
}

export function trackSearchNoResults(source: SearchSource) {
  gtag("event", "search_no_results", { source });
}
