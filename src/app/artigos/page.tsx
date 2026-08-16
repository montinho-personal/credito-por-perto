import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { getRecentArticles } from "@/lib/content/articles";
import { getArticleThemes } from "@/lib/content/themes";
import { CATEGORIES } from "@/lib/content/categories";
import { formatDateBR } from "@/components/content/sources";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import {
  ArticlesExplorer,
  type ExplorerItem,
} from "@/components/articles/ArticlesExplorer";

export const metadata: Metadata = buildMetadata({
  title: "Blog: todos os guias e artigos sobre crédito",
  description:
    "Todos os conteúdos publicados pelo Crédito por Perto, filtráveis por tema: consignado, FGTS, juros e CET, golpes, dívidas e mais — do mais recente ao mais antigo.",
  path: "/artigos/",
});

export default function ArtigosPage() {
  const items: ExplorerItem[] = getRecentArticles(500).map((article) => ({
    url: article.urlPath,
    title: article.frontmatter.title,
    description: article.frontmatter.description,
    sectionLabel: CATEGORIES[article.frontmatter.category].label,
    updatedLabel: formatDateBR(
      article.frontmatter.updatedAt ?? article.frontmatter.publishedAt,
    ),
    themes: getArticleThemes(article.frontmatter),
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: "Blog", path: "/artigos/" },
        ]}
      />
      <h1 className="mt-6 font-serif text-3xl font-bold text-brand-navy md:text-4xl">
        Todos os conteúdos
      </h1>
      <p className="mt-3 max-w-2xl text-lg text-brand-muted">
        Guias e artigos em ordem de atualização. Filtre por tema para chegar
        direto ao assunto — cada conteúdo indica autoria, datas e fontes
        consultadas.
      </p>
      <ArticlesExplorer items={items} />
    </div>
  );
}
