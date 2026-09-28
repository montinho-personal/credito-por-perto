"use client";

/**
 * SIMULADOR DE AMORTIZAÇÃO DE FINANCIAMENTO
 * ============================================================================
 *
 * HOJE → SE NÃO FIZER NADA → AMORTIZANDO R$ X → REDUZIR PRAZO × REDUZIR
 * PRESTAÇÃO → E SE… (extra mensal, anual, datas) → META REVERSA.
 *
 * Cinco campos na primeira tela (saldo, taxa, parcelas restantes, sistema e
 * valor); datas, prestação informada e origem do dinheiro ficam em "mais
 * detalhes". O resultado começa pela data de quitação e pelo contrafactual
 * "sem amortizar", sempre visível. Os dois caminhos têm o mesmo peso visual:
 * nenhum é "o certo".
 *
 * Nada do que é digitado sai do navegador. A medição recebe só categorias
 * (sistema, unidade da taxa, tipo de meta), nunca saldo, taxa ou valores.
 */

import Link from "next/link";
import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { track } from "@/lib/analytics/track";
import { formatMonths } from "@/lib/calculators/debt-plan";
import { parseBRLToCents, parsePercentBR } from "@/lib/calculators/proposal-comparison";
import { addMonths } from "@/lib/calculators/civil-date";
import {
  balanceSeries,
  checkInformedPayment,
  compareRuns,
  dateBalanceBelow,
  effectiveAnnual,
  lumpForEndMonth,
  lumpForMonthsEarlier,
  lumpForPayment,
  lumpLadder,
  monthlyForMonthsEarlier,
  monthYearLong,
  monthYearShort,
  NO_EXTRAS,
  runContract,
  sensitivity,
  simulateAmortization,
  type AmortField,
  type AmortizationResult,
  type AmortMode,
  type AmortRateUnit,
  type AmortSystem,
  type ContractInput,
  type ContractRun,
  type ExtraPlan,
  type GoalAnswer,
} from "@/lib/simulators/amortization";
import { useRevealResult } from "@/components/calculators/use-reveal-result";
import { FinancialJourney, type JourneyStep } from "./FinancialJourney";

export const AMORTIZATION_PREFILL_EVENT = "cpp:simular-amortizacao";

export interface AmortizationPrefill {
  exampleId: string;
  balanceCents: number;
  ratePercent: number;
  rateUnit: AmortRateUnit;
  remainingMonths: number;
  system: AmortSystem;
  lumpCents: number;
  monthlyCents?: number;
}

type Context = "ferramenta" | "artigo";

const brl = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const brlRound = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(cents / 100);
const moneyInput = (cents: number) => (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (v: number, digits = 2) => v.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const ladderLabel = (cents: number) => (cents >= 1_000_00 ? `R$ ${(cents / 1_000_00).toLocaleString("pt-BR")} mil` : brlRound(cents));

function parseMoney(raw: string): number | null {
  if (raw.trim() === "") return null;
  const c = parseBRLToCents(raw);
  return c === null ? Number.NaN : c;
}
function tidyMoney(raw: string): string {
  const c = parseBRLToCents(raw);
  return c === null ? raw : moneyInput(c);
}

const MONTH_NAMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const inputClass =
  "min-h-12 w-full min-w-0 rounded-lg border border-brand-border bg-white px-3 py-2.5 text-base text-brand-text tabular-nums focus:border-brand-teal aria-[invalid=true]:border-brand-danger";

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: React.ReactNode; error?: string; children: React.ReactNode }) {
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

const describe = (id: string, error?: string, hint = true) => [hint ? `${id}-hint` : "", error ? `${id}-erro` : ""].filter(Boolean).join(" ") || undefined;

/* ---------- gráfico de saldo: base × caminhos ---------- */

interface ChartSeries {
  label: string;
  values: number[];
  stroke: string;
  dash?: string;
}

const STROKES = {
  base: { stroke: "#0d3b66" },
  prazo: { stroke: "#8a6100", dash: "8 5" },
  prestacao: { stroke: "#4b5563", dash: "2 4" },
};

/**
 * Cada série começa em [saldo de hoje, saldo depois do aporte, fim do mês 1, …]:
 * os dois primeiros pontos ficam no mesmo x, e o aporte aparece como um degrau
 * vertical logo no início.
 */
function BalanceChart({ series, firstDueIso, caption }: { series: ChartSeries[]; firstDueIso: string; caption: string }) {
  const months = Math.max(...series.map((s) => s.values.length - 2), 1);
  const max = Math.max(...series.flatMap((s) => s.values), 1);
  const W = 1000;
  const H = 360;
  const x = (j: number) => (j <= 1 ? 0 : ((j - 1) / months) * W);
  const y = (v: number) => H - (v / max) * H;
  const path = (values: number[]) => values.map((v, j) => `${j === 0 ? "M" : "L"}${x(j).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const step = months > 120 ? 24 : months > 36 ? 12 : 6;
  const sample: number[] = [];
  for (let k = step; k < months; k += step) sample.push(k);
  sample.push(months);
  const lastDue = addMonths(firstDueIso, months - 1);
  return (
    <figure className="mt-3">
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm" aria-hidden="true">
        {series.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <svg width="30" height="10">
              <line x1="1" y1="5" x2="29" y2="5" stroke={s.stroke} strokeWidth="3" strokeDasharray={s.dash} />
            </svg>
            <span className="font-semibold text-brand-navy">{s.label}</span>
          </li>
        ))}
      </ul>
      <div className="relative mt-2">
        <p className="mb-1 text-xs tabular-nums text-brand-muted" aria-hidden="true">{brlRound(max)}</p>
        <div role="img" aria-label={`${caption} Os valores estão na tabela logo abaixo.`} className="relative h-48 w-full border-b border-l border-brand-border sm:h-60">
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
            {[0.25, 0.5, 0.75].map((g) => (
              <line key={g} x1="0" x2={W} y1={H * g} y2={H * g} stroke="#e2e5e9" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            ))}
            {series.map((s) => (
              <path key={s.label} d={path(s.values)} fill="none" stroke={s.stroke} strokeWidth="3" strokeDasharray={s.dash} vectorEffect="non-scaling-stroke" />
            ))}
          </svg>
        </div>
        <div className="mt-1 flex justify-between text-xs text-brand-muted" aria-hidden="true">
          <span>Hoje</span>
          <span>{monthYearShort(lastDue)}</span>
        </div>
      </div>
      <p className="mt-1 text-xs text-brand-muted">O degrau logo no início é o aporte de hoje: o saldo cai na hora.</p>
      <details className="mt-2 text-sm">
        <summary className="min-h-11 cursor-pointer py-2 font-semibold text-brand-teal-dark">Ver os valores do gráfico</summary>
        <div className="max-h-72 overflow-auto rounded-lg border border-brand-border">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Saldo devedor ao fim de cada período</caption>
            <thead className="sticky top-0 bg-brand-surface-soft text-left">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold text-brand-navy">Quando</th>
                {series.map((s) => (
                  <th key={s.label} scope="col" className="px-3 py-2 text-right font-semibold text-brand-navy">{s.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              <tr className="border-t border-brand-border">
                <th scope="row" className="px-3 py-1.5 text-left font-medium">Hoje, depois do aporte</th>
                {series.map((s) => (
                  <td key={s.label} className="px-3 py-1.5 text-right">{brl(s.values[1] ?? 0)}</td>
                ))}
              </tr>
              {sample.map((k) => (
                <tr key={k} className="border-t border-brand-border">
                  <th scope="row" className="px-3 py-1.5 text-left font-medium">{monthYearShort(addMonths(firstDueIso, k - 1))}</th>
                  {series.map((s) => (
                    <td key={s.label} className="px-3 py-1.5 text-right">{brl(s.values[k + 1] ?? 0)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

/* ---------- cronograma parcela a parcela ---------- */

function Schedule({ run, label }: { run: ContractRun; label: string }) {
  const hasExtra = run.rows.some((r) => r.extraCents > 0);
  return (
    <div className="mt-2 max-h-80 overflow-auto rounded-lg border border-brand-border">
      <table className="w-full min-w-[560px] border-collapse text-xs sm:text-sm">
        <caption className="sr-only">Cronograma estimado, {label}</caption>
        <thead className="sticky top-0 bg-brand-surface-soft text-left">
          <tr>
            <th scope="col" className="px-2 py-2 font-semibold text-brand-navy">Nº</th>
            <th scope="col" className="px-2 py-2 font-semibold text-brand-navy">Vencimento</th>
            <th scope="col" className="px-2 py-2 text-right font-semibold text-brand-navy">Saldo inicial</th>
            <th scope="col" className="px-2 py-2 text-right font-semibold text-brand-navy">Juros</th>
            <th scope="col" className="px-2 py-2 text-right font-semibold text-brand-navy">Amortização</th>
            <th scope="col" className="px-2 py-2 text-right font-semibold text-brand-navy">Prestação</th>
            {hasExtra ? <th scope="col" className="px-2 py-2 text-right font-semibold text-brand-navy">Extra</th> : null}
            <th scope="col" className="px-2 py-2 text-right font-semibold text-brand-navy">Saldo final</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {run.rows.map((r) => (
            <tr key={r.k} className="border-t border-brand-border">
              <th scope="row" className="px-2 py-1 text-left font-medium">{r.k}</th>
              <td className="px-2 py-1">{monthYearShort(r.dueIso)}</td>
              <td className="px-2 py-1 text-right">{brl(r.openingCents)}</td>
              <td className="px-2 py-1 text-right">{brl(r.interestCents)}</td>
              <td className="px-2 py-1 text-right">{brl(r.principalCents)}</td>
              <td className="px-2 py-1 text-right">{brl(r.paymentCents)}</td>
              {hasExtra ? <td className="px-2 py-1 text-right">{r.extraCents > 0 ? brl(r.extraCents) : "—"}</td> : null}
              <td className="px-2 py-1 text-right">{brl(r.closingCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- botão dos exemplos da página ---------- */

export function SimulateAmortizationButton({ label, detail }: { label: string; detail: AmortizationPrefill }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent<AmortizationPrefill>(AMORTIZATION_PREFILL_EVENT, { detail }))}
      className="not-prose mt-3 inline-flex min-h-11 items-center rounded-lg border border-brand-navy px-4 text-sm font-semibold text-brand-navy hover:bg-brand-teal-soft"
    >
      {label}
    </button>
  );
}

/* ---------- componente ---------- */

type Origin = "proprios" | "fgts" | "outro";
type GoalKind = "anos" | "data" | "parcela" | "mensal";

interface Submitted {
  input: ContractInput;
  lumpCents: number;
  approxDate: boolean;
  informedCents: number | null;
  insurance: "sim" | "nao" | "nao-sei" | null;
  origin: Origin;
}

const FIELD_ORDER: AmortField[] = ["balance", "rate", "months", "lump", "firstDue"];
const FIELD_ID: Record<AmortField, string> = {
  balance: "amort-saldo",
  rate: "amort-taxa",
  months: "amort-parcelas",
  lump: "amort-valor",
  firstDue: "amort-vencimento",
  monthly: "amort-extra-mensal",
  annual: "amort-extra-anual",
  custom: "amort-extra-datas",
};

export function AmortizationSimulator({ today, context = "ferramenta" }: { today: string; context?: Context }) {
  const [balance, setBalance] = useState("");
  const [rate, setRate] = useState("");
  const [rateUnit, setRateUnit] = useState<"am" | "aa">("aa");
  const [nominal, setNominal] = useState(false);
  const [months, setMonths] = useState("");
  const [system, setSystem] = useState<AmortSystem | null>(null);
  const [lump, setLump] = useState("");
  const [firstDue, setFirstDue] = useState("");
  const [informed, setInformed] = useState("");
  const [insurance, setInsurance] = useState<Submitted["insurance"]>(null);
  const [origin, setOrigin] = useState<Origin>("proprios");
  const [errors, setErrors] = useState<Partial<Record<AmortField | "system", string>>>({});
  const [submitted, setSubmitted] = useState<Submitted | null>(null);
  const [exampleUsed, setExampleUsed] = useState(false);

  const [monthly, setMonthly] = useState("");
  const [annual, setAnnual] = useState("");
  const [annualMonth, setAnnualMonth] = useState(12);
  const [custom, setCustom] = useState<Array<{ month: string; amount: string }>>([{ month: "", amount: "" }]);
  const [extrasMode, setExtrasMode] = useState<AmortMode>("prazo");
  const [extrasPlan, setExtrasPlan] = useState<ExtraPlan | null>(null);
  const [extrasWithLump, setExtrasWithLump] = useState(true);
  const [extrasError, setExtrasError] = useState<string | null>(null);

  const [goalKind, setGoalKind] = useState<GoalKind>("anos");
  const [goalYears, setGoalYears] = useState("5");
  const [goalMonth, setGoalMonth] = useState("");
  const [goalPayment, setGoalPayment] = useState("");
  const [goal, setGoal] = useState<{ kind: GoalKind; answer: GoalAnswer } | null>(null);
  const [goalError, setGoalError] = useState<string | null>(null);

  const [openSchedule, setOpenSchedule] = useState<{ prazo: boolean; prestacao: boolean }>({ prazo: false, prestacao: false });

  const { ref: resultRef, reveal } = useRevealResult<HTMLDivElement>();
  const { ref: extrasRef, reveal: revealExtras } = useRevealResult<HTMLDivElement>();

  const onView = useEffectEvent(() => track("amortization_simulator_view", { context }));
  useEffect(() => {
    onView();
  }, []);

  const unit: AmortRateUnit = rateUnit === "am" ? "am" : nominal ? "aa-nominal" : "aa";
  const balancePreview = parseMoney(balance);
  const ladder = balancePreview && Number.isFinite(balancePreview) && balancePreview > 0 ? lumpLadder(balancePreview) : [];

  function compute(fields?: { balance: string; rate: string; months: string; lump: string; system: AmortSystem | null; unit: AmortRateUnit; firstDue: string }, fromExample = false) {
    const f = fields ?? { balance, rate, months, lump, system, unit, firstDue };
    const next: Partial<Record<AmortField | "system", string>> = {};
    const b = parseMoney(f.balance);
    const r = parsePercentBR(f.rate);
    const n = /^\d+$/.test(f.months.trim()) ? Number(f.months.trim()) : Number.NaN;
    const l = f.lump.trim() === "" ? 0 : parseMoney(f.lump);
    if (b === null || !Number.isFinite(b)) next.balance = "Informe o saldo devedor atual, em reais.";
    if (r === null) next.rate = "Informe a taxa de juros do contrato, por exemplo 9,5.";
    if (!Number.isFinite(n)) next.months = "Informe quantas parcelas ainda faltam (número inteiro).";
    if (l === null || !Number.isFinite(l)) next.lump = "Informe o valor que pretende amortizar, em reais.";
    if (!f.system) next.system = "Escolha o sistema do contrato: SAC ou Price.";
    const approxDate = f.firstDue === "";
    const firstDueIso = approxDate ? addMonths(today, 1) : f.firstDue;
    if (Object.keys(next).length === 0 && f.system) {
      const input: ContractInput = { balanceCents: b!, ratePercent: r!, rateUnit: f.unit, remainingMonths: n, system: f.system, firstDueIso };
      const out = simulateAmortization(input, { ...NO_EXTRAS, lumpCents: l ?? 0 });
      if (out.kind === "invalid") for (const issue of out.issues) next[issue.field] ??= issue.message;
      else if ((l ?? 0) === 0) next.lump = "Informe um valor maior que zero para ver o efeito da amortização.";
      if (Object.keys(next).length === 0) {
        const informedCents = parseMoney(informed);
        setErrors({});
        setSubmitted({ input, lumpCents: l!, approxDate, informedCents: informedCents !== null && Number.isFinite(informedCents) && informedCents > 0 ? informedCents : null, insurance, origin });
        setExtrasPlan(null);
        setGoal(null);
        setOpenSchedule({ prazo: false, prestacao: false });
        track("amortization_calculated", {
          context,
          system: f.system,
          rate_unit: f.unit,
          has_date: approxDate ? "nao" : "sim",
          informed_payment: informed.trim() ? "sim" : "nao",
          origin,
          example_used: fromExample || exampleUsed ? "sim" : "nao",
        });
        reveal();
        return;
      }
    }
    setErrors(next);
    const firstBad = [...FIELD_ORDER, "system" as const].find((k) => next[k]);
    if (firstBad) window.setTimeout(() => document.getElementById(firstBad === "system" ? "amort-sistema" : FIELD_ID[firstBad])?.focus(), 0);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    compute();
  }

  const applyPrefill = useEffectEvent((d: AmortizationPrefill) => {
    const fields = {
      balance: moneyInput(d.balanceCents),
      rate: pct(d.ratePercent, d.ratePercent % 1 === 0 ? 0 : 2),
      months: String(d.remainingMonths),
      lump: moneyInput(d.lumpCents),
      system: d.system,
      unit: d.rateUnit,
      firstDue: "",
    };
    setBalance(fields.balance);
    setRate(fields.rate);
    setRateUnit(d.rateUnit === "am" ? "am" : "aa");
    setNominal(d.rateUnit === "aa-nominal");
    setMonths(fields.months);
    setSystem(d.system);
    setLump(fields.lump);
    setFirstDue("");
    setExampleUsed(true);
    track("amortization_example_select", { context, example: d.exampleId });
    compute(fields, true);
  });

  useEffect(() => {
    const listener = (e: Event) => applyPrefill((e as CustomEvent<AmortizationPrefill>).detail);
    window.addEventListener(AMORTIZATION_PREFILL_EVENT, listener);
    return () => window.removeEventListener(AMORTIZATION_PREFILL_EVENT, listener);
  }, []);

  const outcome = useMemo(() => (submitted ? simulateAmortization(submitted.input, { ...NO_EXTRAS, lumpCents: submitted.lumpCents }) : null), [submitted]);
  const result = outcome?.kind === "ok" ? outcome.result : null;
  const sens = useMemo(() => (submitted ? sensitivity(submitted.input, lumpLadder(submitted.input.balanceCents)) : []), [submitted]);

  const extrasRuns = useMemo(() => {
    if (!submitted || !extrasPlan) return null;
    const lumpCents = extrasWithLump ? submitted.lumpCents : 0;
    const base = runContract(submitted.input, NO_EXTRAS, "prazo");
    const lumpOnly = runContract(submitted.input, { ...NO_EXTRAS, lumpCents }, extrasMode);
    const withExtras = runContract(submitted.input, { ...extrasPlan, lumpCents }, extrasMode);
    return { base, lumpOnly, withExtras, mode: extrasMode, lumpCents };
  }, [submitted, extrasPlan, extrasMode, extrasWithLump]);

  function runExtras(e?: React.FormEvent) {
    e?.preventDefault();
    if (!submitted) return;
    const m = monthly.trim() === "" ? 0 : parseMoney(monthly);
    const a = annual.trim() === "" ? 0 : parseMoney(annual);
    const rows = custom.filter((c) => c.month || c.amount.trim());
    const parsedCustom = rows.map((c) => ({ month: c.month, cents: parseMoney(c.amount) ?? Number.NaN }));
    if (m === null || !Number.isFinite(m) || a === null || !Number.isFinite(a) || parsedCustom.some((c) => !/^\d{4}-\d{2}$/.test(c.month) || !Number.isFinite(c.cents) || c.cents <= 0)) {
      setExtrasError("Confira os valores: use reais (por exemplo, 500,00) e, nas datas, informe mês e valor.");
      return;
    }
    if (m === 0 && a === 0 && parsedCustom.length === 0) {
      setExtrasError("Informe pelo menos um valor extra: mensal, anual ou em datas.");
      return;
    }
    setExtrasError(null);
    setExtrasWithLump(true);
    setExtrasPlan({ lumpCents: 0, monthlyCents: m, annual: a > 0 ? { cents: a, month: annualMonth } : null, custom: parsedCustom });
    if (m > 0) track("amortization_extra_monthly_added", { context, mode: extrasMode });
    if (a > 0 || parsedCustom.length > 0) track("amortization_extra_annual_added", { context, mode: extrasMode, kind: a > 0 ? (parsedCustom.length > 0 ? "anual-e-datas" : "anual") : "datas" });
    revealExtras();
  }

  function runGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!submitted) return;
    const input = submitted.input;
    let answer: GoalAnswer | null = null;
    if (goalKind === "anos" || goalKind === "mensal") {
      const years = Number(goalYears.replace(",", "."));
      if (!Number.isFinite(years) || years <= 0) {
        setGoalError("Informe em quantos anos quer antecipar a quitação, por exemplo 5.");
        return;
      }
      const monthsEarlier = Math.round(years * 12);
      answer = goalKind === "anos" ? lumpForMonthsEarlier(input, monthsEarlier) : monthlyForMonthsEarlier(input, monthsEarlier);
    } else if (goalKind === "data") {
      if (!/^\d{4}-\d{2}$/.test(goalMonth)) {
        setGoalError("Escolha o mês e o ano em que quer terminar de pagar.");
        return;
      }
      answer = lumpForEndMonth(input, goalMonth);
    } else {
      const target = parseMoney(goalPayment);
      if (target === null || !Number.isFinite(target) || target <= 0) {
        setGoalError("Informe a prestação que quer alcançar, em reais.");
        return;
      }
      answer = lumpForPayment(input, target);
    }
    setGoalError(null);
    setGoal({ kind: goalKind, answer });
    track("amortization_reverse_goal_used", { context, goal: goalKind, outcome: answer.kind });
  }

  function openGoalScenario() {
    if (!goal || goal.answer.kind !== "valor" || !submitted) return;
    if (goal.kind === "mensal") {
      setMonthly(moneyInput(goal.answer.cents));
      setAnnual("");
      setCustom([{ month: "", amount: "" }]);
      setExtrasMode("prazo");
      setExtrasWithLump(false);
      setExtrasPlan({ ...NO_EXTRAS, monthlyCents: goal.answer.cents });
      track("amortization_extra_monthly_added", { context, mode: "prazo" });
      revealExtras();
      return;
    }
    const fields = { balance, rate, months, lump: moneyInput(goal.answer.cents), system, unit, firstDue };
    setLump(fields.lump);
    compute(fields);
  }

  const cta = (target: string) => () => track("amortization_internal_cta_clicked", { context, target });

  const Title = context === "artigo" ? "h3" : "h2";

  return (
    <div className="not-prose">
      <form onSubmit={handleSubmit} noValidate aria-labelledby="amort-form-titulo" className="rounded-2xl border border-brand-border bg-brand-surface-soft/50 p-4 sm:p-6">
        <p id="amort-form-titulo" className="font-serif text-xl font-bold text-brand-navy">Seu financiamento hoje</p>
        <p className="mt-1 text-sm leading-relaxed text-brand-muted">Você já tem um financiamento. Agora quer saber o que muda se colocar dinheiro extra no saldo.</p>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field
            id="amort-saldo"
            label="Saldo devedor atual"
            hint="Consulte o saldo devedor atual no aplicativo, no internet banking ou no demonstrativo do financiamento."
            error={errors.balance}
          >
            <input id="amort-saldo" inputMode="decimal" autoComplete="off" placeholder="R$ 284.000,00" value={balance} onChange={(e) => setBalance(e.target.value)} onBlur={() => setBalance(tidyMoney(balance))} aria-invalid={!!errors.balance} aria-describedby={describe("amort-saldo", errors.balance)} className={inputClass} />
          </Field>

          <Field
            id="amort-taxa"
            label="Taxa de juros do contrato"
            hint="Está no contrato ou no demonstrativo. Não preenchemos taxa média no seu lugar."
            error={errors.rate}
          >
            <div className="flex flex-wrap gap-2">
              <input id="amort-taxa" inputMode="decimal" autoComplete="off" placeholder={rateUnit === "am" ? "0,80" : "9,50"} value={rate} onChange={(e) => setRate(e.target.value)} aria-invalid={!!errors.rate} aria-describedby={describe("amort-taxa", errors.rate)} className={`${inputClass} flex-1 basis-24`} />
              <Segmented
                label="Unidade da taxa"
                value={rateUnit}
                options={[
                  { value: "aa", label: "% ao ano" },
                  { value: "am", label: "% ao mês" },
                ]}
                onChange={setRateUnit}
              />
            </div>
            {rateUnit === "aa" ? (
              <fieldset className="mt-2 text-sm">
                <legend className="sr-only">Tipo da taxa anual</legend>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <label className="flex min-h-11 items-center gap-2">
                    <input type="radio" name="amort-tipo-taxa" checked={!nominal} onChange={() => setNominal(false)} className="h-4 w-4" />
                    Efetiva
                  </label>
                  <label className="flex min-h-11 items-center gap-2">
                    <input type="radio" name="amort-tipo-taxa" checked={nominal} onChange={() => setNominal(true)} className="h-4 w-4" />
                    Nominal
                  </label>
                </div>
                <p className="text-xs leading-relaxed text-brand-muted">Contratos imobiliários costumam trazer as duas. Na dúvida, use a efetiva. A nominal é dividida por 12; a efetiva é convertida com juros compostos.</p>
              </fieldset>
            ) : null}
          </Field>

          <Field id="amort-parcelas" label="Parcelas restantes" hint="Quantas prestações ainda faltam, contando a próxima." error={errors.months}>
            <input id="amort-parcelas" inputMode="numeric" autoComplete="off" placeholder="278" value={months} onChange={(e) => setMonths(e.target.value)} aria-invalid={!!errors.months} aria-describedby={describe("amort-parcelas", errors.months)} className={inputClass} />
          </Field>

          <div>
            <p id="amort-sistema-rotulo" className="block text-sm font-semibold text-brand-navy">Sistema de amortização</p>
            <p id="amort-sistema-hint" className="mt-0.5 text-xs leading-relaxed text-brand-muted">Está no contrato. No SAC a prestação cai com o tempo; no Price ela fica igual.</p>
            <div id="amort-sistema" tabIndex={-1} className="mt-1.5" aria-describedby={errors.system ? "amort-sistema-erro" : "amort-sistema-hint"}>
              <Segmented
                label="Sistema de amortização"
                value={system}
                wide
                options={[
                  { value: "sac", label: "SAC" },
                  { value: "price", label: "Price" },
                ]}
                onChange={setSystem}
              />
            </div>
            {errors.system ? (
              <p id="amort-sistema-erro" className="mt-1.5 text-sm font-medium text-brand-danger">
                {errors.system}
              </p>
            ) : null}
          </div>

          <div className="sm:col-span-2">
            <Field id="amort-valor" label="Quanto pretende amortizar agora?" hint="Valor que sai do bolso hoje e abate o saldo devedor." error={errors.lump}>
              <input id="amort-valor" inputMode="decimal" autoComplete="off" placeholder="R$ 20.000,00" value={lump} onChange={(e) => setLump(e.target.value)} onBlur={() => setLump(tidyMoney(lump))} aria-invalid={!!errors.lump} aria-describedby={describe("amort-valor", errors.lump)} className={inputClass} />
            </Field>
            {ladder.length > 0 ? (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-brand-muted">Cenários:</span>
                {ladder.map((v) => (
                  <button key={v} type="button" onClick={() => setLump(moneyInput(v))} className="min-h-11 rounded-lg border border-brand-border bg-white px-3 font-semibold text-brand-navy hover:bg-brand-teal-soft">
                    {ladderLabel(v)}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <details className="mt-5 rounded-xl border border-brand-border bg-white">
          <summary className="min-h-12 cursor-pointer px-4 py-3 text-sm font-semibold text-brand-navy">Mais detalhes do contrato (opcional)</summary>
          <div className="grid gap-5 px-4 pb-4 sm:grid-cols-2">
            <Field id="amort-vencimento" label="Quando vence a próxima parcela?" hint="Com a data, a quitação sai no mês certo. Sem ela, usamos daqui a um mês, como aproximação." error={errors.firstDue}>
              <input id="amort-vencimento" type="date" value={firstDue} onChange={(e) => setFirstDue(e.target.value)} aria-describedby={describe("amort-vencimento", errors.firstDue)} className={inputClass} />
            </Field>
            <Field id="amort-prestacao-atual" label="Prestação que você paga hoje" hint="Só para conferir. Não muda o cálculo, que usa saldo, taxa e prazo.">
              <input id="amort-prestacao-atual" inputMode="decimal" autoComplete="off" placeholder="R$ 2.950,00" value={informed} onChange={(e) => setInformed(e.target.value)} onBlur={() => setInformed(tidyMoney(informed))} aria-describedby="amort-prestacao-atual-hint" className={inputClass} />
            </Field>
            <div>
              <p className="text-sm font-semibold text-brand-navy">Essa prestação inclui seguro ou tarifas?</p>
              <div className="mt-1.5">
                <Segmented
                  label="A prestação inclui seguro ou tarifas?"
                  value={insurance}
                  wide
                  options={[
                    { value: "sim", label: "Sim" },
                    { value: "nao", label: "Não" },
                    { value: "nao-sei", label: "Não sei" },
                  ]}
                  onChange={setInsurance}
                />
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-brand-navy">De onde vem o dinheiro da amortização?</p>
              <div className="mt-1.5">
                <Segmented
                  label="Origem do dinheiro"
                  value={origin}
                  wide
                  options={[
                    { value: "proprios", label: "Recursos próprios" },
                    { value: "fgts", label: "FGTS" },
                    { value: "outro", label: "Outro" },
                  ]}
                  onChange={(v) => {
                    setOrigin(v);
                    if (v === "fgts") track("amortization_fgts_selected", { context });
                  }}
                />
              </div>
            </div>
            {origin === "fgts" ? (
              <div className="rounded-lg bg-brand-surface-soft p-3 text-sm leading-relaxed text-brand-text sm:col-span-2">
                O uso do FGTS para amortizar depende das regras aplicáveis ao trabalhador, ao contrato e ao imóvel. A conta do simulador é a mesma: o
                que importa é o valor que efetivamente abate o saldo. Requisitos na{" "}
                <a href="https://www.caixa.gov.br/voce/habitacao/paginas/utilizacao-fgts.aspx" target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                  página oficial da Caixa sobre o uso do FGTS
                </a>
                . Usar o FGTS para pagar parte das prestações é outra modalidade, que este simulador não cobre.
              </div>
            ) : null}
          </div>
        </details>

        <div className="mt-5">
          <button type="submit" className="min-h-12 w-full rounded-lg bg-brand-navy px-6 font-semibold text-white hover:bg-brand-navy-soft sm:w-auto">
            Simular amortização
          </button>
          <p className="mt-2 text-xs text-brand-muted">Sem cadastro · Sem CPF · Simulação educativa. Nada do que você digita sai do seu aparelho.</p>
        </div>
      </form>

      <div ref={resultRef} aria-live="polite" className="scroll-mt-24">
        {submitted && result ? (
          <Result
            submitted={submitted}
            result={result}
            sens={sens}
            Title={Title}
            openSchedule={openSchedule}
            setOpenSchedule={(which, open) => {
              setOpenSchedule((s) => ({ ...s, [which]: open }));
              if (open && which === "prazo") track("amortization_term_scenario", { context });
              if (open && which === "prestacao") track("amortization_payment_scenario", { context });
            }}
            onPickLadder={(v) => {
              const fields = { balance, rate, months, lump: moneyInput(v), system, unit, firstDue };
              setLump(fields.lump);
              compute(fields);
            }}
            cta={cta}
          />
        ) : null}
      </div>

      {submitted && result ? (
        <>
          <section aria-labelledby="amort-extras-titulo" className="mt-8 rounded-2xl border border-brand-border p-4 sm:p-6">
            <Title id="amort-extras-titulo" className="font-serif text-xl font-bold text-brand-navy">
              E se você amortizasse um pouco todo mês ou todo ano?
            </Title>
            <p className="mt-1 text-sm leading-relaxed text-brand-muted">
              Os extras entram depois de cada prestação, somados ao aporte de hoje ({brl(submitted.lumpCents)}). Não supomos que você receba 13º,
              bônus ou PLR: são só cenários.
            </p>
            <form onSubmit={runExtras} noValidate className="mt-4 grid gap-5 sm:grid-cols-2">
              <Field id="amort-extra-mensal" label="Valor extra mensal" hint="Pago junto com a prestação, a partir da próxima.">
                <input id="amort-extra-mensal" inputMode="decimal" autoComplete="off" placeholder="R$ 500,00" value={monthly} onChange={(e) => setMonthly(e.target.value)} onBlur={() => setMonthly(tidyMoney(monthly))} aria-describedby="amort-extra-mensal-hint" className={inputClass} />
              </Field>
              <div>
                <Field id="amort-extra-anual" label="Valor extra uma vez por ano" hint="Por exemplo, parte do 13º, se fizer sentido para você.">
                  <div className="flex flex-wrap gap-2">
                    <input id="amort-extra-anual" inputMode="decimal" autoComplete="off" placeholder="R$ 10.000,00" value={annual} onChange={(e) => setAnnual(e.target.value)} onBlur={() => setAnnual(tidyMoney(annual))} aria-describedby="amort-extra-anual-hint" className={`${inputClass} flex-1 basis-32`} />
                    <label htmlFor="amort-extra-anual-mes" className="sr-only">Mês do extra anual</label>
                    <select id="amort-extra-anual-mes" value={annualMonth} onChange={(e) => setAnnualMonth(Number(e.target.value))} className={`${inputClass} w-auto flex-none`}>
                      {MONTH_NAMES.map((name, i) => (
                        <option key={name} value={i + 1}>{name}</option>
                      ))}
                    </select>
                  </div>
                </Field>
              </div>
              <details className="rounded-xl border border-brand-border sm:col-span-2">
                <summary className="min-h-12 cursor-pointer px-4 py-3 text-sm font-semibold text-brand-navy">Aportes em datas específicas (modo avançado)</summary>
                <div id="amort-extra-datas" className="space-y-3 px-4 pb-4">
                  {custom.map((c, idx) => (
                    <div key={idx} className="flex flex-wrap items-end gap-2">
                      <div>
                        <label htmlFor={`amort-data-${idx}`} className="block text-xs font-semibold text-brand-navy">Mês</label>
                        <input id={`amort-data-${idx}`} type="month" value={c.month} onChange={(e) => setCustom((list) => list.map((x, j) => (j === idx ? { ...x, month: e.target.value } : x)))} className={`${inputClass} w-auto`} />
                      </div>
                      <div className="flex-1 basis-32">
                        <label htmlFor={`amort-data-valor-${idx}`} className="block text-xs font-semibold text-brand-navy">Valor</label>
                        <input id={`amort-data-valor-${idx}`} inputMode="decimal" autoComplete="off" placeholder="R$ 10.000,00" value={c.amount} onChange={(e) => setCustom((list) => list.map((x, j) => (j === idx ? { ...x, amount: e.target.value } : x)))} onBlur={() => setCustom((list) => list.map((x, j) => (j === idx ? { ...x, amount: tidyMoney(x.amount) } : x)))} className={inputClass} />
                      </div>
                      {custom.length > 1 ? (
                        <button type="button" onClick={() => setCustom((list) => list.filter((_, j) => j !== idx))} className="min-h-12 rounded-lg px-3 text-sm font-semibold text-brand-muted underline">
                          Remover<span className="sr-only"> aporte {idx + 1}</span>
                        </button>
                      ) : null}
                    </div>
                  ))}
                  <button type="button" onClick={() => setCustom((list) => [...list, { month: "", amount: "" }])} className="min-h-11 rounded-lg border border-brand-border bg-white px-3 text-sm font-semibold text-brand-navy">
                    Adicionar data
                  </button>
                </div>
              </details>
              <div className="sm:col-span-2">
                <p className="text-sm font-semibold text-brand-navy">O que o extra faz com o contrato?</p>
                <div className="mt-1.5 max-w-md">
                  <Segmented
                    label="Efeito dos extras"
                    value={extrasMode}
                    wide
                    options={[
                      { value: "prazo", label: "Reduzir prazo" },
                      { value: "prestacao", label: "Reduzir prestação" },
                    ]}
                    onChange={setExtrasMode}
                  />
                </div>
              </div>
              {extrasError ? <p role="alert" className="text-sm font-medium text-brand-danger sm:col-span-2">{extrasError}</p> : null}
              <div className="sm:col-span-2">
                <button type="submit" className="min-h-12 w-full rounded-lg border-2 border-brand-navy px-6 font-semibold text-brand-navy hover:bg-brand-teal-soft sm:w-auto">
                  Simular com extras
                </button>
              </div>
            </form>
            <div ref={extrasRef} aria-live="polite" className="scroll-mt-24">
              {extrasRuns ? <ExtrasResult input={submitted.input} {...extrasRuns} approxDate={submitted.approxDate} /> : null}
            </div>
          </section>

          <section aria-labelledby="amort-meta-titulo" className="mt-8 rounded-2xl border border-brand-border p-4 sm:p-6">
            <Title id="amort-meta-titulo" className="font-serif text-xl font-bold text-brand-navy">
              Quanto preciso amortizar para…?
            </Title>
            <p className="mt-1 text-sm leading-relaxed text-brand-muted">A conta ao contrário: escolha a meta e veja o valor aproximado. Ela parte do contrato como está hoje, sem a amortização simulada acima.</p>
            <form onSubmit={runGoal} noValidate className="mt-4 space-y-4">
              <Segmented
                label="Tipo de meta"
                value={goalKind}
                wide
                options={[
                  { value: "anos", label: "Quitar anos antes" },
                  { value: "data", label: "Terminar até uma data" },
                  { value: "parcela", label: "Baixar a prestação" },
                  { value: "mensal", label: "Extra por mês" },
                ]}
                onChange={(v) => {
                  setGoalKind(v);
                  setGoal(null);
                  setGoalError(null);
                }}
              />
              {goalKind === "anos" || goalKind === "mensal" ? (
                <Field id="amort-meta-anos" label={goalKind === "anos" ? "Quero quitar quantos anos antes? (aporte único hoje)" : "Quero quitar quantos anos antes? (pagando um extra todo mês)"}>
                  <input id="amort-meta-anos" inputMode="decimal" value={goalYears} onChange={(e) => setGoalYears(e.target.value)} className={`${inputClass} max-w-40`} />
                </Field>
              ) : goalKind === "data" ? (
                <Field id="amort-meta-data" label="Quero terminar de pagar até" hint={result ? `Hoje a última parcela vence em ${monthYearLong(result.base.lastDueIso!)}.` : undefined}>
                  <input id="amort-meta-data" type="month" value={goalMonth} onChange={(e) => setGoalMonth(e.target.value)} aria-describedby="amort-meta-data-hint" className={`${inputClass} max-w-56`} />
                </Field>
              ) : (
                <Field id="amort-meta-parcela" label="Quero a prestação perto de" hint={result ? `A próxima prestação calculada é ${brl(result.base.firstPaymentCents)}. O prazo continua o mesmo.` : undefined}>
                  <input id="amort-meta-parcela" inputMode="decimal" placeholder="R$ 2.500,00" value={goalPayment} onChange={(e) => setGoalPayment(e.target.value)} onBlur={() => setGoalPayment(tidyMoney(goalPayment))} aria-describedby="amort-meta-parcela-hint" className={`${inputClass} max-w-56`} />
                </Field>
              )}
              {goalError ? <p role="alert" className="text-sm font-medium text-brand-danger">{goalError}</p> : null}
              <button type="submit" className="min-h-12 w-full rounded-lg border-2 border-brand-navy px-6 font-semibold text-brand-navy hover:bg-brand-teal-soft sm:w-auto">
                Calcular o valor necessário
              </button>
            </form>
            <div aria-live="polite">{goal ? <GoalResult goal={goal} base={result.base} input={submitted.input} onOpen={openGoalScenario} /> : null}</div>
          </section>

          <section aria-labelledby="amort-proximos" className="mt-8 rounded-2xl bg-brand-surface-soft p-4 sm:p-6">
            <Title id="amort-proximos" className="font-serif text-lg font-bold text-brand-navy">
              Próximos passos
            </Title>
            <ul className="mt-2 space-y-2 text-sm leading-relaxed">
              <li>
                Quer simular o contrato completo desde o início?{" "}
                <Link href="/calculadoras/financiamento-imobiliario/" onClick={cta("financiamento-imobiliario")} className="font-semibold text-brand-teal-dark underline">
                  Simular financiamento imobiliário
                </Link>{" "}
                ou{" "}
                <Link href="/calculadoras/financiamento-veiculo/" onClick={cta("financiamento-veiculo")} className="font-semibold text-brand-teal-dark underline">
                  financiamento do veículo
                </Link>
                .
              </li>
              <li>
                Tem dinheiro para liquidar o contrato inteiro?{" "}
                <Link href="/calculadoras/quitacao-antecipada/" onClick={cta("quitacao-antecipada")} className="font-semibold text-brand-teal-dark underline">
                  Simular quitação antecipada
                </Link>
                .
              </li>
              <li>
                Quer analisar todos os custos de uma proposta, com seguros e tarifas?{" "}
                <Link href="/calculadoras/cet/" onClick={cta("cet")} className="font-semibold text-brand-teal-dark underline">
                  Calcular o CET
                </Link>
                .
              </li>
              <li>
                Quer entender por que SAC e Price reagem diferente?{" "}
                <Link href="/calculadoras/sac-x-price/" onClick={cta("sac-x-price")} className="font-semibold text-brand-teal-dark underline">
                  Comparar SAC e Price
                </Link>
                .
              </li>
            </ul>
          </section>
        </>
      ) : null}

      <p className="mt-6 rounded-lg border border-brand-border bg-white p-4 text-xs leading-relaxed text-brand-muted">
        Esta ferramenta produz uma estimativa com base no saldo, na taxa, no prazo e no sistema informados. O resultado real pode variar por datas,
        seguros, tarifas, indexadores, regras contratuais e metodologia da instituição financeira. Não é recomendação: amortizar ou não depende
        também de reserva, outras dívidas e necessidades que a ferramenta não conhece.{" "}
        <a href="#como-simulamos" className="underline underline-offset-2">Como simulamos</a>
      </p>
    </div>
  );
}

/* ---------- resultado principal ---------- */

function Result({
  submitted,
  result,
  sens,
  Title,
  openSchedule,
  setOpenSchedule,
  onPickLadder,
  cta,
}: {
  submitted: Submitted;
  result: AmortizationResult;
  sens: ReturnType<typeof sensitivity>;
  Title: "h2" | "h3";
  openSchedule: { prazo: boolean; prestacao: boolean };
  setOpenSchedule: (which: "prazo" | "prestacao", open: boolean) => void;
  onPickLadder: (cents: number) => void;
  cta: (target: string) => () => void;
}) {
  const { input, lumpCents, approxDate } = submitted;
  const { base, prazo, prestacao, prazoVsBase, prestacaoVsBase } = result;
  const quitted = prazo.months === 0;
  const baseEnd = monthYearLong(base.lastDueIso!);
  const prazoEnd = prazo.lastDueIso ? monthYearLong(prazo.lastDueIso) : null;
  const annual = effectiveAnnual(result.monthlyRate) * 100;
  const lowerInterest = prazo.totalInterestCents < prestacao.totalInterestCents ? "prazo" : prazo.totalInterestCents > prestacao.totalInterestCents ? "prestacao" : null;
  const firstInterestAfter = prazo.rows[0]?.interestCents ?? 0;
  const payCheck = submitted.informedCents ? checkInformedPayment(submitted.informedCents, base.firstPaymentCents) : null;
  const firstDueLabel = monthYearLong(input.firstDueIso);

  const steps: JourneyStep[] = [
    { key: "hoje", label: "Você está aqui", title: `Saldo ${brlRound(input.balanceCents)}`, when: "Hoje", detail: `Restam ${base.months} parcelas: ${formatMonths(base.months)}.` },
    { key: "sem", label: "Sem amortizar", title: `Quitação em ${baseEnd}`, when: monthYearShort(base.lastDueIso!), detail: `Juros futuros estimados: ${brlRound(base.totalInterestCents)}.` },
    { key: "aporte", label: `Amortizando ${brlRound(lumpCents)} hoje`, title: quitted ? "Saldo zerado nesta modelagem" : `Novo saldo ${brlRound(prazo.balanceAfterLumpCents)}`, when: "Hoje" },
  ];
  if (!quitted) {
    steps.push({
      key: "prazo",
      label: "Se reduzir o prazo",
      title: `Quitação em ${prazoEnd}`,
      when: monthYearShort(prazo.lastDueIso!),
      detail: `${prazoVsBase.monthsSaved > 0 ? `${formatMonths(prazoVsBase.monthsSaved)} antes` : "Mesmo prazo"}. Juros evitados: ${brlRound(prazoVsBase.interestAvoidedCents)}.`,
      emphasis: true,
    });
    steps.push({
      key: "prestacao",
      label: "Se reduzir a prestação",
      title: `Prestação ${brl(prestacao.firstPaymentCents)}`,
      when: `A partir de ${monthYearShort(input.firstDueIso)}`,
      detail: `${brl(prestacaoVsBase.firstPaymentDropCents)} a menos por mês. Juros evitados: ${brlRound(prestacaoVsBase.interestAvoidedCents)}.`,
      emphasis: true,
    });
  }

  const tableRows: Array<[string, string, string, string]> = [
    ["Saldo depois de hoje", brl(input.balanceCents), brl(prazo.balanceAfterLumpCents), brl(prestacao.balanceAfterLumpCents)],
    ["Próxima prestação-base", brl(base.firstPaymentCents), brl(prazo.firstPaymentCents), brl(prestacao.firstPaymentCents)],
    ["Prazo restante", `${base.months} parcelas`, `${prazo.months} parcelas`, `${prestacao.months} parcelas`],
    ["Última parcela", monthYearShort(base.lastDueIso!), prazo.lastDueIso ? monthYearShort(prazo.lastDueIso) : "—", prestacao.lastDueIso ? monthYearShort(prestacao.lastDueIso) : "—"],
    ["Juros futuros", brl(base.totalInterestCents), brl(prazo.totalInterestCents), brl(prestacao.totalInterestCents)],
    ["Prestações futuras", brl(base.totalPaymentsCents), brl(prazo.totalPaymentsCents), brl(prestacao.totalPaymentsCents)],
    ["Amortização hoje", brl(0), brl(lumpCents), brl(lumpCents)],
    ["Desembolso total a partir de hoje", brl(base.totalOutlayCents), brl(prazo.totalOutlayCents), brl(prestacao.totalOutlayCents)],
  ];

  return (
    <div className="mt-8 border-t border-brand-border pt-6">
      <Title id="amort-resultado" data-result-heading tabIndex={-1} className="font-serif text-2xl font-bold text-brand-navy focus:outline-none">
        O que {brl(lumpCents)} de amortização mudam
      </Title>
      <p className="mt-1 text-sm text-brand-muted">
        {input.system === "sac" ? "SAC" : "Price"}, taxa de {pct(result.monthlyRate * 100, 4)}% ao mês ({pct(annual)}% ao ano efetiva).{" "}
        {approxDate ? "Datas aproximadas: sem a data da próxima parcela, contamos a partir de daqui a um mês." : `Próxima parcela em ${firstDueLabel}.`}
      </p>

      <FinancialJourney steps={steps} ariaLabel="Linha do tempo do financiamento: hoje, sem amortizar, com a amortização e os dois caminhos" />

      {quitted ? (
        <p className="mt-6 rounded-xl bg-brand-surface-soft p-4 text-sm leading-relaxed">
          Esse valor zera o saldo nesta modelagem, sem juros futuros. O valor exato para quitar vem da instituição, na data do pagamento, e pode
          ser diferente. Para essa conta, use a{" "}
          <Link href="/calculadoras/quitacao-antecipada/" onClick={cta("quitacao-antecipada")} className="font-semibold underline">
            calculadora de quitação antecipada
          </Link>
          .
        </p>
      ) : (
        <>
          <dl className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-white p-4 ring-1 ring-brand-border">
              <dt className="text-xs font-semibold uppercase tracking-wide text-brand-muted">O número que aparece</dt>
              <dd className="mt-1 text-xl font-bold tabular-nums text-brand-navy">Amortização: {brl(lumpCents)}</dd>
              <dd className="mt-1 text-xs leading-relaxed text-brand-muted">Não é economia: é saldo pago antes. Ele sai do bolso hoje.</dd>
            </div>
            <div className="rounded-xl bg-white p-4 ring-1 ring-brand-border">
              <dt className="text-xs font-semibold uppercase tracking-wide text-brand-muted">O número que quase ninguém olha</dt>
              <dd className="mt-1 text-xl font-bold tabular-nums text-brand-navy">{brl(prazoVsBase.interestAvoidedCents)}</dd>
              <dd className="mt-1 text-xs leading-relaxed text-brand-muted">de juros futuros que deixam de incidir no caminho de reduzir o prazo.</dd>
            </div>
            <div className="rounded-xl bg-white p-4 ring-1 ring-brand-border">
              <dt className="text-xs font-semibold uppercase tracking-wide text-brand-muted">O tempo que muda</dt>
              <dd className="mt-1 text-xl font-bold text-brand-navy">{prazoVsBase.monthsSaved > 0 ? `${formatMonths(prazoVsBase.monthsSaved)} antes` : "Nenhum mês"}</dd>
              <dd className="mt-1 text-xs leading-relaxed text-brand-muted">
                Quitação passa de {monthYearShort(base.lastDueIso!)} para {monthYearShort(prazo.lastDueIso!)}.
              </dd>
            </div>
          </dl>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {(
              [
                ["prazo", "Reduzir prazo", "Objetivo: terminar antes", prazo, prazoVsBase],
                ["prestacao", "Reduzir prestação", "Objetivo: diminuir o compromisso mensal", prestacao, prestacaoVsBase],
              ] as const
            ).map(([key, name, goalText, run, cmp]) => (
              <article key={key} aria-labelledby={`amort-card-${key}`} className="rounded-2xl border border-brand-border bg-white p-4 sm:p-5">
                <h3 id={`amort-card-${key}`} className="font-serif text-lg font-bold text-brand-navy">{name}</h3>
                <p className="text-sm text-brand-muted">{goalText}</p>
                <ul className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                  {lowerInterest === key ? <li className="rounded-full bg-brand-surface-soft px-2.5 py-1 text-brand-navy">Menor total de juros neste cenário</li> : null}
                  {key === "prestacao" ? <li className="rounded-full bg-brand-surface-soft px-2.5 py-1 text-brand-navy">Menor prestação mensal</li> : null}
                </ul>
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm tabular-nums">
                  <div><dt className="text-xs text-brand-muted">Saldo depois</dt><dd className="font-semibold">{brl(run.balanceAfterLumpCents)}</dd></div>
                  <div><dt className="text-xs text-brand-muted">Prestação-base</dt><dd className="font-semibold">{brl(run.firstPaymentCents)}</dd></div>
                  <div><dt className="text-xs text-brand-muted">Prazo</dt><dd className="font-semibold">{run.months === base.months ? `continua ${run.months} parcelas` : `${base.months} → ${run.months} parcelas`}</dd></div>
                  <div><dt className="text-xs text-brand-muted">Última parcela</dt><dd className="font-semibold">{monthYearShort(run.lastDueIso!)}</dd></div>
                  <div><dt className="text-xs text-brand-muted">Juros futuros</dt><dd className="font-semibold">{brl(base.totalInterestCents)} → {brl(run.totalInterestCents)}</dd></div>
                  <div><dt className="text-xs text-brand-muted">Juros evitados</dt><dd className="font-semibold">{brl(cmp.interestAvoidedCents)}</dd></div>
                </dl>
                <p className="mt-3 rounded-lg bg-brand-surface-soft p-3 text-sm leading-relaxed">
                  {key === "prazo"
                    ? cmp.monthsSaved > 0
                      ? `Tempo liberado: ${formatMonths(cmp.monthsSaved)} de compromisso a menos. ${input.system === "price" ? `A prestação-base continua ${brl(run.firstPaymentCents)}` : "A quota de amortização continua a mesma e a prestação segue caindo"} e o contrato termina em ${monthYearLong(run.lastDueIso!)}.`
                      : "Com esse valor, o número de parcelas não muda: só a última fica menor."
                    : `Dinheiro liberado: ${brl(cmp.firstPaymentDropCents)} por mês deixam de estar comprometidos neste contrato. O prazo continua ${run.months} parcelas.`}
                </p>
                <details className="mt-3 text-sm" onToggle={(e) => setOpenSchedule(key, e.currentTarget.open)}>
                  <summary className="min-h-11 cursor-pointer py-2 font-semibold text-brand-teal-dark">Ver parcela a parcela</summary>
                  {openSchedule[key] ? <Schedule run={run} label={name} /> : null}
                </details>
              </article>
            ))}
          </div>

          <details className="mt-4 rounded-xl border border-brand-border">
            <summary className="min-h-12 cursor-pointer px-4 py-3 text-sm font-semibold text-brand-navy">Ver comparação lado a lado</summary>
            <div className="overflow-x-auto px-2 pb-3">
              <table className="w-full min-w-[520px] border-collapse text-sm tabular-nums">
                <caption className="sr-only">Sem amortizar, reduzir prazo e reduzir prestação</caption>
                <thead>
                  <tr className="text-left">
                    <th scope="col" className="px-2 py-2 font-semibold text-brand-navy"><span className="sr-only">Item</span></th>
                    <th scope="col" className="px-2 py-2 text-right font-semibold text-brand-navy">Sem amortizar</th>
                    <th scope="col" className="px-2 py-2 text-right font-semibold text-brand-navy">Reduzir prazo</th>
                    <th scope="col" className="px-2 py-2 text-right font-semibold text-brand-navy">Reduzir prestação</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map(([label, a, b, c]) => (
                    <tr key={label} className="border-t border-brand-border">
                      <th scope="row" className="px-2 py-1.5 text-left font-medium">{label}</th>
                      <td className="px-2 py-1.5 text-right">{a}</td>
                      <td className="px-2 py-1.5 text-right">{b}</td>
                      <td className="px-2 py-1.5 text-right">{c}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 px-2 text-xs leading-relaxed text-brand-muted">
                O desembolso total soma a amortização de hoje às prestações futuras. A diferença para &ldquo;sem amortizar&rdquo; é exatamente a dos
                juros evitados: o principal não desaparece, ele é pago antes.
              </p>
            </div>
          </details>

          <section aria-labelledby="amort-o-que-muda" className="mt-8">
            <h3 id="amort-o-que-muda" className="font-serif text-lg font-bold text-brand-navy">O que muda primeiro?</h3>
            <ol className="mt-3 space-y-3 text-sm leading-relaxed">
              <li className="rounded-xl bg-white p-3 ring-1 ring-brand-border">
                <strong className="text-brand-navy">Hoje: o saldo.</strong> Cai de {brl(input.balanceCents)} para {brl(prazo.balanceAfterLumpCents)} assim que a amortização é
                processada.
              </li>
              <li className="rounded-xl bg-white p-3 ring-1 ring-brand-border">
                <strong className="text-brand-navy">Na próxima parcela ({monthYearShort(input.firstDueIso)}): os juros do mês.</strong> Passam de {brl(base.rows[0]!.interestCents)} para{" "}
                {brl(firstInterestAfter)}. Reduzindo o prazo, a prestação fica {brl(prazo.firstPaymentCents)}; reduzindo a prestação, cai para {brl(prestacao.firstPaymentCents)}.
              </li>
              <li className="rounded-xl bg-white p-3 ring-1 ring-brand-border">
                <strong className="text-brand-navy">Ao longo do contrato: o total de juros.</strong> Cada mês cobra juros sobre um saldo menor. Somados, são {brl(prazoVsBase.interestAvoidedCents)} a menos
                reduzindo o prazo e {brl(prestacaoVsBase.interestAvoidedCents)} reduzindo a prestação.
              </li>
            </ol>
          </section>

          <section aria-labelledby="amort-grafico" className="mt-8">
            <h3 id="amort-grafico" className="font-serif text-lg font-bold text-brand-navy">Como o saldo cai em cada caminho</h3>
            <BalanceChart
              firstDueIso={input.firstDueIso}
              caption={`Saldo devedor de hoje até ${baseEnd}: sem amortizar, termina em ${baseEnd}; reduzindo o prazo, em ${prazoEnd}; reduzindo a prestação, em ${monthYearLong(prestacao.lastDueIso!)}.`}
              series={[
                { label: "Sem amortizar", values: balanceSeries(input, base), ...STROKES.base },
                { label: "Reduzir prazo", values: balanceSeries(input, prazo), ...STROKES.prazo },
                { label: "Reduzir prestação", values: balanceSeries(input, prestacao), ...STROKES.prestacao },
              ]}
            />
          </section>
        </>
      )}

      {payCheck && payCheck !== "proxima" ? (
        <p className="mt-6 rounded-xl border border-brand-border bg-white p-4 text-sm leading-relaxed">
          {payCheck === "informada-maior"
            ? `A prestação que você paga (${brl(submitted.informedCents!)}) é maior que a prestação financeira calculada (${brl(base.firstPaymentCents)}). Sua prestação total pode incluir seguros, tarifas, correção por indexador ou outras diferenças contratuais. O simulador segue pela prestação financeira calculada com saldo, taxa e prazo.`
            : `A prestação que você paga (${brl(submitted.informedCents!)}) é menor que a calculada (${brl(base.firstPaymentCents)}). Confira saldo, taxa, prazo e sistema: o contrato pode ter regras que o simulador não reproduz.`}
        </p>
      ) : null}

      <p className="mt-4 text-xs leading-relaxed text-brand-muted">
        Correções futuras por indexadores variáveis (como TR ou IPCA), seguros e tarifas não estão projetadas neste cenário: a taxa informada vale
        até o fim.
      </p>

      {sens.length > 1 && !quitted ? (
        <section aria-labelledby="amort-sensibilidade" className="mt-8">
          <h3 id="amort-sensibilidade" className="font-serif text-lg font-bold text-brand-navy">Quanto cada valor compra em tempo e em juros</h3>
          <p className="mt-1 text-sm text-brand-muted">Mesmo contrato, reduzindo o prazo. Os valores são cenários, não sugestão.</p>
          <ul className="mt-3 space-y-3">
            {sens.map((row, idx) => {
              const maxMonths = Math.max(...sens.map((s) => s.monthsSaved), 1);
              return (
                <li key={row.lumpCents} className="rounded-xl bg-white p-3 ring-1 ring-brand-border">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-semibold text-brand-navy">{ladderLabel(row.lumpCents)} hoje</p>
                    <p className="text-sm tabular-nums">
                      <strong>{row.monthsSaved > 0 ? `${formatMonths(row.monthsSaved)} a menos` : "nenhum mês a menos"}</strong> · {brl(row.interestAvoidedCents)} de juros evitados
                    </p>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-brand-surface-soft" aria-hidden="true">
                    <div className="h-2 rounded-full bg-brand-navy" style={{ width: `${(row.monthsSaved / maxMonths) * 100}%` }} />
                  </div>
                  {idx > 0 ? (
                    <p className="mt-1.5 text-xs text-brand-muted">
                      Os {ladderLabel(row.lumpCents - sens[idx - 1]!.lumpCents)} a mais em relação ao degrau anterior eliminam {row.marginalMonths}{" "}
                      {row.marginalMonths === 1 ? "mês" : "meses"} a mais.
                    </p>
                  ) : null}
                  <button type="button" onClick={() => onPickLadder(row.lumpCents)} className="mt-2 min-h-11 text-sm font-semibold text-brand-teal-dark underline">
                    Simular com {ladderLabel(row.lumpCents)}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/* ---------- extras ---------- */

function ExtrasResult({ input, lumpCents, base, lumpOnly, withExtras, mode, approxDate }: { input: ContractInput; lumpCents: number; base: ContractRun; lumpOnly: ContractRun; withExtras: ContractRun; mode: AmortMode; approxDate: boolean }) {
  const cmp = compareRuns(base, withExtras);
  const cmpLump = compareRuns(base, lumpOnly);
  const first = withExtras.rows[0];
  const half = Math.round(input.balanceCents / 2);
  const halfBase = dateBalanceBelow(base, half);
  const halfNew = dateBalanceBelow(withExtras, half);
  if (withExtras.months === 0 || !first) return <p className="mt-4 text-sm">Com o aporte de hoje, o saldo já zera nesta modelagem.</p>;
  return (
    <div className="mt-6 border-t border-brand-border pt-5">
      <h3 className="font-serif text-lg font-bold text-brand-navy">Nova trajetória com extras</h3>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-white p-4 ring-1 ring-brand-border">
          <dt className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Quitação</dt>
          <dd className="mt-1 text-lg font-bold text-brand-navy">{monthYearLong(withExtras.lastDueIso!)}</dd>
          <dd className="text-sm text-brand-muted">
            Sem amortizar: {monthYearLong(base.lastDueIso!)}. {cmp.monthsSaved > 0 ? `${formatMonths(cmp.monthsSaved)} antes.` : "Mesmo prazo."}
          </dd>
        </div>
        <div className="rounded-xl bg-white p-4 ring-1 ring-brand-border">
          <dt className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Juros futuros</dt>
          <dd className="mt-1 text-lg font-bold tabular-nums text-brand-navy">{brl(withExtras.totalInterestCents)}</dd>
          <dd className="text-sm text-brand-muted">Antes: {brl(base.totalInterestCents)}. Diferença: {brl(cmp.interestAvoidedCents)}.</dd>
        </div>
        <div className="rounded-xl bg-white p-4 ring-1 ring-brand-border">
          <dt className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Desembolso no primeiro mês</dt>
          <dd className="mt-1 text-lg font-bold tabular-nums text-brand-navy">{brl(first.paymentCents + first.extraCents)}</dd>
          <dd className="text-sm text-brand-muted">
            Prestação {brl(first.paymentCents)} + extra {brl(first.extraCents)}.
          </dd>
        </div>
        <div className="rounded-xl bg-white p-4 ring-1 ring-brand-border">
          <dt className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Próximo marco</dt>
          <dd className="mt-1 text-lg font-bold text-brand-navy">{halfNew ? `Saldo abaixo de ${brlRound(half)} em ${monthYearShort(halfNew)}` : "Saldo já abaixo da metade"}</dd>
          <dd className="text-sm text-brand-muted">{halfBase ? `Sem amortizar, isso acontece em ${monthYearShort(halfBase)}.` : null}</dd>
        </div>
      </dl>
      {lumpCents > 0 && mode === "prazo" ? (
        <p className="mt-4 rounded-xl bg-brand-surface-soft p-4 text-sm leading-relaxed">
          De onde vem o efeito: o aporte de hoje ({brl(lumpCents)}) sozinho antecipa {formatMonths(Math.max(cmpLump.monthsSaved, 0))}; os extras
          seguintes antecipam mais {formatMonths(Math.max(cmp.monthsSaved - cmpLump.monthsSaved, 0))}. Em juros: {brl(cmpLump.interestAvoidedCents)} do aporte e{" "}
          {brl(cmp.interestAvoidedCents - cmpLump.interestAvoidedCents)} dos extras. No total, os extras somam {brl(withExtras.totalExtrasCents)}, aporte incluído.
        </p>
      ) : (
        <p className="mt-4 rounded-xl bg-brand-surface-soft p-4 text-sm leading-relaxed">
          {mode === "prestacao"
            ? `Reduzindo a prestação a cada extra, ela chega a ${brl(withExtras.rows[Math.min(11, withExtras.rows.length - 1)]!.paymentCents)} em ${monthYearShort(withExtras.rows[Math.min(11, withExtras.rows.length - 1)]!.dueIso)}.`
            : null}{" "}
          No total, os extras somam {brl(withExtras.totalExtrasCents)}, aporte incluído.
        </p>
      )}
      {withExtras.ignoredCustom > 0 ? <p className="mt-2 text-sm text-brand-muted">{withExtras.ignoredCustom} aporte(s) em datas fora do prazo do contrato ficaram de fora.</p> : null}
      {withExtras.customAfterEnd > 0 ? <p className="mt-2 text-sm text-brand-muted">{withExtras.customAfterEnd} aporte(s) em datas ficaram para depois da quitação e não entram na conta.</p> : null}
      {lumpCents === 0 ? <p className="mt-2 text-sm text-brand-muted">Cenário sem o aporte de hoje: só com o extra mensal da meta.</p> : null}
      {approxDate ? <p className="mt-2 text-xs text-brand-muted">Datas aproximadas, contadas a partir de daqui a um mês.</p> : null}
      <BalanceChart
        firstDueIso={input.firstDueIso}
        caption={`Saldo devedor sem amortizar, até ${monthYearLong(base.lastDueIso!)}, e com os extras, até ${monthYearLong(withExtras.lastDueIso!)}.`}
        series={[
          { label: "Sem amortizar", values: balanceSeries(input, base), ...STROKES.base },
          { label: "Com os extras", values: balanceSeries(input, withExtras), ...STROKES.prazo },
        ]}
      />
    </div>
  );
}

/* ---------- metas ---------- */

function GoalResult({ goal, base, input, onOpen }: { goal: { kind: GoalKind; answer: GoalAnswer }; base: ContractRun; input: ContractInput; onOpen: () => void }) {
  const a = goal.answer;
  if (a.kind === "ja-atende") return <p className="mt-4 rounded-xl bg-brand-surface-soft p-4 text-sm">O contrato já atende essa meta sem nenhum extra.</p>;
  if (a.kind === "precisa-aporte") return <p className="mt-4 rounded-xl bg-brand-surface-soft p-4 text-sm">Essa meta pede terminar antes mesmo da próxima parcela: só com um aporte hoje que zere o saldo.</p>;
  if (a.kind === "quitacao") {
    return (
      <p className="mt-4 rounded-xl bg-brand-surface-soft p-4 text-sm leading-relaxed">
        Só zerando o saldo hoje, cerca de {brl(a.cents)} nesta modelagem. O valor oficial de quitação vem da instituição.
      </p>
    );
  }
  const run = a.run;
  const saved = base.months - run.months;
  return (
    <div className="mt-4 rounded-xl bg-white p-4 ring-1 ring-brand-border">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Valor aproximado necessário</p>
      <p className="mt-1 font-serif text-2xl font-bold tabular-nums text-brand-navy">
        {brl(a.cents)}
        {goal.kind === "mensal" ? <span className="text-base font-semibold"> por mês</span> : <span className="text-base font-semibold"> hoje</span>}
      </p>
      <p className="mt-2 text-sm leading-relaxed">
        {goal.kind === "parcela"
          ? `Com esse aporte, a próxima prestação fica em ${brl(run.firstPaymentCents)} e o prazo continua ${run.months} parcelas${input.system === "sac" ? " (no SAC, as seguintes seguem caindo)" : ""}.`
          : `A última parcela passa de ${monthYearLong(base.lastDueIso!)} para ${monthYearLong(run.lastDueIso!)}: ${formatMonths(saved)} antes, com ${brl(base.totalInterestCents - run.totalInterestCents)} de juros evitados.`}
      </p>
      <p className="mt-1 text-xs text-brand-muted">Estimativa matemática: a instituição recalcula com as regras e datas do contrato.</p>
      <button type="button" onClick={onOpen} className="mt-3 min-h-11 rounded-lg border border-brand-navy px-4 text-sm font-semibold text-brand-navy hover:bg-brand-teal-soft">
        Abrir este cenário
      </button>
    </div>
  );
}
