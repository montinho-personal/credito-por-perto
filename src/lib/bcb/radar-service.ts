/**
 * Serviço de dados do Radar de Taxas de Crédito.
 *
 * Reusa o MESMO registro central de séries SGS da ferramenta "Minha taxa
 * está cara?" (src/lib/bcb/series-registry.ts) — códigos verificados na
 * fonte, todos da mesma família metodológica (taxa média mensal, recursos
 * livres, PF, ponderada pelas concessões, % a.m.).
 *
 * Diferenças em relação ao rates-service:
 * - Busca até 61 pontos (5 anos + margem) para histórico e gráfico.
 * - Guarda de anomalia EXTREMA: se o último valor divergir do anterior por
 *   fator > 5 (ex.: 4% → 0,00001%), a série é RETIDA para revisão (log) e
 *   não publicada automaticamente — o valor nunca é manipulado.
 * - Uma consulta por série por revalidação (diária, via cache do Next) —
 *   nunca uma chamada ao BC por pageview. Se a revalidação falhar, o Next
 *   mantém o último dado válido em cache (stale-while-revalidate); sem
 *   nenhum dado válido, a página entra em modo indisponível honesto.
 */

import { BCB_SERIES_REGISTRY, type BcbSeries } from "./series-registry";
import {
  parseSgsRow,
  type RatePoint,
} from "./rates-service";
import { computeRadarStats, type RadarStats } from "./radar-insights";

export interface RadarSeries {
  internalId: string;
  displayName: string;
  officialName: string;
  monthlySeries: number;
  unit: "% a.m.";
  methodology: string;
  sourceUrl: string;
  relatedGuidePath?: string;
  /** Histórico crescente (até 61 meses) */
  history: RatePoint[];
  stats: RadarStats;
  fetchedAt: string;
}

export interface RadarResult {
  series: RadarSeries[];
  failed: string[];
  fetchedAt: string;
}

const SGS_BASE =
  process.env.VERCEL_ENV === "production"
    ? "https://api.bcb.gov.br/dados/serie"
    : (process.env.BCB_SGS_BASE_URL ?? "https://api.bcb.gov.br/dados/serie");
/** 61 pontos = 5 anos de histórico + margem para mês ainda não fechado */
const POINTS = 61;
const REVALIDATE_SECONDS = 60 * 60 * 24;

/** Fator de anomalia extrema (não substituir dado bom por dado corrompido). */
const EXTREME_ANOMALY_FACTOR = 5;

/**
 * Valida o payload completo para o Radar. Exportada para teste.
 * Regras: linhas parseáveis, último valor dentro da faixa de sanidade da
 * série e SEM anomalia extrema em relação ao penúltimo.
 */
export function validateRadarPayload(
  series: BcbSeries,
  rows: unknown,
): RatePoint[] | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const points = rows
    .map((r) => parseSgsRow(r as { data: string; valor: string }))
    .filter((p): p is RatePoint => p !== null);
  if (points.length === 0) return null;
  const latest = points[points.length - 1]!;
  if (latest.value < series.sanity.min || latest.value > series.sanity.max) return null;
  const previous = points.length >= 2 ? points[points.length - 2]! : null;
  if (previous && previous.value > 0) {
    const ratio = latest.value / previous.value;
    if (ratio > EXTREME_ANOMALY_FACTOR || ratio < 1 / EXTREME_ANOMALY_FACTOR) {
      // Anomalia extrema: sinalizar para revisão, não publicar automaticamente.
      return null;
    }
  }
  return points;
}

async function fetchRadarSeries(series: BcbSeries): Promise<RadarSeries | null> {
  const url = `${SGS_BASE}/bcdata.sgs.${series.monthlySeries}/dados/ultimos/${POINTS}?formato=json`;
  try {
    const response = await fetch(url, {
      next: { revalidate: REVALIDATE_SECONDS },
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      console.warn(`[radar] série ${series.monthlySeries} (${series.internalId}): HTTP ${response.status}`);
      return null;
    }
    const rows = (await response.json()) as unknown;
    const points = validateRadarPayload(series, rows);
    if (!points) {
      console.warn(
        `[radar] série ${series.monthlySeries} (${series.internalId}): payload inválido, fora da sanidade ou com anomalia extrema — retida para revisão`,
      );
      return null;
    }
    const stats = computeRadarStats(points);
    if (!stats) return null;
    return {
      internalId: series.internalId,
      displayName: series.displayName,
      officialName: series.officialName,
      monthlySeries: series.monthlySeries,
      unit: series.unit,
      methodology: series.methodology,
      sourceUrl: series.sourceUrl,
      relatedGuidePath: series.relatedGuidePath,
      history: points,
      stats,
      fetchedAt: new Date().toISOString().slice(0, 10),
    };
  } catch (error) {
    console.warn(
      `[radar] série ${series.monthlySeries} (${series.internalId}): ${error instanceof Error ? error.message : "erro de rede"}`,
    );
    return null;
  }
}

/** Busca todas as séries do registro para o Radar. Nunca lança. */
export async function getRadarData(): Promise<RadarResult> {
  const settled = await Promise.allSettled(
    BCB_SERIES_REGISTRY.map((series) => fetchRadarSeries(series)),
  );
  const series: RadarSeries[] = [];
  const failed: string[] = [];
  settled.forEach((result, index) => {
    const id = BCB_SERIES_REGISTRY[index]!.internalId;
    if (result.status === "fulfilled" && result.value) series.push(result.value);
    else failed.push(id);
  });
  if (failed.length > 0) {
    console.warn(`[radar] séries indisponíveis nesta revalidação: ${failed.join(", ")}`);
  }
  return { series, failed, fetchedAt: new Date().toISOString().slice(0, 10) };
}
