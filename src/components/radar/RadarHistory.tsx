"use client";

import Link from "next/link";
import { useState } from "react";
import type { RatePoint } from "@/lib/bcb/rates-service";

/* Eventos de uso — navegação pública; nenhum dado pessoal. */
interface GtagWindow extends Window {
  gtag?: (...args: unknown[]) => void;
}
function gtag(...args: unknown[]) {
  const w = window as GtagWindow;
  if (typeof w.gtag === "function") w.gtag(...args);
}

const MONTH_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function shortMonth(refMonth: string): string {
  const [year, month] = refMonth.split("-");
  return `${MONTH_SHORT[Number(month) - 1]}/${year!.slice(2)}`;
}

function fmt(value: number): string {
  return `${value.toFixed(2).replace(".", ",")}%`;
}

const RANGES = [
  { months: 12, label: "12 meses" },
  { months: 24, label: "24 meses" },
  { months: 60, label: "5 anos" },
] as const;

export function RadarHistory({
  internalId,
  displayName,
  history,
}: {
  internalId: string;
  displayName: string;
  history: RatePoint[];
}) {
  const [range, setRange] = useState<number>(12);
  const visible = history.slice(-range);

  const values = visible.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max((max - min) * 0.15, 0.05);
  const lo = min - pad;
  const hi = max + pad;
  const W = 640;
  const H = 200;
  const x = (i: number) => (visible.length === 1 ? W / 2 : (i / (visible.length - 1)) * (W - 20) + 10);
  const y = (v: number) => H - 12 - ((v - lo) / (hi - lo)) * (H - 24);
  const polyline = visible.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");

  const first = visible[0];
  const last = visible[visible.length - 1];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={`Período do histórico de ${displayName}`}>
        {RANGES.map((r) => (
          <button
            key={r.months}
            type="button"
            onClick={() => {
              setRange(r.months);
              gtag("event", "rates_radar_period_change");
            }}
            aria-pressed={range === r.months}
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              range === r.months
                ? "border-brand-teal bg-brand-surface-soft font-semibold text-brand-navy"
                : "border-brand-border bg-white text-brand-text"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {visible.length >= 2 && first && last ? (
        <figure className="mt-3">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={`Evolução de ${displayName}: de ${fmt(first.value)} ao mês em ${shortMonth(first.refMonth)} a ${fmt(last.value)} ao mês em ${shortMonth(last.refMonth)}. Dados completos na tabela abaixo.`}
            className="h-auto w-full rounded-xl border border-brand-border bg-white"
          >
            <text x="12" y="16" fontSize="11" fill="#64748b">{fmt(max)}</text>
            <text x="12" y={H - 4} fontSize="11" fill="#64748b">{fmt(min)}</text>
            <polyline points={polyline} fill="none" stroke="#1B3A5C" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            {visible.map((p, i) => (
              <circle key={p.refMonth} cx={x(i)} cy={y(p.value)} r={visible.length > 30 ? 1.5 : 3} fill="#E0A82E">
                <title>{`${shortMonth(p.refMonth)} — ${fmt(p.value)} a.m.`}</title>
              </circle>
            ))}
          </svg>
          <figcaption className="mt-1 flex justify-between text-xs text-brand-muted">
            <span>{shortMonth(first.refMonth)}</span>
            <span>% ao mês</span>
            <span>{shortMonth(last.refMonth)}</span>
          </figcaption>
        </figure>
      ) : null}

      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-semibold text-brand-teal-dark">
          Ver dados em tabela
        </summary>
        <div className="mt-2 max-h-72 overflow-y-auto overflow-x-auto rounded-xl border border-brand-border bg-white">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-brand-border text-left text-xs uppercase tracking-wide text-brand-muted">
                <th className="px-4 py-2">Período</th>
                <th className="px-4 py-2">Taxa (% a.m.)</th>
                <th className="px-4 py-2">Variação (p.p.)</th>
              </tr>
            </thead>
            <tbody>
              {[...visible].reverse().map((p, idx, arr) => {
                const older = arr[idx + 1];
                const diff = older ? p.value - older.value : null;
                return (
                  <tr key={p.refMonth} className="border-t border-brand-border/60 text-brand-text">
                    <td className="px-4 py-1.5">{shortMonth(p.refMonth)}</td>
                    <td className="px-4 py-1.5 font-semibold">{fmt(p.value)}</td>
                    <td className="px-4 py-1.5">
                      {diff === null
                        ? "—"
                        : `${diff > 0 ? "+" : diff < 0 ? "−" : ""}${Math.abs(diff).toFixed(2).replace(".", ",")}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>

      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        <Link
          href={`/calculadoras/minha-taxa-esta-cara/`}
          onClick={() => gtag("event", "rates_radar_compare_rate_click")}
          className="font-semibold text-brand-teal-dark underline"
        >
          Comparar minha taxa com esta média →
        </Link>
        <Link
          href="/calculadoras/conversor-de-taxas/"
          onClick={() => gtag("event", "rates_radar_converter_click")}
          className="text-brand-teal-dark underline"
        >
          Quanto isso equivale ao ano?
        </Link>
      </div>
      <span className="sr-only">{internalId}</span>
    </div>
  );
}
