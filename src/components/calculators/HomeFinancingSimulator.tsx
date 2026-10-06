"use client";

/**
 * SIMULADOR DE FINANCIAMENTO IMOBILIÁRIO
 * ============================================================================
 *
 * Dois modos, uma conta:
 *   - "Quanto fica a parcela": imóvel, entrada, taxa e prazo → SAC e Price;
 *   - "Quanto consigo financiar": parcela que cabe no mês → valor.
 *
 * A tabela mês a mês é a mesma da Calculadora SAC x Price
 * (`lib/calculators/sac-price.ts`); aqui não há gráfico nem tabela completa
 * de propósito — quem quer o detalhe vai para lá. Esta página responde
 * "quanto fica" e "quanto consigo".
 *
 * PRÉ-PREENCHIMENTO PELOS EXEMPLOS
 *
 * Os exemplos da página ("Quanto fica financiar R$ 300 mil?") são HTML do
 * servidor. O botão "Simular este valor" dispara o evento de janela
 * `cpp:simular-imovel` com os números do exemplo; o simulador escuta, preenche,
 * calcula e rola até o resultado. Nenhuma URL nova por valor, nenhum
 * parâmetro na barra de endereço.
 *
 * Campos começam vazios; o exemplo e a taxa do Banco Central entram só por
 * botão, identificados. Nada do que é digitado sai do navegador.
 */

import Link from "next/link";
import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { track } from "@/lib/analytics/track";
import { parseBRLToCents, parsePercentBR } from "@/lib/calculators/proposal-comparison";
import {
  downScenariosWithCurrent,
  incomeForPayment,
  maxFinanceable,
  monthsInWords,
  simulateHome,
  termScenarios,
  toMonthlyRatePercent,
  type CapacityResult,
  type HomeField,
  type HomeIssue,
  type HomeResult,
  type RateUnit,
  type ScenarioRow,
} from "@/lib/calculators/home-financing";
import { useRevealResult } from "./use-reveal-result";

export const PREFILL_EVENT = "cpp:simular-imovel";
/** Critério informado pela Caixa: parcela até 30% da renda familiar bruta. */
const CAIXA_INCOME_SHARE = 0.3;

export type Mode = "parcela" | "capacidade";

export interface PrefillDetail {
  mode: Mode;
  /** Id do exemplo, para analytics (nunca o valor). */
  exampleId: string;
  propertyCents?: number;
  downCents?: number;
  paymentCents?: number;
  months: number;
}

/** Taxa oferecida pelo servidor: média do BC com mês, ou ilustrativa. */
export interface RateOffer {
  annualRatePercent: number;
  /** "média do Banco Central em julho de 2026" ou "ilustrativa" */
  label: string;
  official: boolean;
}

interface Fields {
  mode: Mode;
  property: string;
  down: string;
  payment: string;
  rate: string;
  rateUnit: RateUnit;
  months: string;
}

const EMPTY: Fields = {
  mode: "parcela",
  property: "",
  down: "",
  payment: "",
  rate: "",
  rateUnit: "aa",
  months: "",
};

const TERM_CHIPS = [240, 300, 360, 420] as const;

const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const brlRound = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(
    cents / 100,
  );
/** Teto de valor ("até R$ X"): arredonda para BAIXO, para não prometer um real a mais. */
const brlFloor = (cents: number) => brlRound(Math.floor(cents / 100) * 100);
/** Renda mínima ("pelo menos R$ X"): arredonda para CIMA, para não prometer um real a menos. */
const brlCeil = (cents: number) => brlRound(Math.ceil(cents / 100) * 100);
const pct = (v: number, digits = 2) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const moneyInput = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function tidyMoney(raw: string): string {
  const cents = parseBRLToCents(raw);
  return cents === null ? raw : moneyInput(cents);
}

function parseMoney(raw: string): number {
  if (raw.trim() === "") return Number.NaN;
  const cents = parseBRLToCents(raw);
  return cents === null ? Number.NaN : cents;
}

const parseMonths = (raw: string) => (/^\d+$/.test(raw.trim()) ? Number(raw.trim()) : Number.NaN);
const parseRate = (raw: string) => parsePercentBR(raw) ?? Number.NaN;

type Shown =
  | { mode: "parcela"; result: HomeResult; rate: number; rateUnit: RateUnit }
  | { mode: "capacidade"; result: CapacityResult; downCents: number; rate: number; rateUnit: RateUnit };

/* ---------- peças ---------- */

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
  hint?: string;
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
  wide,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (v: T) => void;
  wide?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`flex rounded-lg border border-brand-border p-0.5 ${wide ? "w-full sm:w-auto" : "shrink-0"}`}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-11 rounded-md px-3 text-sm font-semibold text-brand-muted aria-pressed:bg-brand-navy aria-pressed:text-white ${wide ? "flex-1 sm:flex-none" : ""}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Tabela que vira cartões no celular: nenhuma coluna escondida em 320 px. */
export function ScenarioTable({
  caption,
  head,
  rows,
}: {
  caption: string;
  head: string[];
  rows: Array<{ key: string; cells: string[]; current?: boolean }>;
}) {
  return (
    <>
      <ul aria-label={caption} className="mt-2 list-none divide-y divide-brand-border rounded-xl border border-brand-border pl-0 sm:hidden">
        {rows.map((row) => (
          <li key={row.key} className={`mt-0 px-3 py-2.5 ${row.current ? "bg-brand-teal-soft" : ""}`}>
            <p className="text-sm font-semibold text-brand-navy">
              {row.cells[0]}
              {row.current ? <span className="font-normal text-brand-teal-dark"> · a sua simulação</span> : null}
            </p>
            <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-sm tabular-nums">
              {head.slice(1).map((h, i) => (
                <div key={h}>
                  <dt className="text-xs text-brand-muted">{h}</dt>
                  <dd className="font-semibold text-brand-text">{row.cells[i + 1]}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
      <div className="mt-2 hidden overflow-x-auto rounded-xl border border-brand-border sm:block">
        <table className="w-full min-w-0 border-collapse text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-brand-surface-soft text-left">
            <tr>
              {head.map((h, i) => (
                <th key={h} scope="col" className={`px-3 py-2 font-semibold text-brand-navy ${i > 0 ? "text-right" : ""}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map((row) => (
              <tr
                key={row.key}
                aria-current={row.current ? "true" : undefined}
                className={`border-t border-brand-border ${row.current ? "bg-brand-teal-soft font-semibold" : ""}`}
              >
                <th scope="row" className="px-3 py-2 text-left font-medium">
                  {row.cells[0]}
                  {row.current ? <span className="ml-1 text-xs text-brand-teal-dark">(a sua)</span> : null}
                </th>
                {row.cells.slice(1).map((c, i) => (
                  <td key={i} className="px-3 py-2 text-right">
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/**
 * Botão dos exemplos da página: preenche o simulador sem sair da página.
 * Renderizado dentro do HTML do servidor, como ilha cliente.
 */
export function SimulateExampleButton({ label, detail }: { label: string; detail: PrefillDetail }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent<PrefillDetail>(PREFILL_EVENT, { detail }))}
      className="not-prose mt-3 inline-flex min-h-11 items-center rounded-lg border border-brand-navy px-4 text-sm font-semibold text-brand-navy hover:bg-brand-teal-soft"
    >
      {label}
    </button>
  );
}

/* ---------- componente ---------- */

export function HomeFinancingSimulator({
  rateOffer,
  context = "ferramenta",
}: {
  rateOffer: RateOffer;
  context?: "ferramenta" | "artigo";
}) {
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;

  const [fields, setFields] = useState<Fields>(EMPTY);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<HomeIssue[]>([]);
  const [warnings, setWarnings] = useState<HomeIssue[]>([]);
  const [shown, setShown] = useState<Shown | null>(null);
  const [stale, setStale] = useState(false);
  const [examplePremise, setExamplePremise] = useState<string | null>(null);

  const started = useRef(false);
  const exampleUsed = useRef(false);
  const referenceUsed = useRef(false);
  const rootRef = useRef<HTMLElement | null>(null);
  const { ref: resultRef, reveal } = useRevealResult();

  function compute(next: Fields, { announce }: { announce: boolean }) {
    const rate = parseRate(next.rate);
    const months = parseMonths(next.months);
    if (next.mode === "parcela") {
      const property = parseMoney(next.property);
      const down = next.down.trim() === "" ? 0 : parseMoney(next.down);
      const outcome = simulateHome({ propertyCents: property, downCents: down, ratePercent: rate, rateUnit: next.rateUnit, months });
      if (outcome.kind === "invalid") {
        setErrors(outcome.errors);
        setWarnings([]);
        setStale(shown !== null);
        return;
      }
      setShown({ mode: "parcela", result: outcome.result, rate, rateUnit: next.rateUnit });
      setWarnings(outcome.warnings);
    } else {
      const payment = parseMoney(next.payment);
      const down = next.down.trim() === "" ? 0 : parseMoney(next.down);
      const outcome = maxFinanceable({ paymentCents: payment, ratePercent: rate, rateUnit: next.rateUnit, months });
      const downError: HomeIssue[] =
        Number.isFinite(down) && down >= 0 ? [] : [{ field: "downCents", message: "A entrada precisa ser um valor em reais. Sem entrada, deixe vazio." }];
      if (outcome.kind === "invalid" || downError.length > 0) {
        setErrors([...(outcome.kind === "invalid" ? outcome.errors : []), ...downError]);
        setWarnings([]);
        setStale(shown !== null);
        return;
      }
      setShown({ mode: "capacidade", result: outcome.result, downCents: down, rate, rateUnit: next.rateUnit });
      setWarnings(outcome.warnings);
    }
    setErrors([]);
    setStale(false);
    if (announce) {
      track("home_finance_complete", {
        context,
        mode: next.mode,
        rate_unit: next.rateUnit === "am" ? "mensal" : "anual",
        example_used: exampleUsed.current,
        reference_used: referenceUsed.current,
      });
    }
  }

  function update(patch: Partial<Fields>) {
    if (!started.current) {
      started.current = true;
      track("home_finance_start", { context });
    }
    const next = { ...fields, ...patch };
    // Taxa digitada à mão deixa de ser "a do Banco Central".
    if (patch.rate !== undefined) referenceUsed.current = false;
    setFields(next);
    setExamplePremise(null);
    if (submitted) compute(next, { announce: false });
  }

  function setMode(mode: Mode) {
    if (mode === fields.mode) return;
    track("home_finance_mode_select", { context, mode });
    setWarnings([]);
    setExamplePremise(null);
    // Trocar de modo não aproveita o resultado do outro: são perguntas diferentes.
    setShown(null);
    setErrors([]);
    setSubmitted(false);
    setFields((f) => ({ ...f, mode }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    compute(fields, { announce: true });
    reveal();
  }

  function applyReference() {
    track("home_finance_reference_use", { context, official: rateOffer.official });
    update({ rate: pct(rateOffer.annualRatePercent), rateUnit: "aa" });
    referenceUsed.current = true;
  }

  /**
   * Do modo "quanto consigo" para "quanto fica", com a TAXA DA PESSOA — não
   * a de referência. (Auditoria de 23/09/2026: antes, o botão reaproveitava o
   * preenchimento dos exemplos e trocava a taxa pela do Banco Central.)
   */
  function showProperty(propertyCents: number) {
    track("home_finance_mode_select", { context, mode: "parcela" });
    const next: Fields = {
      ...fields,
      mode: "parcela",
      property: moneyInput(propertyCents),
      down: fields.down,
    };
    setFields(next);
    setExamplePremise(null);
    setSubmitted(true);
    compute(next, { announce: false });
    rootRef.current?.scrollIntoView({ block: "start" });
    reveal();
  }

  /* Exemplos da página → simulador. */
  function prefill(d: PrefillDetail) {
    exampleUsed.current = true;
    referenceUsed.current = true;
    track("home_finance_example_select", { context, example: d.exampleId });
    const next: Fields = {
      ...EMPTY,
      mode: d.mode,
      property: d.propertyCents !== undefined ? moneyInput(d.propertyCents) : "",
      down: d.downCents ? moneyInput(d.downCents) : "",
      payment: d.paymentCents !== undefined ? moneyInput(d.paymentCents) : "",
      rate: pct(rateOffer.annualRatePercent),
      rateUnit: "aa",
      months: String(d.months),
    };
    setFields(next);
    setSubmitted(true);
    setExamplePremise(`Exemplo preenchido com a taxa ${rateOffer.label}. Troque pelos números da sua proposta.`);
    compute(next, { announce: true });
    rootRef.current?.scrollIntoView({ block: "start" });
    reveal();
  }
  /* O listener fica estável e sempre enxerga o estado atual. */
  const onPrefill = useEffectEvent((d: PrefillDetail) => prefill(d));
  useEffect(() => {
    const listener = (e: Event) => onPrefill((e as CustomEvent<PrefillDetail>).detail);
    window.addEventListener(PREFILL_EVENT, listener);
    return () => window.removeEventListener(PREFILL_EVENT, listener);
  }, []);

  const errorOf = (field: HomeField) => errors.find((e) => e.field === field)?.message;
  const warningOf = (field: HomeField) => warnings.find((w) => w.field === field)?.message;
  const described = (name: string, field: HomeField) =>
    [`${id(name)}-hint`, errorOf(field) ? `${id(name)}-erro` : null].filter(Boolean).join(" ");

  /* Ecos ao vivo. */
  const liveRate = parseRate(fields.rate);
  const rateEcho = Number.isFinite(liveRate)
    ? fields.rateUnit === "aa"
      ? `equivale a ${pct(toMonthlyRatePercent(liveRate, "aa"), 4)}% ao mês (taxa efetiva)`
      : `equivale a ${pct((Math.pow(1 + liveRate / 100, 12) - 1) * 100)}% ao ano (taxa efetiva)`
    : null;
  const liveMonths = parseMonths(fields.months);
  const monthsEcho = Number.isFinite(liveMonths) && liveMonths >= 12 ? monthsInWords(liveMonths) : null;
  const liveProperty = parseMoney(fields.property);
  const liveDown = fields.down.trim() === "" ? 0 : parseMoney(fields.down);
  const downEcho =
    fields.mode === "parcela" && Number.isFinite(liveProperty) && liveProperty > 0 && Number.isFinite(liveDown) && liveDown > 0
      ? `${pct((liveDown / liveProperty) * 100, 1)}% do imóvel · valor financiado de ${brl(liveProperty - liveDown)}`
      : null;

  const Title = context === "artigo" ? "h3" : "h2";
  const Sub = context === "artigo" ? "h4" : "h3";

  /* Tabelas de cenário do resultado. */
  let termRows: ScenarioRow[] = [];
  let downRows: Array<ScenarioRow & { current: boolean }> = [];
  if (shown?.mode === "parcela") {
    const r = shown.result;
    const terms = [...new Set([240, 300, 360, 420, r.financed.months])].sort((a, b) => a - b);
    termRows = termScenarios(r.financed.principalCents, shown.rate, shown.rateUnit, terms);
    downRows = downScenariosWithCurrent(r.propertyCents, r.downCents, shown.rate, shown.rateUnit, r.financed.months);
  }

  return (
    <section
      ref={rootRef}
      id="simulador"
      aria-label="Simulador de financiamento imobiliário"
      className="scroll-mt-24 rounded-2xl border border-brand-border bg-white p-3 shadow-sm sm:p-6"
    >
      <Segmented
        label="O que você quer saber"
        value={fields.mode}
        onChange={setMode}
        wide
        options={[
          { value: "parcela", label: "Quanto fica a parcela" },
          { value: "capacidade", label: "Quanto consigo financiar" },
        ]}
      />

      <form onSubmit={handleSubmit} noValidate className="mt-5">
        <div className="grid gap-5 sm:grid-cols-2">
          {fields.mode === "parcela" ? (
            <FieldShell id={id("imovel")} label="Valor do imóvel" hint="Preço da casa ou do apartamento" error={errorOf("propertyCents")}>
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-sm text-brand-muted" aria-hidden="true">R$</span>
                <input
                  id={id("imovel")}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="ex.: 400.000"
                  value={fields.property}
                  onChange={(e) => update({ property: e.target.value })}
                  onBlur={() => setFields((f) => ({ ...f, property: tidyMoney(f.property) }))}
                  aria-invalid={Boolean(errorOf("propertyCents"))}
                  aria-describedby={described("imovel", "propertyCents")}
                  className={inputClass}
                />
              </div>
            </FieldShell>
          ) : (
            <FieldShell
              id={id("parcela")}
              label="Parcela que cabe no seu mês"
              hint="O valor máximo que você quer pagar por mês"
              error={errorOf("paymentCents")}
            >
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-sm text-brand-muted" aria-hidden="true">R$</span>
                <input
                  id={id("parcela")}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="ex.: 3.000"
                  value={fields.payment}
                  onChange={(e) => update({ payment: e.target.value })}
                  onBlur={() => setFields((f) => ({ ...f, payment: tidyMoney(f.payment) }))}
                  aria-invalid={Boolean(errorOf("paymentCents"))}
                  aria-describedby={described("parcela", "paymentCents")}
                  className={inputClass}
                />
              </div>
            </FieldShell>
          )}

          <FieldShell
            id={id("entrada")}
            label={fields.mode === "parcela" ? "Entrada" : "Entrada disponível (opcional)"}
            hint={fields.mode === "parcela" ? "Em reais. Sem entrada, deixe vazio." : "Somada ao valor financiável, dá o valor do imóvel ao alcance."}
            error={errorOf("downCents")}
            note={downEcho ? <span aria-live="polite">{downEcho}</span> : null}
          >
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-sm text-brand-muted" aria-hidden="true">R$</span>
              <input
                id={id("entrada")}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="ex.: 80.000"
                value={fields.down}
                onChange={(e) => update({ down: e.target.value })}
                onBlur={() => setFields((f) => ({ ...f, down: tidyMoney(f.down) }))}
                aria-invalid={Boolean(errorOf("downCents"))}
                aria-describedby={described("entrada", "downCents")}
                className={inputClass}
              />
            </div>
          </FieldShell>

          <FieldShell
            id={id("taxa")}
            label="Taxa de juros"
            hint="A taxa efetiva da proposta. Em imóvel, ela costuma vir ao ano."
            error={errorOf("ratePercent")}
            note={
              <>
                {warningOf("ratePercent") ? <p className="font-medium text-brand-warning">{warningOf("ratePercent")}</p> : null}
                {rateEcho ? <p aria-live="polite">{rateEcho}</p> : null}
                {/* Atalho só com dado oficial: taxa ilustrativa não vira ponto de partida. */}
                {rateOffer.official ? (
                  <p className="mt-1">
                    Ainda sem proposta?{" "}
                    <button type="button" onClick={applyReference} className="font-semibold text-brand-teal underline underline-offset-2">
                      Usar {pct(rateOffer.annualRatePercent)}% ao ano ({rateOffer.label})
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
                placeholder={fields.rateUnit === "aa" ? "ex.: 11,50" : "ex.: 0,91"}
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
                  { value: "aa", label: "ao ano" },
                  { value: "am", label: "ao mês" },
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
              <span className="shrink-0 text-sm text-brand-muted" aria-hidden="true">meses</span>
            </div>
          </FieldShell>
        </div>

        {errors.length > 0 ? (
          <p role="alert" className="mt-4 rounded-lg border border-brand-danger/40 bg-brand-danger-soft p-3 text-sm text-brand-danger">
            {errors.length === 1
              ? "Um campo precisa de ajuste — ele está destacado acima."
              : `${errors.length} campos precisam de ajuste — eles estão destacados acima.`}
          </p>
        ) : null}

        <button
          type="submit"
          className="mt-5 min-h-12 w-full rounded-lg bg-brand-teal-dark px-6 font-semibold text-white hover:bg-brand-teal sm:w-auto"
        >
          {fields.mode === "parcela" ? "Calcular a parcela" : "Calcular quanto consigo financiar"}
        </button>
        <p className="mt-3 text-xs text-brand-muted">
          Sem cadastro · Sem CPF · O cálculo acontece no seu aparelho e nada do que você digita é enviado.
        </p>
      </form>

      <p className="sr-only" aria-live="polite">
        {shown && !stale
          ? shown.mode === "parcela"
            ? `SAC: primeira parcela de ${brl(shown.result.financed.sac.firstPaymentCents)}. Price: parcela de ${brl(shown.result.financed.price.firstPaymentCents)}.`
            : `Na Price, até ${brl(shown.result.priceMaxCents)} financiados. Na SAC, até ${brl(shown.result.sacMaxCents)}.`
          : ""}
      </p>

      <div ref={resultRef} className="scroll-mt-24">
        {shown ? (
          <div className={`mt-6 border-t border-brand-border pt-6 ${stale ? "opacity-60" : ""}`}>
            {examplePremise ? (
              <p className="mb-4 rounded-lg bg-brand-gold-soft px-3 py-2 text-sm text-brand-gold-dark">{examplePremise}</p>
            ) : null}
            {stale ? (
              <p className="mb-4 text-sm font-medium text-brand-warning">
                Resultado da última simulação válida. Ajuste o campo destacado para atualizar.
              </p>
            ) : null}

            {shown.mode === "parcela" ? (
              <ParcelaResult shown={shown} termRows={termRows} downRows={downRows} Title={Title} Sub={Sub} />
            ) : (
              <CapacityResultView shown={shown} Title={Title} onSimulate={showProperty} />
            )}
          </div>
        ) : null}
      </div>

      <p className="mt-6 rounded-lg border border-brand-warning/30 bg-brand-warning-soft p-4 text-sm leading-relaxed text-brand-warning">
        Simulação educativa, com taxa fixa e sem correção do saldo (sem TR ou IPCA). Não inclui seguros,
        tarifas, ITBI nem escritura, e não é o CET. A aprovação, o valor e a taxa dependem da análise de
        crédito da instituição.
      </p>
    </section>
  );
}

/* ---------- resultados ---------- */

function ParcelaResult({
  shown,
  termRows,
  downRows,
  Title,
  Sub,
}: {
  shown: Extract<Shown, { mode: "parcela" }>;
  termRows: ScenarioRow[];
  downRows: Array<ScenarioRow & { current: boolean }>;
  Title: "h2" | "h3";
  Sub: "h3" | "h4";
}) {
  const r = shown.result;
  const f = r.financed;
  return (
    <>
      <Title tabIndex={-1} data-result-heading className="font-serif text-xl font-bold text-brand-navy">
        Quanto fica o seu financiamento
      </Title>
      <p className="mt-1 text-sm text-brand-muted">
        Imóvel de {brl(r.propertyCents)}
        {r.downCents > 0 ? ` · entrada de ${brl(r.downCents)} (${pct(r.downShare * 100, 1)}%)` : " · sem entrada"} ·{" "}
        <strong className="text-brand-text">{brl(f.principalCents)} financiados</strong> · {monthsInWords(f.months)} ·{" "}
        {pct(f.annualRatePercent)}% ao ano
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border-2 border-brand-navy p-4">
          <p className="text-sm font-bold text-brand-navy">SAC · parcela decrescente</p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-brand-muted">1ª parcela</p>
          <p className="font-serif text-2xl font-bold tabular-nums text-brand-navy sm:text-3xl">{brl(f.sac.firstPaymentCents)}</p>
          <p className="mt-1 text-sm text-brand-muted">cai até {brl(f.sac.lastPaymentCents)} na última</p>
          <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-brand-border pt-3 text-sm tabular-nums">
            <div>
              <dt className="text-xs text-brand-muted">Juros no total</dt>
              <dd className="font-semibold">{brl(f.sac.totalInterestCents)}</dd>
            </div>
            <div>
              <dt className="text-xs text-brand-muted">Total das parcelas</dt>
              <dd className="font-semibold">{brl(f.sac.totalPaidCents)}</dd>
            </div>
          </dl>
        </div>
        <div className="rounded-xl border-2 border-brand-navy p-4">
          <p className="text-sm font-bold text-brand-navy">Price · parcela fixa</p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-brand-muted">Parcela</p>
          <p className="font-serif text-2xl font-bold tabular-nums text-brand-navy sm:text-3xl">{brl(f.price.firstPaymentCents)}</p>
          <p className="mt-1 text-sm text-brand-muted">
            {f.price.lastPaymentCents !== f.price.firstPaymentCents
              ? `a última, de ${brl(f.price.lastPaymentCents)}, acerta o arredondamento`
              : "igual do começo ao fim"}
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-brand-border pt-3 text-sm tabular-nums">
            <div>
              <dt className="text-xs text-brand-muted">Juros no total</dt>
              <dd className="font-semibold">{brl(f.price.totalInterestCents)}</dd>
            </div>
            <div>
              <dt className="text-xs text-brand-muted">Total das parcelas</dt>
              <dd className="font-semibold">{brl(f.price.totalPaidCents)}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="mt-5 rounded-xl bg-brand-teal-soft p-4 text-sm leading-relaxed text-brand-text">
        <p>
          <strong>E a renda?</strong> Se a instituição limitar a parcela a 30% da renda bruta — critério que a
          Caixa informa para o crédito habitacional —, a 1ª parcela da SAC pede renda familiar bruta de pelo
          menos <strong className="tabular-nums">{brlCeil(incomeForPayment(f.sac.firstPaymentCents, CAIXA_INCOME_SHARE))}</strong>; a
          da Price, <strong className="tabular-nums">{brlCeil(incomeForPayment(f.price.firstPaymentCents, CAIXA_INCOME_SHARE))}</strong>.
          Cada instituição tem o próprio critério, e ele não diz se a parcela cabe no seu mês.{" "}
          <Link href="/organizacao-financeira/quanto-da-renda-comprometer-financiamento-imovel/" className="font-semibold text-brand-teal underline underline-offset-2">
            Quanto da renda comprometer
          </Link>
        </p>
      </div>

      {termRows.length > 1 ? (
        <div className="mt-6">
          <Sub className="font-serif text-lg font-bold text-brand-navy">Como o prazo muda a parcela</Sub>
          <p className="mt-1 text-sm text-brand-muted">Mesmo valor financiado e mesma taxa; só o prazo muda.</p>
          <ScenarioTable
            caption="Primeira parcela e juros em prazos diferentes"
            head={["Prazo", "SAC — 1ª parcela", "Price — parcela", "Juros SAC", "Juros Price"]}
            rows={termRows.map((row) => ({
              key: String(row.months),
              current: row.months === f.months,
              cells: [
                monthsInWords(row.months),
                brl(row.result.sac.firstPaymentCents),
                brl(row.result.price.firstPaymentCents),
                brl(row.result.sac.totalInterestCents),
                brl(row.result.price.totalInterestCents),
              ],
            }))}
          />
        </div>
      ) : null}

      {downRows.length > 1 ? (
        <div className="mt-6">
          <Sub className="font-serif text-lg font-bold text-brand-navy">Como a entrada muda a parcela</Sub>
          <p className="mt-1 text-sm text-brand-muted">Mesmo imóvel, mesma taxa e mesmo prazo; só a entrada muda.</p>
          <ScenarioTable
            caption="Parcela e juros com entradas diferentes"
            head={["Entrada", "Financiado", "SAC — 1ª parcela", "Price — parcela", "Juros Price"]}
            rows={downRows.map((row) => ({
              key: String(row.downCents),
              current: row.current,
              cells: [
                `${brl(row.downCents ?? 0)} (${pct(((row.downCents ?? 0) / r.propertyCents) * 100, row.current ? 1 : 0)}%)`,
                brl(row.principalCents),
                brl(row.result.sac.firstPaymentCents),
                brl(row.result.price.firstPaymentCents),
                brl(row.result.price.totalInterestCents),
              ],
            }))}
          />
        </div>
      ) : null}

      <p className="mt-6 text-sm">
        <Link href="/calculadoras/sac-x-price/" className="font-semibold text-brand-teal underline underline-offset-2">
          Ver gráficos, saldo devedor e tabela completa na Calculadora SAC x Price
        </Link>
      </p>
      <p className="mt-2 text-sm">
        <Link href="/calculadoras/cet/" className="font-semibold text-brand-teal underline underline-offset-2">
          Tem a proposta do banco? Calcule o CET com seguros e tarifas
        </Link>{" "}
        <span className="text-brand-muted">— TR e outros indexadores não entram no CET.</span>
      </p>
    </>
  );
}

function CapacityResultView({
  shown,
  Title,
  onSimulate,
}: {
  shown: Extract<Shown, { mode: "capacidade" }>;
  Title: "h2" | "h3";
  onSimulate: (propertyCents: number) => void;
}) {
  const r = shown.result;
  const down = shown.downCents;
  const income = incomeForPayment(r.paymentCents, CAIXA_INCOME_SHARE);
  const rows = [
    { key: "sac", title: "SAC · 1ª parcela de até", value: r.sacMaxCents },
    { key: "price", title: "Price · parcela de até", value: r.priceMaxCents },
  ] as const;
  return (
    <>
      <Title tabIndex={-1} data-result-heading className="font-serif text-xl font-bold text-brand-navy">
        Quanto dá para financiar com {brl(r.paymentCents)} por mês
      </Title>
      <p className="mt-1 text-sm text-brand-muted">
        {monthsInWords(r.months)} · {pct(toMonthlyRatePercent(shown.rate, shown.rateUnit), 4)}% ao mês
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.key} className="rounded-xl border-2 border-brand-navy p-4">
            <p className="text-sm font-bold text-brand-navy">
              {row.title} {brl(r.paymentCents)}
            </p>
            {row.value === 0 ? (
              <p className="mt-2 text-sm text-brand-text">
                Com essa parcela, o valor fica abaixo do mínimo do simulador (R$ 1.000).
              </p>
            ) : (
              <>
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-brand-muted">Valor financiado de até</p>
                <p className="font-serif text-2xl font-bold tabular-nums text-brand-navy sm:text-3xl">{brlFloor(row.value)}</p>
                {r.capped ? <p className="mt-1 text-xs text-brand-muted">limite do simulador</p> : null}
                {down > 0 ? (
                  <p className="mt-1 text-sm text-brand-text">
                    Com {brl(down)} de entrada: imóvel de até <strong className="tabular-nums">{brlFloor(row.value + down)}</strong>
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={() => onSimulate(Math.floor(row.value / 100) * 100 + down)}
                  className="mt-3 min-h-11 text-sm font-semibold text-brand-teal underline underline-offset-2"
                >
                  Ver a parcela desse imóvel
                </button>
              </>
            )}
          </div>
        ))}
      </div>
      <div className="mt-5 space-y-2 rounded-xl bg-brand-teal-soft p-4 text-sm leading-relaxed text-brand-text">
        <p>
          Com a mesma parcela, a Price alcança um valor maior porque a parcela dela fica fixa até o fim; na
          SAC, a 1ª parcela é a maior do contrato e as seguintes caem. Na Price, a última parcela acerta o
          arredondamento dos centavos e pode ficar alguns reais acima ou abaixo das outras.
        </p>
        <p>
          Se a instituição limitar a parcela a 30% da renda bruta — critério que a Caixa informa —, uma parcela
          de {brl(r.paymentCents)} corresponde a renda familiar bruta de pelo menos{" "}
          <strong className="tabular-nums">{brlCeil(income)}</strong>. A aprovação e o valor máximo dependem da
          análise de crédito, da cota de financiamento e das regras de cada instituição.
        </p>
      </div>
    </>
  );
}
