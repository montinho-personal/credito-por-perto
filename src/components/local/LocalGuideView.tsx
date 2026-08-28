import Link from "next/link";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import type { Metadata } from "next";
import {
  getLocalGuideByPath,
  getLocalDossier,
  type LocalGuide,
} from "@/lib/content/local";
import { getAuthor } from "@/lib/content/authors";
import { getStateByCode } from "@/lib/local-seo/states";
import { buildMetadata } from "@/lib/metadata/build";
import { SITE_URL } from "@/lib/site";
import { webPageJsonLd } from "@/lib/schema/jsonld";
import { ZoomableImage } from "@/components/content/ZoomableImage";
import { JsonLd } from "@/components/seo/JsonLd";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { mdxComponents } from "@/components/content/mdx-components";
import { TableOfContents, EditorialDisclosure, AuthorBox } from "@/components/article/ArticleShell";
import { formatDateBR, LastVerifiedBadge, OfficialSourceLink } from "@/components/content/sources";
import { CityFinancialMapSection } from "@/components/local/CityFinancialMap";
import { buildCityFinancialMap } from "@/lib/local/city-map";
import { GATE_TODAY, isGuideIndexable } from "@/lib/local/guide-indexability";

function isGuideVisible(guide: LocalGuide): boolean {
  if (guide.frontmatter.status === "published") return true;
  // Fora de produção, rascunhos ficam visíveis para revisão (com noindex global).
  return process.env.VERCEL_ENV !== "production";
}

export function localGuideMetadata(urlPath: string): Metadata {
  const guide = getLocalGuideByPath(urlPath);
  if (!guide || !isGuideVisible(guide)) return {};
  const fm = guide.frontmatter;
  return buildMetadata({
    title: fm.title,
    description: fm.description,
    path: guide.urlPath,
    noindex: !isGuideIndexable(guide),
    image: fm.featuredImage ? `${SITE_URL}${fm.featuredImage}` : undefined,
    imageAlt: fm.imageAlt,
    imageWidth: fm.imageWidth,
    imageHeight: fm.imageHeight,
  });
}

export function LocalGuideView({ urlPath }: { urlPath: string }) {
  const guide = getLocalGuideByPath(urlPath);
  if (!guide || !isGuideVisible(guide)) {
    notFound();
  }
  const fm = guide.frontmatter;
  const author = getAuthor(fm.authorId);
  const dossier = fm.dossierId ? getLocalDossier(fm.dossierId) : undefined;
  const financialMap = fm.dossierId ? buildCityFinancialMap(fm.dossierId, GATE_TODAY) : null;
  const state = getStateByCode(fm.stateCode);

  const breadcrumbs = [
    { name: "Início", path: "/" },
    { name: "Empréstimos", path: "/emprestimos/" },
    { name: "Guias locais", path: "/emprestimos/guias-locais/" },
  ];
  if (fm.localityType !== "state" && state) {
    breadcrumbs.push({
      name: state.name,
      path: `/emprestimos/${state.code}/`,
    });
  }
  if (fm.districtSlug && fm.citySlug) {
    breadcrumbs.push({
      name: fm.citySlug
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
      path: `/emprestimos/${fm.stateCode}/${fm.citySlug}/`,
    });
  }
  breadcrumbs.push({ name: fm.localityName, path: guide.urlPath });

  return (
    <article className="mx-auto max-w-3xl px-4 py-8">
      <JsonLd
        data={webPageJsonLd(fm.title, fm.description, guide.urlPath, fm.featuredImage)}
      />
      <Breadcrumbs items={breadcrumbs} />
      <header className="mt-6 border-b border-brand-border pb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-teal-dark">
          Guia local {state ? `· ${state.name}` : ""}
        </p>
        <h1 className="mt-2 font-serif text-3xl font-bold leading-tight text-brand-navy md:text-4xl">
          {fm.title}
        </h1>
        <p className="mt-3 text-lg leading-relaxed text-brand-muted">{fm.excerpt}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-brand-muted">
          {author ? (
            <span>
              Por{" "}
              <Link href="/quem-somos/" className="font-medium text-brand-navy hover:underline">
                {author.name}
              </Link>
            </span>
          ) : null}
          {fm.updatedAt ? <span>Atualizado em {formatDateBR(fm.updatedAt)}</span> : null}
        </div>
        {fm.lastVerifiedAt ? (
          <div className="mt-3">
            <LastVerifiedBadge date={fm.lastVerifiedAt} />
          </div>
        ) : null}
      </header>

      {fm.featuredImage && fm.imageAlt ? (
        <div className="mt-6">
          <ZoomableImage
            src={fm.featuredImage}
            alt={fm.imageAlt}
            width={fm.imageWidth ?? 1600}
            height={fm.imageHeight ?? 900}
            priority
            className="w-full rounded-xl border border-brand-border"
          />
        </div>
      ) : null}

      {fm.status !== "published" ? (
        <p className="mt-6 rounded-lg border border-brand-warning/40 bg-brand-warning-soft p-4 text-sm font-medium text-brand-warning">
          Guia em elaboração — as informações locais deste guia ainda estão em
          processo de verificação com fontes oficiais e por isso ele não está
          publicado nem indexado.
        </p>
      ) : null}

      <TableOfContents content={guide.content} />

      <div className="article-body">
        <MDXRemote
          source={guide.content}
          components={mdxComponents}
          options={{
            // Conteúdo de primeira parte; ver nota em ArticleView.
            blockJS: false,
            mdxOptions: { remarkPlugins: [remarkGfm] },
          }}
        />
      </div>

      {financialMap ? <CityFinancialMapSection map={financialMap} /> : null}

      {dossier && dossier.officialSources.length > 0 ? (
        <section aria-labelledby="fontes-locais" className="mt-10 border-t border-brand-border pt-6">
          <h2 id="fontes-locais" className="font-serif text-xl font-bold text-brand-navy">
            Fontes consultadas
          </h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-brand-muted">
            {dossier.officialSources.map((source) => (
              <li key={source.documentTitle}>
                <span className="font-medium text-brand-text">{source.organization}</span>
                {" — "}
                {source.sourceLocation.startsWith("http") ? (
                  <OfficialSourceLink href={source.sourceLocation}>
                    {source.documentTitle}
                  </OfficialSourceLink>
                ) : (
                  source.documentTitle
                )}
                {". "}Consulta em {formatDateBR(source.checkedAt)}.
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <EditorialDisclosure />
      {author ? <AuthorBox author={author} /> : null}
    </article>
  );
}
