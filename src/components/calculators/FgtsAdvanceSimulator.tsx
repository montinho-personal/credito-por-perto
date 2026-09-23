"use client";

/**
 * SIMULADOR DE ANTECIPAÇÃO DO SAQUE-ANIVERSÁRIO
 * ============================================================================
 *
 * Pergunta: "quanto recebo hoje, e o que eu cedo em troca?". O banco
 * responde "quanto eu te ofereço"; aqui a resposta é a cadeia inteira —
 * saldo → saque da tabela → teto por saque → quantidade permitida na data →
 * saques futuros → desconto pela taxa → valor de hoje → diferença.
 *
 * DECISÕES QUE NÃO SÃO ÓBVIAS
 *
 * - Toda regra vem de `fgts-rules.ts`, pela DATA da simulação: a quantidade
 *   máxima de saques (5 até 31/10/2026, 3 depois) muda sozinha, nos botões,
 *   nas tabelas e nos textos.
 * - A data inicial chega do servidor (`today`) e é conferida no navegador
 *   depois de montar: a página é revalidada, o relógio da pessoa não.
 * - Taxa começa vazia. Não há taxa "comum" sugerida.
 * - "Diferença", nunca "juros": a proposta real soma IOF e tarifas.
 * - O valor bloqueado no FGTS NÃO é calculado — a composição oficial da base
 *   ao longo dos anos não está publicada em detalhe. A ferramenta explica a
 *   regra e mostra só a conta da tabela.
 * - Nada do que é digitado sai do navegador; a medição leva só contagens.
 */

import Link from "next/link";
import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { track } from "@/lib/analytics/track";
import { parseBRLToCents, parsePercentBR } from "@/lib/calculators/proposal-comparison";
import {
  analyzeOffer,
  balanceForSaqueCents,
  bracketFor,
  compareOffers,
  simulateAdvance,
  waitingPeriod,
  type OfferAnalysis,
  type OfferField,
  type OfferIssue,
  type RateUnit,
  type SimIssue,
  type SimField,
  type SimulationInput,
  type SimulationResult,
} from "@/lib/calculators/fgts-advance";
import {
  ADVANCE_RULES,
  TERMINATION_RULES,
  advanceRulesAt,
  formatIsoDate,
  nextAdvanceChange,
  todayInBrazil,
} from "@/lib/calculators/fgts-rules";
import { useRevealResult } from "./use-reveal-result";

export const FGTS_PREFILL_EVENT = "cpp:simular-fgts";

export interface FgtsPrefillDetail {
  exampleId: string;
  balanceCents: number;
  birthMonth: number;
  /** Taxa hipotética ao mês. */
  monthlyRatePercent: number;
  count: number;
}

type Mode = "simular" | "proposta";
type YesNo = "sim" | "nao" | "nao-sei" | "";

interface SimFields {
  balance: string;
  birthMonth: string;
  rate: string;
  rateUnit: RateUnit;
  count: number;
  simDate: string;
  adhesion: string;
  already: YesNo;
}

interface OfferFields {
  institution: string;
  received: string;
  count: string;
  ceded: string;
  rate: string;
  cet: string;
}

const EMPTY_OFFER: OfferFields = { institution: "", received: "", count: "", ceded: "", rate: "", cet: "" };
const LABELS = ["Proposta A", "Proposta B", "Proposta C"] as const;
export const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

/* ---------- formatação ---------- */

const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const pct = (v: number, digits = 2) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const moneyInput = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const saquesLabel = (n: number) => (n === 1 ? "1 saque" : `${n} saques`);

/** "5 meses e 12 dias" — aproximação de 30 dias por mês, só para leitura. */
function timeLabel(days: number): string {
  if (days < 30) return days === 1 ? "1 dia" : `${days} dias`;
  const m = Math.floor(days / 30);
  const d = days - m * 30;
  const ms = m === 1 ? "1 mês" : `${m} meses`;
  return d === 0 ? ms : `${ms} e ${d === 1 ? "1 dia" : `${d} dias`}`;
}

function tidyMoney(raw: string): string {
  const cents = parseBRLToCents(raw);
  return cents === null ? raw : moneyInput(cents);
}
const money = (raw: string) => (raw.trim() === "" ? Number.NaN : (parseBRLToCents(raw) ?? Number.NaN));
const optPct = (raw: string) => (raw.trim() === "" ? undefined : (parsePercentBR(raw) ?? Number.NaN));
const intOf = (raw: string) => (/^\d+$/.test(raw.trim()) ? Number(raw.trim()) : Number.NaN);

function toSimInput(f: SimFields): SimulationInput {
  return {
    balanceCents: money(f.balance),
    birthMonth: f.birthMonth === "" ? Number.NaN : Number(f.birthMonth),
    rate: parsePercentBR(f.rate) ?? Number.NaN,
    rateUnit: f.rateUnit,
    count: f.count,
    simDate: f.simDate,
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

function Segmented<T extends string | number>({
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
    <div
      role="group"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      className={`flex flex-wrap rounded-lg border border-brand-border p-0.5 ${wide ? "w-full sm:w-auto" : "w-fit"}`}
    >
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-11 min-w-11 rounded-md px-3 text-sm font-semibold text-brand-muted aria-pressed:bg-brand-navy aria-pressed:text-white ${wide ? "flex-1 sm:flex-none" : ""}`}
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
export function SimulateFgtsButton({ label, detail }: { label: string; detail: FgtsPrefillDetail }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent<FgtsPrefillDetail>(FGTS_PREFILL_EVENT, { detail }))}
      className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-brand-navy px-4 text-sm font-semibold text-brand-navy hover:bg-brand-teal-soft"
    >
      {label}
    </button>
  );
}

/* ---------- componente ---------- */

type Shown =
  | { mode: "simular"; result: SimulationResult; input: SimulationInput; fields: SimFields }
  | { mode: "proposta"; analyses: OfferAnalysis[]; names: string[]; simDate: string };

export function FgtsAdvanceSimulator({ today, context = "ferramenta" }: { today: string; context?: "ferramenta" | "artigo" }) {
  const uid = useId();
  const id = (n: string) => `${uid}-${n}`;
  const [mode, setMode] = useState<Mode>("simular");
  const [sim, setSim] = useState<SimFields>(() => ({
    balance: "",
    birthMonth: "",
    rate: "",
    rateUnit: "am",
    count: advanceRulesAt(today)?.maxSaques ?? 3,
    simDate: today,
    adhesion: "",
    already: "",
  }));
  const [offers, setOffers] = useState<OfferFields[]>([EMPTY_OFFER]);
  const [submitted, setSubmitted] = useState(false);
  const [simErrors, setSimErrors] = useState<SimIssue[]>([]);
  const [offerErrors, setOfferErrors] = useState<Array<{ index: number; issues: OfferIssue[] }>>([]);
  const [shown, setShown] = useState<Shown | null>(null);
  const [stale, setStale] = useState(false);
  const [premise, setPremise] = useState<string | null>(null);
  const [copied, setCopied] = useState<"ok" | "falhou" | null>(null);

  const rootRef = useRef<HTMLElement | null>(null);
  const { ref: resultRef, reveal } = useRevealResult();

  const period = advanceRulesAt(sim.simDate);
  const maxSaques = period?.maxSaques ?? 3;

  // A página pode ter sido gerada ontem: a data que vale é a do relógio da pessoa.
  const syncToday = useEffectEvent(() => {
    const now = todayInBrazil();
    if (now !== today && sim.simDate === today) {
      const max = advanceRulesAt(now)?.maxSaques ?? 3;
      setSim((s) => ({ ...s, simDate: now, count: Math.min(s.count, max) }));
    }
  });
  useEffect(() => {
    // Fora do corpo do efeito: a troca de data é um evento do relógio, não da renderização.
    const timer = window.setTimeout(syncToday, 0);
    track("fgts_advance_view", { context });
    return () => window.clearTimeout(timer);
  }, [context]);

  function computeSim(f: SimFields, { announce }: { announce: boolean }) {
    const input = toSimInput(f);
    const o = simulateAdvance(input);
    if (o.kind === "invalid") {
      setSimErrors(o.errors);
      setStale(shown !== null);
      return;
    }
    setSimErrors([]);
    setStale(false);
    setShown({ mode: "simular", result: o.result, input, fields: f });
    if (announce) {
      track("fgts_advance_calculated", { context, mode: "simular", count: input.count, offers: 0, cet_informed: false, rate_unit: input.rateUnit });
    }
  }

  function computeOffers(list: OfferFields[], f: SimFields, { announce }: { announce: boolean }) {
    const birthMonth = f.birthMonth === "" ? Number.NaN : Number(f.birthMonth);
    const monthError = !(birthMonth >= 1 && birthMonth <= 12);
    const dateError = advanceRulesAt(f.simDate) === null;
    const outcomes = list.map((o) =>
      analyzeOffer(
        {
          receivedCents: money(o.received),
          count: intOf(o.count),
          cededTotalCents: money(o.ceded),
          monthlyRatePercent: optPct(o.rate),
          cetAnnualPercent: optPct(o.cet),
        },
        birthMonth,
        f.simDate,
      ),
    );
    const bad = outcomes.flatMap((o, index) => (o.kind === "invalid" ? [{ index, issues: o.errors }] : []));
    const shared: SimIssue[] = [
      ...(monthError ? [{ field: "birthMonth" as const, message: "Escolha o mês de aniversário: ele define as datas dos repasses." }] : []),
      ...(dateError ? [{ field: "simDate" as const, message: "Informe uma data a partir de 01/11/2025." }] : []),
    ];
    setSimErrors(shared);
    if (bad.length > 0 || shared.length > 0) {
      setOfferErrors(bad);
      setStale(shown !== null);
      return;
    }
    const analyses = outcomes.map((o) => (o as { kind: "ok"; analysis: OfferAnalysis }).analysis);
    setOfferErrors([]);
    setStale(false);
    setShown({ mode: "proposta", analyses, names: list.map((o, i) => o.institution.trim() || LABELS[i]!), simDate: f.simDate });
    if (announce) {
      track("fgts_advance_calculated", {
        context,
        mode: "proposta",
        count: analyses[0]!.count,
        offers: analyses.length,
        cet_informed: analyses.some((a) => a.cetAnnualPercent !== null),
        rate_unit: "am",
      });
      if (analyses.length > 1) track("fgts_advance_offer_compared", { context, offers: analyses.length });
    }
  }

  function recompute(next: { sim?: SimFields; offers?: OfferFields[]; mode?: Mode }) {
    if (!submitted) return;
    const m = next.mode ?? mode;
    if (m === "simular") computeSim(next.sim ?? sim, { announce: false });
    else computeOffers(next.offers ?? offers, next.sim ?? sim, { announce: false });
  }

  function updateSim(patch: Partial<SimFields>) {
    const merged = { ...sim, ...patch };
    const max = advanceRulesAt(merged.simDate)?.maxSaques ?? 3;
    const next = { ...merged, count: Math.min(merged.count, max) };
    setSim(next);
    setPremise(null);
    recompute({ sim: next });
  }

  function setCount(n: number) {
    if (n === sim.count) return;
    track("fgts_advance_period_changed", { context, count: n });
    updateSim({ count: n });
  }

  function updateOffer(index: number, patch: Partial<OfferFields>) {
    const next = offers.map((o, i) => (i === index ? { ...o, ...patch } : o));
    setOffers(next);
    recompute({ offers: next });
  }

  function addOffer() {
    if (offers.length >= 3) return;
    setOffers([...offers, EMPTY_OFFER]);
  }

  function removeOffer(index: number) {
    const next = offers.filter((_, i) => i !== index);
    setOffers(next);
    recompute({ offers: next });
  }

  function switchMode(m: Mode) {
    if (m === mode) return;
    track("fgts_advance_mode_select", { context, mode: m });
    setMode(m);
    setShown(null);
    setSubmitted(false);
    setSimErrors([]);
    setOfferErrors([]);
    setPremise(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (mode === "simular") computeSim(sim, { announce: true });
    else computeOffers(offers, sim, { announce: true });
    reveal();
  }

  /** "Já recebeu uma proposta?" — leva os números da simulação para o outro modo. */
  function compareWithOffer(result: SimulationResult) {
    track("fgts_advance_internal_cta_clicked", { context, target: "proposta" });
    setMode("proposta");
    setShown(null);
    setSubmitted(false);
    setOfferErrors([]);
    setOffers([{ ...EMPTY_OFFER, count: String(result.priced.rows.length), ceded: moneyInput(result.priced.nominalCents) }]);
    rootRef.current?.scrollIntoView({ block: "start" });
  }

  function applyRate(monthlyPercent: number, reductionPp: number) {
    track("fgts_advance_rate_scenario", { context, reduction: reductionPp });
    const next = { ...sim, rate: pct(monthlyPercent), rateUnit: "am" as const };
    setSim(next);
    computeSim(next, { announce: false });
  }

  function prefill(d: FgtsPrefillDetail) {
    track("fgts_advance_example_select", { context, example: d.exampleId });
    const max = advanceRulesAt(sim.simDate)?.maxSaques ?? 3;
    const next: SimFields = {
      ...sim,
      balance: moneyInput(d.balanceCents),
      birthMonth: String(d.birthMonth),
      rate: pct(d.monthlyRatePercent),
      rateUnit: "am",
      count: Math.min(d.count, max),
    };
    setMode("simular");
    setSim(next);
    setSubmitted(true);
    setOfferErrors([]);
    setPremise(`Exemplo educativo, com taxa hipotética de ${pct(d.monthlyRatePercent)}% ao mês — não é taxa de nenhuma instituição. Troque pelos números da sua proposta.`);
    computeSim(next, { announce: true });
    rootRef.current?.scrollIntoView({ block: "start" });
    reveal();
  }
  const onPrefill = useEffectEvent((d: FgtsPrefillDetail) => prefill(d));
  useEffect(() => {
    const listener = (e: Event) => onPrefill((e as CustomEvent<FgtsPrefillDetail>).detail);
    window.addEventListener(FGTS_PREFILL_EVENT, listener);
    return () => window.removeEventListener(FGTS_PREFILL_EVENT, listener);
  }, []);

  async function copySummary() {
    if (!shown) return;
    const lines: string[] = [];
    if (shown.mode === "simular") {
      const r = shown.result;
      lines.push(
        `Simulação de antecipação do Saque-Aniversário (${formatIsoDate(shown.input.simDate)})`,
        `Saque-Aniversário calculado (${r.firstYear}): ${brl(r.firstSaqueCents)}`,
        `Saques antecipados: ${r.priced.rows.length} (até ${r.period.maxSaques} pelas regras desta data)`,
        ...r.priced.rows.map((row) => `  ${row.year} (repasse estimado em ${formatIsoDate(row.date)}): ${brl(row.cededCents)}`),
        `Direitos futuros cedidos: ${brl(r.priced.nominalCents)}`,
        `Valor estimado recebido hoje: ${brl(r.priced.presentCents)} (taxa de ${pct(r.monthlyPercent)}% a.m.)`,
        `Diferença: ${brl(r.priced.differenceCents)}`,
      );
    } else {
      shown.analyses.forEach((a, i) => {
        lines.push(
          `${shown.names[i]}: recebe ${brl(a.receivedCents)} hoje; cede ${a.count} saques, ${brl(a.cededTotalCents)}; diferença ${brl(a.differenceCents)}; CET ${a.cetAnnualPercent !== null ? `${pct(a.cetAnnualPercent)}% a.a.` : "não informado"}.`,
        );
      });
    }
    lines.push("Estimativa educativa — o valor real depende do saldo oficial, da data, das regras vigentes, da taxa/CET e da metodologia da instituição.");
    lines.push("Crédito por Perto — https://www.creditoporperto.com/calculadoras/antecipacao-fgts/");
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied("ok");
      track("fgts_advance_copy", { context });
    } catch {
      setCopied("falhou");
    }
    setTimeout(() => setCopied(null), 4000);
  }

  const simErrorOf = (field: SimField) => simErrors.find((e) => e.field === field)?.message;
  const offerErrorOf = (index: number, field: OfferField) =>
    offerErrors.find((e) => e.index === index)?.issues.find((i) => i.field === field)?.message;
  const errorCount = simErrors.length + offerErrors.reduce((n, e) => n + e.issues.length, 0);
  const change = nextAdvanceChange(sim.simDate);

  const Title = context === "artigo" ? "h3" : "h2";
  const Sub = context === "artigo" ? "h4" : "h3";

  const monthSelect = (
    <div>
      <label htmlFor={id("mes")} className="block text-sm font-semibold text-brand-navy">
        Mês do seu aniversário
      </label>
      <p id={id("mes-hint")} className="mt-0.5 text-xs leading-relaxed text-brand-muted">
        É quando cada saque é repassado à instituição.
      </p>
      <select
        id={id("mes")}
        value={sim.birthMonth}
        onChange={(e) => updateSim({ birthMonth: e.target.value })}
        aria-invalid={Boolean(simErrorOf("birthMonth"))}
        aria-describedby={[`${id("mes-hint")}`, simErrorOf("birthMonth") ? `${id("mes")}-erro` : null].filter(Boolean).join(" ")}
        className={`${inputClass} mt-1.5`}
      >
        <option value="">Escolha o mês</option>
        {MONTHS.map((m, i) => (
          <option key={m} value={String(i + 1)}>
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </option>
        ))}
      </select>
      {simErrorOf("birthMonth") ? (
        <p id={`${id("mes")}-erro`} className="mt-1.5 text-sm font-medium text-brand-danger">
          {simErrorOf("birthMonth")}
        </p>
      ) : null}
    </div>
  );

  return (
    <section
      ref={rootRef}
      id="simulador"
      aria-label="Simulador de antecipação do Saque-Aniversário"
      className="scroll-mt-24 rounded-2xl border border-brand-border bg-white p-3 shadow-sm sm:p-6"
    >
      <Segmented
        label="Como você quer usar o simulador"
        value={mode}
        onChange={switchMode}
        wide
        options={[
          { value: "simular", label: "Quero simular" },
          { value: "proposta", label: "Já tenho uma proposta" },
        ]}
      />
      <p className="mt-2 text-xs text-brand-muted">
        {mode === "simular"
          ? "Uma estimativa a partir do saldo, do mês de aniversário e da taxa. Não é proposta de nenhuma instituição."
          : "Use os números que a instituição mostrou: o valor que você recebe e os saques que cede."}
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-5">
        {mode === "simular" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id={id("saldo")}
              label="Saldo total do FGTS"
              hint="Some as contas. Use o saldo total mostrado no app FGTS, se souber."
              prefix="R$"
              placeholder="ex.: 10.000"
              value={sim.balance}
              error={simErrorOf("balanceCents")}
              onChange={(balance) => updateSim({ balance })}
              onBlur={() => setSim((s) => ({ ...s, balance: tidyMoney(s.balance) }))}
            />
            {monthSelect}
            <div>
              <label htmlFor={id("taxa")} className="block text-sm font-semibold text-brand-navy">
                Taxa da antecipação
              </label>
              <p id={id("taxa-hint")} className="mt-0.5 text-xs leading-relaxed text-brand-muted">
                Consulte a taxa na proposta da instituição.
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <input
                  id={id("taxa")}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="ex.: 1,5"
                  value={sim.rate}
                  onChange={(e) => updateSim({ rate: e.target.value })}
                  aria-invalid={Boolean(simErrorOf("rate"))}
                  aria-describedby={[id("taxa-hint"), simErrorOf("rate") ? `${id("taxa")}-erro` : null].filter(Boolean).join(" ")}
                  className={`${inputClass} max-w-[9rem]`}
                />
                <span className="text-sm text-brand-muted" aria-hidden="true">%</span>
                <Segmented label="Unidade da taxa" value={sim.rateUnit} onChange={(rateUnit) => updateSim({ rateUnit })} options={[{ value: "am", label: "ao mês" }, { value: "aa", label: "ao ano" }]} />
              </div>
              {simErrorOf("rate") ? (
                <p id={`${id("taxa")}-erro`} className="mt-1.5 text-sm font-medium text-brand-danger">
                  {simErrorOf("rate")}
                </p>
              ) : null}
            </div>
            <div>
              <p id={id("qtd-label")} className="block text-sm font-semibold text-brand-navy">
                Quantos saques quer antecipar?
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-brand-muted">
                Até {maxSaques} pelas regras de {formatIsoDate(sim.simDate)}.
              </p>
              <div className="mt-1.5">
                <Segmented
                  labelledBy={id("qtd-label")}
                  value={sim.count}
                  onChange={setCount}
                  options={Array.from({ length: maxSaques }, (_, i) => ({ value: i + 1, label: String(i + 1) }))}
                />
              </div>
              {simErrorOf("count") ? <p className="mt-1.5 text-sm font-medium text-brand-danger">{simErrorOf("count")}</p> : null}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">{monthSelect}</div>
            {offers.map((o, i) => (
              <fieldset key={i} className={offers.length > 1 ? "rounded-xl border border-brand-border p-3 sm:p-4" : ""}>
                {offers.length > 1 ? (
                  <legend className="px-1 text-sm font-bold text-brand-navy">
                    {LABELS[i]}
                    {i > 0 ? (
                      <button type="button" onClick={() => removeOffer(i)} className="ml-3 min-h-11 px-2 text-xs font-semibold text-brand-muted underline">
                        remover
                      </button>
                    ) : null}
                  </legend>
                ) : null}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id={id(`rec-${i}`)} label="Valor que você recebe hoje" prefix="R$" placeholder="ex.: 1.450" value={o.received} error={offerErrorOf(i, "receivedCents")} onChange={(received) => updateOffer(i, { received })} onBlur={() => updateOffer(i, { received: tidyMoney(o.received) })} />
                  <Field id={id(`qtd-${i}`)} label="Quantos saques são cedidos" placeholder="ex.: 5" numeric value={o.count} error={offerErrorOf(i, "count")} onChange={(count) => updateOffer(i, { count })} />
                  <Field id={id(`ced-${i}`)} label="Soma dos saques cedidos" hint="O total que o FGTS vai repassar à instituição." prefix="R$" placeholder="ex.: 2.500" value={o.ceded} error={offerErrorOf(i, "cededTotalCents")} onChange={(ceded) => updateOffer(i, { ceded })} onBlur={() => updateOffer(i, { ceded: tidyMoney(o.ceded) })} />
                  <Field id={id(`tx-${i}`)} label="Taxa informada (opcional)" suffix="% a.m." placeholder="da proposta" value={o.rate} error={offerErrorOf(i, "monthlyRatePercent")} onChange={(rate) => updateOffer(i, { rate })} />
                  <Field id={id(`cet-${i}`)} label="CET informado (opcional)" suffix="% a.a." placeholder="da proposta" value={o.cet} error={offerErrorOf(i, "cetAnnualPercent")} onChange={(cet) => updateOffer(i, { cet })} />
                  <div>
                    <label htmlFor={id(`inst-${i}`)} className="block text-sm font-semibold text-brand-navy">
                      Nome para identificar (opcional)
                    </label>
                    <input id={id(`inst-${i}`)} type="text" autoComplete="off" maxLength={40} placeholder={LABELS[i]} value={o.institution} onChange={(e) => updateOffer(i, { institution: e.target.value })} className={`${inputClass} mt-1.5`} />
                  </div>
                </div>
              </fieldset>
            ))}
            {offers.length < 3 ? (
              <button type="button" onClick={addOffer} className="min-h-11 rounded-lg border border-dashed border-brand-navy px-4 text-sm font-semibold text-brand-navy">
                + Adicionar outra proposta para comparar
              </button>
            ) : null}
          </div>
        )}

        <details
          className="mt-5 rounded-lg border border-brand-border"
          onToggle={(e) => {
            if ((e.currentTarget as HTMLDetailsElement).open) track("fgts_advance_rules_opened", { context });
          }}
        >
          <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-semibold text-brand-navy">
            Carência, data da simulação e antecipação anterior (opcional)
          </summary>
          <div className="grid gap-4 border-t border-brand-border p-4 sm:grid-cols-2">
            <div>
              <label htmlFor={id("adesao")} className="block text-sm font-semibold text-brand-navy">
                Quando você aderiu ao Saque-Aniversário?
              </label>
              <p className="mt-0.5 text-xs text-brand-muted">Para conferir a carência de {ADVANCE_RULES.waitingDays} dias.</p>
              <input id={id("adesao")} type="date" value={sim.adhesion} onChange={(e) => updateSim({ adhesion: e.target.value })} className={`${inputClass} mt-1.5`} />
            </div>
            <div>
              <label htmlFor={id("data")} className="block text-sm font-semibold text-brand-navy">
                Data da simulação
              </label>
              <p className="mt-0.5 text-xs text-brand-muted">Hoje, por padrão. A regra aplicada acompanha a data.</p>
              <input
                id={id("data")}
                type="date"
                min="2025-11-01"
                value={sim.simDate}
                onChange={(e) => e.target.value && updateSim({ simDate: e.target.value })}
                aria-invalid={Boolean(simErrorOf("simDate"))}
                className={`${inputClass} mt-1.5`}
              />
              {simErrorOf("simDate") ? <p className="mt-1.5 text-sm font-medium text-brand-danger">{simErrorOf("simDate")}</p> : null}
            </div>
            <div className="sm:col-span-2">
              <p id={id("ja-label")} className="text-sm font-semibold text-brand-navy">
                Você já antecipou algum Saque-Aniversário que ainda não foi repassado?
              </p>
              <div className="mt-1.5">
                <Segmented labelledBy={id("ja-label")} value={sim.already} onChange={(already) => updateSim({ already })} options={[{ value: "sim", label: "Sim" }, { value: "nao", label: "Não" }, { value: "nao-sei", label: "Não sei" }]} />
              </div>
            </div>
          </div>
        </details>

        {errorCount > 0 ? (
          <p role="alert" className="mt-4 rounded-lg border border-brand-danger/40 bg-brand-danger-soft p-3 text-sm text-brand-danger">
            {errorCount === 1 ? "Um campo precisa de ajuste — ele está destacado acima." : "Alguns campos precisam de ajuste — eles estão destacados acima."}
          </p>
        ) : null}

        <button type="submit" className="mt-5 min-h-12 w-full rounded-lg bg-brand-teal-dark px-6 font-semibold text-white hover:bg-brand-teal sm:w-auto">
          {mode === "simular" ? "Simular antecipação" : offers.length > 1 ? "Comparar propostas" : "Analisar proposta"}
        </button>
        <p className="mt-3 text-xs text-brand-muted">Sem cadastro · Sem CPF · Simulação educativa · Nada do que você digita sai do seu aparelho.</p>
      </form>

      <p aria-live="polite" className="sr-only">
        {shown && !stale
          ? shown.mode === "simular"
            ? `Valor estimado recebido hoje: ${brl(shown.result.priced.presentCents)}, por ${brl(shown.result.priced.nominalCents)} em saques futuros cedidos.`
            : shown.analyses.map((a, i) => `${shown.names[i]}: recebe ${brl(a.receivedCents)}, cede ${brl(a.cededTotalCents)}.`).join(" ")
          : ""}
      </p>

      <div ref={resultRef} className="scroll-mt-24">
        {shown ? (
          <div className={`mt-6 border-t border-brand-border pt-6 ${stale ? "opacity-60" : ""}`}>
            {premise ? <p className="mb-4 rounded-lg bg-brand-gold-soft px-3 py-2 text-sm text-brand-gold-dark">{premise}</p> : null}
            {stale ? <p className="mb-4 text-sm font-medium text-brand-warning">Resultado da última simulação válida. Ajuste o campo destacado para atualizar.</p> : null}

            {shown.mode === "simular" ? (
              <SimulationView
                shown={shown}
                Title={Title}
                Sub={Sub}
                onCount={setCount}
                onRate={applyRate}
                onCompare={() => compareWithOffer(shown.result)}
                context={context}
              />
            ) : (
              <OffersView analyses={shown.analyses} names={shown.names} simDate={shown.simDate} Title={Title} Sub={Sub} />
            )}

            <ExtraNotes fields={sim} Sub={Sub} change={change} />

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button type="button" onClick={copySummary} className="min-h-11 rounded-lg border border-brand-border px-4 font-semibold text-brand-navy">
                {shown.mode === "simular" ? "Copiar simulação" : "Copiar comparação"}
              </button>
              <span role="status" className="text-sm text-brand-muted">
                {copied === "ok" ? "Copiado. O texto fica só no seu aparelho." : copied === "falhou" ? "Não foi possível copiar." : ""}
              </span>
            </div>

            <p className="mt-6 rounded-lg border border-brand-warning/40 bg-brand-warning-soft p-3 text-sm leading-relaxed text-brand-warning">
              Esta ferramenta oferece uma estimativa educativa. O valor real depende do saldo oficial do FGTS, da data da
              contratação, das regras vigentes, da taxa/CET e da metodologia da instituição financeira. Consulte o app FGTS e a
              proposta antes de contratar.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* ---------- resultado da simulação ---------- */

function SimulationView({
  shown,
  Title,
  Sub,
  onCount,
  onRate,
  onCompare,
  context,
}: {
  shown: Extract<Shown, { mode: "simular" }>;
  Title: "h2" | "h3";
  Sub: "h3" | "h4";
  onCount: (n: number) => void;
  onRate: (monthlyPercent: number, reductionPp: number) => void;
  onCompare: () => void;
  context: "ferramenta" | "artigo";
}) {
  const r = shown.result;
  const p = r.priced;
  const b = bracketFor(shown.input.balanceCents);
  const firstBase = balanceForSaqueCents(r.firstCedibleCents);
  const lastYear = p.rows.at(-1)?.year;
  const cta = (target: string) => () => trackCta(context, target);

  if (p.rows.length === 0) {
    return (
      <div>
        <Title data-result-heading tabIndex={-1} className="font-serif text-2xl font-bold text-brand-navy outline-none">
          Sua simulação
        </Title>
        <p className="mt-3 rounded-lg bg-brand-warning-soft p-3 text-sm text-brand-warning">
          Com esse saldo, o Saque-Aniversário calculado ({brl(r.firstSaqueCents)}) fica abaixo do mínimo de{" "}
          {brl(ADVANCE_RULES.minPerSaqueCents)} por saque que pode ser antecipado. Pelas regras vigentes, não há saque para
          ceder.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Sua simulação · {formatIsoDate(shown.input.simDate)}</p>
      <Title data-result-heading tabIndex={-1} className="mt-1 font-serif text-2xl font-bold text-brand-navy outline-none">
        Você recebe hoje cerca de {brl(p.presentCents)}
      </Title>

      {/* Assinatura: o número que aparece e o que quase ninguém olha. */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-brand-teal-soft p-4">
          <p className="text-xs font-semibold text-brand-muted">O número que aparece</p>
          <p className="mt-1 text-sm text-brand-text">Você recebe hoje</p>
          <p className="text-xl font-bold tabular-nums text-brand-navy">{brl(p.presentCents)}</p>
        </div>
        <div className="rounded-xl bg-brand-gold-soft p-4">
          <p className="text-xs font-semibold text-brand-muted">O número que quase ninguém olha</p>
          <p className="mt-1 text-sm text-brand-text">Você cede dos próximos Saques-Aniversário</p>
          <p className="text-xl font-bold tabular-nums text-brand-navy">{brl(p.nominalCents)}</p>
        </div>
        <div className="rounded-xl border border-brand-border p-4">
          <p className="text-xs font-semibold text-brand-muted">A diferença</p>
          <p className="mt-1 text-sm text-brand-text">Custo acima do valor recebido</p>
          <p className="text-xl font-bold tabular-nums text-brand-navy">{brl(p.differenceCents)}</p>
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-brand-text">
        Com {pct(r.monthlyPercent)}% ao mês ({pct(r.annualPercent, 1)}% ao ano equivalente), os {brl(p.nominalCents)} dos
        saques futuros correspondem a aproximadamente {brl(p.presentCents)} hoje.
      </p>

      {/* A cadeia inteira, do saldo ao dinheiro de hoje. */}
      <Sub className="mt-6 font-serif text-lg font-bold text-brand-navy">Do saldo ao dinheiro de hoje</Sub>
      <dl className="mt-2">
        <Row label="Saldo informado no FGTS" value={brl(shown.input.balanceCents)} />
        <Row
          label={`Saque-Aniversário calculado (${r.firstYear})`}
          note={`${pct(b.rate * 100, 0)}% do saldo${b.addCents > 0 ? ` + ${brl(b.addCents)} de parcela adicional` : ""}`}
          value={brl(r.firstSaqueCents)}
        />
        <Row
          label="Valor que pode ser cedido por saque"
          note={`a regra vai de ${brl(ADVANCE_RULES.minPerSaqueCents)} a ${brl(ADVANCE_RULES.maxPerSaqueCents)} por saque`}
          value={brl(r.firstCedibleCents)}
        />
        <Row label="Saques antecipados nesta simulação" note={`até ${r.period.maxSaques} pelas regras de ${formatIsoDate(shown.input.simDate)}`} value={String(p.rows.length)} />
        <Row label="Direitos futuros cedidos" value={brl(p.nominalCents)} />
        <Row label="Taxa informada" value={`${pct(r.monthlyPercent)}% a.m.`} />
        <Row label="Valor estimado recebido hoje" value={brl(p.presentCents)} strong />
        <Row label="Diferença financeira" note="não é só juros: a proposta real tem IOF e pode ter tarifas" value={brl(p.differenceCents)} />
      </dl>
      {r.projection.belowMinimum > 0 ? (
        <p role="note" className="mt-3 rounded-lg bg-brand-warning-soft p-3 text-sm text-brand-warning">
          Você pediu {saquesLabel(shown.input.count)}, mas {r.projection.belowMinimum === 1 ? "o último ficaria" : `os últimos ${r.projection.belowMinimum} ficariam`} abaixo de{" "}
          {brl(ADVANCE_RULES.minPerSaqueCents)} com o saldo projetado — e saque abaixo do mínimo não pode ser antecipado.
        </p>
      ) : null}
      {r.rateWarning ? (
        <p role="note" className="mt-3 rounded-lg bg-brand-warning-soft p-3 text-sm text-brand-warning">
          A taxa de {pct(r.monthlyPercent)}% ao mês está alta para esse tipo de operação. Confira se o número foi copiado certo e se é
          ao mês.
        </p>
      ) : null}

      {/* Hoje x futuro */}
      <Sub className="mt-6 font-serif text-lg font-bold text-brand-navy">Hoje × futuro</Sub>
      <ol className="mt-3 space-y-0" aria-label="Linha do tempo: o que você recebe hoje e o que o FGTS repassa depois">
        <li className="relative border-l-4 border-brand-teal pb-4 pl-4">
          <p className="text-sm font-bold text-brand-navy">Hoje · {formatIsoDate(shown.input.simDate)}</p>
          <p className="text-sm text-brand-text">
            Você recebe cerca de <strong className="tabular-nums">{brl(p.presentCents)}</strong>
          </p>
        </li>
        {p.rows.map((row) => (
          <li key={row.year} className="relative border-l-4 border-brand-gold pb-4 pl-4 last:pb-0">
            <p className="text-sm font-bold text-brand-navy">
              Aniversário de {row.year} · repasse estimado em {formatIsoDate(row.date)}
            </p>
            <p className="text-sm text-brand-text">
              O FGTS repassa <strong className="tabular-nums">{brl(row.cededCents)}</strong> à instituição
              <span className="text-brand-muted"> — hoje equivalem a {brl(Math.round(row.presentCents))}</span>
            </p>
          </li>
        ))}
      </ol>

      {/* Desconto por saque */}
      <Sub className="mt-6 font-serif text-lg font-bold text-brand-navy">Quanto mais longe o saque, menos ele vale hoje</Sub>
      <ul className="mt-2 divide-y divide-brand-border rounded-xl border border-brand-border sm:hidden" aria-label="Desconto por saque">
        {p.rows.map((row) => (
          <li key={row.year} className="p-3 text-sm">
            <p className="font-semibold text-brand-navy">{row.index}º saque ({row.year})</p>
            <p className="flex justify-between gap-3"><span className="text-brand-muted">Valor cedido</span><span className="tabular-nums">{brl(row.cededCents)}</span></p>
            <p className="flex justify-between gap-3"><span className="text-brand-muted">Tempo até o repasse</span><span>{timeLabel(row.days)}</span></p>
            <p className="flex justify-between gap-3"><span className="text-brand-muted">Valor hoje, aproximado</span><span className="font-semibold tabular-nums">{brl(Math.round(row.presentCents))}</span></p>
          </li>
        ))}
      </ul>
      <div className="mt-2 hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <caption className="sr-only">Desconto por saque</caption>
          <thead>
            <tr className="border-b border-brand-border text-left text-brand-muted">
              <th scope="col" className="py-2 pr-3 font-semibold">Saque</th>
              <th scope="col" className="py-2 pr-3 font-semibold">Repasse estimado</th>
              <th scope="col" className="py-2 pr-3 font-semibold">Tempo até o repasse</th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">Valor cedido</th>
              <th scope="col" className="py-2 text-right font-semibold">Valor hoje, aproximado</th>
            </tr>
          </thead>
          <tbody>
            {p.rows.map((row) => (
              <tr key={row.year} className="border-b border-brand-border">
                <th scope="row" className="py-2 pr-3 text-left font-semibold text-brand-navy">{row.index}º ({row.year})</th>
                <td className="py-2 pr-3">{formatIsoDate(row.date)}</td>
                <td className="py-2 pr-3">{timeLabel(row.days)}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{brl(row.cededCents)}</td>
                <td className="py-2 text-right font-semibold tabular-nums">{brl(Math.round(row.presentCents))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Quantidade de saques */}
      {r.byCount.length > 1 ? (
        <>
          <Sub className="mt-6 font-serif text-lg font-bold text-brand-navy">Quanto muda se antecipar menos saques?</Sub>
          <ul className="mt-2 divide-y divide-brand-border rounded-xl border border-brand-border sm:hidden" aria-label="Comparação por quantidade de saques">
            {r.byCount.map((c) => (
              <li key={c.count} className={`p-3 text-sm ${c.count === p.rows.length ? "bg-brand-teal-soft" : ""}`}>
                <p className="font-semibold text-brand-navy">
                  {saquesLabel(c.count)}
                  {c.count === p.rows.length ? <span className="ml-2 text-xs font-normal text-brand-muted">(sua simulação)</span> : null}
                </p>
                <p className="flex justify-between gap-3"><span className="text-brand-muted">Recebe hoje</span><span className="font-semibold tabular-nums">{brl(c.priced.presentCents)}</span></p>
                <p className="flex justify-between gap-3"><span className="text-brand-muted">Direitos cedidos</span><span className="tabular-nums">{brl(c.priced.nominalCents)}</span></p>
                <p className="flex justify-between gap-3"><span className="text-brand-muted">Diferença</span><span className="tabular-nums">{brl(c.priced.differenceCents)}</span></p>
                <p className="flex justify-between gap-3"><span className="text-brand-muted">Último ano comprometido</span><span>{c.lastYear}</span></p>
              </li>
            ))}
          </ul>
          <div className="mt-2 hidden overflow-x-auto sm:block">
            <table className="w-full text-sm">
              <caption className="sr-only">Comparação por quantidade de saques</caption>
              <thead>
                <tr className="border-b border-brand-border text-left text-brand-muted">
                  <th scope="col" className="py-2 pr-3 font-semibold"><span className="sr-only">Métrica</span></th>
                  {r.byCount.map((c) => (
                    <th key={c.count} scope="col" className={`py-2 pr-3 text-right font-semibold ${c.count === p.rows.length ? "text-brand-navy" : ""}`}>
                      {saquesLabel(c.count)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Recebe hoje", v: (c: (typeof r.byCount)[number]) => brl(c.priced.presentCents) },
                  { label: "Direitos cedidos", v: (c: (typeof r.byCount)[number]) => brl(c.priced.nominalCents) },
                  { label: "Diferença", v: (c: (typeof r.byCount)[number]) => brl(c.priced.differenceCents) },
                  { label: "Último ano comprometido", v: (c: (typeof r.byCount)[number]) => String(c.lastYear) },
                ].map((m) => (
                  <tr key={m.label} className="border-b border-brand-border">
                    <th scope="row" className="py-2 pr-3 text-left font-semibold text-brand-navy">{m.label}</th>
                    {r.byCount.map((c) => (
                      <td key={c.count} className={`py-2 pr-3 text-right tabular-nums ${c.count === p.rows.length ? "font-semibold" : ""}`}>{m.v(c)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="mt-3 space-y-1 text-sm leading-relaxed text-brand-text">
            {r.byCount.slice(1).map((c, i) => {
              const prev = r.byCount[i]!;
              // O valor de hoje do próprio saque adicional — o mesmo da linha do tempo.
              const added = c.priced.rows.at(-1)!;
              return (
                <li key={c.count}>
                  Ao antecipar o {c.count}º saque, você recebe hoje mais {brl(Math.round(added.presentCents))}, mas compromete mais{" "}
                  {brl(c.priced.nominalCents - prev.priced.nominalCents)} do Saque-Aniversário de {c.lastYear}.
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-sm text-brand-muted">Simular com:</span>
            {r.byCount.map((c) => (
              <button
                key={c.count}
                type="button"
                aria-pressed={c.count === p.rows.length}
                onClick={() => onCount(c.count)}
                className="min-h-11 min-w-11 rounded-lg border border-brand-border px-3 text-sm font-semibold text-brand-navy aria-pressed:bg-brand-navy aria-pressed:text-white"
              >
                {c.count}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {/* Taxa menor */}
      {r.byRate.length > 0 ? (
        <>
          <Sub className="mt-6 font-serif text-lg font-bold text-brand-navy">E se a taxa for menor?</Sub>
          <p className="mt-1 text-sm text-brand-muted">Cenário matemático, com os mesmos saques — não é oferta de nenhuma instituição.</p>
          <ul className="mt-2 divide-y divide-brand-border rounded-xl border border-brand-border text-sm">
            {r.byRate.map((s) => (
              <li key={s.reductionPp} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <span>
                  {pct(s.monthlyPercent)}% a.m. <span className="text-brand-muted">(−{pct(s.reductionPp)} p.p.)</span>: recebe{" "}
                  <strong className="tabular-nums">{brl(s.presentCents)}</strong>{" "}
                  <span className="text-brand-muted">(+{brl(s.gainCents)})</span>
                </span>
                <button type="button" onClick={() => onRate(s.monthlyPercent, s.reductionPp)} className="min-h-11 rounded-lg border border-brand-border px-3 text-sm font-semibold text-brand-navy">
                  Simular com {pct(s.monthlyPercent)}%
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {/* Premissas do saldo */}
      <div className="mt-6 rounded-xl border border-brand-border p-4 text-sm leading-relaxed text-brand-text">
        <Sub className="font-semibold text-brand-navy">O que esta simulação considera</Sub>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>O saldo de hoje, sem novos depósitos e sem o rendimento do FGTS nos próximos anos.</li>
          <li>O saldo cai, a cada aniversário, pelo Saque-Aniversário inteiro, e o saque do ano seguinte é recalculado pela tabela.</li>
          <li>Cada saque cedido no máximo permitido: o menor entre o saque do ano e {brl(ADVANCE_RULES.maxPerSaqueCents)}. A instituição pode oferecer menos.</li>
          <li>Repasse no {ADVANCE_RULES.transferBusinessDay}º dia útil do mês de aniversário, contando fins de semana e feriados nacionais fixos.</li>
          <li>Desconto composto pela taxa mensal, proporcional aos dias corridos (dias ÷ 30). IOF e tarifas ficam de fora — estão no CET da proposta.</li>
        </ul>
        {r.ifRestStays ? (
          <p className="mt-2 rounded-lg bg-brand-teal-soft p-3">
            Se você não sacar a parte do Saque-Aniversário que não foi cedida, o saldo cai menos: os saques cedidos somariam{" "}
            {brl(r.ifRestStays.nominalCents)}, e o valor estimado hoje seria {brl(r.ifRestStays.presentCents)}.
          </p>
        ) : null}
      </div>

      {/* O que fica comprometido */}
      <div className="mt-6 rounded-xl border border-brand-border p-4 text-sm leading-relaxed text-brand-text">
        <Sub className="font-semibold text-brand-navy">O que fica comprometido no FGTS</Sub>
        <p className="mt-1">
          Os Saques-Aniversário de {p.rows[0]!.year}
          {lastYear && lastYear !== p.rows[0]!.year ? ` a ${lastYear}` : ""} ficam vinculados à operação. {ADVANCE_RULES.summaries.blocking}
        </p>
        {firstBase ? (
          <p className="mt-2">
            Pela tabela, é preciso um saldo de {brl(firstBase)} para gerar um Saque-Aniversário de {brl(r.firstCedibleCents)}. O valor
            efetivamente bloqueado é determinado pelo sistema do FGTS conforme a garantia da operação e pode ser diferente do valor
            recebido — a simulação não o calcula.
          </p>
        ) : null}
        <p className="mt-2">{TERMINATION_RULES.returnToRescisao}</p>
      </div>

      {/* Próximos passos */}
      <div className="mt-6 space-y-3 text-sm">
        <p>
          <span className="text-brand-muted">Já recebeu uma proposta?</span>{" "}
          <button type="button" onClick={onCompare} className="font-semibold text-brand-teal underline underline-offset-2">
            Comparar com esta simulação
          </button>
        </p>
        <p>
          <span className="text-brand-muted">Quer entender os riscos antes de antecipar?</span>{" "}
          <Link href="/emprestimos/antecipacao-saque-aniversario-fgts/" onClick={cta("artigo")} className="font-semibold text-brand-teal underline underline-offset-2">
            Leia o guia sobre antecipação do Saque-Aniversário
          </Link>
        </p>
        <p>
          <span className="text-brand-muted">A proposta traz a taxa ao ano?</span>{" "}
          <Link href="/calculadoras/conversor-de-taxas/" onClick={cta("conversor")} className="font-semibold text-brand-teal underline underline-offset-2">
            Converta para ao mês, por equivalência
          </Link>
        </p>
      </div>
    </div>
  );
}

function trackCta(context: "ferramenta" | "artigo", target: string) {
  track("fgts_advance_internal_cta_clicked", { context, target });
}

/* ---------- propostas ---------- */

function OffersView({ analyses, names, simDate, Title, Sub }: { analyses: OfferAnalysis[]; names: string[]; simDate: string; Title: "h2" | "h3"; Sub: "h3" | "h4" }) {
  const criteria = compareOffers(analyses);
  const period = advanceRulesAt(simDate);
  const badges = (i: number) => criteria.filter((c) => c.available && c.holders.includes(i)).map((c) => c.label);
  const implicit = (a: OfferAnalysis) =>
    a.implicitMonthlyPercent === null ? "—" : `${pct(a.implicitMonthlyPercent)}% a.m. (${pct(a.implicitAnnualPercent!, 1)}% a.a.)`;
  const metrics: Array<{ label: string; v: (a: OfferAnalysis) => string }> = [
    { label: "Valor recebido hoje", v: (a) => brl(a.receivedCents) },
    { label: "Saques cedidos", v: (a) => String(a.count) },
    { label: "Direitos futuros cedidos", v: (a) => brl(a.cededTotalCents) },
    { label: "Diferença financeira", v: (a) => brl(a.differenceCents) },
    { label: "Taxa informada", v: (a) => (a.monthlyRatePercent !== null ? `${pct(a.monthlyRatePercent)}% a.m.` : "não informada") },
    { label: "Taxa implícita aproximada", v: implicit },
    { label: "CET informado", v: (a) => (a.cetAnnualPercent !== null ? `${pct(a.cetAnnualPercent)}% a.a.` : "não informado") },
  ];

  const notes = (a: OfferAnalysis) => (
    <>
      {a.aboveCountLimit && period ? (
        <p role="note" className="mt-2 rounded-lg bg-brand-warning-soft p-3 text-sm text-brand-warning">
          A proposta cede {a.count} saques; pelas regras de {formatIsoDate(simDate)}, uma nova contratação vai até {period.maxSaques}. Confira a
          data e as condições com a instituição.
        </p>
      ) : null}
      {a.aboveValueLimit ? (
        <p role="note" className="mt-2 rounded-lg bg-brand-warning-soft p-3 text-sm text-brand-warning">
          A média por saque passa de {brl(ADVANCE_RULES.maxPerSaqueCents)}, o máximo por saque cedido nas regras vigentes. Confira os valores.
        </p>
      ) : null}
      {a.implicitMonthlyPercent !== null && a.monthlyRatePercent !== null && a.implicitMonthlyPercent - a.monthlyRatePercent > 0.05 ? (
        <p className="mt-2 text-xs text-brand-muted">
          A taxa implícita ficou acima da informada. IOF, tarifas ou outra convenção de cálculo podem explicar — o CET reúne esses custos.
        </p>
      ) : null}
    </>
  );

  if (analyses.length === 1) {
    const a = analyses[0]!;
    return (
      <div>
        <Title data-result-heading tabIndex={-1} className="font-serif text-2xl font-bold text-brand-navy outline-none">
          Você recebe {brl(a.receivedCents)} e cede {brl(a.cededTotalCents)}
        </Title>
        <dl className="mt-3">
          <Row label="Você recebe hoje" value={brl(a.receivedCents)} />
          <Row label="Direitos futuros cedidos" note={`${saquesLabel(a.count)} do Saque-Aniversário`} value={brl(a.cededTotalCents)} />
          <Row label="Diferença financeira" note="pode incluir juros, IOF e tarifas" value={brl(a.differenceCents)} strong />
          <Row label="Taxa informada" value={a.monthlyRatePercent !== null ? `${pct(a.monthlyRatePercent)}% a.m.` : "não informada"} />
          <Row label="Taxa efetiva implícita aproximada" note="calculada pelas datas dos repasses; não é o CET" value={implicit(a)} />
          <Row label="CET" value={a.cetAnnualPercent !== null ? `${pct(a.cetAnnualPercent)}% a.a.` : "não informado"} note={a.cetAnnualPercent === null ? "peça o CET à instituição: ele reúne juros, IOF e tarifas" : "informado pela instituição"} />
        </dl>
        {notes(a)}
        <Sub className="mt-6 font-serif text-lg font-bold text-brand-navy">Hoje × futuro</Sub>
        <ol className="mt-3" aria-label="Linha do tempo da proposta">
          <li className="border-l-4 border-brand-teal pb-4 pl-4 text-sm">
            <p className="font-bold text-brand-navy">Hoje · {formatIsoDate(simDate)}</p>
            <p>Você recebe <strong className="tabular-nums">{brl(a.receivedCents)}</strong></p>
          </li>
          {a.flows.map((f) => (
            <li key={f.year} className="border-l-4 border-brand-gold pb-4 pl-4 text-sm last:pb-0">
              <p className="font-bold text-brand-navy">Aniversário de {f.year} · repasse estimado em {formatIsoDate(f.date)}</p>
              <p>O FGTS repassa <strong className="tabular-nums">{brl(f.cents)}</strong></p>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-xs text-brand-muted">
          A linha do tempo divide o total em partes iguais. Se a proposta mostra o valor de cada ano, a taxa implícita real pode ser um pouco
          diferente.
        </p>
      </div>
    );
  }

  return (
    <div>
      <Title data-result-heading tabIndex={-1} className="font-serif text-2xl font-bold text-brand-navy outline-none">
        As propostas lado a lado
      </Title>
      <p className="mt-1 text-sm text-brand-muted">Cada métrica é um fato separado. A ferramenta não escolhe uma proposta.</p>
      <div className="mt-3 space-y-3 sm:hidden">
        {analyses.map((a, i) => (
          <div key={i} className="rounded-xl border border-brand-border p-3">
            <p className="font-semibold text-brand-navy">{names[i]}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {badges(i).map((b) => (
                <span key={b} className="rounded bg-brand-teal-soft px-1.5 py-0.5 text-xs font-semibold text-brand-navy">{b}</span>
              ))}
            </div>
            <dl className="mt-2">
              {metrics.map((m) => (
                <Row key={m.label} label={m.label} value={m.v(a)} />
              ))}
            </dl>
            {notes(a)}
          </div>
        ))}
      </div>
      <div className="mt-3 hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <caption className="sr-only">Comparação das propostas de antecipação</caption>
          <thead>
            <tr className="border-b border-brand-border text-left">
              <th scope="col" className="py-2 pr-3 font-semibold text-brand-muted">Métrica</th>
              {analyses.map((_, i) => (
                <th key={i} scope="col" className="py-2 pr-3 text-right font-semibold text-brand-navy">{names[i]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => (
              <tr key={m.label} className="border-b border-brand-border">
                <th scope="row" className="py-2 pr-3 text-left font-semibold text-brand-navy">{m.label}</th>
                {analyses.map((a, i) => (
                  <td key={i} className="py-2 pr-3 text-right tabular-nums">{m.v(a)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="mt-3 space-y-1 text-sm">
        {criteria.map((c) => (
          <li key={c.key}>
            <span className="font-semibold text-brand-navy">{c.label}:</span>{" "}
            {!c.available
              ? c.key === "menorCet" || c.key === "menorTaxa"
                ? "indisponível — nem todas as propostas informaram."
                : "indisponível."
              : c.holders.length === 0
                ? "empate."
                : c.holders.map((h) => names[h]).join(" e ")}
          </li>
        ))}
      </ul>
      <div className="hidden sm:block">{analyses.map((a, i) => <div key={i}>{notes(a)}</div>)}</div>
    </div>
  );
}

/* ---------- carência, competência e regra da data ---------- */

function ExtraNotes({ fields, Sub, change }: { fields: SimFields; Sub: "h3" | "h4"; change: { from: string; maxSaques: number } | null }) {
  const period = advanceRulesAt(fields.simDate);
  const waiting = fields.adhesion ? waitingPeriod(fields.adhesion, fields.simDate) : null;
  return (
    <>
      {waiting ? (
        <p role="note" className={`mt-6 rounded-lg p-3 text-sm ${waiting.fulfilled ? "bg-brand-teal-soft text-brand-text" : "bg-brand-warning-soft text-brand-warning"}`}>
          {waiting.fulfilled
            ? `Pela data informada, a carência de ${ADVANCE_RULES.waitingDays} dias estaria cumprida desde ${formatIsoDate(waiting.eligibleFrom)}. Outros requisitos ainda podem existir.`
            : `Pela data informada, você poderia autorizar a antecipação a partir de ${formatIsoDate(waiting.eligibleFrom)} (faltam ${waiting.daysLeft} dias). A quantidade de saques permitida depende da data da contratação.`}
        </p>
      ) : null}
      {fields.already === "sim" || fields.already === "nao-sei" ? (
        <p role="note" className="mt-3 rounded-lg bg-brand-warning-soft p-3 text-sm text-brand-warning">
          {ADVANCE_RULES.summaries.perCompetence}{" "}
          {fields.already === "sim" ? "Os saques já antecipados não entram numa nova operação." : "Confira no app FGTS se algum saque já está vinculado."}{" "}
          {ADVANCE_RULES.summaries.newContract} A simulação não consulta o sistema do FGTS.
        </p>
      ) : null}
      {period ? (
        <div className="mt-6 rounded-xl border border-brand-border p-4 text-sm leading-relaxed text-brand-text">
          <Sub className="font-semibold text-brand-navy">Regra aplicável à data desta simulação ({formatIsoDate(fields.simDate)})</Sub>
          <dl className="mt-2">
            <Row label="Quantidade máxima de saques" value={String(period.maxSaques)} />
            <Row label="Valor por saque cedido" value={`${brl(ADVANCE_RULES.minPerSaqueCents)} a ${brl(ADVANCE_RULES.maxPerSaqueCents)}`} />
            <Row label="Carência após aderir" value={`${ADVANCE_RULES.waitingDays} dias`} />
            <Row label="Repasse à instituição" value={`até o ${ADVANCE_RULES.transferBusinessDay}º dia útil do mês`} />
          </dl>
          {change ? (
            <p className="mt-2">
              Pelas regras vigentes, é possível antecipar até {period.maxSaques} saques até {formatIsoDate(period.to ?? fields.simDate)}. A
              partir de {formatIsoDate(change.from)}, o limite previsto passa a {change.maxSaques}.
            </p>
          ) : null}
          <p className="mt-2 text-xs text-brand-muted">
            Fontes:{" "}
            <a href={ADVANCE_RULES.sources.mte.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Ministério do Trabalho e Emprego</a>
            {" · "}
            <a href={ADVANCE_RULES.sources.resolution.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">FGTS / Conselho Curador</a>
            . Informações verificadas em {ADVANCE_RULES.verifiedAt}.
          </p>
        </div>
      ) : null}
    </>
  );
}
