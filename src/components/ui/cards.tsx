import Link from "next/link";
import type { Article } from "@/lib/content/articles";
import { CATEGORIES } from "@/lib/content/categories";
import { formatDateBR } from "@/components/content/sources";

export function ArticleCard({ article }: { article: Article }) {
  const fm = article.frontmatter;
  return (
    <Link
      href={article.urlPath}
      className="flex h-full flex-col rounded-xl border border-brand-border bg-white p-5 transition-colors hover:border-brand-teal"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-teal-dark">
        {CATEGORIES[fm.category].label}
      </p>
      <h3 className="mt-2 font-serif text-lg font-bold leading-snug text-brand-navy">
        {fm.title}
      </h3>
      <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-brand-muted">
        {fm.description}
      </p>
      <p className="mt-3 text-xs text-brand-muted">
        Atualizado em {formatDateBR(fm.updatedAt ?? fm.publishedAt)}
      </p>
    </Link>
  );
}

export function CategoryCard({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex h-full flex-col rounded-xl border border-brand-border bg-white p-5 transition-colors hover:border-brand-teal"
    >
      <h3 className="font-serif text-lg font-bold text-brand-navy">{title}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-brand-muted">
        {description}
      </p>
      <p className="mt-3 text-sm font-semibold text-brand-teal-dark">
        Ver conteúdo →
      </p>
    </Link>
  );
}

export function LocalGuideCard({
  title,
  description,
  href,
  badge,
}: {
  title: string;
  description: string;
  href: string;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className="flex h-full flex-col rounded-xl border border-brand-border bg-white p-5 transition-colors hover:border-brand-teal"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-serif text-lg font-bold text-brand-navy">{title}</h3>
        {badge ? (
          <span className="shrink-0 rounded-full bg-brand-surface-soft px-2.5 py-0.5 text-xs font-medium text-brand-muted">
            {badge}
          </span>
        ) : null}
      </div>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-brand-muted">
        {description}
      </p>
    </Link>
  );
}
