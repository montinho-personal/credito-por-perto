import { CATEGORIES, type CategoryId } from "@/lib/content/categories";
import { getPublishedByCategory } from "@/lib/content/articles";
import { ArticleCard } from "@/components/ui/cards";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { webPageJsonLd } from "@/lib/schema/jsonld";

export function CategoryHub({
  category,
  intro,
  children,
}: {
  category: CategoryId;
  intro?: string;
  children?: React.ReactNode;
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
        {def.label}
      </h1>
      <p className="mt-3 max-w-2xl text-lg leading-relaxed text-brand-muted">
        {intro ?? def.description}
      </p>
      {children}
      <section aria-label={`Guias de ${def.label}`} className="mt-10">
        {articles.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <ArticleCard key={article.urlPath} article={article} />
            ))}
          </div>
        ) : (
          <p className="text-brand-muted">
            Os primeiros guias desta seção estão em produção editorial.
          </p>
        )}
      </section>
    </div>
  );
}
