"use client";

import { useSearch } from "./SearchProvider";
import type { SearchSource } from "./analytics";

/** Lupa do header (desktop e mobile). */
export function SearchTrigger({
  source = "header",
  className,
}: {
  source?: SearchSource;
  className?: string;
}) {
  const { openSearch } = useSearch();
  return (
    <button
      type="button"
      onClick={() => openSearch(source)}
      aria-label="Pesquisar"
      title="Pesquisar (/)"
      className={
        className ??
        "flex h-10 w-10 items-center justify-center rounded-lg border border-brand-border text-brand-muted hover:text-brand-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-navy"
      }
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
    </button>
  );
}

/** Campo "fake" que abre o modal — usado na home e na página 404. */
export function SearchBox({
  source,
  placeholder = "Busque por assunto, cidade ou dúvida…",
  chips = false,
}: {
  source: SearchSource;
  placeholder?: string;
  chips?: boolean;
}) {
  const { openSearch } = useSearch();
  return (
    <div>
      <button
        type="button"
        onClick={() => openSearch(source)}
        aria-label="Abrir busca"
        className="flex w-full max-w-xl items-center gap-3 rounded-xl border border-brand-border bg-white px-4 py-3.5 text-left text-brand-muted shadow-sm hover:border-brand-navy/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-navy"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <span className="truncate">{placeholder}</span>
      </button>
      {chips ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {["Consignado", "FGTS", "Negativado", "CET", "Golpes"].map((term) => (
            <button
              key={term}
              type="button"
              onClick={() => openSearch(source, term)}
              className="rounded-full border border-white/25 px-3 py-1 text-sm text-white/85 hover:border-brand-gold hover:text-brand-gold"
            >
              {term}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
