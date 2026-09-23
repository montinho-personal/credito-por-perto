/**
 * Datas civis (AAAA-MM-DD), sem fuso: toda conta é feita em UTC à meia-noite,
 * então 01/10 nunca vira 30/09 por causa do horário do aparelho.
 */

const DAY_MS = 86_400_000;

export const fromIso = (s: string) => new Date(`${s}T00:00:00Z`);
export const toIso = (d: Date) => d.toISOString().slice(0, 10);

/** Data ISO (AAAA-MM-DD) válida? */
export function isIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = fromIso(s);
  return !Number.isNaN(d.getTime()) && toIso(d) === s;
}

/** Dias corridos entre duas datas ISO. */
export function daysBetween(fromIsoDate: string, toIsoDate: string): number {
  return Math.round((fromIso(toIsoDate).getTime() - fromIso(fromIsoDate).getTime()) / DAY_MS);
}

/** Soma dias corridos a uma data ISO. */
export function addDays(isoDate: string, days: number): string {
  return toIso(new Date(fromIso(isoDate).getTime() + days * DAY_MS));
}

/** Soma meses mantendo o dia; se o mês não tiver o dia, usa o último (31/01 + 1 mês = 28/02). */
export function addMonths(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split("-").map(Number) as [number, number, number];
  const total = m - 1 + months;
  const year = y + Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return toIso(new Date(Date.UTC(year, month, Math.min(d, last))));
}

/** AAAA-MM-DD → DD/MM/AAAA. */
export function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Hoje, no fuso de Brasília, em AAAA-MM-DD. */
export function todayInBrazil(now: Date = new Date()): string {
  // en-CA formata como AAAA-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
