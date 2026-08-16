/**
 * Motor de busca client-side sobre MiniSearch: normalização, sinônimos,
 * prefixo, fuzzy moderado e ranking por campo. Sem chamadas de rede por
 * tecla e sem envio da consulta a terceiros.
 */
import MiniSearch, { type SearchResult as MiniResult } from "minisearch";
import { normalizeSearchText } from "./normalize";
import { expandQuery } from "./synonyms";
import type { SearchDoc } from "./types";

export interface SearchHit {
  doc: SearchDoc;
  score: number;
}

/** Pesos por campo — título/cidade dominam; corpo é só desempate. */
const FIELD_BOOSTS = {
  title: 8,
  city: 8,
  keywords: 6,
  tags: 5,
  headings: 3,
  description: 2,
  content: 0.6,
} as const;

export class SearchEngine {
  private mini: MiniSearch<SearchDoc>;
  private byId = new Map<string, SearchDoc>();

  constructor(docs: SearchDoc[]) {
    this.mini = new MiniSearch<SearchDoc>({
      idField: "id",
      fields: [
        "title",
        "city",
        "state",
        "stateCode",
        "keywords",
        "tags",
        "headings",
        "description",
        "content",
      ],
      storeFields: [],
      processTerm: (term) => {
        const normalized = normalizeSearchText(term);
        return normalized.length > 1 ? normalized : null;
      },
      tokenize: (text) => normalizeSearchText(text).split(" ").filter(Boolean),
    });
    for (const doc of docs) {
      this.byId.set(doc.id, doc);
    }
    this.mini.addAll(docs);
  }

  search(rawQuery: string, limit = 30): SearchHit[] {
    const query = normalizeSearchText(rawQuery);
    if (query.length < 2) return [];

    const options = {
      prefix: true,
      // Fuzzy moderado: só para termos com 5+ letras, distância ~20%.
      fuzzy: (term: string) => (term.length >= 5 ? 0.2 : false),
      boost: FIELD_BOOSTS as unknown as Record<string, number>,
      // Guia local ganha reforço quando a consulta menciona a cidade dele.
      boostDocument: (docId: string) => {
        const doc = this.byId.get(String(docId));
        if (!doc) return 1;
        if (doc.type === "guia-local" && doc.city) {
          const city = normalizeSearchText(doc.city);
          if (query.includes(city) || city.includes(query)) return 2.5;
        }
        // Pilares editoriais (featured) vencem artigos de apoio no empate.
        if (doc.featured) return 1.35;
        return 1;
      },
    };

    // 1ª passada: todos os termos (AND) — precisão máxima.
    let results: MiniResult[] = this.mini.search(query, {
      ...options,
      combineWith: "AND",
    });

    // 2ª passada: OR, se o AND não encontrou nada (consultas longas).
    if (results.length === 0) {
      results = this.mini.search(query, { ...options, combineWith: "OR" });
    }

    // 3ª passada: sinônimos, somados com peso reduzido.
    const extras = expandQuery(query);
    if (extras.length > 0) {
      const synonymResults = this.mini.search(extras.join(" "), {
        ...options,
        combineWith: "OR",
        boost: Object.fromEntries(
          Object.entries(FIELD_BOOSTS).map(([field, value]) => [
            field,
            value * 0.35,
          ]),
        ),
      });
      const merged = new Map<string, MiniResult>();
      for (const r of results) merged.set(String(r.id), r);
      for (const r of synonymResults) {
        const existing = merged.get(String(r.id));
        if (existing) {
          existing.score += r.score * 0.5;
        } else {
          merged.set(String(r.id), { ...r, score: r.score * 0.5 });
        }
      }
      results = [...merged.values()];
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .flatMap((r) => {
        const doc = this.byId.get(String(r.id));
        return doc ? [{ doc, score: r.score }] : [];
      });
  }
}

/** Cache do índice por sessão de página — um único fetch por navegação. */
let enginePromise: Promise<SearchEngine> | null = null;

export function loadSearchEngine(): Promise<SearchEngine> {
  if (!enginePromise) {
    enginePromise = fetch("/search-index.json")
      .then((res) => {
        if (!res.ok) throw new Error(`search-index ${res.status}`);
        return res.json() as Promise<SearchDoc[]>;
      })
      .then((docs) => new SearchEngine(docs))
      .catch((error) => {
        enginePromise = null;
        throw error;
      });
  }
  return enginePromise;
}
