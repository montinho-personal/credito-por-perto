"use client";

/**
 * BUSCA DA CENTRAL DE CALCULADORAS
 * ============================================================================
 *
 * Para quem sabe mais ou menos o que quer ("CET", "parcela de carro", "3% ao
 * mês") e para quem só sabe descrever a dúvida ("banco é verdadeiro",
 * "quanto realmente estou pagando"). Casa a consulta com nome, pergunta,
 * sinônimos leigos e termos de cada ferramenta, que chegam prontos do
 * servidor. Vinte e poucos itens: a busca é uma conta simples no navegador,
 * sem índice, sem biblioteca, sem rede.
 *
 * Nada do que a pessoa digita sai do aparelho como foi digitado. A medição
 * recebe a consulta normalizada e SEM NÚMERO ("financiamento de mil" vira
 * "financiamento de mil"; "casa 500 mil" vira "casa mil"), limitada a 40
 * caracteres, e só depois de a pessoa parar de digitar.
 *
 * Zero resultado nunca é beco: mostra os destaques, a Central de Decisões e
 * a busca do site inteiro, e registra a consulta para descobrir o que falta.
 */

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { track } from "@/lib/analytics/track";
import { normalizeSearchText } from "@/lib/search/normalize";
import { expandQuery } from "@/lib/search/synonyms";
import type { ToolSearchEntry, ToolType } from "@/lib/tools/registry";
import { ToolIcon } from "./ToolIcon";

const MAX_RESULTS = 6;
const MIN_QUERY = 2;

/** Palavras que não distinguem ferramenta nenhuma. */
const STOP = new Set(["de", "da", "do", "das", "dos", "a", "o", "e", "em", "um", "uma", "para", "por", "com", "que", "no", "na", "meu", "minha", "eu", "quanto", "qual", "calculadora", "simulador", "calcular", "simular", "ferramenta"]);

interface Indexed {
  entry: ToolSearchEntry;
  /** Nome, nome curto e pergunta: casar aqui vale mais. */
  names: string[];
  /** Sinônimos leigos, inteiros, para casar frase. */
  phrases: string[];
  /** Palavras-chave e termos de auditoria: pista, não identidade. */
  hints: string[];
  /** Conjunto de tokens de todos os termos. */
  tokens: Set<string>;
  nameTokens: Set<string>;
}

function index(entries: ToolSearchEntry[]): Indexed[] {
  return entries.map((entry) => {
    const names = entry.names.map(normalizeSearchText).filter(Boolean);
    const phrases = entry.aliases.map(normalizeSearchText).filter(Boolean);
    const hints = entry.hints.map(normalizeSearchText).filter(Boolean);
    const tokens = new Set([...names, ...phrases, ...hints].flatMap((p) => p.split(" ")));
    const nameTokens = new Set(names.flatMap((p) => p.split(" ")));
    return { entry, names, phrases, hints, tokens, nameTokens };
  });
}

function score(item: Indexed, query: string, queryTokens: string[], expanded: string[]): number {
  let s = 0;
  // Nome da ferramenta: quem digita o nome quer a ferramenta.
  for (const n of item.names) {
    if (n === query) s += 70;
    else if (n.includes(query)) s += 20;
  }
  // Sinônimo leigo inteiro dentro da consulta, ou consulta dentro dele.
  for (const p of item.phrases) {
    if (p === query) s += 40;
    else if (p.includes(query)) s += 18;
    else if (query.includes(p) && p.split(" ").length > 1) s += 14;
  }
  for (const h of item.hints) {
    if (h === query) s += 12;
    else if (h.includes(query)) s += 6;
    else if (query.includes(h) && h.split(" ").length > 1) s += 5;
  }
  for (const t of queryTokens) {
    if (STOP.has(t)) continue;
    if (item.nameTokens.has(t)) s += 8;
    else if (item.tokens.has(t)) s += 5;
    else {
      // Prefixo: "financ" casa "financiamento"; "conver" casa "conversor".
      let prefix = false;
      for (const tok of item.tokens) {
        if (t.length >= 4 && tok.startsWith(t)) {
          prefix = true;
          break;
        }
      }
      if (prefix) s += 3;
    }
  }
  for (const t of expanded) {
    if (!queryTokens.includes(t) && item.tokens.has(t)) s += 2;
  }
  return s;
}

/** Consulta como vai para a medição: normalizada, sem número, curta. */
export function queryForAnalytics(raw: string): string | null {
  const q = normalizeSearchText(raw).replace(/\d+/g, " ").replace(/\s+/g, " ").trim();
  if (q.replace(/\s/g, "").length < 3) return null;
  return q.slice(0, 40).trim();
}

function rank(indexed: Indexed[], raw: string): ToolSearchEntry[] {
  const query = normalizeSearchText(raw);
  const queryTokens = query.split(" ").filter(Boolean);
  const expanded = expandQuery(query).filter((t) => !queryTokens.includes(t));
  return indexed
    .map((item) => ({ item, s: score(item, query, queryTokens, expanded) }))
    .filter((x) => x.s >= 5)
    .sort((a, b) => b.s - a.s)
    .slice(0, MAX_RESULTS)
    .map((x) => x.item.entry);
}

/** Busca pura, sem React: usada nos testes com as mesmas regras da tela. */
export function searchTools(entries: ToolSearchEntry[], raw: string): ToolSearchEntry[] {
  if (normalizeSearchText(raw).length < MIN_QUERY) return [];
  return rank(index(entries), raw);
}

export function ToolFinder({
  entries,
  featured,
  examples,
}: {
  entries: ToolSearchEntry[];
  /** Ids dos destaques, para o estado sem resultado. */
  featured: string[];
  examples: string[];
}) {
  const uid = useId();
  const [query, setQuery] = useState("");
  const indexed = useMemo(() => index(entries), [entries]);
  const results = useMemo(
    () => (normalizeSearchText(query).length < MIN_QUERY ? null : rank(indexed, query)),
    [indexed, query],
  );

  /* Mede depois que a pessoa para de digitar, uma vez por consulta. */
  const lastSent = useRef<string | null>(null);
  useEffect(() => {
    if (results === null) return;
    const q = queryForAnalytics(query);
    if (!q || q === lastSent.current) return;
    const timer = window.setTimeout(() => {
      lastSent.current = q;
      track("calculator_hub_search", { query: q, results_count: results.length });
      if (results.length === 0) track("calculator_zero_results", { query: q });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [query, results]);

  const featuredEntries = featured.map((id) => entries.find((e) => e.id === id)).filter((e): e is ToolSearchEntry => e !== undefined).slice(0, 3);
  const listId = `${uid}-resultados`;

  return (
    <div data-track-area="busca-ferramentas" data-track-event="calculator_card_click" className="mt-5">
      <label htmlFor={`${uid}-busca`} className="block text-sm font-semibold text-brand-navy">
        O que você quer calcular?
      </label>
      <div className="relative mt-1.5">
        <svg viewBox="0 0 24 24" aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-muted" fill="currentColor">
          <path d="M10 3a7 7 0 0 1 5.6 11.2l5.1 5.1-1.4 1.4-5.1-5.1A7 7 0 1 1 10 3Zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z" />
        </svg>
        <input
          id={`${uid}-busca`}
          type="search"
          autoComplete="off"
          enterKeyHint="search"
          placeholder="Buscar ferramenta ou dúvida"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-controls={listId}
          aria-describedby={`${uid}-dica`}
          className="min-h-12 w-full rounded-xl border border-brand-border bg-white py-3 pl-11 pr-4 text-base text-brand-text focus:border-brand-teal"
        />
      </div>
      <p id={`${uid}-dica`} className="mt-1.5 text-xs text-brand-muted">
        Exemplos: {examples.map((e, i) => (
          <span key={e}>
            {i > 0 ? " · " : ""}
            <button type="button" onClick={() => setQuery(e)} className="underline underline-offset-2 hover:text-brand-navy" data-track-ignore>
              {e}
            </button>
          </span>
        ))}
        . A busca acontece no seu navegador.
      </p>

      <div id={listId} aria-live="polite" className="mt-3">
        {results === null ? null : results.length > 0 ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {results.map((r) => (
              <li key={r.id}>
                <ResultLink entry={r} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-xl border border-brand-border bg-brand-surface-soft p-4 text-sm">
            <p className="font-semibold text-brand-navy">Não encontramos uma ferramenta exatamente para isso.</p>
            <p className="mt-1 text-brand-muted">Tente outra palavra, ou veja por onde outras pessoas costumam começar:</p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-3">
              {featuredEntries.map((r) => (
                <li key={r.id}>
                  <ResultLink entry={r} />
                </li>
              ))}
            </ul>
            <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
              <Link href="/decisoes-financeiras/" className="font-semibold text-brand-teal-dark underline underline-offset-2">
                Descrever minha situação na Central de Decisões
              </Link>
              <Link href={`/busca/?q=${encodeURIComponent(query.trim())}`} className="font-semibold text-brand-teal-dark underline underline-offset-2">
                Buscar no site inteiro
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultLink({ entry }: { entry: { id: string; route: string; name: string; question: string; cta: string; type: ToolType; categoryLabel: string } }) {
  return (
    <Link
      href={entry.route}
      data-track={entry.id}
      className="flex h-full items-start gap-3 rounded-xl border border-brand-border bg-white p-3 transition hover:border-brand-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy"
    >
      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-teal-soft text-brand-navy">
        <ToolIcon type={entry.type} className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block font-semibold leading-snug text-brand-navy">{entry.name}</span>
        <span className="block text-sm text-brand-muted">{entry.question}</span>
        <span className="mt-1 block text-xs text-brand-muted">
          {entry.categoryLabel} · <span className="font-semibold text-brand-teal-dark">{entry.cta} →</span>
        </span>
      </span>
    </Link>
  );
}
