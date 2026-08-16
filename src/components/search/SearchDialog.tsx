"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import type { SearchEngine, SearchHit } from "@/lib/search/engine";
import { highlightSegments } from "@/lib/search/highlight";
import {
  trackSearchNoResults,
  trackSearchPerformed,
  trackSearchResultClick,
  type SearchSource,
} from "./analytics";

const SUGGESTED = [
  "Consignado",
  "FGTS",
  "Negativado",
  "CET",
  "Golpes",
  "Calculadora",
] as const;

const MAX_RESULTS = 8;

export function SearchDialog({
  source,
  initialQuery = "",
  onClose,
}: {
  source: SearchSource;
  initialQuery?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState(initialQuery);
  const [engine, setEngine] = useState<SearchEngine | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [active, setActive] = useState(0);

  // Carrega o motor sob demanda (dynamic import + fetch do índice).
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

  useEffect(() => {
    inputRef.current?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const results: SearchHit[] = useMemo(() => {
    if (!engine || query.trim().length < 2) return [];
    return engine.search(query, MAX_RESULTS);
  }, [engine, query]);

  // Telemetria sem a consulta bruta, com debounce.
  const hasQuery = query.trim().length >= 2;
  useEffect(() => {
    if (!engine || !hasQuery) return;
    const timer = window.setTimeout(() => {
      trackSearchPerformed(source, results.length, query.trim().length);
      if (results.length === 0) trackSearchNoResults(source);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [engine, hasQuery, results.length, query, source]);

  // Reset da seleção quando a consulta muda (ajuste de estado durante o render).
  const [lastQuery, setLastQuery] = useState(query);
  if (lastQuery !== query) {
    setLastQuery(query);
    setActive(0);
  }

  const openResult = useCallback(
    (hit: SearchHit, position: number) => {
      trackSearchResultClick(source, position + 1, hit.doc.type);
      onClose();
      router.push(hit.doc.url);
    },
    [onClose, router, source],
  );

  const goToFullResults = useCallback(() => {
    onClose();
    router.push(`/busca/?q=${encodeURIComponent(query.trim())}`);
  }, [onClose, query, router]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setActive((v) => Math.min(v + 1, Math.max(results.length - 1, 0)));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActive((v) => Math.max(v - 1, 0));
      } else if (event.key === "Enter") {
        const hit = results[active];
        if (hit) {
          event.preventDefault();
          openResult(hit, active);
        } else if (query.trim().length >= 2) {
          event.preventDefault();
          goToFullResults();
        }
      } else if (event.key === "Tab") {
        // Foco preso no diálogo (input + resultados são controlados por teclas).
        event.preventDefault();
      }
    },
    [active, goToFullResults, onClose, openResult, query, results],
  );

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-brand-navy/40 p-4 pt-[10vh] backdrop-blur-sm motion-reduce:backdrop-blur-none md:pt-[14vh]"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Busca no site"
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-brand-border bg-white shadow-2xl"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-brand-border px-4">
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5 shrink-0 text-brand-muted"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Busque por assunto, cidade ou dúvida…"
            aria-label="Busque por assunto, cidade ou dúvida"
            aria-controls="search-dialog-results"
            aria-expanded={results.length > 0}
            role="combobox"
            autoComplete="off"
            enterKeyHint="search"
            className="h-14 w-full bg-transparent text-base text-brand-text outline-none placeholder:text-brand-muted"
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-xs font-semibold uppercase tracking-wide text-brand-muted hover:text-brand-navy"
          >
            Esc
          </button>
        </div>

        <div
          id="search-dialog-results"
          role="listbox"
          aria-label="Resultados da busca"
          className="max-h-[55vh] overflow-y-auto overscroll-contain p-2"
        >
          {loadError ? (
            <p className="px-3 py-6 text-sm text-brand-muted">
              Não foi possível carregar a busca agora. Tente pelo menu ou pelo{" "}
              <a href="/mapa-do-site/" className="underline">
                mapa do site
              </a>
              .
            </p>
          ) : null}

          {!hasQuery && !loadError ? (
            <div className="px-3 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">
                Buscas sugeridas
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {SUGGESTED.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => setQuery(term)}
                    className="rounded-full border border-brand-border px-3 py-1.5 text-sm text-brand-text hover:border-brand-navy hover:text-brand-navy"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {hasQuery && engine && results.length === 0 && !loadError ? (
            <div className="px-3 py-6">
              <p className="text-sm text-brand-text">
                Não encontramos conteúdo para{" "}
                <strong>“{query.trim()}”</strong>.
              </p>
              <p className="mt-2 text-sm text-brand-muted">
                Confira a escrita ou tente um destes assuntos:
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {SUGGESTED.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => setQuery(term)}
                    className="rounded-full border border-brand-border px-3 py-1.5 text-sm text-brand-text hover:border-brand-navy hover:text-brand-navy"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {results.map((hit, index) => (
            <button
              key={hit.doc.id}
              type="button"
              role="option"
              aria-selected={index === active}
              onMouseEnter={() => setActive(index)}
              onClick={() => openResult(hit, index)}
              className={`block w-full rounded-xl px-3 py-3 text-left ${
                index === active ? "bg-brand-surface-soft" : ""
              }`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-teal-dark">
                {hit.doc.section}
                {hit.doc.city ? ` · ${hit.doc.city}/${hit.doc.stateCode?.toUpperCase()}` : ""}
              </p>
              <p className="mt-0.5 font-serif text-base font-bold leading-snug text-brand-navy">
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
              </p>
              <p className="mt-0.5 line-clamp-2 text-sm text-brand-muted">
                {hit.doc.description}
              </p>
            </button>
          ))}
        </div>

        {hasQuery && results.length > 0 ? (
          <div className="border-t border-brand-border p-2">
            <button
              type="button"
              onClick={goToFullResults}
              className="block w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-brand-navy hover:bg-brand-surface-soft"
            >
              Ver todos os resultados para “{query.trim()}” →
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
