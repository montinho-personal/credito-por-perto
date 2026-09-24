"use client";

/**
 * QUANDO FICO LIVRE DAS DÍVIDAS? — simulador
 * ============================================================================
 *
 * HOJE → SE NADA MUDAR → PRIMEIRO MARCO → METADE → ÚLTIMA DÍVIDA → LIVRE,
 * e depois "E se…?". A pessoa monta a rota dívida por dívida (nunca um
 * formulário gigante), responde se mantém o orçamento quando uma dívida
 * termina e escolhe para onde vai o dinheiro extra. O resultado começa
 * pela data, não pelo número de meses, e mostra sempre capacidade e custo
 * lado a lado.
 *
 * Nada do que é digitado sai do navegador. A medição recebe só contagens e
 * categorias (tipo de dívida, estratégia), nunca saldo, taxa ou apelido.
 */

import Link from "next/link";
import { useEffect, useEffectEvent, useId, useMemo, useRef, useState } from "react";
import { track } from "@/lib/analytics/track";
import { formatMonths } from "@/lib/calculators/debt-plan";
import { parseBRLToCents, parsePercentBR } from "@/lib/calculators/proposal-comparison";
import { todayInBrazil } from "@/lib/calculators/civil-date";
import {
  buildJourneySummary,
  compareJourneys,
  marginalEffect,
  monthDate,
  monthLabel,
  monthShort,
  resolveModel,
  simulateJourney,
  withLumpSum,
  withMonthlyExtra,
  MAX_JOURNEY_MONTHS,
  type DebtIssue,
  type JourneyComparison,
  type JourneyDebt,
  type JourneyDebtType,
  type JourneyInput,
  type JourneyResult,
  type RateUnit,
  type Strategy,
} from "@/lib/simulators/debt-journey";
import { useRevealResult } from "@/components/calculators/use-reveal-result";
import { FinancialJourney, type JourneyStep } from "./FinancialJourney";

export const DEBT_JOURNEY_PREFILL_EVENT = "cpp:simular-rota";

export interface DebtJourneyPrefill {
  exampleId: string;
  debts: Array<Pick<JourneyDebt, "label" | "type" | "balanceCents" | "ratePercent" | "rateUnit" | "paymentCents" | "remainingPayments">>;
  keepBudget: boolean;
  premise: string;
}

type Context = "ferramenta" | "artigo";

const TYPE_OPTIONS: ReadonlyArray<{ value: JourneyDebtType; label: string }> = [
  { value: "cartao-parcelado", label: "Cartão de crédito (fatura parcelada)" },
  { value: "cartao-rotativo", label: "Cartão de crédito (no rotativo)" },
  { value: "emprestimo", label: "Empréstimo pessoal" },
  { value: "consignado", label: "Consignado" },
  { value: "financiamento", label: "Financiamento" },
  { value: "cheque-especial", label: "Cheque especial" },
  { value: "parcelamento", label: "Parcelamento (loja, crediário)" },
  { value: "acordo", label: "Renegociação / acordo" },
  { value: "outro", label: "Outro" },
];

interface DebtForm {
  id: string;
  label: string;
  type: JourneyDebtType;
  balance: string;
  rate: string;
  rateUnit: RateUnit;
  rateUnknown: boolean;
  payment: string;
  remaining: string;
  system: "price" | "sac" | "nao-sei";
  fees: string;
}

const EXTRA_STEPS = [10_000, 30_000, 50_000] as const;

const brl = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const brlRound = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(cents / 100);
const pct = (v: number, digits = 2) => v.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const moneyInput = (cents: number) => (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function parseMoney(raw: string): number | null {
  if (raw.trim() === "") return null;
  const c = parseBRLToCents(raw);
  return c === null ? Number.NaN : c;
}
function tidyMoney(raw: string): string {
  const c = parseBRLToCents(raw);
  return c === null ? raw : moneyInput(c);
}
function parseInt0(raw: string): number | null {
  if (raw.trim() === "") return null;
  return /^\d+$/.test(raw.trim()) ? Number(raw.trim()) : Number.NaN;
}

let seq = 0;
const newId = () => `d${Date.now().toString(36)}${(seq++).toString(36)}`;

function emptyDebt(): DebtForm {
  return { id: newId(), label: "", type: "emprestimo", balance: "", rate: "", rateUnit: "am", rateUnknown: false, payment: "", remaining: "", system: "nao-sei", fees: "" };
}

function toDebt(f: DebtForm): JourneyDebt {
  const rate = f.rateUnknown ? null : (parsePercentBR(f.rate) ?? Number.NaN);
  return {
    id: f.id,
    label: f.label.trim() || TYPE_OPTIONS.find((t) => t.value === f.type)?.label || "Dívida",
    type: f.type,
    balanceCents: parseMoney(f.balance),
    ratePercent: f.rateUnknown ? null : rate,
    rateUnit: f.rateUnit,
    paymentCents: parseMoney(f.payment),
    remainingPayments: parseInt0(f.remaining),
    system: f.type === "financiamento" ? f.system : "nao-sei",
    recurringFeesCents: parseMoney(f.fees) ?? 0,
  };
}

const inputClass =
  "min-h-12 w-full min-w-0 rounded-lg border border-brand-border bg-white px-3 py-2.5 text-base text-brand-text tabular-nums focus:border-brand-teal aria-[invalid=true]:border-brand-danger";

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: React.ReactNode }) {
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
    </div>
  );
}

function Segmented<T extends string>({ label, value, options, onChange, wide }: { label: string; value: T | null; options: ReadonlyArray<{ value: T; label: string }>; onChange: (v: T) => void; wide?: boolean }) {
  return (
    <div role="group" aria-label={label} className={`flex flex-wrap rounded-lg border border-brand-border p-0.5 ${wide ? "w-full" : "shrink-0"}`}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)} className={`min-h-11 rounded-md px-3 text-sm font-semibold text-brand-muted aria-pressed:bg-brand-navy aria-pressed:text-white ${wide ? "flex-1" : ""}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- gráfico de saldo: base × cenário ---------- */

function BalanceChart({ base, alt, startIso }: { base: number[]; alt: number[] | null; startIso: string }) {
  const n = Math.max(base.length, alt?.length ?? 0, 2);
  const max = Math.max(...base, ...(alt ?? []), 1);
  const W = 1000;
  const H = 360;
  const x = (k: number) => (k / (n - 1)) * W;
  const y = (v: number) => H - (v / max) * H;
  const path = (values: number[]) => `M0,${y(values[0]!).toFixed(1)} ` + values.map((v, k) => `L${x(k + 1).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const step = n > 36 ? 12 : n > 12 ? 6 : 1;
  const sample: number[] = [];
  for (let k = 1; k <= n; k += step) sample.push(k);
  if (sample[sample.length - 1] !== n) sample.push(n);
  return (
    <figure className="mt-3">
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm" aria-hidden="true">
        <li className="flex items-center gap-2">
          <svg width="28" height="10"><line x1="1" y1="5" x2="27" y2="5" stroke="#0d3b66" strokeWidth="3" /></svg>
          <span className="font-semibold text-brand-navy">Se nada mudar</span>
        </li>
        {alt ? (
          <li className="flex items-center gap-2">
            <svg width="28" height="10"><line x1="1" y1="5" x2="27" y2="5" stroke="#8a6100" strokeWidth="3" strokeDasharray="6 4" /></svg>
            <span className="font-semibold" style={{ color: "#8a6100" }}>Com a mudança</span>
          </li>
        ) : null}
      </ul>
      <div className="relative mt-2">
        <p className="mb-1 text-xs tabular-nums text-brand-muted" aria-hidden="true">{brlRound(max)}</p>
        <div role="img" aria-label={`Saldo total ao longo de ${n} meses${alt ? ", no cenário atual e no cenário com a mudança" : ""}. Os valores estão na tabela abaixo.`} className="relative h-44 w-full border-b border-l border-brand-border sm:h-56">
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
            {[0.25, 0.5, 0.75].map((g) => (
              <line key={g} x1="0" x2={W} y1={H * g} y2={H * g} stroke="#e2e5e9" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            ))}
            <path d={path([base[0] ?? 0, ...base])} fill="none" stroke="#0d3b66" strokeWidth="3" vectorEffect="non-scaling-stroke" />
            {alt ? <path d={path([alt[0] ?? 0, ...alt])} fill="none" stroke="#8a6100" strokeWidth="3" strokeDasharray="7 5" vectorEffect="non-scaling-stroke" /> : null}
          </svg>
        </div>
        <div className="mt-1 flex justify-between text-xs text-brand-muted" aria-hidden="true">
          <span>{monthShort(monthDate(startIso, 1))}</span>
          <span>{monthShort(monthDate(startIso, n))}</span>
        </div>
      </div>
      <details className="mt-2 text-sm">
        <summary className="min-h-11 cursor-pointer py-2 font-semibold text-brand-teal">Ver os valores do gráfico</summary>
        <div className="max-h-72 overflow-auto rounded-lg border border-brand-border">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Saldo total ao fim de cada mês</caption>
            <thead className="sticky top-0 bg-brand-surface-soft text-left">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold text-brand-navy">Mês</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold text-brand-navy">Se nada mudar</th>
                {alt ? <th scope="col" className="px-3 py-2 text-right font-semibold text-brand-navy">Com a mudança</th> : null}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {sample.map((k) => (
                <tr key={k} className="border-t border-brand-border">
                  <th scope="row" className="px-3 py-1.5 text-left font-medium">{monthShort(monthDate(startIso, k))}</th>
                  <td className="px-3 py-1.5 text-right">{brl(base[k - 1] ?? 0)}</td>
                  {alt ? <td className="px-3 py-1.5 text-right">{brl(alt[k - 1] ?? 0)}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

/* ---------- botão dos exemplos da página ---------- */

export function SimulateJourneyButton({ label, detail }: { label: string; detail: DebtJourneyPrefill }) {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new CustomEvent<DebtJourneyPrefill>(DEBT_JOURNEY_PREFILL_EVENT, { detail }))} className="not-prose mt-3 inline-flex min-h-11 items-center rounded-lg border border-brand-navy px-4 text-sm font-semibold text-brand-navy hover:bg-brand-teal-soft">
      {label}
    </button>
  );
}

/* ---------- componente ---------- */

export function DebtJourneySimulator({ today, context = "ferramenta" }: { today: string; context?: Context }) {
  const uid = useId();
  const id = (n: string) => `${uid}-${n}`;

  const [startIso, setStartIso] = useState(today);
  const [debts, setDebts] = useState<DebtForm[]>([emptyDebt()]);
  const [editing, setEditing] = useState<string | null>(debts[0]!.id);
  const [keepBudget, setKeepBudget] = useState<boolean | null>(null);
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [issues, setIssues] = useState<DebtIssue[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [shown, setShown] = useState<{ input: JourneyInput; result: JourneyResult } | null>(null);
  const [premise, setPremise] = useState<string | null>(null);
  const [extra, setExtra] = useState<number | null>(null);
  const [customExtra, setCustomExtra] = useState("");
  const [lump, setLump] = useState({ amount: "", month: "1", target: "estrategia" });
  const [lumpApplied, setLumpApplied] = useState<{ cents: number; month: number; target: string } | null>(null);
  const [copied, setCopied] = useState<"ok" | "falhou" | null>(null);
  const rootRef = useRef<HTMLElement | null>(null);
  const { ref: resultRef, reveal } = useRevealResult();
  const exampleUsed = useRef(false);

  useEffect(() => {
    track("debt_journey_view", { context });
    window.setTimeout(() => setStartIso(todayInBrazil()), 0);
  }, [context]);

  const journeyDebts = useMemo(() => debts.map(toDebt), [debts]);
  const simulatedCount = journeyDebts.filter((d) => resolveModel(d) !== "rotativo" && resolveModel(d) !== "invalida").length;
  const currentTotal = journeyDebts.reduce((s, d) => {
    const model = resolveModel(d);
    if (model === "rotativo" || model === "invalida") return s;
    return s + (d.paymentCents && d.paymentCents > 0 ? d.paymentCents : 0);
  }, 0);

  function updateDebt(i: string, patch: Partial<DebtForm>) {
    setDebts((list) => list.map((d) => (d.id === i ? { ...d, ...patch } : d)));
    setPremise(null);
  }
  function addDebt() {
    const d = emptyDebt();
    setDebts((list) => [...list, d]);
    setEditing(d.id);
  }
  function removeDebt(i: string) {
    setDebts((list) => (list.length > 1 ? list.filter((d) => d.id !== i) : list));
    if (editing === i) setEditing(null);
  }
  function closeDebt(i: string) {
    const d = debts.find((x) => x.id === i);
    if (d) track("debt_added", { context, kind: d.type });
    setEditing(null);
  }

  function buildInput(extraCents = 0, lumpSum: JourneyInput["lumpSum"] = null): JourneyInput {
    return { debts: journeyDebts, keepBudget: keepBudget ?? true, strategy: strategy ?? "maior-taxa", monthlyExtraCents: extraCents, lumpSum, startIso };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setEditing(null);
    if (keepBudget === null) {
      setFormError("Responda se você mantém o mesmo valor total quando uma dívida terminar: isso muda o resultado.");
      return;
    }
    if (simulatedCount > 1 && strategy === null) {
      setFormError("Escolha para onde vai o dinheiro extra quando sobrar.");
      return;
    }
    setFormError(null);
    const input = buildInput();
    const o = simulateJourney(input);
    if (o.kind === "invalid") {
      setIssues(o.issues);
      setShown(null);
      const firstBlocking = o.issues.find((i) => i.blocking && i.debtId);
      if (firstBlocking) setEditing(firstBlocking.debtId);
      return;
    }
    setIssues(o.issues);
    setShown({ input, result: o.result });
    setExtra(null);
    setLumpApplied(null);
    track("debt_journey_calculated", {
      context,
      count: o.result.debts.length,
      keep_budget: input.keepBudget,
      strategy: input.strategy,
      outcome: o.result.months === null ? "nao-quita" : o.result.warnings.includes("nao-amortiza") ? "alguma-nao-amortiza" : "quita",
      example_used: exampleUsed.current,
    });
    reveal();
  }

  function chooseExtra(cents: number | null) {
    setExtra(cents);
    if (cents !== null) track("debt_extra_payment_scenario", { context, step: cents === 10_000 ? "100" : cents === 30_000 ? "300" : cents === 50_000 ? "500" : "outro" });
  }
  function applyLump() {
    const cents = parseMoney(lump.amount);
    const month = parseInt0(lump.month);
    if (!cents || !Number.isFinite(cents) || cents <= 0 || !month || !Number.isFinite(month) || month < 1) return;
    setLumpApplied({ cents, month, target: lump.target });
    track("debt_lump_sum_scenario", { context, target: lump.target === "estrategia" ? "estrategia" : "divida" });
  }

  function prefill(d: DebtJourneyPrefill) {
    exampleUsed.current = true;
    track("debt_example_select", { context, example: d.exampleId });
    const forms: DebtForm[] = d.debts.map((x) => ({
      ...emptyDebt(),
      label: x.label,
      type: x.type,
      balance: x.balanceCents !== null ? moneyInput(x.balanceCents) : "",
      rate: x.ratePercent !== null ? pct(x.ratePercent) : "",
      rateUnit: x.rateUnit,
      rateUnknown: x.ratePercent === null,
      payment: x.paymentCents !== null ? moneyInput(x.paymentCents) : "",
      remaining: x.remainingPayments !== null ? String(x.remainingPayments) : "",
    }));
    setDebts(forms);
    setEditing(null);
    setKeepBudget(d.keepBudget);
    setStrategy("maior-taxa");
    setPremise(d.premise);
    setSubmitted(true);
    const input: JourneyInput = { debts: forms.map(toDebt), keepBudget: d.keepBudget, strategy: "maior-taxa", monthlyExtraCents: 0, lumpSum: null, startIso };
    const o = simulateJourney(input);
    if (o.kind === "ok") {
      setIssues(o.issues);
      setShown({ input, result: o.result });
      setExtra(null);
      setLumpApplied(null);
    }
    rootRef.current?.scrollIntoView({ block: "start" });
    reveal();
  }
  const onPrefill = useEffectEvent((d: DebtJourneyPrefill) => prefill(d));
  useEffect(() => {
    const listener = (e: Event) => onPrefill((e as CustomEvent<DebtJourneyPrefill>).detail);
    window.addEventListener(DEBT_JOURNEY_PREFILL_EVENT, listener);
    return () => window.removeEventListener(DEBT_JOURNEY_PREFILL_EVENT, listener);
  }, []);

  /* Cenários, sempre sobre um clone do base. */
  const altResult: JourneyResult | null = useMemo(() => {
    if (!shown) return null;
    let alt = shown.input;
    if (extra) alt = withMonthlyExtra(alt, extra);
    if (lumpApplied) alt = withLumpSum(alt, { cents: lumpApplied.cents, month: lumpApplied.month, target: lumpApplied.target });
    if (alt === shown.input) return null;
    const o = simulateJourney(alt);
    return o.kind === "ok" ? o.result : null;
  }, [shown, extra, lumpApplied]);
  const comparison: JourneyComparison | null = shown && altResult ? compareJourneys(shown.result, altResult) : null;
  const marginal = useMemo(() => (shown ? marginalEffect(shown.input) : null), [shown]);

  async function copySummary() {
    if (!shown) return;
    try {
      await navigator.clipboard.writeText(`${buildJourneySummary(shown.result, comparison)}\nhttps://www.creditoporperto.com/simuladores/quando-fico-livre-das-dividas/`);
      setCopied("ok");
      track("debt_journey_copy", { context });
    } catch {
      setCopied("falhou");
    }
    window.setTimeout(() => setCopied(null), 4000);
  }
  const cta = (target: string) => () => track("debt_internal_cta_clicked", { context, target });

  const issueOf = (debtId: string, code?: string) => issues.find((i) => i.debtId === debtId && i.blocking && (!code || i.code === code))?.message;
  const Title = context === "artigo" ? "h3" : "h2";
  const Sub = context === "artigo" ? "h4" : "h3";

  return (
    <section ref={rootRef} aria-labelledby={id("titulo")} data-no-ads="simulador" className="not-prose scroll-mt-24 rounded-2xl border border-brand-border bg-white p-4 shadow-sm sm:p-6">
      <Title id={id("titulo")} className="font-serif text-xl font-bold text-brand-navy">
        Vamos montar sua rota
      </Title>
      <p className="mt-1 text-sm text-brand-muted">Uma dívida de cada vez. Seus valores são usados apenas para esta simulação, no seu navegador.</p>

      <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
        <ol className="space-y-3" aria-label="Suas dívidas">
          {debts.map((d, index) => {
            const jd = journeyDebts[index]!;
            const model = resolveModel(jd);
            const isEditing = editing === d.id;
            const err = issueOf(d.id);
            if (!isEditing) {
              return (
                <li key={d.id} className={`rounded-xl border p-3 ${err ? "border-brand-danger" : "border-brand-border"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-brand-navy">{jd.label}</p>
                      <p className="text-sm tabular-nums text-brand-muted">
                        {model === "rotativo"
                          ? "Cartão no rotativo: fora da rota (veja o aviso)"
                          : [jd.balanceCents ? brl(jd.balanceCents) : null, jd.paymentCents ? `${brl(jd.paymentCents)}/mês` : null, jd.ratePercent !== null && Number.isFinite(jd.ratePercent) ? `${pct(jd.ratePercent)}% ${jd.rateUnit === "am" ? "a.m." : "a.a."}` : "taxa não informada", jd.remainingPayments ? `${jd.remainingPayments} parcelas` : null].filter(Boolean).join(" · ")}
                      </p>
                      {err ? <p className="mt-1 text-sm font-medium text-brand-danger">{err}</p> : null}
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setEditing(d.id)} className="min-h-11 rounded-lg border border-brand-border px-3 text-sm font-semibold text-brand-navy hover:bg-brand-teal-soft">
                        Editar
                      </button>
                      {debts.length > 1 ? (
                        <button type="button" onClick={() => removeDebt(d.id)} className="min-h-11 rounded-lg px-3 text-sm font-semibold text-brand-muted hover:text-brand-danger" aria-label={`Remover ${jd.label}`}>
                          Remover
                        </button>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            }
            const rid = (n: string) => id(`${d.id}-${n}`);
            return (
              <li key={d.id} className="rounded-xl border border-brand-navy p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Dívida {index + 1}</p>
                <div className="mt-3 space-y-4">
                  <Field id={rid("tipo")} label="Que dívida é essa?">
                    <select id={rid("tipo")} value={d.type} onChange={(e) => updateDebt(d.id, { type: e.target.value as JourneyDebtType, rateUnknown: e.target.value === "acordo" || e.target.value === "parcelamento" ? d.rateUnknown : d.rateUnknown })} className={inputClass}>
                      {TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field id={rid("apelido")} label="Um apelido (opcional)" hint="Só para você reconhecer na rota. Não pedimos o nome do credor.">
                    <input id={rid("apelido")} value={d.label} onChange={(e) => updateDebt(d.id, { label: e.target.value })} maxLength={40} autoComplete="off" className={inputClass} placeholder="Cartão, carro, acordo da loja…" />
                  </Field>

                  {d.type === "cartao-rotativo" ? (
                    <div className="rounded-lg bg-brand-warning-soft p-3 text-sm text-brand-text">
                      <p>
                        <strong>O rotativo não deve ser tratado como um empréstimo comum de longo prazo.</strong> Pela regra do Conselho Monetário Nacional, o saldo só fica no rotativo até o vencimento da fatura seguinte; depois disso, a instituição oferece o parcelamento. Esta dívida fica fora da rota. Para simular a próxima fatura, use a Calculadora de Juros do Cartão; se a fatura já foi parcelada, cadastre como “fatura parcelada”.
                      </p>
                      <p className="mt-2">
                        <Link href="/calculadoras/juros-cartao-credito/" onClick={cta("juros-cartao")} className="font-semibold text-brand-teal-dark underline underline-offset-2">
                          Simular o rotativo
                        </Link>
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field id={rid("saldo")} label="Saldo atual" hint={d.rateUnknown ? "Se não souber, deixe vazio: usaremos parcela × parcelas restantes." : "Quanto você deve hoje nessa dívida."} error={issueOf(d.id, "saldo")}>
                          <div className="relative">
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" aria-hidden="true">R$</span>
                            <input id={rid("saldo")} inputMode="decimal" autoComplete="off" value={d.balance} onChange={(e) => updateDebt(d.id, { balance: e.target.value })} onBlur={(e) => updateDebt(d.id, { balance: tidyMoney(e.target.value) })} className={`${inputClass} pl-10`} placeholder="7.400,00" />
                          </div>
                        </Field>
                        <Field id={rid("pagamento")} label="Pagamento mensal atual" hint="Tudo que sai do bolso por mês para esta dívida." error={issueOf(d.id, "pagamento")}>
                          <div className="relative">
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" aria-hidden="true">R$</span>
                            <input id={rid("pagamento")} inputMode="decimal" autoComplete="off" value={d.payment} onChange={(e) => updateDebt(d.id, { payment: e.target.value })} onBlur={(e) => updateDebt(d.id, { payment: tidyMoney(e.target.value) })} className={`${inputClass} pl-10`} placeholder="620,00" />
                          </div>
                        </Field>
                      </div>
                      <Field id={rid("taxa")} label="Taxa de juros" hint="Está no contrato, na fatura ou no aplicativo da instituição. Sem ela, simulamos só o cronograma de parcelas." error={issueOf(d.id, "taxa-negativa") ?? issueOf(d.id, "taxa-fora-do-limite")}>
                        <div className="flex gap-2">
                          <div className="relative min-w-0 flex-1">
                            <input id={rid("taxa")} inputMode="decimal" autoComplete="off" value={d.rate} disabled={d.rateUnknown} onChange={(e) => updateDebt(d.id, { rate: e.target.value })} className={`${inputClass} pr-8 disabled:bg-brand-surface-soft`} placeholder="12,9" />
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted" aria-hidden="true">%</span>
                          </div>
                          <Segmented label="Unidade da taxa" value={d.rateUnit} options={[{ value: "am", label: "ao mês" }, { value: "aa", label: "ao ano" }]} onChange={(rateUnit) => updateDebt(d.id, { rateUnit })} />
                        </div>
                        <label className="mt-2 flex min-h-11 items-center gap-2 text-sm text-brand-text">
                          <input type="checkbox" checked={d.rateUnknown} onChange={(e) => updateDebt(d.id, { rateUnknown: e.target.checked })} className="h-4 w-4" />
                          Não sei a taxa
                        </label>
                        {issues.find((i) => i.debtId === d.id && i.code === "taxa-extrema") ? <p className="mt-1 rounded-md bg-brand-warning-soft px-2 py-1 text-sm">{issues.find((i) => i.debtId === d.id && i.code === "taxa-extrema")!.message}</p> : null}
                      </Field>
                      <Field id={rid("parcelas")} label={d.rateUnknown ? "Parcelas restantes" : "Parcelas restantes (opcional)"} hint={d.rateUnknown ? "Com parcela e parcelas restantes, sabemos o desembolso e a data final, mas não os juros." : "Se souber, ajuda a conferir a parcela."} error={issueOf(d.id, "parcelas") ?? issueOf(d.id, "dados-insuficientes")}>
                        <input id={rid("parcelas")} inputMode="numeric" autoComplete="off" value={d.remaining} onChange={(e) => updateDebt(d.id, { remaining: e.target.value })} className={`${inputClass} sm:max-w-40`} placeholder="24" />
                      </Field>
                      {d.type === "financiamento" ? (
                        <div>
                          <p className="text-sm font-semibold text-brand-navy">Sistema de amortização</p>
                          <div className="mt-1.5">
                            <Segmented label="Sistema de amortização" wide value={d.system} options={[{ value: "price", label: "Price (parcelas iguais)" }, { value: "sac", label: "SAC (parcelas caem)" }, { value: "nao-sei", label: "Não sei" }]} onChange={(system) => updateDebt(d.id, { system })} />
                          </div>
                          {d.system === "sac" ? <p className="mt-1 text-xs text-brand-muted">Na SAC, informe saldo, taxa e parcelas restantes; a parcela é calculada.</p> : null}
                        </div>
                      ) : null}
                      <details className="text-sm">
                        <summary className="min-h-11 cursor-pointer py-2 font-semibold text-brand-teal">Tenho mais detalhes</summary>
                        <Field id={rid("tarifa")} label="Seguro ou tarifa dentro da parcela (opcional)" hint="Sai do bolso todo mês, mas não reduz a dívida." error={issueOf(d.id, "tarifa")}>
                          <div className="relative sm:max-w-60">
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" aria-hidden="true">R$</span>
                            <input id={rid("tarifa")} inputMode="decimal" autoComplete="off" value={d.fees} onChange={(e) => updateDebt(d.id, { fees: e.target.value })} onBlur={(e) => updateDebt(d.id, { fees: tidyMoney(e.target.value) })} className={`${inputClass} pl-10`} placeholder="0,00" />
                          </div>
                        </Field>
                      </details>
                    </>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => closeDebt(d.id)} className="min-h-11 rounded-lg bg-brand-navy px-4 text-sm font-semibold text-white hover:bg-brand-teal-dark">
                      Guardar esta dívida
                    </button>
                    {debts.length > 1 ? (
                      <button type="button" onClick={() => removeDebt(d.id)} className="min-h-11 rounded-lg px-3 text-sm font-semibold text-brand-muted hover:text-brand-danger">
                        Remover
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        {debts.length < 15 ? (
          <button type="button" onClick={addDebt} className="min-h-11 rounded-lg border border-dashed border-brand-navy px-4 text-sm font-semibold text-brand-navy hover:bg-brand-teal-soft">
            + Adicionar outra dívida
          </button>
        ) : null}

        {currentTotal > 0 ? (
          <div className="rounded-xl bg-brand-surface-soft p-4">
            <p className="text-sm text-brand-muted">Hoje você destina aproximadamente</p>
            <p className="font-serif text-2xl font-bold tabular-nums text-brand-navy">{brl(currentTotal)}/mês</p>
            <p className="text-sm text-brand-muted">para {simulatedCount === 1 ? "esta dívida" : "estas dívidas"}, pelos pagamentos informados.</p>
          </div>
        ) : null}

        <div>
          <p className="text-sm font-semibold text-brand-navy">Você consegue manter esse mesmo valor total mesmo quando uma dívida terminar?</p>
          <p className="mt-0.5 text-xs text-brand-muted">Se sim, o pagamento da dívida que acabou passa para as outras nesta simulação. Se não, ele volta para o seu orçamento.</p>
          <div className="mt-1.5">
            <Segmented label="Manter o valor total" wide value={keepBudget === null ? null : keepBudget ? "sim" : "nao"} options={[{ value: "sim", label: "Sim, mantenho o valor" }, { value: "nao", label: "Não, o valor volta para mim" }]} onChange={(v) => setKeepBudget(v === "sim")} />
          </div>
        </div>

        {simulatedCount > 1 ? (
          <div>
            <p className="text-sm font-semibold text-brand-navy">Quando sobrar dinheiro extra, para onde quer direcionar?</p>
            <div className="mt-1.5">
              <Segmented
                label="Estratégia"
                wide
                value={strategy}
                options={[
                  { value: "maior-taxa", label: "Maior taxa primeiro" },
                  { value: "menor-saldo", label: "Menor saldo primeiro" },
                ]}
                onChange={(s) => {
                  setStrategy(s);
                  track("debt_strategy_changed", { context, strategy: s });
                }}
              />
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-brand-muted">
              Maior taxa primeiro tende a pagar menos juros no total. Menor saldo primeiro zera a primeira dívida mais cedo. Nenhuma é “a certa”: são duas mecânicas, e você escolhe.
            </p>
          </div>
        ) : null}

        {formError && submitted ? <p className="rounded-lg bg-brand-danger-soft px-3 py-2 text-sm text-brand-text">{formError}</p> : null}
        {issues.some((i) => i.blocking) && submitted ? <p className="rounded-lg bg-brand-danger-soft px-3 py-2 text-sm text-brand-text">Alguma dívida precisa de ajuste: ela está destacada acima.</p> : null}

        <button type="submit" className="min-h-12 w-full rounded-lg bg-brand-navy px-5 text-base font-semibold text-white hover:bg-brand-teal-dark">
          Simular minha rota
        </button>
        <p className="text-center text-xs text-brand-muted">Sem cadastro • Sem CPF • Simulação educativa</p>
      </form>

      <div ref={resultRef} className="scroll-mt-24" aria-live="polite">
        {shown ? (
          <Result shown={shown} altResult={altResult} comparison={comparison} marginal={marginal} premise={premise} extra={extra} chooseExtra={chooseExtra} customExtra={customExtra} setCustomExtra={setCustomExtra} lump={lump} setLump={setLump} applyLump={applyLump} lumpApplied={lumpApplied} clearLump={() => setLumpApplied(null)} copied={copied} copySummary={copySummary} cta={cta} id={id} Title={Title} Sub={Sub} context={context} />
        ) : null}
      </div>
    </section>
  );
}

/* ---------- resultado ---------- */

function Result({ shown, altResult, comparison, marginal, premise, extra, chooseExtra, customExtra, setCustomExtra, lump, setLump, applyLump, lumpApplied, clearLump, copied, copySummary, cta, id, Title, Sub, context }: {
  shown: { input: JourneyInput; result: JourneyResult };
  altResult: JourneyResult | null;
  comparison: JourneyComparison | null;
  marginal: { monthsSaved: number; costSavedCents: number } | null;
  premise: string | null;
  extra: number | null;
  chooseExtra: (c: number | null) => void;
  customExtra: string;
  setCustomExtra: (v: string) => void;
  lump: { amount: string; month: string; target: string };
  setLump: (v: { amount: string; month: string; target: string }) => void;
  applyLump: () => void;
  lumpApplied: { cents: number; month: number; target: string } | null;
  clearLump: () => void;
  copied: "ok" | "falhou" | null;
  copySummary: () => void;
  cta: (t: string) => () => void;
  id: (n: string) => string;
  Title: "h2" | "h3";
  Sub: "h3" | "h4";
  context: Context;
}) {
  const r = shown.result;
  const byId = new Map(r.debts.map((d) => [d.id, d]));
  const settled = r.months !== null && r.endDateIso !== null;
  const nonAmortizing = r.debts.filter((d) => d.warnings.includes("nao-amortiza"));
  const first = r.milestones.find((m) => m.kind === "primeira-quitada");
  const half = r.milestones.find((m) => m.kind === "metade");
  const last = r.milestones.find((m) => m.kind === "ultima-quitada");
  const next = r.milestones[0];

  const steps: JourneyStep[] = [
    { key: "hoje", label: "Hoje", title: `${brl(r.initialCents)} em dívidas`, detail: `${brl(r.monthlyPaymentCents)}/mês pelos pagamentos informados` },
  ];
  if (first) steps.push({ key: "primeira", label: "Primeiro marco", when: cap(monthLabel(first.dateIso)), title: `${byId.get(first.debtId!)?.label ?? "Primeira dívida"} termina`, detail: `em ${formatMonths(first.month)}` });
  if (half && (!first || half.month !== first.month)) steps.push({ key: "metade", label: "Metade do caminho", when: cap(monthLabel(half.dateIso)), title: "Metade do saldo inicial eliminada", detail: `restam ${brl(half.remainingCents)}` });
  if (last && last.debtId !== first?.debtId) steps.push({ key: "ultima", label: "Última dívida", when: cap(monthLabel(last.dateIso)), title: `${byId.get(last.debtId!)?.label ?? "Última dívida"} termina` });
  steps.push(
    settled
      ? { key: "fim", label: "Livre das dívidas", when: cap(monthLabel(r.endDateIso!)), title: "Saldo R$ 0", detail: `${brl(r.totalPaidCents)} desembolsados até lá`, emphasis: true }
      : { key: "fim", label: "Fim", title: "Não chega a zero no horizonte simulado", detail: `Com estas premissas, o saldo não zera em ${MAX_JOURNEY_MONTHS.toLocaleString("pt-BR")} meses.`, emphasis: true },
  );

  return (
    <div className="mt-6 space-y-8">
      {premise ? <p className="rounded-lg bg-brand-gold-soft px-3 py-2 text-sm text-brand-text">{premise}</p> : null}

      {nonAmortizing.length > 0 ? (
        <div className="rounded-xl border border-brand-warning bg-brand-warning-soft p-4 text-sm text-brand-text">
          <p className="font-semibold">Atenção: com os valores informados, {nonAmortizing.length === 1 ? `a dívida “${nonAmortizing[0]!.label}” não está diminuindo` : `${nonAmortizing.length} dívidas não estão diminuindo`}.</p>
          <p className="mt-1">O pagamento mensal não cobre os juros do mês, então o saldo fica igual ou cresce. Nenhum prazo resolve isso sem mudar o pagamento, a taxa ou o contrato.</p>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/calculadoras/renegociacao-de-dividas/" onClick={cta("renegociacao")} className="font-semibold text-brand-teal-dark underline underline-offset-2">Simular uma renegociação</Link>
            <Link href="/calculadoras/comparador-de-propostas/" onClick={cta("comparador")} className="font-semibold text-brand-teal-dark underline underline-offset-2">Comparar outra proposta</Link>
          </p>
        </div>
      ) : null}
      {r.excludedDebtIds.length > 0 ? (
        <p className="rounded-lg bg-brand-warning-soft px-3 py-2 text-sm text-brand-text">
          Cartão no rotativo fica fora da rota: a regra do CMN limita o rotativo ao vencimento da fatura seguinte.{" "}
          <Link href="/calculadoras/juros-cartao-credito/" onClick={cta("juros-cartao")} className="font-semibold text-brand-teal-dark underline underline-offset-2">Calcular a próxima fatura</Link>
        </p>
      ) : null}

      {/* Hero */}
      <div className="rounded-xl border border-brand-border p-4 sm:p-5">
        <Title data-result-heading tabIndex={-1} className="text-sm font-semibold text-brand-muted outline-none">
          Mantendo tudo como está, a simulação chega a saldo zero aproximadamente em
        </Title>
        {settled ? (
          <>
            <p className="mt-1 font-serif text-3xl font-bold uppercase leading-tight text-brand-navy sm:text-4xl">{monthLabel(r.endDateIso!)}</p>
            <p className="mt-1 text-lg text-brand-text">
              {formatMonths(r.months!)}
              {r.months! >= 12 ? <span className="text-brand-muted"> · {r.months} meses</span> : null}
            </p>
          </>
        ) : (
          <p className="mt-1 font-serif text-2xl font-bold leading-tight text-brand-navy">nenhum mês dentro do horizonte simulado</p>
        )}
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-brand-muted">Dívida total hoje</dt>
            <dd className="font-semibold tabular-nums text-brand-text">{brl(r.initialCents)}</dd>
          </div>
          <div>
            <dt className="text-xs text-brand-muted">Pagamento mensal atual</dt>
            <dd className="font-semibold tabular-nums text-brand-text">{brl(r.monthlyPaymentCents)}</dd>
          </div>
          <div>
            <dt className="text-xs text-brand-muted">Total desembolsado daqui para frente</dt>
            <dd className="font-semibold tabular-nums text-brand-text">{settled ? brl(r.totalPaidCents) : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-brand-muted">{r.costUnknownDebtIds.length > 0 ? "Custo das dívidas com dados completos" : "Juros e custos estimados"}</dt>
            <dd className="font-semibold tabular-nums text-brand-text">{settled ? brl(r.costKnownCents) : "—"}</dd>
          </div>
        </dl>
        {r.costUnknownDebtIds.length > 0 ? (
          <p className="mt-2 text-xs text-brand-muted">
            {r.costUnknownDebtIds.length === 1 ? "Uma dívida" : `${r.costUnknownDebtIds.length} dívidas`} sem taxa: o desembolso e a data estão na conta, os juros não. Custo financeiro não calculado por falta da taxa.
          </p>
        ) : null}
      </div>

      {/* Linha do tempo */}
      <div>
        <Sub className="font-serif text-lg font-bold text-brand-navy">Sua rota</Sub>
        <FinancialJourney steps={steps} ariaLabel="Linha do tempo da quitação" />
      </div>

      {/* Próximo marco */}
      {next ? (
        <div className="rounded-xl bg-brand-teal-soft p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-teal-dark">Seu próximo marco</p>
          {next.kind === "primeira-quitada" ? (
            <>
              <p className="mt-1 font-serif text-lg font-bold text-brand-navy">
                A dívida “{byId.get(next.debtId!)?.label}” termina em aproximadamente {formatMonths(next.month)} ({monthShort(next.dateIso)}).
              </p>
              <p className="mt-1 text-sm text-brand-text">
                Depois, {brl(r.releases.find((x) => x.debtId === next.debtId)?.cents ?? 0)}/mês deixam de estar comprometidos com ela.{" "}
                {shown.input.keepBudget ? "Nesta simulação, esse valor passa para as demais dívidas." : "Nesta simulação, esse valor volta para o seu orçamento."}
              </p>
            </>
          ) : (
            <p className="mt-1 font-serif text-lg font-bold text-brand-navy">
              {next.kind === "metade" ? "Metade do saldo inicial eliminada" : "Saldo zero"} em aproximadamente {formatMonths(next.month)} ({monthShort(next.dateIso)}).
            </p>
          )}
        </div>
      ) : null}

      {/* E se… */}
      <div>
        <Sub className="font-serif text-lg font-bold text-brand-navy">E se você conseguisse pagar um pouco mais?</Sub>
        <p className="mt-1 text-sm text-brand-muted">Se um valor adicional estivesse disponível para as dívidas todos os meses. É matemática, não prescrição.</p>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Valor extra mensal">
          {EXTRA_STEPS.map((c) => (
            <button key={c} type="button" aria-pressed={extra === c} onClick={() => chooseExtra(extra === c ? null : c)} className="min-h-11 rounded-lg border border-brand-border px-3 text-sm font-semibold tabular-nums text-brand-navy aria-pressed:border-brand-navy aria-pressed:bg-brand-navy aria-pressed:text-white">
              + {brlRound(c)}
            </button>
          ))}
          <div className="flex gap-1">
            <input aria-label="Outro valor extra por mês" inputMode="decimal" value={customExtra} onChange={(e) => setCustomExtra(e.target.value)} placeholder="Outro valor" className="min-h-11 w-32 rounded-lg border border-brand-border px-3 text-sm tabular-nums" />
            <button
              type="button"
              onClick={() => {
                const c = parseMoney(customExtra);
                if (c && Number.isFinite(c) && c > 0) chooseExtra(c);
              }}
              className="min-h-11 rounded-lg border border-brand-navy px-3 text-sm font-semibold text-brand-navy"
            >
              Aplicar
            </button>
          </div>
        </div>
        {marginal && marginal.monthsSaved >= 1 ? (
          <p className="mt-3 text-sm text-brand-text">
            Cada R$ 100 adicionais por mês neste cenário representam aproximadamente <strong>{formatMonths(marginal.monthsSaved)} a menos</strong>
            {marginal.costSavedCents > 0 ? <> e <strong>{brl(marginal.costSavedCents)}</strong> de custo evitado</> : null}.
          </p>
        ) : null}

        <details className="mt-4 rounded-xl border border-brand-border" onToggle={(e) => (e.currentTarget.open ? track("debt_lump_sum_scenario", { context, target: "aberto" }) : undefined)}>
          <summary className="min-h-11 cursor-pointer px-3 py-3 font-semibold text-brand-navy">E se entrar um dinheiro extra de uma vez?</summary>
          <div className="grid gap-3 px-3 pb-3 sm:grid-cols-3">
            <Field id={id("aporte")} label="Valor">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" aria-hidden="true">R$</span>
                <input id={id("aporte")} inputMode="decimal" value={lump.amount} onChange={(e) => setLump({ ...lump, amount: e.target.value })} onBlur={(e) => setLump({ ...lump, amount: tidyMoney(e.target.value) })} className={`${inputClass} pl-10`} placeholder="5.000,00" />
              </div>
            </Field>
            <Field id={id("aporte-mes")} label="Em que mês da rota" hint="1 = próximo mês">
              <input id={id("aporte-mes")} inputMode="numeric" value={lump.month} onChange={(e) => setLump({ ...lump, month: e.target.value })} className={inputClass} />
            </Field>
            <Field id={id("aporte-destino")} label="Em qual dívida aplicar">
              <select id={id("aporte-destino")} value={lump.target} onChange={(e) => setLump({ ...lump, target: e.target.value })} className={inputClass}>
                <option value="estrategia">Seguir a estratégia escolhida</option>
                {r.debts.filter((d) => d.costKnown).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="flex flex-wrap gap-2 px-3 pb-3">
            <button type="button" onClick={applyLump} className="min-h-11 rounded-lg bg-brand-navy px-4 text-sm font-semibold text-white">Aplicar aporte</button>
            {lumpApplied ? (
              <button type="button" onClick={clearLump} className="min-h-11 rounded-lg px-3 text-sm font-semibold text-brand-muted">Remover aporte</button>
            ) : null}
          </div>
        </details>

        {comparison && altResult ? (
          <div className="mt-4 rounded-xl border border-brand-border p-4" aria-live="polite">
            <p className="text-sm font-semibold text-brand-navy">
              {extra ? `+ ${brl(extra)} por mês` : ""}
              {extra && lumpApplied ? " e " : ""}
              {lumpApplied ? `aporte de ${brl(lumpApplied.cents)} no mês ${lumpApplied.month}` : ""}
            </p>
            <table className="mt-2 w-full border-collapse text-sm">
              <caption className="sr-only">Comparação entre o cenário atual e o cenário com a mudança</caption>
              <thead className="text-left text-xs text-brand-muted">
                <tr>
                  <th scope="col" className="py-1 font-semibold">&nbsp;</th>
                  <th scope="col" className="py-1 text-right font-semibold">Atual</th>
                  <th scope="col" className="py-1 text-right font-semibold">Com a mudança</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                <tr className="border-t border-brand-border"><th scope="row" className="py-1.5 text-left font-medium">Livre das dívidas</th><td className="py-1.5 text-right">{r.endDateIso ? monthShort(r.endDateIso) : "—"}</td><td className="py-1.5 text-right font-semibold">{altResult.endDateIso ? monthShort(altResult.endDateIso) : "—"}</td></tr>
                <tr className="border-t border-brand-border"><th scope="row" className="py-1.5 text-left font-medium">Tempo</th><td className="py-1.5 text-right">{r.months !== null ? `${r.months} meses` : "—"}</td><td className="py-1.5 text-right font-semibold">{altResult.months !== null ? `${altResult.months} meses` : "—"}</td></tr>
                <tr className="border-t border-brand-border"><th scope="row" className="py-1.5 text-left font-medium">Total desembolsado</th><td className="py-1.5 text-right">{brl(r.totalPaidCents)}</td><td className="py-1.5 text-right font-semibold">{brl(altResult.totalPaidCents)}</td></tr>
                <tr className="border-t border-brand-border"><th scope="row" className="py-1.5 text-left font-medium">Custo financeiro calculado</th><td className="py-1.5 text-right">{brl(r.costKnownCents)}</td><td className="py-1.5 text-right font-semibold">{brl(altResult.costKnownCents)}</td></tr>
              </tbody>
            </table>
            {comparison.monthsSaved !== null && comparison.monthsSaved > 0 ? (
              <p className="mt-3 text-brand-text">
                Você recupera <strong>{formatMonths(comparison.monthsSaved)}</strong> de comprometimento financeiro
                {comparison.costSavedCents > 0 ? <> e evita <strong>{brl(comparison.costSavedCents)}</strong> de custo financeiro</> : null}.
              </p>
            ) : comparison.monthsSaved === 0 ? (
              <p className="mt-3 text-sm text-brand-muted">Neste cenário a data não muda; o custo {comparison.costSavedCents > 0 ? `cai ${brl(comparison.costSavedCents)}` : "fica igual"}.</p>
            ) : null}
            {altResult.unusedLumpCents > 0 ? <p className="mt-2 text-sm text-brand-muted">Do aporte, {brl(altResult.unusedLumpCents)} não foram necessários: as dívidas zeraram antes.</p> : null}
          </div>
        ) : null}
      </div>

      {/* Gráfico */}
      <div>
        <Sub className="font-serif text-lg font-bold text-brand-navy">Saldo total ao longo do tempo</Sub>
        <BalanceChart base={r.balanceSeries} alt={altResult?.balanceSeries ?? null} startIso={r.startIso} />
      </div>

      {/* Por dívida e renda liberada */}
      <div>
        <Sub className="font-serif text-lg font-bold text-brand-navy">Cada dívida na rota</Sub>
        <ol className="mt-3 space-y-2">
          {r.payoffOrder.map((did, i) => {
            const d = byId.get(did)!;
            const rel = r.releases.find((x) => x.debtId === did);
            return (
              <li key={did} className="rounded-lg border border-brand-border p-3 text-sm">
                <p className="font-semibold text-brand-navy">
                  {i + 1}. {d.label} <span className="font-normal text-brand-muted">· termina em {monthShort(monthDate(r.startIso, d.payoffMonth!))} ({formatMonths(d.payoffMonth!)})</span>
                </p>
                <p className="mt-0.5 tabular-nums text-brand-muted">
                  {brl(d.initialCents)} hoje · {brl(d.paidCents)} pagos até o fim{d.costKnown ? ` · ${brl(d.interestCents + d.feesCents)} de juros e custos` : " · juros não calculados (sem taxa)"}
                  {rel ? ` · libera ${brl(rel.cents)}/mês` : ""}
                </p>
              </li>
            );
          })}
          {r.debts.filter((d) => d.payoffMonth === null).map((d) => (
            <li key={d.id} className="rounded-lg border border-brand-warning bg-brand-warning-soft p-3 text-sm">
              <p className="font-semibold text-brand-navy">{d.label}: não chega a zero no horizonte simulado.</p>
            </li>
          ))}
        </ol>
        {!shown.input.keepBudget && r.releases.length > 0 ? (
          <div className="mt-4 rounded-xl bg-brand-surface-soft p-4 text-sm">
            <p className="font-semibold text-brand-navy">Renda liberada aos poucos</p>
            <ul className="mt-2 space-y-1 tabular-nums">
              {r.releases.reduce<Array<{ month: number; dateIso: string; cents: number }>>((acc, x) => {
                const prev = acc[acc.length - 1];
                acc.push({ month: x.month, dateIso: x.dateIso, cents: (prev?.cents ?? 0) + x.cents });
                return acc;
              }, []).map((x) => (
                <li key={x.month}>
                  A partir de {monthShort(x.dateIso)}: <strong>+{brl(x.cents)}/mês</strong> deixam de estar comprometidos com esses contratos.
                </li>
              ))}
            </ul>
          </div>
        ) : settled ? (
          <p className="mt-3 text-sm text-brand-muted">
            A partir de aproximadamente {monthShort(r.endDateIso!)}, os {brl(r.monthlyPaymentCents + r.monthlyExtraCents)}/mês hoje destinados às dívidas deixam de estar comprometidos com esses contratos.
          </p>
        ) : null}
      </div>

      {/* Ano a ano e mês a mês */}
      {r.years.length > 1 ? (
        <div>
          <Sub className="font-serif text-lg font-bold text-brand-navy">Ano a ano</Sub>
          <div className="mt-2 overflow-x-auto rounded-xl border border-brand-border">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">Resumo anual da trajetória</caption>
              <thead className="bg-brand-surface-soft text-left">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold text-brand-navy">Ano</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold text-brand-navy">Saldo inicial</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold text-brand-navy">Pago</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold text-brand-navy">Custo calculado</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold text-brand-navy">Saldo final</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {r.years.map((y) => (
                  <tr key={y.year} className="border-t border-brand-border">
                    <th scope="row" className="px-3 py-1.5 text-left font-medium">{y.year}º</th>
                    <td className="px-3 py-1.5 text-right">{brl(y.openingCents)}</td>
                    <td className="px-3 py-1.5 text-right">{brl(y.paidCents)}</td>
                    <td className="px-3 py-1.5 text-right">{brl(y.costCents)}</td>
                    <td className="px-3 py-1.5 text-right">{brl(y.closingCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
      <details className="rounded-xl border border-brand-border" onToggle={(e) => (e.currentTarget.open ? track("debt_timeline_viewed", { context }) : undefined)}>
        <summary className="min-h-11 cursor-pointer px-3 py-3 font-semibold text-brand-navy">Ver trajetória completa, mês a mês</summary>
        <div className="max-h-96 overflow-auto px-3 pb-3">
          {r.debts.map((d) => (
            <div key={d.id} className="mt-2">
              <p className="text-sm font-semibold text-brand-navy">{d.label}</p>
              <table className="mt-1 w-full border-collapse text-xs">
                <caption className="sr-only">Mês a mês de {d.label}</caption>
                <thead className="text-left text-brand-muted">
                  <tr>
                    <th scope="col" className="py-1 pr-2 font-semibold">Mês</th>
                    <th scope="col" className="py-1 pr-2 text-right font-semibold">Saldo inicial</th>
                    <th scope="col" className="py-1 pr-2 text-right font-semibold">Encargos</th>
                    <th scope="col" className="py-1 pr-2 text-right font-semibold">Pagamento</th>
                    <th scope="col" className="py-1 pr-2 text-right font-semibold">Amortização</th>
                    <th scope="col" className="py-1 text-right font-semibold">Saldo final</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {d.history.slice(0, 600).map((row) => (
                    <tr key={row.month} className="border-t border-brand-border">
                      <th scope="row" className="py-1 pr-2 text-left font-medium">{monthShort(monthDate(r.startIso, row.month))}</th>
                      <td className="py-1 pr-2 text-right">{brl(row.openingCents)}</td>
                      <td className="py-1 pr-2 text-right">{d.costKnown ? brl(row.interestCents + row.feesCents) : "—"}</td>
                      <td className="py-1 pr-2 text-right">{brl(row.paidCents)}</td>
                      <td className="py-1 pr-2 text-right">{d.costKnown ? brl(row.amortizedCents) : "—"}</td>
                      <td className="py-1 text-right">{brl(row.closingCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </details>

      {/* Copiar e próximos passos */}
      <div>
        <button type="button" onClick={copySummary} className="min-h-11 rounded-lg border border-brand-navy px-4 text-sm font-semibold text-brand-navy hover:bg-brand-teal-soft">
          Copiar meu cenário
        </button>
        <p className="mt-1 text-xs text-brand-muted" role="status">
          {copied === "ok" ? "Copiado. O texto fica só no seu aparelho e não leva apelidos." : copied === "falhou" ? "Não foi possível copiar." : ""}
        </p>
      </div>
      <div className="space-y-2 rounded-xl border border-brand-border p-3 text-sm">
        <Sub className="font-serif text-base font-bold text-brand-navy">Próximos passos</Sub>
        <p><span className="text-brand-muted">Recebeu uma proposta de renegociação?</span> <Link href="/calculadoras/renegociacao-de-dividas/" onClick={cta("renegociacao")} className="font-semibold text-brand-teal underline underline-offset-2">Simular a proposta</Link></p>
        <p><span className="text-brand-muted">Recebeu um empréstimo para quitar as dívidas?</span> <Link href="/calculadoras/trocar-divida/" onClick={cta("trocar-divida")} className="font-semibold text-brand-teal underline underline-offset-2">Comparar antes e depois</Link></p>
        <p><span className="text-brand-muted">Tem dinheiro para quitar uma antes da hora?</span> <Link href="/calculadoras/quitacao-antecipada/" onClick={cta("quitacao")} className="font-semibold text-brand-teal underline underline-offset-2">Calcular a quitação antecipada</Link></p>
        <p><span className="text-brand-muted">A taxa parece alta?</span> <Link href="/taxas/" onClick={cta("radar")} className="font-semibold text-brand-teal underline underline-offset-2">Ver as médias do Banco Central</Link></p>
        <p><span className="text-brand-muted">Se as dívidas comprometem o que você precisa para as despesas básicas,</span> <Link href="/organizacao-financeira/lei-do-superendividamento/" onClick={cta("superendividamento")} className="font-semibold text-brand-teal underline underline-offset-2">existem mecanismos de tratamento do superendividamento previstos na lei</Link>.</p>
      </div>
      <p className="text-xs leading-relaxed text-brand-muted">
        Esta é uma simulação baseada nos saldos, taxas e pagamentos informados. Taxas, encargos, pagamentos, novas compras ou renegociações podem alterar a trajetória real.{" "}
        <a href="#como-simulamos" onClick={() => track("debt_methodology_opened", { context })} className="underline underline-offset-2">Como simulamos</a>
      </p>
    </div>
  );
}
