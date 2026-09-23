/**
 * Taxa média do Banco Central para FINANCIAMENTO IMOBILIÁRIO — referência
 * do simulador de financiamento imobiliário.
 *
 * POR QUE FORA DO `series-registry`
 *
 * O registro reúne séries de crédito com recursos LIVRES, em % a.m., usadas
 * lado a lado pelo Radar e pelo "Minha taxa está cara?". Financiamento
 * imobiliário é crédito com recursos DIRECIONADOS, outra família
 * metodológica — misturar as duas no mesmo registro colocaria a série nas
 * comparações erradas. Por isso ela mora aqui, isolada, e só esta página a
 * usa.
 *
 * A SÉRIE
 *
 * SGS 20772 — "Taxa média de juros das operações de crédito com recursos
 * direcionados - Pessoas físicas - Financiamento imobiliário com taxas de
 * mercado". Nome e código conferidos no título do conjunto no Portal de
 * Dados Abertos do BC. Unidade % a.a. confirmada em 23/09/2026: a página
 * publicada mostrou 14,28% para julho de 2026, e o valor foi conferido no
 * portal do BC. A FAIXA DE SANIDADE continua como trava contra mudança
 * de formato: um valor fora de 4%–25% ao ano (por exemplo, a mesma taxa
 * expressa ao mês, perto de 1) é recusado, e a página usa a taxa
 * ilustrativa, dizendo que é ilustrativa. Número sem fonte nunca aparece
 * como dado oficial.
 *
 * Mesma estratégia do restante do site: busca no servidor, revalidação
 * diária, dado sempre com mês de referência.
 */

import { fetchSgsRows, formatRefMonth } from "./rates-service";

export const HOUSING_SERIES = 20772;
export const HOUSING_SERIES_URL =
  "https://dadosabertos.bcb.gov.br/dataset/20772-taxa-media-de-juros-das-operacoes-de-credito-com-recursos-direcionados---pessoas-fisicas---fi";
export const HOUSING_SANITY = { min: 4, max: 25 } as const;
/** Dado com mais de 6 meses de defasagem é tratado como indisponível. */
const MAX_AGE_MONTHS = 6;

export interface HousingRateReference {
  /** Taxa média, em % ao ano. */
  annualRatePercent: number;
  /** "YYYY-MM" */
  refMonth: string;
  /** "julho de 2026" */
  refMonthLabel: string;
  seriesCode: number;
  sourceUrl: string;
}

interface SgsRow {
  data?: string;
  valor?: string;
}

/** Valida o payload do SGS. Exportada para teste. */
export function parseHousingRows(rows: unknown, now: Date = new Date()): HousingRateReference | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const last = rows[rows.length - 1] as SgsRow;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(last?.data ?? "");
  if (!match) return null;
  const value = Number(String(last.valor ?? "").replace(",", "."));
  if (!Number.isFinite(value) || value < HOUSING_SANITY.min || value > HOUSING_SANITY.max) return null;
  const year = Number(match[3]);
  const month = Number(match[2]);
  const age = (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - month);
  if (age < 0 || age > MAX_AGE_MONTHS) return null;
  const refMonth = `${match[3]}-${match[2]}`;
  return {
    annualRatePercent: value,
    refMonth,
    refMonthLabel: formatRefMonth(refMonth),
    seriesCode: HOUSING_SERIES,
    sourceUrl: HOUSING_SERIES_URL,
  };
}

/** Nunca lança: sem dado válido, devolve null e a página usa a taxa ilustrativa. */
export async function getHousingRate(): Promise<HousingRateReference | null> {
  try {
    const rows = await fetchSgsRows(HOUSING_SERIES, 3, 8);
    const parsed = rows === null ? null : parseHousingRows(rows);
    if (!parsed) console.warn(`[housing-rate] série ${HOUSING_SERIES}: indisponível ou fora da faixa de sanidade`);
    return parsed;
  } catch (error) {
    console.warn(`[housing-rate] ${error instanceof Error ? error.message : "erro"}`);
    return null;
  }
}
