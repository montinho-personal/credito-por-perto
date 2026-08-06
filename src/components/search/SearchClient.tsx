"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface SearchEntry {
  title: string;
  description: string;
  url: string;
  section: string;
}

export function SearchClient() {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState<SearchEntry[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/search-index.json")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("fetch"))))
      .then((data: SearchEntry[]) => {
        if (!cancelled) setIndex(data);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const normalized = query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const results =
    index && normalized.length >= 2
      ? index.filter((entry) => {
          const haystack = `${entry.title} ${entry.description} ${entry.section}`
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
          return normalized
            .split(/\s+/)
            .every((word) => haystack.includes(word));
        })
      : [];

  return (
    <div>
      <label htmlFor="site-search" className="block text-sm font-semibold text-brand-navy">
        O que você procura?
      </label>
      <input
        id="site-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Ex.: CET, consignado, golpe…"
        autoComplete="off"
        className="mt-2 w-full rounded-lg border border-brand-border bg-white px-4 py-3 text-brand-text focus:border-brand-teal"
      />
      <div aria-live="polite" className="mt-6">
        {loadError ? (
          <p className="text-brand-muted">
            Não foi possível carregar a busca agora. Tente navegar pelas seções
            do menu.
          </p>
        ) : null}
        {index && normalized.length >= 2 ? (
          results.length > 0 ? (
            <ul className="space-y-4">
              {results.slice(0, 30).map((entry) => (
                <li key={entry.url} className="rounded-xl border border-brand-border bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-teal-dark">
                    {entry.section}
                  </p>
                  <Link
                    href={entry.url}
                    className="mt-1 block font-serif text-lg font-bold text-brand-navy hover:underline"
                  >
                    {entry.title}
                  </Link>
                  <p className="mt-1 text-sm text-brand-muted">{entry.description}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-brand-muted">
              Nenhum resultado para “{query}”. Tente outros termos, como o nome
              da modalidade (consignado, FGTS) ou o assunto (juros, golpe).
            </p>
          )
        ) : null}
      </div>
    </div>
  );
}
