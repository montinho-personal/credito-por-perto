import Link from "next/link";
import type { Article } from "@/lib/content/articles";
import type { Author } from "@/lib/validation/frontmatter";
import { CATEGORIES } from "@/lib/content/categories";
import { extractHeadings } from "@/lib/text/slug";
import { formatDateBR, LastVerifiedBadge } from "@/components/content/sources";

export function ArticleHeader({
  article,
  author,
  reviewer,
}: {
  article: Article;
  author: Author;
  reviewer?: Author;
}) {
  const fm = article.frontmatter;
  const category = CATEGORIES[fm.category];
  return (
    <header className="border-b border-brand-border pb-6">
      <p className="text-sm font-semibold uppercase tracking-wide text-brand-teal-dark">
        <Link href={category.basePath} className="hover:underline">
          {category.label}
        </Link>
      </p>
      <h1 className="mt-2 font-serif text-3xl font-bold leading-tight text-brand-navy md:text-4xl">
        {fm.title}
      </h1>
      <p className="mt-3 text-lg leading-relaxed text-brand-muted">{fm.excerpt}</p>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-brand-muted">
        <span>
          Por{" "}
          <Link
            href={author.isTeam ? "/quem-somos/" : `/autores/${author.id}/`}
            className="font-medium text-brand-navy hover:underline"
          >
            {author.name}
          </Link>
        </span>
        {fm.updatedAt ? (
          <span className="font-medium text-brand-navy">
            Atualizado em <time dateTime={fm.updatedAt}>{formatDateBR(fm.updatedAt)}</time>
          </span>
        ) : null}
        <span>
          Publicado em <time dateTime={fm.publishedAt}>{formatDateBR(fm.publishedAt)}</time>
        </span>
        {reviewer ? (
          <span>
            Revisão editorial:{" "}
            <Link
              href={reviewer.isTeam ? "/quem-somos/" : `/autores/${reviewer.id}/`}
              className="font-medium text-brand-navy hover:underline"
            >
              {reviewer.name}
            </Link>
          </span>
        ) : null}
      </div>
      {fm.sourceCheckedAt ? (
        <div className="mt-3">
          <LastVerifiedBadge date={fm.sourceCheckedAt} />
        </div>
      ) : null}
    </header>
  );
}

/**
 * Índice do conteúdo.
 *
 * `extraHeadings` existe para seções que a página monta fora do MDX — hoje o
 * Mapa Financeiro dos guias locais. Sem isso, a seção mais útil da página
 * ficava fora do índice e só era encontrada por quem rolasse até o fim.
 */
export function TableOfContents({
  content,
  extraHeadings = [],
}: {
  content: string;
  extraHeadings?: Array<{ id: string; text: string }>;
}) {
  const headings = [
    ...extractHeadings(content).filter((h) => h.depth === 2),
    ...extraHeadings.map((h) => ({ ...h, depth: 2 })),
  ];
  if (headings.length < 3) return null;
  return (
    <nav
      aria-label="Índice do conteúdo"
      className="my-6 rounded-xl border border-brand-border bg-brand-surface-soft p-5"
    >
      <p className="text-sm font-bold uppercase tracking-wide text-brand-muted">
        Neste guia
      </p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-[0.97rem]">
        {headings.map((h) => (
          <li key={h.id}>
            <a href={`#${h.id}`} className="text-brand-teal-dark hover:underline">
              {h.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function EditorialDisclosure() {
  return (
    <aside
      aria-label="Aviso editorial"
      className="mt-10 rounded-xl border border-brand-border bg-brand-surface-soft p-5 text-sm leading-relaxed text-brand-muted"
    >
      <p>
        <strong className="text-brand-navy">Aviso editorial:</strong> o Crédito
        Por Perto é um portal independente de educação financeira. Não
        concedemos, intermediamos nem aprovamos empréstimos, e este conteúdo não
        substitui a análise das condições reais oferecidas pelas instituições.
        Saiba como produzimos e revisamos nossos conteúdos na{" "}
        <Link href="/politica-editorial/" className="text-brand-teal-dark underline">
          política editorial
        </Link>{" "}
        e na{" "}
        <Link href="/metodologia/" className="text-brand-teal-dark underline">
          metodologia
        </Link>
        . Encontrou um erro? Veja a{" "}
        <Link href="/politica-de-correcoes/" className="text-brand-teal-dark underline">
          política de correções
        </Link>
        .
      </p>
    </aside>
  );
}

export function AuthorBox({ author }: { author: Author }) {
  return (
    <aside
      aria-label="Sobre a autoria"
      className="mt-8 flex gap-4 rounded-xl border border-brand-border bg-white p-5"
    >
      <div
        aria-hidden="true"
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-navy font-serif text-lg font-bold text-white"
      >
        {author.name.charAt(0)}
      </div>
      <div>
        <p className="font-bold text-brand-navy">
          <Link
            href={author.isTeam ? "/quem-somos/" : `/autores/${author.id}/`}
            className="hover:underline"
          >
            {author.name}
          </Link>
        </p>
        <p className="text-sm text-brand-muted">{author.role}</p>
        <p className="mt-2 text-sm leading-relaxed">{author.bio}</p>
      </div>
    </aside>
  );
}

export function RelatedArticles({ articles }: { articles: Article[] }) {
  if (articles.length === 0) return null;
  return (
    <section aria-labelledby="relacionados" className="mt-12">
      <h2 id="relacionados" className="font-serif text-xl font-bold text-brand-navy">
        Leia também
      </h2>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2">
        {articles.map((related) => (
          <li key={related.urlPath}>
            <Link
              href={related.urlPath}
              className="block h-full rounded-xl border border-brand-border bg-white p-4 hover:border-brand-teal"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-teal-dark">
                {CATEGORIES[related.frontmatter.category].label}
              </p>
              <p className="mt-1 font-semibold leading-snug text-brand-navy">
                {related.frontmatter.title}
              </p>
              <p className="mt-2 line-clamp-2 text-sm text-brand-muted">
                {related.frontmatter.description}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
