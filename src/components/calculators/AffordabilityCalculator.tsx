"use client";

/**
 * QUANTO CONSIGO FINANCIAR?
 * ============================================================================
 *
 * Começa pela parcela ("quanto cabe no seu mês?"), não pelo valor do bem nem
 * pela renda. Primeira dobra: parcela, taxa, prazo e sistema, nada mais.
 * Entrada, objetivo, renda e cenários vêm depois do resultado (revelação
 * progressiva), uma variável por vez.
 *
 * O resultado sempre mostra JUNTOS o que a parcela financia e o que se paga
 * no total: a ferramenta não pode virar "descubra seu limite máximo".
 *
 * Campos começam vazios, inclusive a taxa: nenhuma taxa média entra
 * sozinha. Os exemplos da página preenchem com taxa HIPOTÉTICA, rotulada,
 * pelo evento de janela `cpp:simular-capacidade` — sem URL por valor.
 *
 * Nada do que é digitado sai do navegador; o analytics recebe só
 * categorias (sistema, unidade, tipo de bem), nunca valores.
 */

import Link from "next/link";
import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { track } from "@/lib/analytics/track";
import {
  analyzeGoal,
  applyScenario,
  buildAffordabilitySummary,
  calculateAffordability,
  incomeContext,
  MAX_AFFORD_MONTHS,
  RATE_STEP_PP,
  rateCurve,
  TERM_POINTS,
  TERM_STEPS,
  termCurve,
  type AffordabilityInput,
  type AffordabilityResult,
  type AffordField,
  type AffordIssue,
  type AmortizationSystem,
  type AssetType,
  type CurvePoint,
  type EntryInput,
  type GoalResult,
  type RateUnit,
  type ScenarioChange,
} from "@/lib/calculators/affordability";
import { monthsInWords } from "@/lib/calculators/home-financing";
import { parseBRLToCents, parsePercentBR } from "@/lib/calculators/proposal-comparison";
import { useRevealResult } from "./use-reveal-result";

export const AFFORDABILITY_PREFILL_EVENT = "cpp:simular-capacidade";

export interface AffordabilityPrefill {
  /** Id do exemplo, para analytics (nunca o valor). */
  exampleId: string;
  paymentCents: number;
  ratePercent: number;
  rateUnit: RateUnit;
  months: number;
  system: AmortizationSystem;
  /** Frase que a calculadora mostra sobre a premissa do exemplo. */
  premise: string;
}

type TermUnit = "meses" | "anos";
type EntryKind = "reais" | "percent";
type Context = "ferramenta" | "artigo";

interface Fields {
  payment: string;
  rate: string;
  rateUnit: RateUnit;
  term: string;
  termUnit: TermUnit;
  system: AmortizationSystem;
  entryKind: EntryKind;
  entry: string;
}

const EMPTY: Fields = {
  payment: "",
  rate: "",
  rateUnit: "am",
  term: "",
  termUnit: "meses",
  system: "price",
  entryKind: "reais",
  entry: "",
};

/* ---------- formatação ---------- */

const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const brlRound = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(cents / 100);
/** Taxa com 2 a 4 casas, sem zeros inúteis. */
const rateText = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
/** Teto de taxa: arredonda para BAIXO na 4ª casa, para não prometer um centésimo a mais. */
const rateFloor = (v: number) => rateText(Math.floor(v * 1e4) / 1e4);
const pct = (v: number, digits = 1) => v.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const moneyInput = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const unitShort = (u: RateUnit) => (u === "am" ? "a.m." : "a.a.");
const monthsLabel = (m: number) => `${m.toLocaleString("pt-BR")} ${m === 1 ? "mês" : "meses"}`;
const monthsFull = (m: number) => (m >= 12 ? `${monthsLabel(m)} (${monthsInWords(m)})` : monthsLabel(m));
const systemName = (s: AmortizationSystem) => (s === "price" ? "Price" : "SAC");

function parseMoney(raw: string): number {
  if (raw.trim() === "") return Number.NaN;
  const cents = parseBRLToCents(raw);
  return cents === null ? Number.NaN : cents;
}

function parseRate(raw: string): number {
  const t = raw.trim();
  if (t.startsWith("-")) {
    const v = parsePercentBR(t.slice(1));
    return v === null ? Number.NaN : -v;
  }
  return parsePercentBR(t) ?? Number.NaN;
}

/** Prazo em meses: anos podem ter vírgula desde que deem meses inteiros (2,5 anos = 30 meses). */
function parseTerm(raw: string, unit: TermUnit): number {
  const t = raw.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(t)) return Number.NaN;
  const v = Number(t);
  if (unit === "meses") return Number.isInteger(v) ? v : Number.NaN;
  const months = v * 12;
  return Math.abs(months - Math.round(months)) < 1e-9 ? Math.round(months) : Number.NaN;
}

function tidyMoney(raw: string): string {
  const cents = parseBRLToCents(raw);
  return cents === null ? raw : moneyInput(cents);
}

function entryOf(f: Fields): EntryInput | null | "invalido" {
  if (f.entry.trim() === "") return null;
  if (f.entryKind === "reais") {
    const c = parseMoney(f.entry);
    return Number.isFinite(c) ? { kind: "reais", cents: c } : "invalido";
  }
  const p = parseRate(f.entry);
  return Number.isFinite(p) ? { kind: "percent", percent: p } : "invalido";
}

function inputOf(f: Fields): { input: AffordabilityInput; entryInvalid: boolean } {
  const entry = entryOf(f);
  return {
    input: {
      paymentCents: parseMoney(f.payment),
      ratePercent: parseRate(f.rate),
      rateUnit: f.rateUnit,
      months: parseTerm(f.term, f.termUnit),
      entry: entry === "invalido" ? null : entry,
    },
    entryInvalid: entry === "invalido",
  };
}

/* ---------- peças ---------- */

const inputClass =
  "min-h-12 w-full min-w-0 rounded-lg border border-brand-border bg-white px-3 py-2.5 text-base text-brand-text tabular-nums focus:border-brand-teal aria-[invalid=true]:border-brand-danger";

const PRINCIPAL_BAR = "bg-brand-navy";
const INTEREST_BAR = "bg-brand-gold";

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  wide,
}: {
  label: string;
  value: T | null;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (v: T) => void;
  wide?: boolean;
}) {
  return (
    <div role="group" aria-label={label} className={`flex rounded-lg border border-brand-border p-0.5 ${wide ? "w-full" : "shrink-0"}`}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-11 rounded-md px-3 text-sm font-semibold text-brand-muted aria-pressed:bg-brand-navy aria-pressed:text-white ${wide ? "flex-1" : ""}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  warning,
  echo,
  children,
}: {
  id: string;
  label: string;
  hint?: React.ReactNode;
  error?: string;
  warning?: string;
  echo?: string | null;
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
      {!error && warning ? <p className="mt-1.5 rounded-md bg-brand-warning-soft px-2 py-1 text-sm text-brand-text">{warning}</p> : null}
      {!error && echo ? <p className="mt-1 text-xs text-brand-muted">{echo}</p> : null}
    </div>
  );
}

/** Barra de duas partes: valor financiado e juros; a soma é o total pago. */
function StackBar({ financed, interest, max }: { financed: number; interest: number; max: number }) {
  const w = (v: number) => `${max > 0 ? Math.max(0, (v / max) * 100) : 0}%`;
  return (
    <div className="flex h-3 w-full overflow-hidden rounded-full bg-brand-surface-soft" aria-hidden="true">
      <span className={PRINCIPAL_BAR} style={{ width: w(financed) }} />
      <span className={INTEREST_BAR} style={{ width: w(interest) }} />
    </div>
  );
}

function BarLegend() {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-brand-muted" aria-hidden="true">
      <li className="flex items-center gap-1.5">
        <span className={`inline-block h-2.5 w-4 rounded-sm ${PRINCIPAL_BAR}`} /> Valor financiável
      </li>
      <li className="flex items-center gap-1.5">
        <span className={`inline-block h-2.5 w-4 rounded-sm ${INTEREST_BAR}`} /> Juros estimados
      </li>
    </ul>
  );
}

/** "Gráfico" em lista: cada linha tem o número por escrito; a barra só ilustra. */
function CurveList({ caption, points, label }: { caption: string; points: CurvePoint[]; label: (p: CurvePoint) => string }) {
  const max = Math.max(...points.map((p) => p.totalPaidCents), 1);
  return (
    <ul aria-label={caption} className="mt-2 space-y-2.5">
      {points.map((p) => (
        <li key={`${p.months}-${p.ratePercent}`} className={`rounded-lg px-2 py-1.5 ${p.current ? "bg-brand-teal-soft" : ""}`}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
            <span className="font-semibold text-brand-navy">
              {label(p)}
              {p.current ? <span className="font-normal text-brand-teal-dark"> · a sua simulação</span> : null}
            </span>
            <span className="tabular-nums text-brand-text">
              financia <strong>{brlRound(p.financedCents)}</strong>
            </span>
          </div>
          <div className="mt-1">
            <StackBar financed={p.financedCents} interest={p.totalInterestCents} max={max} />
          </div>
          <p className="mt-0.5 text-xs tabular-nums text-brand-muted">
            juros {brlRound(p.totalInterestCents)} · total pago {brlRound(p.totalPaidCents)}
          </p>
        </li>
      ))}
    </ul>
  );
}

function Before({ label, before, after }: { label: string; before: string; after: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 border-t border-brand-border py-1.5 text-sm first:border-t-0">
      <dt className="text-brand-muted">{label}</dt>
      <dd className="tabular-nums text-brand-text">
        {before} <span aria-hidden="true">→</span>
        <span className="sr-only"> passa para </span> <strong>{after}</strong>
      </dd>
    </div>
  );
}

/**
 * Botão dos exemplos da página: preenche a calculadora sem sair da página.
 * Renderizado dentro do HTML do servidor, como ilha cliente.
 */
export function SimulateAffordabilityButton({ label, detail }: { label: string; detail: AffordabilityPrefill }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent<AffordabilityPrefill>(AFFORDABILITY_PREFILL_EVENT, { detail }))}
      className="not-prose mt-3 inline-flex min-h-11 items-center rounded-lg border border-brand-navy px-4 text-sm font-semibold text-brand-navy hover:bg-brand-teal-soft"
    >
      {label}
    </button>
  );
}

/* ---------- componente ---------- */

interface Shown {
  result: AffordabilityResult;
  input: AffordabilityInput;
  termUnit: TermUnit;
}

const ASSETS: ReadonlyArray<{ value: AssetType; label: string }> = [
  { value: "imovel", label: "Imóvel" },
  { value: "veiculo", label: "Veículo" },
  { value: "outro", label: "Outro" },
];

const PAYMENT_STEPS = [25_000, 50_000, 100_000] as const;
const RATE_STEPS = [0.25, 0.5, 1] as const;

export function AffordabilityCalculator({ context = "ferramenta" }: { context?: Context }) {
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;

  const [fields, setFields] = useState<Fields>(EMPTY);
  const [asset, setAsset] = useState<AssetType | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<AffordIssue[]>([]);
  const [warnings, setWarnings] = useState<AffordIssue[]>([]);
  const [shown, setShown] = useState<Shown | null>(null);
  const [stale, setStale] = useState(false);
  const [premise, setPremise] = useState<string | null>(null);
  const [scenario, setScenario] = useState<ScenarioChange | null>(null);
  const [goal, setGoal] = useState("");
  const [income, setIncome] = useState("");
  const [other, setOther] = useState("");
  const [copied, setCopied] = useState<"ok" | "falhou" | null>(null);

  const exampleUsed = useRef(false);
  const entryTracked = useRef<EntryKind | null>(null);
  const rootRef = useRef<HTMLElement | null>(null);
  const { ref: resultRef, reveal } = useRevealResult();

  useEffect(() => {
    track("affordability_financing_view", { context });
  }, [context]);

  function compute(next: Fields, { announce }: { announce: boolean }) {
    const { input, entryInvalid } = inputOf(next);
    const outcome = calculateAffordability(input);
    const entryError: AffordIssue[] = entryInvalid
      ? [{ field: "entry", message: next.entryKind === "reais" ? "Informe a entrada em reais, ou deixe vazio." : "Informe a entrada em percentual, ou deixe vazio." }]
      : [];
    if (outcome.kind === "invalid" || entryError.length > 0) {
      setErrors([...(outcome.kind === "invalid" ? outcome.errors : []), ...entryError]);
      setWarnings([]);
      setStale(shown !== null);
      return;
    }
    setShown({ result: outcome.result, input, termUnit: next.termUnit });
    setErrors([]);
    setWarnings(outcome.warnings);
    setStale(false);
    if (input.entry && entryTracked.current !== input.entry.kind) {
      entryTracked.current = input.entry.kind;
      track("affordability_entry_added", { context, entry_kind: input.entry.kind });
    }
    if (announce) {
      track("affordability_financing_calculated", {
        context,
        system: next.system,
        rate_unit: next.rateUnit === "am" ? "mensal" : "anual",
        term_unit: next.termUnit,
        asset: asset ?? "nao-informado",
        entry_kind: input.entry ? input.entry.kind : "sem-entrada",
        example_used: exampleUsed.current,
      });
    }
  }

  function update(patch: Partial<Fields>) {
    const next = { ...fields, ...patch };
    setFields(next);
    if (patch.payment !== undefined || patch.rate !== undefined || patch.term !== undefined) setPremise(null);
    if (submitted) compute(next, { announce: false });
  }

  function chooseSystem(system: AmortizationSystem) {
    if (system === fields.system) return;
    track("affordability_system_changed", { context, system });
    update({ system });
  }

  function chooseAsset(next: AssetType) {
    if (next === asset) return;
    setAsset(next);
    setScenario(null);
    track("affordability_asset_type_changed", { context, asset: next });
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    setScenario(null);
    compute(fields, { announce: true });
    reveal();
  }

  function openScenario(change: ScenarioChange) {
    setScenario(change);
    track("affordability_scenario_changed", { context, kind: change.kind });
  }

  function prefill(d: AffordabilityPrefill) {
    exampleUsed.current = true;
    track("affordability_example_select", { context, example: d.exampleId });
    const next: Fields = {
      ...fields,
      payment: moneyInput(d.paymentCents),
      rate: rateText(d.ratePercent),
      rateUnit: d.rateUnit,
      term: String(d.months),
      termUnit: "meses",
      system: d.system,
    };
    setFields(next);
    setSubmitted(true);
    setScenario(null);
    setPremise(d.premise);
    compute(next, { announce: true });
    rootRef.current?.scrollIntoView({ block: "start" });
    reveal();
  }
  const onPrefill = useEffectEvent((d: AffordabilityPrefill) => prefill(d));
  useEffect(() => {
    const listener = (e: Event) => onPrefill((e as CustomEvent<AffordabilityPrefill>).detail);
    window.addEventListener(AFFORDABILITY_PREFILL_EVENT, listener);
    return () => window.removeEventListener(AFFORDABILITY_PREFILL_EVENT, listener);
  }, []);

  async function copySummary() {
    if (!shown) return;
    const text = `${buildAffordabilitySummary(shown.result, fields.system)}\nhttps://www.creditoporperto.com/calculadoras/quanto-consigo-financiar/`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied("ok");
      track("affordability_copy", { context });
    } catch {
      setCopied("falhou");
    }
    window.setTimeout(() => setCopied(null), 4000);
  }

  const cta = (target: string) => () => track("affordability_internal_cta_clicked", { context, target });

  const errorOf = (field: AffordField) => errors.find((e) => e.field === field)?.message;
  const warningOf = (field: AffordField) => warnings.find((w) => w.field === field)?.message;
  const described = (name: string, field: AffordField) =>
    [`${id(name)}-hint`, errorOf(field) ? `${id(name)}-erro` : null].filter(Boolean).join(" ") || undefined;

  /* Ecos ao vivo. */
  const liveRate = parseRate(fields.rate);
  const rateEcho =
    Number.isFinite(liveRate) && liveRate >= 0
      ? fields.rateUnit === "aa"
        ? `Equivale a ${rateText((Math.pow(1 + liveRate / 100, 1 / 12) - 1) * 100)}% ao mês (taxa efetiva, não ÷ 12).`
        : `Equivale a ${pct((Math.pow(1 + liveRate / 100, 12) - 1) * 100, 2)}% ao ano (taxa efetiva).`
      : null;
  const liveMonths = parseTerm(fields.term, fields.termUnit);
  const termEcho =
    Number.isFinite(liveMonths) && liveMonths >= 1
      ? fields.termUnit === "anos"
        ? `${monthsLabel(liveMonths)}.`
        : liveMonths >= 12
          ? `${monthsInWords(liveMonths)}.`
          : null
      : null;

  const Title = context === "artigo" ? "h3" : "h2";
  const Sub = context === "artigo" ? "h4" : "h3";
  const sys = fields.system;
  const assetKind: AssetType = asset ?? "outro";

  return (
    <section
      ref={rootRef}
      aria-labelledby={id("titulo")}
      className="not-prose scroll-mt-24 rounded-2xl border border-brand-border bg-white p-4 shadow-sm sm:p-6"
    >
      <Title id={id("titulo")} className="font-serif text-xl font-bold text-brand-navy">
        Quanto cabe no seu mês?
      </Title>

      <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
        <Field
          id={id("parcela")}
          label="Parcela máxima que você quer considerar"
          hint="Use o valor mensal que deseja testar na simulação."
          error={errorOf("paymentCents")}
        >
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" aria-hidden="true">
              R$
            </span>
            <input
              id={id("parcela")}
              inputMode="decimal"
              autoComplete="off"
              placeholder="2.000,00"
              value={fields.payment}
              onChange={(e) => update({ payment: e.target.value })}
              onBlur={(e) => update({ payment: tidyMoney(e.target.value) })}
              aria-invalid={errorOf("paymentCents") ? true : undefined}
              aria-describedby={described("parcela", "paymentCents")}
              className={`${inputClass} pl-10`}
            />
          </div>
        </Field>

        <Field
          id={id("taxa")}
          label="Taxa de juros"
          hint={
            <>
              A taxa da proposta ou uma taxa que você quer testar.{" "}
              <Link href="/taxas/" onClick={cta("radar")} className="font-semibold text-brand-teal underline underline-offset-2">
                Não sabe qual taxa usar? Ver referências de mercado
              </Link>
            </>
          }
          error={errorOf("ratePercent")}
          warning={warningOf("ratePercent")}
          echo={rateEcho}
        >
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <input
                id={id("taxa")}
                inputMode="decimal"
                autoComplete="off"
                placeholder="1,50"
                value={fields.rate}
                onChange={(e) => update({ rate: e.target.value })}
                aria-invalid={errorOf("ratePercent") ? true : undefined}
                aria-describedby={described("taxa", "ratePercent")}
                className={`${inputClass} pr-8`}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted" aria-hidden="true">
                %
              </span>
            </div>
            <Segmented
              label="Unidade da taxa"
              value={fields.rateUnit}
              options={[
                { value: "am", label: "ao mês" },
                { value: "aa", label: "ao ano" },
              ]}
              onChange={(rateUnit) => update({ rateUnit })}
            />
          </div>
        </Field>

        <Field id={id("prazo")} label="Prazo" error={errorOf("months")} echo={termEcho}>
          <div className="flex gap-2">
            <input
              id={id("prazo")}
              inputMode="decimal"
              autoComplete="off"
              placeholder={fields.termUnit === "meses" ? "360" : "30"}
              value={fields.term}
              onChange={(e) => update({ term: e.target.value })}
              aria-invalid={errorOf("months") ? true : undefined}
              aria-describedby={errorOf("months") ? `${id("prazo")}-erro` : undefined}
              className={`${inputClass} min-w-0 flex-1`}
            />
            <Segmented
              label="Unidade do prazo"
              value={fields.termUnit}
              options={[
                { value: "meses", label: "meses" },
                { value: "anos", label: "anos" },
              ]}
              onChange={(termUnit) => update({ termUnit })}
            />
          </div>
        </Field>

        <div>
          <p id={id("sistema")} className="text-sm font-semibold text-brand-navy">
            Sistema
          </p>
          <div className="mt-1.5">
            <Segmented
              label="Sistema de amortização"
              wide
              value={fields.system}
              options={[
                { value: "price", label: "Price (parcelas iguais)" },
                { value: "sac", label: "SAC (parcelas caem)" },
              ]}
              onChange={chooseSystem}
            />
          </div>
          {fields.system === "sac" ? (
            <p className="mt-1.5 text-xs text-brand-muted">Na SAC, a parcela informada é a 1ª, que é a maior. As seguintes ficam menores.</p>
          ) : null}
        </div>

        <button type="submit" className="min-h-12 w-full rounded-lg bg-brand-navy px-5 text-base font-semibold text-white hover:bg-brand-teal-dark">
          Calcular quanto posso financiar
        </button>
        <p className="text-center text-xs text-brand-muted">Sem cadastro • Sem CPF • Simulação educativa</p>
      </form>

      <div ref={resultRef} className="scroll-mt-24" aria-live="polite">
        {errors.length > 0 && submitted ? (
          <p className="mt-4 rounded-lg bg-brand-danger-soft px-3 py-2 text-sm text-brand-text">
            {errors.length === 1 ? "Um campo precisa de ajuste — ele está destacado acima." : `${errors.length} campos precisam de ajuste — eles estão destacados acima.`}
            {stale ? " O resultado abaixo é da simulação anterior." : ""}
          </p>
        ) : null}

        {shown ? (
          <Result
            shown={shown}
            system={sys}
            asset={asset}
            assetKind={assetKind}
            stale={stale}
            premise={premise}
            fields={fields}
            errorOf={errorOf}
            update={update}
            chooseAsset={chooseAsset}
            scenario={scenario}
            openScenario={openScenario}
            goal={goal}
            setGoal={setGoal}
            income={income}
            setIncome={setIncome}
            other={other}
            setOther={setOther}
            copied={copied}
            copySummary={copySummary}
            cta={cta}
            id={id}
            Title={Title}
            Sub={Sub}
            context={context}
          />
        ) : null}
      </div>
    </section>
  );
}

/* ---------- resultado ---------- */

function Result({
  shown,
  system,
  asset,
  assetKind,
  stale,
  premise,
  fields,
  errorOf,
  update,
  chooseAsset,
  scenario,
  openScenario,
  goal,
  setGoal,
  income,
  setIncome,
  other,
  setOther,
  copied,
  copySummary,
  cta,
  id,
  Title,
  Sub,
  context,
}: {
  shown: Shown;
  system: AmortizationSystem;
  asset: AssetType | null;
  assetKind: AssetType;
  stale: boolean;
  premise: string | null;
  fields: Fields;
  errorOf: (f: AffordField) => string | undefined;
  update: (p: Partial<Fields>) => void;
  chooseAsset: (a: AssetType) => void;
  scenario: ScenarioChange | null;
  openScenario: (c: ScenarioChange) => void;
  goal: string;
  setGoal: (v: string) => void;
  income: string;
  setIncome: (v: string) => void;
  other: string;
  setOther: (v: string) => void;
  copied: "ok" | "falhou" | null;
  copySummary: () => void;
  cta: (t: string) => () => void;
  id: (n: string) => string;
  Title: "h2" | "h3";
  Sub: "h3" | "h4";
  context: Context;
}) {
  const r = shown.result;
  const c = r[system];
  const otherSys: AmortizationSystem = system === "price" ? "sac" : "price";
  const o = r[otherSys];
  const unit = unitShort(r.rateUnit);
  const equivalent =
    r.rateUnit === "am" ? `${pct(r.annualRatePercent, 2)}% ao ano` : `${rateText(r.monthlyRatePercent)}% ao mês`;
  const paymentLabel = system === "sac" ? `1ª parcela de até ${brl(r.paymentCents)}` : `${brl(r.paymentCents)} por mês`;

  if (c.financedCents <= 0) {
    return (
      <div className={`mt-6 rounded-xl border border-brand-border p-4 ${stale ? "opacity-60" : ""}`}>
        <p className="text-sm text-brand-text">
          Com essa parcela, essa taxa e esse prazo, o valor financiável fica abaixo de um centavo. Confira a parcela, a taxa e a unidade (mês ou ano).
        </p>
      </div>
    );
  }

  const input = shown.input;
  const termSteps = TERM_STEPS[assetKind].map((d) => r.months + d).filter((m) => m <= MAX_AFFORD_MONTHS);
  const scenarioOutcome = scenario ? applyScenario(input, scenario) : null;
  const terms = termCurve(input, system, TERM_POINTS[assetKind]);
  const rates = rateCurve(input, system, RATE_STEP_PP);
  const lower = input.ratePercent - RATE_STEP_PP >= 0 ? applyScenario(input, { kind: "taxa", deltaPp: -RATE_STEP_PP }) : null;
  const higher = applyScenario(input, { kind: "taxa", deltaPp: RATE_STEP_PP });

  const goalCents = parseMoney(goal);
  const goalResult: GoalResult | null = Number.isFinite(goalCents) && goalCents > 0 ? analyzeGoal(r, system, goalCents) : null;

  const incomeCents = parseMoney(income);
  const otherCents = other.trim() === "" ? 0 : parseMoney(other);
  const incomeCtx = incomeContext(r.paymentCents, incomeCents, otherCents);

  const costsNotIncluded =
    assetKind === "imovel"
      ? "IOF, seguros obrigatórios do financiamento habitacional (MIP e DFI), taxa de administração, TR ou outro indexador, custos de registro e avaliação"
      : assetKind === "veiculo"
        ? "IOF, tarifas, seguros, registro do contrato e do gravame e outros encargos"
        : "IOF, tarifas, seguros, indexadores e outros encargos";

  return (
    <div className={`mt-6 space-y-6 ${stale ? "opacity-60" : ""}`}>
      {premise ? <p className="rounded-lg bg-brand-gold-soft px-3 py-2 text-sm text-brand-text">{premise}</p> : null}

      {/* Resultado principal */}
      <div className="rounded-xl border border-brand-border p-4 sm:p-5">
        <Title data-result-heading tabIndex={-1} className="text-sm font-semibold text-brand-muted outline-none">
          Com esta parcela, você financia aproximadamente
        </Title>
        <p className="mt-1 break-words font-serif text-3xl font-bold tabular-nums text-brand-navy sm:text-4xl">{brl(c.financedCents)}</p>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-brand-muted">Parcela considerada</dt>
            <dd className="font-semibold tabular-nums text-brand-text">{paymentLabel}</dd>
          </div>
          <div>
            <dt className="text-xs text-brand-muted">Prazo</dt>
            <dd className="font-semibold text-brand-text">{monthsFull(r.months)}</dd>
          </div>
          <div>
            <dt className="text-xs text-brand-muted">Taxa</dt>
            <dd className="font-semibold tabular-nums text-brand-text">
              {rateText(r.ratePercent)}% {unit}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-brand-muted">Sistema</dt>
            <dd className="font-semibold text-brand-text">{systemName(system)}</dd>
          </div>
        </dl>
      </div>

      {/* Assinatura: Parcela → Crédito → Total */}
      <div>
        <Sub className="font-serif text-lg font-bold text-brand-navy">Parcela → Crédito → Total</Sub>
        <ol className="mt-3 space-y-1 text-center">
          <li className="rounded-lg border border-brand-border px-3 py-2">
            <span className="block text-xs text-brand-muted">O número que aparece</span>
            <strong className="tabular-nums text-brand-navy">{paymentLabel}</strong>
          </li>
          <li aria-hidden="true" className="text-brand-muted">
            ↓
          </li>
          <li className="rounded-lg border border-brand-border px-3 py-2">
            <span className="block text-xs text-brand-muted">O que essa parcela suporta</span>
            <strong className="tabular-nums text-brand-navy">{brl(c.financedCents)} financiados</strong>
          </li>
          <li aria-hidden="true" className="text-brand-muted">
            ↓
          </li>
          <li className="rounded-lg border border-brand-border px-3 py-2">
            <span className="block text-xs text-brand-muted">O número que quase ninguém olha</span>
            <strong className="tabular-nums text-brand-navy">{brl(c.totalPaidCents)} pagos ao longo de todo o prazo</strong>
            <span className="block text-xs text-brand-muted">dos quais {brl(c.totalInterestCents)} são juros</span>
          </li>
        </ol>
      </div>

      {/* Resultado completo */}
      <div>
        <Sub className="font-serif text-lg font-bold text-brand-navy">Resultado completo</Sub>
        <dl className="mt-2 divide-y divide-brand-border rounded-xl border border-brand-border text-sm">
          {[
            ["Valor financiável", brl(c.financedCents)],
            ["Total das parcelas", brl(c.totalPaidCents)],
            ["Juros estimados", brl(c.totalInterestCents)],
            ["Prazo", monthsFull(r.months)],
            ["Taxa informada", `${rateText(r.ratePercent)}% ${unit}`],
            ["Taxa equivalente", equivalent],
            ...(system === "sac"
              ? [
                  ["1ª parcela (a maior)", brl(c.firstPaymentCents)],
                  ["Última parcela", brl(c.lastPaymentCents)],
                ]
              : c.lastPaymentCents !== c.firstPaymentCents
                ? [["Última parcela (acerta os centavos)", brl(c.lastPaymentCents)]]
                : []),
          ].map(([k, v]) => (
            <div key={k} className="flex flex-wrap items-baseline justify-between gap-x-3 px-3 py-2">
              <dt className="text-brand-muted">{k}</dt>
              <dd className="font-semibold tabular-nums text-brand-text">{v}</dd>
            </div>
          ))}
        </dl>
        {!c.fromSchedule ? (
          <p className="mt-2 text-xs text-brand-muted">
            Combinação extrema de taxa e prazo: os totais saem da fórmula, sem o arredondamento mês a mês de um contrato.
          </p>
        ) : null}
        <p className="mt-2 text-sm text-brand-muted">
          O total das parcelas não é o CET: não inclui {costsNotIncluded}.{" "}
          <Link href="/calculadoras/cet/" onClick={cta("cet")} className="font-semibold text-brand-teal underline underline-offset-2">
            Quer incluir IOF, tarifas e seguros? Calcule o CET
          </Link>
        </p>
      </div>

      {/* Price x SAC */}
      <div>
        <Sub className="font-serif text-lg font-bold text-brand-navy">Price e SAC com a mesma parcela máxima</Sub>
        <BarLegend />
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {(["price", "sac"] as const).map((s) => {
            const x = r[s];
            const max = Math.max(r.price.totalPaidCents, r.sac.totalPaidCents, 1);
            return (
              <div key={s} className={`rounded-xl border p-3 ${s === system ? "border-brand-navy" : "border-brand-border"}`}>
                <p className="text-sm font-bold uppercase tracking-wide text-brand-navy">
                  {systemName(s)}
                  {s === system ? <span className="ml-1 text-xs font-normal normal-case text-brand-muted">(o sistema escolhido)</span> : null}
                </p>
                <dl className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-brand-muted">Valor financiável</dt>
                    <dd className="font-semibold tabular-nums">{brl(x.financedCents)}</dd>
                  </div>
                  {s === "price" ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-brand-muted">Parcela</dt>
                      <dd className="tabular-nums">{brl(x.firstPaymentCents)}</dd>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between gap-3">
                        <dt className="text-brand-muted">Primeira parcela</dt>
                        <dd className="tabular-nums">{brl(x.firstPaymentCents)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-brand-muted">Última parcela</dt>
                        <dd className="tabular-nums">{brl(x.lastPaymentCents)}</dd>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between gap-3">
                    <dt className="text-brand-muted">Total das parcelas</dt>
                    <dd className="tabular-nums">{brl(x.totalPaidCents)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-brand-muted">Juros estimados</dt>
                    <dd className="tabular-nums">{brl(x.totalInterestCents)}</dd>
                  </div>
                </dl>
                <div className="mt-2">
                  <StackBar financed={x.financedCents} interest={x.totalInterestCents} max={max} />
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-sm text-brand-text">
          {r.price.financedCents === r.sac.financedCents
            ? "Nesta simulação, o valor financiável é o mesmo nos dois sistemas."
            : `Nesta simulação, o valor financiável é ${brl(Math.abs(r.price.financedCents - r.sac.financedCents))} maior no sistema ${
                r.price.financedCents > r.sac.financedCents ? "Price" : "SAC"
              }. Na SAC, a parcela informada é a primeira, que é a maior; as seguintes caem.`}
        </p>
      </div>

      {/* Tipo de bem */}
      <div>
        <p className="text-sm font-semibold text-brand-navy">O que você quer financiar? (opcional)</p>
        <div className="mt-1.5">
          <Segmented label="Tipo de bem" wide value={asset} options={ASSETS} onChange={chooseAsset} />
        </div>
        <p className="mt-1.5 text-xs text-brand-muted">Muda os exemplos de prazo e os próximos passos. A conta é a mesma.</p>
      </div>

      {/* Entrada */}
      <div>
        <Sub className="font-serif text-lg font-bold text-brand-navy">Você tem dinheiro para entrada?</Sub>
        <div className="mt-2">
          <Field id={id("entrada")} label="Entrada (opcional)" hint="Em reais ou em percentual do valor do bem. Nenhum mínimo é assumido." error={errorOf("entry")}>
            <div className="flex gap-2">
              <input
                id={id("entrada")}
                inputMode="decimal"
                autoComplete="off"
                placeholder={fields.entryKind === "reais" ? "50.000,00" : "20"}
                value={fields.entry}
                onChange={(e) => update({ entry: e.target.value })}
                onBlur={(e) => (fields.entryKind === "reais" ? update({ entry: tidyMoney(e.target.value) }) : undefined)}
                aria-invalid={errorOf("entry") ? true : undefined}
                aria-describedby={`${id("entrada")}-hint${errorOf("entry") ? ` ${id("entrada")}-erro` : ""}`}
                className={`${inputClass} min-w-0 flex-1`}
              />
              <Segmented
                label="Unidade da entrada"
                value={fields.entryKind}
                options={[
                  { value: "reais", label: "R$" },
                  { value: "percent", label: "%" },
                ]}
                onChange={(entryKind) => update({ entryKind, entry: "" })}
              />
            </div>
          </Field>
        </div>
        {r.entry ? (
          <div className="mt-3 rounded-xl bg-brand-surface-soft p-3 text-sm">
            <dl className="space-y-1 tabular-nums">
              <div className="flex justify-between gap-3">
                <dt className="text-brand-muted">Valor financiável</dt>
                <dd>{brl(c.financedCents)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-brand-muted">
                  + Entrada{r.entry.kind === "percent" ? ` (${pct(r.entry.percent, 1)}% do bem)` : ""}
                </dt>
                <dd>{brl(c.entryCents)}</dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-brand-border pt-1 font-semibold text-brand-navy">
                <dt>= Valor aproximado do bem</dt>
                <dd>{brl(c.assetCents)}</dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-brand-muted">
              Com {brl(c.entryCents)} de entrada, o valor total do bem nesta simulação poderia ser de aproximadamente {brl(c.assetCents)}. Isso é
              matemática, não aprovação: cada instituição define quanto do bem aceita financiar.
            </p>
          </div>
        ) : null}
      </div>

      {/* Cenários */}
      <div>
        <Sub className="font-serif text-lg font-bold text-brand-navy">O que muda se…</Sub>
        <p className="mt-1 text-sm text-brand-muted">Uma coisa de cada vez; o resto fica igual. São cenários, não sugestões.</p>
        <div className="mt-3 space-y-3">
          <ScenarioRow label="A parcela fosse maior">
            {PAYMENT_STEPS.map((d) => (
              <ScenarioChip key={d} active={scenario?.kind === "parcela" && scenario.deltaCents === d} onClick={() => openScenario({ kind: "parcela", deltaCents: d })}>
                + {brlRound(d)}
              </ScenarioChip>
            ))}
          </ScenarioRow>
          {termSteps.length > 0 ? (
            <ScenarioRow label="O prazo fosse maior">
              {termSteps.map((m) => (
                <ScenarioChip key={m} active={scenario?.kind === "prazo" && scenario.months === m} onClick={() => openScenario({ kind: "prazo", months: m })}>
                  {r.months} → {m} meses
                </ScenarioChip>
              ))}
            </ScenarioRow>
          ) : null}
          <ScenarioRow label="A taxa fosse menor">
            {RATE_STEPS.map((d) => (
              <ScenarioChip key={d} active={scenario?.kind === "taxa" && scenario.deltaPp === -d} onClick={() => openScenario({ kind: "taxa", deltaPp: -d })}>
                − {pct(d, 2)} p.p.
              </ScenarioChip>
            ))}
          </ScenarioRow>
        </div>
        {scenarioOutcome ? (
          <div className="mt-3 rounded-xl border border-brand-border p-3" aria-live="polite">
            {scenarioOutcome.after ? (
              <ScenarioResult before={r} after={scenarioOutcome.after} system={system} kind={scenarioOutcome.change.kind} />
            ) : (
              <p className="text-sm text-brand-text">Cenário indisponível: {scenarioOutcome.unavailableReason}</p>
            )}
          </div>
        ) : null}
      </div>

      {/* Gráfico: prazo */}
      <figure>
        <Sub className="font-serif text-lg font-bold text-brand-navy">O que acontece quando você muda o prazo?</Sub>
        <p className="mt-1 text-sm text-brand-muted">
          Mesma parcela ({paymentLabel}) e mesma taxa, no sistema {systemName(system)}. Prazo maior financia mais, e os juros crescem mais depressa
          que o valor financiado.
        </p>
        <BarLegend />
        <CurveList caption="Valor financiável, juros e total pago por prazo" points={terms} label={(p) => monthsLabel(p.months)} />
        <figcaption className="mt-1 text-xs text-brand-muted">Prazos de ilustração, não limites de instituição.</figcaption>
      </figure>

      {/* Gráfico: taxa */}
      <figure>
        <Sub className="font-serif text-lg font-bold text-brand-navy">Taxa × quanto você consegue financiar</Sub>
        <p className="mt-1 text-sm text-brand-muted">Mesma parcela e mesmo prazo ({monthsLabel(r.months)}). Quanto maior a taxa, menor o valor que a parcela sustenta.</p>
        <BarLegend />
        <CurveList caption="Valor financiável por taxa" points={rates} label={(p) => `${rateText(p.ratePercent)}% ${unit}`} />
        <div className="mt-3 rounded-xl bg-brand-surface-soft p-3 text-sm">
          <p className="font-semibold text-brand-navy">Cada 0,5 p.p. importa quanto?</p>
          <p className="mt-1 text-brand-text">
            {lower?.after
              ? `Com ${rateText(lower.after.ratePercent)}% ${unit} em vez de ${rateText(r.ratePercent)}% ${unit}, a mesma parcela financiaria ${brl(
                  lower.after[system].financedCents,
                )}: ${brl(lower.after[system].financedCents - c.financedCents)} a mais.`
              : "A taxa informada está abaixo de 0,5 ponto; não há como reduzi-la mais nesse passo."}{" "}
            {higher.after
              ? `Com ${rateText(higher.after.ratePercent)}% ${unit}, financiaria ${brl(higher.after[system].financedCents)}: ${brl(
                  c.financedCents - higher.after[system].financedCents,
                )} a menos.`
              : null}
          </p>
        </div>
      </figure>

      {/* Objetivo */}
      <details className="rounded-xl border border-brand-border" onToggle={(e) => (e.currentTarget.open ? track("affordability_scenario_changed", { context, kind: "objetivo" }) : undefined)}>
        <summary className="min-h-11 cursor-pointer px-3 py-3 font-semibold text-brand-navy">Tenho um valor de bem em mente</summary>
        <div className="space-y-3 px-3 pb-3">
          <Field id={id("objetivo")} label="Preço do bem" hint="A entrada informada acima entra na conta.">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" aria-hidden="true">
                R$
              </span>
              <input
                id={id("objetivo")}
                inputMode="decimal"
                autoComplete="off"
                placeholder="300.000,00"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                onBlur={(e) => setGoal(tidyMoney(e.target.value))}
                aria-describedby={`${id("objetivo")}-hint`}
                className={`${inputClass} pl-10`}
              />
            </div>
          </Field>
          {goalResult ? <GoalView g={goalResult} result={r} system={system} /> : null}
        </div>
      </details>

      {/* Renda */}
      <details className="rounded-xl border border-brand-border" onToggle={(e) => (e.currentTarget.open ? track("affordability_scenario_changed", { context, kind: "renda" }) : undefined)}>
        <summary className="min-h-11 cursor-pointer px-3 py-3 font-semibold text-brand-navy">Comparar essa parcela com minha renda</summary>
        <div className="space-y-3 px-3 pb-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id={id("renda")} label="Renda mensal">
              <input
                id={id("renda")}
                inputMode="decimal"
                autoComplete="off"
                placeholder="R$ 8.000,00"
                value={income}
                onChange={(e) => setIncome(e.target.value)}
                onBlur={(e) => setIncome(tidyMoney(e.target.value))}
                className={inputClass}
              />
            </Field>
            <Field id={id("outros")} label="Outros pagamentos mensais de dívidas (opcional)">
              <input
                id={id("outros")}
                inputMode="decimal"
                autoComplete="off"
                placeholder="R$ 0,00"
                value={other}
                onChange={(e) => setOther(e.target.value)}
                onBlur={(e) => setOther(tidyMoney(e.target.value))}
                className={inputClass}
              />
            </Field>
          </div>
          {incomeCtx ? (
            <div className="rounded-xl bg-brand-surface-soft p-3 text-sm">
              <p>
                A parcela corresponde a <strong className="tabular-nums">{pct(incomeCtx.paymentShare * 100)}%</strong> da renda informada.
              </p>
              {otherCents > 0 ? (
                <p className="mt-1">
                  Com os outros pagamentos, as dívidas somam <strong className="tabular-nums">{pct(incomeCtx.totalShare * 100)}%</strong> da renda.
                </p>
              ) : null}
              <p className="mt-1">
                {incomeCtx.remainingCents >= 0 ? (
                  <>
                    Restaria antes de outros gastos: <strong className="tabular-nums">{brl(incomeCtx.remainingCents)}</strong>. Moradia, alimentação,
                    transporte e o resto ainda saem daí.
                  </>
                ) : (
                  <>
                    A parcela e os outros pagamentos passam da renda informada em{" "}
                    <strong className="tabular-nums">{brl(-incomeCtx.remainingCents)}</strong>.
                  </>
                )}
              </p>
              <p className="mt-2 text-xs text-brand-muted">
                Este percentual é apenas uma relação matemática. Instituições utilizam políticas próprias de análise e comprometimento de renda.
              </p>
            </div>
          ) : null}
          <p className="text-sm">
            <span className="text-brand-muted">Essa parcela cabe de verdade no mês?</span>{" "}
            <Link href="/calculadoras/parcela-no-orcamento/" onClick={cta("orcamento")} className="font-semibold text-brand-teal underline underline-offset-2">
              Testar no meu orçamento
            </Link>
          </p>
        </div>
      </details>

      {/* Copiar */}
      <div>
        <button
          type="button"
          onClick={copySummary}
          className="min-h-11 rounded-lg border border-brand-navy px-4 text-sm font-semibold text-brand-navy hover:bg-brand-teal-soft"
        >
          Copiar simulação
        </button>
        <p className="mt-1 text-xs text-brand-muted" role="status">
          {copied === "ok" ? "Copiado. O texto fica só no seu aparelho." : copied === "falhou" ? "Não foi possível copiar." : ""}
        </p>
      </div>

      {/* Próximos passos */}
      <div className="space-y-2 rounded-xl border border-brand-border p-3 text-sm">
        <Sub className="font-serif text-base font-bold text-brand-navy">Próximos passos</Sub>
        <p>
          <span className="text-brand-muted">Essa parcela cabe de verdade no mês?</span>{" "}
          <Link href="/calculadoras/parcela-no-orcamento/" onClick={cta("orcamento")} className="font-semibold text-brand-teal underline underline-offset-2">
            Testar no meu orçamento
          </Link>
        </p>
        {asset === "imovel" ? (
          <p>
            <span className="text-brand-muted">Já tem um imóvel em mente?</span>{" "}
            <Link href="/calculadoras/financiamento-imobiliario/" onClick={cta("imovel")} className="font-semibold text-brand-teal underline underline-offset-2">
              Simular financiamento imobiliário completo
            </Link>
          </p>
        ) : null}
        {asset === "veiculo" ? (
          <p>
            <span className="text-brand-muted">Já sabe o preço do carro?</span>{" "}
            <Link href="/calculadoras/financiamento-veiculo/" onClick={cta("veiculo")} className="font-semibold text-brand-teal underline underline-offset-2">
              Simular financiamento do veículo
            </Link>
          </p>
        ) : null}
        <p>
          <span className="text-brand-muted">Não sabe qual taxa usar?</span>{" "}
          <Link href="/taxas/" onClick={cta("radar")} className="font-semibold text-brand-teal underline underline-offset-2">
            Ver referências de mercado
          </Link>
        </p>
        <p>
          <span className="text-brand-muted">Já recebeu uma proposta?</span>{" "}
          <Link href="/calculadoras/cet/" onClick={cta("cet")} className="font-semibold text-brand-teal underline underline-offset-2">
            Calcular o CET
          </Link>
        </p>
        <p>
          <span className="text-brand-muted">Tem duas propostas?</span>{" "}
          <Link href="/calculadoras/comparador-de-propostas/" onClick={cta("comparador")} className="font-semibold text-brand-teal underline underline-offset-2">
            Comparar propostas
          </Link>
        </p>
      </div>

      <p className="text-xs leading-relaxed text-brand-muted">
        Esta ferramenta estima quanto uma prestação pode financiar com base na taxa, prazo e sistema informados. O valor efetivamente aprovado
        depende da análise e das condições da instituição financeira.
      </p>
    </div>
  );
}

function ScenarioRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label}>
      <p className="text-sm font-semibold text-brand-text">{label}</p>
      <div className="mt-1 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function ScenarioChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className="min-h-11 rounded-lg border border-brand-border px-3 text-sm font-semibold tabular-nums text-brand-navy aria-pressed:border-brand-navy aria-pressed:bg-brand-navy aria-pressed:text-white"
    >
      {children}
    </button>
  );
}

function ScenarioResult({
  before,
  after,
  system,
  kind,
}: {
  before: AffordabilityResult;
  after: AffordabilityResult;
  system: AmortizationSystem;
  kind: ScenarioChange["kind"];
}) {
  const b = before[system];
  const a = after[system];
  const unit = unitShort(before.rateUnit);
  const diff = a.financedCents - b.financedCents;
  return (
    <>
      <dl>
        {kind === "parcela" ? <Before label={system === "sac" ? "1ª parcela" : "Parcela"} before={brl(before.paymentCents)} after={brl(after.paymentCents)} /> : null}
        {kind === "prazo" ? <Before label="Prazo" before={monthsLabel(before.months)} after={monthsLabel(after.months)} /> : null}
        {kind === "taxa" ? (
          <Before label="Taxa" before={`${rateText(before.ratePercent)}% ${unit}`} after={`${rateText(after.ratePercent)}% ${unit}`} />
        ) : null}
        <Before label="Valor financiável" before={brl(b.financedCents)} after={brl(a.financedCents)} />
        <Before label="Total das parcelas" before={brl(b.totalPaidCents)} after={brl(a.totalPaidCents)} />
        <Before label="Juros estimados" before={brl(b.totalInterestCents)} after={brl(a.totalInterestCents)} />
      </dl>
      <p className="mt-2 text-sm text-brand-text">
        Diferença no valor financiável: <strong className="tabular-nums">{brl(diff)}</strong>.
        {kind === "prazo"
          ? ` O total pago sobe ${brl(a.totalPaidCents - b.totalPaidCents)}, e ${brl(a.totalInterestCents - b.totalInterestCents)} disso são juros a mais.`
          : kind === "parcela"
            ? ` O total pago também sobe: ${brl(a.totalPaidCents - b.totalPaidCents)} a mais ao longo do prazo.`
            : ` Com o mesmo prazo, os juros vão de ${brl(b.totalInterestCents)} para ${brl(a.totalInterestCents)}.`}
      </p>
    </>
  );
}

function GoalView({ g, result, system }: { g: GoalResult; result: AffordabilityResult; system: AmortizationSystem }) {
  const unit = unitShort(result.rateUnit);
  if (g.neededFinancedCents <= 0) {
    return <p className="text-sm text-brand-text">A entrada informada já cobre o preço do bem: não haveria valor a financiar.</p>;
  }
  return (
    <div className="space-y-3 text-sm">
      <dl className="rounded-xl bg-brand-surface-soft p-3 tabular-nums">
        <div className="flex justify-between gap-3">
          <dt className="text-brand-muted">Precisaria financiar</dt>
          <dd>{brl(g.neededFinancedCents)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-brand-muted">A parcela financia</dt>
          <dd>{brl(g.financeableCents)}</dd>
        </div>
        <div className="flex justify-between gap-3 border-t border-brand-border pt-1 font-semibold text-brand-navy">
          <dt>{g.reachable ? "Sobra" : "Faltam"}</dt>
          <dd>{brl(Math.abs(g.gapCents))}</dd>
        </div>
      </dl>
      {g.reachable ? (
        <p className="text-brand-text">Nesta simulação, o valor financiável cobre o necessário, com {brl(-g.gapCents)} de folga.</p>
      ) : (
        <div>
          <p className="font-semibold text-brand-navy">O que teria que mudar matematicamente?</p>
          <p className="mt-0.5 text-xs text-brand-muted">Cada linha muda uma coisa só e mantém as outras. Nenhuma delas é uma recomendação.</p>
          <ul className="mt-2 space-y-2">
            <li className="rounded-lg border border-brand-border p-2">
              <strong className="text-brand-navy">Parcela:</strong>{" "}
              {brl(result.paymentCents)} → <span className="tabular-nums">{brl(g.paymentNeededCents)}</span>
              {system === "sac" ? " (1ª parcela)" : ""}. Para atingir esse valor mantendo as outras premissas, a parcela matemática seria de aproximadamente{" "}
              {brl(g.paymentNeededCents)}.
            </li>
            <li className="rounded-lg border border-brand-border p-2">
              <strong className="text-brand-navy">Prazo:</strong>{" "}
              {g.termNeeded.kind === "nao-amortiza"
                ? "Com essa taxa e esse valor financiado, a parcela informada não é suficiente para amortizar a dívida: ela não cobre nem os juros do primeiro mês. Nenhum prazo resolve."
                : g.termNeeded.withinLimit
                  ? `${monthsLabel(result.months)} → ${monthsFull(g.termNeeded.months)}.`
                  : `seriam mais de ${MAX_AFFORD_MONTHS.toLocaleString("pt-BR")} meses (${monthsInWords(MAX_AFFORD_MONTHS)}), o limite técnico desta ferramenta.`}
            </li>
            <li className="rounded-lg border border-brand-border p-2">
              <strong className="text-brand-navy">Taxa:</strong>{" "}
              {g.rateNeeded.kind === "sem-taxa"
                ? "nem com juros zero essa parcela, nesse prazo, chegaria ao valor. Só parcela, prazo ou entrada mudam essa conta."
                : `${rateText(result.monthlyRatePercent)}% a.m. → até ${rateFloor(g.rateNeeded.monthlyRatePercent)}% a.m. (${pct(
                    g.rateNeeded.annualRatePercent,
                    2,
                  )}% a.a.). Taxa máxima matemática para este cenário. Isso não significa que exista uma instituição oferecendo essa taxa.`}
              {g.rateNeeded.kind === "ok" && result.rateUnit === "aa" ? <span className="block text-xs text-brand-muted">Você digitou a taxa {unit}; aqui ela aparece ao mês e ao ano.</span> : null}
            </li>
            <li className="rounded-lg border border-brand-border p-2">
              <strong className="text-brand-navy">Entrada:</strong> para este cenário, a diferença seria de aproximadamente {brl(g.entryNeededCents)} de entrada
              {g.entryCents > 0 ? ` (hoje, ${brl(g.entryCents)})` : ""}. Não é a entrada mínima de nenhuma instituição: é o que a conta pede.
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
