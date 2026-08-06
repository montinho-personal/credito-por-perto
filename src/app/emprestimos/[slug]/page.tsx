import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArticleView, articleMetadata } from "@/components/article/ArticleView";
import { getPublishedArticles, getAllArticles } from "@/lib/content/articles";
import { getAllLocalGuides, getPublishedLocalGuides } from "@/lib/content/local";
import { getStateByCode, isStateCode } from "@/lib/local-seo/states";
import { buildMetadata } from "@/lib/metadata/build";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { LocalGuideCard } from "@/components/ui/cards";

interface Props {
  params: Promise<{ slug: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  const articleSlugs = getAllArticles()
    .filter((a) => a.frontmatter.category === "emprestimos")
    .map((a) => ({ slug: a.frontmatter.slug }));
  const stateCodes = [
    ...new Set(getAllLocalGuides().map((g) => g.frontmatter.stateCode)),
  ].map((code) => ({ slug: code }));
  return [...articleSlugs, ...stateCodes];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (isStateCode(slug)) {
    const state = getStateByCode(slug)!;
    return buildMetadata({
      title: `Empréstimos em ${state.name}: guias por cidade`,
      description: `Guias locais de empréstimos e crédito em ${state.name}: canais de proteção ao consumidor, atendimento disponível e cuidados verificados por cidade.`,
      path: `/emprestimos/${slug}/`,
    });
  }
  return articleMetadata("emprestimos", slug);
}

function StateIndexPage({ code }: { code: string }) {
  const state = getStateByCode(code)!;
  const published = getPublishedLocalGuides().filter(
    (g) => g.frontmatter.stateCode === code && g.frontmatter.localityType !== "state",
  );
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: "Empréstimos", path: "/emprestimos/" },
          { name: "Guias locais", path: "/emprestimos/guias-locais/" },
          { name: state.name, path: `/emprestimos/${code}/` },
        ]}
      />
      <h1 className="mt-6 font-serif text-3xl font-bold text-brand-navy md:text-4xl">
        Empréstimos em {state.name}: guias por cidade
      </h1>
      <p className="mt-3 max-w-2xl text-lg leading-relaxed text-brand-muted">
        Cada guia local do Crédito Por Perto só é publicado depois de
        verificação com fontes oficiais: canais de proteção ao consumidor da
        cidade, atendimento disponível e cuidados específicos da região.
      </p>
      <section aria-label={`Guias de cidades em ${state.name}`} className="mt-8">
        {published.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {published.map((guide) => (
              <LocalGuideCard
                key={guide.urlPath}
                title={guide.frontmatter.localityName}
                description={guide.frontmatter.description}
                href={guide.urlPath}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-brand-border bg-brand-surface-soft p-6 text-brand-muted">
            Os guias de cidades de {state.name} estão em fase de verificação de
            fontes oficiais e serão publicados assim que aprovados pela revisão
            editorial. Enquanto isso, veja os{" "}
            <Link href="/emprestimos/" className="font-medium text-brand-teal-dark underline">
              guias por modalidade
            </Link>
            , que valem para todo o Brasil.
          </p>
        )}
      </section>
    </div>
  );
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  if (isStateCode(slug)) {
    const hasGuides = getAllLocalGuides().some(
      (g) => g.frontmatter.stateCode === slug,
    );
    if (!hasGuides) notFound();
    return <StateIndexPage code={slug} />;
  }
  return <ArticleView category="emprestimos" slug={slug} />;
}
