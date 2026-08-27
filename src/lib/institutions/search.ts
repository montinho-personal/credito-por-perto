/**
 * Motor de busca da consulta "Essa instituição aparece no Banco Central?".
 *
 * Princípios:
 * - Busca por CNPJ tem prioridade e exige correspondência exata de dígitos —
 *   fuzzy matching NUNCA é usado para afirmar identidade.
 * - Busca por nome é tolerante (acentos, pontuação, S.A./LTDA, nome parcial),
 *   mas o resultado aproximado é sempre rotulado como "relacionado" e a
 *   escolha final é do usuário — a ferramenta não autoescolhe.
 * - CNPJ com dígitos verificadores corretos NÃO significa instituição
 *   legítima: a validação matemática só barra erros de digitação.
 */

export interface InstitutionRecord {
  id: string;
  /** Razão social / nome principal na base */
  name: string;
  /** Nome reduzido/fantasia, quando a base fornece */
  shortName?: string;
  /** Somente dígitos; 14 (completo) ou 8 (raiz), conforme a base */
  cnpjDigits: string | null;
  /** Tipo/segmento conforme a base oficial (sem interpretação) */
  type: string | null;
  uf: string | null;
  municipio: string | null;
  /** Situação, somente se a base fornecer o campo */
  situacao: string | null;
  /** Rótulo da base/recurso de origem (ex.: "Bancos comerciais e múltiplos") */
  sourceLabel: string;
}

export type MatchQuality = "exact" | "strong" | "related";

export interface InstitutionMatch {
  record: InstitutionRecord;
  quality: MatchQuality;
  score: number;
}

export type SearchMode = "cnpj" | "name";

export interface SearchOutcome {
  mode: SearchMode;
  /** Qualidade do melhor resultado (ou "related" quando só há aproximados) */
  matches: InstitutionMatch[];
}

/* ------------------------------------------------------------------ */
/* CNPJ                                                               */
/* ------------------------------------------------------------------ */

/** Remove pontuação de CNPJ; preserva letras (formato alfanumérico de 2026). */
export function normalizeCnpjInput(raw: string): string {
  return raw.toUpperCase().replace(/[.\-/\s]/g, "");
}

/** Heurística: o usuário está tentando digitar um CNPJ (e não um nome)? */
export function looksLikeCnpj(raw: string): boolean {
  const stripped = normalizeCnpjInput(raw);
  if (stripped.length === 0) return false;
  const digits = stripped.replace(/[^0-9]/g, "");
  // Nomes têm espaços/letras predominantes; CNPJ digitado é quase só dígito.
  return digits.length >= 8 && digits.length / stripped.length > 0.7;
}

/**
 * Valida os dígitos verificadores de um CNPJ de 14 posições.
 * Compatível com o formato alfanumérico (valor = código ASCII − 48 nas 12
 * primeiras posições; os 2 verificadores são sempre numéricos).
 * Retorna apenas sobre a ESTRUTURA — nada sobre legitimidade.
 */
export function isValidCnpj(raw: string): boolean {
  const cnpj = normalizeCnpjInput(raw);
  if (!/^[A-Z0-9]{12}[0-9]{2}$/.test(cnpj)) return false;
  if (/^([A-Z0-9])\1{13}$/.test(cnpj)) return false;
  const values = [...cnpj].map((ch) => ch.charCodeAt(0) - 48);
  const dv = (slice: number[], weights: number[]): number => {
    const sum = slice.reduce((acc, v, i) => acc + v * weights[i]!, 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const dv1 = dv(values.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  if (dv1 !== values[12]) return false;
  const dv2 = dv(values.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return dv2 === values[13];
}

/** "12345678000190" → "12.345.678/0001-90" (14 posições; senão, retorna cru). */
export function formatCnpj(digits: string): string {
  if (!/^[A-Z0-9]{14}$/.test(digits)) return digits;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

/* ------------------------------------------------------------------ */
/* Nome                                                               */
/* ------------------------------------------------------------------ */

/** Normaliza para comparação: minúsculas, sem acento, sem pontuação. */
export function normalizeName(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\bs\s+a\b/g, "sa")
    .replace(/\s+/g, " ")
    .trim();
}

/** Sufixos societários ignorados na comparação de igualdade. */
const CORPORATE_SUFFIXES = new Set(["sa", "ltda", "cia", "me", "epp", "eireli"]);

function coreTokens(normalized: string): string[] {
  return normalized.split(" ").filter((t) => t.length > 0 && !CORPORATE_SUFFIXES.has(t));
}

/* ------------------------------------------------------------------ */
/* Busca                                                              */
/* ------------------------------------------------------------------ */

const MAX_RESULTS = 20;

interface IndexedRecord {
  record: InstitutionRecord;
  normName: string;
  normShort: string;
  tokens: string[];
}

/** Pré-indexa os registros (uma vez por snapshot). */
export function buildSearchIndex(records: InstitutionRecord[]): IndexedRecord[] {
  return records.map((record) => {
    const normName = normalizeName(record.name);
    const normShort = record.shortName ? normalizeName(record.shortName) : "";
    return {
      record,
      normName,
      normShort,
      tokens: [...new Set([...coreTokens(normName), ...coreTokens(normShort)])],
    };
  });
}

function searchByCnpj(index: IndexedRecord[], query: string): InstitutionMatch[] {
  const cnpj = normalizeCnpjInput(query);
  const matches: InstitutionMatch[] = [];
  for (const entry of index) {
    const digits = entry.record.cnpjDigits;
    if (!digits) continue;
    if (digits === cnpj) {
      matches.push({ record: entry.record, quality: "exact", score: 100 });
    } else if (digits.length === 8 && cnpj.startsWith(digits)) {
      // Base fornece só a raiz do CNPJ: correspondência de raiz é "forte",
      // nunca "exata" — o usuário confere a razão social.
      matches.push({ record: entry.record, quality: "strong", score: 80 });
    }
  }
  return matches.sort((a, b) => b.score - a.score).slice(0, MAX_RESULTS);
}

function scoreByName(entry: IndexedRecord, queryNorm: string, queryTokens: string[]): InstitutionMatch | null {
  const { record, normName, normShort, tokens } = entry;
  if (queryTokens.length === 0) return null;

  if (normName === queryNorm) {
    return { record, quality: "exact", score: 100 };
  }
  const qCore = queryTokens.join(" ");
  const nameCore = coreTokens(normName).join(" ");
  if (nameCore === qCore) {
    return { record, quality: "exact", score: 95 };
  }
  // Nome reduzido/fantasia idêntico é forte, mas não prova identidade:
  // marcas parecidas existem — a razão social é que decide.
  if (normShort.length > 0 && (normShort === queryNorm || coreTokens(normShort).join(" ") === qCore)) {
    return { record, quality: "strong", score: 90 };
  }

  // Todos os tokens da consulta presentes como prefixo de algum token do nome.
  const hits = queryTokens.filter((qt) => tokens.some((t) => t.startsWith(qt)));
  const coverage = hits.length / queryTokens.length;
  if (coverage === 1) {
    const starts = normName.startsWith(qCore) || normShort.startsWith(qCore);
    return {
      record,
      quality: "strong",
      score: (starts ? 75 : 60) + Math.max(0, 10 - Math.abs(tokens.length - queryTokens.length)),
    };
  }
  if (coverage >= 0.5 && hits.some((h) => h.length >= 4)) {
    return { record, quality: "related", score: 30 + coverage * 20 };
  }
  return null;
}

function searchByName(index: IndexedRecord[], query: string): InstitutionMatch[] {
  const queryNorm = normalizeName(query);
  const queryTokens = coreTokens(queryNorm);
  const matches: InstitutionMatch[] = [];
  for (const entry of index) {
    const match = scoreByName(entry, queryNorm, queryTokens);
    if (match) matches.push(match);
  }
  return matches
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.record.name.length - b.record.name.length ||
        a.record.name.localeCompare(b.record.name, "pt-BR"),
    )
    .slice(0, MAX_RESULTS);
}

/**
 * Busca principal. Consulta que parece CNPJ é tratada como CNPJ (menos
 * ambíguo); o restante entra na busca por nome.
 */
export function searchInstitutions(index: IndexedRecord[], query: string): SearchOutcome {
  const trimmed = query.trim().slice(0, 120);
  if (looksLikeCnpj(trimmed)) {
    return { mode: "cnpj", matches: searchByCnpj(index, trimmed) };
  }
  return { mode: "name", matches: searchByName(index, trimmed) };
}
