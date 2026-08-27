/**
 * Serviço de dados oficiais do Banco Central para a consulta
 * "Essa instituição aparece no Banco Central?".
 *
 * Fonte (única na V1):
 *   Relação de Instituições em Funcionamento no País — serviço Olinda
 *   `Instituicoes_em_funcionamento/versao/v1` (dados abertos do BC), nos
 *   4 recursos: bancos comerciais/múltiplos/Caixa, sociedades (financeiras,
 *   SCD, SEP, corretoras etc.), cooperativas de crédito e administradoras
 *   de consórcio.
 *
 * Estratégia:
 * - Fetch SEMPRE no servidor com cache do Next (revalidação diária) — a base
 *   cadastral não muda a cada minuto e o navegador do visitante nunca fala
 *   com o BC nem recebe a base inteira.
 * - Mapeamento de campos TOLERANTE a variação de nomenclatura, mas com
 *   validação de sanidade: quantidade mínima de registros por recurso e no
 *   total, e proporção mínima de registros com nome + CNPJ. Payload que não
 *   passa é descartado com log — nunca publicado como se fosse atualização.
 * - Recurso indisponível ⇒ resultado "parcial" (a interface avisa e o
 *   "não encontrado" vira "não conseguimos consultar toda a base").
 *   Todos indisponíveis ⇒ estado "unavailable" — NUNCA "não encontrado".
 * - Snapshot indexado é memoizado em módulo (por instância) com TTL; o
 *   cache de dados do Next segura a rede entre instâncias.
 */

import {
  buildSearchIndex,
  type InstitutionRecord,
} from "@/lib/institutions/search";

/** Base oficial; sobrescrevível em teste/desenvolvimento (nunca em produção). */
const OLINDA_BASE =
  process.env.VERCEL_ENV === "production"
    ? "https://olinda.bcb.gov.br/olinda/servico/Instituicoes_em_funcionamento/versao/v1/odata"
    : (process.env.BCB_INSTITUTIONS_BASE_URL ??
      "https://olinda.bcb.gov.br/olinda/servico/Instituicoes_em_funcionamento/versao/v1/odata");

const REVALIDATE_SECONDS = 60 * 60 * 24; // diário — base cadastral
const MEMO_TTL_MS = 60 * 60 * 1000; // reindexação em memória: 1h por instância

/** Recursos da base, com rótulo exibido e piso de sanidade por recurso. */
export const INSTITUTION_SOURCES = [
  {
    resource: "SedesBancoComMultCE",
    label: "Bancos comerciais, múltiplos e Caixa Econômica",
    minRecords: 50,
  },
  {
    resource: "SedesSociedades",
    label: "Sociedades: financeiras (SCFI), SCD, SEP, corretoras e outras",
    minRecords: 100,
  },
  {
    resource: "SedesCooperativas",
    label: "Cooperativas de crédito",
    minRecords: 100,
  },
  {
    resource: "SedesConsorcios",
    label: "Administradoras de consórcio",
    minRecords: 30,
  },
] as const;

/** Piso global: menos que isso indica base corrompida/incompleta. */
const MIN_TOTAL_RECORDS = 400;

export const INSTITUTIONS_DATASET_URL =
  "https://dadosabertos.bcb.gov.br/dataset/relacao-de-instituicoes-em-funcionamento-no-pais";
export const BCB_FIND_INSTITUTION_URL =
  "https://www.bcb.gov.br/meubc/encontreinstituicao";

export interface InstitutionsSnapshot {
  index: ReturnType<typeof buildSearchIndex>;
  totalRecords: number;
  /** Rótulos dos recursos que falharam nesta sincronização */
  failedSources: string[];
  /** true se pelo menos um recurso falhou (busca cobre só parte da base) */
  partial: boolean;
  /** ISO date da obtenção */
  fetchedAt: string;
}

export type InstitutionsResult =
  | { status: "ok"; snapshot: InstitutionsSnapshot }
  | { status: "unavailable" };

/* ------------------------------------------------------------------ */
/* Mapeamento tolerante de campos                                     */
/* ------------------------------------------------------------------ */

function normalizeKey(key: string): string {
  return key
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
}

const FIELD_CANDIDATES = {
  cnpj: ["CNPJ", "NRCNPJ", "CNPJINSTITUICAO", "NUMEROCNPJ", "CODIGOCNPJ", "CNPJ8", "CNPJRAIZ"],
  name: ["NOMEINSTITUICAO", "NOMEENTIDADEINTERESSE", "RAZAOSOCIAL", "NOMERAZAOSOCIAL", "NOMEENTIDADE", "NOME", "INSTITUICAO"],
  shortName: ["NOMEREDUZIDO", "NOMEFANTASIA", "SIGLA"],
  type: ["SEGMENTO", "TIPOINSTITUICAO", "TIPO", "CATEGORIA", "TIPOENTIDADE"],
  uf: ["UF", "SGUF", "UNIDADEFEDERACAO"],
  municipio: ["MUNICIPIO", "NOMEMUNICIPIO", "CIDADE"],
  situacao: ["SITUACAO", "SITUACAOINSTITUICAO", "STATUS"],
} as const;

function pickField(
  normalized: Record<string, unknown>,
  candidates: readonly string[],
): string | null {
  for (const candidate of candidates) {
    const value = normalized[candidate];
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text.length > 0) return text;
  }
  return null;
}

/**
 * Converte um registro cru da API em InstitutionRecord.
 * Exportada para teste. Retorna null quando faltam campos essenciais.
 */
export function parseInstitutionRow(
  row: unknown,
  sourceLabel: string,
  rowIndex: number,
): InstitutionRecord | null {
  if (typeof row !== "object" || row === null) return null;
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
    normalized[normalizeKey(key)] = value;
  }
  const name = pickField(normalized, FIELD_CANDIDATES.name);
  if (!name || name.length < 2) return null;

  const cnpjRaw = pickField(normalized, FIELD_CANDIDATES.cnpj);
  let cnpjDigits: string | null = null;
  if (cnpjRaw) {
    const stripped = cnpjRaw.toUpperCase().replace(/[.\-/\s]/g, "");
    if (/^[A-Z0-9]{14}$/.test(stripped)) cnpjDigits = stripped;
    else if (/^[0-9]{1,8}$/.test(stripped)) cnpjDigits = stripped.padStart(8, "0");
  }

  return {
    id: `${sourceLabel}#${rowIndex}`,
    name,
    shortName: pickField(normalized, FIELD_CANDIDATES.shortName) ?? undefined,
    cnpjDigits,
    type: pickField(normalized, FIELD_CANDIDATES.type),
    uf: pickField(normalized, FIELD_CANDIDATES.uf),
    municipio: pickField(normalized, FIELD_CANDIDATES.municipio),
    situacao: pickField(normalized, FIELD_CANDIDATES.situacao),
    sourceLabel,
  };
}

/**
 * Valida o payload de um recurso. Exportada para teste.
 * Regras: array com piso mínimo de linhas; ≥70% das linhas parseáveis com
 * nome; ≥50% com CNPJ identificável. Fora disso ⇒ null (schema drift ou
 * dado corrompido — não publicar).
 */
export function validateResourcePayload(
  rows: unknown,
  sourceLabel: string,
  minRecords: number,
): InstitutionRecord[] | null {
  if (!Array.isArray(rows) || rows.length < minRecords) return null;
  const parsed = rows
    .map((row, i) => parseInstitutionRow(row, sourceLabel, i))
    .filter((r): r is InstitutionRecord => r !== null);
  if (parsed.length < minRecords) return null;
  if (parsed.length / rows.length < 0.7) return null;
  const withCnpj = parsed.filter((r) => r.cnpjDigits !== null).length;
  if (withCnpj / parsed.length < 0.5) return null;
  return parsed;
}

/* ------------------------------------------------------------------ */
/* Ingestão                                                           */
/* ------------------------------------------------------------------ */

async function fetchResource(
  source: (typeof INSTITUTION_SOURCES)[number],
): Promise<InstitutionRecord[] | null> {
  const url = `${OLINDA_BASE}/${source.resource}?%24format=json&%24top=20000`;
  try {
    const response = await fetch(url, {
      next: { revalidate: REVALIDATE_SECONDS },
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      console.warn(`[bcb-institutions] ${source.resource}: HTTP ${response.status}`);
      return null;
    }
    const payload = (await response.json()) as { value?: unknown };
    const rows = payload && typeof payload === "object" ? payload.value : null;
    const records = validateResourcePayload(rows, source.label, source.minRecords);
    if (!records) {
      console.warn(
        `[bcb-institutions] ${source.resource}: payload inválido, incompleto ou com schema alterado — descartado`,
      );
      return null;
    }
    return records;
  } catch (error) {
    console.warn(
      `[bcb-institutions] ${source.resource}: ${error instanceof Error ? error.message : "erro de rede"}`,
    );
    return null;
  }
}

let memo: { at: number; result: InstitutionsResult } | null = null;

/** Carrega e indexa a base. Nunca lança. */
export async function getInstitutions(): Promise<InstitutionsResult> {
  if (memo && Date.now() - memo.at < MEMO_TTL_MS && memo.result.status === "ok") {
    return memo.result;
  }
  const settled = await Promise.all(INSTITUTION_SOURCES.map((s) => fetchResource(s)));
  const records: InstitutionRecord[] = [];
  const failedSources: string[] = [];
  settled.forEach((result, i) => {
    if (result) records.push(...result);
    else failedSources.push(INSTITUTION_SOURCES[i]!.label);
  });

  if (records.length < MIN_TOTAL_RECORDS) {
    console.warn(
      `[bcb-institutions] total de ${records.length} registros abaixo do piso de sanidade (${MIN_TOTAL_RECORDS}) — base indisponível`,
    );
    const result: InstitutionsResult = { status: "unavailable" };
    // Não memoizar indisponibilidade por 1h: a próxima consulta tenta de novo.
    return result;
  }

  const result: InstitutionsResult = {
    status: "ok",
    snapshot: {
      index: buildSearchIndex(records),
      totalRecords: records.length,
      failedSources,
      partial: failedSources.length > 0,
      fetchedAt: new Date().toISOString().slice(0, 10),
    },
  };
  memo = { at: Date.now(), result };
  return result;
}

/** Somente para testes: limpa a memoização em módulo. */
export function __resetInstitutionsMemo(): void {
  memo = null;
}
