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
 *   oficial (0,35% e 1% ao mês) ou abre "outra taxa". O resultado mostra
 *   sempre a faixa entre os dois cenários, porque a taxa real só sai na
 *   análise.
 * - A linha (Empreenda Rápido, Mulher, Afro) não muda número nenhum: as
 *   condições de cada linha não estão publicadas em fonte oficial que
 *   conferimos, e a tela diz isso.
 * - "Estimativa de parcela", nunca "parcela do Banco do Povo". CET só com
 *   todos os custos informados.
 * - O diagnóstico devolve "aparentemente compatível", "precisa verificar" ou
 *   "possível impedimento". Nunca aprovação.
 * - Nada do que é digitado sai do navegador. A medição leva só categorias
 *   (perfil, cenário de taxa, meses de carência), nunca valor, renda ou
 *   situação do nome. O link compartilhado é a URL da página, sem dados.
 */

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { track } from "@/lib/analytics/track";
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
  type BppIssue,
  type BppResult,
  type DiagnosisInput,
  type Purpose,
} from "@/lib/calculators/bpp-simulator";
import type { BppCityOption } from "@/lib/local/bpp-cities";
import { useRevealResult } from "./use-reveal-result";

const PAGE_URL = "https://www.creditoporperto.com/calculadoras/simulador-banco-do-povo/";
const SHARE_TEXT = "Simulei um crédito do Banco do Povo e achei essa ferramenta útil.";

const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const brl0 = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(cents / 100);
const pct = (v: number, digits = 2) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const isoToBR = (iso: string) => iso.split("-").reverse().join("/");

const LINES = [...BPP_RULES.lines.names, "Não sei"] as const;
type Line = (typeof LINES)[number];

const choiceClass = (active: boolean) =>
  `flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
    active ? "border-brand-teal-dark bg-brand-teal-soft font-semibold text-brand-navy" : "border-brand-border bg-white text-brand-text hover:bg-brand-surface-soft"
  }`;

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

export function BancoDoPovoSimulator({
  cities,
  context = "ferramenta",
  showNotice = true,
}: {
  cities: BppCityOption[];
  context?: string;
  /** A página da ferramenta já mostra o aviso completo logo acima; em outros contextos, o componente mostra o curto. */
  showNotice?: boolean;
}) {
  const uid = useId();
  const id = (s: string) => `${uid}-${s}`;
  const started = useRef(false);
  const { ref: resultRef, reveal } = useRevealResult();

  const [profile, setProfile] = useState<Profile>("mei");
  const [purpose, setPurpose] = useState<Purpose>("capital-de-giro");
  const [line, setLine] = useState<Line>("Não sei");
  const [amount, setAmount] = useState("5.000");
  const [months, setMonths] = useState("24");
  const [grace, setGrace] = useState(0);
  const [scenario, setScenario] = useState<RateScenarioId>("minima");
  const [customRate, setCustomRate] = useState("");
  const [costKind, setCostKind] = useState<"reais" | "percent">("reais");
  const [costValue, setCostValue] = useState("");
  const [costsComplete, setCostsComplete] = useState(false);

  const [errors, setErrors] = useState<BppIssue[]>([]);
  const [warnings, setWarnings] = useState<BppIssue[]>([]);
  const [result, setResult] = useState<BppResult | null>(null);
  const [range, setRange] = useState<{ low: BppResult; high: BppResult } | null>(null);
  const [showCalc, setShowCalc] = useState(false);

  const [diagOpen, setDiagOpen] = useState(false);
  const [diag, setDiag] = useState<Omit<DiagnosisInput, "purpose">>({
    hasActivity: "",
    activityInCity: "",
    nameRestricted: "",
    training: "",
    sixMonths: "",
  });
  const [diagShown, setDiagShown] = useState(false);

  const [city, setCity] = useState("");
  const [copied, setCopied] = useState(false);

  const cap = capForProfile(profile);
  const amountCents = parseBRLToCents(amount);
  const sliderValue = Math.min(Math.max(amountCents ?? BPP_RULES.amount.minCents, BPP_RULES.amount.minCents), cap.capCents) / 100;

  function markStarted() {
    if (started.current) return;
    started.current = true;
    track("bpp_simulator_started", { context });
  }

  function rateFor(s: RateScenarioId): number | null {
    if (s === "outra") return parsePercentBR(customRate);
    return RATE_SCENARIOS.find((x) => x.id === s)!.monthlyPercent;
  }

  function costsInput() {
    if (costValue.trim() === "") return null;
    if (costKind === "reais") {
      const c = parseBRLToCents(costValue);
      return { kind: "reais" as const, cents: c ?? -1 };
    }
    const p = parsePercentBR(costValue);
    return { kind: "percent" as const, percent: p ?? -1 };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    markStarted();
    const monthsN = /^\d+$/.test(months.trim()) ? Number(months) : null;
    const base = {
      profile,
      amountCents,
      months: monthsN,
      graceMonths: grace,
      costs: costsInput(),
      costsComplete,
    };
    const outcome = simulateBpp({ ...base, monthlyRatePercent: rateFor(scenario) });
    if (outcome.kind === "invalid") {
      setErrors(outcome.errors);
      setWarnings([]);
      setResult(null);
      setRange(null);
      return;
    }
    setErrors([]);
    setWarnings(outcome.warnings);
    setResult(outcome.result);
    const low = simulateBpp({ ...base, monthlyRatePercent: RATE_SCENARIOS[0]!.monthlyPercent });
    const high = simulateBpp({ ...base, monthlyRatePercent: RATE_SCENARIOS[1]!.monthlyPercent });
    setRange(low.kind === "ok" && high.kind === "ok" ? { low: low.result, high: high.result } : null);
    track("bpp_simulator_completed", {
      context,
      profile,
      rate_scenario: scenario,
      grace_months: grace,
      with_costs: base.costs !== null,
    });
    reveal();
  }

  const diagnosis = diagnose({ purpose, ...diag });
  const selectedCity = cities.find((c) => c.path === city);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(PAGE_URL);
      setCopied(true);
      track("bpp_simulation_shared", { context, method: "copiar-link" });
    } catch {
      setCopied(false);
    }
  }

  const errorIds = (f: BppField) => (errors.some((x) => x.field === f) ? id(`err-${f}`) : undefined);

  return (
    <section aria-label="Simulador independente do Banco do Povo Paulista" className="rounded-2xl border border-brand-border bg-white p-5 shadow-sm sm:p-6">
      {showNotice ? (
        <p className="mb-5 rounded-lg border border-brand-navy/20 bg-brand-navy/[0.04] px-3 py-2 text-xs leading-relaxed text-brand-navy">
          <strong>Simulador independente e não oficial.</strong> O Crédito por Perto não representa o Banco do Povo Paulista
          nem o Governo do Estado de São Paulo. Os resultados são estimativas.
        </p>
      ) : null}

      <form onSubmit={handleSubmit} onChange={markStarted} noValidate>
        <Step n={1} title="Qual é o seu perfil?" hint={`Define o valor máximo da simulação: até ${brl0(cap.capCents)}.`}>
          <div className="grid gap-2 sm:grid-cols-2">
            {(Object.keys(PROFILE_LABEL) as Profile[]).map((p) => (
              <label key={p} className={choiceClass(profile === p)}>
                <input type="radio" name={id("profile")} value={p} checked={profile === p} onChange={() => setProfile(p)} className="accent-brand-teal-dark" />
                {PROFILE_LABEL[p]}
              </label>
            ))}
          </div>
          {profile === "nao-sei" ? (
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
            onChange={(e) => setPurpose(e.target.value as Purpose)}
            className="min-h-11 w-full rounded-lg border border-brand-border bg-white px-3 py-2.5 text-brand-text"
          >
            {(Object.keys(PURPOSE_LABEL) as Array<Exclude<Purpose, "">>).map((p) => (
              <option key={p} value={p}>
                {PURPOSE_LABEL[p]}
              </option>
            ))}
          </select>
          {purpose === "divida-pessoal" || purpose === "consumo" ? (
            <p className="mt-2 rounded-lg bg-brand-warning-soft p-3 text-sm text-brand-warning">
              Esse não é o uso do Banco do Povo: o crédito é para o negócio. Para conta ou dívida pessoal, veja{" "}
              <Link href="/organizacao-financeira/renegociacao-ou-emprestimo/">renegociar ou pegar empréstimo</Link>. A simulação
              continua disponível para você entender a conta.
            </p>
          ) : purpose === "reforma" || purpose === "outro" ? (
            <p className="mt-2 text-sm text-brand-muted">Confirme no atendimento se esse uso é aceito.</p>
          ) : null}
        </Step>

        <Step n={3} title="Linha de crédito" hint="Opcional. Se não souber, deixe em “Não sei”: o atendimento indica a linha.">
          <div className="flex flex-wrap gap-2">
            {LINES.map((l) => (
              <label key={l} className={choiceClass(line === l)}>
                <input type="radio" name={id("line")} value={l} checked={line === l} onChange={() => setLine(l)} className="accent-brand-teal-dark" />
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
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-invalid={errors.some((x) => x.field === "amount")}
              aria-describedby={[id("amount-hint"), errorIds("amount")].filter(Boolean).join(" ")}
              className="min-h-11 w-full rounded-lg border border-brand-border bg-white px-3 py-2.5 text-brand-text"
            />
          </div>
          <input
            type="range"
            aria-label="Ajustar o valor"
            min={BPP_RULES.amount.minCents / 100}
            max={cap.capCents / 100}
            step={100}
            value={sliderValue}
            onChange={(e) => setAmount(Number(e.target.value).toLocaleString("pt-BR"))}
            className="mt-3 w-full accent-brand-teal-dark"
          />
          <p id={id("amount-hint")} className="mt-1 flex justify-between text-xs text-brand-muted">
            <span>Mínimo {brl0(BPP_RULES.amount.minCents)}</span>
            <span>Máximo para o perfil {brl0(cap.capCents)}</span>
          </p>
          <FieldError id={id("err-amount")} issues={errors} field="amount" />
        </Step>

        <Step n={5} title="Em quantas parcelas?" hint={`O Estado divulga prazo de até ${BPP_RULES.term.maxMonths} meses.`}>
          <div className="flex flex-wrap items-center gap-2">
            {[12, 18, 24, 30, 36].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMonths(String(m))}
                aria-pressed={months === String(m)}
                className={choiceClass(months === String(m))}
              >
                {m} meses
              </button>
            ))}
            <label htmlFor={id("months")} className="sr-only">
              Outro número de parcelas
            </label>
            <input
              id={id("months")}
              inputMode="numeric"
              value={months}
              onChange={(e) => setMonths(e.target.value)}
              aria-invalid={errors.some((x) => x.field === "months")}
              aria-describedby={errorIds("months")}
              className="min-h-11 w-24 rounded-lg border border-brand-border bg-white px-3 py-2 text-brand-text"
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
              <label key={g} className={choiceClass(grace === g)}>
                <input type="radio" name={id("grace")} value={g} checked={grace === g} onChange={() => setGrace(g)} className="accent-brand-teal-dark" />
                {g === 0 ? "Sem carência" : `${g} ${g === 1 ? "mês" : "meses"}`}
              </label>
            ))}
          </div>
          <FieldError id={id("err-grace")} issues={errors} field="grace" />
        </Step>

        <Step n={7} title="Taxa de juros da simulação" hint="A taxa do seu pedido só sai na análise. Escolha um cenário com base oficial.">
          <div className="grid gap-2">
            {RATE_SCENARIOS.map((s) => (
              <label key={s.id} className={choiceClass(scenario === s.id)}>
                <input type="radio" name={id("rate")} value={s.id} checked={scenario === s.id} onChange={() => setScenario(s.id)} className="accent-brand-teal-dark" />
                <span>
                  <strong>{s.label}</strong> <span className="font-normal text-brand-muted">— {s.explanation}</span>
                </span>
              </label>
            ))}
            <label className={choiceClass(scenario === "outra")}>
              <input type="radio" name={id("rate")} value="outra" checked={scenario === "outra"} onChange={() => setScenario("outra")} className="accent-brand-teal-dark" />
              Simular outra taxa (a do atendimento, por exemplo)
            </label>
          </div>
          {scenario === "outra" ? (
            <div className="mt-3">
              <label htmlFor={id("custom-rate")} className="text-sm font-semibold text-brand-navy">
                Taxa ao mês
              </label>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  id={id("custom-rate")}
                  inputMode="decimal"
                  value={customRate}
                  onChange={(e) => setCustomRate(e.target.value)}
                  placeholder="0,50"
                  aria-invalid={errors.some((x) => x.field === "rate")}
                  aria-describedby={errorIds("rate")}
                  className="min-h-11 w-32 rounded-lg border border-brand-border bg-white px-3 py-2 text-brand-text"
                />
                <span className="text-sm text-brand-muted">% ao mês (até {CUSTOM_RATE_MAX_PERCENT}%)</span>
              </div>
            </div>
          ) : null}
          <FieldError id={id("err-rate")} issues={errors} field="rate" />
        </Step>

        <details className="mt-6 rounded-xl border border-brand-border">
          <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-semibold text-brand-navy">
            O atendimento informou algum custo? (opcional, para estimar o CET)
          </summary>
          <div className="border-t border-brand-border px-4 py-4">
            <p className="text-sm text-brand-muted">
              Informe só o que o atendimento passar por escrito: tarifa ou taxa cobrada na liberação. Não sabemos, pelas fontes
              oficiais, se há custos além dos juros.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label htmlFor={id("cost")} className="sr-only">
                Custos na liberação
              </label>
              <input
                id={id("cost")}
                inputMode="decimal"
                value={costValue}
                onChange={(e) => setCostValue(e.target.value)}
                aria-describedby={errorIds("costs")}
                className="min-h-11 w-32 rounded-lg border border-brand-border bg-white px-3 py-2 text-brand-text"
              />
              <label className={choiceClass(costKind === "reais")}>
                <input type="radio" name={id("cost-kind")} checked={costKind === "reais"} onChange={() => setCostKind("reais")} className="accent-brand-teal-dark" />
                em R$
              </label>
              <label className={choiceClass(costKind === "percent")}>
                <input type="radio" name={id("cost-kind")} checked={costKind === "percent"} onChange={() => setCostKind("percent")} className="accent-brand-teal-dark" />
                em % do valor
              </label>
            </div>
            <label className="mt-3 flex min-h-11 items-center gap-2 text-sm text-brand-text">
              <input type="checkbox" checked={costsComplete} onChange={(e) => setCostsComplete(e.target.checked)} className="h-4 w-4 accent-brand-teal-dark" />
              Esses são todos os custos que o atendimento informou (ou não há custos além dos juros)
            </label>
            <FieldError id={id("err-costs")} issues={errors} field="costs" />
          </div>
        </details>

        {errors.length > 0 ? (
          <div role="alert" className="mt-5 rounded-lg border border-brand-danger/40 bg-brand-danger-soft p-4 text-sm text-brand-danger">
            Revise os campos indicados acima.
          </div>
        ) : null}

        <button type="submit" className="mt-6 min-h-12 w-full rounded-lg bg-brand-teal-dark px-5 py-3 font-semibold text-white hover:bg-brand-teal sm:w-auto">
          Calcular estimativa
        </button>
      </form>

      {result ? (
        <div ref={resultRef} className="mt-8 scroll-mt-24 border-t border-brand-border pt-6" aria-live="polite">
          <h2 data-result-heading tabIndex={-1} className="font-serif text-xl font-bold text-brand-navy">
            Estimativa de parcela
          </h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-brand-teal-soft p-4 sm:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-brand-teal-dark">Parcela estimada</dt>
              <dd className="mt-1 text-3xl font-bold text-brand-navy">
                {result.months}x de {brl(result.paymentCents)}
              </dd>
              <dd className="mt-1 text-sm text-brand-text">
                {result.graceMonths > 0
                  ? `Primeira parcela no ${result.firstPaymentMonth}º mês, depois de ${result.graceMonths} ${result.graceMonths === 1 ? "mês" : "meses"} de carência.`
                  : "Primeira parcela um mês depois da liberação."}
                {result.lastPaymentCents !== result.paymentCents ? ` Última parcela de ${brl(result.lastPaymentCents)} (acerto de centavos).` : ""}
              </dd>
            </div>
            {[
              ["Valor solicitado", brl(result.amountCents)],
              ["Taxa usada na simulação", `${pct(result.monthlyRatePercent)}% ao mês (${pct(result.annualRatePercent)}% ao ano)`],
              ["Prazo", `${result.months} parcelas`],
              ["Carência", result.graceMonths === 0 ? "Sem carência" : `${result.graceMonths} ${result.graceMonths === 1 ? "mês" : "meses"} (juros de ${brl(result.graceInterestCents)} somados ao saldo)`],
              ["Total estimado das parcelas", brl(result.totalPaidCents)],
              ["Juros estimados", brl(result.totalInterestCents)],
              ["Custos adicionais", result.costsCents > 0 ? `${brl(result.costsCents)} informados por você` : "Não informados"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-brand-surface-soft p-4">
                <dt className="text-xs font-semibold uppercase tracking-wide text-brand-muted">{k}</dt>
                <dd className="mt-1 text-lg font-bold text-brand-navy">{v}</dd>
              </div>
            ))}
            <div className="rounded-xl bg-brand-surface-soft p-4">
              <dt className="text-xs font-semibold uppercase tracking-wide text-brand-muted">CET</dt>
              <dd className="mt-1 text-sm text-brand-text">
                {result.cet ? (
                  <span className="text-lg font-bold text-brand-navy">
                    {pct(result.cet.annualPercent)}% ao ano ({pct(result.cet.monthlyPercent)}% ao mês)
                  </span>
                ) : (
                  result.cetUnavailableReason
                )}
              </dd>
            </div>
          </dl>

          {range ? (
            <p className="mt-4 rounded-lg border border-brand-border p-3 text-sm text-brand-text">
              <strong>Faixa pelas taxas divulgadas:</strong> com o mesmo valor, prazo e carência, a parcela estimada fica entre{" "}
              {brl(range.low.paymentCents)} (0,35% ao mês) e {brl(range.high.paymentCents)} (1% ao mês). O total das parcelas
              vai de {brl(range.low.totalPaidCents)} a {brl(range.high.totalPaidCents)}.
            </p>
          ) : null}

          {warnings.length > 0 ? (
            <ul className="mt-4 space-y-1 rounded-lg bg-brand-warning-soft p-3 text-sm text-brand-warning">
              {warnings.map((w) => (
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
                  Fórmula: parcela = saldo × i ÷ [1 − (1 + i)<sup>−n</sup>], com i = {pct(result.monthlyRatePercent / 100, 4)} e n ={" "}
                  {result.months}.
                </li>
                <li>
                  Saldo no início das parcelas: {brl(result.balanceAfterGraceCents)}
                  {result.graceMonths > 0 ? " (valor pedido mais os juros da carência)" : ""}.
                </li>
                <li>Arredondamento ao centavo; a última parcela acerta a diferença.</li>
                <li>Custos considerados: {result.costsCents > 0 ? `${brl(result.costsCents)} na liberação, informados por você` : "nenhum"}.</li>
                <li>Não considerados: tarifas, taxas, seguros ou garantias que o atendimento não tenha informado.</li>
              </ul>
              <div className="mt-4 max-h-80 overflow-auto rounded-lg border border-brand-border">
                <table className="w-full min-w-[32rem] border-collapse text-sm">
                  <caption className="sr-only">Tabela mês a mês da estimativa</caption>
                  <thead className="sticky top-0 bg-brand-surface-soft text-left">
                    <tr>
                      {["Mês", "Parcela", "Juros", "Amortização", "Saldo"].map((h) => (
                        <th key={h} scope="col" className="px-3 py-2 font-bold text-brand-navy">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {result.schedule.map((r) => (
                      <tr key={r.month} className="border-t border-brand-border">
                        <td className="px-3 py-1.5">
                          {r.month}
                          {r.phase === "carencia" ? " (carência)" : ""}
                        </td>
                        <td className="px-3 py-1.5">{brl(r.paymentCents)}</td>
                        <td className="px-3 py-1.5">{brl(r.interestCents)}</td>
                        <td className="px-3 py-1.5">{brl(r.amortizationCents)}</td>
                        <td className="px-3 py-1.5">{brl(r.balanceCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <details
        className="mt-8 rounded-xl border border-brand-border"
        open={diagOpen}
        onToggle={(e) => {
          const open = e.currentTarget.open;
          setDiagOpen(open);
          if (open) track("bpp_eligibility_started", { context });
        }}
      >
        <summary className="min-h-11 cursor-pointer px-4 py-3 font-semibold text-brand-navy">
          Veja se você atende aos requisitos básicos
        </summary>
        <div className="border-t border-brand-border px-4 py-4">
          <p className="text-sm text-brand-muted">
            Perguntas baseadas nos requisitos divulgados. Não é aprovação: quem analisa é o programa. Nada do que você marcar sai do
            seu aparelho.
          </p>
          {(
            [
              ["hasActivity", "Você tem uma atividade produtiva (um negócio funcionando, formal ou informal)?"],
              ["activityInCity", "O negócio funciona na cidade onde você vai pedir o crédito?"],
              ["nameRestricted", "Seu nome (CPF ou CNPJ) tem alguma restrição, como no Serasa?"],
              ["training", "Você já fez a capacitação gratuita indicada pelo programa?"],
              ["sixMonths", "O negócio funciona há seis meses ou mais?"],
            ] as Array<[keyof typeof diag, string]>
          ).map(([key, q]) => (
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
                      onChange={() => setDiag((d) => ({ ...d, [key]: v }))}
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
              setDiagShown(true);
              track("bpp_eligibility_completed", { context, verdict: diagnosis.verdict });
            }}
            className="mt-5 min-h-11 rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy/90"
          >
            Ver o resultado
          </button>
          {diagShown ? (
            <div className="mt-5" aria-live="polite">
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
                  <li key={item.id} className="flex gap-2">
                    <span aria-hidden className="mt-0.5 shrink-0">
                      {item.status === "ok" ? "✓" : item.status === "verificar" ? "?" : "!"}
                    </span>
                    <span>
                      <span className="sr-only">
                        {item.status === "ok" ? "Atendido: " : item.status === "verificar" ? "Verificar: " : "Possível impedimento: "}
                      </span>
                      {item.text}
                      {item.id === "restricao" && item.status !== "ok" ? (
                        <>
                          {" "}
                          <Link href="/credito-seguro/consultar-nome-nos-biros-de-credito/">Como consultar o nome de graça</Link>.
                        </>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </details>

      <div className="mt-6 rounded-xl border border-brand-border p-4">
        <label htmlFor={id("city")} className="font-semibold text-brand-navy">
          Em qual cidade você está?
        </label>
        <p className="mt-1 text-sm text-brand-muted">O pedido começa no atendimento do município onde o negócio funciona.</p>
        <select
          id={id("city")}
          value={city}
          onChange={(e) => {
            setCity(e.target.value);
            const c = cities.find((x) => x.path === e.target.value);
            track("bpp_city_selected", { context, has_unit: c ? c.hasVerifiedUnit : false });
          }}
          className="mt-2 min-h-11 w-full rounded-lg border border-brand-border bg-white px-3 py-2.5 text-brand-text"
        >
          <option value="">Escolha a cidade</option>
          {cities.map((c) => (
            <option key={c.path} value={c.path}>
              {c.name}
            </option>
          ))}
          <option value="outra">Minha cidade não está na lista</option>
        </select>
        {selectedCity ? (
          <p className="mt-3 text-sm text-brand-text">
            {selectedCity.hasVerifiedUnit && selectedCity.checkedAt
              ? `O guia de ${selectedCity.name} traz o atendimento do Banco do Povo verificado em fonte oficial em ${isoToBR(selectedCity.checkedAt)}.`
              : `Não localizamos, em fonte oficial, o atendimento do Banco do Povo em ${selectedCity.name}. O guia da cidade traz os canais que confirmamos.`}{" "}
            <Link
              href={selectedCity.path}
              onClick={() => track("bpp_local_page_clicked", { context, has_unit: selectedCity.hasVerifiedUnit })}
              className="font-semibold"
            >
              Veja como solicitar em {selectedCity.name}
            </Link>
          </p>
        ) : city === "outra" ? (
          <p className="mt-3 text-sm text-brand-text">
            O site da prefeitura da sua cidade publica o endereço e o telefone do atendimento, quando o município opera o programa.
            Use sempre o contato publicado pela prefeitura ou pelo Governo do Estado.
          </p>
        ) : null}
      </div>

      <div className="mt-6">
        <p className="font-semibold text-brand-navy">Próximos passos</p>
        <ul className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
          <li>
            <Link href="/emprestimos/microcredito-produtivo-e-banco-do-povo/" className="font-semibold">
              Ver como solicitar
            </Link>{" "}
            — requisitos, capacitação e o que levar.
          </li>
          <li>
            <Link href="/emprestimos/emprestimo-para-mei/" className="font-semibold">
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
              className="font-semibold"
            >
              Acessar canal oficial
            </a>{" "}
            — página do programa no Governo do Estado.
          </li>
          <li>
            <Link href="/credito-seguro/deposito-antecipado-e-golpe/" className="font-semibold">
              Cuidado com golpe
            </Link>{" "}
            — o programa não cobra para liberar e não tem intermediário.
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
          {copied ? "Link copiado" : "Copiar link"}
        </button>
        <span className="text-xs text-brand-muted">O link leva só à página, sem os seus valores.</span>
      </div>
    </section>
  );
}
