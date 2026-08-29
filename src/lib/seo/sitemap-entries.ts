import { getPublishedArticles } from "@/lib/content/articles";
import { getAllLocalGuides } from "@/lib/content/local";
import { getToolRoutes } from "@/lib/tools/registry";
import { getIndexableLocalGuides } from "@/lib/local/guide-indexability";
import { canonicalUrl } from "@/lib/seo/canonical";

export interface SitemapEntry {
  url: string;
  lastModified?: string;
}

/** Páginas estáticas indexáveis (a busca fica fora: é noindex). */
/**
 * As rotas das ferramentas vêm do registry, não de uma cópia escrita à mão.
 * A lista manual já deixou uma ferramenta nova fora do sitemap — e o efeito é
 * silencioso: a página existe, é linkada, mas não é anunciada ao buscador.
 */
export const STATIC_INDEXABLE_PATHS = [
  "/",
  "/emprestimos/",
  "/juros-e-cet/",
  "/credito-seguro/",
  "/organizacao-financeira/",
  "/calculadoras/",
  ...getToolRoutes(),
  "/emprestimos/guias-locais/",
  "/artigos/",
  "/glossario/",
  "/sobre/",
  "/quem-somos/",
  "/politica-editorial/",
  "/metodologia/",
  "/como-ganhamos-dinheiro/",
  "/politica-de-publicidade/",
  "/politica-de-correcoes/",
  "/contato/",
  "/politica-de-privacidade/",
  "/politica-de-cookies/",
  "/termos-de-uso/",
  "/aviso-legal/",
  "/acessibilidade/",
  "/mapa-do-site/",
] as const;

/**
 * Gera as entradas do sitemap: somente URLs canônicas, publicadas e
 * indexáveis. Rascunhos, noindex e páginas locais não aprovadas ficam fora.
 */
export function getSitemapEntries(): SitemapEntry[] {
  const entries: SitemapEntry[] = STATIC_INDEXABLE_PATHS.map((path) => ({
    url: canonicalUrl(path),
  }));

  for (const article of getPublishedArticles()) {
    if (article.frontmatter.noindex) continue;
    entries.push({
      url: article.canonical,
      lastModified:
        article.frontmatter.updatedAt ?? article.frontmatter.publishedAt,
    });
  }

  // Sitemap só lista o que o Indexability Gate aprova: incluir uma URL
  // marcada noindex é mandar sinais contraditórios ao buscador.
  for (const guide of getIndexableLocalGuides()) {
    entries.push({
      url: guide.canonical,
      lastModified: guide.frontmatter.updatedAt ?? guide.frontmatter.publishedAt,
    });
  }

  // Índices de estado entram apenas quando têm ao menos um guia publicado.
  const publishedStates = new Set(
    getIndexableLocalGuides().map((g) => g.frontmatter.stateCode),
  );
  const allStatesWithGuides = new Set(
    getAllLocalGuides().map((g) => g.frontmatter.stateCode),
  );
  for (const code of allStatesWithGuides) {
    if (publishedStates.has(code)) {
      entries.push({ url: canonicalUrl(`/emprestimos/${code}/`) });
    }
  }

  return entries;
}
