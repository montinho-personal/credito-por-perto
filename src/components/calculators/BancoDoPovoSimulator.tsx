"use client";

/**
 * SIMULADOR DO BANCO DO POVO PAULISTA (independente, não oficial)
 * ============================================================================
 *
 * Começa pelo que a pessoa sabe responder (perfil, uso do dinheiro, valor) e
 * só depois fala de taxa. Toda regra vem de `bpp-rules.ts`; toda conta, de
 * `bpp-simulator.ts`.
 *
 * DECISÕES QUE NÃO SÃO ÓBVIAS
 *
 * - A taxa não é pedida: a pessoa escolhe entre os dois cenários com base
 *   oficial ou abre "outra taxa". O resultado mostra sempre a parcela nas
 *   duas taxas divulgadas, porque a taxa real só sai na análise.
 * - A linha (Empreenda Rápido, Mulher, Afro) não muda número nenhum: as
 *   condições de cada linha não estão publicadas em fonte oficial que
 *   conferimos, e a tela diz isso.
 * - Depois do primeiro cálculo, o resultado acompanha os campos (como no
 *   simulador do FGTS). Se um campo fica inválido, o último resultado válido
 *   fica esmaecido, com aviso — nunca um número velho com cara de atual.
 * - "Estimativa de parcela", nunca "parcela do Banco do Povo". CET só com
 *   todos os custos informados; sem custos além dos juros, o CET é a própria
 *   taxa, e a tela diz isso em vez de mostrar uma diferença de arredondamento.
 * - O diagnóstico devolve "aparentemente compatível", "precisa verificar" ou
 *   "possível impedimento". Nunca aprovação. As perguntas são todas
 *   afirmativas: "sim" é sempre o lado que atende ao requisito.
 * - Nada do que é digitado ou respondido sai do navegador. A medição leva só
 *   categorias (perfil, cenário de taxa, meses de carência, se houve custos,
 *   se a cidade tem atendimento verificado). O diagnóstico não é medido além
 *   da abertura. O link compartilhado é a URL da página, sem dados.
 */

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { track } from "@/lib/analytics/track";
import { SITE_URL } from "@/lib/site";
import { parseBRLToCents, parsePercentBR } from "@/lib/calculators/proposal-comparison";
import {
  BPP_RULES,
  CUSTOM_RATE_MAX_PERCENT,
  PROFILE_LABEL,
  RATE_SCENARIOS,
  SOURCES,
  capForProfile,
  type Profile,
  type RateScenarioId,
} from "@/lib/calculators/bpp-rules";
import {
  PURPOSE_LABEL,
  VERDICT_LABEL,
  VERDICT_TEXT,
  diagnose,
  simulateBpp,
  type Answer,
  type BppField,
  type BppInput,
  type BppIssue,
  type BppResult,
  type DiagnosisInput,
  type ItemStatus,
  type Purpose,
} from "@/lib/calculators/bpp-simulator";
import type { BppCityOption } from "@/lib/local/bpp-cities";
import { useRevealResult } from "./use-reveal-result";

const PAGE_URL = `${SITE_URL}/calculadoras/simulador-banco-do-povo/`;
const SHARE_TEXT = "Simulei um crédito do Banco do Povo e achei essa ferramenta útil.";

const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const brl0 = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(cents / 100);
/** Taxa como a pessoa escreveu: "0,35", "1", "0,125" — até 4 casas, sem zeros sobrando. */
const rate = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 4 });
const pct2 = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const isoToBR = (iso: string) => iso.split("-").reverse().join("/");
const meses = (n: number) => `${n} ${n === 1 ? "mês" : "meses"}`;
const parcelas = (n: number) => `${n} ${n === 1 ? "parcela" : "parcelas"}`;

const LINES = [...BPP_RULES.lines.names, "Não sei"] as const;
type Line = (typeof LINES)[number];

const LOW = RATE_SCENARIOS[0]!;
const HIGH = RATE_SCENARIOS[1]!;

const choiceClass = (active: boolean) =>
  `flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
    active ? "border-brand-teal-dark bg-brand-teal-soft font-semibold text-brand-navy" : "border-brand-border bg-white text-brand-text hover:bg-brand-surface-soft"
  }`;
const inputClass =
  "min-h-11 rounded-lg border border-brand-border bg-white px-3 py-2.5 text-brand-text aria-[invalid=true]:border-2 aria-[invalid=true]:border-brand-danger";
const linkClass = "font-semibold text-brand-navy underline underline-offset-2 hover:text-brand-teal-dark";

interface Fields {
  profile: Profile;
  amount: string;
  months: string;
  grace: number;
  scenario: RateScenarioId;
  customRate: string;
  costKind: "reais" | "percent";
  costValue: string;
  costsComplete: boolean;
}

const INITIAL: Fields = {
  profile: "mei",
  amount: "5.000",
  months: "24",
  grace: 0,
  scenario: "minima",
  customRate: "",
  costKind: "reais",
  costValue: "",
  costsComplete: false,
};

/** Texto vazio → null (campo não preenchido); texto ilegível → NaN (mensagem própria). */
function money(raw: string): number | null {
  if (raw.trim() === "") return null;
  return parseBRLToCents(raw) ?? Number.NaN;
}
function percent(raw: string): number | null {
  if (raw.trim() === "") return null;
  return parsePercentBR(raw) ?? Number.NaN;
}
function months(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  return /^\d+$/.test(t) ? Number.parseInt(t, 10) : Number.NaN;
}

function toInput(f: Fields, ratePercent?: number): BppInput {
  const costs =
    f.costValue.trim() === ""
      ? null
      : f.costKind === "reais"
        ? { kind: "reais" as const, cents: money(f.costValue) ?? Number.NaN }
        : { kind: "percent" as const, percent: percent(f.costValue) ?? Number.NaN };
  return {
    profile: f.profile,
    amountCents: money(f.amount),
    months: months(f.months),
    graceMonths: f.grace,
    monthlyRatePercent:
      ratePercent ?? (f.scenario === "outra" ? percent(f.customRate) : RATE_SCENARIOS.find((s) => s.id === f.scenario)!.monthlyPercent),
    costs,
    costsComplete: f.costsComplete,
  };
}

interface Shown {
  result: BppResult;
  low: BppResult | null;
  high: BppResult | null;
  warnings: BppIssue[];
}

function Step({ n, title, children, hint }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="mt-6 first:mt-0">
      <legend className="font-serif text-base font-bold text-brand-navy">
        <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-navy text-xs text-white" aria-hidden>
          {n}
        </span>
        {title}
      </legend>
      {hint ? <p className="mt-1 text-sm text-brand-muted">{hint}</p> : null}
      <div className="mt-3">{children}</div>
    </fieldset>
  );
}

function FieldError({ id, issues, field }: { id: string; issues: BppIssue[]; field: BppField }) {
  const own = issues.filter((i) => i.field === field);
  if (own.length === 0) return null;
  return (
    <p id={id} className="mt-1.5 text-sm font-medium text-brand-danger">
      {own.map((i) => i.message).join(" ")}
    </p>
  );
}

const STATUS_BADGE: Record<ItemStatus, { label: string; className: string }> = {
  ok: { label: "Atende", className: "bg-brand-success-soft text-brand-success" },
  verificar: { label: "Verificar", className: "bg-brand-warning-soft text-brand-warning" },
  impedimento: { label: "Atenção", className: "bg-brand-danger-soft text-brand-danger" },
};

const DIAG_QUESTIONS: Array<[keyof Omit<DiagnosisInput, "purpose">, string]> = [
  ["hasActivity", "Você tem uma atividade produtiva (um negócio funcionando, formal ou informal)?"],
  ["activityInCity", "O negócio funciona na cidade onde você vai pedir o crédito?"],
  ["nameClear", "Seu nome (CPF e, se houver, CNPJ) está sem restrição, como no Serasa?"],
  ["training", "Você já fez a capacitação gratuita indicada pelo programa?"],
  ["sixMonths", "O negócio funciona há seis meses ou mais?"],
];

export function BancoDoPovoSimulator({
  cities,
  context = "ferramenta",
  showNotice = true,
}: {
  cities: BppCityOption[];
  context?: string;
  /** A página da ferramenta já mostra o aviso logo acima; em outros contextos, o componente mostra o curto. */
  showNotice?: boolean;
}) {
  const uid = useId();
  const id = (s: string) => `${uid}-${s}`;
  const started = useRef(false);
  const eligibilityTracked = useRef(false);
  const costsRef = useRef<HTMLDetailsElement | null>(null);
  const { ref: resultRef, reveal } = useRevealResult();

  const [f, setF] = useState<Fields>(INITIAL);
  const [purpose, setPurpose] = useState<Purpose>("");
  const [line, setLine] = useState<Line>("Não sei");

  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<BppIssue[]>([]);
  const [shown, setShown] = useState<Shown | null>(null);
  const [stale, setStale] = useState(false);
  const [showCalc, setShowCalc] = useState(false);

  const [diag, setDiag] = useState<Omit<DiagnosisInput, "purpose">>({
    hasActivity: "",
    activityInCity: "",
    nameClear: "",
    training: "",
    sixMonths: "",
  });
  const [diagShown, setDiagShown] = useState(false);
  const [diagEmpty, setDiagEmpty] = useState(false);

  const [city, setCity] = useState("");
  const [copied, setCopied] = useState<"ok" | "falhou" | null>(null);

  const cap = capForProfile(f.profile);
  const amountCents = money(f.amount);
  const overCap = typeof amountCents === "number" && Number.isFinite(amountCents) && amountCents > cap.capCents;
  const sliderValue = Math.min(Math.max(Number.isFinite(amountCents ?? Number.NaN) ? (amountCents as number) : BPP_RULES.amount.minCents, BPP_RULES.amount.minCents), cap.capCents) / 100;
  const monthsN = months(f.months);

  function markStarted() {
    if (started.current) return;
    started.current = true;
    track("bpp_simulator_started", { context });
  }

  function compute(next: Fields, { announce }: { announce: boolean }): BppIssue[] {
    const outcome = simulateBpp(toInput(next));
    if (outcome.kind === "invalid") {
      setErrors(outcome.errors);
      setStale(shown !== null);
      return outcome.errors;
    }
    const low = simulateBpp(toInput(next, LOW.monthlyPercent));
    const high = simulateBpp(toInput(next, HIGH.monthlyPercent));
    setErrors([]);
    setStale(false);
    setShown({
      result: outcome.result,
      low: low.kind === "ok" ? low.result : null,
      high: high.kind === "ok" ? high.result : null,
      warnings: outcome.warnings,
    });
    if (announce) {
      track("bpp_simulator_completed", {
        context,
        profile: next.profile,
        rate_scenario: next.scenario,
        grace_months: next.grace,
        with_costs: next.costValue.trim() !== "",
      });
    }
    return [];
  }

  function update(patch: Partial<Fields>) {
    markStarted();
    const next = { ...f, ...patch };
    setF(next);
    if (submitted) compute(next, { announce: false });
  }

  const FIELD_TARGET: Record<BppField, string> = {
    amount: id("amount"),
    months: id("months"),
    grace: id("grace-0"),
    rate: f.scenario === "outra" ? id("custom-rate") : id("rate-minima"),
    costs: id("cost"),
  };

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    markStarted();
    setSubmitted(true);
    const errs = compute(f, { announce: true });
    if (errs.length > 0) {
      const first = errs[0]!.field;
      if (first === "costs" && costsRef.current) costsRef.current.open = true;
      window.setTimeout(() => document.getElementById(FIELD_TARGET[first])?.focus(), 0);
      return;
    }
    reveal();
  }

  const diagnosis = diagnose({ purpose, ...diag });
  const selectedCity = cities.find((c) => c.path === city);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(PAGE_URL);
      setCopied("ok");
      track("bpp_simulation_shared", { context, method: "copiar-link" });
    } catch {
      setCopied("falhou");
    }
    window.setTimeout(() => setCopied(null), 4000);
  }

  const has = (fld: BppField) => errors.some((x) => x.field === fld);
  const errorIds = (fld: BppField) => (has(fld) ? id(`err-${fld}`) : undefined);
  const r = shown?.result ?? null;

  return (
    <section aria-label="Simulador independente para o Banco do Povo Paulista" className="rounded-2xl border border-brand-border bg-white p-5 shadow-sm sm:p-6">
      {showNotice ? (
        <p className="mb-5 rounded-lg border border-brand-navy/20 bg-brand-navy/[0.04] px-3 py-2 text-xs leading-relaxed text-brand-navy">
          <strong>Simulador independente e não oficial.</strong> O Crédito por Perto não representa o Banco do Povo Paulista
          nem o Governo do Estado de São Paulo. Os resultados são estimativas.
        </p>
      ) : null}

      <form onSubmit={handleSubmit} noValidate>
        <Step n={1} title="Qual é o seu perfil?" hint={`Define o valor máximo da simulação: até ${brl0(cap.capCents)}.`}>
          <div className="grid gap-2 sm:grid-cols-2">
            {(Object.keys(PROFILE_LABEL) as Profile[]).map((p) => (
              <label key={p} className={choiceClass(f.profile === p)}>
                <input type="radio" name={id("profile")} value={p} checked={f.profile === p} onChange={() => update({ profile: p })} className="accent-brand-teal-dark" />
                {PROFILE_LABEL[p]}
              </label>
            ))}
          </div>
          {f.profile === "nao-sei" ? (
            <p className="mt-2 text-sm text-brand-muted">
              Com CNPJ (inclusive MEI), prefeituras citam até {brl0(BPP_RULES.profileCap.pessoaJuridicaCents)}; sem CNPJ, até{" "}
              {brl0(BPP_RULES.profileCap.pessoaFisicaCents)}.
            </p>
          ) : null}
        </Step>

        <Step n={2} title="Para que você pretende usar o crédito?" hint="O programa financia o negócio: capital de giro e investimento, como máquinas e equipamentos.">
          <label htmlFor={id("purpose")} className="sr-only">
            Uso do crédito
          </label>
          <select
            id={id("purpose")}
            value={purpose}
            onChange={(e) => {
              markStarted();
              setPurpose(e.target.value as Purpose);
            }}
            className={`${inputClass} w-full`}
          >
            <option value="">Escolha uma opção</option>
            {(Object.keys(PURPOSE_LABEL) as Array<Exclude<Purpose, "">>).map((p) => (
              <option key={p} value={p}>
                {PURPOSE_LABEL[p]}
              </option>
            ))}
          </select>
          {purpose === "divida-pessoal" || purpose === "consumo" ? (
            <p className="mt-2 rounded-lg bg-brand-warning-soft p-3 text-sm text-brand-warning">
              Esse não é o uso do Banco do Povo: o crédito é para o negócio. Para conta ou dívida pessoal, veja{" "}
              <Link href="/organizacao-financeira/renegociacao-ou-emprestimo/" className="font-semibold underline underline-offset-2">
                renegociar ou pegar empréstimo
              </Link>
              . A simulação continua disponível para você entender a conta.
            </p>
          ) : purpose === "reforma" || purpose === "outro" ? (
            <p className="mt-2 text-sm text-brand-muted">Confirme no atendimento se esse uso é aceito.</p>
          ) : null}
        </Step>

        <Step n={3} title="Linha de crédito" hint="Opcional. Se não souber, deixe em “Não sei”: o atendimento indica a linha.">
          <div className="flex flex-wrap gap-2">
            {LINES.map((l) => (
              <label key={l} className={choiceClass(line === l)}>
                <input
                  type="radio"
                  name={id("line")}
                  value={l}
                  checked={line === l}
                  onChange={() => {
                    markStarted();
                    setLine(l);
                  }}
                  className="accent-brand-teal-dark"
                />
                {l}
              </label>
            ))}
          </div>
          <p className="mt-2 text-sm text-brand-muted">
            As condições específicas de cada linha não estão publicadas nas fontes oficiais que conferimos. A simulação usa as
            condições gerais divulgadas pelo Estado.
          </p>
        </Step>

        <Step n={4} title="Quanto você pretende pedir?">
          <label htmlFor={id("amount")} className="text-sm font-semibold text-brand-navy">
            Valor, em reais
          </label>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-sm text-brand-muted" aria-hidden>
              R$
            </span>
            <input
              id={id("amount")}
              inputMode="decimal"
              value={f.amount}
              onChange={(e) => update({ amount: e.target.value })}
              aria-invalid={has("amount")}
              aria-describedby={[id("amount-hint"), errorIds("amount")].filter(Boolean).join(" ")}
              className={`${inputClass} w-full`}
            />
          </div>
          <input
            type="range"
            aria-label="Ajustar o valor"
            aria-valuetext={brl0(sliderValue * 100)}
            min={BPP_RULES.amount.minCents / 100}
            max={cap.capCents / 100}
            step={100}
            value={sliderValue}
            onChange={(e) => update({ amount: Number(e.target.value).toLocaleString("pt-BR") })}
            className="mt-3 h-6 w-full accent-brand-teal-dark"
          />
          <p id={id("amount-hint")} className="mt-1 flex justify-between text-xs text-brand-muted">
            <span>Mínimo {brl0(BPP_RULES.amount.minCents)}</span>
            <span>Máximo para o perfil {brl0(cap.capCents)}</span>
          </p>
          {overCap && !has("amount") ? (
            <p className="mt-1.5 text-sm font-medium text-brand-warning">
              Acima do máximo para esse perfil ({brl0(cap.capCents)}). O controle deslizante para no máximo.
            </p>
          ) : null}
          <FieldError id={id("err-amount")} issues={errors} field="amount" />
        </Step>

        <Step n={5} title="Em quantas parcelas?" hint={`O Estado divulga prazo de até ${BPP_RULES.term.maxMonths} meses.`}>
          <div className="flex flex-wrap items-center gap-2">
            {[12, 18, 24, 30, 36].map((m) => (
              <button key={m} type="button" onClick={() => update({ months: String(m) })} aria-pressed={monthsN === m} className={choiceClass(monthsN === m)}>
                {m} meses
              </button>
            ))}
            <label htmlFor={id("months")} className="ml-1 text-sm text-brand-muted">
              ou digite:
            </label>
            <input
              id={id("months")}
              inputMode="numeric"
              value={f.months}
              onChange={(e) => update({ months: e.target.value })}
              aria-invalid={has("months")}
              aria-describedby={errorIds("months")}
              className={`${inputClass} w-20`}
            />
          </div>
          <FieldError id={id("err-months")} issues={errors} field="months" />
        </Step>

        <Step
          n={6}
          title="Carência antes da primeira parcela"
          hint="Carência não significa meses de graça: dependendo da operação, os juros continuam correndo. A simulação soma esses juros ao saldo."
        >
          <div className="flex flex-wrap gap-2">
            {[0, 1, 2, 3].map((g) => (
              <label key={g} className={choiceClass(f.grace === g)}>
                <input id={id(`grace-${g}`)} type="radio" name={id("grace")} value={g} checked={f.grace === g} onChange={() => update({ grace: g })} className="accent-brand-teal-dark" />
                {g === 0 ? "Sem carência" : meses(g)}
              </label>
            ))}
          </div>
          <FieldError id={id("err-grace")} issues={errors} field="grace" />
        </Step>

        <Step n={7} title="Taxa de juros da simulação" hint="A taxa do seu pedido só sai na análise. Escolha um cenário com base oficial.">
          <div className="grid gap-2">
            {RATE_SCENARIOS.map((s) => (
              <label key={s.id} className={choiceClass(f.scenario === s.id)}>
                <input id={id(`rate-${s.id}`)} type="radio" name={id("rate")} value={s.id} checked={f.scenario === s.id} onChange={() => update({ scenario: s.id })} className="accent-brand-teal-dark" />
                <span>
                  <strong>{rate(s.monthlyPercent)}% ao mês</strong> <span className="font-normal text-brand-muted">— {s.explanation}</span>
                </span>
              </label>
            ))}
            <label className={choiceClass(f.scenario === "outra")}>
              <input type="radio" name={id("rate")} value="outra" checked={f.scenario === "outra"} onChange={() => update({ scenario: "outra" })} className="accent-brand-teal-dark" />
              Simular outra taxa (a do atendimento, por exemplo)
            </label>
          </div>
          {f.scenario === "outra" ? (
            <div className="mt-3">
              <label htmlFor={id("custom-rate")} className="text-sm font-semibold text-brand-navy">
                Taxa ao mês
              </label>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  id={id("custom-rate")}
                  inputMode="decimal"
                  value={f.customRate}
                  onChange={(e) => update({ customRate: e.target.value })}
                  placeholder="0,50"
                  aria-invalid={has("rate")}
                  aria-describedby={errorIds("rate")}
                  className={`${inputClass} w-28`}
                />
                <span className="text-sm text-brand-muted">% ao mês (até {CUSTOM_RATE_MAX_PERCENT}%)</span>
              </div>
            </div>
          ) : null}
          <FieldError id={id("err-rate")} issues={errors} field="rate" />
        </Step>

        <details ref={costsRef} className="mt-6 rounded-xl border border-brand-border">
          <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-semibold text-brand-navy">
            O atendimento informou algum custo? (opcional, para estimar o CET)
          </summary>
          <div className="border-t border-brand-border px-4 py-4">
            <p className="text-sm text-brand-muted">
              Informe só o que o atendimento passar por escrito: tarifa ou taxa cobrada na liberação. Não sabemos, pelas fontes
              oficiais, se há custos além dos juros.
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor={id("cost")} className="text-sm font-semibold text-brand-navy">
                  Custos na liberação
                </label>
                <input
                  id={id("cost")}
                  inputMode="decimal"
                  value={f.costValue}
                  onChange={(e) => update({ costValue: e.target.value })}
                  aria-invalid={has("costs")}
                  aria-describedby={errorIds("costs")}
                  className={`${inputClass} mt-1.5 block w-32`}
                />
              </div>
              <fieldset className="flex flex-wrap gap-2">
                <legend className="sr-only">Unidade dos custos</legend>
                <label className={choiceClass(f.costKind === "reais")}>
                  <input type="radio" name={id("cost-kind")} checked={f.costKind === "reais"} onChange={() => update({ costKind: "reais" })} className="accent-brand-teal-dark" />
                  em R$
                </label>
                <label className={choiceClass(f.costKind === "percent")}>
                  <input type="radio" name={id("cost-kind")} checked={f.costKind === "percent"} onChange={() => update({ costKind: "percent" })} className="accent-brand-teal-dark" />
                  em % do valor
                </label>
              </fieldset>
            </div>
            <label className="mt-3 flex min-h-11 items-center gap-2 text-sm text-brand-text">
              <input type="checkbox" checked={f.costsComplete} onChange={(e) => update({ costsComplete: e.target.checked })} className="h-5 w-5 accent-brand-teal-dark" />
              Esses são todos os custos que o atendimento informou (ou não há custos além dos juros)
            </label>
            <FieldError id={id("err-costs")} issues={errors} field="costs" />
          </div>
        </details>

        {errors.length > 0 ? (
          <div role="alert" className="mt-5 rounded-lg border border-brand-danger/40 bg-brand-danger-soft p-4 text-sm text-brand-danger">
            {errors.length === 1 ? "Revise o campo indicado: " : "Revise os campos indicados: "}
            {errors.map((e) => e.message).join(" ")}
          </div>
        ) : null}

        <button type="submit" className="mt-6 min-h-12 w-full rounded-lg bg-brand-teal-dark px-5 py-3 font-semibold text-white hover:bg-brand-teal sm:w-auto">
          Calcular estimativa
        </button>
      </form>

      <p aria-live="polite" className="sr-only">
        {r && !stale ? `Estimativa: ${parcelas(r.months)} de ${brl(r.paymentCents)}, total de ${brl(r.totalPaidCents)}.` : ""}
      </p>

      <div ref={resultRef} className="scroll-mt-24">
        {shown && r ? (
          <div className={`mt-8 border-t border-brand-border pt-6 ${stale ? "opacity-60" : ""}`}>
            {stale ? (
              <p className="mb-4 text-sm font-medium text-brand-warning">
                Resultado da última simulação válida. Ajuste o campo destacado para atualizar.
              </p>
            ) : null}
            <h2 data-result-heading tabIndex={-1} className="font-serif text-xl font-bold text-brand-navy">
              Estimativa de parcela
            </h2>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-brand-teal-soft p-4 sm:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-brand-teal-dark">Parcela estimada</dt>
                <dd className="mt-1 text-3xl font-bold text-brand-navy">
                  {r.months}x de {brl(r.paymentCents)}
                </dd>
                <dd className="mt-1 text-sm text-brand-text">
                  {r.graceMonths > 0
                    ? `Primeira parcela no ${r.firstPaymentMonth}º mês, depois de ${meses(r.graceMonths)} de carência.`
                    : "Primeira parcela um mês depois da liberação."}
                  {r.lastPaymentCents !== r.paymentCents ? ` Última parcela de ${brl(r.lastPaymentCents)} (acerto de arredondamento).` : ""}
                </dd>
              </div>
              {[
                ["Valor solicitado", brl(r.amountCents)],
                ["Taxa usada na simulação", `${rate(r.monthlyRatePercent)}% ao mês (${pct2(r.annualRatePercent)}% ao ano)`],
                ["Prazo", parcelas(r.months)],
                ["Carência", r.graceMonths === 0 ? "Sem carência" : `${meses(r.graceMonths)} (juros de ${brl(r.graceInterestCents)} somados ao saldo)`],
                ["Total estimado das parcelas", brl(r.totalPaidCents)],
                ["Juros estimados", brl(r.totalInterestCents)],
                ["Custos adicionais", f.costValue.trim() === "" && r.costsCents === 0 ? "Não informados" : `${brl(r.costsCents)} informados por você`],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-brand-surface-soft p-4">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-brand-muted">{k}</dt>
                  <dd className="mt-1 text-lg font-bold text-brand-navy">{v}</dd>
                </div>
              ))}
              <div className="rounded-xl bg-brand-surface-soft p-4">
                <dt className="text-xs font-semibold uppercase tracking-wide text-brand-muted">CET</dt>
                <dd className="mt-1 text-sm text-brand-text">
                  {r.cet ? (
                    r.costsCents === 0 ? (
                      <>
                        <span className="text-lg font-bold text-brand-navy">{pct2(r.annualRatePercent)}% ao ano</span>
                        <br />
                        Sem custos além dos juros, o CET é a própria taxa da simulação.
                      </>
                    ) : (
                      <span className="text-lg font-bold text-brand-navy">
                        {pct2(r.cet.annualPercent)}% ao ano ({pct2(r.cet.monthlyPercent)}% ao mês)
                      </span>
                    )
                  ) : (
                    r.cetUnavailableReason
                  )}
                </dd>
              </div>
            </dl>

            {shown.low && shown.high ? (
              <p className="mt-4 rounded-lg border border-brand-border p-3 text-sm text-brand-text">
                <strong>Nas duas taxas divulgadas:</strong> com o mesmo valor, prazo e carência, a parcela estimada seria de{" "}
                {brl(shown.low.paymentCents)} a {rate(LOW.monthlyPercent)}% ao mês e de {brl(shown.high.paymentCents)} a{" "}
                {rate(HIGH.monthlyPercent)}% ao mês, com total de {brl(shown.low.totalPaidCents)} e {brl(shown.high.totalPaidCents)}.
              </p>
            ) : null}

            {shown.warnings.length > 0 ? (
              <ul className="mt-4 space-y-1 rounded-lg bg-brand-warning-soft p-3 text-sm text-brand-warning">
                {shown.warnings.map((w) => (
                  <li key={w.message}>{w.message}</li>
                ))}
              </ul>
            ) : null}

            <p className="mt-4 text-sm leading-relaxed text-brand-muted">
              Estimativa calculada pelo sistema Price, apenas para fins informativos. As condições oficiais da operação podem ser
              diferentes. Taxas, limites, prazos, tarifas, aprovação e demais condições variam conforme perfil, linha, município e
              análise do programa.
            </p>

            <button
              type="button"
              onClick={() => setShowCalc((v) => !v)}
              aria-expanded={showCalc}
              className="mt-4 min-h-11 rounded-lg border border-brand-border px-4 py-2 text-sm font-semibold text-brand-navy hover:bg-brand-surface-soft"
            >
              {showCalc ? "Ocultar o cálculo" : "Ver cálculo"}
            </button>

            {showCalc ? (
              <div className="mt-4 rounded-xl border border-brand-border p-4 text-sm leading-relaxed text-brand-text">
                <p className="font-semibold text-brand-navy">Como chegamos a esse número</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>Sistema de cálculo: Price (parcelas fixas, juros compostos mensais).</li>
                  <li>
                    Fórmula: parcela = saldo × i ÷ [1 − (1 + i)<sup>−n</sup>], com i = {(r.monthlyRatePercent / 100).toLocaleString("pt-BR", { maximumFractionDigits: 6 })} e n ={" "}
                    {r.months}.
                  </li>
                  <li>
                    Saldo no início das parcelas: {brl(r.balanceAfterGraceCents)}
                    {r.graceMonths > 0 ? " (valor pedido mais os juros da carência)" : ""}.
                  </li>
                  <li>Arredondamento ao centavo; a última parcela acerta a diferença.</li>
                  <li>Custos considerados: {r.costsCents > 0 ? `${brl(r.costsCents)} na liberação, informados por você` : "nenhum"}.</li>
                  <li>Não considerados: tarifas, taxas, seguros ou garantias que o atendimento não tenha informado.</li>
                </ul>
                <p className="mt-3 text-xs text-brand-muted sm:hidden">Arraste a tabela para o lado para ver juros, amortização e saldo.</p>
                <div
                  tabIndex={0}
                  role="region"
                  aria-label="Tabela mês a mês da estimativa"
                  className="mt-2 overflow-x-auto rounded-lg border border-brand-border"
                >
                  <table className="w-full min-w-[30rem] border-collapse text-xs sm:text-sm">
                    <caption className="sr-only">Tabela mês a mês da estimativa</caption>
                    <thead className="bg-brand-surface-soft text-left">
                      <tr>
                        {["Mês", "Parcela", "Juros", "Amortização", "Saldo"].map((h) => (
                          <th key={h} scope="col" className="px-2 py-2 font-bold text-brand-navy sm:px-3">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="tabular-nums">
                      {r.schedule.map((row) => (
                        <tr key={row.month} className={`border-t border-brand-border ${row.phase === "carencia" ? "bg-brand-gold-soft/40" : ""}`}>
                          <td className="whitespace-nowrap px-2 py-1.5 sm:px-3">
                            {row.month}
                            {row.phase === "carencia" ? " · carência" : ""}
                          </td>
                          <td className="whitespace-nowrap px-2 py-1.5 sm:px-3">{brl(row.paymentCents)}</td>
                          <td className="whitespace-nowrap px-2 py-1.5 sm:px-3">{brl(row.interestCents)}</td>
                          <td className="whitespace-nowrap px-2 py-1.5 sm:px-3">{brl(row.amortizationCents)}</td>
                          <td className="whitespace-nowrap px-2 py-1.5 sm:px-3">{brl(row.balanceCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <details
        className="mt-8 rounded-xl border border-brand-border"
        onToggle={(e) => {
          if (e.currentTarget.open && !eligibilityTracked.current) {
            eligibilityTracked.current = true;
            track("bpp_eligibility_started", { context });
          }
        }}
      >
        <summary className="min-h-11 cursor-pointer px-4 py-3 font-semibold text-brand-navy">Veja se você atende aos requisitos básicos</summary>
        <div className="border-t border-brand-border px-4 py-4">
          <p className="text-sm text-brand-muted">
            Perguntas baseadas nos requisitos divulgados. Não é aprovação: quem analisa é o programa. Nada do que você marcar sai do
            seu aparelho.
          </p>
          <p className="mt-3 text-sm text-brand-text">
            {purpose ? (
              <>
                Uso informado no passo 2: <strong>{PURPOSE_LABEL[purpose]}</strong>.
              </>
            ) : (
              <>
                Uso do crédito: <strong>ainda não informado</strong>. Escolha no passo 2, acima.
              </>
            )}
          </p>
          {DIAG_QUESTIONS.map(([key, q]) => (
            <fieldset key={key} className="mt-4">
              <legend className="text-sm font-semibold text-brand-navy">{q}</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {(
                  [
                    ["sim", "Sim"],
                    ["nao", "Não"],
                    ["nao-sei", "Não sei"],
                  ] as Array<[Answer, string]>
                ).map(([v, label]) => (
                  <label key={v} className={choiceClass(diag[key] === v)}>
                    <input
                      type="radio"
                      name={id(`diag-${key}`)}
                      checked={diag[key] === v}
                      onChange={() => {
                        setDiag((d) => ({ ...d, [key]: v }));
                        setDiagEmpty(false);
                      }}
                      className="accent-brand-teal-dark"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <button
            type="button"
            onClick={() => {
              const answered = Object.values(diag).some((v) => v !== "");
              setDiagEmpty(!answered);
              setDiagShown(answered);
            }}
            className="mt-5 min-h-11 rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy/90"
          >
            Ver o resultado
          </button>
          <div aria-live="polite" className="mt-5">
            {diagEmpty ? <p className="text-sm text-brand-warning">Responda às perguntas acima para ver o resultado.</p> : null}
            {diagShown ? (
              <>
                <p
                  className={`rounded-lg p-3 text-sm ${
                    diagnosis.verdict === "possivel-impedimento"
                      ? "bg-brand-danger-soft text-brand-danger"
                      : diagnosis.verdict === "precisa-verificar"
                        ? "bg-brand-warning-soft text-brand-warning"
                        : "bg-brand-success-soft text-brand-success"
                  }`}
                >
                  <strong>{VERDICT_LABEL[diagnosis.verdict]}.</strong> {VERDICT_TEXT[diagnosis.verdict]}
                </p>
                <ul className="mt-3 space-y-2 text-sm">
                  {diagnosis.items.map((item) => (
                    <li key={item.id} className="flex items-start gap-2">
                      <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_BADGE[item.status].className}`}>
                        {STATUS_BADGE[item.status].label}
                      </span>
                      <span>
                        {item.text}
                        {item.id === "restricao" && item.status !== "ok" ? (
                          <>
                            {" "}
                            <Link href="/credito-seguro/consultar-nome-nos-biros-de-credito/" className={linkClass}>
                              Como consultar o nome de graça
                            </Link>
                            .
                          </>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        </div>
      </details>

      <div className="mt-6 rounded-xl border border-brand-border p-4">
        <label htmlFor={id("city")} className="font-semibold text-brand-navy">
          Em qual cidade fica o seu negócio?
        </label>
        <p className="mt-1 text-sm text-brand-muted">O pedido começa no atendimento do município onde o negócio funciona.</p>
        <select
          id={id("city")}
          value={city}
          onChange={(e) => {
            setCity(e.target.value);
            const c = cities.find((x) => x.path === e.target.value);
            if (c) track("bpp_city_selected", { context, has_unit: c.hasVerifiedUnit });
          }}
          className={`${inputClass} mt-2 w-full`}
        >
          <option value="">Escolha a cidade</option>
          {cities.map((c) => (
            <option key={c.path} value={c.path}>
              {c.name}
            </option>
          ))}
          <option value="outra">Minha cidade não está na lista</option>
        </select>
        <div aria-live="polite">
          {selectedCity ? (
            <p className="mt-3 text-sm text-brand-text">
              {selectedCity.hasVerifiedUnit && selectedCity.checkedAt
                ? `O guia de ${selectedCity.name} traz o que encontramos sobre o Banco do Povo da cidade em fonte oficial, verificado em ${isoToBR(selectedCity.checkedAt)}.`
                : `Não localizamos, em fonte oficial, o atendimento do Banco do Povo em ${selectedCity.name}. O guia da cidade traz os canais que confirmamos.`}{" "}
              <Link
                href={selectedCity.path}
                onClick={() => track("bpp_local_page_clicked", { context, has_unit: selectedCity.hasVerifiedUnit })}
                className={linkClass}
              >
                {selectedCity.hasVerifiedUnit ? `Veja como solicitar em ${selectedCity.name}` : `Veja o guia de ${selectedCity.name}`}
              </Link>
            </p>
          ) : city === "outra" ? (
            <p className="mt-3 text-sm text-brand-text">
              O site da prefeitura da sua cidade publica o endereço e o telefone do atendimento, quando o município opera o
              programa. Use sempre o contato publicado pela prefeitura ou pelo Governo do Estado.
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-6">
        <h2 className="font-serif text-lg font-bold text-brand-navy">Próximos passos</h2>
        <ul className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
          <li>
            <Link href="/emprestimos/microcredito-produtivo-e-banco-do-povo/" className={linkClass}>
              Ver como solicitar
            </Link>{" "}
            — requisitos, capacitação e o que levar.
          </li>
          <li>
            <Link href="/emprestimos/emprestimo-para-mei/" className={linkClass}>
              Ver documentos que costumam ser pedidos
            </Link>{" "}
            — a pasta do pequeno negócio.
          </li>
          <li>
            <a
              href={SOURCES.secretaria.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track("bpp_official_link_clicked", { context, target: "secretaria" })}
              className={linkClass}
            >
              Acessar canal oficial
            </a>{" "}
            — página do programa no Governo do Estado.
          </li>
          <li>
            <Link href="/credito-seguro/deposito-antecipado-e-golpe/" className={linkClass}>
              Cuidado com golpe
            </Link>{" "}
            — ninguém de fora do atendimento oficial pode cobrar para aprovar o pedido.
          </li>
        </ul>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-brand-border pt-4">
        <span className="text-sm text-brand-muted">Compartilhar o simulador:</span>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`${SHARE_TEXT} ${PAGE_URL}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track("bpp_simulation_shared", { context, method: "whatsapp" })}
          className="inline-flex min-h-11 items-center rounded-lg border border-brand-border px-3 text-sm font-semibold text-brand-navy hover:bg-brand-surface-soft"
        >
          WhatsApp
        </a>
        <button
          type="button"
          onClick={copyLink}
          className="inline-flex min-h-11 items-center rounded-lg border border-brand-border px-3 text-sm font-semibold text-brand-navy hover:bg-brand-surface-soft"
        >
          Copiar link
        </button>
        <span role="status" className="text-xs text-brand-muted">
          {copied === "ok" ? "Link copiado." : copied === "falhou" ? "Não foi possível copiar. Copie o endereço da barra do navegador." : "O link leva só à página, sem os seus valores."}
        </span>
      </div>
    </section>
  );
}
