"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { SearchEngine, SearchHit } from "@/lib/search/engine";
import { highlightSegments } from "@/lib/search/highlight";
import {
  trackSearchNoResults,
  trackSearchPerformed,
  trackSearchResultClick,
} from "./analytics";

const FILTERS = [
  { key: "todos", label: "Todos" },
  { key: "artigo", label: "Artigos" },
  { key: "guia-local", label: "Guias locais" },
  { key: "calculadora", label: "Calculadoras" },
  { key: "glossario", label: "Glossário" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

export function SearchClient() {
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [filter, setFilter] = useState<FilterKey>("todos");
  const [engine, setEngine] = useState<SearchEngine | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import("@/lib/search/engine")
      .then((mod) => mod.loadSearchEngine())
      .then((loaded) => {
        if (!cancelled) setEngine(loaded);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Mantém ?q= na URL (sem recarregar), para compartilhar/recarregar a busca.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (query.trim().length >= 2) {
      url.searchParams.set("q", query.trim());
    } else {
      url.searchParams.delete("q");
    }
    window.history.replaceState(null, "", url.toString());
  }, [query]);

  const hasQuery = query.trim().length >= 2;
  const allHits: SearchHit[] = useMemo(() => {
    if (!engine || !hasQuery) return [];
    return engine.search(query, 50);
  }, [engine, hasQuery, query]);

  const hits = useMemo(
    () =>
      filter === "todos"
        ? allHits
        : allHits.filter((hit) => hit.doc.type === filter),
    [allHits, filter],
  );

  useEffect(() => {
    if (!engine || !hasQuery) return;
    const timer = window.setTimeout(() => {
      trackSearchPerformed("busca-page", allHits.length, query.trim().length);
      if (allHits.length === 0) trackSearchNoResults("busca-page");
    }, 800);
    return () => window.clearTimeout(timer);
  }, [engine, hasQuery, allHits.length, query]);

  const activeFilters = FILTERS.filter(
    (f) =>
      f.key === "todos" || allHits.some((hit) => hit.doc.type === f.key),
  );

  return (
    <div>
      <label
        htmlFor="site-search"
        className="block text-sm font-semibold text-brand-navy"
      >
        O que você quer saber sobre crédito?
      </label>
      <input
        id="site-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Busque por assunto, cidade ou dúvida…"
        autoComplete="off"
        autoFocus
        enterKeyHint="search"
        className="mt-2 w-full rounded-xl border border-brand-border bg-white px-4 py-3.5 text-brand-text focus:border-brand-navy focus:outline-none"
      />

      {hasQuery && allHits.length > 0 && activeFilters.length > 2 ? (
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filtrar resultados">
          {activeFilters.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                filter === f.key
                  ? "border-brand-navy bg-brand-navy text-white"
                  : "border-brand-border text-brand-text hover:border-brand-navy"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      ) : null}

      <div aria-live="polite" className="mt-6">
        {loadError ? (
          <p className="text-brand-muted">
            Não foi possível carregar a busca agora. Tente navegar pelas seções
            do menu ou pelo{" "}
            <Link href="/mapa-do-site/" className="underline">
              mapa do site
            </Link>
            .
          </p>
        ) : null}

        {engine && hasQuery ? (
          hits.length > 0 ? (
            <>
              <p className="text-sm text-brand-muted">
                {hits.length}{" "}
                {hits.length === 1 ? "resultado" : "resultados"} para{" "}
                <strong>“{query.trim()}”</strong>
              </p>
              <ul className="mt-4 space-y-4">
                {hits.map((hit, index) => (
                  <li
                    key={hit.doc.id}
                    className="rounded-xl border border-brand-border bg-white p-4"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-teal-dark">
                      {hit.doc.section}
                      {hit.doc.city
                        ? ` · ${hit.doc.city}/${hit.doc.stateCode?.toUpperCase()}`
                        : ""}
                    </p>
                    <Link
                      href={hit.doc.url}
                      onClick={() =>
                        trackSearchResultClick(
                          "busca-page",
                          index + 1,
                          hit.doc.type,
                        )
                      }
                      className="mt-1 block font-serif text-lg font-bold text-brand-navy hover:underline"
                    >
                      {highlightSegments(hit.doc.title, query).map((seg, i) =>
                        seg.match ? (
                          <mark
                            key={i}
                            className="rounded-sm bg-brand-gold/30 px-0.5 text-inherit"
                          >
                            {seg.text}
                          </mark>
                        ) : (
                          <span key={i}>{seg.text}</span>
                        ),
                      )}
                    </Link>
                    <p className="mt-1 text-sm text-brand-muted">
                      {hit.doc.description}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div>
              <p className="text-brand-text">
                Não encontramos conteúdo para <strong>“{query.trim()}”</strong>.
              </p>
              <p className="mt-2 text-brand-muted">
                Confira a escrita ou tente termos como{" "}
                <button type="button" className="underline" onClick={() => setQuery("consignado")}>
                  consignado
                </button>
                ,{" "}
                <button type="button" className="underline" onClick={() => setQuery("FGTS")}>
                  FGTS
                </button>
                ,{" "}
                <button type="button" className="underline" onClick={() => setQuery("negativado")}>
                  negativado
                </button>{" "}
                ou{" "}
                <button type="button" className="underline" onClick={() => setQuery("golpes")}>
                  golpes
                </button>
                .
              </p>
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}
