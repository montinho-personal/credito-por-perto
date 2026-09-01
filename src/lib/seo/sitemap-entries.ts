import { getPublishedArticles } from "@/lib/content/articles";
import { getAllLocalGuides } from "@/lib/content/local";
import { getToolRoutes, getTools } from "@/lib/tools/registry";
import { STATIC_PAGE_DATES } from "@/lib/seo/static-page-dates";
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
  "/decisoes-financeiras/",
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
/**
 * `lastmod` de uma página estática.
 *
 * Três origens, em ordem de precisão:
 *
 * 1. HUB QUE LISTA CONTEÚDO — a data do item mais recente que ele exibe. É a
 *    resposta certa: `/emprestimos/` de fato muda quando um artigo de
 *    empréstimos é publicado, e ninguém precisa lembrar de anotar isso;
 * 2. FERRAMENTA — `updatedAt` do registry;
 * 3. RESTO — a tabela declarada em static-page-dates.ts.
 *
 * O que NÃO é usado, em nenhuma hipótese: a data do build. Ela faria o
 * sitemap jurar que 126 páginas mudaram a cada deploy, e um sinal que sempre
 * grita deixa de ser sinal.
 */
function staticLastModified(path: string): string | undefined {
  const hub = hubLastModified(path);
  if (hub) return hub;
  const tool = getTools().find((t) => t.route === path);
  if (tool) return tool.updatedAt;
  return STATIC_PAGE_DATES[path];
}

/** Data mais recente entre os itens que um hub lista. */
function hubLastModified(path: string): string | undefined {
  const articles = getPublishedArticles().filter((a) => !a.frontmatter.noindex);
  const dateOf = (a: (typeof articles)[number]) =>
    a.frontmatter.updatedAt ?? a.frontmatter.publishedAt;
  const newest = (values: string[]) =>
    values.length > 0 ? values.sort().at(-1) : undefined;

  if (path === "/artigos/") return newest(articles.map(dateOf));

  const category = CATEGORY_HUBS[path];
  if (category) {
    return newest(
      articles.filter((a) => a.frontmatter.category === category).map(dateOf),
    );
  }

  if (path === "/emprestimos/guias-locais/") {
    return newest(
      getIndexableLocalGuides().map(
        (g) => g.frontmatter.updatedAt ?? g.frontmatter.publishedAt,
      ),
    );
  }
  return undefined;
}

const CATEGORY_HUBS: Record<string, string> = {
  "/emprestimos/": "emprestimos",
  "/juros-e-cet/": "juros-e-cet",
  "/credito-seguro/": "credito-seguro",
  "/organizacao-financeira/": "organizacao-financeira",
};

export function getSitemapEntries(): SitemapEntry[] {
  const entries: SitemapEntry[] = STATIC_INDEXABLE_PATHS.map((path) => ({
    url: canonicalUrl(path),
    lastModified: staticLastModified(path),
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
    if (!publishedStates.has(code)) continue;
    /* O índice do estado muda quando um guia daquele estado muda: a data sai
       do guia mais recente, não de uma constante que alguém teria de lembrar
       de atualizar a cada cidade nova. */
    const dates = getIndexableLocalGuides()
      .filter((g) => g.frontmatter.stateCode === code)
      .map((g) => g.frontmatter.updatedAt ?? g.frontmatter.publishedAt)
      .sort();
    entries.push({
      url: canonicalUrl(`/emprestimos/${code}/`),
      lastModified: dates.at(-1),
    });
  }

  return entries;
}
