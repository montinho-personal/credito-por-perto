/**
 * Ponte entre o Indexability Gate do mapa financeiro e o guia local.
 *
 * Vive em módulo próprio de propósito: `content/local.ts` carrega os guias e
 * `local/city-map.ts` precisa dos guias para calcular colisões de doorway.
 * Colocar o gate dentro de `content/local.ts` fecharia um ciclo de imports.
 *
 * A regra editorial que este módulo aplica: o critério antigo — publicado,
 * com dossiê e com data de verificação — continua sendo condição necessária,
 * mas deixou de ser suficiente. Uma página só entra no índice quando também
 * tem camada local própria e distinta. Estado publicado é decisão editorial;
 * estado indexável é consequência da evidência.
 */
import {
  getAllLocalGuides,
  isLocalGuideIndexable,
  type LocalGuide,
} from "@/lib/content/local";
import { buildCityFinancialMap } from "@/lib/local/city-map";
import { decisionAllowsIndexing, type IndexDecision } from "@/lib/local/financial-map";

/**
 * Data de referência do gate, fixada por processo. Deliberadamente não é
 * recalculada a cada chamada: uma decisão de indexação que muda de uma
 * requisição para outra é pior que uma decisão desatualizada.
 */
export const GATE_TODAY = new Date().toISOString().slice(0, 10);

export function localGuideIndexDecision(guide: LocalGuide): IndexDecision {
  if (!isLocalGuideIndexable(guide)) return "NOINDEX";
  const dossierId = guide.frontmatter.dossierId;
  if (!dossierId) return "NOINDEX";
  const map = buildCityFinancialMap(dossierId, GATE_TODAY);
  return map ? map.indexability.decision : "NOINDEX";
}

/** Verdade única de indexação: metadata, sitemap e listagens usam esta. */
export function isGuideIndexable(guide: LocalGuide): boolean {
  return decisionAllowsIndexing(localGuideIndexDecision(guide));
}

export function getIndexableLocalGuides(): LocalGuide[] {
  return getAllLocalGuides().filter(isGuideIndexable);
}
