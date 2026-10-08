import { CATEGORIES, type CategoryId } from "@/lib/content/categories";
import { getPublishedByCategory } from "@/lib/content/articles";
import { ArticleCard } from "@/components/ui/cards";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { webPageJsonLd } from "@/lib/schema/jsonld";
import { groupForHub } from "@/lib/content/hub-groups";

export function CategoryHub({
  category,
  intro,
  heading,
  children,
  after,
}: {
  category: CategoryId;
  intro?: string;
  /** H1 próprio; sem ele, o nome da categoria. */
  heading?: string;
  /** Conteúdo logo abaixo da abertura (botões, tabela comparativa). */
  children?: React.ReactNode;
  /** Conteúdo depois dos guias (perguntas frequentes). */
  after?: React.ReactNode;
}) {
  const def = CATEGORIES[category];
  const articles = getPublishedByCategory(category);
  return (
    <div data-track-area="hub-categoria" className="mx-auto max-w-6xl px-4 py-8">
      <JsonLd data={webPageJsonLd(def.label, def.description, def.basePath)} />
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: def.label, path: def.basePath },
        ]}
      />
      <h1 className="mt-6 font-serif text-3xl font-bold text-brand-navy md:text-4xl">
        {heading ?? def.label}
      </h1>
      <p className="mt-3 max-w-2xl text-lg leading-relaxed text-brand-muted">
        {intro ?? def.description}
      </p>
      {children}
      {articles.length > 0 ? (
        groupForHub(category, articles).map((group) => (
          <section key={group.id} aria-labelledby={`bloco-${group.id}`} className="mt-12">
            <h2 id={`bloco-${group.id}`} className="font-serif text-2xl font-bold text-brand-navy">
              {group.title}
            </h2>
            {group.intro ? <p className="mt-2 max-w-2xl text-brand-muted">{group.intro}</p> : null}
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((article) => (
                <ArticleCard key={article.urlPath} article={article} />
              ))}
            </div>
          </section>
        ))
      ) : (
        <p className="mt-10 text-brand-muted">Os primeiros guias desta seção estão em produção editorial.</p>
      )}
      {after}
    </div>
  );
}
