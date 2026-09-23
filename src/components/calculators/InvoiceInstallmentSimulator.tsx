"use client";

/**
 * SIMULADOR DE PARCELAMENTO DA FATURA
 * ============================================================================
 *
 * Pergunta: "recebi uma proposta para dividir a dívida — quanto ela custa?".
 * A de "quanto custa não pagar a fatura" é da calculadora de juros do
 * cartão; as duas se apontam.
 *
 * DECISÕES QUE NÃO SÃO ÓBVIAS
 *
 * - Dois modos, visualmente diferentes: "Tenho uma proposta" (os números da
 *   fatura, o principal) e "Quero simular" (uma conta com parcelas
 *   constantes). Proposta real não é simulação, e a tela diz isso.
 *
 * - Três campos bastam: valor, número de parcelas e valor da parcela. Taxa e
 *   CET são opcionais — sem eles, a ferramenta ainda mostra o total, o custo
 *   adicional e a taxa implícita aproximada nas parcelas.
 *
 * - O custo acima do valor parcelado NÃO é chamado de juros: pode incluir
 *   IOF e tarifas. O CET só aparece se foi informado; nunca é calculado.
 *
 * - Até 3 propostas, com as mesmas métricas na mesma posição. A comparação
 *   usa o motor do Comparador de Propostas e mostra fatos ("menor total
 *   nesta comparação"), nunca "a melhor".
 *
 * - Nada do que é digitado sai do navegador.
 */

import Link from "next/link";
import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { track } from "@/lib/analytics/track";
import { parseBRLToCents, parsePercentBR } from "@/lib/calculators/proposal-comparison";
import {
  analyzeProposal,
  buildInstallmentSummary,
  compareInvoiceProposals,
  simulateInstallments,
  simulationWhatIfs,
  type FieldIssue,
  type InvoiceComparison,
  type ProposalAnalysis,
  type ProposalData,
  type ProposalField,
} from "@/lib/calculators/invoice-installment";
import {
  applyRegulatoryCap,
  CAP_CONTINUITY,
  formatIsoDate,
  INTEREST_CAP,
  type DebtStart,
} from "@/lib/calculators/credit-card-rules";
import { useRevealResult } from "./use-reveal-result";

export const INSTALLMENT_PREFILL_EVENT = "cpp:simular-parcelamento";

export interface InstallmentPrefillDetail {
  exampleId: string;
  debtCents: number;
  installments: number;
  /** Taxa hipotética ao mês: vai para o modo simulação. */
  monthlyRatePercent: number;
}

type Mode = "proposta" | "simulacao";

interface ProposalFields {
  debt: string;
  installments: string;
  installment: string;
  down: string;
  monthly: string;
  annual: string;
  cet: string;
  informedTotal: string;
}

const EMPTY_PROPOSAL: ProposalFields = {
  debt: "",
  installments: "",
  installment: "",
  down: "",
  monthly: "",
  annual: "",
  cet: "",
  informedTotal: "",
};

interface SimFields {
  debt: string;
  down: string;
  rate: string;
  rateUnit: "am" | "aa";
  installments: string;
}

const EMPTY_SIM: SimFields = { debt: "", down: "", rate: "", rateUnit: "am", installments: "" };

type Origin = "sim" | "nao" | "nao-sei" | "";

interface ExtraFields {
  origin: Origin;
  start: DebtStart | "";
  original: string;
  charged: string;
  cashPayoff: string;
}

const EMPTY_EXTRA: ExtraFields = { origin: "", start: "", original: "", charged: "", cashPayoff: "" };

const LABELS = ["Proposta A", "Proposta B", "Proposta C"] as const;

/* ---------- formatação ---------- */

const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const pct = (v: number, digits = 2) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const moneyInput = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const monthsLabel = (n: number) => (n === 1 ? "1 mês" : `${n} meses`);

function tidyMoney(raw: string): string {
  const cents = parseBRLToCents(raw);
  return cents === null ? raw : moneyInput(cents);
}
function money(raw: string): number {
  if (raw.trim() === "") return Number.NaN;
  return parseBRLToCents(raw) ?? Number.NaN;
}
const optMoney = (raw: string) => (raw.trim() === "" ? undefined : money(raw));
const optPct = (raw: string) => (raw.trim() === "" ? undefined : (parsePercentBR(raw) ?? Number.NaN));
const intOf = (raw: string) => (/^\d+$/.test(raw.trim()) ? Number(raw.trim()) : Number.NaN);

function toData(f: ProposalFields): ProposalData {
  return {
    debtCents: money(f.debt),
    installments: intOf(f.installments),
    installmentCents: money(f.installment),
    downCents: optMoney(f.down),
    monthlyRatePercent: optPct(f.monthly),
    annualRatePercent: optPct(f.annual),
    cetAnnualPercent: optPct(f.cet),
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
  placeholder: string;
  numeric?: boolean;
  onChange: (v: string) => void;
  onBlur?: () => void;
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
      <div className="mt-1.5 flex items-center gap-2">
        {prefix ? <span className="shrink-0 text-sm text-brand-muted" aria-hidden="true">{prefix}</span> : null}
        <input
          id={id}
          type="text"
          inputMode={numeric ? "numeric" : "decimal"}
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
      {error ? (
        <p id={`${id}-erro`} className="mt-1.5 text-sm font-medium text-brand-danger">
          {error}
        </p>
      ) : null}
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
    <div role="group" aria-label={label} className={`flex flex-wrap rounded-lg border border-brand-border p-0.5 ${wide ? "w-full sm:w-auto" : "shrink-0"}`}>
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
      <dd className={`shrink-0 text-right tabular-nums ${strong ? "text-lg font-bold text-brand-navy" : "font-semibold text-brand-text"}`}>
        {value}
      </dd>
    </div>
  );
}

/** Botão dos exemplos da página: preenche o simulador sem sair dela. */
export function SimulateInstallmentButton({ label, detail }: { label: string; detail: InstallmentPrefillDetail }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent<InstallmentPrefillDetail>(INSTALLMENT_PREFILL_EVENT, { detail }))}
      className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-brand-navy px-4 text-sm font-semibold text-brand-navy hover:bg-brand-teal-soft"
    >
      {label}
    </button>
  );
}

/* ---------- componente ---------- */

type Shown =
  | { mode: "proposta"; analyses: ProposalAnalysis[]; comparison: InvoiceComparison | null; informedTotals: Array<number | undefined> }
  | { mode: "simulacao"; analysis: ProposalAnalysis; monthlyRatePercent: number; input: Parameters<typeof simulationWhatIfs>[0] };

export function InvoiceInstallmentSimulator({ context = "ferramenta" }: { context?: "ferramenta" | "artigo" }) {
  const uid = useId();
  const id = (n: string) => `${uid}-${n}`;
  const [mode, setMode] = useState<Mode>("proposta");
  const [proposals, setProposals] = useState<ProposalFields[]>([EMPTY_PROPOSAL]);
  const [sim, setSim] = useState<SimFields>(EMPTY_SIM);
  const [extra, setExtra] = useState<ExtraFields>(EMPTY_EXTRA);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Array<{ index: number; issues: FieldIssue[] }>>([]);
  const [simErrors, setSimErrors] = useState<FieldIssue[]>([]);
  const [shown, setShown] = useState<Shown | null>(null);
  const [stale, setStale] = useState(false);
  const [premise, setPremise] = useState<string | null>(null);
  const [copied, setCopied] = useState<"ok" | "falhou" | null>(null);

  const started = useRef(false);
  const rootRef = useRef<HTMLElement | null>(null);
  const { ref: resultRef, reveal } = useRevealResult();

  function start() {
    if (!started.current) {
      started.current = true;
      track("invoice_installment_start", { context });
    }
  }

  function computeProposals(list: ProposalFields[], { announce }: { announce: boolean }) {
    const outcomes = list.map((f) => analyzeProposal(toData(f)));
    const bad = outcomes.flatMap((o, index) => (o.kind === "invalid" ? [{ index, issues: o.errors }] : []));
    if (bad.length > 0) {
      setErrors(bad);
      setStale(shown !== null);
      return;
    }
    const analyses = outcomes.map((o) => (o as { kind: "ok"; analysis: ProposalAnalysis }).analysis);
    let comparison: InvoiceComparison | null = null;
    if (list.length > 1) {
      const c = compareInvoiceProposals(list.map((f, i) => ({ label: LABELS[i]!, data: toData(f) })));
      if (c.kind === "ok") comparison = c.comparison;
    }
    setErrors([]);
    setStale(false);
    setShown({ mode: "proposta", analyses, comparison, informedTotals: list.map((f) => optMoney(f.informedTotal)) });
    if (announce) {
      track("invoice_installment_analyzed", {
        context,
        mode: "proposta",
        proposals: list.length,
        cet_informed: analyses.some((a) => a.cetAnnualPercent !== null),
        rate_informed: analyses.some((a) => a.monthlyRatePercent !== null || a.annualRatePercent !== null),
        implicit_rate: analyses.some((a) => a.implicitMonthlyPercent !== null),
      });
    }
  }

  function computeSim(f: SimFields, { announce }: { announce: boolean }) {
    const input = {
      debtCents: money(f.debt),
      downCents: optMoney(f.down),
      ratePercent: parsePercentBR(f.rate) ?? Number.NaN,
      rateUnit: f.rateUnit,
      installments: intOf(f.installments),
    };
    const o = simulateInstallments(input);
    if (o.kind === "invalid") {
      setSimErrors(o.errors);
      setStale(shown !== null);
      return;
    }
    setSimErrors([]);
    setStale(false);
    setShown({ mode: "simulacao", analysis: o.analysis, monthlyRatePercent: o.monthlyRatePercent, input });
    if (announce) {
      track("invoice_installment_analyzed", {
        context,
        mode: "simulacao",
        proposals: 1,
        cet_informed: false,
        rate_informed: true,
        implicit_rate: false,
      });
    }
  }

  function recompute(next: { proposals?: ProposalFields[]; sim?: SimFields; mode?: Mode }) {
    if (!submitted) return;
    const m = next.mode ?? mode;
    if (m === "proposta") computeProposals(next.proposals ?? proposals, { announce: false });
    else computeSim(next.sim ?? sim, { announce: false });
  }

  function updateProposal(index: number, patch: Partial<ProposalFields>) {
    start();
    const next = proposals.map((p, i) => (i === index ? { ...p, ...patch } : p));
    setProposals(next);
    setPremise(null);
    recompute({ proposals: next });
  }

  function updateSim(patch: Partial<SimFields>) {
    start();
    const next = { ...sim, ...patch };
    setSim(next);
    setPremise(null);
    recompute({ sim: next });
  }

  function addProposal() {
    if (proposals.length >= 3) return;
    track("invoice_installment_comparison_added", { context, proposals: proposals.length + 1 });
    // A dívida costuma ser a mesma em todas as opções da fatura: já vem copiada.
    const next = [...proposals, { ...EMPTY_PROPOSAL, debt: proposals[0]?.debt ?? "" }];
    setProposals(next);
  }

  function removeProposal(index: number) {
    const next = proposals.filter((_, i) => i !== index);
    setProposals(next);
    recompute({ proposals: next });
  }

  function switchMode(m: Mode) {
    if (m === mode) return;
    track("invoice_installment_mode_select", { context, mode: m });
    setMode(m);
    setShown(null);
    setSubmitted(false);
    setErrors([]);
    setSimErrors([]);
    setPremise(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    start();
    setSubmitted(true);
    if (mode === "proposta") computeProposals(proposals, { announce: true });
    else computeSim(sim, { announce: true });
    reveal();
  }

  function prefill(d: InstallmentPrefillDetail) {
    track("invoice_installment_example_select", { context, example: d.exampleId });
    const next: SimFields = {
      debt: moneyInput(d.debtCents),
      down: "",
      rate: pct(d.monthlyRatePercent),
      rateUnit: "am",
      installments: String(d.installments),
    };
    setMode("simulacao");
    setSim(next);
    setSubmitted(true);
    setErrors([]);
    setPremise(`Exemplo educativo, com taxa hipotética de ${pct(d.monthlyRatePercent)}% ao mês. Troque pelos números da sua fatura — ou use “Tenho uma proposta”.`);
    computeSim(next, { announce: true });
    rootRef.current?.scrollIntoView({ block: "start" });
    reveal();
  }
  const onPrefill = useEffectEvent((d: InstallmentPrefillDetail) => prefill(d));
  useEffect(() => {
    const listener = (e: Event) => onPrefill((e as CustomEvent<InstallmentPrefillDetail>).detail);
    window.addEventListener(INSTALLMENT_PREFILL_EVENT, listener);
    return () => window.removeEventListener(INSTALLMENT_PREFILL_EVENT, listener);
  }, []);

  async function copySummary() {
    if (!shown) return;
    const items =
      shown.mode === "proposta"
        ? shown.analyses.map((analysis, i) => ({ label: LABELS[i]!, analysis }))
        : [{ label: "Simulação", analysis: shown.analysis }];
    try {
      await navigator.clipboard.writeText(buildInstallmentSummary(items));
      setCopied("ok");
      track("invoice_installment_copy", { context });
    } catch {
      setCopied("falhou");
    }
    setTimeout(() => setCopied(null), 4000);
  }

  const errorOf = (index: number, field: ProposalField) =>
    errors.find((e) => e.index === index)?.issues.find((i) => i.field === field)?.message;
  const simErrorOf = (field: ProposalField) => simErrors.find((e) => e.field === field)?.message;
  const errorCount = errors.reduce((n, e) => n + e.issues.length, 0) + simErrors.length;

  const Title = context === "artigo" ? "h3" : "h2";
  const Sub = context === "artigo" ? "h4" : "h3";

  return (
    <section
      ref={rootRef}
      id="simulador"
      aria-label="Simulador de parcelamento da fatura"
      className="scroll-mt-24 rounded-2xl border border-brand-border bg-white p-3 shadow-sm sm:p-6"
    >
      <Segmented
        label="Como você quer usar o simulador"
        value={mode}
        onChange={switchMode}
        wide
        options={[
          { value: "proposta", label: "Tenho uma proposta" },
          { value: "simulacao", label: "Quero simular" },
        ]}
      />
      <p className="mt-2 text-xs text-brand-muted">
        {mode === "proposta"
          ? "Use os números que a fatura ou o aplicativo mostram. É a sua proposta real."
          : "Uma conta com parcelas iguais a partir de uma taxa. É uma simulação matemática, não a proposta do banco."}
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-5">
        {mode === "proposta" ? (
          <div className="space-y-5">
            {proposals.map((p, i) => (
              <fieldset key={i} className={proposals.length > 1 ? "rounded-xl border border-brand-border p-3 sm:p-4" : ""}>
                {proposals.length > 1 ? (
                  <legend className="px-1 text-sm font-bold text-brand-navy">
                    {LABELS[i]}
                    {i > 0 ? (
                      <button
                        type="button"
                        onClick={() => removeProposal(i)}
                        className="ml-3 min-h-11 text-xs font-semibold text-brand-teal underline underline-offset-2"
                      >
                        Remover
                      </button>
                    ) : null}
                  </legend>
                ) : null}
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field
                    id={id(`valor-${i}`)}
                    label="Valor que será parcelado"
                    prefix="R$"
                    placeholder="ex.: 5.000"
                    value={p.debt}
                    error={errorOf(i, "debtCents")}
                    onChange={(debt) => updateProposal(i, { debt })}
                    onBlur={() => setProposals((all) => all.map((x, k) => (k === i ? { ...x, debt: tidyMoney(x.debt) } : x)))}
                  />
                  <Field
                    id={id(`n-${i}`)}
                    label="Número de parcelas"
                    placeholder="ex.: 12"
                    numeric
                    value={p.installments}
                    error={errorOf(i, "installments")}
                    onChange={(installments) => updateProposal(i, { installments })}
                  />
                  <Field
                    id={id(`parcela-${i}`)}
                    label="Valor de cada parcela"
                    prefix="R$"
                    placeholder="ex.: 612,40"
                    value={p.installment}
                    error={errorOf(i, "installmentCents")}
                    onChange={(installment) => updateProposal(i, { installment })}
                    onBlur={() => setProposals((all) => all.map((x, k) => (k === i ? { ...x, installment: tidyMoney(x.installment) } : x)))}
                  />
                </div>
                <details className="mt-3 rounded-lg border border-brand-border" open={Boolean(p.down || p.monthly || p.annual || p.cet || p.informedTotal) || undefined}>
                  <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-semibold text-brand-navy">
                    Mais dados desta proposta (opcional)
                  </summary>
                  <div className="grid gap-4 border-t border-brand-border p-3 sm:grid-cols-2">
                    <Field
                      id={id(`entrada-${i}`)}
                      label="Entrada / pagamento inicial"
                      hint="Se a proposta pede um valor agora e o resto em parcelas."
                      prefix="R$"
                      placeholder="0,00"
                      value={p.down}
                      error={errorOf(i, "downCents")}
                      onChange={(down) => updateProposal(i, { down })}
                      onBlur={() => setProposals((all) => all.map((x, k) => (k === i ? { ...x, down: tidyMoney(x.down) } : x)))}
                    />
                    <Field
                      id={id(`total-${i}`)}
                      label="Total a pagar informado"
                      hint="Se a fatura mostrar, para conferir com a conta."
                      prefix="R$"
                      placeholder="0,00"
                      value={p.informedTotal}
                      onChange={(informedTotal) => updateProposal(i, { informedTotal })}
                      onBlur={() => setProposals((all) => all.map((x, k) => (k === i ? { ...x, informedTotal: tidyMoney(x.informedTotal) } : x)))}
                    />
                    <Field id={id(`mensal-${i}`)} label="Taxa efetiva mensal" suffix="% a.m." placeholder="da fatura" value={p.monthly} error={errorOf(i, "monthlyRatePercent")} onChange={(monthly) => updateProposal(i, { monthly })} />
                    <Field id={id(`anual-${i}`)} label="Taxa efetiva anual" suffix="% a.a." placeholder="da fatura" value={p.annual} error={errorOf(i, "annualRatePercent")} onChange={(annual) => updateProposal(i, { annual })} />
                    <div className="sm:col-span-2">
                      <Field
                        id={id(`cet-${i}`)}
                        label="CET informado"
                        hint="O Custo Efetivo Total reúne juros e outros custos da operação — para comparar ofertas, diz mais que a parcela."
                        suffix="% a.a."
                        placeholder="da fatura"
                        value={p.cet}
                        error={errorOf(i, "cetAnnualPercent")}
                        onChange={(cet) => updateProposal(i, { cet })}
                      />
                    </div>
                  </div>
                </details>
              </fieldset>
            ))}
            {proposals.length < 3 ? (
              <button
                type="button"
                onClick={addProposal}
                className="min-h-11 rounded-lg border border-dashed border-brand-navy px-4 text-sm font-semibold text-brand-navy"
              >
                + Adicionar outra proposta para comparar
              </button>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={id("s-valor")} label="Valor a parcelar" prefix="R$" placeholder="ex.: 5.000" value={sim.debt} error={simErrorOf("debtCents")} onChange={(debt) => updateSim({ debt })} onBlur={() => setSim((s) => ({ ...s, debt: tidyMoney(s.debt) }))} />
            <Field id={id("s-entrada")} label="Entrada (opcional)" prefix="R$" placeholder="0,00" value={sim.down} error={simErrorOf("downCents")} onChange={(down) => updateSim({ down })} onBlur={() => setSim((s) => ({ ...s, down: tidyMoney(s.down) }))} />
            <div>
              <label htmlFor={id("s-taxa")} className="block text-sm font-semibold text-brand-navy">Taxa de juros</label>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <input
                  id={id("s-taxa")}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder={sim.rateUnit === "am" ? "ex.: 8,90" : "ex.: 178"}
                  value={sim.rate}
                  onChange={(e) => updateSim({ rate: e.target.value })}
                  aria-invalid={Boolean(simErrorOf("monthlyRatePercent"))}
                  aria-describedby={simErrorOf("monthlyRatePercent") ? `${id("s-taxa")}-erro` : undefined}
                  className={`${inputClass} max-w-[10rem] flex-1`}
                />
                <span className="text-sm text-brand-muted" aria-hidden="true">%</span>
                <Segmented label="Unidade da taxa" value={sim.rateUnit} onChange={(rateUnit) => updateSim({ rateUnit })} options={[{ value: "am", label: "ao mês" }, { value: "aa", label: "ao ano" }]} />
              </div>
              {simErrorOf("monthlyRatePercent") ? (
                <p id={`${id("s-taxa")}-erro`} className="mt-1.5 text-sm font-medium text-brand-danger">{simErrorOf("monthlyRatePercent")}</p>
              ) : null}
            </div>
            <Field id={id("s-n")} label="Número de parcelas" placeholder="ex.: 12" numeric value={sim.installments} error={simErrorOf("installments")} onChange={(installments) => updateSim({ installments })} />
          </div>
        )}

        <details className="mt-5 rounded-lg border border-brand-border" onToggle={(e) => { if ((e.currentTarget as HTMLDetailsElement).open) track("invoice_installment_rules_opened", { context }); }}>
          <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-semibold text-brand-navy">
            Veio do rotativo? Limite de juros e quitação à vista (opcional)
          </summary>
          <div className="space-y-5 border-t border-brand-border p-4">
            <div>
              <p className="text-sm font-semibold text-brand-navy">Este parcelamento veio de uma dívida que já estava no rotativo?</p>
              <div className="mt-1.5">
                <Segmented label="Veio do rotativo" value={extra.origin} onChange={(origin) => setExtra((x) => ({ ...x, origin }))} options={[{ value: "sim", label: "Sim" }, { value: "nao", label: "Não" }, { value: "nao-sei", label: "Não sei" }]} />
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-brand-navy">Quando essa dívida começou?</p>
              <div className="mt-1.5">
                <Segmented
                  label="Quando essa dívida começou"
                  value={extra.start}
                  onChange={(start) => setExtra((x) => ({ ...x, start }))}
                  options={[{ value: "depois", label: `A partir de ${formatIsoDate(INTEREST_CAP.effectiveFrom)}` }, { value: "antes", label: "Antes" }, { value: "nao-sei", label: "Não sei" }]}
                />
              </div>
            </div>
            {extra.origin === "sim" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id={id("original")} label="Valor original da dívida que entrou no rotativo" prefix="R$" placeholder="da fatura" value={extra.original} onChange={(original) => setExtra((x) => ({ ...x, original }))} onBlur={() => setExtra((x) => ({ ...x, original: tidyMoney(x.original) }))} />
                <Field id={id("cobrado")} label="Juros e encargos já cobrados antes do parcelamento" hint="Sem o IOF, que fica fora do limite." prefix="R$" placeholder="0,00" value={extra.charged} onChange={(charged) => setExtra((x) => ({ ...x, charged }))} onBlur={() => setExtra((x) => ({ ...x, charged: tidyMoney(x.charged) }))} />
              </div>
            ) : null}
            <Field
              id={id("avista")}
              label="Valor para quitar hoje, à vista (se a fatura mostrar)"
              hint="Para comparar o total do parcelamento com a quitação agora."
              prefix="R$"
              placeholder="0,00"
              value={extra.cashPayoff}
              onChange={(cashPayoff) => setExtra((x) => ({ ...x, cashPayoff }))}
              onBlur={() => setExtra((x) => ({ ...x, cashPayoff: tidyMoney(x.cashPayoff) }))}
            />
          </div>
        </details>

        {errorCount > 0 ? (
          <p role="alert" className="mt-4 rounded-lg border border-brand-danger/40 bg-brand-danger-soft p-3 text-sm text-brand-danger">
            {errorCount === 1 ? "Um campo precisa de ajuste — ele está destacado acima." : "Alguns campos precisam de ajuste — eles estão destacados acima."}
          </p>
        ) : null}

        <button type="submit" className="mt-5 min-h-12 w-full rounded-lg bg-brand-teal-dark px-6 font-semibold text-white hover:bg-brand-teal sm:w-auto">
          {mode === "proposta" ? (proposals.length > 1 ? "Comparar propostas" : "Analisar proposta") : "Simular parcelamento"}
        </button>
        <p className="mt-3 text-xs text-brand-muted">
          {mode === "proposta" ? "Não sabe a taxa? Sem problema. " : ""}Sem cadastro · Sem CPF · Nada do que você digita sai do seu aparelho.
        </p>
      </form>

      <p className="sr-only" aria-live="polite">
        {shown && !stale
          ? shown.mode === "proposta"
            ? shown.analyses.map((a, i) => `${LABELS[i]}: ${a.installments} parcelas de ${brl(a.installmentCents)}, total de ${brl(a.disbursedCents)}.`).join(" ")
            : `Simulação: ${shown.analysis.installments} parcelas de ${brl(shown.analysis.installmentCents)}, total de ${brl(shown.analysis.disbursedCents)}.`
          : ""}
      </p>

      <div ref={resultRef} className="scroll-mt-24">
        {shown ? (
          <div className={`mt-6 border-t border-brand-border pt-6 ${stale ? "opacity-60" : ""}`}>
            {premise ? <p className="mb-4 rounded-lg bg-brand-gold-soft px-3 py-2 text-sm text-brand-gold-dark">{premise}</p> : null}
            {stale ? <p className="mb-4 text-sm font-medium text-brand-warning">Resultado da última simulação válida. Ajuste o campo destacado para atualizar.</p> : null}

            {shown.mode === "proposta" && shown.comparison ? (
              <ComparisonView comparison={shown.comparison} Title={Title} Sub={Sub} />
            ) : null}
            {shown.mode === "proposta" && !shown.comparison ? (
              <SingleResult analysis={shown.analyses[0]!} informedTotal={shown.informedTotals[0]} Title={Title} kind="proposta" />
            ) : null}
            {shown.mode === "simulacao" ? (
              <>
                <SingleResult analysis={shown.analysis} Title={Title} kind="simulacao" />
                <SimulationWhatIfs input={shown.input} monthlyRatePercent={shown.monthlyRatePercent} base={shown.analysis} Sub={Sub} />
              </>
            ) : null}

            <ExtraBlocks
              extra={extra}
              items={shown.mode === "proposta" ? shown.analyses.map((analysis, i) => ({ label: LABELS[i]!, analysis })) : [{ label: "Simulação", analysis: shown.analysis }]}
              Sub={Sub}
            />

            <div className="mt-6 space-y-3 text-sm">
              <p>
                <span className="text-brand-muted">Ainda está no rotativo?</span>{" "}
                <Link href="/calculadoras/juros-cartao-credito/" className="font-semibold text-brand-teal underline underline-offset-2">Calcular os juros até a próxima fatura</Link>
              </p>
              <p>
                <span className="text-brand-muted">Pensando em usar outro crédito para quitar o cartão?</span>{" "}
                <Link href="/calculadoras/trocar-divida/" className="font-semibold text-brand-teal underline underline-offset-2">Compare os custos das duas dívidas</Link>
              </p>
              <p>
                <span className="text-brand-muted">Encontrou uma condição em outra instituição?</span>{" "}
                <Link href="/organizacao-financeira/como-sair-do-rotativo/" className="font-semibold text-brand-teal underline underline-offset-2">Entenda a portabilidade da dívida do cartão</Link>
              </p>
              <p>
                <span className="text-brand-muted">Já tem um parcelamento e quer quitar antes?</span>{" "}
                <Link href="/calculadoras/quitacao-antecipada/" className="font-semibold text-brand-teal underline underline-offset-2">Simular a quitação antecipada</Link>
              </p>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
              <button type="button" onClick={copySummary} className="min-h-11 rounded-lg border border-brand-border px-4 font-semibold text-brand-navy">
                {copied === "ok" ? "Resumo copiado ✓" : shown.mode === "proposta" && shown.comparison ? "Copiar comparação" : "Copiar resumo"}
              </button>
              <span role="status" className="text-brand-muted">{copied === "falhou" ? "Não foi possível copiar neste navegador." : ""}</span>
            </div>
          </div>
        ) : null}
      </div>

      <p className="mt-6 rounded-lg border border-brand-warning/30 bg-brand-warning-soft p-4 text-sm leading-relaxed text-brand-warning">
        Simulação educativa. Os valores que valem são os da sua fatura e do contrato. A ferramenta não calcula CET
        e não indica qual opção escolher.
      </p>
    </section>
  );
}

/* ---------- resultado de uma proposta ---------- */

function SingleResult({
  analysis: a,
  informedTotal,
  Title,
  kind,
}: {
  analysis: ProposalAnalysis;
  informedTotal?: number;
  Title: "h2" | "h3";
  kind: "proposta" | "simulacao";
}) {
  const hasDown = a.downCents > 0;
  const below = a.extraCostCents < 0;
  const segments = [
    ...(hasDown ? [{ key: "entrada", label: "Entrada", value: a.downCents, cls: "bg-brand-teal" }] : []),
    { key: "parcelado", label: "Valor parcelado", value: a.financedCents, cls: "bg-brand-navy" },
    ...(a.extraCostCents > 0 ? [{ key: "custo", label: "Custo adicional", value: a.extraCostCents, cls: "bg-brand-gold" }] : []),
  ];
  const informedDiff = informedTotal !== undefined && Number.isFinite(informedTotal) ? informedTotal - a.disbursedCents : null;

  return (
    <>
      <p className="mb-2 inline-block rounded bg-brand-surface-soft px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-brand-muted">
        {kind === "proposta" ? "Dados da sua proposta" : "Simulação com parcelas constantes"}
      </p>
      <Title tabIndex={-1} data-result-heading className="font-serif text-xl font-bold text-brand-navy">
        Seu parcelamento em números
      </Title>

      {/* A cadeia do critério de conclusão: do valor ao custo. */}
      <ol className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <li className="rounded-lg bg-brand-surface-soft p-3"><span className="block text-xs text-brand-muted">Você parcela</span><strong className="tabular-nums text-brand-navy">{brl(a.financedCents)}</strong></li>
        <li className="rounded-lg bg-brand-surface-soft p-3"><span className="block text-xs text-brand-muted">Vai pagar por mês</span><strong className="tabular-nums text-brand-navy">{brl(a.installmentCents)}</strong></li>
        <li className="rounded-lg bg-brand-surface-soft p-3"><span className="block text-xs text-brand-muted">Por quanto tempo</span><strong className="text-brand-navy">{a.installments} parcelas · {monthsLabel(a.installments)}</strong></li>
        <li className="rounded-lg bg-brand-surface-soft p-3"><span className="block text-xs text-brand-muted">Total das parcelas</span><strong className="tabular-nums text-brand-navy">{brl(a.installmentsTotalCents)}</strong></li>
      </ol>

      <dl className="mt-4">
        {hasDown ? <Row label="Entrada" value={brl(a.downCents)} /> : null}
        {hasDown ? <Row label="Desembolso total" note="entrada + parcelas" value={brl(a.disbursedCents)} /> : null}
        <Row
          label="Custo acima do valor parcelado"
          note={below ? "as parcelas somam menos que o valor — confira os dados" : `${pct(a.extraShare * 100, 1)}% acima; pode incluir juros, IOF e tarifas`}
          value={brl(a.extraCostCents)}
          strong
        />
        {a.implicitMonthlyPercent !== null && kind === "proposta" ? (
          <Row
            label="Taxa implícita aproximada nas parcelas"
            note={`${pct(a.implicitAnnualPercent!, 1)}% ao ano, equivalente · estimativa pelas parcelas iguais, não é a taxa do contrato`}
            value={`${pct(a.implicitMonthlyPercent)}% a.m.`}
          />
        ) : null}
        {a.monthlyRatePercent !== null ? (
          <Row label={kind === "proposta" ? "Taxa mensal informada" : "Taxa usada na simulação"} value={`${pct(a.monthlyRatePercent)}% a.m.`} />
        ) : null}
        {a.annualRatePercent !== null ? <Row label="Taxa anual informada" value={`${pct(a.annualRatePercent)}% a.a.`} /> : null}
        {kind === "proposta" ? (
          <Row label="CET" value={a.cetAnnualPercent !== null ? `${pct(a.cetAnnualPercent)}% a.a.` : "não informado"} note={a.cetAnnualPercent === null ? "procure por “CET” perto das opções de parcelamento da fatura" : "informado pela instituição"} />
        ) : null}
      </dl>
      {kind === "proposta" && a.implicitMonthlyPercent === null && !below ? (
        <p className="mt-2 text-xs text-brand-muted">Não há informações suficientes para estimar a taxa implícita com segurança.</p>
      ) : null}
      {a.ratesIncoherent ? (
        <p role="note" className="mt-2 rounded-lg bg-brand-warning-soft p-3 text-sm text-brand-warning">
          As taxas mensal e anual informadas não parecem equivalentes ({pct(a.monthlyRatePercent!)}% ao mês equivale a{" "}
          {pct(a.equivalentAnnualOfMonthly!, 1)}% ao ano). Confira se copiou corretamente os dados da fatura.
        </p>
      ) : null}
      {informedDiff !== null && Math.abs(informedDiff) >= 100 ? (
        <p role="note" className="mt-2 rounded-lg bg-brand-warning-soft p-3 text-sm text-brand-warning">
          O total informado ({brl(informedTotal!)}) difere em {brl(Math.abs(informedDiff))} da soma calculada. Pode haver
          custo fora das parcelas ou um dado copiado diferente — confira na fatura.
        </p>
      ) : null}

      {!below ? (
        <>
          <div className="mt-6 overflow-hidden rounded-xl border border-brand-border">
            <div className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">O número que aparece</p>
              <p className="mt-1 font-serif text-xl font-bold tabular-nums text-brand-navy">{a.installments}x de {brl(a.installmentCents)}</p>
            </div>
            <div className="border-t border-brand-border bg-brand-gold-soft p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-gold-dark">O número que quase ninguém olha</p>
              <p className="mt-1 font-serif text-xl font-bold tabular-nums text-brand-navy">{brl(a.disbursedCents)} no total</p>
            </div>
            <div className="border-t border-brand-border p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Quanto o parcelamento acrescentou</p>
              <p className="mt-1 font-serif text-xl font-bold tabular-nums text-brand-navy">{brl(a.extraCostCents)}</p>
              <p className="mt-1 text-sm text-brand-text">
                A cada R$ 100 da dívida, o desembolso total desta {kind === "proposta" ? "proposta" : "simulação"} equivale a
                aproximadamente {brl(a.per100Cents)}.
              </p>
            </div>
          </div>

          <figure className="mt-6">
            <figcaption className="font-serif text-lg font-bold text-brand-navy">Para onde vai o total</figcaption>
            <div
              role="img"
              aria-label={`Desembolso total de ${brl(a.disbursedCents)}: ${segments.map((s) => `${s.label}, ${brl(s.value)}`).join("; ")}.`}
              className="mt-3 flex h-6 w-full overflow-hidden rounded-md"
            >
              {segments.map((s) => (
                <div key={s.key} className={s.cls} style={{ width: `${(s.value / a.disbursedCents) * 100}%` }} />
              ))}
            </div>
            <ul className="mt-3 space-y-1 text-sm" aria-hidden="true">
              {segments.map((s) => (
                <li key={s.key} className="flex items-center gap-2">
                  <span className={`inline-block h-3 w-3 shrink-0 rounded-sm ${s.cls}`} />
                  <span>{s.label}</span>
                  <span className="ml-auto font-semibold tabular-nums">{brl(s.value)}</span>
                </li>
              ))}
            </ul>
          </figure>
        </>
      ) : null}
    </>
  );
}

/* ---------- comparação ---------- */

function ComparisonView({ comparison, Title, Sub }: { comparison: InvoiceComparison; Title: "h2" | "h3"; Sub: "h3" | "h4" }) {
  const { analyses, base, tradeoffs } = comparison;
  const winners = (key: string) => base.criteria.find((c) => c.key === key && c.available)?.winners ?? [];
  const badge: Record<number, string[]> = {};
  const addBadge = (key: string, text: string) => {
    const w = winners(key);
    if (w.length > 0 && w.length < analyses.length) for (const i of w) (badge[i] ??= []).push(text);
  };
  addBadge("lowestTotalPaid", "Menor total nesta comparação");
  addBadge("lowestInstallment", "Menor parcela");
  addBadge("shortestTerm", "Menor prazo");
  addBadge("lowestCet", "Menor CET informado");

  const rows: Array<{ label: string; cells: string[] }> = [
    { label: "Parcela", cells: analyses.map((a) => brl(a.installmentCents)) },
    { label: "Prazo", cells: analyses.map((a) => `${a.installments} ${a.installments === 1 ? "mês" : "meses"}`) },
    ...(analyses.some((a) => a.downCents > 0) ? [{ label: "Entrada", cells: analyses.map((a) => brl(a.downCents)) }] : []),
    { label: "Total pago", cells: analyses.map((a) => brl(a.disbursedCents)) },
    { label: "Custo acima do valor parcelado", cells: analyses.map((a) => brl(a.extraCostCents)) },
    ...(analyses.some((a) => a.implicitMonthlyPercent !== null)
      ? [{ label: "Taxa implícita aproximada", cells: analyses.map((a) => (a.implicitMonthlyPercent !== null ? `${pct(a.implicitMonthlyPercent)}% a.m.` : "—")) }]
      : []),
    ...(analyses.some((a) => a.monthlyRatePercent !== null)
      ? [{ label: "Taxa mensal informada", cells: analyses.map((a) => (a.monthlyRatePercent !== null ? `${pct(a.monthlyRatePercent)}% a.m.` : "não informada")) }]
      : []),
    ...(analyses.some((a) => a.annualRatePercent !== null)
      ? [{ label: "Taxa anual informada", cells: analyses.map((a) => (a.annualRatePercent !== null ? `${pct(a.annualRatePercent)}% a.a.` : "não informada")) }]
      : []),
    ...(analyses.some((a) => a.cetAnnualPercent !== null)
      ? [{ label: "CET informado", cells: analyses.map((a) => (a.cetAnnualPercent !== null ? `${pct(a.cetAnnualPercent)}% a.a.` : "não informado")) }]
      : []),
  ];

  // "Qual é o preço de reduzir a parcela?" — menor parcela contra menor total.
  const iLow = analyses.reduce((m, a, i) => (a.installmentCents < analyses[m]!.installmentCents ? i : m), 0);
  const iTotal = analyses.reduce((m, a, i) => (a.disbursedCents < analyses[m]!.disbursedCents ? i : m), 0);
  const low = analyses[iLow]!;
  const cheap = analyses[iTotal]!;
  const priceOfLower =
    iLow !== iTotal && low.disbursedCents > cheap.disbursedCents
      ? {
          pmt: cheap.installmentCents - low.installmentCents,
          months: low.installments - cheap.installments,
          total: low.disbursedCents - cheap.disbursedCents,
        }
      : null;

  const maxTotal = Math.max(...analyses.map((a) => a.disbursedCents));
  const maxPmt = Math.max(...analyses.map((a) => a.installmentCents));

  return (
    <>
      <p className="mb-2 inline-block rounded bg-brand-surface-soft px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-brand-muted">
        Dados das suas propostas
      </p>
      <Title tabIndex={-1} data-result-heading className="font-serif text-xl font-bold text-brand-navy">
        As propostas lado a lado
      </Title>
      {base.warnings.differentNetAmounts ? (
        <p role="note" className="mt-2 rounded-lg bg-brand-warning-soft p-3 text-sm text-brand-warning">
          Os valores parcelados das propostas são diferentes: o total pago, sozinho, não compara as opções. Confira se
          copiou o mesmo valor da fatura em todas.
        </p>
      ) : null}

      {/* Celular: um cartão por proposta, mesmas métricas na mesma ordem. */}
      <ul className="mt-3 space-y-3 sm:hidden">
        {analyses.map((a, i) => (
          <li key={i} className="rounded-xl border border-brand-border p-3">
            <p className="font-semibold text-brand-navy">{LABELS[i]}</p>
            {badge[i] ? <p className="mt-1 flex flex-wrap gap-1">{badge[i]!.map((b) => <span key={b} className="rounded bg-brand-surface-soft px-1.5 py-0.5 text-[11px] font-semibold text-brand-muted">{b}</span>)}</p> : null}
            <dl className="mt-2">
              {rows.map((r) => (
                <div key={r.label} className="flex items-baseline justify-between gap-3 border-t border-brand-border py-1.5 text-sm">
                  <dt className="text-brand-muted">{r.label}</dt>
                  <dd className="text-right font-semibold tabular-nums">{r.cells[i]}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
      <div className="mt-3 hidden overflow-x-auto rounded-xl border border-brand-border sm:block">
        <table className="w-full min-w-0 border-collapse text-sm">
          <caption className="sr-only">Comparação das propostas de parcelamento</caption>
          <thead className="bg-brand-surface-soft">
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-semibold text-brand-navy">Métrica</th>
              {analyses.map((_, i) => (
                <th key={i} scope="col" className="px-3 py-2 text-right font-semibold text-brand-navy">{LABELS[i]}</th>
              ))}
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-brand-border">
                <th scope="row" className="px-3 py-2 text-left font-medium">{r.label}</th>
                {r.cells.map((c, i) => <td key={i} className="px-3 py-2 text-right">{c}</td>)}
              </tr>
            ))}
            <tr className="border-t border-brand-border">
              <th scope="row" className="px-3 py-2 text-left font-medium">Nesta comparação</th>
              {analyses.map((_, i) => (
                <td key={i} className="px-3 py-2 text-right text-xs text-brand-muted">{badge[i]?.join(" · ") ?? "—"}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-5 space-y-2 rounded-xl bg-brand-teal-soft p-4 text-sm leading-relaxed text-brand-text">
        {tradeoffs.map((t) => <p key={t}>{t}</p>)}
      </div>

      {priceOfLower ? (
        <div className="mt-6 rounded-xl border border-brand-border p-4">
          <Sub className="font-serif text-lg font-bold text-brand-navy">Qual é o preço de reduzir a parcela?</Sub>
          <p className="mt-2 leading-relaxed text-brand-text">
            Para reduzir a parcela em <strong className="tabular-nums">{brl(priceOfLower.pmt)}</strong>, você permaneceria{" "}
            <strong>{monthsLabel(priceOfLower.months)} a mais</strong> pagando e desembolsaria{" "}
            <strong className="tabular-nums">{brl(priceOfLower.total)} a mais</strong> no total.
          </p>
        </div>
      ) : null}

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        {[
          { title: "Total pago", value: (a: ProposalAnalysis) => a.disbursedCents, max: maxTotal },
          { title: "Parcela mensal", value: (a: ProposalAnalysis) => a.installmentCents, max: maxPmt },
        ].map((chart) => (
          <figure key={chart.title}>
            <figcaption className="text-sm font-bold text-brand-navy">{chart.title}</figcaption>
            <ul className="mt-2 space-y-2" role="img" aria-label={`${chart.title}: ${analyses.map((a, i) => `${LABELS[i]}, ${brl(chart.value(a))}`).join("; ")}.`}>
              {analyses.map((a, i) => (
                <li key={i} className="text-xs">
                  <div className="flex justify-between"><span>{LABELS[i]}</span><span className="font-semibold tabular-nums">{brl(chart.value(a))}</span></div>
                  <div className="mt-1 h-3 w-full rounded bg-brand-surface-soft">
                    <div className="h-3 rounded bg-brand-navy" style={{ width: `${(chart.value(a) / chart.max) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </figure>
        ))}
      </div>
    </>
  );
}

/* ---------- e se? (simulação) ---------- */

function SimulationWhatIfs({
  input,
  monthlyRatePercent,
  base,
  Sub,
}: {
  input: Parameters<typeof simulationWhatIfs>[0];
  monthlyRatePercent: number;
  base: ProposalAnalysis;
  Sub: "h3" | "h4";
}) {
  const rows = simulationWhatIfs(input, monthlyRatePercent);
  if (rows.length === 0) return null;
  return (
    <div className="mt-6">
      <Sub className="font-serif text-lg font-bold text-brand-navy">E se?</Sub>
      <p className="mt-1 text-sm text-brand-muted">Mesma dívida; muda uma coisa de cada vez. Cenários matemáticos, não ofertas.</p>
      <ul className="mt-3 divide-y divide-brand-border rounded-xl border border-brand-border">
        {rows.map((r) => (
          <li key={r.id} className="px-3 py-2.5 text-sm">
            <p className="font-medium text-brand-navy">{r.label}</p>
            <p className="mt-0.5 flex flex-wrap gap-x-3 tabular-nums text-brand-text">
              <span>Parcela {brl(r.analysis.installmentCents)}</span>
              <span>Total {brl(r.analysis.disbursedCents)}</span>
              <span className="font-semibold">Custo adicional {brl(r.analysis.extraCostCents)} (−{brl(base.extraCostCents - r.analysis.extraCostCents)})</span>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- teto e quitação à vista ---------- */

function ExtraBlocks({ extra, items, Sub }: { extra: ExtraFields; items: Array<{ label: string; analysis: ProposalAnalysis }>; Sub: "h3" | "h4" }) {
  const cash = optMoney(extra.cashPayoff);
  const original = optMoney(extra.original);
  const charged = optMoney(extra.charged);
  const many = items.length > 1;
  // O teto é conferido proposta a proposta: cada uma tem o próprio custo adicional.
  const caps = items.map(({ label, analysis: a }) => {
    if (extra.start === "" || extra.origin === "" || a.extraCostCents < 0) return null;
    const capOriginal = extra.origin === "sim" ? (original !== undefined && original > 0 ? original : null) : a.financedCents;
    if (capOriginal === null) return null;
    const cap = applyRegulatoryCap({
      originalCents: capOriginal,
      alreadyChargedCents: extra.origin === "sim" ? (charged ?? 0) : 0,
      newChargesCents: a.extraCostCents,
      start: extra.start,
    });
    return { label, a, cap, capOriginal };
  });
  const first = caps[0] ?? null;
  const sameOriginal = caps.every((c) => c !== null && first !== null && c.capOriginal === first.capOriginal);
  const exceeding = caps.flatMap((c) =>
    c && (c.cap.status === "ultrapassaria" || (c.cap.status === "incerto" && c.cap.wouldExceed)) ? [{ label: c.label, excessCents: c.cap.excessCents }] : [],
  );
  return (
    <>
      {cash !== undefined && Number.isFinite(cash) && cash > 0 ? (
        <div className="mt-6">
          <Sub className="font-serif text-lg font-bold text-brand-navy">Quitar hoje ou parcelar</Sub>
          <dl className="mt-2">
            <Row label="Quitar hoje, à vista" value={brl(cash)} />
            {items.map(({ label, analysis: a }) => (
              <Row
                key={label}
                label={many ? `${label}, no total` : "Parcelamento, no total"}
                value={brl(a.disbursedCents)}
                strong={!many}
                note={`${brl(Math.abs(a.disbursedCents - cash))} ${a.disbursedCents >= cash ? "a mais" : "a menos"} que a quitação agora`}
              />
            ))}
          </dl>
        </div>
      ) : null}

      <div className="mt-6 rounded-xl border border-brand-border p-4 text-sm leading-relaxed text-brand-text">
        <Sub className="font-semibold text-brand-navy">Existe limite para os juros e encargos?</Sub>
        <p className="mt-1">{INTEREST_CAP.summary} O limite vale para o que foi acumulado — não é a taxa — e alcança o rotativo e o parcelamento da fatura.</p>
        {extra.origin === "sim" && CAP_CONTINUITY.verifiedAt ? <p className="mt-2">{CAP_CONTINUITY.summary}</p> : null}
        {first && sameOriginal ? (
          first.cap.status === "nao-se-aplica" ? (
            <p className="mt-2">Pelo que você informou, a dívida começou antes da vigência do limite, e a regra pode não alcançá-la. Confira na fatura.</p>
          ) : (
            <>
              <dl className="mt-3">
                <Row label="Valor original considerado" value={brl(first.capOriginal)} note={extra.origin === "sim" ? (CAP_CONTINUITY.verifiedAt ? "o que entrou no rotativo, como você informou" : "o valor original que você informou") : "o valor parcelado"} />
                <Row label="Máximo de juros e encargos pela regra" value={brl(first.cap.capCents)} />
                {extra.origin === "sim" ? <Row label="Já cobrados antes do parcelamento" value={brl(charged ?? 0)} /> : null}
                <Row label="Margem restante antes do parcelamento" value={brl(first.cap.roomCents)} strong />
                {caps.map((c) =>
                  c ? (
                    <Row
                      key={c.label}
                      label={many ? `Custo adicional — ${c.label}` : "Custo adicional deste parcelamento"}
                      value={brl(c.a.extraCostCents)}
                      note="pode incluir IOF, que fica fora do limite"
                    />
                  ) : null,
                )}
              </dl>
              {exceeding.length > 0 ? (
                <div role="note" className="mt-3 rounded-lg bg-brand-warning-soft p-3">
                  <p className="font-semibold text-brand-warning">Atenção à regra aplicável</p>
                  <p className="mt-1">
                    Pelas informações fornecidas,{" "}
                    {many
                      ? exceeding.map((e) => `${e.label} parece ultrapassar o limite em ${brl(e.excessCents)}`).join("; ")
                      : `o valor parece ultrapassar em ${brl(exceeding[0]!.excessCents)} o limite`}{" "}
                    aplicável às operações alcançadas pela regra. Confira os valores, a data de origem da dívida e a documentação da
                    instituição — se o custo adicional incluir IOF, a conta do limite é menor.
                  </p>
                </div>
              ) : null}
            </>
          )
        ) : caps.some((c) => c !== null) ? (
          <p className="mt-2 text-brand-muted">As propostas têm valores parcelados diferentes; confira o limite de cada uma separadamente.</p>
        ) : (
          <p className="mt-2 text-brand-muted">Para comparar com o limite, responda às perguntas sobre a origem da dívida no campo opcional acima.</p>
        )}
        <p className="mt-2 text-xs text-brand-muted">
          Fonte:{" "}
          <a href={INTEREST_CAP.source.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{INTEREST_CAP.source.organization}</a>. Informações verificadas em {INTEREST_CAP.verifiedAt}.
          {extra.origin === "sim" && CAP_CONTINUITY.verifiedAt ? (
            <>
              {" "}Continuidade do limite no parcelamento:{" "}
              <a href={CAP_CONTINUITY.source.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{CAP_CONTINUITY.source.organization}</a>. Informações verificadas em {CAP_CONTINUITY.verifiedAt}.
            </>
          ) : null}
        </p>
      </div>
    </>
  );
}
