"use client";

/**
 * SIMULADOR DE FINANCIAMENTO DE VEÍCULO
 * ============================================================================
 *
 * Um componente, dois lugares: a página da ferramenta e o artigo sobre
 * financiamento de veículo. A lógica de cálculo mora em
 * `lib/calculators/vehicle-financing.ts` — aqui só existe interface.
 *
 * DECISÕES QUE NÃO SÃO ÓBVIAS
 *
 * - Campos começam VAZIOS. Pré-preencher uma taxa ancora a pessoa num
 *   número que o site escolheu, e ela passa a achar que aquela é a "taxa
 *   normal". O exemplo existe, mas por botão e identificado como exemplo.
 *
 * - Os seletores R$/% e ao mês/ao ano REINTERPRETAM o número, não o
 *   convertem. O erro mais comum é digitar a taxa anual com "ao mês"
 *   marcado; converter ao trocar a unidade transformaria o erro em outro. A
 *   linha de equivalência logo abaixo mostra na hora o que o número vale.
 *
 * - Depois do primeiro cálculo, qualquer edição válida recalcula na hora. Se
 *   a edição deixa um campo inválido (a pessoa apagou o preço para digitar de
 *   novo), o último resultado válido continua na tela, marcado como
 *   desatualizado. Sumir e reaparecer a cada tecla faria a página pular.
 *
 * - A referência do Banco Central só aparece quando a página a recebe do
 *   servidor, com mês de referência. No artigo ela não vem: o artigo é
 *   estático, e uma taxa congelada no build seria taxa velha apresentada
 *   como atual.
 *
 * - Nada do que é digitado sai do navegador. Os eventos de analytics dizem
 *   COMO a ferramenta foi usada, nunca com quais valores.
 */

import Link from "next/link";
import { useId, useRef, useState, useSyncExternalStore } from "react";
import { track } from "@/lib/analytics/track";
import { formatBRL } from "@/lib/calculators/loan";
import { parseBRLToCents, parsePercentBR } from "@/lib/calculators/proposal-comparison";
import {
  buildWhatIfScenarios,
  compareTerms,
  simulateVehicleFinancing,
  toMonthlyRatePercent,
  type FieldIssue,
  type RateUnit,
  type VehicleField,
  type VehicleFinancingInput,
  type VehicleFinancingResult,
  type WhatIfId,
} from "@/lib/calculators/vehicle-financing";
import { useRevealResult } from "./use-reveal-result";

/** Referência oficial, montada no servidor a partir da série SGS 25471. */
export interface VehicleRateReference {
  monthlyRatePercent: number;
  /** "julho de 2026" */
  refMonthLabel: string;
  sourceUrl: string;
  seriesCode: number;
}

type Context = "ferramenta" | "artigo";
type DownMode = "brl" | "pct";

interface Fields {
  price: string;
  down: string;
  downMode: DownMode;
  rate: string;
  rateUnit: RateUnit;
  months: string;
  financedCosts: string;
  upfrontCosts: string;
}

const EMPTY: Fields = {
  price: "",
  down: "",
  downMode: "brl",
  rate: "",
  rateUnit: "am",
  months: "",
  financedCosts: "",
  upfrontCosts: "",
};

const TERM_CHIPS = [12, 24, 36, 48, 60] as const;

/* ---------- formatação (apresentação apenas) ---------- */

const brl = (v: number) => formatBRL(v);
const brlRound = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);
const pct = (v: number, digits = 2) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const moneyInput = (reais: number) =>
  reais.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function tidyMoney(raw: string): string {
  const cents = parseBRLToCents(raw);
  return cents === null ? raw : moneyInput(cents / 100);
}

/* ---------- campos de texto → entrada do motor ---------- */

function parseMoney(raw: string): number {
  if (raw.trim() === "") return Number.NaN;
  const cents = parseBRLToCents(raw);
  return cents === null ? Number.NaN : cents / 100;
}

function parseOptionalMoney(raw: string): number | undefined {
  if (raw.trim() === "") return undefined;
  return parseMoney(raw);
}

function resolveDown(f: Fields, price: number): number {
  if (f.down.trim() === "") return 0;
  if (f.downMode === "brl") return parseMoney(f.down);
  const share = parsePercentBR(f.down);
  if (share === null || !Number.isFinite(price)) return Number.NaN;
  return Math.round(price * share) / 100;
}

function toInput(f: Fields): VehicleFinancingInput {
  const vehiclePrice = parseMoney(f.price);
  const rate = parsePercentBR(f.rate);
  const months = /^\d+$/.test(f.months.trim()) ? Number(f.months.trim()) : Number.NaN;
  return {
    vehiclePrice,
    downPayment: resolveDown(f, vehiclePrice),
    ratePercent: rate === null ? Number.NaN : rate,
    rateUnit: f.rateUnit,
    months,
    financedCosts: parseOptionalMoney(f.financedCosts),
    upfrontCosts: parseOptionalMoney(f.upfrontCosts),
  };
}

/* ---------- peças de interface ---------- */

const inputClass =
  "min-h-12 w-full rounded-lg border border-brand-border bg-white px-3 py-2.5 text-base text-brand-text tabular-nums focus:border-brand-teal aria-[invalid=true]:border-brand-danger";

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

function Row({
  label,
  value,
  strong,
  note,
}: {
  label: string;
  value: string;
  strong?: boolean;
  note?: string;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 py-2.5 ${
        strong ? "border-t-2 border-brand-navy/20 pt-3" : "border-t border-brand-border"
      }`}
    >
      <dt className={`text-sm ${strong ? "font-bold text-brand-navy" : "text-brand-muted"}`}>
        {label}
        {note ? <span className="block text-xs font-normal text-brand-muted">{note}</span> : null}
      </dt>
      <dd
        className={`shrink-0 text-right tabular-nums ${
          strong ? "text-lg font-bold text-brand-navy" : "font-semibold text-brand-text"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

/** Onde cada real do desembolso vai. Barra única: um gráfico, uma pergunta. */
function MoneyBar({ r }: { r: VehicleFinancingResult }) {
  const vehiclePart = r.financedAmount - r.financedCosts;
  const costs = r.financedCosts + r.upfrontCosts;
  const segments = [
    { key: "entrada", label: "Entrada", value: r.downPayment, cls: "bg-brand-teal-soft border border-brand-navy/30" },
    { key: "veiculo", label: "Parte financiada do veículo", value: vehiclePart, cls: "bg-brand-navy" },
    { key: "juros", label: "Juros", value: r.totalInterest, cls: "bg-brand-gold" },
    { key: "custos", label: "Custos que você informou", value: costs, cls: "bg-brand-muted" },
  ].filter((s) => s.value > 0);
  const total = r.totalOutlay;
  const description = segments
    .map((s) => `${s.label}: ${brl(s.value)} (${pct((s.value / total) * 100, 0)}%)`)
    .join("; ");

  return (
    <figure className="mt-6">
      <figcaption className="font-serif text-base font-bold text-brand-navy">
        Para onde vai o seu dinheiro
      </figcaption>
      <div
        role="img"
        aria-label={`Composição do total desembolsado de ${brl(total)}. ${description}.`}
        className="mt-3 flex h-6 w-full overflow-hidden rounded-md"
      >
        {segments.map((s) => (
          <div key={s.key} className={s.cls} style={{ width: `${(s.value / total) * 100}%` }} />
        ))}
      </div>
      <ul className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2" aria-hidden="true">
        {segments.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <span className={`inline-block h-3 w-3 shrink-0 rounded-sm ${s.cls}`} />
            <span className="text-brand-muted">{s.label}</span>
            <span className="ml-auto font-semibold tabular-nums text-brand-text">
              {pct((s.value / total) * 100, 0)}%
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

function Delta({ before, after, lowerIsBetter = true }: { before: number; after: number; lowerIsBetter?: boolean }) {
  const diff = after - before;
  if (Math.abs(diff) < 0.005) return <span className="text-brand-muted">sem mudança</span>;
  const up = diff > 0;
  const tone = up === lowerIsBetter ? "text-brand-warning" : "text-brand-success";
  return (
    <span className={`font-semibold ${tone}`}>
      {up ? "+" : "−"}
      {brl(Math.abs(diff))}
    </span>
  );
}

/* Web Share: existe no navegador? Lido sem efeito, para não divergir da hidratação. */
const subscribeNoop = () => () => {};
const canShareSnapshot = () => typeof navigator !== "undefined" && typeof navigator.share === "function";
const canShareServer = () => false;

/* ---------- componente ---------- */

export function VehicleFinancingSimulator({
  reference,
  context = "ferramenta",
}: {
  reference?: VehicleRateReference | null;
  context?: Context;
}) {
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;

  const [fields, setFields] = useState<Fields>(EMPTY);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<FieldIssue[]>([]);
  const [warnings, setWarnings] = useState<FieldIssue[]>([]);
  const [shown, setShown] = useState<{ result: VehicleFinancingResult; input: VehicleFinancingInput } | null>(null);
  const [nothingToFinance, setNothingToFinance] = useState(false);
  const [stale, setStale] = useState(false);
  const [exampleActive, setExampleActive] = useState(false);
  const [scenario, setScenario] = useState<WhatIfId>("entrada-10000");
  const [scheduleView, setScheduleView] = useState<"ano" | "mes">("ano");

  const started = useRef(false);
  const exampleEverUsed = useRef(false);
  const advancedUsed = useRef(false);

  const canShare = useSyncExternalStore(subscribeNoop, canShareSnapshot, canShareServer);
  const { ref: resultRef, reveal } = useRevealResult();

  /** Calcula e aplica. Chamado por evento, nunca por efeito. */
  function run(next: Fields, { announce }: { announce: boolean }) {
    const input = toInput(next);
    const outcome = simulateVehicleFinancing(input);
    if (outcome.kind === "invalid") {
      setErrors(outcome.errors);
      setWarnings([]);
      setStale(shown !== null);
      return false;
    }
    setErrors([]);
    setWarnings(outcome.warnings);
    setStale(false);
    if (outcome.kind === "nothing-to-finance") {
      setNothingToFinance(true);
      setShown(null);
    } else {
      setNothingToFinance(false);
      setShown({ result: outcome.result, input });
    }
    if (announce) {
      track("vehicle_finance_complete", {
        context,
        rate_unit: next.rateUnit === "am" ? "mensal" : "anual",
        down_mode: next.downMode === "brl" ? "reais" : "percentual",
        advanced_used: advancedUsed.current,
        example_used: exampleEverUsed.current,
        reference_shown: Boolean(reference),
      });
    }
    return true;
  }

  function update(patch: Partial<Fields>) {
    if (!started.current) {
      started.current = true;
      track("vehicle_finance_start", { context });
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
      price: moneyInput(80_000),
      down: moneyInput(20_000),
      months: "48",
      rate: reference ? pct(reference.monthlyRatePercent) : "1,80",
      rateUnit: "am",
    };
    setFields(next);
    setExampleActive(true);
    setSubmitted(true);
    run(next, { announce: true });
    reveal();
  }

  function applyReference() {
    if (!reference) return;
    track("vehicle_finance_reference_use", { context });
    update({ rate: pct(reference.monthlyRatePercent), rateUnit: "am" });
  }

  async function share() {
    track("vehicle_finance_share", { context });
    try {
      await navigator.share({
        title: "Simulador de financiamento de veículo",
        text: "Simule a parcela, os juros e o total pago de um financiamento de veículo. Grátis e sem cadastro.",
        url: `${window.location.origin}/calculadoras/financiamento-veiculo/`,
      });
    } catch {
      /* A pessoa cancelou o compartilhamento: nada a fazer. */
    }
  }

  const errorOf = (field: VehicleField) => errors.find((e) => e.field === field)?.message;
  const warningOf = (field: VehicleField) => warnings.find((w) => w.field === field)?.message;
  const described = (name: string, field: VehicleField, withHint = true) =>
    [withHint ? `${id(name)}-hint` : null, errorOf(field) ? `${id(name)}-erro` : null]
      .filter(Boolean)
      .join(" ") || undefined;

  /* Linhas de equivalência, calculadas do que está digitado agora. */
  const live = toInput(fields);
  const downEcho = (() => {
    if (fields.down.trim() === "" || !Number.isFinite(live.vehiclePrice) || live.vehiclePrice <= 0) return null;
    if (!Number.isFinite(live.downPayment)) return null;
    return fields.downMode === "brl"
      ? `${pct((live.downPayment / live.vehiclePrice) * 100, 1)}% do valor do veículo`
      : `${brl(live.downPayment)} de entrada`;
  })();
  const rateEcho = (() => {
    if (!Number.isFinite(live.ratePercent) || live.ratePercent < 0) return null;
    const monthly = toMonthlyRatePercent(live.ratePercent, live.rateUnit);
    const annual = (Math.pow(1 + monthly / 100, 12) - 1) * 100;
    return live.rateUnit === "am"
      ? `equivale a ${pct(annual)}% ao ano`
      : `equivale a ${pct(monthly)}% ao mês`;
  })();

  /* Na página, o resultado é seção de primeiro nível (h2, sob o h1). No artigo,
     o simulador vive dentro de "Simule antes de assinar" (h3): os títulos
     descem dois níveis para o esboço do documento não regredir. */
  const Title = context === "artigo" ? "h4" : "h2";
  const Sub = context === "artigo" ? "h5" : "h3";

  const r = shown?.result ?? null;
  const scenarios = shown ? buildWhatIfScenarios(shown.input) : [];
  const active = scenarios.find((s) => s.id === scenario) ?? scenarios[0];
  const terms = shown ? compareTerms(shown.input) : [];

  return (
    <section
      aria-label="Simulador de financiamento de veículo"
      className="rounded-2xl border border-brand-border bg-white p-4 shadow-sm sm:p-6"
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="grid gap-5 sm:grid-cols-2">
          <FieldShell
            id={id("preco")}
            label="Valor do veículo"
            hint="Preço do carro ou da moto, em reais"
            error={errorOf("vehiclePrice")}
          >
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-sm text-brand-muted" aria-hidden="true">R$</span>
              <input
                id={id("preco")}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="ex.: 80.000"
                value={fields.price}
                onChange={(e) => update({ price: e.target.value })}
                onBlur={() => setFields((f) => ({ ...f, price: tidyMoney(f.price) }))}
                aria-invalid={Boolean(errorOf("vehiclePrice"))}
                aria-describedby={described("preco", "vehiclePrice")}
                className={inputClass}
              />
            </div>
          </FieldShell>

          <FieldShell
            id={id("entrada")}
            label="Entrada"
            hint="Em reais ou em porcentagem do valor. Sem entrada, deixe vazio."
            error={errorOf("downPayment")}
            note={downEcho ? <span aria-live="polite">{downEcho}</span> : null}
          >
            <div className="flex items-center gap-2">
              <input
                id={id("entrada")}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder={fields.downMode === "brl" ? "ex.: 20.000" : "ex.: 25"}
                value={fields.down}
                onChange={(e) => update({ down: e.target.value })}
                onBlur={() =>
                  setFields((f) => (f.downMode === "brl" ? { ...f, down: tidyMoney(f.down) } : f))
                }
                aria-invalid={Boolean(errorOf("downPayment"))}
                aria-describedby={described("entrada", "downPayment")}
                className={inputClass}
              />
              <Segmented
                label="Unidade da entrada"
                value={fields.downMode}
                onChange={(downMode) => update({ downMode })}
                options={[
                  { value: "brl", label: "R$" },
                  { value: "pct", label: "%" },
                ]}
              />
            </div>
          </FieldShell>

          <FieldShell
            id={id("taxa")}
            label="Taxa de juros"
            hint="A que está na proposta. Confira se ela é ao mês ou ao ano."
            error={errorOf("ratePercent")}
            note={
              <>
                {warningOf("ratePercent") ? (
                  <p className="font-medium text-brand-warning">{warningOf("ratePercent")}</p>
                ) : null}
                {rateEcho ? <p aria-live="polite">{rateEcho}</p> : null}
                {reference ? (
                  <p className="mt-1">
                    Ainda sem proposta?{" "}
                    <button
                      type="button"
                      onClick={applyReference}
                      className="font-semibold text-brand-teal underline underline-offset-2"
                    >
                      Usar a taxa média do Banco Central ({pct(reference.monthlyRatePercent)}% ao mês,{" "}
                      {reference.refMonthLabel})
                    </button>
                  </p>
                ) : null}
              </>
            }
          >
            <div className="flex items-center gap-2">
              <input
                id={id("taxa")}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder={fields.rateUnit === "am" ? "ex.: 1,80" : "ex.: 23,87"}
                value={fields.rate}
                onChange={(e) => update({ rate: e.target.value })}
                aria-invalid={Boolean(errorOf("ratePercent"))}
                aria-describedby={described("taxa", "ratePercent")}
                className={inputClass}
              />
              <span className="shrink-0 text-sm text-brand-muted" aria-hidden="true">%</span>
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
            hint="Número de parcelas mensais"
            error={errorOf("months")}
            note={
              <div role="group" aria-label="Prazos comuns" className="flex flex-wrap gap-1.5">
                {TERM_CHIPS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={fields.months.trim() === String(m)}
                    onClick={() => update({ months: String(m) })}
                    className="min-h-10 rounded-full border border-brand-border px-3 text-sm font-medium text-brand-navy aria-pressed:border-brand-navy aria-pressed:bg-brand-navy aria-pressed:text-white"
                  >
                    {m}x
                  </button>
                ))}
              </div>
            }
          >
            <div className="flex items-center gap-2">
              <input
                id={id("prazo")}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="ex.: 48"
                value={fields.months}
                onChange={(e) => update({ months: e.target.value.replace(/\D/g, "") })}
                aria-invalid={Boolean(errorOf("months"))}
                aria-describedby={described("prazo", "months")}
                className={inputClass}
              />
              <span className="shrink-0 text-sm text-brand-muted" aria-hidden="true">meses</span>
            </div>
          </FieldShell>
        </div>

        <details
          className="mt-5 rounded-lg border border-brand-border"
          onToggle={(e) => {
            if ((e.currentTarget as HTMLDetailsElement).open) {
              advancedUsed.current = true;
              track("vehicle_finance_advanced_open", { context });
            }
          }}
        >
          <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-semibold text-brand-navy">
            Incluir custos que você já conhece (opcional)
          </summary>
          <div className="grid gap-5 border-t border-brand-border p-4 sm:grid-cols-2">
            <FieldShell
              id={id("custos-fin")}
              label="Custos incluídos no financiamento"
              hint="Tarifas ou serviços que a proposta soma ao valor financiado. Eles viram parcela e pagam juros. Só preencha se a proposta informar."
              error={errorOf("financedCosts")}
            >
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-sm text-brand-muted" aria-hidden="true">R$</span>
                <input
                  id={id("custos-fin")}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0,00"
                  value={fields.financedCosts}
                  onChange={(e) => update({ financedCosts: e.target.value })}
                  onBlur={() => setFields((f) => ({ ...f, financedCosts: tidyMoney(f.financedCosts) }))}
                  aria-invalid={Boolean(errorOf("financedCosts"))}
                  aria-describedby={described("custos-fin", "financedCosts")}
                  className={inputClass}
                />
              </div>
            </FieldShell>
            <FieldShell
              id={id("custos-vista")}
              label="Custos pagos à parte"
              hint="Valores pagos na assinatura, fora das parcelas. Não pagam juros, mas saem do seu bolso."
              error={errorOf("upfrontCosts")}
            >
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-sm text-brand-muted" aria-hidden="true">R$</span>
                <input
                  id={id("custos-vista")}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0,00"
                  value={fields.upfrontCosts}
                  onChange={(e) => update({ upfrontCosts: e.target.value })}
                  onBlur={() => setFields((f) => ({ ...f, upfrontCosts: tidyMoney(f.upfrontCosts) }))}
                  aria-invalid={Boolean(errorOf("upfrontCosts"))}
                  aria-describedby={described("custos-vista", "upfrontCosts")}
                  className={inputClass}
                />
              </div>
            </FieldShell>
            <p className="text-xs leading-relaxed text-brand-muted sm:col-span-2">
              O simulador não acrescenta tarifa, seguro nem IOF por conta própria: ele não conhece o
              contrato. Esses valores aparecem no CET que a instituição é obrigada a informar.
            </p>
          </div>
        </details>

        {errors.length > 0 ? (
          <p role="alert" className="mt-4 rounded-lg border border-brand-danger/40 bg-brand-danger-soft p-3 text-sm text-brand-danger">
            {errors.length === 1
              ? "Um campo precisa de ajuste — ele está destacado acima."
              : `${errors.length} campos precisam de ajuste — eles estão destacados acima.`}
          </p>
        ) : null}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="submit"
            className="min-h-12 w-full rounded-lg bg-brand-teal-dark px-6 font-semibold text-white hover:bg-brand-teal sm:w-auto"
          >
            Calcular financiamento
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

      {/* Anúncio curto para leitores de tela: só o essencial, não a página inteira. */}
      <p className="sr-only" aria-live="polite">
        {r && !stale
          ? `Parcela estimada de ${brl(r.payment)} por mês em ${r.months} meses. Total desembolsado de ${brl(r.totalOutlay)}.`
          : nothingToFinance
            ? "Com essa entrada não há saldo a financiar."
            : ""}
      </p>

      <div ref={resultRef} className="scroll-mt-24">
        {nothingToFinance ? (
          <div className="mt-6 rounded-xl border border-brand-border bg-brand-surface-soft p-5">
            <Title tabIndex={-1} data-result-heading className="font-serif text-xl font-bold text-brand-navy">
              Não sobra nada para financiar
            </Title>
            <p className="mt-2 text-brand-text">
              Com essa entrada, o veículo sai pago à vista: não há saldo, parcela nem juros. Se a
              ideia é financiar uma parte, diminua a entrada.
            </p>
          </div>
        ) : null}

        {r ? (
          <div className={`mt-6 border-t border-brand-border pt-6 ${stale ? "opacity-60" : ""}`}>
            {exampleActive ? (
              <p className="mb-4 rounded-lg bg-brand-gold-soft px-3 py-2 text-sm text-brand-gold-dark">
                Você está vendo um <strong>exemplo</strong>: veículo de R$ 80 mil, R$ 20 mil de entrada,
                48 meses e taxa{" "}
                {reference
                  ? `igual à média do Banco Central em ${reference.refMonthLabel}`
                  : "ilustrativa de 1,80% ao mês"}
                . Troque pelos números da sua proposta.
              </p>
            ) : null}
            {stale ? (
              <p className="mb-4 text-sm font-medium text-brand-warning">
                Resultado da última simulação válida. Ajuste o campo destacado para atualizar.
              </p>
            ) : null}

            <div className="rounded-xl bg-brand-teal-soft p-5">
              <Title
                tabIndex={-1}
                data-result-heading
                className="text-xs font-semibold uppercase tracking-wide text-brand-teal-dark"
              >
                Sua parcela estimada
              </Title>
              <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5 font-serif text-3xl font-bold text-brand-navy tabular-nums sm:text-4xl">
                <span>{brl(r.payment)}</span>
                <span className="text-lg font-semibold text-brand-muted">/mês</span>
              </p>
              <p className="mt-1.5 text-sm text-brand-muted">
                {r.months} parcelas · {pct(r.monthlyRatePercent)}% ao mês ({pct(r.annualRatePercent)}% ao ano)
                {Math.abs(r.lastPayment - r.payment) >= 0.01
                  ? ` · a última, de ${brl(r.lastPayment)}, acerta os centavos`
                  : ""}
              </p>
              <p className="mt-3 text-sm">
                <Link href="/calculadoras/parcela-no-orcamento/" className="font-semibold text-brand-teal underline underline-offset-2">
                  Essa parcela cabe no seu mês? Testar no orçamento
                </Link>
              </p>
            </div>

            <dl className="mt-5">
              <Row label="Valor do veículo" value={brl(r.vehiclePrice)} />
              <Row
                label="Entrada"
                value={brl(r.downPayment)}
                note={r.downPayment > 0 ? `${pct(r.downPaymentShare * 100, 1)}% do valor` : "sem entrada"}
              />
              {r.financedCosts > 0 ? (
                <Row label="Custos incluídos no financiamento" value={brl(r.financedCosts)} note="somados ao valor financiado" />
              ) : null}
              <Row label="Valor financiado" value={brl(r.financedAmount)} />
              <Row label="Juros estimados" value={brl(r.totalInterest)} />
              <Row label="Total das parcelas" value={brl(r.totalInstallments)} />
              {r.upfrontCosts > 0 ? (
                <Row label="Custos pagos à parte" value={brl(r.upfrontCosts)} note="fora das parcelas" />
              ) : null}
              <Row
                label="Total desembolsado"
                value={brl(r.totalOutlay)}
                strong
                note="entrada + parcelas + custos à parte"
              />
            </dl>

            {/* O bloco didático: porcentagem vira dinheiro. */}
            <div className="mt-6 overflow-hidden rounded-xl border border-brand-border">
              <div className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">O número que aparece</p>
                <p className="mt-1 font-serif text-2xl font-bold text-brand-navy tabular-nums">{brlRound(r.payment)}/mês</p>
              </div>
              <div className="border-t border-brand-border bg-brand-gold-soft p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-gold-dark">
                  O número que quase ninguém olha
                </p>
                <p className="mt-1 font-serif text-2xl font-bold text-brand-navy tabular-nums">
                  {brlRound(r.totalInstallments)} nas parcelas
                </p>
              </div>
              <div className="border-t border-brand-border p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">
                  Quanto os juros acrescentaram
                </p>
                <p className="mt-1 font-serif text-2xl font-bold text-brand-navy tabular-nums">
                  {brlRound(r.totalInterest)}
                </p>
                <p className="mt-1 text-sm text-brand-muted">
                  {r.financedAmount > 0
                    ? `Para cada R$ 100 financiados, R$ ${pct((r.totalInstallments / r.financedAmount) * 100, 0)} voltam ao credor.`
                    : null}
                </p>
              </div>
            </div>

            <MoneyBar r={r} />

            {/* Referência oficial — factual, sem veredito. */}
            <div className="mt-6 rounded-xl border border-brand-border p-4">
              <Sub className="font-serif text-base font-bold text-brand-navy">Como sua taxa se compara</Sub>
              {reference ? (
                <>
                  <dl className="mt-3">
                    <Row label="Sua simulação" value={`${pct(r.monthlyRatePercent)}% ao mês`} />
                    <Row
                      label="Média do Banco Central"
                      value={`${pct(reference.monthlyRatePercent)}% ao mês`}
                      note={`aquisição de veículos, pessoas físicas · ${reference.refMonthLabel}`}
                    />
                  </dl>
                  <p className="mt-3 text-sm leading-relaxed text-brand-text">
                    {(() => {
                      const diff = r.monthlyRatePercent - reference.monthlyRatePercent;
                      if (Math.abs(diff) < 0.005) return "A taxa simulada é igual à média desse mês.";
                      return `A taxa simulada está ${pct(Math.abs(diff))} ponto percentual ${
                        diff > 0 ? "acima" : "abaixo"
                      } da média desse mês.`;
                    })()}{" "}
                    A média reúne contratos de perfis, entradas, prazos, veículos e instituições
                    diferentes; a taxa de cada pessoa depende da análise de crédito. A diferença é um
                    ponto de partida para perguntar, não um veredito.
                  </p>
                  <p className="mt-2 text-xs text-brand-muted">
                    Fonte:{" "}
                    <a href={reference.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                      Banco Central do Brasil, série {reference.seriesCode}
                    </a>
                    .{" "}
                    <Link href="/calculadoras/minha-taxa-esta-cara/" className="font-semibold text-brand-teal underline underline-offset-2">
                      Ver a comparação completa em Minha taxa está cara?
                    </Link>
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm leading-relaxed text-brand-text">
                  O Banco Central publica todo mês a taxa média de financiamento de veículos para
                  pessoas físicas.{" "}
                  <Link href="/taxas/" className="font-semibold text-brand-teal underline underline-offset-2">
                    Ver a média mais recente no Radar de taxas
                  </Link>
                  .
                </p>
              )}
            </div>

            {/* E se? — consequência, não conselho. */}
            <div className="mt-6">
              <Sub className="font-serif text-lg font-bold text-brand-navy">Veja o que muda</Sub>
              <div role="group" aria-label="Cenários para comparar" className="mt-3 flex flex-wrap gap-2">
                {scenarios.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={active?.id === s.id}
                    onClick={() => {
                      setScenario(s.id);
                      track("vehicle_finance_whatif_select", { context, scenario: s.id });
                    }}
                    className="min-h-11 rounded-lg border border-brand-border px-3 text-left text-sm font-medium text-brand-navy aria-pressed:border-brand-navy aria-pressed:bg-brand-navy aria-pressed:text-white"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              {active ? (
                active.result ? (
                  /* Linhas empilhadas, não tabela: numa tela de 320px a tabela de
                     quatro colunas escondia justamente o cenário e a diferença. */
                  <div className="mt-4 rounded-xl border border-brand-border">
                    <dl className="divide-y divide-brand-border">
                      {[
                        { label: "Parcela", a: r.payment, b: active.result.payment },
                        { label: "Juros", a: r.totalInterest, b: active.result.totalInterest },
                        { label: "Total desembolsado", a: r.totalOutlay, b: active.result.totalOutlay },
                      ].map((row) => (
                        <div key={row.label} className="px-3 py-2.5">
                          <dt className="text-sm font-medium text-brand-text">{row.label}</dt>
                          <dd className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-sm tabular-nums">
                            <span className="text-brand-muted">
                              <span className="sr-only">agora, </span>
                              {brl(row.a)}
                            </span>
                            <span aria-hidden="true" className="text-brand-muted">→</span>
                            <span className="font-semibold text-brand-navy">
                              <span className="sr-only">no cenário, </span>
                              {brl(row.b)}
                            </span>
                            <span className="ml-auto">
                              <span className="sr-only">diferença: </span>
                              <Delta before={row.a} after={row.b} />
                            </span>
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <p className="border-t border-brand-border px-3 py-2.5 text-sm leading-relaxed text-brand-text">
                      {(() => {
                        const saved = r.totalInterest - active.result.totalInterest;
                        const verb = saved >= 0 ? "cairiam" : "subiriam";
                        // Minúscula só em palavra ("Taxa" → "taxa"); "R$ 10 mil" fica como está.
                        const phrase = /^\p{Lu}\p{Ll}/u.test(active.label)
                          ? active.label.charAt(0).toLowerCase() + active.label.slice(1)
                          : active.label;
                        return `Nesta simulação, com ${phrase}, os juros ${verb} ${brl(Math.abs(saved))}.`;
                      })()}
                      {active.id.startsWith("entrada")
                        ? " O total desembolsado cai exatamente o mesmo valor: o dinheiro da entrada sai do seu bolso de qualquer jeito — agora ou dentro das parcelas —, e o que muda é só o quanto dele paga juros."
                        : ""}
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-brand-muted">{active.unavailableReason}</p>
                )
              ) : null}
            </div>

            {/* Parcela menor, juros maiores — os números dizem sozinhos. */}
            {terms.length > 1 ? (
              <div className="mt-6">
                <Sub className="font-serif text-lg font-bold text-brand-navy">Mesmo veículo, prazos diferentes</Sub>
                <p className="mt-1 text-sm text-brand-muted">
                  Mesma taxa e mesma entrada. Só o número de parcelas muda.
                </p>
                {/* Celular: um cartão por prazo, sem rolagem lateral. */}
                <ul className="mt-3 divide-y divide-brand-border rounded-xl border border-brand-border sm:hidden">
                  {terms.map((t) => (
                    <li key={t.months} className={`px-3 py-2.5 ${t.current ? "bg-brand-teal-soft" : ""}`}>
                      <p className="text-sm font-semibold text-brand-navy">
                        {t.months} meses
                        {t.current ? <span className="font-normal text-brand-teal-dark"> · a sua simulação</span> : null}
                      </p>
                      <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-sm tabular-nums">
                        <div>
                          <dt className="text-xs text-brand-muted">Parcela</dt>
                          <dd className="font-semibold text-brand-text">{brl(t.result.payment)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-brand-muted">Juros</dt>
                          <dd className="font-semibold text-brand-text">{brl(t.result.totalInterest)}</dd>
                        </div>
                        <div className="col-span-2 flex items-baseline justify-between gap-2">
                          <dt className="text-xs text-brand-muted">Total desembolsado</dt>
                          <dd className="text-brand-text">{brl(t.result.totalOutlay)}</dd>
                        </div>
                      </dl>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 hidden overflow-x-auto rounded-xl border border-brand-border sm:block">
                  <table className="w-full min-w-[22rem] border-collapse text-sm">
                    <caption className="sr-only">Parcela, juros e total desembolsado em cada prazo</caption>
                    <thead className="bg-brand-surface-soft text-left">
                      <tr>
                        <th scope="col" className="px-3 py-2 font-semibold text-brand-navy">Prazo</th>
                        <th scope="col" className="px-3 py-2 text-right font-semibold text-brand-navy">Parcela</th>
                        <th scope="col" className="px-3 py-2 text-right font-semibold text-brand-navy">Juros</th>
                        <th scope="col" className="px-3 py-2 text-right font-semibold text-brand-navy">Total desembolsado</th>
                      </tr>
                    </thead>
                    <tbody className="tabular-nums">
                      {terms.map((t) => (
                        <tr
                          key={t.months}
                          className={`border-t border-brand-border ${t.current ? "bg-brand-teal-soft font-semibold" : ""}`}
                          aria-current={t.current ? "true" : undefined}
                        >
                          <th scope="row" className="px-3 py-2 text-left font-medium">
                            {t.months} meses{t.current ? <span className="ml-1 text-xs text-brand-teal-dark">(a sua)</span> : null}
                          </th>
                          <td className="px-3 py-2 text-right">{brl(t.result.payment)}</td>
                          <td className="px-3 py-2 text-right">{brl(t.result.totalInterest)}</td>
                          <td className="px-3 py-2 text-right">{brl(t.result.totalOutlay)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            <details
              className="mt-6 rounded-xl border border-brand-border"
              onToggle={(e) => {
                if ((e.currentTarget as HTMLDetailsElement).open) {
                  track("vehicle_finance_schedule_open", { context, view: scheduleView });
                }
              }}
            >
              <summary className="min-h-11 cursor-pointer px-4 py-3 font-semibold text-brand-navy">
                Ver evolução do financiamento
              </summary>
              <div className="border-t border-brand-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-brand-muted">
                    No começo, a maior parte da parcela é juro. No fim, quase tudo reduz a dívida.
                  </p>
                  <Segmented
                    label="Detalhe da tabela"
                    value={scheduleView}
                    onChange={setScheduleView}
                    options={[
                      { value: "ano", label: "Por ano" },
                      { value: "mes", label: "Mês a mês" },
                    ]}
                  />
                </div>
                <div className="mt-3 max-h-[28rem] overflow-auto rounded-lg border border-brand-border">
                  {scheduleView === "ano" ? (
                    <table className="w-full min-w-[30rem] border-collapse text-sm">
                      <caption className="sr-only">Resumo do financiamento por ano</caption>
                      <thead className="sticky top-0 bg-brand-surface-soft text-left">
                        <tr>
                          <th scope="col" className="px-3 py-2 font-semibold text-brand-navy">Ano</th>
                          <th scope="col" className="px-3 py-2 text-right font-semibold text-brand-navy">Pago no ano</th>
                          <th scope="col" className="px-3 py-2 text-right font-semibold text-brand-navy">Juros</th>
                          <th scope="col" className="px-3 py-2 text-right font-semibold text-brand-navy">Reduziu a dívida</th>
                          <th scope="col" className="px-3 py-2 text-right font-semibold text-brand-navy">Dívida no fim</th>
                        </tr>
                      </thead>
                      <tbody className="tabular-nums">
                        {r.yearly.map((y) => (
                          <tr key={y.year} className="border-t border-brand-border">
                            <th scope="row" className="px-3 py-1.5 text-left font-medium">
                              {y.year}º <span className="text-xs text-brand-muted">(parcelas {y.firstMonth}–{y.lastMonth})</span>
                            </th>
                            <td className="px-3 py-1.5 text-right">{brl(y.paid)}</td>
                            <td className="px-3 py-1.5 text-right">{brl(y.interest)}</td>
                            <td className="px-3 py-1.5 text-right">{brl(y.amortization)}</td>
                            <td className="px-3 py-1.5 text-right">{brl(y.closingBalance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <table className="w-full min-w-[38rem] border-collapse text-sm">
                      <caption className="sr-only">Tabela de amortização mês a mês</caption>
                      <thead className="sticky top-0 bg-brand-surface-soft text-left">
                        <tr>
                          <th scope="col" className="px-3 py-2 font-semibold text-brand-navy">Nº</th>
                          <th scope="col" className="px-3 py-2 text-right font-semibold text-brand-navy">Saldo inicial</th>
                          <th scope="col" className="px-3 py-2 text-right font-semibold text-brand-navy">Juros</th>
                          <th scope="col" className="px-3 py-2 text-right font-semibold text-brand-navy">Amortização</th>
                          <th scope="col" className="px-3 py-2 text-right font-semibold text-brand-navy">Parcela</th>
                          <th scope="col" className="px-3 py-2 text-right font-semibold text-brand-navy">Saldo final</th>
                        </tr>
                      </thead>
                      <tbody className="tabular-nums">
                        {r.schedule.map((row) => (
                          <tr key={row.month} className="border-t border-brand-border">
                            <th scope="row" className="px-3 py-1.5 text-left font-medium">{row.month}</th>
                            <td className="px-3 py-1.5 text-right">{brl(row.openingBalance)}</td>
                            <td className="px-3 py-1.5 text-right">{brl(row.interest)}</td>
                            <td className="px-3 py-1.5 text-right">{brl(row.amortization)}</td>
                            <td className="px-3 py-1.5 text-right">{brl(row.payment)}</td>
                            <td className="px-3 py-1.5 text-right">{brl(row.closingBalance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                <p className="mt-2 text-xs text-brand-muted">
                  Amortização é a parte da parcela que reduz a dívida. Valores arredondados ao centavo;
                  a última parcela acerta a diferença para o saldo terminar em zero.
                </p>
              </div>
            </details>

            <div className="mt-6 rounded-xl border border-brand-navy/20 bg-brand-teal-soft/50 p-4 text-sm leading-relaxed text-brand-text">
              <p>
                <strong>Isto não é o CET.</strong> O Custo Efetivo Total reúne os juros e todos os outros
                encargos da operação — tarifas, seguros e tributos — e a instituição é obrigada a
                informá-lo na proposta. É por ele, e não pela parcela, que duas ofertas se comparam.
              </p>
              <p className="mt-2">
                <Link href="/calculadoras/comparador-de-propostas/" className="font-semibold text-brand-teal underline underline-offset-2">
                  Já recebeu propostas? Compare o CET e o custo total lado a lado
                </Link>
              </p>
            </div>

            {canShare ? (
              <p className="mt-5 text-sm">
                <button
                  type="button"
                  onClick={share}
                  className="min-h-11 font-semibold text-brand-teal underline underline-offset-2"
                >
                  Compartilhar o simulador
                </button>{" "}
                <span className="text-brand-muted">— o link não leva os seus números.</span>
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <p className="mt-6 rounded-lg border border-brand-warning/30 bg-brand-warning-soft p-4 text-sm leading-relaxed text-brand-warning">
        Esta é uma simulação educativa, com prestações fixas (sistema Price). A parcela e o custo reais
        podem variar conforme CET, tarifas, seguros, instituição financeira, perfil de crédito e
        condições da proposta. Confira o CET antes de contratar.
      </p>
    </section>
  );
}
