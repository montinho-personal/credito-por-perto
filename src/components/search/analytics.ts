/**
 * Eventos de uso da busca — SEM a consulta bruta (tema financeiro é
 * sensível; medimos uso, nunca conteúdo). Só dispara se o GA4 já estiver
 * carregado, o que por sua vez só acontece após consentimento.
 */

import { track } from "@/lib/analytics/track";
export type SearchSource =
  | "header"
  | "home"
  | "busca-page"
  | "guias-locais"
  | "404"
  | "atalho";

export function trackSearchOpen(source: SearchSource) {
  track("search_open", { source });
}

export function trackSearchPerformed(
  source: SearchSource,
  resultsCount: number,
  queryLength: number,
) {
  track("search_performed", {
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
  track("search_result_click", {
    source,
    result_position: position,
    result_type: resultType,
  });
}

export function trackSearchNoResults(source: SearchSource) {
  track("search_no_results", { source });
}
