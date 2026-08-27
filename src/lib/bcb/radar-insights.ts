/**
 * Estatísticas e frases determinísticas do Radar de Taxas de Crédito.
 *
 * Regras:
 * - Todo cálculo parte dos valores brutos da série; arredondamento só na
 *   apresentação.
 * - Diferenças sempre em PONTOS PERCENTUAIS ("p.p."), nunca "+0,2%".
 * - "12 meses atrás" exige o mês EXATO na série — buraco na série não é
 *   preenchido por interpolação; sem o ponto, a comparação simplesmente
 *   não aparece.
 * - Movimento é o do ÚLTIMO dado (subiu/caiu/não mudou, comparação bruta).
 *   Nunca "tendência": um movimento não define tendência.
 * - As frases são templates factuais — nenhuma causa macroeconômica é
 *   inventada por código.
 */

import type { RatePoint } from "./rates-service";
import { formatRefMonth } from "./rates-service";

export type Movement = "up" | "down" | "same";

export interface RadarStats {
  latest: RatePoint;
  previous: RatePoint | null;
  /** latest − previous, em p.p. (bruto) */
  diffPrevPP: number | null;
  movement: Movement | null;
  /** Ponto de exatamente 12 meses antes do último dado (mês exato) */
  ago12: RatePoint | null;
  /** latest − ago12, em p.p. (bruto) */
  diff12PP: number | null;
}

/** "2026-07" − n meses → "2025-07" */
export function monthsBack(refMonth: string, n: number): string {
  const [y, m] = refMonth.split("-").map(Number);
  const total = y! * 12 + (m! - 1) - n;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** history em ordem crescente de mês; retorna null se vazia. */
export function computeRadarStats(history: RatePoint[]): RadarStats | null {
  if (history.length === 0) return null;
  const latest = history[history.length - 1]!;
  const previous = history.length >= 2 ? history[history.length - 2]! : null;
  const target12 = monthsBack(latest.refMonth, 12);
  const ago12 = history.find((p) => p.refMonth === target12) ?? null;

  const diffPrevPP = previous ? latest.value - previous.value : null;
  const movement: Movement | null =
    diffPrevPP === null ? null : diffPrevPP > 0 ? "up" : diffPrevPP < 0 ? "down" : "same";

  return {
    latest,
    previous,
    diffPrevPP,
    movement,
    ago12,
    diff12PP: ago12 ? latest.value - ago12.value : null,
  };
}

/* ------------------------------------------------------------------ */
/* Formatação                                                          */
/* ------------------------------------------------------------------ */

export function formatRate(value: number): string {
  return `${value.toFixed(2).replace(".", ",")}%`;
}

/** Diferença em p.p. com sinal: "+0,13" / "−0,34" / "0,00" */
export function formatPP(diff: number): string {
  const abs = Math.abs(diff).toFixed(2).replace(".", ",");
  if (Math.abs(diff) < 0.005) return "0,00";
  return `${diff > 0 ? "+" : "−"}${abs}`;
}

export const MOVEMENT_LABEL: Record<Movement, string> = {
  up: "Subiu",
  down: "Caiu",
  same: "Não mudou",
};

export const MOVEMENT_ARROW: Record<Movement, string> = {
  up: "↑",
  down: "↓",
  same: "→",
};

/* ------------------------------------------------------------------ */
/* Frases determinísticas (sem causa, sem tendência)                   */
/* ------------------------------------------------------------------ */

export function buildMovementSentence(stats: RadarStats): string {
  const { latest, previous, diffPrevPP } = stats;
  if (!previous || diffPrevPP === null) {
    return `Último dado disponível: ${formatRate(latest.value)} ao mês, referente a ${formatRefMonth(latest.refMonth)}.`;
  }
  if (stats.movement === "same") {
    return `A taxa média não mudou em relação ao mês anterior: ${formatRate(latest.value)} ao mês no dado de ${formatRefMonth(latest.refMonth)}.`;
  }
  const direction = stats.movement === "up" ? "alta" : "queda";
  return `A taxa média passou de ${formatRate(previous.value)} para ${formatRate(latest.value)} ao mês no dado de ${formatRefMonth(latest.refMonth)} — ${direction} de ${Math.abs(diffPrevPP).toFixed(2).replace(".", ",")} ponto percentual.`;
}

export function buildYearSentence(stats: RadarStats): string | null {
  if (!stats.ago12 || stats.diff12PP === null) return null;
  return `Há 12 meses (${formatRefMonth(stats.ago12.refMonth)}), a taxa era de ${formatRate(stats.ago12.value)} ao mês — diferença de ${formatPP(stats.diff12PP)} p.p.`;
}
