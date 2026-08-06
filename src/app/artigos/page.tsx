import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { getRecentArticles } from "@/lib/content/articles";
import { ArticleCard } from "@/components/ui/cards";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";

export const metadata: Metadata = buildMetadata({
  title: "Blog: todos os guias e artigos sobre crédito",
  description:
    "Todos os conteúdos publicados pelo Crédito Por Perto, do mais recente ao mais antigo: modalidades de empréstimo, juros, CET, segurança e organização financeira.",
  path: "/artigos/",
});

export default function ArtigosPage() {
  const articles = getRecentArticles(500);
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
        Guias e artigos em ordem de atualização. Cada conteúdo indica autoria,
        datas e fontes consultadas.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((article) => (
          <ArticleCard key={article.urlPath} article={article} />
        ))}
      </div>
    </div>
  );
}
