"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ARTICLE_THEMES, type ThemeKey } from "@/lib/content/themes";

export interface ExplorerItem {
  url: string;
  title: string;
  description: string;
  sectionLabel: string;
  updatedLabel: string;
  themes: ThemeKey[];
}

/**
 * Lista do blog com filtro por tema (cluster de leitura). Todos os cards
 * são renderizados no HTML inicial (SEO intacto); o filtro só esconde no
 * cliente. Sem novas URLs — nada de páginas finas ou crawl traps.
 */
export function ArticlesExplorer({ items }: { items: ExplorerItem[] }) {
  const [theme, setTheme] = useState<ThemeKey | "todos">("todos");

  const counts = useMemo(() => {
    const map = new Map<ThemeKey, number>();
    for (const item of items) {
      for (const key of item.themes) {
        map.set(key, (map.get(key) ?? 0) + 1);
      }
    }
    return map;
  }, [items]);

  const visible =
    theme === "todos"
      ? items
      : items.filter((item) => item.themes.includes(theme));

  return (
    <div>
      <div
        role="group"
        aria-label="Filtrar por tema"
        className="mt-8 flex flex-wrap gap-2"
      >
        <button
          type="button"
          aria-pressed={theme === "todos"}
          onClick={() => setTheme("todos")}
          className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
            theme === "todos"
              ? "border-brand-navy bg-brand-navy text-white"
              : "border-brand-border bg-white text-brand-text hover:border-brand-navy hover:text-brand-navy"
          }`}
        >
          Todos ({items.length})
        </button>
        {ARTICLE_THEMES.filter((t) => (counts.get(t.key) ?? 0) > 0).map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={theme === t.key}
            onClick={() => setTheme(theme === t.key ? "todos" : t.key)}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
              theme === t.key
                ? "border-brand-navy bg-brand-navy text-white"
                : "border-brand-border bg-white text-brand-text hover:border-brand-navy hover:text-brand-navy"
            }`}
          >
            {t.label} ({counts.get(t.key)})
          </button>
        ))}
      </div>

      <p aria-live="polite" className="sr-only">
        {visible.length} conteúdos exibidos
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((item) => (
          <Link
            key={item.url}
            href={item.url}
            className="flex h-full flex-col rounded-xl border border-brand-border bg-white p-5 transition-colors hover:border-brand-teal"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-teal-dark">
              {item.sectionLabel}
            </p>
            <h3 className="mt-2 font-serif text-lg font-bold leading-snug text-brand-navy">
              {item.title}
            </h3>
            <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-brand-muted">
              {item.description}
            </p>
            <p className="mt-3 text-xs text-brand-muted">
              Atualizado em {item.updatedLabel}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
