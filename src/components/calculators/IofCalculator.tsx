"use client";

/**
 * CALCULADORA DE IOF DE EMPRÉSTIMO
 * ============================================================================
 *
 * Pergunta: "quanto de IOF este crédito paga, e de onde sai o número?".
 *
 * DECISÕES QUE NÃO SÃO ÓBVIAS
 *
 * - Toda alíquota vem de `iof-credit-rules.ts`, pela DATA da operação. Fora
 *   da cobertura declarada, a tela diz isso em vez de usar a regra de hoje.
 * - A parcela diária é calculada sobre o principal de cada parcela, pelos
 *   dias até o vencimento dela, com o limite de 365 dias — nunca "valor ×
 *   3,38%" nem "valor × dias do contrato".
 * - Primeira tela: valor, prazo, data e forma de pagar. Tomador, tipo de
 *   operação, taxa e IOF financiado ficam em "opções avançadas".
 * - Portabilidade, renegociação e rotativo não recebem número: regra própria.
 * - Nada do que é digitado sai do navegador; a medição leva só categorias.
 */

import Link from "next/link";
import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { track } from "@/lib/analytics/track";
import { parseBRLToCents, parsePercentBR } from "@/lib/calculators/proposal-comparison";
import {
  amountScenarios,
  calculateIof,
  termScenarios,
  type IofField,
  type IofInput,
  type IofIssue,
  type IofOutcome,
  type IofResult,
  type Payment,
  type Schedule,
} from "@/lib/calculators/iof-credit";
import {
  CAP_RULE,
  IOF_RULES_VERIFIED_AT,
  JUDICIAL_RECORD,
  OPERATION_RULES,
  formatRate,
  type Borrower,
  type OperationKind,
} from "@/lib/calculators/iof-credit-rules";
import { addMonths, daysBetween, formatIsoDate, todayInBrazil } from "@/lib/calculators/civil-date";
import { useRevealResult } from "./use-reveal-result";

export const IOF_PREFILL_EVENT = "cpp:simular-iof";

export interface IofPrefillDetail {
  exampleId: string;
  amountCents: number;
  term: number;
  termUnit: "meses" | "dias";
  schedule: Schedule;
}

interface Fields {
  amount: string;
  term: string;
  termUnit: "meses" | "dias";
  schedule: Schedule;
  releaseDate: string;
  borrower: Borrower;
  operation: OperationKind;
  rate: string;
  payment: Payment;
}

const BORROWER_LABEL: Record<Borrower, string> = { pf: "Pessoa física", pj: "Pessoa jurídica", simples: "Simples Nacional ou MEI" };

/* ---------- formatação ---------- */

const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const pct = (v: number, digits = 2) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const moneyInput = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const termLabel = (term: number, unit: "meses" | "dias") =>
  unit === "meses" ? (term === 1 ? "1 mês" : `${term} meses`) : term === 1 ? "1 dia" : `${term} dias`;

function tidyMoney(raw: string): string {
  const cents = parseBRLToCents(raw);
  return cents === null ? raw : moneyInput(cents);
}

function toInput(f: Fields): IofInput {
  return {
    amountCents: f.amount.trim() === "" ? Number.NaN : (parseBRLToCents(f.amount) ?? Number.NaN),
    term: /^\d+$/.test(f.term.trim()) ? Number(f.term.trim()) : Number.NaN,
    termUnit: f.schedule === "parcelas" ? "meses" : f.termUnit,
    schedule: f.schedule,
    monthlyRatePercent: f.rate.trim() === "" ? undefined : (parsePercentBR(f.rate) ?? Number.NaN),
    releaseDate: f.releaseDate,
    borrower: f.borrower,
    operation: f.operation,
    payment: f.payment,
  };
}

/* ---------- peças ---------- */

const inputClass =
  "min-h-12 w-full min-w-0 rounded-lg border border-brand-border bg-white px-3 py-2.5 text-base text-brand-text tabular-nums focus:border-brand-teal aria-[invalid=true]:border-brand-danger";

function Segmented<T extends string>({
  label,
  labelledBy,
  value,
  options,
  onChange,
  wide,
}: {
  label?: string;
  labelledBy?: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (v: T) => void;
  wide?: boolean;
}) {
  return (
    <div role="group" aria-label={labelledBy ? undefined : label} aria-labelledby={labelledBy} className={`flex flex-wrap rounded-lg border border-brand-border p-0.5 ${wide ? "w-full sm:w-auto" : "w-fit"}`}>
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

/** Botão dos exemplos da página: preenche a calculadora sem sair dela. */
export function SimulateIofButton({ label, detail }: { label: string; detail: IofPrefillDetail }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent<IofPrefillDetail>(IOF_PREFILL_EVENT, { detail }))}
      className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-brand-navy px-4 text-sm font-semibold text-brand-navy hover:bg-brand-teal-soft"
    >
      {label}
    </button>
  );
}

/* ---------- componente ---------- */

export function IofCalculator({ today, context = "ferramenta" }: { today: string; context?: "ferramenta" | "artigo" }) {
  const uid = useId();
  const id = (n: string) => `${uid}-${n}`;
  const [f, setF] = useState<Fields>({
    amount: "",
    term: "",
    termUnit: "meses",
    schedule: "parcelas",
    releaseDate: today,
    borrower: "pf",
    operation: "comum",
    rate: "",
    payment: "descontado",
  });
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<IofIssue[]>([]);
  const [shown, setShown] = useState<{ outcome: IofOutcome; input: IofInput } | null>(null);
  const [stale, setStale] = useState(false);
  const [premise, setPremise] = useState<string | null>(null);
  const rootRef = useRef<HTMLElement | null>(null);
  const { ref: resultRef, reveal } = useRevealResult();

  const syncToday = useEffectEvent(() => {
    const now = todayInBrazil();
    if (now !== today && f.releaseDate === today) setF((s) => ({ ...s, releaseDate: now }));
  });
  useEffect(() => {
    const timer = window.setTimeout(syncToday, 0);
    track("iof_calculator_view", { context });
    return () => window.clearTimeout(timer);
  }, [context]);

  function compute(next: Fields, { announce }: { announce: boolean }) {
    const input = toInput(next);
    const outcome = calculateIof(input);
    if (outcome.kind === "invalid") {
      setErrors(outcome.errors);
      setStale(shown !== null);
      return;
    }
    setErrors([]);
    setStale(false);
    setShown({ outcome, input });
    if (announce) {
      track("iof_calculation_completed", {
        context,
        borrower: input.borrower,
        schedule: input.schedule,
        operation: input.operation,
        payment: input.payment,
        outcome: outcome.kind,
      });
    }
  }

  function update(patch: Partial<Fields>) {
    const next = { ...f, ...patch };
    if (patch.schedule === "parcelas") next.termUnit = "meses";
    setF(next);
    setPremise(null);
    if (submitted) compute(next, { announce: false });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    compute(f, { announce: true });
    reveal();
  }

  function applyScenario(patch: Partial<Fields>, kind: string) {
    track("iof_scenario_changed", { context, kind });
    const next = { ...f, ...patch };
    setF(next);
    compute(next, { announce: false });
  }

  function prefill(d: IofPrefillDetail) {
    track("iof_example_select", { context, example: d.exampleId });
    const next: Fields = { ...f, amount: moneyInput(d.amountCents), term: String(d.term), termUnit: d.termUnit, schedule: d.schedule, borrower: "pf", operation: "comum", payment: "descontado", rate: "" };
    setF(next);
    setSubmitted(true);
    setPremise("Exemplo da página: pessoa física, empréstimo comum, IOF descontado do valor. Ajuste os campos para o seu caso.");
    compute(next, { announce: true });
    rootRef.current?.scrollIntoView({ block: "start" });
    reveal();
  }
  const onPrefill = useEffectEvent((d: IofPrefillDetail) => prefill(d));
  useEffect(() => {
    const listener = (e: Event) => onPrefill((e as CustomEvent<IofPrefillDetail>).detail);
    window.addEventListener(IOF_PREFILL_EVENT, listener);
    return () => window.removeEventListener(IOF_PREFILL_EVENT, listener);
  }, []);

  const errorOf = (field: IofField) => errors.find((e) => e.field === field)?.message;
  const termN = /^\d+$/.test(f.term) ? Number(f.term) : null;
  const approxDays =
    termN && f.releaseDate && (f.schedule === "parcelas" || f.termUnit === "meses") && termN <= 480
      ? daysBetween(f.releaseDate, addMonths(f.releaseDate, termN))
      : null;
  const Title = context === "artigo" ? "h3" : "h2";
  const Sub = context === "artigo" ? "h4" : "h3";

  return (
    <section ref={rootRef} id="calculadora" aria-label="Calculadora de IOF de empréstimo" className="scroll-mt-24 rounded-2xl border border-brand-border bg-white p-3 shadow-sm sm:p-6">
      <form onSubmit={handleSubmit} noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={id("valor")} className="block text-sm font-semibold text-brand-navy">Quanto você vai contratar?</label>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="shrink-0 text-sm text-brand-muted" aria-hidden="true">R$</span>
              <input
                id={id("valor")}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="ex.: 10.000"
                value={f.amount}
                onChange={(e) => update({ amount: e.target.value })}
                onBlur={() => setF((s) => ({ ...s, amount: tidyMoney(s.amount) }))}
                aria-invalid={Boolean(errorOf("amountCents"))}
                aria-describedby={errorOf("amountCents") ? `${id("valor")}-erro` : undefined}
                className={inputClass}
              />
            </div>
            {errorOf("amountCents") ? <p id={`${id("valor")}-erro`} className="mt-1.5 text-sm font-medium text-brand-danger">{errorOf("amountCents")}</p> : null}
          </div>

          <div>
            <p id={id("pagar-label")} className="text-sm font-semibold text-brand-navy">Como vai pagar?</p>
            <div className="mt-1.5">
              <Segmented labelledBy={id("pagar-label")} value={f.schedule} onChange={(schedule) => update({ schedule })} options={[{ value: "parcelas", label: "Parcelas mensais" }, { value: "unico", label: "De uma vez" }]} />
            </div>
          </div>

          <div>
            <label htmlFor={id("prazo")} className="block text-sm font-semibold text-brand-navy">
              {f.schedule === "parcelas" ? "Número de parcelas" : "Prazo até o pagamento"}
            </label>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <input
                id={id("prazo")}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder={f.schedule === "parcelas" ? "ex.: 12" : "ex.: 90"}
                value={f.term}
                onChange={(e) => update({ term: e.target.value.replace(/\D/g, "") })}
                aria-invalid={Boolean(errorOf("term"))}
                aria-describedby={[id("prazo-hint"), errorOf("term") ? `${id("prazo")}-erro` : null].filter(Boolean).join(" ")}
                className={`${inputClass} max-w-[8rem]`}
              />
              {f.schedule === "unico" ? (
                <Segmented label="Unidade do prazo" value={f.termUnit} onChange={(termUnit) => update({ termUnit })} options={[{ value: "meses", label: "meses" }, { value: "dias", label: "dias" }]} />
              ) : (
                <span className="text-sm text-brand-muted">meses</span>
              )}
            </div>
            <p id={id("prazo-hint")} className="mt-1 text-xs text-brand-muted">
              {approxDays ? `Cerca de ${approxDays} dias até ${f.schedule === "parcelas" ? "a última parcela" : "o pagamento"}.` : "O IOF conta os dias reais até cada vencimento."}
            </p>
            {errorOf("term") ? <p id={`${id("prazo")}-erro`} className="mt-1.5 text-sm font-medium text-brand-danger">{errorOf("term")}</p> : null}
          </div>

          <div>
            <label htmlFor={id("data")} className="block text-sm font-semibold text-brand-navy">Data da operação</label>
            <input id={id("data")} type="date" value={f.releaseDate} onChange={(e) => e.target.value && update({ releaseDate: e.target.value })} aria-invalid={Boolean(errorOf("releaseDate"))} className={`${inputClass} mt-1.5`} />
            <p className="mt-1 text-xs text-brand-muted">Hoje, por padrão. A regra aplicada é a da data.</p>
          </div>
        </div>

        <details className="mt-5 rounded-lg border border-brand-border" onToggle={(e) => { if ((e.currentTarget as HTMLDetailsElement).open) track("iof_advanced_opened", { context }); }}>
          <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-semibold text-brand-navy">Tipo de operação, tomador e forma de pagar o IOF (opcional)</summary>
          <div className="grid gap-4 border-t border-brand-border p-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <p id={id("tomador-label")} className="text-sm font-semibold text-brand-navy">Quem está contratando?</p>
              <div className="mt-1.5">
                <Segmented labelledBy={id("tomador-label")} value={f.borrower} onChange={(borrower) => update({ borrower })} options={[{ value: "pf", label: "Pessoa física" }, { value: "pj", label: "Pessoa jurídica" }, { value: "simples", label: "Simples ou MEI" }]} />
              </div>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor={id("op")} className="block text-sm font-semibold text-brand-navy">Tipo de operação</label>
              <select id={id("op")} value={f.operation} onChange={(e) => update({ operation: e.target.value as OperationKind })} className={`${inputClass} mt-1.5`}>
                {OPERATION_RULES.map((o) => (
                  <option key={o.kind} value={o.kind}>{o.label}</option>
                ))}
              </select>
            </div>
            {f.schedule === "parcelas" ? (
              <div>
                <label htmlFor={id("taxa")} className="block text-sm font-semibold text-brand-navy">Juros ao mês (opcional)</label>
                <p id={id("taxa-hint")} className="mt-0.5 text-xs text-brand-muted">Com a taxa, as parcelas seguem a Price; sem ela, a amortização é igual em cada parcela.</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <input id={id("taxa")} type="text" inputMode="decimal" autoComplete="off" placeholder="da proposta" value={f.rate} onChange={(e) => update({ rate: e.target.value })} aria-invalid={Boolean(errorOf("monthlyRatePercent"))} aria-describedby={id("taxa-hint")} className={`${inputClass} max-w-[8rem]`} />
                  <span className="text-sm text-brand-muted" aria-hidden="true">% a.m.</span>
                </div>
                {errorOf("monthlyRatePercent") ? <p className="mt-1.5 text-sm font-medium text-brand-danger">{errorOf("monthlyRatePercent")}</p> : null}
              </div>
            ) : null}
            <div>
              <p id={id("pag-label")} className="text-sm font-semibold text-brand-navy">Como o IOF será pago?</p>
              <div className="mt-1.5">
                <Segmented labelledBy={id("pag-label")} value={f.payment} onChange={(payment) => update({ payment })} options={[{ value: "descontado", label: "Descontado do valor" }, { value: "financiado", label: "Incluído no financiamento" }]} />
              </div>
            </div>
          </div>
        </details>

        {errors.length > 0 ? (
          <p role="alert" className="mt-4 rounded-lg border border-brand-danger/40 bg-brand-danger-soft p-3 text-sm text-brand-danger">
            {errors.length === 1 ? "Um campo precisa de ajuste — ele está destacado acima." : "Alguns campos precisam de ajuste — eles estão destacados acima."}
          </p>
        ) : null}

        <button type="submit" className="mt-5 min-h-12 w-full rounded-lg bg-brand-teal-dark px-6 font-semibold text-white hover:bg-brand-teal sm:w-auto">Calcular IOF</button>
        <p className="mt-3 text-xs text-brand-muted">Sem cadastro · Sem CPF · Nada do que você digita sai do seu aparelho.</p>
      </form>

      <p aria-live="polite" className="sr-only">
        {shown && !stale && shown.outcome.kind === "ok" ? `IOF estimado: ${brl(shown.outcome.result.breakdown.totalCents)}.` : shown && !stale && shown.outcome.kind === "zero" ? "IOF estimado: R$ 0,00." : ""}
      </p>

      <div ref={resultRef} className="scroll-mt-24">
        {shown ? (
          <div className={`mt-6 border-t border-brand-border pt-6 ${stale ? "opacity-60" : ""}`}>
            {premise ? <p className="mb-4 rounded-lg bg-brand-gold-soft px-3 py-2 text-sm text-brand-gold-dark">{premise}</p> : null}
            {stale ? <p className="mb-4 text-sm font-medium text-brand-warning">Resultado do último cálculo válido. Ajuste o campo destacado para atualizar.</p> : null}
            <OutcomeView outcome={shown.outcome} input={shown.input} Title={Title} Sub={Sub} context={context} onScenario={applyScenario} />
            <p className="mt-6 rounded-lg border border-brand-warning/40 bg-brand-warning-soft p-3 text-sm leading-relaxed text-brand-warning">
              Esta ferramenta oferece uma estimativa educativa com base nas informações fornecidas e nas regras identificadas como vigentes na data da
              operação. O valor efetivamente cobrado pode variar conforme a estrutura contratual e o enquadramento tributário da operação.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* ---------- resultados ---------- */

function OutcomeView({
  outcome,
  input,
  Title,
  Sub,
  context,
  onScenario,
}: {
  outcome: IofOutcome;
  input: IofInput;
  Title: "h2" | "h3";
  Sub: "h3" | "h4";
  context: "ferramenta" | "artigo";
  onScenario: (patch: Partial<Fields>, kind: string) => void;
}) {
  const heading = (text: string) => (
    <Title data-result-heading tabIndex={-1} className="font-serif text-2xl font-bold text-brand-navy outline-none">{text}</Title>
  );
  if (outcome.kind === "zero") {
    return (
      <div>
        {heading("IOF estimado: R$ 0,00")}
        <p className="mt-3 text-sm leading-relaxed text-brand-text">
          A operação informada está enquadrada em hipótese de {outcome.operation.reference?.includes("art. 9º") ? "isenção" : "alíquota zero"} segundo a regra
          vigente utilizada nesta simulação. {outcome.operation.explanation}
        </p>
        {outcome.operation.source ? (
          <p className="mt-2 text-xs text-brand-muted">
            Fonte: <a href={outcome.operation.source.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{outcome.operation.reference}</a>. Informações verificadas em {IOF_RULES_VERIFIED_AT}.
          </p>
        ) : null}
      </div>
    );
  }
  if (outcome.kind === "especifica") {
    return (
      <div>
        {heading("Esta situação exige análise específica")}
        <p className="mt-3 text-sm leading-relaxed text-brand-text">{outcome.operation.explanation}</p>
        <p className="mt-2 text-sm text-brand-muted">Peça à instituição o demonstrativo do IOF da operação e o CET.</p>
      </div>
    );
  }
  if (outcome.kind === "fora-da-cobertura") {
    return (
      <div>
        {heading("Data fora da cobertura desta calculadora")}
        <p className="mt-3 text-sm leading-relaxed text-brand-text">
          Para este tomador, as regras estão modeladas a partir de {formatIsoDate(outcome.coverageFrom)}. Antes disso houve alíquotas diferentes, e usar a regra de hoje
          daria um número errado. Para um contrato antigo, o valor do IOF está no demonstrativo da operação.
        </p>
      </div>
    );
  }
  if (outcome.kind === "acima-do-limite-simples") {
    return (
      <div>
        {heading("Esta situação exige análise específica")}
        <p className="mt-3 text-sm leading-relaxed text-brand-text">
          A alíquota reduzida do Simples Nacional e do MEI vale para operações de até {brl(outcome.limitCents)}. Acima disso, o enquadramento depende da operação, e
          esta calculadora não estima o valor.
        </p>
      </div>
    );
  }
  if (outcome.kind !== "ok") return null;
  return <ResultView r={outcome.result} input={input} heading={heading} Sub={Sub} context={context} onScenario={onScenario} />;
}

function ResultView({
  r,
  input,
  heading,
  Sub,
  context,
  onScenario,
}: {
  r: IofResult;
  input: IofInput;
  heading: (t: string) => React.ReactNode;
  Sub: "h3" | "h4";
  context: "ferramenta" | "artigo";
  onScenario: (patch: Partial<Fields>, kind: string) => void;
}) {
  const b = r.breakdown;
  const reg = r.regime;
  const financed = input.payment === "financiado";
  const terms = termScenarios(input);
  const amounts = amountScenarios(input);
  const cta = (target: string) => () => track("iof_internal_cta_clicked", { context, target });
  const principalShare = Math.max(1, 100 - r.sharePercent);

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Seu IOF estimado · operação em {formatIsoDate(input.releaseDate)}</p>
      {heading(`IOF estimado: ${brl(b.totalCents)}`)}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-brand-teal-soft p-4">
          <p className="text-xs font-semibold text-brand-muted">O número que aparece</p>
          <p className="mt-1 text-sm text-brand-text">IOF total</p>
          <p className="text-xl font-bold tabular-nums text-brand-navy">{brl(b.totalCents)}</p>
        </div>
        <div className="rounded-xl bg-brand-gold-soft p-4">
          <p className="text-xs font-semibold text-brand-muted">De onde ele veio</p>
          <p className="mt-1 text-sm text-brand-text">
            {brl(b.additionalCents)} de adicional + {brl(b.dailyCents)} pela duração
          </p>
        </div>
        <div className="rounded-xl border border-brand-border p-4">
          <p className="text-xs font-semibold text-brand-muted">Impacto no crédito</p>
          <p className="mt-1 text-sm text-brand-text">Nesta simulação, o IOF corresponde a cerca de {pct(r.sharePercent)}% do valor informado.</p>
        </div>
      </div>

      <Sub className="mt-6 font-serif text-lg font-bold text-brand-navy">IOF explicado em partes</Sub>
      <dl className="mt-2">
        <Row label={financed ? "Valor financiado (base do IOF)" : "Valor da operação"} value={brl(b.baseCents)} />
        <Row label="Regra aplicada" note={`${reg.label} · ${r.operation.label.toLowerCase()}`} value={`desde ${formatIsoDate(reg.from)}`} />
        <Row label="IOF adicional" note={`${formatRate(reg.additionalRate)} sobre o valor, uma vez`} value={brl(b.additionalCents)} />
        <Row
          label="IOF diário"
          note={`${formatRate(reg.dailyRate)} ao dia ${b.rows.length === 1 ? "sobre o valor, pelos dias até o vencimento" : "sobre o principal de cada parcela, pelos dias até o vencimento dela"}, limitado a ${reg.capDays} dias`}
          value={brl(b.dailyCents)}
        />
        <Row label="IOF total estimado" value={brl(b.totalCents)} strong />
      </dl>
      {b.capped ? (
        <p role="note" className="mt-3 rounded-lg bg-brand-teal-soft p-3 text-sm leading-relaxed text-brand-text">
          Em determinadas operações, a parcela diária do IOF é limitada ao equivalente a 365 dias, mesmo quando o empréstimo tem prazo maior. Sem esse limite, a
          parte diária desta simulação seria {brl(b.dailyWithoutCapCents)}; com ele, é {brl(b.dailyCents)}. ({CAP_RULE.reference})
        </p>
      ) : null}

      <div className="mt-4" role="img" aria-label={`Composição: ${financed ? "valor recebido" : "valor líquido"} ${pct(principalShare, 1)}%, IOF ${pct(r.sharePercent)}%.`}>
        <div className="flex h-4 overflow-hidden rounded-full bg-brand-border">
          <div className="h-full bg-brand-navy" style={{ width: `${principalShare}%` }} />
          <div className="h-full bg-brand-gold" style={{ width: `${Math.max(1, r.sharePercent)}%` }} />
        </div>
        <p className="mt-1 flex justify-between text-xs text-brand-muted">
          <span>{financed ? "Valor recebido" : "Valor líquido"}</span>
          <span>IOF</span>
        </p>
      </div>

      <Sub className="mt-6 font-serif text-lg font-bold text-brand-navy">{financed ? "O IOF entra no valor financiado" : "O IOF sai do valor liberado"}</Sub>
      <dl className="mt-2">
        {financed ? (
          <>
            <Row label="Valor recebido" value={brl(r.receivedCents)} />
            <Row label="IOF incorporado" value={brl(b.totalCents)} />
            <Row label="Valor financiado" note="sobre ele correm os juros" value={brl(r.contractedCents)} strong />
          </>
        ) : (
          <>
            <Row label="Crédito contratado" value={brl(r.contractedCents)} />
            <Row label="IOF estimado" value={brl(b.totalCents)} />
            <Row label="Valor líquido recebido" value={brl(r.receivedCents)} strong />
          </>
        )}
        <Row label="Juros" value="não calculados aqui" note="o IOF é imposto; os juros são outra conta" />
      </dl>

      {b.rows.length > 1 ? (
        <details className="mt-4 rounded-lg border border-brand-border">
          <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-semibold text-brand-navy">Ver o cálculo parcela a parcela</summary>
          <div className="overflow-x-auto border-t border-brand-border p-3">
            <table className="w-full min-w-[20rem] text-sm">
              <caption className="sr-only">IOF diário por parcela</caption>
              <thead>
                <tr className="text-left text-brand-muted">
                  <th scope="col" className="py-1 pr-2 font-semibold">Parcela</th>
                  <th scope="col" className="py-1 pr-2 text-right font-semibold">Principal</th>
                  <th scope="col" className="py-1 pr-2 text-right font-semibold">Dias contados</th>
                  <th scope="col" className="py-1 text-right font-semibold">IOF diário</th>
                </tr>
              </thead>
              <tbody>
                {b.rows.map((row) => (
                  <tr key={row.index} className="border-t border-brand-border">
                    <th scope="row" className="py-1 pr-2 text-left font-normal">{row.index}ª · {formatIsoDate(row.dueDate)}</th>
                    <td className="py-1 pr-2 text-right tabular-nums">{brl(Math.round(row.principalCents))}</td>
                    <td className="py-1 pr-2 text-right tabular-nums">{row.countedDays}{row.days > row.countedDays ? ` de ${row.days}` : ""}</td>
                    <td className="py-1 text-right tabular-nums">{brl(Math.round(row.dailyCents))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}

      {terms.length > 1 ? (
        <>
          <Sub className="mt-6 font-serif text-lg font-bold text-brand-navy">Como o prazo muda o IOF?</Sub>
          <p className="mt-1 text-sm text-brand-muted">Mesmo valor e mesma forma de pagar, prazos diferentes.</p>
          <ul className="mt-2 divide-y divide-brand-border rounded-xl border border-brand-border text-sm">
            {terms.map((t) => (
              <li key={t.term} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <span>
                  {termLabel(t.term, t.unit)}: <strong className="tabular-nums">{brl(t.totalCents)}</strong>
                  {t.capped ? <span className="ml-1 text-xs text-brand-muted">(parte diária no limite de 365 dias)</span> : null}
                </span>
                <button type="button" onClick={() => onScenario({ term: String(t.term), termUnit: t.unit }, "prazo")} className="min-h-11 rounded-lg border border-brand-border px-3 text-sm font-semibold text-brand-navy">
                  Usar {termLabel(t.term, t.unit)}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {amounts.length > 1 ? (
        <>
          <Sub className="mt-6 font-serif text-lg font-bold text-brand-navy">E com outros valores?</Sub>
          <p className="mt-1 text-sm text-brand-muted">O mesmo prazo, para comparar a ordem de grandeza — não é sugestão de valor.</p>
          <ul className="mt-2 grid gap-2 sm:grid-cols-3">
            {amounts.map((a) => (
              <li key={a.amountCents} className="rounded-xl border border-brand-border p-3 text-sm">
                <p className="text-brand-muted">{brl(a.amountCents)}</p>
                <p className="font-bold tabular-nums text-brand-navy">IOF {brl(a.totalCents)}</p>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <details className="mt-6 rounded-lg border border-brand-border" onToggle={(e) => { if ((e.currentTarget as HTMLDetailsElement).open) track("iof_rule_details_opened", { context }); }}>
        <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-semibold text-brand-navy">Ver regra utilizada</summary>
        <div className="border-t border-brand-border p-4 text-sm">
          <dl>
            <Row label="Tomador" value={BORROWER_LABEL[reg.borrower]} />
            <Row label="Operação" value={r.operation.label} />
            <Row label="Alíquota diária" value={formatRate(reg.dailyRate)} />
            <Row label="Alíquota adicional" value={formatRate(reg.additionalRate)} />
            <Row label="Limite da parte diária" value={`${reg.capDays} dias por principal`} />
            <Row label="Regra vigente desde" value={formatIsoDate(reg.from)} />
          </dl>
          <p className="mt-2 text-xs text-brand-muted">
            Fonte: <a href={reg.source.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{reg.source.title}</a>. Informações verificadas em {IOF_RULES_VERIFIED_AT}.
          </p>
          {reg.borrower !== "pf" ? (
            <p className="mt-2 text-xs leading-relaxed text-brand-muted">
              Decisão judicial: {JUDICIAL_RECORD.process}. {JUDICIAL_RECORD.effect}{" "}
              <a href={JUDICIAL_RECORD.source.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Notícia do STF</a>.
            </p>
          ) : null}
        </div>
      </details>

      <details className="mt-3 rounded-lg border border-brand-border">
        <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-semibold text-brand-navy">Ver fórmula</summary>
        <div className="space-y-2 border-t border-brand-border p-4 text-sm leading-relaxed">
          <p>IOF adicional = valor da operação × {formatRate(reg.additionalRate)}</p>
          <p>IOF diário = Σ (principal de cada parcela × {formatRate(reg.dailyRate)} × dias até o vencimento dela, no máximo {reg.capDays})</p>
          <p>IOF total = IOF diário + IOF adicional</p>
          {financed ? <p>IOF incluído no financiamento: valor financiado = valor recebido ÷ (1 − IOF ÷ valor), para que o próprio IOF esteja coberto.</p> : null}
        </div>
      </details>

      <div className="mt-6 space-y-3 text-sm">
        <p>
          <span className="text-brand-muted">IOF é apenas uma parte do custo.</span>{" "}
          <Link href="/calculadoras/comparador-de-propostas/" onClick={cta("comparador")} className="font-semibold text-brand-teal underline underline-offset-2">Compare o CET e o custo total das propostas</Link>
        </p>
        <p>
          <span className="text-brand-muted">Quer ver parcela e juros?</span>{" "}
          <Link href="/calculadoras/emprestimo/" onClick={cta("emprestimo")} className="font-semibold text-brand-teal underline underline-offset-2">Simular empréstimo</Link>
        </p>
        <p>
          <span className="text-brand-muted">Quer entender o imposto?</span>{" "}
          <Link href="/juros-e-cet/iof-no-emprestimo/" onClick={cta("artigo")} className="font-semibold text-brand-teal underline underline-offset-2">Leia o guia do IOF no empréstimo</Link>
        </p>
      </div>
    </div>
  );
}
