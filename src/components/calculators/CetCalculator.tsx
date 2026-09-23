"use client";

/**
 * CALCULADORA DE CET
 * ============================================================================
 *
 * Uma ferramenta de FLUXO DE CAIXA, não de soma de taxas. Pergunta: "quanto
 * esta proposta custa de verdade, considerando o que chega, o que sai e
 * quando?".
 *
 * DECISÕES QUE NÃO SÃO ÓBVIAS
 *
 * - O ponto de partida é o valor que chega para a pessoa ou o vendedor, as
 *   parcelas e as datas. A taxa anunciada e o CET informado são opcionais:
 *   servem para comparar, não para calcular.
 * - Toda taxa sai do motor único (`cash-flow.ts`), na convenção da Resolução
 *   CMN 4.881 (dias corridos ÷ 365). Nada de taxa é calculado aqui.
 * - Nome do resultado: "CET estimado com os valores informados" só quando a
 *   pessoa confirma que informou todos os custos; senão, "taxa efetiva
 *   estimada do fluxo informado". Nunca "CET oficial".
 * - Diferença grande para o CET informado vira "revise os dados", com uma
 *   lista do que pode estar faltando — nunca acusação à instituição.
 * - Nada do que é digitado sai do navegador; a medição leva só contagens.
 */

import Link from "next/link";
import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { track } from "@/lib/analytics/track";
import { parseBRLToCents, parsePercentBR } from "@/lib/calculators/proposal-comparison";
import { pricePayment } from "@/lib/calculators/loan";
import { annualToMonthly, solveAnnualRate, type Flow } from "@/lib/calculators/cash-flow";
import {
  CET_DIFF_TOLERANCE_PP,
  CET_RULES,
  COST_KIND_LABEL,
  COST_MODE_LABEL,
  analyzeProposal,
  compareCet,
  type Cost,
  type CostKind,
  type CostMode,
  type Indexer,
  type OperationKind,
  type ProposalInput,
  type ProposalIssue,
  type ProposalOutcome,
  type ProposalResult,
} from "@/lib/calculators/cet";
import { addMonths, formatIsoDate, todayInBrazil } from "@/lib/calculators/civil-date";
import { useRevealResult } from "./use-reveal-result";

export const CET_PREFILL_EVENT = "cpp:simular-cet";

export interface CetPrefillDetail {
  exampleId: string;
  receivedCents: number;
  installments: number;
  installmentCents: number;
  costs: Cost[];
  announcedMonthlyPercent?: number;
}

type Mode = "proposta" | "simular" | "comparar";

interface CostFields {
  kind: CostKind;
  label: string;
  amount: string;
  mode: CostMode;
  date: string;
}

interface Fields {
  received: string;
  installments: string;
  installment: string;
  rate: string;
  rateUnit: "am" | "aa";
  releaseDate: string;
  firstDueDate: string;
  firstDueTouched: boolean;
  costs: CostFields[];
  allCosts: boolean;
  cetInformed: string;
  financedInformed: string;
  indexer: Indexer;
  operation: OperationKind;
  irregular: string;
}

interface OfferFields {
  received: string;
  installments: string;
  installment: string;
  upfront: string;
  rate: string;
  cet: string;
}

interface ManualRow {
  date: string;
  description: string;
  receive: string;
  pay: string;
}

const EMPTY_OFFER: OfferFields = { received: "", installments: "", installment: "", upfront: "", rate: "", cet: "" };
const LABELS = ["Proposta A", "Proposta B", "Proposta C"] as const;

/* ---------- formatação ---------- */

const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const pct = (v: number, digits = 2) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const moneyInput = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (raw: string) => (raw.trim() === "" ? Number.NaN : (parseBRLToCents(raw) ?? Number.NaN));
const optMoney = (raw: string) => (raw.trim() === "" ? undefined : money(raw));
const optPct = (raw: string) => (raw.trim() === "" ? undefined : (parsePercentBR(raw) ?? Number.NaN));
const intOf = (raw: string) => (/^\d+$/.test(raw.trim()) ? Number(raw.trim()) : Number.NaN);
/** Taxa anual (fração) → "26,90% a.a.". */
const annual = (fraction: number) => `${pct(fraction * 100)}% a.a.`;

function tidyMoney(raw: string): string {
  const cents = parseBRLToCents(raw);
  return cents === null ? raw : moneyInput(cents);
}

function toCosts(list: CostFields[]): Cost[] {
  return list
    .filter((c) => c.amount.trim() !== "")
    .map((c) => ({ kind: c.kind, label: c.label.trim() || undefined, amountCents: money(c.amount), mode: c.mode, date: c.mode === "data" ? c.date : undefined }));
}

function toInput(f: Fields, mode: Mode): ProposalInput {
  const irregular = f.irregular
    .split(/[;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => parseBRLToCents(s) ?? Number.NaN);
  const costs = toCosts(f.costs);
  let installmentCents = money(f.installment);
  const n = intOf(f.installments);
  const rate = optPct(f.rate);
  if (mode === "simular") {
    // Simulação: parcelas pela Price sobre o valor recebido + custos financiados e descontados.
    const principal = money(f.received) + costs.filter((c) => c.mode === "financiado" || c.mode === "descontado").reduce((s, c) => s + c.amountCents, 0);
    const monthly = rate === undefined ? Number.NaN : f.rateUnit === "am" ? rate / 100 : annualToMonthly(rate / 100);
    installmentCents = Number.isFinite(monthly) && n >= 1 ? Math.round(pricePayment(principal, monthly, n)) : Number.NaN;
  }
  return {
    receivedCents: money(f.received),
    installments: n,
    installmentCents,
    irregularInstallmentsCents: mode === "proposta" && irregular.length > 0 ? irregular : undefined,
    releaseDate: f.releaseDate,
    firstDueDate: f.firstDueDate,
    costs,
    allCostsInformed: f.allCosts,
    announcedRate: rate === undefined ? undefined : { value: rate, unit: f.rateUnit },
    cetInformedPercent: mode === "proposta" ? optPct(f.cetInformed) : undefined,
    financedInformedCents: mode === "proposta" ? optMoney(f.financedInformed) : undefined,
    indexer: f.indexer,
    operation: f.operation,
  };
}

/* ---------- peças ---------- */

const inputClass =
  "min-h-12 w-full min-w-0 rounded-lg border border-brand-border bg-white px-3 py-2.5 text-base text-brand-text tabular-nums focus:border-brand-teal aria-[invalid=true]:border-brand-danger";

function Field({
  id,
  label,
  hint,
  error,
  prefix,
  suffix,
  value,
  placeholder,
  numeric,
  type = "text",
  onChange,
  onBlur,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  prefix?: string;
  suffix?: string;
  value: string;
  placeholder?: string;
  numeric?: boolean;
  type?: "text" | "date";
  onChange: (v: string) => void;
  onBlur?: () => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-brand-navy">{label}</label>
      {hint ? <p id={`${id}-hint`} className="mt-0.5 text-xs leading-relaxed text-brand-muted">{hint}</p> : null}
      <div className="mt-1.5 flex items-center gap-2">
        {prefix ? <span className="shrink-0 text-sm text-brand-muted" aria-hidden="true">{prefix}</span> : null}
        <input
          id={id}
          type={type}
          inputMode={type === "date" ? undefined : numeric ? "numeric" : "decimal"}
          autoComplete="off"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(numeric ? e.target.value.replace(/\D/g, "") : e.target.value)}
          onBlur={onBlur}
          aria-invalid={Boolean(error)}
          aria-describedby={[hint ? `${id}-hint` : null, error ? `${id}-erro` : null].filter(Boolean).join(" ") || undefined}
          className={inputClass}
        />
        {suffix ? <span className="shrink-0 text-sm text-brand-muted" aria-hidden="true">{suffix}</span> : null}
      </div>
      {error ? <p id={`${id}-erro`} className="mt-1.5 text-sm font-medium text-brand-danger">{error}</p> : null}
    </div>
  );
}

function Segmented<T extends string>({ label, value, options, onChange, wide }: { label: string; value: T; options: ReadonlyArray<{ value: T; label: string }>; onChange: (v: T) => void; wide?: boolean }) {
  return (
    <div role="group" aria-label={label} className={`flex flex-wrap rounded-lg border border-brand-border p-0.5 ${wide ? "w-full sm:w-auto" : "w-fit"}`}>
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

function Row({ label, value, strong, note }: { label: string; value: string; strong?: boolean; note?: string }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-2.5 ${strong ? "border-t-2 border-brand-navy/20" : "border-t border-brand-border"}`}>
      <dt className={`text-sm ${strong ? "font-bold text-brand-navy" : "text-brand-text"}`}>
        {label}
        {note ? <span className="block text-xs font-normal text-brand-muted">{note}</span> : null}
      </dt>
      <dd className={`${value.length > 22 ? "min-w-0 max-w-[60%]" : "shrink-0"} text-right tabular-nums ${strong ? "text-lg font-bold text-brand-navy" : "font-semibold text-brand-text"}`}>{value}</dd>
    </div>
  );
}

/** Botão dos exemplos da página. */
export function SimulateCetButton({ label, detail }: { label: string; detail: CetPrefillDetail }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent<CetPrefillDetail>(CET_PREFILL_EVENT, { detail }))}
      className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-brand-navy px-4 text-sm font-semibold text-brand-navy hover:bg-brand-teal-soft"
    >
      {label}
    </button>
  );
}

/* ---------- componente ---------- */

type Shown =
  | { mode: "proposta" | "simular"; outcome: ProposalOutcome }
  | { mode: "comparar"; results: ProposalResult[]; announced: Array<number | null> }
  | { mode: "manual"; rate: number | null; problem: string | null; flows: Flow[] };

export function CetCalculator({ today, context = "ferramenta" }: { today: string; context?: "ferramenta" | "artigo" }) {
  const uid = useId();
  const id = (n: string) => `${uid}-${n}`;
  const [mode, setMode] = useState<Mode>("proposta");
  const [f, setF] = useState<Fields>({
    received: "",
    installments: "",
    installment: "",
    rate: "",
    rateUnit: "am",
    releaseDate: today,
    firstDueDate: addMonths(today, 1),
    firstDueTouched: false,
    costs: [],
    allCosts: false,
    cetInformed: "",
    financedInformed: "",
    indexer: "nenhum",
    operation: "definida",
    irregular: "",
  });
  const [offers, setOffers] = useState<OfferFields[]>([EMPTY_OFFER, EMPTY_OFFER]);
  const [manual, setManual] = useState<ManualRow[]>([
    { date: today, description: "Valor recebido", receive: "", pay: "" },
    { date: addMonths(today, 1), description: "Parcela 1", receive: "", pay: "" },
  ]);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<ProposalIssue[]>([]);
  const [offerErrors, setOfferErrors] = useState<string | null>(null);
  const [shown, setShown] = useState<Shown | null>(null);
  const [premise, setPremise] = useState<string | null>(null);
  const rootRef = useRef<HTMLElement | null>(null);
  const { ref: resultRef, reveal } = useRevealResult();

  const syncToday = useEffectEvent(() => {
    const now = todayInBrazil();
    if (now !== today && f.releaseDate === today) setF((s) => ({ ...s, releaseDate: now, firstDueDate: s.firstDueTouched ? s.firstDueDate : addMonths(now, 1) }));
  });
  useEffect(() => {
    const timer = window.setTimeout(syncToday, 0);
    track("cet_calculator_view", { context });
    return () => window.clearTimeout(timer);
  }, [context]);

  function compute(next: Fields, m: Mode, { announce }: { announce: boolean }) {
    const outcome = analyzeProposal(toInput(next, m));
    if (outcome.kind === "invalid") {
      setErrors(outcome.errors);
      return;
    }
    setErrors([]);
    setShown({ mode: m === "simular" ? "simular" : "proposta", outcome });
    if (announce) {
      track("cet_calculation_completed", {
        context,
        mode: m,
        costs: next.costs.filter((c) => c.amount.trim() !== "").length,
        all_costs: next.allCosts,
        cet_informed: next.cetInformed.trim() !== "",
        outcome: outcome.kind,
      });
    }
  }

  function computeOffers(list: OfferFields[], { announce }: { announce: boolean }) {
    const results: ProposalResult[] = [];
    for (const [i, o] of list.entries()) {
      const outcome = analyzeProposal({
        receivedCents: money(o.received),
        installments: intOf(o.installments),
        installmentCents: money(o.installment),
        releaseDate: f.releaseDate,
        firstDueDate: f.firstDueDate,
        costs: optMoney(o.upfront) ? [{ kind: "outro", label: "Custos pagos à parte", amountCents: money(o.upfront), mode: "antecipado" }] : [],
        allCostsInformed: false,
        announcedRate: optPct(o.rate) === undefined ? undefined : { value: optPct(o.rate)!, unit: "am" },
        cetInformedPercent: optPct(o.cet),
        indexer: "nenhum",
        operation: "definida",
      });
      if (outcome.kind !== "ok") {
        setOfferErrors(`${LABELS[i]}: confira valor recebido, número de parcelas, valor da parcela e custos.`);
        return;
      }
      results.push(outcome.result);
    }
    setOfferErrors(null);
    setShown({ mode: "comparar", results, announced: results.map((r) => r.announcedAnnual) });
    if (announce) track("cet_calculation_completed", { context, mode: "comparar", costs: 0, all_costs: false, cet_informed: list.some((o) => o.cet.trim() !== ""), outcome: "ok" });
  }

  function update(patch: Partial<Fields>) {
    const next = { ...f, ...patch };
    if (patch.releaseDate && !next.firstDueTouched) next.firstDueDate = addMonths(patch.releaseDate, 1);
    setF(next);
    setPremise(null);
    if (submitted && mode !== "comparar") compute(next, mode, { announce: false });
  }

  function updateCost(i: number, patch: Partial<CostFields>) {
    update({ costs: f.costs.map((c, k) => (k === i ? { ...c, ...patch } : c)) });
  }

  function addCost(kind: CostKind = "tarifa") {
    track("cet_cost_added", { context, kind });
    update({ costs: [...f.costs, { kind, label: "", amount: "", mode: kind === "iof" ? "financiado" : "antecipado", date: f.releaseDate }] });
  }

  function updateOffer(i: number, patch: Partial<OfferFields>) {
    const next = offers.map((o, k) => (k === i ? { ...o, ...patch } : o));
    setOffers(next);
    if (submitted && mode === "comparar") computeOffers(next, { announce: false });
  }

  function switchMode(m: Mode) {
    if (m === mode) return;
    if (m === "comparar") track("cet_comparison_started", { context });
    setMode(m);
    setShown(null);
    setSubmitted(false);
    setErrors([]);
    setOfferErrors(null);
    setPremise(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (mode === "comparar") computeOffers(offers, { announce: true });
    else compute(f, mode, { announce: true });
    reveal();
  }

  function computeManual() {
    const flows: Flow[] = manual.flatMap((r) => {
      const receive = optMoney(r.receive) ?? 0;
      const pay = optMoney(r.pay) ?? 0;
      const amount = (Number.isFinite(receive) ? receive : Number.NaN) - (Number.isFinite(pay) ? pay : Number.NaN);
      return r.date && amount !== 0 ? [{ date: r.date, amountCents: amount, description: r.description || "—" }] : [];
    });
    const d0 = flows.map((x) => x.date).sort()[0] ?? "";
    const o = solveAnnualRate(flows, d0);
    setShown({
      mode: "manual",
      flows,
      rate: o.kind === "ok" ? o.annualRate : null,
      problem:
        o.kind === "ok"
          ? null
          : "Este fluxo possui estrutura incomum e pode não permitir uma interpretação única por esta calculadora. Use recebimentos na primeira data e pagamentos depois, com datas e valores preenchidos.",
    });
    track("cet_calculation_completed", { context, mode: "manual", costs: 0, all_costs: false, cet_informed: false, outcome: o.kind });
    reveal();
  }

  function prefill(d: CetPrefillDetail) {
    track("cet_example_select", { context, example: d.exampleId });
    const next: Fields = {
      ...f,
      received: moneyInput(d.receivedCents),
      installments: String(d.installments),
      installment: moneyInput(d.installmentCents),
      rate: d.announcedMonthlyPercent !== undefined ? pct(d.announcedMonthlyPercent) : "",
      rateUnit: "am",
      costs: d.costs.map((c) => ({ kind: c.kind, label: c.label ?? "", amount: moneyInput(c.amountCents), mode: c.mode, date: c.date ?? f.releaseDate })),
      allCosts: true,
      cetInformed: "",
      financedInformed: "",
      irregular: "",
    };
    setMode("proposta");
    setF(next);
    setSubmitted(true);
    setPremise("Exemplo da página, com parcelas pela Price e primeira parcela um mês após a liberação. Troque pelos números da sua proposta.");
    compute(next, "proposta", { announce: true });
    rootRef.current?.scrollIntoView({ block: "start" });
    reveal();
  }
  const onPrefill = useEffectEvent((d: CetPrefillDetail) => prefill(d));
  useEffect(() => {
    const listener = (e: Event) => onPrefill((e as CustomEvent<CetPrefillDetail>).detail);
    window.addEventListener(CET_PREFILL_EVENT, listener);
    return () => window.removeEventListener(CET_PREFILL_EVENT, listener);
  }, []);

  const errorOf = (field: ProposalIssue["field"]) => errors.find((e) => e.field === field)?.message;
  const Title = context === "artigo" ? "h3" : "h2";
  const Sub = context === "artigo" ? "h4" : "h3";

  const costsEditor = (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-brand-muted">Inclua somente custos vinculados à contratação ou à operação — não despesas pessoais, como o deslocamento até o banco.</p>
      {f.costs.map((c, i) => (
        <fieldset key={i} className="rounded-lg border border-brand-border p-3">
          <legend className="px-1 text-sm font-semibold text-brand-navy">
            {COST_KIND_LABEL[c.kind]}
            <button type="button" onClick={() => update({ costs: f.costs.filter((_, k) => k !== i) })} className="ml-3 min-h-11 px-2 text-xs font-semibold text-brand-muted underline">remover</button>
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={id(`ck-${i}`)} className="block text-sm font-semibold text-brand-navy">Tipo</label>
              <select id={id(`ck-${i}`)} value={c.kind} onChange={(e) => updateCost(i, { kind: e.target.value as CostKind })} className={`${inputClass} mt-1.5`}>
                {(Object.keys(COST_KIND_LABEL) as CostKind[]).map((k) => <option key={k} value={k}>{COST_KIND_LABEL[k]}</option>)}
              </select>
            </div>
            <Field id={id(`cv-${i}`)} label={c.mode === "por-parcela" ? "Valor em cada parcela" : "Valor"} prefix="R$" placeholder="0,00" value={c.amount} onChange={(amount) => updateCost(i, { amount })} onBlur={() => updateCost(i, { amount: tidyMoney(c.amount) })} />
            <div>
              <label htmlFor={id(`cm-${i}`)} className="block text-sm font-semibold text-brand-navy">Como este custo foi pago?</label>
              <select id={id(`cm-${i}`)} value={c.mode} onChange={(e) => updateCost(i, { mode: e.target.value as CostMode })} className={`${inputClass} mt-1.5`}>
                {(Object.keys(COST_MODE_LABEL) as CostMode[]).map((m) => <option key={m} value={m}>{COST_MODE_LABEL[m].charAt(0).toUpperCase() + COST_MODE_LABEL[m].slice(1)}</option>)}
              </select>
            </div>
            {c.mode === "data" ? <Field id={id(`cd-${i}`)} label="Data do pagamento" type="date" value={c.date} onChange={(date) => updateCost(i, { date })} /> : null}
            {c.kind === "outro" || c.kind === "terceiros" ? <Field id={id(`cl-${i}`)} label="Nome (opcional)" value={c.label} placeholder="ex.: despachante" onChange={(label) => updateCost(i, { label })} /> : null}
          </div>
          {c.kind === "iof" ? (
            <p className="mt-2 text-xs text-brand-muted">
              Não sabe o IOF? <Link href="/calculadoras/iof-emprestimo/" onClick={() => track("cet_internal_cta_clicked", { context, target: "iof" })} className="font-semibold text-brand-teal underline">Calcule na calculadora de IOF</Link> e volte com o valor.
            </p>
          ) : null}
        </fieldset>
      ))}
      <div className="flex flex-wrap gap-2">
        {(["iof", "tarifa", "seguro", "outro"] as CostKind[]).map((k) => (
          <button key={k} type="button" onClick={() => addCost(k)} className="min-h-11 rounded-lg border border-dashed border-brand-navy px-3 text-sm font-semibold text-brand-navy">
            + {COST_KIND_LABEL[k]}
          </button>
        ))}
      </div>
      {errorOf("costs") ? <p className="text-sm font-medium text-brand-danger">{errorOf("costs")}</p> : null}
      <label className="flex min-h-11 items-start gap-2 text-sm text-brand-text">
        <input type="checkbox" checked={f.allCosts} onChange={(e) => update({ allCosts: e.target.checked })} className="mt-1 h-5 w-5 shrink-0" />
        <span>Informei todos os custos da proposta (IOF, tarifas, seguros e outros cobrados na operação).</span>
      </label>
    </div>
  );

  return (
    <section ref={rootRef} id="calculadora" aria-label="Calculadora de CET" className="scroll-mt-24 rounded-2xl border border-brand-border bg-white p-3 shadow-sm sm:p-6">
      <p className="text-sm font-semibold text-brand-navy">Já tem uma proposta?</p>
      <div className="mt-2">
        <Segmented
          label="Como você quer usar a calculadora"
          value={mode}
          onChange={switchMode}
          wide
          options={[
            { value: "proposta", label: "Sim, analisar minha proposta" },
            { value: "simular", label: "Não, quero simular" },
            { value: "comparar", label: "Comparar até 3" },
          ]}
        />
      </div>

      <form onSubmit={handleSubmit} noValidate className="mt-5">
        {mode !== "comparar" ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id={id("rec")} label="Quanto chega para você (ou para o vendedor)?" hint="O valor liberado de fato, depois de qualquer desconto." prefix="R$" placeholder="ex.: 10.000" value={f.received} error={errorOf("receivedCents")} onChange={(received) => update({ received })} onBlur={() => setF((s) => ({ ...s, received: tidyMoney(s.received) }))} />
              <Field id={id("n")} label="Quantas parcelas?" placeholder="ex.: 24" numeric value={f.installments} error={errorOf("installments")} onChange={(installments) => update({ installments })} />
              {mode === "proposta" ? (
                <Field id={id("parc")} label="Valor de cada parcela" prefix="R$" placeholder="ex.: 520,00" value={f.installment} error={errorOf("installmentCents")} onChange={(installment) => update({ installment })} onBlur={() => setF((s) => ({ ...s, installment: tidyMoney(s.installment) }))} />
              ) : null}
              <div>
                <label htmlFor={id("taxa")} className="block text-sm font-semibold text-brand-navy">
                  {mode === "simular" ? "Taxa de juros" : "Taxa de juros anunciada (opcional)"}
                </label>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <input id={id("taxa")} type="text" inputMode="decimal" autoComplete="off" placeholder={mode === "simular" ? "ex.: 1,5" : "da proposta"} value={f.rate} onChange={(e) => update({ rate: e.target.value })} aria-invalid={Boolean(errorOf("announcedRate") || (mode === "simular" && errorOf("installmentCents")))} className={`${inputClass} max-w-[8rem]`} />
                  <span className="text-sm text-brand-muted" aria-hidden="true">%</span>
                  <Segmented label="Unidade da taxa" value={f.rateUnit} onChange={(rateUnit) => update({ rateUnit })} options={[{ value: "am", label: "ao mês" }, { value: "aa", label: "ao ano" }]} />
                </div>
                {mode === "simular" && errorOf("installmentCents") ? <p className="mt-1.5 text-sm font-medium text-brand-danger">Informe a taxa de juros para simular as parcelas.</p> : null}
              </div>
              <Field id={id("lib")} label="Quando recebeu (ou vai receber) o crédito?" type="date" value={f.releaseDate} error={errorOf("releaseDate")} onChange={(releaseDate) => releaseDate && update({ releaseDate })} />
              <Field id={id("venc")} label="Quando vence a primeira parcela?" type="date" value={f.firstDueDate} error={errorOf("firstDueDate")} onChange={(firstDueDate) => firstDueDate && update({ firstDueDate, firstDueTouched: true })} />
            </div>

            <details className="mt-5 rounded-lg border border-brand-border" open={f.costs.length > 0 || undefined}>
              <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-semibold text-brand-navy">+ Adicionar IOF, tarifas, seguro e outros custos</summary>
              <div className="border-t border-brand-border p-4">{costsEditor}</div>
            </details>

            {mode === "proposta" ? (
              <details className="mt-3 rounded-lg border border-brand-border">
                <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-semibold text-brand-navy">Conferir com a proposta: CET informado, valor financiado, indexador</summary>
                <div className="grid gap-4 border-t border-brand-border p-4 sm:grid-cols-2">
                  <Field id={id("cetinf")} label="CET informado na proposta (opcional)" suffix="% a.a." placeholder="ex.: 28,40" value={f.cetInformed} error={errorOf("cetInformedPercent")} onChange={(cetInformed) => update({ cetInformed })} />
                  <Field id={id("fin")} label="Valor financiado na proposta (opcional)" prefix="R$" placeholder="ex.: 10.800" value={f.financedInformed} error={errorOf("financedInformedCents")} onChange={(financedInformed) => update({ financedInformed })} onBlur={() => setF((s) => ({ ...s, financedInformed: tidyMoney(s.financedInformed) }))} />
                  <div>
                    <label htmlFor={id("idx")} className="block text-sm font-semibold text-brand-navy">Indexador ou taxa variável</label>
                    <select id={id("idx")} value={f.indexer} onChange={(e) => update({ indexer: e.target.value as Indexer })} className={`${inputClass} mt-1.5`}>
                      <option value="nenhum">Nenhum (taxa prefixada)</option>
                      <option value="tr">TR</option>
                      <option value="ipca">IPCA</option>
                      <option value="outro">Outro indexador</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor={id("op")} className="block text-sm font-semibold text-brand-navy">Tipo de operação</label>
                    <select id={id("op")} value={f.operation} onChange={(e) => update({ operation: e.target.value as OperationKind })} className={`${inputClass} mt-1.5`}>
                      <option value="definida">Empréstimo, financiamento ou parcelamento</option>
                      <option value="rotativo">Cheque especial ou crédito rotativo</option>
                      <option value="rural">Crédito rural</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor={id("irr")} className="block text-sm font-semibold text-brand-navy">Parcelas diferentes (opcional)</label>
                    <p className="mt-0.5 text-xs text-brand-muted">Um valor por parcela, separados por ponto e vírgula. Substitui “número × valor da parcela”.</p>
                    <textarea id={id("irr")} rows={2} value={f.irregular} onChange={(e) => update({ irregular: e.target.value })} placeholder="ex.: 500; 500; 750; 800" className={`${inputClass} mt-1.5`} />
                  </div>
                </div>
              </details>
            ) : null}
          </>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-brand-muted">Mesma data de liberação e de primeira parcela para todas; os demais números vêm de cada proposta.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id={id("clib")} label="Liberação" type="date" value={f.releaseDate} onChange={(releaseDate) => releaseDate && update({ releaseDate })} />
              <Field id={id("cvenc")} label="Primeira parcela" type="date" value={f.firstDueDate} onChange={(firstDueDate) => firstDueDate && update({ firstDueDate, firstDueTouched: true })} />
            </div>
            {offers.map((o, i) => (
              <fieldset key={i} className="rounded-xl border border-brand-border p-3 sm:p-4">
                <legend className="px-1 text-sm font-bold text-brand-navy">
                  {LABELS[i]}
                  {i > 1 ? <button type="button" onClick={() => setOffers(offers.filter((_, k) => k !== i))} className="ml-3 min-h-11 px-2 text-xs font-semibold text-brand-muted underline">remover</button> : null}
                </legend>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field id={id(`or-${i}`)} label="Valor que chega" prefix="R$" value={o.received} onChange={(received) => updateOffer(i, { received })} onBlur={() => updateOffer(i, { received: tidyMoney(o.received) })} />
                  <Field id={id(`on-${i}`)} label="Parcelas" numeric value={o.installments} onChange={(installments) => updateOffer(i, { installments })} />
                  <Field id={id(`op-${i}`)} label="Valor da parcela" prefix="R$" value={o.installment} onChange={(installment) => updateOffer(i, { installment })} onBlur={() => updateOffer(i, { installment: tidyMoney(o.installment) })} />
                  <Field id={id(`ou-${i}`)} label="Custos pagos à parte (opcional)" prefix="R$" value={o.upfront} onChange={(upfront) => updateOffer(i, { upfront })} />
                  <Field id={id(`ot-${i}`)} label="Taxa anunciada (opcional)" suffix="% a.m." value={o.rate} onChange={(rate) => updateOffer(i, { rate })} />
                  <Field id={id(`oc-${i}`)} label="CET informado (opcional)" suffix="% a.a." value={o.cet} onChange={(cet) => updateOffer(i, { cet })} />
                </div>
              </fieldset>
            ))}
            {offers.length < 3 ? (
              <button type="button" onClick={() => { track("cet_offer_added", { context }); setOffers([...offers, EMPTY_OFFER]); }} className="min-h-11 rounded-lg border border-dashed border-brand-navy px-4 text-sm font-semibold text-brand-navy">
                + Adicionar a terceira proposta
              </button>
            ) : null}
            {offerErrors ? <p role="alert" className="text-sm font-medium text-brand-danger">{offerErrors}</p> : null}
          </div>
        )}

        {errors.length > 0 ? (
          <p role="alert" className="mt-4 rounded-lg border border-brand-danger/40 bg-brand-danger-soft p-3 text-sm text-brand-danger">
            {errors.length === 1 ? "Um campo precisa de ajuste — ele está destacado acima." : "Alguns campos precisam de ajuste — eles estão destacados acima."}
          </p>
        ) : null}

        <button type="submit" className="mt-5 min-h-12 w-full rounded-lg bg-brand-teal-dark px-6 font-semibold text-white hover:bg-brand-teal sm:w-auto">
          {mode === "comparar" ? "Comparar propostas" : "Calcular custo"}
        </button>
        <p className="mt-3 text-xs text-brand-muted">Sem CPF · Sem cadastro · Cálculo educativo · Nada do que você digita sai do seu aparelho.</p>
      </form>

      {mode === "proposta" ? (
        <details className="mt-5 rounded-lg border border-brand-border" onToggle={(e) => { if ((e.currentTarget as HTMLDetailsElement).open) track("cet_flow_opened", { context }); }}>
          <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-semibold text-brand-navy">Montar o fluxo manualmente (avançado)</summary>
          <div className="space-y-3 border-t border-brand-border p-4">
            <p className="text-xs text-brand-muted">Uma linha por data. Recebimentos primeiro; depois, só pagamentos.</p>
            {manual.map((r, i) => (
              <fieldset key={i} className="grid gap-2 rounded-lg border border-brand-border p-2 sm:grid-cols-4">
                <legend className="sr-only">Linha {i + 1}</legend>
                <Field id={id(`md-${i}`)} label="Data" type="date" value={r.date} onChange={(date) => setManual(manual.map((x, k) => (k === i ? { ...x, date } : x)))} />
                <Field id={id(`mt-${i}`)} label="Descrição" value={r.description} onChange={(description) => setManual(manual.map((x, k) => (k === i ? { ...x, description } : x)))} />
                <Field id={id(`mr-${i}`)} label="Recebe" prefix="R$" value={r.receive} onChange={(receive) => setManual(manual.map((x, k) => (k === i ? { ...x, receive } : x)))} />
                <Field id={id(`mp-${i}`)} label="Paga" prefix="R$" value={r.pay} onChange={(pay) => setManual(manual.map((x, k) => (k === i ? { ...x, pay } : x)))} />
              </fieldset>
            ))}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setManual([...manual, { date: addMonths(manual.at(-1)?.date || f.releaseDate, 1), description: `Parcela ${manual.length}`, receive: "", pay: "" }])} className="min-h-11 rounded-lg border border-dashed border-brand-navy px-3 text-sm font-semibold text-brand-navy">+ Adicionar linha</button>
              <button type="button" onClick={computeManual} className="min-h-11 rounded-lg bg-brand-navy px-4 text-sm font-semibold text-white">Calcular o fluxo</button>
            </div>
          </div>
        </details>
      ) : null}

      <p aria-live="polite" className="sr-only">
        {shown?.mode === "proposta" || shown?.mode === "simular"
          ? shown.outcome.kind === "ok"
            ? `${shown.outcome.result.label === "cet" ? "CET estimado" : "Taxa efetiva estimada"}: ${annual(shown.outcome.result.annualRate)}.`
            : ""
          : shown?.mode === "manual" && shown.rate !== null
            ? `Taxa efetiva do fluxo: ${annual(shown.rate)}.`
            : ""}
      </p>

      <div ref={resultRef} className="scroll-mt-24">
        {shown ? (
          <div className="mt-6 border-t border-brand-border pt-6">
            {premise ? <p className="mb-4 rounded-lg bg-brand-gold-soft px-3 py-2 text-sm text-brand-gold-dark">{premise}</p> : null}
            {shown.mode === "comparar" ? (
              <CompareView results={shown.results} Title={Title} />
            ) : shown.mode === "manual" ? (
              <ManualView shown={shown} Title={Title} />
            ) : (
              <OutcomeView outcome={shown.outcome} simulated={shown.mode === "simular"} Title={Title} Sub={Sub} context={context} />
            )}
            <p className="mt-6 rounded-lg border border-brand-warning/40 bg-brand-warning-soft p-3 text-sm leading-relaxed text-brand-warning">
              Esta ferramenta produz uma estimativa a partir dos valores e datas informados. O CET oficial é calculado e informado pela instituição
              responsável pela operação utilizando todos os custos contratuais aplicáveis.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* ---------- resultados ---------- */

function OutcomeView({ outcome, simulated, Title, Sub, context }: { outcome: ProposalOutcome; simulated: boolean; Title: "h2" | "h3"; Sub: "h3" | "h4"; context: "ferramenta" | "artigo" }) {
  const heading = (t: string) => <Title data-result-heading tabIndex={-1} className="font-serif text-2xl font-bold text-brand-navy outline-none">{t}</Title>;
  if (outcome.kind === "rotativo") {
    return (
      <div>
        {heading("Esta modalidade segue metodologia regulatória própria")}
        <p className="mt-3 text-sm leading-relaxed">{CET_RULES.revolving} Peça o CET à instituição; o cálculo de parcelas desta ferramenta não se aplica.</p>
        <p className="mt-2 text-sm">
          Para o rotativo do cartão, a <Link href="/calculadoras/juros-cartao-credito/" className="font-semibold text-brand-teal underline">calculadora de juros do cartão</Link> mostra o custo de um ciclo.
        </p>
      </div>
    );
  }
  if (outcome.kind === "fora-do-escopo") {
    return (
      <div>
        {heading("Crédito rural fica fora desta metodologia")}
        <p className="mt-3 text-sm leading-relaxed">{CET_RULES.scope} Para crédito rural, vale a regulamentação específica; peça o custo total à instituição.</p>
      </div>
    );
  }
  if (outcome.kind === "fluxo-invalido") {
    return (
      <div>
        {heading("Não foi possível calcular com estes valores")}
        <p className="mt-3 text-sm leading-relaxed">
          O fluxo precisa começar com o dinheiro recebido e seguir só com pagamentos. Confira se os custos pagos à parte não são maiores que o valor recebido.
        </p>
      </div>
    );
  }
  if (outcome.kind !== "ok") return null;
  return <ResultView r={outcome.result} simulated={simulated} heading={heading} Sub={Sub} context={context} />;
}

function ResultView({ r, simulated, heading, Sub, context }: { r: ProposalResult; simulated: boolean; heading: (t: string) => React.ReactNode; Sub: "h3" | "h4"; context: "ferramenta" | "artigo" }) {
  const isCet = r.label === "cet";
  const name = isCet ? "CET estimado" : "Taxa efetiva estimada";
  const cta = (target: string) => () => track("cet_internal_cta_clicked", { context, target });
  const payments = r.flows.filter((x) => x.amountCents < 0 && x.date !== r.flows[0]!.date);
  const extraCosts = Object.values(r.costsByKind).reduce((s, v) => s + v, 0);
  const n = r.flows.filter((x) => x.description.startsWith("Parcela ")).length;
  const firstInstallment = -(r.flows.find((x) => x.description === "Parcela 1")?.amountCents ?? 0);
  const allEqual = r.installmentsTotalCents === firstInstallment * n;
  const diff = r.cetDiffPp;
  const bigDiff = diff !== null && Math.abs(diff) > CET_DIFF_TOLERANCE_PP;
  const insideFinanced = r.costsByMode.financiado + r.costsByMode.descontado;

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">{simulated ? "Simulação" : "Custo da sua proposta"}</p>
      {heading(`${name}: ${annual(r.annualRate)}`)}
      <p className="mt-1 text-sm text-brand-muted">
        {isCet
          ? "CET estimado com os valores informados. O CET oficial é o da instituição."
          : "Taxa efetiva estimada do fluxo informado. Se existirem IOF, tarifas ou seguros pagos separadamente e eles não forem informados, o resultado ficará incompleto."}{" "}
        Equivalente mensal do {isCet ? "CET" : "resultado"} anual: {pct(r.monthlyEquivalent * 100)}% a.m.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-brand-teal-soft p-4">
          <p className="text-xs font-semibold text-brand-muted">Recebe</p>
          <p className="text-2xl font-bold tabular-nums text-brand-navy">{brl(r.netInitialCents)}</p>
          {r.netInitialCents !== r.receivedCents ? <p className="text-xs text-brand-muted">{brl(r.receivedCents)} menos o que pagou à parte</p> : null}
        </div>
        <div className="rounded-xl border border-brand-border p-4">
          <p className="text-xs font-semibold text-brand-muted">Financia</p>
          <p className="text-2xl font-bold tabular-nums text-brand-navy">{brl(r.financedCents)}</p>
        </div>
        <div className="rounded-xl bg-brand-gold-soft p-4">
          <p className="text-xs font-semibold text-brand-muted">Paga no total</p>
          <p className="text-2xl font-bold tabular-nums text-brand-navy">{brl(r.totalPaidCents)}</p>
        </div>
      </div>

      {r.announcedMonthly !== null && r.announcedAnnual !== null ? (
        <div className="mt-6 rounded-xl border border-brand-border p-4">
          <Sub className="font-serif text-lg font-bold text-brand-navy">Taxa de juros não é CET</Sub>
          <dl className="mt-2">
            <Row label="Taxa de juros informada" value={`${pct(r.announcedMonthly * 100)}% a.m.`} note={`equivalente a ${annual(r.announcedAnnual)}`} />
            <Row label={name} value={annual(r.annualRate)} strong />
          </dl>
          <p className="mt-2 text-sm leading-relaxed">
            {r.annualRate > r.announcedAnnual + 0.0005
              ? `A diferença de ${pct((r.annualRate - r.announcedAnnual) * 100)} p.p. vem dos custos além dos juros${extraCosts > 0 ? ":" : " — e, se nenhum custo foi informado, das datas ou de valores diferentes dos anunciados."}`
              : "Nesta simulação, o custo ficou próximo da taxa de juros: os custos informados pesam pouco ou não existem."}
          </p>
          {extraCosts > 0 ? (
            <ul className="mt-1 list-disc pl-5 text-sm">
              {(Object.entries(r.costsByKind) as Array<[keyof typeof COST_KIND_LABEL, number]>).filter(([, v]) => v > 0).map(([k, v]) => (
                <li key={k}>{COST_KIND_LABEL[k]}: {brl(v)}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <Sub className="mt-6 font-serif text-lg font-bold text-brand-navy">Desmonte da proposta</Sub>
      <dl className="mt-2">
        {r.requestedCents !== r.receivedCents ? <Row label="Valor solicitado" value={brl(r.requestedCents)} /> : null}
        <Row label="Valor liberado a você ou ao vendedor" value={brl(r.receivedCents)} />
        {(["iof", "tarifa", "seguro", "registro", "avaliacao", "terceiros", "outro"] as const)
          .filter((k) => r.costsByKind[k] > 0)
          .map((k) => <Row key={k} label={COST_KIND_LABEL[k]} value={brl(r.costsByKind[k])} />)}
        <Row label="Valor financiado" note={insideFinanced > 0 ? "liberado + custos incluídos ou descontados" : "igual ao liberado: nenhum custo entrou no financiamento"} value={brl(r.financedCents)} />
        <Row label="Parcelas" value={allEqual ? `${n} × ${brl(firstInstallment)}` : `${n} parcelas, ${brl(r.installmentsTotalCents)}`} />
        <Row label="Juros e encargos dentro das parcelas" note="total das parcelas − valor financiado" value={brl(r.interestInInstallmentsCents)} />
        <Row label="Total desembolsado" note="parcelas + custos pagos fora delas" value={brl(r.totalPaidCents)} strong />
        <Row label={name} value={annual(r.annualRate)} strong />
      </dl>

      {insideFinanced > 0 ? (
        <div className="mt-4" role="img" aria-label={`Onde foi o valor financiado: ${brl(r.receivedCents)} liberados e ${brl(insideFinanced)} em custos.`}>
          <p className="text-sm font-semibold text-brand-navy">Onde foi o dinheiro financiado</p>
          <div className="mt-1 flex h-4 overflow-hidden rounded-full bg-brand-border">
            <div className="h-full bg-brand-navy" style={{ width: `${(r.receivedCents / r.financedCents) * 100}%` }} />
            <div className="h-full bg-brand-gold" style={{ width: `${(insideFinanced / r.financedCents) * 100}%` }} />
          </div>
          <p className="mt-1 flex justify-between text-xs text-brand-muted">
            <span>Liberado {pct((r.receivedCents / r.financedCents) * 100, 1)}%</span>
            <span>Custos {pct((insideFinanced / r.financedCents) * 100, 1)}%</span>
          </p>
        </div>
      ) : null}

      <p className="mt-4 text-sm leading-relaxed">
        Em dinheiro: para cada R$ 1.000 disponíveis hoje, esta proposta soma cerca de {brl(r.paidPer1000Cents)} em pagamentos ao longo de{" "}
        {r.termDays} dias. Esse total não é o CET — o CET considera também <em>quando</em> cada pagamento acontece.
      </p>
      {r.annualRate > 1 && r.termDays < 180 ? (
        <p role="note" className="mt-2 rounded-lg bg-brand-teal-soft p-3 text-sm">
          Como o CET é anualizado, operações curtas podem apresentar percentuais anuais elevados mesmo com poucos pagamentos. Aqui, o custo em reais é de{" "}
          {brl(r.totalPaidCents - r.netInitialCents)}.
        </p>
      ) : null}

      {r.cetInformed !== null && diff !== null ? (
        <div className="mt-6 rounded-xl border border-brand-border p-4">
          <Sub className="font-serif text-lg font-bold text-brand-navy">CET informado × estimativa</Sub>
          <dl className="mt-2">
            <Row label="Informado na proposta" value={annual(r.cetInformed)} />
            <Row label="Nossa estimativa" value={annual(r.annualRate)} />
            <Row label="Diferença" value={`${pct(Math.abs(diff))} p.p.`} strong />
          </dl>
          {bigDiff ? (
            <>
              <p className="mt-2 text-sm leading-relaxed">
                Os valores informados não reproduzem o CET apresentado. Confira se faltam custos, datas, seguros ou tarifas na simulação.
              </p>
              <details className="mt-2 rounded-lg border border-brand-border">
                <summary className="min-h-11 cursor-pointer px-3 py-2 text-sm font-semibold text-brand-navy">O que posso estar esquecendo?</summary>
                <ul className="list-disc space-y-1 border-t border-brand-border p-3 pl-8 text-sm">
                  <li>IOF — descontado do valor, financiado ou pago à parte;</li>
                  <li>seguro vinculado ao crédito, à vista ou mensal;</li>
                  <li>tarifa de cadastro, de avaliação ou de registro;</li>
                  <li>custo pago no início, fora das parcelas;</li>
                  <li>valor liberado: use o que chegou de fato, não o valor pedido;</li>
                  <li>data da liberação e da primeira parcela;</li>
                  <li>alguma parcela com valor diferente;</li>
                  <li>serviço de terceiros (despachante, cartório).</li>
                </ul>
              </details>
            </>
          ) : (
            <p className="mt-2 text-sm text-brand-muted">Diferença pequena, compatível com arredondamento de valores e datas.</p>
          )}
        </div>
      ) : null}

      {r.unexplainedFinancedCents !== null && r.unexplainedFinancedCents > 100 ? (
        <p role="note" className="mt-4 rounded-lg bg-brand-warning-soft p-3 text-sm text-brand-warning">
          O valor financiado da proposta é {brl(r.unexplainedFinancedCents)} maior do que o liberado mais os custos informados. Pode existir IOF, tarifa ou outro
          custo não informado.
        </p>
      ) : null}

      {r.indexer !== "nenhum" ? (
        <p role="note" className="mt-4 rounded-lg bg-brand-teal-soft p-3 text-sm leading-relaxed">
          Indexador informado: {r.indexer === "tr" ? "TR" : r.indexer === "ipca" ? "IPCA" : "outro"}. Incluído na projeção do CET? Não. {CET_RULES.indexers} Se houver
          indexadores ou taxas variáveis, o custo efetivo ao longo do contrato poderá mudar.
        </p>
      ) : null}

      <details className="mt-6 rounded-lg border border-brand-border">
        <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-semibold text-brand-navy">O fluxo que estamos calculando</summary>
        <ol className="border-t border-brand-border p-3 text-sm">
          {r.flows
            .slice()
            .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : b.amountCents - a.amountCents))
            .map((x, i) => (
              <li key={i} className="flex justify-between gap-3 border-b border-brand-border py-1 last:border-0">
                <span>
                  {formatIsoDate(x.date)} · {x.description}
                </span>
                <span className={`tabular-nums ${x.amountCents > 0 ? "font-semibold text-brand-teal-dark" : ""}`}>
                  {x.amountCents > 0 ? "+" : "−"} {brl(Math.abs(x.amountCents))}
                </span>
              </li>
            ))}
        </ol>
        <p className="px-3 pb-3 text-xs text-brand-muted">
          {payments.length} pagamentos depois da liberação. Saldo inicial líquido: {brl(r.netInitialCents)}.
        </p>
      </details>

      <details className="mt-3 rounded-lg border border-brand-border" onToggle={(e) => { if ((e.currentTarget as HTMLDetailsElement).open) track("cet_methodology_opened", { context }); }}>
        <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-semibold text-brand-navy">Como calculamos</summary>
        <div className="space-y-2 border-t border-brand-border p-4 text-sm leading-relaxed">
          <p>{CET_RULES.formula}</p>
          <p>FC0 é o valor liberado menos o que foi pago à parte na contratação; FCj são as parcelas e os custos pagos depois, cada um na sua data.</p>
          <p>A taxa é encontrada por bisseção até o valor presente do fluxo ficar em zero, com alta precisão; o arredondamento é só na exibição.</p>
          <p className="text-xs text-brand-muted">
            Fonte: <a href={CET_RULES.resolution.url} target="_blank" rel="noopener noreferrer" className="underline">{CET_RULES.resolution.title}</a>. Normas verificadas em {CET_RULES.verifiedAt}.
          </p>
        </div>
      </details>

      <div className="mt-6 space-y-3 text-sm">
        <p>
          <span className="text-brand-muted">Quer comparar com outra proposta?</span>{" "}
          <span className="font-semibold text-brand-navy">Use “Comparar até 3” no topo da calculadora.</span>
        </p>
        <p>
          <span className="text-brand-muted">A taxa está alta para a modalidade?</span>{" "}
          <Link href="/calculadoras/minha-taxa-esta-cara/" onClick={cta("minha-taxa")} className="font-semibold text-brand-teal underline underline-offset-2">Compare com a média do Banco Central</Link>
        </p>
        <p>
          <span className="text-brand-muted">Quer entender o CET?</span>{" "}
          <Link href="/juros-e-cet/o-que-e-cet/" onClick={cta("artigo")} className="font-semibold text-brand-teal underline underline-offset-2">Leia o guia do CET</Link>
        </p>
      </div>
    </div>
  );
}

function CompareView({ results, Title }: { results: ProposalResult[]; Title: "h2" | "h3" }) {
  const criteria = compareCet(results);
  const first = (r: ProposalResult) => -(r.flows.find((x) => x.description === "Parcela 1")?.amountCents ?? 0);
  const n = (r: ProposalResult) => r.flows.filter((x) => x.description.startsWith("Parcela ")).length;
  const metrics: Array<{ label: string; v: (r: ProposalResult) => string }> = [
    { label: "Valor recebido", v: (r) => brl(r.receivedCents) },
    { label: "Parcela", v: (r) => brl(first(r)) },
    { label: "Prazo", v: (r) => `${n(r)} parcelas` },
    { label: "Total desembolsado", v: (r) => brl(r.totalPaidCents) },
    { label: "Custos pagos à parte", v: (r) => brl(r.costsByMode.antecipado) },
    { label: "Taxa anunciada", v: (r) => (r.announcedMonthly !== null ? `${pct(r.announcedMonthly * 100)}% a.m.` : "—") },
    { label: "CET informado", v: (r) => (r.cetInformed !== null ? annual(r.cetInformed) : "—") },
    { label: "Taxa efetiva estimada", v: (r) => annual(r.annualRate) },
  ];
  return (
    <div>
      <Title data-result-heading tabIndex={-1} className="font-serif text-2xl font-bold text-brand-navy outline-none">As propostas lado a lado</Title>
      <p className="mt-1 text-sm text-brand-muted">Cada métrica responde uma pergunta diferente. A ferramenta não escolhe uma proposta.</p>
      <div className="mt-3 space-y-3 sm:hidden">
        {results.map((r, i) => (
          <div key={i} className="rounded-xl border border-brand-border p-3">
            <p className="font-semibold text-brand-navy">{LABELS[i]}</p>
            <dl>{metrics.map((m) => <Row key={m.label} label={m.label} value={m.v(r)} />)}</dl>
          </div>
        ))}
      </div>
      <div className="mt-3 hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <caption className="sr-only">Comparação das propostas</caption>
          <thead>
            <tr className="border-b border-brand-border text-left">
              <th scope="col" className="py-2 pr-3 font-semibold text-brand-muted">Métrica</th>
              {results.map((_, i) => <th key={i} scope="col" className="py-2 pr-3 text-right font-semibold text-brand-navy">{LABELS[i]}</th>)}
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => (
              <tr key={m.label} className="border-b border-brand-border">
                <th scope="row" className="py-2 pr-3 text-left font-semibold text-brand-navy">{m.label}</th>
                {results.map((r, i) => <td key={i} className="py-2 pr-3 text-right tabular-nums">{m.v(r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="mt-3 space-y-1 text-sm">
        {criteria.map((c) => (
          <li key={c.key}>
            <span className="font-semibold text-brand-navy">{c.label}:</span>{" "}
            {!c.available ? "indisponível — nem todas as propostas informaram." : c.holders.length === 0 ? "empate." : c.holders.map((h) => LABELS[h]).join(" e ")}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-brand-muted">
        Aqui a taxa é “efetiva estimada”: custos cobrados junto com as parcelas ou em outras datas não entram neste modo. Para o CET completo de uma proposta, use
        “Sim, analisar minha proposta”.
      </p>
    </div>
  );
}

function ManualView({ shown, Title }: { shown: Extract<Shown, { mode: "manual" }>; Title: "h2" | "h3" }) {
  return (
    <div>
      <Title data-result-heading tabIndex={-1} className="font-serif text-2xl font-bold text-brand-navy outline-none">
        {shown.rate !== null ? `Taxa efetiva estimada do fluxo: ${annual(shown.rate)}` : "Fluxo incomum"}
      </Title>
      {shown.problem ? <p className="mt-3 text-sm leading-relaxed">{shown.problem}</p> : <p className="mt-2 text-sm text-brand-muted">Calculada pela mesma fórmula, com as datas e valores das linhas.</p>}
    </div>
  );
}
