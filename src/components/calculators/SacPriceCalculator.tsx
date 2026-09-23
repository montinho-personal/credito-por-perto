"use client";

/**
 * CALCULADORA SAC x PRICE
 * ============================================================================
 *
 * Um componente, dois lugares: a página /calculadoras/sac-x-price/ e o artigo
 * sobre os dois sistemas. O cálculo mora em `lib/calculators/sac-price.ts`;
 * aqui só existe interface.
 *
 * DECISÕES QUE NÃO SÃO ÓBVIAS
 *
 * - Nenhum sistema "ganha". As cores dos dois são neutras (azul e dourado
 *   escuro, sem verde de aprovado nem vermelho de reprovado), e o destaque
 *   de um valor diz só "menor nesta simulação". Menor parcela no começo e
 *   menos juros no total são coisas diferentes — é esse o ponto da página.
 *
 * - Campos começam VAZIOS. Pré-preencher uma taxa ancora a pessoa num número
 *   escolhido pelo site. O exemplo existe, por botão e identificado.
 *
 * - O seletor ao mês/ao ano REINTERPRETA o número, não converte: o erro mais
 *   comum é digitar a taxa anual com "ao mês" marcado. A linha de
 *   equivalência logo abaixo mostra na hora o que o número vale.
 *
 * - Depois do primeiro cálculo, qualquer edição válida recalcula na hora; a
 *   edição inválida mantém o último resultado, marcado como desatualizado.
 *
 * - Gráficos são SVG feitos à mão, sem biblioteca: duas linhas não justificam
 *   100 kB de JavaScript. O texto dos eixos é HTML, para não encolher até
 *   ficar ilegível no celular, e cada gráfico tem tabela equivalente.
 *
 * - Nada do que é digitado sai do navegador. Os eventos dizem COMO a
 *   ferramenta foi usada, nunca com quais valores.
 */

import Link from "next/link";
import { useId, useRef, useState, useSyncExternalStore } from "react";
import { track } from "@/lib/analytics/track";
import { parseBRLToCents, parsePercentBR } from "@/lib/calculators/proposal-comparison";
import {
  buildSacPriceSummary,
  buildWhatIfScenarios,
  describeMonths,
  MIN_PRINCIPAL_CENTS,
  milestoneAt,
  simulateSacPrice,
  toMonthlyRatePercent,
  type FieldIssue,
  type RateUnit,
  type SacPriceField,
  type SacPriceInput,
  type SacPriceResult,
  type SystemResult,
  type WhatIfId,
} from "@/lib/calculators/sac-price";
import { useRevealResult } from "./use-reveal-result";

type Context = "ferramenta" | "artigo";
type InputMode = "financiado" | "bem";
type FormField = "principal" | "asset" | "down" | "rate" | "months" | "monthlyCosts" | "upfrontCosts";

interface Fields {
  mode: InputMode;
  principal: string;
  asset: string;
  down: string;
  rate: string;
  rateUnit: RateUnit;
  months: string;
  monthlyCosts: string;
  upfrontCosts: string;
}

const EMPTY: Fields = {
  mode: "financiado",
  principal: "",
  asset: "",
  down: "",
  rate: "",
  rateUnit: "am",
  months: "",
  monthlyCosts: "",
  upfrontCosts: "",
};

const TERM_CHIPS = [60, 120, 240, 360, 420] as const;

/* Cores dos dois sistemas: neutras e com contraste ≥ 3:1 sobre branco. A
   linha da SAC também é tracejada, para não depender só da cor. */
const PRICE_COLOR = "#0d3b66";
const SAC_COLOR = "#8a6100";

/* ---------- formatação (apresentação apenas) ---------- */

const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const brlRound = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(
    cents / 100,
  );
const pct = (v: number, digits = 2) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const moneyInput = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function tidyMoney(raw: string): string {
  const cents = parseBRLToCents(raw);
  return cents === null ? raw : moneyInput(cents);
}

/** "no 9º ano" para a parcela 99. */
const yearOf = (month: number) => `${Math.ceil(month / 12)}º ano`;

/* ---------- campos de texto → entrada do motor ---------- */

function parseMoney(raw: string): number {
  if (raw.trim() === "") return Number.NaN;
  const cents = parseBRLToCents(raw);
  return cents === null ? Number.NaN : cents;
}

function parseOptionalMoney(raw: string): number | undefined {
  return raw.trim() === "" ? undefined : parseMoney(raw);
}

function toInput(f: Fields): SacPriceInput {
  const rate = parsePercentBR(f.rate);
  const months = /^\d+$/.test(f.months.trim()) ? Number(f.months.trim()) : Number.NaN;
  let principalCents: number;
  if (f.mode === "financiado") {
    principalCents = parseMoney(f.principal);
  } else {
    const asset = parseMoney(f.asset);
    const down = f.down.trim() === "" ? 0 : parseMoney(f.down);
    principalCents = asset - down;
  }
  return {
    principalCents,
    ratePercent: rate === null ? Number.NaN : rate,
    rateUnit: f.rateUnit,
    months,
    monthlyCostsCents: parseOptionalMoney(f.monthlyCosts),
    upfrontCostsCents: parseOptionalMoney(f.upfrontCosts),
  };
}

/**
 * Validação que só a interface conhece (valor do bem e entrada), e tradução
 * dos erros do motor para o campo que a pessoa vê.
 */
function validate(f: Fields, engineErrors: FieldIssue[]): Partial<Record<FormField, string>> {
  const out: Partial<Record<FormField, string>> = {};
  const fieldMap: Record<SacPriceField, FormField> = {
    principalCents: f.mode === "financiado" ? "principal" : "asset",
    ratePercent: "rate",
    months: "months",
    monthlyCostsCents: "monthlyCosts",
    upfrontCostsCents: "upfrontCosts",
  };

  if (f.mode === "bem") {
    const asset = parseMoney(f.asset);
    const down = f.down.trim() === "" ? 0 : parseMoney(f.down);
    if (!Number.isFinite(asset) || asset <= 0) out.asset = "Informe o valor do bem.";
    if (!Number.isFinite(down) || down < 0) out.down = "A entrada precisa ser um valor em reais. Sem entrada, deixe vazio.";
    else if (Number.isFinite(asset) && asset > 0 && down >= asset) {
      out.down = "A entrada cobre o valor do bem inteiro: não sobra nada para financiar.";
    } else if (Number.isFinite(asset) && asset - down < MIN_PRINCIPAL_CENTS) {
      out.down = "O valor financiado (bem menos entrada) precisa ser de pelo menos R$ 1.000.";
    }
  }

  for (const e of engineErrors) {
    const target = fieldMap[e.field];
    if (f.mode === "bem" && target === "asset" && (out.asset || out.down)) continue;
    out[target] ??= e.message;
  }
  return out;
}

/* ---------- peças de interface ---------- */

const inputClass =
  "min-h-12 w-full min-w-0 rounded-lg border border-brand-border bg-white px-3 py-2.5 text-base text-brand-text tabular-nums focus:border-brand-teal aria-[invalid=true]:border-brand-danger";

function FieldShell({
  id,
  label,
  hint,
  error,
  note,
  children,
}: {
  id: string;
  label: string;
  hint?: React.ReactNode;
  error?: string;
  note?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-brand-navy">
        {label}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="mt-0.5 text-xs leading-relaxed text-brand-muted">
          {hint}
        </p>
      ) : null}
      <div className="mt-1.5">{children}</div>
      {error ? (
        <p id={`${id}-erro`} className="mt-1.5 text-sm font-medium text-brand-danger">
          {error}
        </p>
      ) : null}
      {note ? <div className="mt-1.5 text-sm text-brand-muted">{note}</div> : null}
    </div>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex shrink-0 rounded-lg border border-brand-border p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className="min-h-11 rounded-md px-3 text-sm font-semibold text-brand-muted aria-pressed:bg-brand-navy aria-pressed:text-white"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function MoneyInput({
  id,
  value,
  placeholder,
  invalid,
  describedBy,
  onChange,
  onBlur,
}: {
  id: string;
  value: string;
  placeholder: string;
  invalid: boolean;
  describedBy?: string;
  onChange: (v: string) => void;
  onBlur: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0 text-sm text-brand-muted" aria-hidden="true">
        R$
      </span>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        className={inputClass}
      />
    </div>
  );
}

/** Marca neutra do menor valor de uma linha. */
function Lower() {
  return (
    <span className="ml-1.5 inline-block rounded bg-brand-surface-soft px-1.5 py-0.5 align-middle text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
      menor<span className="sr-only"> nesta simulação</span>
    </span>
  );
}

/** Amostra de linha para legendas: sólida (Price) ou tracejada (SAC). */
function LineSwatch({ system }: { system: "price" | "sac" }) {
  return (
    <svg width="28" height="10" aria-hidden="true" className="shrink-0">
      <line
        x1="1"
        y1="5"
        x2="27"
        y2="5"
        stroke={system === "price" ? PRICE_COLOR : SAC_COLOR}
        strokeWidth="3"
        strokeDasharray={system === "sac" ? "6 4" : undefined}
      />
    </svg>
  );
}

function Legend() {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm" aria-hidden="true">
      <li className="flex items-center gap-2">
        <LineSwatch system="price" />
        <span className="font-semibold text-brand-navy">Price</span>
      </li>
      <li className="flex items-center gap-2">
        <LineSwatch system="sac" />
        <span className="font-semibold" style={{ color: SAC_COLOR }}>
          SAC
        </span>
      </li>
    </ul>
  );
}

/**
 * Gráfico de duas linhas ao longo do prazo. O SVG estica para a largura
 * disponível (`preserveAspectRatio="none"`) e o traço não engrossa
 * (`non-scaling-stroke`); os rótulos ficam em HTML, com tamanho de texto real.
 */
function TwoLineChart({
  title,
  description,
  price,
  sac,
  months,
  marker,
  tableCaption,
  Heading,
}: {
  title: string;
  description: string;
  price: number[];
  sac: number[];
  months: number;
  marker?: { month: number; label: string } | null;
  tableCaption: string;
  Heading: "h3" | "h4" | "h5";
}) {
  const max = Math.max(...price, ...sac, 1);
  const W = 1000;
  const H = 400;
  const x = (k: number) => (months <= 1 ? 0 : ((k - 1) / (months - 1)) * W);
  const y = (v: number) => H - (v / max) * H;
  const path = (values: number[]) => values.map((v, k) => `${k === 0 ? "M" : "L"}${x(k + 1).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

  // Tabela equivalente: uma linha por ano (ou por parcela em prazo curto).
  const step = months > 24 ? 12 : 1;
  const sample: number[] = [];
  for (let k = 1; k <= months; k += step) sample.push(k);
  if (sample[sample.length - 1] !== months) sample.push(months);

  return (
    <figure className="mt-6">
      <Heading className="font-serif text-lg font-bold text-brand-navy">{title}</Heading>
      <Legend />
      <div className="relative mt-3 pl-1">
        <p className="mb-1 text-xs tabular-nums text-brand-muted" aria-hidden="true">
          {brlRound(max)}
        </p>
        <div role="img" aria-label={description} className="relative h-44 w-full border-b border-l border-brand-border sm:h-56">
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
            {[0.25, 0.5, 0.75].map((g) => (
              <line key={g} x1="0" x2={W} y1={H * g} y2={H * g} stroke="#e2e5e9" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            ))}
            {marker ? (
              <line
                x1={x(marker.month)}
                x2={x(marker.month)}
                y1="0"
                y2={H}
                stroke="#5a6472"
                strokeWidth="1.5"
                strokeDasharray="3 4"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
            <path d={path(price)} fill="none" stroke={PRICE_COLOR} strokeWidth="3" vectorEffect="non-scaling-stroke" />
            <path
              d={path(sac)}
              fill="none"
              stroke={SAC_COLOR}
              strokeWidth="3"
              strokeDasharray="7 5"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          {marker ? (
            <span
              aria-hidden="true"
              className="absolute bottom-1 max-w-[45%] rounded bg-white/90 px-1 text-[11px] leading-tight text-brand-muted"
              style={
                x(marker.month) / W < 0.55
                  ? { left: `calc(${(x(marker.month) / W) * 100}% + 4px)` }
                  : { right: `calc(${100 - (x(marker.month) / W) * 100}% + 4px)`, textAlign: "right" }
              }
            >
              {marker.label}
            </span>
          ) : null}
        </div>
        <div className="mt-1 flex justify-between text-xs text-brand-muted" aria-hidden="true">
          <span>parcela 1</span>
          <span>parcela {months}</span>
        </div>
      </div>
      <details className="mt-2 text-sm">
        <summary className="min-h-11 cursor-pointer py-2 font-semibold text-brand-teal">Ver os valores do gráfico</summary>
        <div className="max-h-72 overflow-auto rounded-lg border border-brand-border">
          <table className="w-full min-w-0 border-collapse text-sm">
            <caption className="sr-only">{tableCaption}</caption>
            <thead className="sticky top-0 bg-brand-surface-soft text-left">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold text-brand-navy">Parcela</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold text-brand-navy">Price</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold text-brand-navy">SAC</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {sample.map((k) => (
                <tr key={k} className="border-t border-brand-border">
                  <th scope="row" className="px-3 py-1.5 text-left font-medium">
                    {k}
                  </th>
                  <td className="px-3 py-1.5 text-right">{brl(price[k - 1]!)}</td>
                  <td className="px-3 py-1.5 text-right">{brl(sac[k - 1]!)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

/** Barra de duas partes: quanto foi para a dívida e quanto foi para juros. */
function SplitBar({
  label,
  principalCents,
  interestCents,
  principalLabel = "Dívida (amortização)",
  interestLabel = "Juros",
}: {
  label: string;
  principalCents: number;
  interestCents: number;
  principalLabel?: string;
  interestLabel?: string;
}) {
  const total = principalCents + interestCents;
  const share = total > 0 ? principalCents / total : 1;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-brand-navy">{label}</p>
        <p className="text-sm font-semibold tabular-nums text-brand-text">{brl(total)}</p>
      </div>
      <div
        role="img"
        aria-label={`${label}: ${brl(total)}. ${principalLabel}: ${brl(principalCents)} (${pct(share * 100, 0)}%). ${interestLabel}: ${brl(interestCents)} (${pct((1 - share) * 100, 0)}%).`}
        className="mt-1.5 flex h-4 w-full overflow-hidden rounded"
      >
        <div className="bg-brand-navy" style={{ width: `${share * 100}%` }} />
        <div className="bg-brand-gold" style={{ width: `${(1 - share) * 100}%` }} />
      </div>
      <dl className="mt-1.5 grid grid-cols-2 gap-2 text-xs tabular-nums">
        <div>
          <dt className="flex items-center gap-1.5 text-brand-muted">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-brand-navy" aria-hidden="true" />
            {principalLabel}
          </dt>
          <dd className="font-semibold text-brand-text">
            {brl(principalCents)} · {pct(share * 100, 0)}%
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-brand-muted">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-brand-gold" aria-hidden="true" />
            {interestLabel}
          </dt>
          <dd className="font-semibold text-brand-text">
            {brl(interestCents)} · {pct((1 - share) * 100, 0)}%
          </dd>
        </div>
      </dl>
    </div>
  );
}

interface CompareItem {
  label: string;
  note?: string;
  price: number;
  sac: number;
  /** Formato do valor; padrão, reais. Sem marca de "menor" quando informado. */
  format?: (v: number) => string;
}

/**
 * Comparação lado a lado com a marca neutra no menor valor de cada linha. No
 * celular, um cartão por linha — rótulo em cima, os dois valores embaixo —,
 * porque três colunas em 320 px espremiam o rótulo em sete linhas. A partir
 * de 640 px, tabela.
 */
function CompareBlock({ caption, items }: { caption: string; items: CompareItem[] }) {
  const value = (item: CompareItem, v: number) => (item.format ? item.format(v) : brl(v));
  const lower = (item: CompareItem, mine: number, other: number) => !item.format && mine < other;
  return (
    <>
      <ul aria-label={caption} className="mt-2 divide-y divide-brand-border border-y border-brand-border sm:hidden">
        {items.map((item) => (
          <li key={item.label} className="py-2.5">
            <p className="text-sm font-medium text-brand-text">
              {item.label}
              {item.note ? <span className="text-xs font-normal text-brand-muted"> · {item.note}</span> : null}
            </p>
            <dl className="mt-1 grid grid-cols-2 gap-x-3 text-sm tabular-nums">
              {(["price", "sac"] as const).map((sys) => (
                <div key={sys}>
                  <dt className="text-xs font-semibold" style={{ color: sys === "price" ? PRICE_COLOR : SAC_COLOR }}>
                    {sys === "price" ? "Price" : "SAC"}
                  </dt>
                  <dd className="font-semibold text-brand-text">
                    {value(item, item[sys])}
                    {lower(item, item[sys], item[sys === "price" ? "sac" : "price"]) ? <Lower /> : null}
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
      <table className="mt-2 hidden w-full min-w-0 border-collapse sm:table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="text-sm">
            <th scope="col" className="py-2 pr-2 text-left font-semibold text-brand-muted">
              <span className="sr-only">Item</span>
            </th>
            <th scope="col" className="px-1.5 py-2 text-right font-bold" style={{ color: PRICE_COLOR }}>
              Price
            </th>
            <th scope="col" className="py-2 pl-1.5 text-right font-bold" style={{ color: SAC_COLOR }}>
              SAC
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.label} className="border-t border-brand-border">
              <th scope="row" className="py-2.5 pr-2 text-left align-top text-sm font-medium text-brand-text">
                {item.label}
                {item.note ? <span className="block text-xs font-normal text-brand-muted">{item.note}</span> : null}
              </th>
              {(["price", "sac"] as const).map((sys) => (
                <td key={sys} className={`py-2.5 text-right align-top text-sm tabular-nums ${sys === "price" ? "px-1.5" : "pl-1.5"}`}>
                  <span className="font-semibold text-brand-text">{value(item, item[sys])}</span>
                  {lower(item, item[sys], item[sys === "price" ? "sac" : "price"]) ? (
                    <span className="block">
                      <Lower />
                    </span>
                  ) : null}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

/* Web Share: existe no navegador? Lido sem efeito, para não divergir da hidratação. */
const subscribeNoop = () => () => {};
const canShareSnapshot = () => typeof navigator !== "undefined" && typeof navigator.share === "function";
const canShareServer = () => false;

const PAGE = 60;

/* ---------- componente ---------- */

export function SacPriceCalculator({ context = "ferramenta" }: { context?: Context }) {
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;

  const [fields, setFields] = useState<Fields>(EMPTY);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<FormField, string>>>({});
  const [warnings, setWarnings] = useState<FieldIssue[]>([]);
  const [shown, setShown] = useState<{ result: SacPriceResult; input: SacPriceInput } | null>(null);
  const [stale, setStale] = useState(false);
  const [exampleActive, setExampleActive] = useState(false);
  const [scenario, setScenario] = useState<WhatIfId>("prazo-menor");
  const [milestoneMonth, setMilestoneMonth] = useState<number | null>(null);
  const [installment, setInstallment] = useState(1);
  const [tableSystem, setTableSystem] = useState<"price" | "sac">("price");
  const [tableView, setTableView] = useState<"ano" | "mes">("ano");
  const [visibleRows, setVisibleRows] = useState(PAGE);
  const [copied, setCopied] = useState<"ok" | "falhou" | null>(null);

  const started = useRef(false);
  const exampleEverUsed = useRef(false);
  const advancedUsed = useRef(false);

  const canShare = useSyncExternalStore(subscribeNoop, canShareSnapshot, canShareServer);
  const { ref: resultRef, reveal } = useRevealResult();

  /** Calcula e aplica. Chamado por evento, nunca por efeito. */
  function run(next: Fields, { announce }: { announce: boolean }) {
    const input = toInput(next);
    const outcome = simulateSacPrice(input);
    const fieldErrors = validate(next, outcome.kind === "invalid" ? outcome.errors : []);
    if (outcome.kind === "invalid" || Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      setWarnings([]);
      setStale(shown !== null);
      return;
    }
    setErrors({});
    setWarnings(outcome.warnings);
    setStale(false);
    setShown({ result: outcome.result, input });
    setInstallment((k) => Math.min(Math.max(1, k), outcome.result.months));
    setVisibleRows(PAGE);
    if (announce) {
      track("sac_price_complete", {
        context,
        rate_unit: next.rateUnit === "am" ? "mensal" : "anual",
        input_mode: next.mode === "financiado" ? "valor_financiado" : "bem_e_entrada",
        advanced_used: advancedUsed.current,
        example_used: exampleEverUsed.current,
      });
    }
  }

  function update(patch: Partial<Fields>) {
    if (!started.current) {
      started.current = true;
      track("sac_price_start", { context });
    }
    const next = { ...fields, ...patch };
    setFields(next);
    setExampleActive(false);
    if (submitted) run(next, { announce: false });
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    run(fields, { announce: true });
    reveal();
  }

  function fillExample() {
    exampleEverUsed.current = true;
    const next: Fields = {
      ...EMPTY,
      mode: "bem",
      asset: moneyInput(400_000_00),
      down: moneyInput(100_000_00),
      rate: "1,00",
      rateUnit: "am",
      months: "360",
    };
    setFields(next);
    setExampleActive(true);
    setSubmitted(true);
    run(next, { announce: true });
    reveal();
  }

  async function copySummary() {
    if (!shown) return;
    try {
      await navigator.clipboard.writeText(buildSacPriceSummary(shown.result));
      setCopied("ok");
      track("sac_price_copy", { context });
    } catch {
      setCopied("falhou");
    }
    setTimeout(() => setCopied(null), 4000);
  }

  async function share() {
    track("sac_price_share", { context });
    try {
      await navigator.share({
        title: "Calculadora SAC x Price",
        text: "Compare parcelas, juros e saldo devedor nos sistemas SAC e Price. Grátis e sem cadastro.",
        url: `${window.location.origin}/calculadoras/sac-x-price/`,
      });
    } catch {
      /* A pessoa cancelou o compartilhamento: nada a fazer. */
    }
  }

  const errorOf = (field: FormField) => errors[field];
  const warningOf = (field: SacPriceField) => warnings.find((w) => w.field === field)?.message;
  const described = (name: string, field: FormField, withHint = true) =>
    [withHint ? `${id(name)}-hint` : null, errorOf(field) ? `${id(name)}-erro` : null].filter(Boolean).join(" ") ||
    undefined;

  /* Linhas de equivalência, calculadas do que está digitado agora. */
  const live = toInput(fields);
  const rateEcho = (() => {
    if (!Number.isFinite(live.ratePercent) || live.ratePercent < 0) return null;
    const monthly = toMonthlyRatePercent(live.ratePercent, live.rateUnit);
    const annual = (Math.pow(1 + monthly / 100, 12) - 1) * 100;
    return live.rateUnit === "am"
      ? `equivale a ${pct(annual)}% ao ano (taxa efetiva)`
      : `equivale a ${pct(monthly, 4)}% ao mês (taxa efetiva)`;
  })();
  const monthsEcho =
    Number.isFinite(live.months) && live.months >= 12 && live.months % 12 === 0
      ? `${live.months / 12} ${live.months === 12 ? "ano" : "anos"}`
      : Number.isFinite(live.months) && live.months > 12
        ? `${Math.floor(live.months / 12)} anos e ${live.months % 12} ${live.months % 12 === 1 ? "mês" : "meses"}`
        : null;
  const financedEcho =
    fields.mode === "bem" && Number.isFinite(live.principalCents) && live.principalCents > 0
      ? `Valor financiado: ${brl(live.principalCents)}`
      : null;

  /* Na página, o resultado é seção de primeiro nível (h2, sob o h1). No artigo,
     a calculadora vive sob um h2 do texto: os títulos descem um nível. */
  const Title = context === "artigo" ? "h3" : "h2";
  const Sub = context === "artigo" ? "h4" : "h3";
  const Minor = context === "artigo" ? "h5" : "h4";

  const r = shown?.result ?? null;
  const scenarios = shown ? buildWhatIfScenarios(shown.input) : [];
  const activeScenario = scenarios.find((s) => s.id === scenario) ?? scenarios[0];

  const milestoneChips = r
    ? [
        { id: "1-ano", month: 12, label: "1 ano" },
        { id: "2-anos", month: 24, label: "2 anos" },
        { id: "5-anos", month: 60, label: "5 anos" },
        { id: "10-anos", month: 120, label: "10 anos" },
        { id: "metade", month: r.middleMonth, label: "Metade do prazo" },
      ].filter((c, i, all) => c.month < r.months && all.findIndex((o) => o.month === c.month) === i)
    : [];
  const selectedMilestoneMonth =
    milestoneMonth !== null && milestoneChips.some((c) => c.month === milestoneMonth)
      ? milestoneMonth
      : (milestoneChips.find((c) => c.month === 60) ?? milestoneChips[milestoneChips.length - 1])?.month ?? null;
  const milestone =
    r && selectedMilestoneMonth !== null ? milestoneAt(r, selectedMilestoneMonth, "") : null;

  /* Marco usado nas frases e no bloco "o número que quase ninguém olha". */
  const storyMonth = r ? (r.months > 60 ? 60 : r.months >= 4 ? r.middleMonth : null) : null;
  const story = r && storyMonth !== null ? milestoneAt(r, storyMonth, "") : null;
  const storyLabel =
    storyMonth === null ? "" : storyMonth === 60 ? "depois de 5 anos" : `na metade do prazo (parcela ${storyMonth})`;

  const k = r ? Math.min(Math.max(1, installment), r.months) : 1;
  const tableRows: SystemResult | null = r ? r[tableSystem] : null;

  return (
    <section
      aria-label="Calculadora SAC x Price"
      className="rounded-2xl border border-brand-border bg-white p-3 shadow-sm sm:p-6"
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-brand-navy">Como você quer informar o valor?</p>
          <Segmented
            label="Como informar o valor"
            value={fields.mode}
            onChange={(mode) => update({ mode })}
            options={[
              { value: "financiado", label: "Valor financiado" },
              { value: "bem", label: "Bem e entrada" },
            ]}
          />
        </div>

        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          {fields.mode === "financiado" ? (
            <FieldShell
              id={id("financiado")}
              label="Valor financiado"
              hint="O que você vai dever à instituição, já descontada a entrada"
              error={errorOf("principal")}
            >
              <MoneyInput
                id={id("financiado")}
                value={fields.principal}
                placeholder="ex.: 300.000"
                invalid={Boolean(errorOf("principal"))}
                describedBy={described("financiado", "principal")}
                onChange={(principal) => update({ principal })}
                onBlur={() => setFields((f) => ({ ...f, principal: tidyMoney(f.principal) }))}
              />
            </FieldShell>
          ) : (
            <>
              <FieldShell id={id("bem")} label="Valor do bem" hint="Preço do imóvel ou do veículo" error={errorOf("asset")}>
                <MoneyInput
                  id={id("bem")}
                  value={fields.asset}
                  placeholder="ex.: 400.000"
                  invalid={Boolean(errorOf("asset"))}
                  describedBy={described("bem", "asset")}
                  onChange={(asset) => update({ asset })}
                  onBlur={() => setFields((f) => ({ ...f, asset: tidyMoney(f.asset) }))}
                />
              </FieldShell>
              <FieldShell
                id={id("entrada")}
                label="Entrada"
                hint="Em reais. Sem entrada, deixe vazio."
                error={errorOf("down")}
                note={financedEcho ? <span aria-live="polite">{financedEcho}</span> : null}
              >
                <MoneyInput
                  id={id("entrada")}
                  value={fields.down}
                  placeholder="ex.: 100.000"
                  invalid={Boolean(errorOf("down"))}
                  describedBy={described("entrada", "down")}
                  onChange={(down) => update({ down })}
                  onBlur={() => setFields((f) => ({ ...f, down: tidyMoney(f.down) }))}
                />
              </FieldShell>
            </>
          )}

          <FieldShell
            id={id("taxa")}
            label="Taxa de juros"
            hint="A taxa efetiva do contrato ou da simulação. Confira se ela é ao mês ou ao ano."
            error={errorOf("rate")}
            note={
              <>
                {warningOf("ratePercent") ? (
                  <p className="font-medium text-brand-warning">{warningOf("ratePercent")}</p>
                ) : null}
                {rateEcho ? <p aria-live="polite">{rateEcho}</p> : null}
                <details className="mt-1">
                  <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-brand-teal">
                    Taxa nominal ou efetiva?
                  </summary>
                  <p className="text-sm leading-relaxed text-brand-text">
                    Muitos contratos, sobretudo de imóvel, mostram duas taxas anuais. A{" "}
                    <strong>efetiva</strong> já inclui o efeito dos juros sobre juros: é a que esta
                    calculadora usa com a opção “ao ano”. A <strong>nominal</strong> ao ano, com
                    capitalização mensal, é a taxa do mês multiplicada por 12 — para usá-la, divida por
                    12 e informe o resultado com a opção “ao mês”. Aqui a conversão entre mês e ano é
                    sempre por equivalência composta, nunca por divisão.
                  </p>
                </details>
              </>
            }
          >
            <div className="flex items-center gap-2">
              <input
                id={id("taxa")}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder={fields.rateUnit === "am" ? "ex.: 0,90" : "ex.: 11,35"}
                value={fields.rate}
                onChange={(e) => update({ rate: e.target.value })}
                aria-invalid={Boolean(errorOf("rate"))}
                aria-describedby={described("taxa", "rate")}
                className={inputClass}
              />
              <span className="shrink-0 text-sm text-brand-muted" aria-hidden="true">
                %
              </span>
              <Segmented
                label="Unidade da taxa"
                value={fields.rateUnit}
                onChange={(rateUnit) => update({ rateUnit })}
                options={[
                  { value: "am", label: "ao mês" },
                  { value: "aa", label: "ao ano" },
                ]}
              />
            </div>
          </FieldShell>

          <FieldShell
            id={id("prazo")}
            label="Prazo"
            hint="Número de parcelas mensais (até 420)"
            error={errorOf("months")}
            note={
              <>
                {monthsEcho ? <p aria-live="polite">{monthsEcho}</p> : null}
                <div role="group" aria-label="Prazos comuns" className="mt-1 flex flex-wrap gap-1.5">
                  {TERM_CHIPS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={fields.months.trim() === String(m)}
                      onClick={() => update({ months: String(m) })}
                      className="min-h-11 rounded-full border border-brand-border px-3 text-sm font-medium text-brand-navy aria-pressed:border-brand-navy aria-pressed:bg-brand-navy aria-pressed:text-white"
                    >
                      {m / 12} anos
                    </button>
                  ))}
                </div>
              </>
            }
          >
            <div className="flex items-center gap-2">
              <input
                id={id("prazo")}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="ex.: 360"
                value={fields.months}
                onChange={(e) => update({ months: e.target.value.replace(/\D/g, "") })}
                aria-invalid={Boolean(errorOf("months"))}
                aria-describedby={described("prazo", "months")}
                className={inputClass}
              />
              <span className="shrink-0 text-sm text-brand-muted" aria-hidden="true">
                meses
              </span>
            </div>
          </FieldShell>
        </div>

        <details
          className="mt-5 rounded-lg border border-brand-border"
          onToggle={(e) => {
            if ((e.currentTarget as HTMLDetailsElement).open) {
              advancedUsed.current = true;
              track("sac_price_advanced_open", { context });
            }
          }}
        >
          <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-semibold text-brand-navy">
            Incluir custos que você já conhece (opcional)
          </summary>
          <div className="grid gap-5 border-t border-brand-border p-4 sm:grid-cols-2">
            <FieldShell
              id={id("custo-mensal")}
              label="Custo mensal fixo"
              hint="Seguro ou tarifa cobrados todo mês junto da parcela, se a proposta informar um valor fixo."
              error={errorOf("monthlyCosts")}
            >
              <MoneyInput
                id={id("custo-mensal")}
                value={fields.monthlyCosts}
                placeholder="0,00"
                invalid={Boolean(errorOf("monthlyCosts"))}
                describedBy={described("custo-mensal", "monthlyCosts")}
                onChange={(monthlyCosts) => update({ monthlyCosts })}
                onBlur={() => setFields((f) => ({ ...f, monthlyCosts: tidyMoney(f.monthlyCosts) }))}
              />
            </FieldShell>
            <FieldShell
              id={id("custo-vista")}
              label="Custos pagos à parte"
              hint="Valores pagos uma vez, fora das parcelas (por exemplo, na assinatura)."
              error={errorOf("upfrontCosts")}
            >
              <MoneyInput
                id={id("custo-vista")}
                value={fields.upfrontCosts}
                placeholder="0,00"
                invalid={Boolean(errorOf("upfrontCosts"))}
                describedBy={described("custo-vista", "upfrontCosts")}
                onChange={(upfrontCosts) => update({ upfrontCosts })}
                onBlur={() => setFields((f) => ({ ...f, upfrontCosts: tidyMoney(f.upfrontCosts) }))}
              />
            </FieldShell>
            <p className="text-xs leading-relaxed text-brand-muted sm:col-span-2">
              Os custos entram iguais nos dois sistemas e não mudam a tabela de juros. Seguros que
              acompanham o saldo devedor, e por isso mudam todo mês, não são simulados. O resultado
              com custos é uma estimativa com os valores que você informou — não é o CET.
            </p>
          </div>
        </details>

        {Object.keys(errors).length > 0 ? (
          <p role="alert" className="mt-4 rounded-lg border border-brand-danger/40 bg-brand-danger-soft p-3 text-sm text-brand-danger">
            {Object.keys(errors).length === 1
              ? "Um campo precisa de ajuste — ele está destacado acima."
              : `${Object.keys(errors).length} campos precisam de ajuste — eles estão destacados acima.`}
          </p>
        ) : null}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="submit"
            className="min-h-12 w-full rounded-lg bg-brand-teal-dark px-6 font-semibold text-white hover:bg-brand-teal sm:w-auto"
          >
            Comparar SAC e Price
          </button>
          <button
            type="button"
            onClick={fillExample}
            className="min-h-11 text-sm font-semibold text-brand-teal underline underline-offset-2"
          >
            Preencher com um exemplo
          </button>
        </div>
        <p className="mt-3 text-xs text-brand-muted">
          Sem cadastro · Sem CPF · O cálculo acontece no seu aparelho e nada do que você digita é enviado.
        </p>
      </form>

      {/* Anúncio curto para leitores de tela: só o essencial. */}
      <p className="sr-only" aria-live="polite">
        {r && !stale
          ? `Price: parcela de ${brl(r.price.firstPaymentCents)} e juros de ${brl(r.price.totalInterestCents)}. SAC: primeira parcela de ${brl(r.sac.firstPaymentCents)} e juros de ${brl(r.sac.totalInterestCents)}.`
          : ""}
      </p>

      <div ref={resultRef} className="scroll-mt-24">
        {r ? (
          <div className={`mt-6 border-t border-brand-border pt-6 ${stale ? "opacity-60" : ""}`}>
            {exampleActive ? (
              <p className="mb-4 rounded-lg bg-brand-gold-soft px-3 py-2 text-sm text-brand-gold-dark">
                Você está vendo um <strong>exemplo</strong>: bem de R$ 400 mil, R$ 100 mil de entrada, 360
                meses e taxa ilustrativa de 1% ao mês. Troque pelos números da sua proposta.
              </p>
            ) : null}
            {stale ? (
              <p className="mb-4 text-sm font-medium text-brand-warning">
                Resultado da última simulação válida. Ajuste o campo destacado para atualizar.
              </p>
            ) : null}

            <Title tabIndex={-1} data-result-heading className="font-serif text-xl font-bold text-brand-navy">
              SAC e Price com os seus números
            </Title>
            <p className="mt-1 text-sm text-brand-muted">
              {brl(r.principalCents)} · {describeMonths(r.months)} · {pct(r.monthlyRatePercent, r.monthlyRatePercent < 1 ? 4 : 2)}% ao mês (
              {pct(r.annualRatePercent)}% ao ano)
            </p>

            {/* Os dois cartões: mesma hierarquia visual, nenhum em destaque. */}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {(["price", "sac"] as const).map((sys) => {
                const s = r[sys];
                return (
                  <div
                    key={sys}
                    className="rounded-xl border-2 p-4"
                    style={{ borderColor: sys === "price" ? PRICE_COLOR : SAC_COLOR }}
                  >
                    <p className="flex items-center gap-2 text-sm font-bold" style={{ color: sys === "price" ? PRICE_COLOR : SAC_COLOR }}>
                      <LineSwatch system={sys} />
                      {sys === "price" ? "Price · parcela fixa" : "SAC · parcela decrescente"}
                    </p>
                    <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-brand-muted">
                      {sys === "price" ? "Parcela" : "1ª parcela"}
                    </p>
                    <p className="font-serif text-2xl font-bold tabular-nums text-brand-navy sm:text-3xl">
                      {brl(s.firstPaymentCents)}
                    </p>
                    <p className="mt-1 text-sm text-brand-muted">
                      {sys === "price"
                        ? s.lastPaymentCents !== s.firstPaymentCents
                          ? `a última, de ${brl(s.lastPaymentCents)}, acerta o arredondamento`
                          : "igual do começo ao fim"
                        : `cai até ${brl(s.lastPaymentCents)} na última`}
                    </p>
                    <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-brand-border pt-3 text-sm tabular-nums">
                      <div>
                        <dt className="text-xs text-brand-muted">Juros no total</dt>
                        <dd className="font-semibold text-brand-text">{brl(s.totalInterestCents)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-brand-muted">Total das parcelas</dt>
                        <dd className="font-semibold text-brand-text">{brl(s.totalPaidCents)}</dd>
                      </div>
                    </dl>
                  </div>
                );
              })}
            </div>

            {/* O que muda de verdade — frases montadas dos números. */}
            <div className="mt-6 rounded-xl bg-brand-teal-soft p-4 sm:p-5">
              <Sub className="font-serif text-lg font-bold text-brand-navy">O que muda de verdade?</Sub>
              {r.sac.totalInterestCents === r.price.totalInterestCents &&
              r.sac.firstPaymentCents === r.price.firstPaymentCents ? (
                <p className="mt-2 text-brand-text">
                  {r.months === 1
                    ? "Com uma parcela só, os dois sistemas são a mesma conta: a dívida mais os juros de um mês."
                    : "Sem juros, os dois sistemas dão a mesma tabela: a dívida é dividida em parcelas iguais."}
                </p>
              ) : (
                <ul className="mt-2 space-y-2 leading-relaxed text-brand-text">
                  <li>
                    No começo, a SAC pede{" "}
                    <strong className="tabular-nums">{brl(r.sac.firstPaymentCents - r.price.firstPaymentCents)} a mais por mês</strong>{" "}
                    ({brl(r.sac.firstPaymentCents)} contra {brl(r.price.firstPaymentCents)}).
                  </li>
                  {r.crossoverMonth !== null ? (
                    <li>
                      A partir da <strong>parcela nº {r.crossoverMonth}</strong> ({yearOf(r.crossoverMonth)}), a parcela da SAC
                      fica abaixo da Price — e continua caindo até o fim.
                    </li>
                  ) : null}
                  {r.sac.totalInterestCents < r.price.totalInterestCents ? (
                    <li>
                      No contrato inteiro, a SAC soma{" "}
                      <strong className="tabular-nums">{brl(r.price.totalInterestCents - r.sac.totalInterestCents)} a menos de juros</strong>
                      , porque a dívida cai mais rápido e os juros de cada mês incidem sobre um saldo menor.
                    </li>
                  ) : null}
                  {story && story.sac.balanceCents < story.price.balanceCents ? (
                    <li>
                      {storyLabel.charAt(0).toUpperCase() + storyLabel.slice(1)}, o saldo devedor na SAC é{" "}
                      <strong className="tabular-nums">{brl(story.price.balanceCents - story.sac.balanceCents)} menor</strong>. Pesa
                      para quem pensa em quitar antes, vender ou transferir o financiamento.
                    </li>
                  ) : null}
                </ul>
              )}
            </div>

            {/* Tabela lado a lado: três colunas cabem em 320 px. */}
            <div className="mt-6">
              <Sub className="font-serif text-lg font-bold text-brand-navy">Lado a lado</Sub>
              <CompareBlock
                caption="Comparação entre Price e SAC. “Menor” marca o menor valor de cada linha nesta simulação."
                items={[
                  { label: "1ª parcela", price: r.price.firstPaymentCents, sac: r.sac.firstPaymentCents },
                  ...(r.months > 2
                    ? [
                        {
                          label: `Parcela nº ${r.middleMonth}`,
                          note: "meio do prazo",
                          price: r.price.middlePaymentCents,
                          sac: r.sac.middlePaymentCents,
                        },
                      ]
                    : []),
                  ...(r.months > 1
                    ? [{ label: "Última parcela", price: r.price.lastPaymentCents, sac: r.sac.lastPaymentCents }]
                    : []),
                  { label: "Juros no total", price: r.price.totalInterestCents, sac: r.sac.totalInterestCents },
                  { label: "Total das parcelas", price: r.price.totalPaidCents, sac: r.sac.totalPaidCents },
                  ...(r.monthlyCostsCents > 0 || r.upfrontCostsCents > 0
                    ? [
                        {
                          label: "Custo estimado com os valores informados",
                          note: "parcelas + custos que você informou",
                          price: r.estimatedCostCents.price,
                          sac: r.estimatedCostCents.sac,
                        },
                      ]
                    : []),
                  ...r.quarterMilestones.map((m) => ({
                    label: `Saldo devedor ${m.label.toLowerCase()}`,
                    note: `depois da parcela ${m.month}`,
                    price: m.price.balanceCents,
                    sac: m.sac.balanceCents,
                  })),
                ]}
              />
            </div>

            {/* A assinatura da página: três números, três perguntas. */}
            <div className="mt-6 overflow-hidden rounded-xl border border-brand-border">
              <div className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">O número que aparece</p>
                <p className="mt-1 text-sm text-brand-text">A primeira parcela</p>
                <p className="mt-1 font-serif text-xl font-bold tabular-nums text-brand-navy">
                  Price {brlRound(r.price.firstPaymentCents)} · SAC {brlRound(r.sac.firstPaymentCents)}
                </p>
              </div>
              {story ? (
                <div className="border-t border-brand-border bg-brand-gold-soft p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-gold-dark">
                    O número que quase ninguém olha
                  </p>
                  <p className="mt-1 text-sm text-brand-text">Quanto você ainda deve {storyLabel}</p>
                  <p className="mt-1 font-serif text-xl font-bold tabular-nums text-brand-navy">
                    Price {brlRound(story.price.balanceCents)} · SAC {brlRound(story.sac.balanceCents)}
                  </p>
                </div>
              ) : null}
              <div className="border-t border-brand-border p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">O número que faz diferença</p>
                <p className="mt-1 text-sm text-brand-text">Os juros do contrato inteiro</p>
                <p className="mt-1 font-serif text-xl font-bold tabular-nums text-brand-navy">
                  Price {brlRound(r.price.totalInterestCents)} · SAC {brlRound(r.sac.totalInterestCents)}
                </p>
              </div>
            </div>

            {r.months > 1 ? (
              <>
                <TwoLineChart
                  Heading={Sub}
                  title="A parcela ao longo do tempo"
                  description={`Gráfico da parcela mês a mês. Price: ${brl(r.price.firstPaymentCents)} constante. SAC: começa em ${brl(r.sac.firstPaymentCents)} e cai até ${brl(r.sac.lastPaymentCents)}.${
                    r.crossoverMonth !== null ? ` As linhas se cruzam na parcela ${r.crossoverMonth}.` : ""
                  }`}
                  price={r.price.schedule.map((row) => row.paymentCents)}
                  sac={r.sac.schedule.map((row) => row.paymentCents)}
                  months={r.months}
                  marker={
                    r.crossoverMonth !== null
                      ? { month: r.crossoverMonth, label: `parcela ${r.crossoverMonth}: SAC fica abaixo` }
                      : null
                  }
                  tableCaption="Valor da parcela em cada sistema, por parcela"
                />
                <TwoLineChart
                  Heading={Sub}
                  title="Quanto você ainda deve"
                  description={`Gráfico do saldo devedor mês a mês, de ${brl(r.principalCents)} até zero nos dois sistemas. A SAC cai em linha reta; a Price cai devagar no começo e rápido no fim.${
                    story ? ` ${storyLabel.charAt(0).toUpperCase() + storyLabel.slice(1)}: Price ${brl(story.price.balanceCents)}, SAC ${brl(story.sac.balanceCents)}.` : ""
                  }`}
                  price={r.price.schedule.map((row) => row.closingCents)}
                  sac={r.sac.schedule.map((row) => row.closingCents)}
                  months={r.months}
                  marker={storyMonth !== null ? { month: storyMonth, label: storyLabel } : null}
                  tableCaption="Saldo devedor depois de cada parcela, nos dois sistemas"
                />
              </>
            ) : null}

            {/* Onde foi o dinheiro? */}
            <div className="mt-6">
              <Sub className="font-serif text-lg font-bold text-brand-navy">Onde foi o dinheiro?</Sub>
              <p className="mt-1 text-sm text-brand-muted">
                Tudo o que sai nas parcelas, dividido entre o que pagou a dívida e o que foi juro.
              </p>
              <div className="mt-3 grid gap-5 sm:grid-cols-2">
                <SplitBar label="Price" principalCents={r.principalCents} interestCents={r.price.totalInterestCents} />
                <SplitBar label="SAC" principalCents={r.principalCents} interestCents={r.sac.totalInterestCents} />
              </div>
            </div>

            {/* Composição de uma parcela qualquer. */}
            {r.months > 1 ? (
              <div className="mt-6 rounded-xl border border-brand-border p-4">
                <Sub className="font-serif text-lg font-bold text-brand-navy">Do que é feita cada parcela</Sub>
                <label htmlFor={id("parcela")} className="mt-2 block text-sm font-semibold text-brand-navy">
                  Parcela nº {k} <span className="font-normal text-brand-muted">de {r.months} ({yearOf(k)})</span>
                </label>
                <input
                  id={id("parcela")}
                  type="range"
                  min={1}
                  max={r.months}
                  step={1}
                  value={k}
                  onChange={(e) => setInstallment(Number(e.target.value))}
                  aria-valuetext={`parcela ${k} de ${r.months}`}
                  className="mt-2 h-11 w-full cursor-pointer accent-brand-navy"
                />
                <div className="mt-3 grid gap-5 sm:grid-cols-2">
                  {(["price", "sac"] as const).map((sys) => {
                    const row = r[sys].schedule[k - 1]!;
                    return (
                      <SplitBar
                        key={sys}
                        label={sys === "price" ? "Price" : "SAC"}
                        principalCents={row.amortizationCents}
                        interestCents={row.interestCents}
                        principalLabel="Amortização"
                      />
                    );
                  })}
                </div>
                <p className="mt-3 text-sm leading-relaxed text-brand-text">
                  Amortização é a parte da parcela que reduz a dívida. Na SAC ela é a mesma todo mês (
                  {brl(r.sac.fixedCents)}); na Price ela começa pequena e cresce, enquanto os juros encolhem.
                </p>
              </div>
            ) : null}

            {/* Marcos: quanto da dívida já foi paga. */}
            {milestone && selectedMilestoneMonth !== null ? (
              <div className="mt-6">
                <Sub className="font-serif text-lg font-bold text-brand-navy">Quanto da dívida já foi paga?</Sub>
                <div role="group" aria-label="Escolher um momento do contrato" className="mt-3 flex flex-wrap gap-2">
                  {milestoneChips.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={selectedMilestoneMonth === c.month}
                      onClick={() => {
                        setMilestoneMonth(c.month);
                        track("sac_price_milestone_select", { context, milestone: c.id });
                      }}
                      className="min-h-11 rounded-lg border border-brand-border px-3 text-sm font-medium text-brand-navy aria-pressed:border-brand-navy aria-pressed:bg-brand-navy aria-pressed:text-white"
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-sm text-brand-muted">Depois de {selectedMilestoneMonth} parcelas pagas:</p>
                <CompareBlock
                  caption={`Situação do financiamento depois de ${selectedMilestoneMonth} parcelas, nos dois sistemas`}
                  items={[
                    {
                      label: "Dívida já amortizada",
                      price: milestone.price.amortizedShare,
                      sac: milestone.sac.amortizedShare,
                      format: (v) => `${pct(v * 100, 1)}%`,
                    },
                    { label: "Saldo devedor", price: milestone.price.balanceCents, sac: milestone.sac.balanceCents },
                    { label: "Pago até aqui", price: milestone.price.paidCents, sac: milestone.sac.paidCents },
                    {
                      label: "Desse total, juros",
                      price: milestone.price.interestPaidCents,
                      sac: milestone.sac.interestPaidCents,
                    },
                  ]}
                />
              </div>
            ) : null}

            {/* E se? — consequência, não conselho. */}
            {scenarios.length > 0 ? (
              <div className="mt-6">
                <Sub className="font-serif text-lg font-bold text-brand-navy">E se?</Sub>
                <div role="group" aria-label="Cenários para comparar" className="mt-3 flex flex-wrap gap-2">
                  {scenarios.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      aria-pressed={activeScenario?.id === s.id}
                      onClick={() => {
                        setScenario(s.id);
                        track("sac_price_whatif_select", { context, scenario: s.id });
                      }}
                      className="min-h-11 rounded-lg border border-brand-border px-3 text-left text-sm font-medium text-brand-navy aria-pressed:border-brand-navy aria-pressed:bg-brand-navy aria-pressed:text-white"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                {activeScenario ? (
                  activeScenario.result ? (
                    <div className="mt-4 rounded-xl border border-brand-border">
                      <dl className="divide-y divide-brand-border">
                        {(
                          [
                            ["price", "Price — parcela", r.price.firstPaymentCents, activeScenario.result.price.firstPaymentCents],
                            ["price", "Price — juros no total", r.price.totalInterestCents, activeScenario.result.price.totalInterestCents],
                            ["sac", "SAC — 1ª parcela", r.sac.firstPaymentCents, activeScenario.result.sac.firstPaymentCents],
                            ["sac", "SAC — juros no total", r.sac.totalInterestCents, activeScenario.result.sac.totalInterestCents],
                          ] as const
                        ).map(([sys, label, before, after]) => (
                          <div key={label} className="px-3 py-2.5">
                            <dt className="text-sm font-medium" style={{ color: sys === "price" ? PRICE_COLOR : SAC_COLOR }}>
                              {label}
                            </dt>
                            <dd className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-sm tabular-nums">
                              <span className="text-brand-muted">
                                <span className="sr-only">agora, </span>
                                {brl(before)}
                              </span>
                              <span aria-hidden="true" className="text-brand-muted">
                                →
                              </span>
                              <span className="font-semibold text-brand-navy">
                                <span className="sr-only">no cenário, </span>
                                {brl(after)}
                              </span>
                              <span className="ml-auto font-semibold text-brand-text">
                                <span className="sr-only">diferença: </span>
                                {after === before ? "sem mudança" : `${after > before ? "+" : "−"}${brl(Math.abs(after - before))}`}
                              </span>
                            </dd>
                          </div>
                        ))}
                      </dl>
                      {activeScenario.id === "prazo-menor" ? (
                        <p className="border-t border-brand-border px-3 py-2.5 text-sm leading-relaxed text-brand-text">
                          Prazo menor sobe a parcela e reduz os juros, nos dois sistemas.
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-brand-muted">{activeScenario.unavailableReason}</p>
                  )
                ) : null}
              </div>
            ) : null}

            {/* Tabela completa. */}
            <details
              className="mt-6 rounded-xl border border-brand-border"
              onToggle={(e) => {
                if ((e.currentTarget as HTMLDetailsElement).open) track("sac_price_schedule_open", { context });
              }}
            >
              <summary className="min-h-11 cursor-pointer px-4 py-3 font-semibold text-brand-navy">
                Ver a tabela completa de amortização
              </summary>
              <div className="border-t border-brand-border p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Segmented
                    label="Sistema da tabela"
                    value={tableSystem}
                    onChange={setTableSystem}
                    options={[
                      { value: "price", label: "Price" },
                      { value: "sac", label: "SAC" },
                    ]}
                  />
                  <Segmented
                    label="Detalhe da tabela"
                    value={tableView}
                    onChange={setTableView}
                    options={[
                      { value: "ano", label: "Por ano" },
                      { value: "mes", label: "Mês a mês" },
                    ]}
                  />
                </div>
                {tableRows ? (
                  <div className="mt-3 max-h-[32rem] overflow-auto rounded-lg border border-brand-border">
                    {tableView === "ano" ? (
                      <table className="w-full min-w-[32rem] border-collapse text-sm">
                        <caption className="sr-only">
                          Resumo por ano, sistema {tableSystem === "price" ? "Price" : "SAC"}
                        </caption>
                        <thead className="sticky top-0 bg-brand-surface-soft text-left">
                          <tr>
                            <th scope="col" className="px-3 py-2 font-semibold text-brand-navy">Ano</th>
                            <th scope="col" className="px-3 py-2 text-right font-semibold text-brand-navy">Pago no ano</th>
                            <th scope="col" className="px-3 py-2 text-right font-semibold text-brand-navy">Juros</th>
                            <th scope="col" className="px-3 py-2 text-right font-semibold text-brand-navy">Amortização</th>
                            <th scope="col" className="px-3 py-2 text-right font-semibold text-brand-navy">Saldo no fim</th>
                          </tr>
                        </thead>
                        <tbody className="tabular-nums">
                          {tableRows.yearly.map((y) => (
                            <tr key={y.year} className="border-t border-brand-border">
                              <th scope="row" className="px-3 py-1.5 text-left font-medium">
                                {y.year}º{" "}
                                <span className="text-xs text-brand-muted">
                                  ({y.firstMonth}–{y.lastMonth})
                                </span>
                              </th>
                              <td className="px-3 py-1.5 text-right">{brl(y.paidCents)}</td>
                              <td className="px-3 py-1.5 text-right">{brl(y.interestCents)}</td>
                              <td className="px-3 py-1.5 text-right">{brl(y.amortizationCents)}</td>
                              <td className="px-3 py-1.5 text-right">{brl(y.closingCents)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <table className="w-full min-w-[32rem] border-collapse text-sm">
                        <caption className="sr-only">
                          Tabela mês a mês, sistema {tableSystem === "price" ? "Price" : "SAC"}
                        </caption>
                        <thead className="sticky top-0 bg-brand-surface-soft text-left">
                          <tr>
                            <th scope="col" className="px-3 py-2 font-semibold text-brand-navy">Nº</th>
                            <th scope="col" className="px-3 py-2 text-right font-semibold text-brand-navy">Parcela</th>
                            <th scope="col" className="px-3 py-2 text-right font-semibold text-brand-navy">Juros</th>
                            <th scope="col" className="px-3 py-2 text-right font-semibold text-brand-navy">Amortização</th>
                            <th scope="col" className="px-3 py-2 text-right font-semibold text-brand-navy">Saldo</th>
                          </tr>
                        </thead>
                        <tbody className="tabular-nums">
                          {tableRows.schedule.slice(0, visibleRows).map((row) => (
                            <tr key={row.month} className="border-t border-brand-border">
                              <th scope="row" className="px-3 py-1.5 text-left font-medium">
                                {row.month}
                              </th>
                              <td className="px-3 py-1.5 text-right">{brl(row.paymentCents)}</td>
                              <td className="px-3 py-1.5 text-right">{brl(row.interestCents)}</td>
                              <td className="px-3 py-1.5 text-right">{brl(row.amortizationCents)}</td>
                              <td className="px-3 py-1.5 text-right">{brl(row.closingCents)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ) : null}
                {tableView === "mes" && tableRows && visibleRows < tableRows.schedule.length ? (
                  <div className="mt-3 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => setVisibleRows((v) => v + PAGE)}
                      className="min-h-11 rounded-lg border border-brand-border px-4 text-sm font-semibold text-brand-navy"
                    >
                      Mostrar mais {Math.min(PAGE, tableRows.schedule.length - visibleRows)} parcelas
                    </button>
                    <button
                      type="button"
                      onClick={() => setVisibleRows(tableRows.schedule.length)}
                      className="min-h-11 px-2 text-sm font-semibold text-brand-teal underline underline-offset-2"
                    >
                      Mostrar todas as {tableRows.schedule.length}
                    </button>
                  </div>
                ) : null}
                <p className="mt-2 text-xs leading-relaxed text-brand-muted">
                  Valores arredondados ao centavo. Juros do mês = saldo anterior × taxa mensal; a última
                  parcela, nos dois sistemas, acerta a diferença para o saldo terminar em zero.
                </p>
              </div>
            </details>

            {/* Imóvel e veículo: o que a conta não inclui. */}
            <div className="mt-6 space-y-3 text-sm leading-relaxed text-brand-text">
              <div className="rounded-xl border border-brand-border p-4">
                <Minor className="font-semibold text-brand-navy">Se for financiamento de imóvel</Minor>
                <p className="mt-1">
                  Contratos de imóvel costumam ter seguros e tarifas mensais e podem atualizar o saldo
                  devedor por um índice previsto no contrato, como a TR ou o IPCA. Nada disso está nesta
                  conta, que usa taxa fixa e saldo sem correção. Com índice de correção, as parcelas dos
                  dois sistemas mudam ao longo do tempo. Para partir do valor do imóvel e da entrada — ou da
                  parcela que cabe no seu mês —, use o{" "}
                  <Link href="/calculadoras/financiamento-imobiliario/" className="font-semibold text-brand-teal underline underline-offset-2">
                    Simulador de financiamento imobiliário
                  </Link>
                  .
                </p>
              </div>
              <div className="rounded-xl border border-brand-border p-4">
                <Minor className="font-semibold text-brand-navy">Se for financiamento de veículo</Minor>
                <p className="mt-1">
                  O financiamento de veículo costuma ser em parcelas fixas, o sistema Price. Para simular
                  com entrada, prazo e custos da proposta, use o{" "}
                  <Link href="/calculadoras/financiamento-veiculo/" className="font-semibold text-brand-teal underline underline-offset-2">
                    Simulador de financiamento de veículo
                  </Link>
                  .
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <button
                type="button"
                onClick={copySummary}
                className="min-h-11 rounded-lg border border-brand-border px-4 font-semibold text-brand-navy"
              >
                {copied === "ok" ? "Resumo copiado ✓" : "Copiar resumo"}
              </button>
              {canShare ? (
                <span>
                  <button
                    type="button"
                    onClick={share}
                    className="min-h-11 font-semibold text-brand-teal underline underline-offset-2"
                  >
                    Compartilhar a calculadora
                  </button>{" "}
                  <span className="text-brand-muted">— o link não leva os seus números.</span>
                </span>
              ) : null}
              <span role="status" className="text-brand-muted">
                {copied === "falhou" ? "Não foi possível copiar neste navegador." : ""}
              </span>
            </div>
          </div>
        ) : null}
      </div>

      <p className="mt-6 rounded-lg border border-brand-warning/30 bg-brand-warning-soft p-4 text-sm leading-relaxed text-brand-warning">
        Simulação educativa, com taxa fixa e sem correção do saldo. Não inclui seguros, tarifas nem IOF,
        e não é o CET. As parcelas reais dependem do contrato, da instituição e da análise de crédito.
      </p>
    </section>
  );
}
