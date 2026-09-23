"use client";

/**
 * CALCULADORA DE JUROS DO CARTÃO
 * ============================================================================
 *
 * Responde "quanto custa não pagar a fatura inteira" em UM ciclo: da fatura
 * atual até a próxima. O motor está em `lib/calculators/credit-card.ts`; as
 * regras (teto, duração do rotativo) em `credit-card-rules.ts`.
 *
 * DECISÕES QUE NÃO SÃO ÓBVIAS
 *
 * - Três campos na primeira dobra: fatura, quanto pagou, taxa. O resto —
 *   mínimo, atraso, IOF, teto — fica em "Tenho mais informações da fatura",
 *   que abre sozinho quando o pagamento fica abaixo do mínimo ou é zero,
 *   porque aí a conta é outra.
 *
 * - Nenhuma taxa pré-preenchida. A média do Banco Central para o rotativo
 *   entra só por botão, com mês de referência.
 *
 * - Multa e juros de mora não têm percentual padrão: a calculadora usa os
 *   que a pessoa informar, cada um na sua linha. IOF só como valor informado.
 *
 * - "Saldo estimado relacionado ao valor não pago", nunca "próxima fatura":
 *   a fatura seguinte traz compras novas, parcelas e tarifas que a
 *   calculadora não conhece.
 *
 * - Nada do que é digitado sai do navegador. Os eventos dizem só a FORMA de
 *   uso (situação, unidade da taxa), nunca valores.
 */

import Link from "next/link";
import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { track } from "@/lib/analytics/track";
import { parseBRLToCents, parsePercentBR } from "@/lib/calculators/proposal-comparison";
import {
  calculateLateCharges,
  extraPaymentScenarios,
  lowerRateScenarios,
  simulateCycle,
  toMonthlyRatePercent,
  type CardField,
  type CardIssue,
  type CycleResult,
  type LateCharges,
  type RateUnit,
} from "@/lib/calculators/credit-card";
import {
  applyRegulatoryCap,
  formatIsoDate,
  INTEREST_CAP,
  ROTATIVO_DURATION,
  type CapResult,
  type DebtStart,
} from "@/lib/calculators/credit-card-rules";
import { useRevealResult } from "./use-reveal-result";

export const CARD_PREFILL_EVENT = "cpp:simular-cartao";

export interface CardPrefillDetail {
  exampleId: string;
  invoiceCents: number;
  paidCents: number;
}

/** Média do BC para o rotativo, montada no servidor (SGS 25477). */
export interface RotativoReference {
  monthlyRatePercent: number;
  refMonthLabel: string;
  sourceUrl: string;
  seriesCode: number;
}

interface Fields {
  invoice: string;
  paid: string;
  rate: string;
  rateUnit: RateUnit;
  minimum: string;
  fine: string;
  mora: string;
  days: string;
  iof: string;
  other: string;
  start: DebtStart | "";
  original: string;
  charged: string;
}

const EMPTY: Fields = {
  invoice: "",
  paid: "",
  rate: "",
  rateUnit: "am",
  minimum: "",
  fine: "",
  mora: "",
  days: "",
  iof: "",
  other: "",
  start: "",
  original: "",
  charged: "",
};

const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
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
const optionalMoney = (raw: string) => (raw.trim() === "" ? undefined : parseMoney(raw));
const optionalPercent = (raw: string) => (raw.trim() === "" ? undefined : (parsePercentBR(raw) ?? Number.NaN));
const optionalInt = (raw: string) => (raw.trim() === "" ? undefined : /^\d+$/.test(raw.trim()) ? Number(raw) : Number.NaN);

interface Shown {
  cycle: CycleResult;
  late: LateCharges | null;
  cap: CapResult | null;
}

type ExtraField = "fine" | "mora" | "days" | "iof" | "other" | "original" | "charged";

/* ---------- peças ---------- */

const inputClass =
  "min-h-12 w-full min-w-0 rounded-lg border border-brand-border bg-white px-3 py-2.5 text-base text-brand-text tabular-nums focus:border-brand-teal aria-[invalid=true]:border-brand-danger";

function Field({
  id,
  label,
  hint,
  error,
  note,
  prefix,
  suffix,
  value,
  placeholder,
  inputMode = "decimal",
  onChange,
  onBlur,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  note?: React.ReactNode;
  prefix?: string;
  suffix?: string;
  value: string;
  placeholder: string;
  inputMode?: "decimal" | "numeric";
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
          inputMode={inputMode}
          autoComplete="off"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
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
      {note ? <div className="mt-1.5 text-sm text-brand-muted">{note}</div> : null}
    </div>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex shrink-0 flex-wrap rounded-lg border border-brand-border p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className="min-h-11 rounded-md px-3 text-sm font-semibold text-brand-muted aria-pressed:bg-brand-navy aria-pressed:text-white"
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

/** Botão dos exemplos da página: preenche a calculadora sem sair dela. */
export function SimulateCardButton({ label, detail }: { label: string; detail: CardPrefillDetail }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent<CardPrefillDetail>(CARD_PREFILL_EVENT, { detail }))}
      className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-brand-navy px-4 text-sm font-semibold text-brand-navy hover:bg-brand-teal-soft"
    >
      {label}
    </button>
  );
}

/* ---------- componente ---------- */

export function CreditCardInterestCalculator({
  reference,
  context = "ferramenta",
}: {
  reference: RotativoReference | null;
  context?: "ferramenta" | "artigo";
}) {
  const uid = useId();
  const id = (n: string) => `${uid}-${n}`;
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<CardIssue[]>([]);
  const [extraErrors, setExtraErrors] = useState<Partial<Record<ExtraField, string>>>({});
  const [warnings, setWarnings] = useState<CardIssue[]>([]);
  const [shown, setShown] = useState<Shown | null>(null);
  const [stale, setStale] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [examplePremise, setExamplePremise] = useState<string | null>(null);
  const [extraChoice, setExtraChoice] = useState(1);

  const started = useRef(false);
  const lateTracked = useRef(false);
  const rootRef = useRef<HTMLElement | null>(null);
  const { ref: resultRef, reveal } = useRevealResult();

  function compute(next: Fields, { announce }: { announce: boolean }) {
    const outcome = simulateCycle({
      invoiceCents: parseMoney(next.invoice),
      paidCents: next.paid.trim() === "" ? Number.NaN : parseMoney(next.paid),
      minimumCents: optionalMoney(next.minimum),
      ratePercent: parsePercentBR(next.rate) ?? Number.NaN,
      rateUnit: next.rateUnit,
    });

    const fine = optionalPercent(next.fine);
    const mora = optionalPercent(next.mora);
    const days = optionalInt(next.days);
    const iof = optionalMoney(next.iof);
    const other = optionalMoney(next.other);
    const original = optionalMoney(next.original);
    const charged = optionalMoney(next.charged);
    const extra: Partial<Record<ExtraField, string>> = {};
    const badPercent = (v: number | undefined) => v !== undefined && (!Number.isFinite(v) || v < 0);
    const badMoney = (v: number | undefined) => v !== undefined && (!Number.isFinite(v) || v < 0);
    if (badPercent(fine)) extra.fine = "Informe a multa em %, como está no contrato ou na fatura.";
    if (badPercent(mora)) extra.mora = "Informe os juros de mora em % ao mês.";
    if (days !== undefined && (!Number.isFinite(days) || days > 365)) extra.days = "Informe os dias de atraso (0 a 365).";
    if (badMoney(iof)) extra.iof = "Informe o IOF em reais, como aparece na fatura.";
    if (badMoney(other)) extra.other = "Informe o valor em reais.";
    if (badMoney(original)) extra.original = "Informe o valor em reais.";
    if (badMoney(charged)) extra.charged = "Informe o valor em reais.";

    if (outcome.kind === "invalid" || Object.keys(extra).length > 0) {
      setErrors(outcome.kind === "invalid" ? outcome.errors : []);
      setExtraErrors(extra);
      setWarnings([]);
      setStale(shown !== null);
      if (extra.fine || extra.mora || extra.days || extra.iof || extra.other || extra.original || extra.charged) setAdvancedOpen(true);
      return;
    }

    const cycle = outcome.result;
    const inLate = cycle.situation === "abaixo-do-minimo" || cycle.situation === "sem-pagamento";
    if (inLate) {
      setAdvancedOpen(true);
      if (!lateTracked.current) {
        lateTracked.current = true;
        track("credit_card_late_payment_mode", { context, situation: cycle.situation });
      }
    }
    const hasLateInput = [fine, mora, iof, other].some((v) => v !== undefined);
    const late =
      cycle.situation !== "quitada" && (inLate || hasLateInput)
        ? calculateLateCharges({
            baseCents: cycle.openCents,
            finePercent: inLate ? fine : undefined,
            moraMonthlyPercent: inLate ? mora : undefined,
            daysLate: inLate ? days : undefined,
            iofCents: iof,
            otherCents: other,
          })
        : null;
    const capCharges = cycle.interestCents + (late ? (late.fineCents ?? 0) + (late.moraCents ?? 0) + late.otherCents : 0);
    const cap =
      next.start !== "" && original !== undefined && original > 0 && cycle.situation !== "quitada"
        ? applyRegulatoryCap({
            originalCents: original,
            alreadyChargedCents: charged ?? 0,
            newChargesCents: capCharges,
            start: next.start,
          })
        : null;

    setErrors([]);
    setExtraErrors({});
    setWarnings(outcome.warnings);
    setStale(false);
    setShown({ cycle, late, cap });
    if (announce) {
      track("credit_card_interest_calculated", {
        context,
        situation: cycle.situation,
        rate_unit: next.rateUnit === "am" ? "mensal" : "anual",
        advanced_used: advancedOpen || inLate,
        reference_shown: Boolean(reference),
      });
    }
  }

  function update(patch: Partial<Fields>) {
    if (!started.current) {
      started.current = true;
      track("credit_card_interest_start", { context });
    }
    const next = { ...fields, ...patch };
    setFields(next);
    setExamplePremise(null);
    if (submitted) compute(next, { announce: false });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    compute(fields, { announce: true });
    reveal();
  }

  function applyReferenceRate() {
    if (!reference) return;
    track("credit_card_reference_use", { context });
    update({ rate: pct(reference.monthlyRatePercent), rateUnit: "am" });
  }

  function prefill(d: CardPrefillDetail) {
    track("credit_card_example_select", { context, example: d.exampleId });
    const next: Fields = {
      ...EMPTY,
      invoice: moneyInput(d.invoiceCents),
      paid: moneyInput(d.paidCents),
      rate: reference ? pct(reference.monthlyRatePercent) : "",
      rateUnit: "am",
    };
    setFields(next);
    setSubmitted(true);
    setExamplePremise(
      reference
        ? `Exemplo preenchido com a taxa média do rotativo no Banco Central em ${reference.refMonthLabel}. Troque pelos números da sua fatura.`
        : "Exemplo preenchido. Informe a taxa do rotativo que está na sua fatura para calcular.",
    );
    compute(next, { announce: true });
    rootRef.current?.scrollIntoView({ block: "start" });
    reveal();
  }
  const onPrefill = useEffectEvent((d: CardPrefillDetail) => prefill(d));
  useEffect(() => {
    const listener = (e: Event) => onPrefill((e as CustomEvent<CardPrefillDetail>).detail);
    window.addEventListener(CARD_PREFILL_EVENT, listener);
    return () => window.removeEventListener(CARD_PREFILL_EVENT, listener);
  }, []);

  const errorOf = (f: CardField) => errors.find((e) => e.field === f)?.message;
  const warningOf = (f: CardField) => warnings.find((w) => w.field === f)?.message;

  /* Ecos ao vivo. */
  const liveInvoice = parseMoney(fields.invoice);
  const livePaid = fields.paid.trim() === "" ? Number.NaN : parseMoney(fields.paid);
  const openEcho =
    Number.isFinite(liveInvoice) && Number.isFinite(livePaid) && liveInvoice > 0
      ? livePaid > liveInvoice
        ? null
        : `Ficou em aberto: ${brl(Math.max(liveInvoice - livePaid, 0))}`
      : null;
  const liveRate = parsePercentBR(fields.rate);
  const rateEcho =
    liveRate !== null
      ? fields.rateUnit === "am"
        ? `equivale a ${pct((Math.pow(1 + liveRate / 100, 12) - 1) * 100, 1)}% ao ano, por juros compostos`
        : `equivale a ${pct(toMonthlyRatePercent(liveRate, "aa"))}% ao mês`
      : null;

  const Title = context === "artigo" ? "h3" : "h2";
  const Sub = context === "artigo" ? "h4" : "h3";

  return (
    <section
      ref={rootRef}
      id="calculadora"
      aria-label="Calculadora de juros do cartão"
      className="scroll-mt-24 rounded-2xl border border-brand-border bg-white p-3 shadow-sm sm:p-6"
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id={id("fatura")}
            label="Valor total da fatura"
            hint="Use o valor total que venceu ou vai vencer."
            prefix="R$"
            placeholder="ex.: 5.000"
            value={fields.invoice}
            error={errorOf("invoiceCents")}
            onChange={(invoice) => update({ invoice })}
            onBlur={() => setFields((f) => ({ ...f, invoice: tidyMoney(f.invoice) }))}
          />
          <Field
            id={id("pago")}
            label="Quanto você pagou?"
            hint="Se não pagou nada, informe zero."
            prefix="R$"
            placeholder="ex.: 2.000"
            value={fields.paid}
            error={errorOf("paidCents")}
            note={openEcho ? <span aria-live="polite" className="font-semibold text-brand-navy">{openEcho}</span> : null}
            onChange={(paid) => update({ paid })}
            onBlur={() => setFields((f) => ({ ...f, paid: tidyMoney(f.paid) }))}
          />
          <div className="sm:col-span-2">
            <label htmlFor={id("taxa")} className="block text-sm font-semibold text-brand-navy">
              Taxa do crédito rotativo
            </label>
            <p id={`${id("taxa")}-hint`} className="mt-0.5 text-xs leading-relaxed text-brand-muted">
              Você encontra essa taxa na fatura ou no aplicativo do cartão.
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <input
                id={id("taxa")}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder={fields.rateUnit === "am" ? "ex.: 14,90" : "ex.: 430"}
                value={fields.rate}
                onChange={(e) => update({ rate: e.target.value })}
                aria-invalid={Boolean(errorOf("ratePercent"))}
                aria-describedby={[`${id("taxa")}-hint`, errorOf("ratePercent") ? `${id("taxa")}-erro` : null].filter(Boolean).join(" ")}
                className={`${inputClass} max-w-[12rem] flex-1`}
              />
              <span className="shrink-0 text-sm text-brand-muted" aria-hidden="true">%</span>
              <Segmented
                label="Unidade da taxa"
                value={fields.rateUnit}
                onChange={(rateUnit) => update({ rateUnit })}
                options={[
                  { value: "am", label: "ao mês" },
                  { value: "aa", label: "ao ano" },
                ]}
              />
            </div>
            {errorOf("ratePercent") ? (
              <p id={`${id("taxa")}-erro`} className="mt-1.5 text-sm font-medium text-brand-danger">{errorOf("ratePercent")}</p>
            ) : null}
            <div className="mt-1.5 space-y-1 text-sm text-brand-muted">
              {warningOf("ratePercent") ? <p className="font-medium text-brand-warning">{warningOf("ratePercent")}</p> : null}
              {rateEcho ? <p aria-live="polite">{rateEcho}</p> : null}
              {reference ? (
                <p>
                  Não achou a taxa?{" "}
                  <button type="button" onClick={applyReferenceRate} className="font-semibold text-brand-teal underline underline-offset-2">
                    Usar a média do Banco Central ({pct(reference.monthlyRatePercent)}% ao mês, {reference.refMonthLabel})
                  </button>
                </p>
              ) : null}
              <details>
                <summary className="min-h-11 cursor-pointer py-2 font-semibold text-brand-teal">Onde encontro a taxa?</summary>
                <p className="leading-relaxed text-brand-text">
                  Na fatura, procure por “crédito rotativo”, “juros do rotativo”, “taxa efetiva mensal” ou
                  “encargos de financiamento”. A fatura traz as taxas efetivas das formas de financiar o saldo e o
                  CET de cada uma. Use a taxa ao mês do rotativo.
                </p>
              </details>
            </div>
          </div>
        </div>

        <details
          open={advancedOpen}
          onToggle={(e) => {
            const open = (e.currentTarget as HTMLDetailsElement).open;
            if (open && !advancedOpen) track("credit_card_advanced_opened", { context });
            setAdvancedOpen(open);
          }}
          className="mt-5 rounded-lg border border-brand-border"
        >
          <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-semibold text-brand-navy">
            Tenho mais informações da fatura (opcional)
          </summary>
          <div className="space-y-6 border-t border-brand-border p-4">
            <Field
              id={id("minimo")}
              label="Pagamento mínimo informado na fatura"
              hint="Com ele, a calculadora sabe se o pagamento cobriu o mínimo. Não existe um percentual mínimo único: vale o da sua fatura."
              prefix="R$"
              placeholder="ex.: 750"
              value={fields.minimum}
              error={errorOf("minimumCents")}
              onChange={(minimum) => update({ minimum })}
              onBlur={() => setFields((f) => ({ ...f, minimum: tidyMoney(f.minimum) }))}
            />

            <fieldset>
              <legend className="text-sm font-bold text-brand-navy">Se pagou abaixo do mínimo ou não pagou</legend>
              <p className="mt-0.5 text-xs leading-relaxed text-brand-muted">
                Use os percentuais do seu contrato ou da fatura. A calculadora não preenche nenhum por conta própria.
              </p>
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                <Field id={id("multa")} label="Multa por atraso" suffix="%" placeholder="da fatura" value={fields.fine} error={extraErrors.fine} onChange={(fine) => update({ fine })} />
                <Field id={id("mora")} label="Juros de mora" suffix="% ao mês" placeholder="da fatura" value={fields.mora} error={extraErrors.mora} onChange={(mora) => update({ mora })} />
                <Field id={id("dias")} label="Dias de atraso" inputMode="numeric" placeholder="ex.: 30" value={fields.days} error={extraErrors.days} onChange={(days) => update({ days: days.replace(/\D/g, "") })} />
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id={id("iof")}
                label="IOF informado na fatura"
                hint="Só o valor que aparece na fatura. A calculadora não estima IOF."
                prefix="R$"
                placeholder="0,00"
                value={fields.iof}
                error={extraErrors.iof}
                onChange={(iof) => update({ iof })}
                onBlur={() => setFields((f) => ({ ...f, iof: tidyMoney(f.iof) }))}
              />
              <Field
                id={id("outros")}
                label="Outros encargos que você conhece"
                prefix="R$"
                placeholder="0,00"
                value={fields.other}
                error={extraErrors.other}
                onChange={(other) => update({ other })}
                onBlur={() => setFields((f) => ({ ...f, other: tidyMoney(f.other) }))}
              />
            </div>

            <fieldset>
              <legend className="text-sm font-bold text-brand-navy">Limite de juros e encargos (teto)</legend>
              <p className="mt-0.5 text-xs leading-relaxed text-brand-muted">
                A fatura deve mostrar o valor original da dívida e quanto já foi cobrado de juros e encargos. Com esses
                números, a calculadora compara com o limite.
              </p>
              <div className="mt-3">
                <p id={id("inicio-label")} className="text-sm font-semibold text-brand-navy">
                  Quando essa dívida começou?
                </p>
                <div className="mt-1.5">
                  <Segmented
                    label="Quando essa dívida começou"
                    value={fields.start}
                    onChange={(start) => update({ start })}
                    options={[
                      { value: "depois", label: `A partir de ${formatIsoDate(INTEREST_CAP.effectiveFrom)}` },
                      { value: "antes", label: "Antes" },
                      { value: "nao-sei", label: "Não sei" },
                    ]}
                  />
                </div>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field
                  id={id("original")}
                  label="Valor original da dívida"
                  prefix="R$"
                  placeholder="da fatura"
                  value={fields.original}
                  error={extraErrors.original}
                  onChange={(original) => update({ original })}
                  onBlur={() => setFields((f) => ({ ...f, original: tidyMoney(f.original) }))}
                />
                <Field
                  id={id("cobrado")}
                  label="Juros e encargos já cobrados"
                  hint="Sem o IOF, que fica fora do limite."
                  prefix="R$"
                  placeholder="0,00"
                  value={fields.charged}
                  error={extraErrors.charged}
                  onChange={(charged) => update({ charged })}
                  onBlur={() => setFields((f) => ({ ...f, charged: tidyMoney(f.charged) }))}
                />
              </div>
            </fieldset>
          </div>
        </details>

        {errors.length + Object.keys(extraErrors).length > 0 ? (
          <p role="alert" className="mt-4 rounded-lg border border-brand-danger/40 bg-brand-danger-soft p-3 text-sm text-brand-danger">
            {errors.length + Object.keys(extraErrors).length === 1
              ? "Um campo precisa de ajuste — ele está destacado acima."
              : "Alguns campos precisam de ajuste — eles estão destacados acima."}
          </p>
        ) : null}

        <button type="submit" className="mt-5 min-h-12 w-full rounded-lg bg-brand-teal-dark px-6 font-semibold text-white hover:bg-brand-teal sm:w-auto">
          Calcular juros
        </button>
        <p className="mt-3 text-xs text-brand-muted">
          Sem cadastro · Sem CPF · Cálculo educativo feito no seu aparelho: nada do que você digita é enviado.
        </p>
      </form>

      <p className="sr-only" aria-live="polite">
        {shown && !stale
          ? shown.cycle.situation === "quitada"
            ? "Fatura quitada nos valores informados: não há saldo para o rotativo."
            : `Ficou em aberto ${brl(shown.cycle.openCents)}. Juros estimados do período: ${brl(shown.cycle.interestCents)}.`
          : ""}
      </p>

      <div ref={resultRef} className="scroll-mt-24">
        {shown ? (
          <div className={`mt-6 border-t border-brand-border pt-6 ${stale ? "opacity-60" : ""}`}>
            {examplePremise ? <p className="mb-4 rounded-lg bg-brand-gold-soft px-3 py-2 text-sm text-brand-gold-dark">{examplePremise}</p> : null}
            {stale ? (
              <p className="mb-4 text-sm font-medium text-brand-warning">Resultado da última simulação válida. Ajuste o campo destacado para atualizar.</p>
            ) : null}
            <CardResult
              shown={shown}
              reference={reference}
              Title={Title}
              Sub={Sub}
              extraChoice={extraChoice}
              onExtraChoice={(k) => {
                setExtraChoice(k);
                track("credit_card_scenario_changed", { context, scenario: "pagar-mais" });
              }}
            />
          </div>
        ) : null}
      </div>

      <p className="mt-6 rounded-lg border border-brand-warning/30 bg-brand-warning-soft p-4 text-sm leading-relaxed text-brand-warning">
        Simulação educativa de um ciclo, com a taxa informada. Não é o valor da próxima fatura: ela pode trazer compras
        novas, parcelas, tarifas e IOF. Não é o CET. Os valores cobrados são os da fatura e do contrato.
      </p>
    </section>
  );
}

/* ---------- resultado ---------- */

function CardResult({
  shown,
  reference,
  Title,
  Sub,
  extraChoice,
  onExtraChoice,
}: {
  shown: Shown;
  reference: RotativoReference | null;
  Title: "h2" | "h3";
  Sub: "h3" | "h4";
  extraChoice: number;
  onExtraChoice: (k: number) => void;
}) {
  const { cycle: c, late, cap } = shown;

  if (c.situation === "quitada") {
    return (
      <>
        <Title tabIndex={-1} data-result-heading className="font-serif text-xl font-bold text-brand-navy">
          Fatura quitada nos valores informados
        </Title>
        <dl className="mt-3">
          <Row label="Fatura" value={brl(c.invoiceCents)} />
          <Row label="Você pagou" value={brl(c.paidCents)} />
          <Row label="Saldo financiado no rotativo" value={brl(0)} strong />
        </dl>
        <p className="mt-3 text-sm text-brand-text">Pagando o total até o vencimento, não há saldo para o rotativo nem juros sobre ele.</p>
      </>
    );
  }

  const inLate = c.situation === "abaixo-do-minimo" || c.situation === "sem-pagamento";
  const lateLines = late
    ? [
        { key: "multa", label: "Multa", value: late.fineCents, cls: "bg-brand-warning" },
        { key: "mora", label: "Juros de mora", value: late.moraCents, cls: "bg-brand-amber" },
        { key: "outros", label: "Outros encargos informados", value: late.otherCents || null, cls: "bg-brand-muted" },
        { key: "iof", label: "IOF informado", value: late.iofCents || null, cls: "bg-brand-teal" },
      ]
    : [];
  const lateTotal = late?.totalCents ?? 0;
  const estimated = c.openCents + c.interestCents + lateTotal;
  const segments = [
    { key: "saldo", label: "Saldo não pago", value: c.openCents, cls: "bg-brand-navy" },
    { key: "juros", label: "Juros do período", value: c.interestCents, cls: "bg-brand-gold" },
    ...lateLines.filter((l) => (l.value ?? 0) > 0).map((l) => ({ ...l, value: l.value as number })),
  ].filter((s) => s.value > 0);
  const scenarios = extraPaymentScenarios(c);
  const active = scenarios[Math.min(extraChoice, scenarios.length - 1)];
  const lower = lowerRateScenarios(c);

  return (
    <>
      {inLate ? (
        <div role="note" className="mb-5 rounded-xl border border-brand-warning/40 bg-brand-warning-soft p-4 text-sm leading-relaxed text-brand-text">
          <p className="font-semibold text-brand-warning">
            {c.situation === "sem-pagamento"
              ? "Pelos valores informados, a fatura não foi paga."
              : "Pelos valores informados, o pagamento ficou abaixo do mínimo indicado."}
          </p>
          <p className="mt-1">
            Essa situação pode envolver encargos de atraso — multa e juros de mora — além dos juros do rotativo. Eles
            aparecem abaixo em linhas separadas, só com os percentuais que você informar.
          </p>
        </div>
      ) : null}

      <Title tabIndex={-1} data-result-heading className="font-serif text-xl font-bold text-brand-navy">
        Sua fatura em números
      </Title>
      <dl className="mt-3">
        <Row label="Fatura" value={brl(c.invoiceCents)} />
        <Row label="Você pagou" value={brl(c.paidCents)} />
        <Row label="Ficou em aberto" value={brl(c.openCents)} />
        <Row label="Juros estimados do período" note={`${pct(c.monthlyRatePercent)}% ao mês, um ciclo até a próxima fatura`} value={brl(c.interestCents)} />
        {late?.fineCents != null ? <Row label="Multa" note="percentual informado, sobre o valor em aberto" value={brl(late.fineCents)} /> : null}
        {late?.moraCents != null ? <Row label="Juros de mora" note="proporcional aos dias informados" value={brl(late.moraCents)} /> : null}
        {late && late.otherCents > 0 ? <Row label="Outros encargos informados" value={brl(late.otherCents)} /> : null}
        {late && late.iofCents > 0 ? <Row label="IOF informado" value={brl(late.iofCents)} /> : null}
        <Row label="Saldo estimado relacionado ao valor não pago" value={brl(estimated)} strong />
      </dl>
      {c.minimumUnknown ? (
        <p className="mt-2 text-xs text-brand-muted">
          Sem o pagamento mínimo informado, a simulação considera que o valor pago cobriu o mínimo. Se não cobriu, informe o
          mínimo em “Tenho mais informações da fatura”.
        </p>
      ) : null}
      {inLate && late && late.fineCents === null && late.moraCents === null ? (
        <p className="mt-2 text-xs text-brand-muted">
          Multa e juros de mora não entraram: informe os percentuais do contrato ou da fatura para incluí-los.
        </p>
      ) : null}

      <p className="mt-4 rounded-xl bg-brand-teal-soft p-4 leading-relaxed text-brand-text">
        De uma fatura de {brl(c.invoiceCents)}, você pagou {brl(c.paidCents)}. Restaram {brl(c.openCents)}. Com a taxa
        informada e as demais premissas desta simulação, o custo financeiro estimado do período é de{" "}
        {brl(c.interestCents + lateTotal)}, levando o saldo relacionado à dívida para aproximadamente {brl(estimated)}.
      </p>

      {/* De onde vem o novo saldo */}
      <figure className="mt-6">
        <figcaption className="font-serif text-lg font-bold text-brand-navy">De onde vem o saldo estimado</figcaption>
        <div
          role="img"
          aria-label={`Composição do saldo estimado de ${brl(estimated)}: ${segments.map((s) => `${s.label}, ${brl(s.value)}`).join("; ")}.`}
          className="mt-3 flex h-6 w-full overflow-hidden rounded-md"
        >
          {segments.map((s) => (
            <div key={s.key} className={s.cls} style={{ width: `${(s.value / estimated) * 100}%` }} />
          ))}
        </div>
        <ul className="mt-3 space-y-1 text-sm" aria-hidden="true">
          {segments.map((s) => (
            <li key={s.key} className="flex items-center gap-2">
              <span className={`inline-block h-3 w-3 shrink-0 rounded-sm ${s.cls}`} />
              <span className="text-brand-text">{s.label}</span>
              <span className="ml-auto font-semibold tabular-nums">{brl(s.value)}</span>
            </li>
          ))}
        </ul>
      </figure>

      {/* Assinatura */}
      <div className="mt-6 overflow-hidden rounded-xl border border-brand-border">
        <div className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">O número que aparece</p>
          <p className="mt-1 font-serif text-xl font-bold text-brand-navy">Taxa: {pct(c.monthlyRatePercent)}% ao mês</p>
        </div>
        <div className="border-t border-brand-border bg-brand-gold-soft p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-gold-dark">O número que quase ninguém olha</p>
          <p className="mt-1 text-brand-text">
            Neste saldo, essa taxa representa aproximadamente <strong className="tabular-nums">{brl(c.interestCents)}</strong> de
            juros em um ciclo mensal completo, antes de outros encargos. Em taxa equivalente anual, por juros compostos, são{" "}
            {pct(c.annualRatePercent, 0)}% ao ano — o que não é o CET.
          </p>
        </div>
        <div className="border-t border-brand-border p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">O que pode chegar na próxima fatura relacionado a essa dívida</p>
          <p className="mt-1 font-serif text-xl font-bold tabular-nums text-brand-navy">{brl(estimated)}</p>
        </div>
      </div>

      {/* Próxima fatura */}
      <div className="mt-6">
        <Sub className="font-serif text-lg font-bold text-brand-navy">Sua próxima fatura pode conter</Sub>
        <dl className="mt-2">
          <Row label="Saldo anterior financiado" value={brl(c.openCents)} />
          <Row label="+ Juros e encargos estimados" value={brl(c.interestCents + lateTotal)} />
          <Row label="+ Compras novas" value="não incluídas" />
          <Row label="+ Parcelas de compras anteriores" value="não incluídas" />
          <Row label="+ Anuidade, tarifas e outras cobranças" value="não incluídas" />
        </dl>
      </div>

      {/* Depois do próximo vencimento */}
      <div className="mt-6 rounded-xl border border-brand-border p-4 text-sm leading-relaxed text-brand-text">
        <Sub className="font-semibold text-brand-navy">E depois do próximo vencimento?</Sub>
        <p className="mt-1">
          {ROTATIVO_DURATION.summary} Por isso esta calculadora simula um ciclo só, e não vários meses de rotativo.
        </p>
      </div>

      {/* Contrafactual factual */}
      <div className="mt-6">
        <Sub className="font-serif text-lg font-bold text-brand-navy">Se a fatura tivesse sido quitada no vencimento</Sub>
        <dl className="mt-2">
          <Row label="Saldo financiado" value={brl(0)} />
          <Row label="Juros do rotativo" value={brl(0)} />
        </dl>
      </div>

      {/* E se pagasse mais? */}
      {scenarios.length > 1 && active ? (
        <div className="mt-6">
          <Sub className="font-serif text-lg font-bold text-brand-navy">Quanto muda se pagar mais agora?</Sub>
          <div role="group" aria-label="Pagar mais agora" className="mt-3 flex flex-wrap gap-2">
            {scenarios.map((s, k) => (
              <button
                key={s.extraCents}
                type="button"
                aria-pressed={active === s}
                onClick={() => onExtraChoice(k)}
                className="min-h-11 rounded-lg border border-brand-border px-3 text-sm font-medium text-brand-navy aria-pressed:border-brand-navy aria-pressed:bg-brand-navy aria-pressed:text-white"
              >
                {s.openCents === 0 ? "Pagar o total" : `+ ${brl(s.extraCents)}`}
              </button>
            ))}
          </div>
          <dl className="mt-3 divide-y divide-brand-border rounded-xl border border-brand-border">
            {[
              { label: "Saldo que iria para o rotativo", a: c.openCents, b: active.openCents },
              { label: "Juros do próximo período", a: c.interestCents, b: active.interestCents },
            ].map((row) => (
              <div key={row.label} className="px-3 py-2.5">
                <dt className="text-sm font-medium text-brand-text">{row.label}</dt>
                <dd className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-sm tabular-nums">
                  <span className="text-brand-muted"><span className="sr-only">agora, </span>{brl(row.a)}</span>
                  <span aria-hidden="true" className="text-brand-muted">→</span>
                  <span className="font-semibold text-brand-navy"><span className="sr-only">no cenário, </span>{brl(row.b)}</span>
                  <span className="ml-auto font-semibold"><span className="sr-only">diferença: </span>−{brl(row.a - row.b)}</span>
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs text-brand-muted">Cenários matemáticos, com a mesma taxa. Quanto pagar é decisão sua.</p>
        </div>
      ) : null}

      {/* E se a taxa fosse menor? */}
      {lower.length > 0 || reference ? (
        <div className="mt-6">
          <Sub className="font-serif text-lg font-bold text-brand-navy">E se a taxa fosse menor?</Sub>
          <dl className="mt-2">
            {lower.map((l) => (
              <Row
                key={l.cutPoints}
                label={`${pct(l.monthlyRatePercent)}% ao mês (${l.cutPoints} ponto${l.cutPoints > 1 ? "s" : ""} a menos)`}
                value={`${brl(l.interestCents)} · −${brl(l.savedCents)}`}
              />
            ))}
          </dl>
          {reference ? (
            <div className="mt-4 rounded-xl border border-brand-border p-4 text-sm leading-relaxed">
              <dl>
                <Row label="Sua taxa" value={`${pct(c.monthlyRatePercent)}% ao mês`} />
                <Row label="Média do rotativo no Banco Central" note={`pessoas físicas · ${reference.refMonthLabel}`} value={`${pct(reference.monthlyRatePercent)}% ao mês`} />
              </dl>
              <p className="mt-2 text-brand-text">
                A média de mercado não é a taxa que você necessariamente receberá: ela reúne instituições e perfis diferentes.
                Fonte:{" "}
                <a href={reference.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                  Banco Central do Brasil, série {reference.seriesCode}
                </a>
                .
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-brand-muted">Referência de mercado temporariamente indisponível.</p>
          )}
          <p className="mt-2 text-xs text-brand-muted">Cenários matemáticos: não indicam a taxa que você conseguiria.</p>
        </div>
      ) : null}

      {/* Teto */}
      <div className="mt-6 rounded-xl border border-brand-border p-4 text-sm leading-relaxed text-brand-text">
        <Sub className="font-semibold text-brand-navy">Existe limite para os juros do cartão?</Sub>
        <p className="mt-1">{INTEREST_CAP.summary}</p>
        {cap ? <CapNote cap={cap} /> : (
          <p className="mt-2 text-brand-muted">
            Para comparar com o limite, informe o valor original e os encargos já cobrados em “Tenho mais informações da fatura”.
          </p>
        )}
        <p className="mt-2 text-xs text-brand-muted">
          Fonte:{" "}
          <a href={INTEREST_CAP.source.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
            {INTEREST_CAP.source.organization}
          </a>
          . Informações verificadas em {INTEREST_CAP.verifiedAt}.
        </p>
      </div>

      {/* Próximos passos */}
      <div className="mt-6 space-y-3 text-sm">
        <p>
          <span className="text-brand-muted">Não consegue quitar o saldo?</span>{" "}
          <Link href="/organizacao-financeira/como-sair-do-rotativo/" className="font-semibold text-brand-teal underline underline-offset-2">
            Veja como sair do rotativo
          </Link>
        </p>
        <p>
          <span className="text-brand-muted">Recebeu uma opção de parcelamento da fatura?</span>{" "}
          <Link href="/calculadoras/comparador-de-propostas/" className="font-semibold text-brand-teal underline underline-offset-2">
            Compare o CET das opções
          </Link>{" "}
          <span className="text-brand-muted">— parcelamento e rotativo têm custos diferentes.</span>
        </p>
        <p>
          <span className="text-brand-muted">Pensando em pegar outro crédito para quitar o cartão?</span>{" "}
          <Link href="/calculadoras/trocar-divida/" className="font-semibold text-brand-teal underline underline-offset-2">
            Compare o custo das duas dívidas antes
          </Link>
        </p>
      </div>

      <details className="mt-6 rounded-xl border border-brand-border">
        <summary className="min-h-11 cursor-pointer px-4 py-3 font-semibold text-brand-navy">Ver fórmula</summary>
        <div className="space-y-1 border-t border-brand-border p-4 text-sm leading-relaxed text-brand-text">
          <p>Saldo em aberto = fatura − valor pago (nunca negativo).</p>
          <p>Juros do período = saldo em aberto × taxa efetiva mensal (um ciclo mensal completo).</p>
          <p>Taxa anual informada → mensal equivalente: (1 + anual)^(1/12) − 1. Nunca anual ÷ 12.</p>
          <p>Multa = saldo em aberto × multa informada. Mora = saldo em aberto × mora ao mês × dias ÷ 30.</p>
          <p>Saldo estimado = saldo em aberto + juros + encargos informados. Valores arredondados ao centavo.</p>
        </div>
      </details>
    </>
  );
}

function CapNote({ cap }: { cap: CapResult }) {
  if (cap.status === "nao-se-aplica") {
    return <p className="mt-2">Pelo que você informou, a dívida começou antes da vigência do limite, e a regra pode não alcançá-la. Confira na fatura.</p>;
  }
  if (cap.status === "dentro") {
    return (
      <p className="mt-2">
        Pelos valores informados, os encargos desta simulação ficam dentro do limite: ainda cabem {brl(cap.roomCents)} de juros e
        encargos sobre um valor original de {brl(cap.capCents)}.
      </p>
    );
  }
  const exceeds = cap.status === "ultrapassaria" || (cap.status === "incerto" && cap.wouldExceed);
  if (!exceeds) {
    return <p className="mt-2">Pelos valores informados, os encargos ficariam dentro do limite — se a dívida for alcançada pela regra.</p>;
  }
  return (
    <div role="note" className="mt-2 rounded-lg bg-brand-warning-soft p-3">
      <p className="font-semibold text-brand-warning">Atenção à regra aplicável</p>
      <p className="mt-1">
        Pelos dados informados, o valor calculado ultrapassaria em {brl(cap.excessCents)} o limite previsto para operações
        alcançadas pela regra. Confira a origem da dívida, os valores na fatura e os encargos cobrados.
      </p>
    </div>
  );
}
