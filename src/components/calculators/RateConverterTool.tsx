"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  buildConversionSentence,
  convertRate,
  formatRatePercent,
  monthlyFactors,
  nearbyRates,
  validateRatePercent,
  type RateConversion,
  type RateDirection,
} from "@/lib/calculators/rate-converter";
import { parsePercentBR } from "@/lib/calculators/proposal-comparison";
import { track } from "@/lib/analytics/track";

/* Eventos de uso — a taxa digitada NUNCA é enviada. */

const ERROR_COPY: Record<string, string> = {
  empty: "Informe a taxa que você quer converter (ex.: 3 ou 2,5).",
  invalid: "Esse valor não parece uma taxa — use números, como 3 ou 2,5.",
  negative:
    "Esta ferramenta foi desenhada para taxas de crédito não negativas. Informe um valor a partir de 0.",
  "too-large": "Taxa alta demais para uma conversão útil — confira se o valor está correto.",
};

export function RateConverterTool() {
  const [raw, setRaw] = useState("");
  const [direction, setDirection] = useState<RateDirection>("monthly-to-annual");
  const [result, setResult] = useState<RateConversion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const startedRef = useRef(false);
  const liveRef = useRef(false);

  const fromLabel = direction === "monthly-to-annual" ? "% ao mês" : "% ao ano";
  const toLabel = direction === "monthly-to-annual" ? "ao ano" : "ao mês";

  function compute(nextRaw: string, nextDirection: RateDirection, fromLive: boolean) {
    const value = parsePercentBR(nextRaw);
    const problem = validateRatePercent(value, nextRaw);
    if (problem) {
      if (!fromLive) {
        setError(ERROR_COPY[problem] ?? ERROR_COPY.invalid!);
        setResult(null);
      }
      return;
    }
    setError(null);
    setResult(convertRate(value!, nextDirection));
    setCopied(false);
    if (!fromLive) {
      track("rate_converter_complete");
      liveRef.current = true;
    }
  }

  function onRawChange(next: string) {
    if (!startedRef.current) {
      startedRef.current = true;
      track("rate_converter_start");
    }
    setRaw(next);
    // Depois da primeira conversão, recalcular instantaneamente.
    if (liveRef.current) compute(next, direction, true);
  }

  function onDirectionChange(next: RateDirection) {
    setDirection(next);
    track("rate_converter_direction_change");
    if (liveRef.current) compute(raw, next, true);
  }

  function swap() {
    const next: RateDirection =
      direction === "monthly-to-annual" ? "annual-to-monthly" : "monthly-to-annual";
    // Trocar sentido levando o resultado atual como nova entrada (round-trip natural).
    if (result) {
      const nextRaw = result.outputPercent
        .toFixed(4)
        .replace(/0+$/, "")
        .replace(/\.$/, "")
        .replace(".", ",");
      setRaw(nextRaw);
      setDirection(next);
      track("rate_converter_direction_change");
      compute(nextRaw, next, true);
    } else {
      onDirectionChange(next);
    }
  }

  async function copyResult() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(buildConversionSentence(result));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const neighbors = result ? nearbyRates(result.inputPercent, result.direction) : [];

  return (
    <section
      aria-label="Conversor de taxa de juros mensal e anual"
      className="rounded-2xl border border-brand-border bg-brand-surface-soft/50 p-4 sm:p-6"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          compute(raw, direction, false);
        }}
      >
        <label htmlFor="taxa-conversor" className="font-serif text-xl font-bold text-brand-navy">
          Qual taxa você quer converter?
        </label>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            id="taxa-conversor"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={raw}
            onChange={(e) => onRawChange(e.target.value)}
            placeholder="3,00"
            className="w-full rounded-xl border border-brand-border bg-white px-4 py-3.5 text-xl font-semibold text-brand-navy outline-none focus:border-brand-teal sm:max-w-40"
          />
          <select
            aria-label="Período da taxa informada"
            value={direction}
            onChange={(e) => onDirectionChange(e.target.value as RateDirection)}
            className="rounded-xl border border-brand-border bg-white px-4 py-3.5 text-base text-brand-text outline-none focus:border-brand-teal"
          >
            <option value="monthly-to-annual">% ao mês → ao ano</option>
            <option value="annual-to-monthly">% ao ano → ao mês</option>
          </select>
          <button
            type="submit"
            className="rounded-xl bg-brand-navy px-6 py-3.5 font-semibold text-white transition-colors hover:bg-brand-navy/90"
          >
            Converter
          </button>
          <button
            type="button"
            onClick={swap}
            aria-label="Trocar o sentido da conversão"
            title="Trocar conversão"
            className="rounded-xl border border-brand-border bg-white px-4 py-3.5 font-semibold text-brand-navy hover:bg-brand-surface-soft"
          >
            ⇄
          </button>
        </div>
      </form>

      <div aria-live="polite" className="mt-5">
        {error ? (
          <p className="rounded-xl border border-brand-warning/40 bg-brand-warning-soft p-4 text-sm text-brand-text">
            {error}
          </p>
        ) : null}

        {result ? (
          <div>
            <div className="rounded-xl border border-brand-border bg-white p-5 text-center">
              <p className="text-lg text-brand-text">
                <strong>{formatRatePercent(result.inputPercent)}</strong> {fromLabel.replace("% ", "")}
              </p>
              <p className="my-1 text-sm text-brand-muted">equivale a aproximadamente</p>
              <p className="font-serif text-4xl font-bold text-brand-navy">
                {formatRatePercent(result.outputPercent)}
              </p>
              <p className="mt-1 text-base text-brand-text">{toLabel}</p>
              <p className="mt-2 text-xs text-brand-muted">
                Taxa efetiva equivalente com capitalização composta (12 períodos mensais por ano).
              </p>
              <button
                type="button"
                onClick={copyResult}
                className="mt-3 rounded-lg border border-brand-border bg-white px-4 py-2 text-sm font-medium text-brand-navy hover:bg-brand-surface-soft"
              >
                {copied ? "Copiado ✓" : "Copiar resultado"}
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-brand-border bg-white p-4 text-center">
                <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">
                  {result.direction === "monthly-to-annual"
                    ? "Se apenas multiplicasse por 12"
                    : "Se apenas dividisse por 12"}
                </p>
                <p className="mt-1 font-serif text-xl font-bold text-brand-text">
                  {formatRatePercent(result.naivePercent)}
                </p>
              </div>
              <div className="rounded-xl border border-brand-border bg-white p-4 text-center">
                <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">
                  Taxa efetiva equivalente
                </p>
                <p className="mt-1 font-serif text-xl font-bold text-brand-navy">
                  {formatRatePercent(result.outputPercent)}
                </p>
              </div>
              <div className="rounded-xl border border-brand-border bg-white p-4 text-center">
                <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">
                  Diferença
                </p>
                <p className="mt-1 font-serif text-xl font-bold text-brand-navy">
                  {formatRatePercent(Math.abs(result.naiveDiffPP)).replace("%", "")} p.p.
                </p>
              </div>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-brand-muted">
              {result.direction === "monthly-to-annual"
                ? `${formatRatePercent(result.naivePercent)} corresponde à multiplicação simples da taxa mensal por 12 (a chamada taxa nominal proporcional). Para obter a taxa efetiva anual equivalente sob capitalização composta, o resultado é ${formatRatePercent(result.outputPercent)}.`
                : `${formatRatePercent(result.naivePercent)} corresponde à divisão simples da taxa anual por 12. A taxa mensal efetiva equivalente sob capitalização composta é ${formatRatePercent(result.outputPercent)}.`}
            </p>

            <details
              className="mt-4 rounded-xl border border-brand-border bg-white p-4"
              onToggle={(e) => {
                if ((e.target as HTMLDetailsElement).open)
                  track("rate_converter_explanation_open");
              }}
            >
              <summary className="cursor-pointer text-sm font-semibold text-brand-teal-dark">
                Por que muda tanto? Ver como o cálculo funciona
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-brand-text">
                Porque cada mês passa a considerar o efeito acumulado dos períodos anteriores — a
                equivalência é composta, não proporcional.
              </p>
              {result.direction === "monthly-to-annual" ? (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-brand-muted">
                        <th className="py-1 pr-4">Mês</th>
                        <th className="py-1">Fator acumulado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyFactors(result.inputPercent).map((factor, i) => (
                        <tr key={i} className="border-t border-brand-border/60">
                          <td className="py-1 pr-4 text-brand-muted">{i + 1}</td>
                          <td className="py-1 font-mono text-brand-text">
                            {factor.toFixed(4).replace(".", ",")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
              <p className="mt-3 text-sm leading-relaxed text-brand-text">
                <strong>Fórmula:</strong> mensal → anual: (1 + iₘ)¹² − 1; anual → mensal: (1 +
                iₐ)^(1/12) − 1 — com as taxas em formato decimal no cálculo (3% = 0,03).
              </p>
            </details>

            {neighbors.length > 1 ? (
              <div className="mt-4 rounded-xl border border-brand-border bg-white p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">
                  Taxas próximas
                </p>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-sm">
                    <tbody>
                      {neighbors.map((n) => (
                        <tr
                          key={n.inputPercent}
                          className={`border-t border-brand-border/60 ${
                            n.inputPercent === result.inputPercent ? "font-bold text-brand-navy" : "text-brand-text"
                          }`}
                        >
                          <td className="py-1 pr-4">
                            {formatRatePercent(n.inputPercent)}{" "}
                            {result.direction === "monthly-to-annual" ? "a.m." : "a.a."}
                          </td>
                          <td className="py-1">
                            ≈ {formatRatePercent(n.outputPercent)}{" "}
                            {result.direction === "monthly-to-annual" ? "a.a." : "a.m."}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            <div className="mt-4 rounded-xl bg-brand-surface-soft p-4 text-sm leading-relaxed">
              <p className="font-bold text-brand-navy">
                Agora você sabe quanto a taxa representa no ano.
              </p>
              <p className="mt-1 text-brand-text">
                Quer saber como ela se compara ao mercado?{" "}
                <Link
                  href="/calculadoras/minha-taxa-esta-cara/"
                  onClick={() => track("rate_converter_bcb_tool_click")}
                  className="font-semibold text-brand-teal-dark underline"
                >
                  Comparar com a média do Banco Central →
                </Link>
              </p>
              <p className="mt-1 text-brand-text">
                Tem duas propostas? Taxa é só uma parte:{" "}
                <Link
                  href="/calculadoras/comparador-de-propostas/"
                  onClick={() => track("rate_converter_comparator_click")}
                  className="text-brand-teal-dark underline"
                >
                  comparar propostas
                </Link>
                .
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <p className="mt-6 rounded-lg border border-brand-warning/30 bg-brand-warning-soft p-4 text-sm leading-relaxed text-brand-warning">
        Esta conversão mostra equivalência de taxas — ela não calcula o custo total de um
        empréstimo, e taxa de juros não é <Link href="/juros-e-cet/o-que-e-cet/" className="underline">CET</Link>. A conta considera equivalência composta
        entre 12 períodos mensais e um período anual; contratos específicos podem usar outras
        convenções, indexadores ou metodologias.
      </p>
    </section>
  );
}
