/**
 * Serviço de dados oficiais do Banco Central (SGS) para a ferramenta
 * "Minha taxa está cara?".
 *
 * Estratégia de dados:
 * - A busca acontece SEMPRE no servidor (build/ISR na Vercel), nunca no
 *   navegador do visitante — um fetch por série a cada revalidação, não
 *   um por visita.
 * - `fetch` usa o cache do Next com revalidação diária (as séries são
 *   mensais; buscar mais que isso seria desperdício).
 * - Se a API estiver indisponível na revalidação, o Next mantém a última
 *   versão renderizada com dados válidos (stale-while-revalidate). Se nunca
 *   houve dado (ex.: build em ambiente sem acesso ao BC), a página entra em
 *   modo "dados indisponíveis" — a ferramenta nunca quebra e nunca mostra
 *   número sem fonte.
 * - Todo dado carrega o período de referência (mês/ano) e a data de
 *   obtenção; valor sem data nunca é usado.
 * - Validação: número finito, dentro da faixa de sanidade da série e com
 *   data plausível. Payload vazio, zerado ou fora do formato é rejeitado
 *   com log (console.warn) — sem publicar silenciosamente.
 */

import { BCB_SERIES_REGISTRY, type BcbSeries } from "./series-registry";

/** Um ponto da série: mês de referência + taxa em % a.m. */
export interface RatePoint {
  /** "YYYY-MM" do mês de referência */
  refMonth: string;
  /** Taxa média em % a.m. */
  value: number;
}

export interface SeriesData {
  internalId: string;
  displayName: string;
  officialName: string;
  monthlySeries: number;
  unit: "% a.m.";
  sourceUrl: string;
  methodology: string;
  relatedGuidePath?: string;
  /** Último valor disponível */
  latest: RatePoint;
  /** Histórico (até 13 meses, mais antigo primeiro, incluindo o último) */
  history: RatePoint[];
  /** Data em que o dado foi obtido da API (ISO date) */
  fetchedAt: string;
}

export interface BcbRatesResult {
  series: SeriesData[];
  /** ids que falharam na busca/validação nesta revalidação */
  failed: string[];
  fetchedAt: string;
}

/** Base oficial; sobrescrevível em teste/desenvolvimento (nunca em produção). */
const SGS_BASE =
  process.env.VERCEL_ENV === "production"
    ? "https://api.bcb.gov.br/dados/serie"
    : (process.env.BCB_SGS_BASE_URL ?? "https://api.bcb.gov.br/dados/serie");
/** 14 pontos: 12 meses de histórico + margem para meses ainda não fechados */
const POINTS = 14;
const REVALIDATE_SECONDS = 60 * 60 * 24; // diário — série é mensal

interface SgsRow {
  data: string; // "dd/MM/yyyy"
  valor: string; // "6,32"
}

function parseSgsRow(row: SgsRow): RatePoint | null {
  const dateMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(row.data ?? "");
  if (!dateMatch) return null;
  const [, , month, year] = dateMatch;
  const value = Number(String(row.valor).replace(",", "."));
  if (!Number.isFinite(value)) return null;
  const y = Number(year);
  if (y < 2011 || y > 2100) return null;
  return { refMonth: `${year}-${month}`, value };
}

function validateSeriesPayload(
  series: BcbSeries,
  rows: unknown,
): RatePoint[] | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const points = rows
    .map((r) => parseSgsRow(r as SgsRow))
    .filter((p): p is RatePoint => p !== null);
  if (points.length === 0) return null;
  const latest = points[points.length - 1]!;
  // Faixa de sanidade: taxa zerada ou absurda indica série errada/quebrada.
  if (latest.value < series.sanity.min || latest.value > series.sanity.max) {
    return null;
  }
  return points;
}

async function fetchSeries(series: BcbSeries): Promise<SeriesData | null> {
  const url = `${SGS_BASE}/bcdata.sgs.${series.monthlySeries}/dados/ultimos/${POINTS}?formato=json`;
  try {
    const response = await fetch(url, {
      next: { revalidate: REVALIDATE_SECONDS },
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      console.warn(
        `[bcb-rates] série ${series.monthlySeries} (${series.internalId}): HTTP ${response.status}`,
      );
      return null;
    }
    const rows = (await response.json()) as unknown;
    const points = validateSeriesPayload(series, rows);
    if (!points) {
      console.warn(
        `[bcb-rates] série ${series.monthlySeries} (${series.internalId}): payload inválido ou fora da faixa de sanidade`,
      );
      return null;
    }
    return {
      internalId: series.internalId,
      displayName: series.displayName,
      officialName: series.officialName,
      monthlySeries: series.monthlySeries,
      unit: series.unit,
      sourceUrl: series.sourceUrl,
      methodology: series.methodology,
      relatedGuidePath: series.relatedGuidePath,
      latest: points[points.length - 1]!,
      history: points.slice(-13),
      fetchedAt: new Date().toISOString().slice(0, 10),
    };
  } catch (error) {
    console.warn(
      `[bcb-rates] série ${series.monthlySeries} (${series.internalId}): ${error instanceof Error ? error.message : "erro de rede"}`,
    );
    return null;
  }
}

/**
 * Busca todas as séries do registro. Nunca lança: séries que falham entram
 * em `failed` e a ferramenta segue com as demais (ou entra em modo
 * indisponível se todas falharem).
 */
export async function getBcbRates(): Promise<BcbRatesResult> {
  const settled = await Promise.allSettled(
    BCB_SERIES_REGISTRY.map((series) => fetchSeries(series)),
  );
  const series: SeriesData[] = [];
  const failed: string[] = [];
  settled.forEach((result, index) => {
    const id = BCB_SERIES_REGISTRY[index]!.internalId;
    if (result.status === "fulfilled" && result.value) series.push(result.value);
    else failed.push(id);
  });
  if (failed.length > 0) {
    console.warn(`[bcb-rates] séries indisponíveis nesta revalidação: ${failed.join(", ")}`);
  }
  return { series, failed, fetchedAt: new Date().toISOString().slice(0, 10) };
}

/** "2026-07" → "julho de 2026" */
export function formatRefMonth(refMonth: string): string {
  const [year, month] = refMonth.split("-");
  const names = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
  ];
  const name = names[Number(month) - 1] ?? refMonth;
  return `${name} de ${year}`;
}

export { validateSeriesPayload, parseSgsRow };
