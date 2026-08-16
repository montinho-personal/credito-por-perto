/** Documento indexável da busca interna. */
export interface SearchDoc {
  /** URL canônica relativa — também é o id (deduplicação natural). */
  id: string;
  title: string;
  url: string;
  description: string;
  /** Rótulo da seção exibido no resultado (ex.: "Empréstimos"). */
  section: string;
  /** Tipo do documento, para agrupamento e filtros. */
  type: "artigo" | "guia-local" | "calculadora" | "glossario";
  tags: string[];
  /** Termos extra definidos editorialmente (cluster, sigla da cidade etc.). */
  keywords: string[];
  /** H2/H3 do conteúdo. */
  headings: string[];
  /** Corpo em texto puro, truncado — peso mínimo no ranking. */
  content: string;
  /** Página pilar/destaque editorial — leve reforço no ranking. */
  featured?: boolean;
  city?: string;
  state?: string;
  stateCode?: string;
  updatedAt?: string;
}
