"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRevealResult } from "./use-reveal-result";
import { track } from "@/lib/analytics/track";
import {
  buildPlainSummary,
  compareDebtSwitch,
  type CurrentDebtInput,
  type DebtModality,
  type DebtSwitchResult,
  type NewOfferInput,
  type SwitchType,
} from "@/lib/calculators/debt-switch";
import {
  formatCentsBRL,
  parseBRLToCents,
  parsePercentBR,
} from "@/lib/calculators/proposal-comparison";

/* Eventos de uso — NUNCA valores, saldos, taxas ou instituições. */

type TriState = "yes" | "no" | "unknown";

interface FormState {
  switchType: string;
  payoff: string;
  installment: string;
  remaining: string;
  fixed: TriState;
  officialTotal: string;
  currentRate: string;
  currentRatePeriod: "month" | "year";
  currentCet: string;
  modality: DebtModality;
  newAmount: string;
  newInstallment: string;
  newCount: string;
  newRate: string;
  newRatePeriod: "month" | "year";
  newCet: string;
  externalCosts: string;
  cashOut: TriState;
  cashOutValue: string;
  upfront: "yes" | "no";
  guarantee: TriState;
}

const EMPTY: FormState = {
  switchType: "",
  payoff: "",
  installment: "",
  remaining: "",
  fixed: "yes",
  officialTotal: "",
  currentRate: "",
  currentRatePeriod: "month",
  currentCet: "",
  modality: "nao-sei",
  newAmount: "",
  newInstallment: "",
  newCount: "",
  newRate: "",
  newRatePeriod: "month",
  newCet: "",
  externalCosts: "",
  cashOut: "no",
  cashOutValue: "",
  upfront: "no",
  guarantee: "unknown",
};

const EXAMPLE: FormState = {
  ...EMPTY,
  payoff: "8.000,00",
  installment: "800,00",
  remaining: "12",
  newAmount: "8.000,00",
  newInstallment: "500,00",
  newCount: "18",
};

const SWITCH_TYPE_MAP: Record<string, SwitchType> = {
  portabilidade: "portability",
  renegociacao: "renegotiation",
  "emprestimo-novo": "new-loan",
};

function toCents(raw: string): number | null {
  if (raw.trim() === "") return null;
  return parseBRLToCents(raw);
}

function toCount(raw: string): number | null {
  const n = Number(raw.trim());
  return Number.isInteger(n) && n > 0 && n <= 1200 ? n : null;
}

function toPercent(raw: string): number | null {
  if (raw.trim() === "") return null;
  return parsePercentBR(raw);
}

function Field({
  id,
  label,
  value,
  onChange,
  hint,
  numeric,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  numeric?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-brand-navy">
        {label}
      </label>
      {hint ? <p className="mt-0.5 text-xs text-brand-muted">{hint}</p> : null}
      <input
        id={id}
        type="text"
        inputMode={numeric ? "numeric" : "decimal"}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border border-brand-border bg-white px-4 py-3 text-base text-brand-text outline-none focus:border-brand-teal"
      />
    </div>
  );
}

function Radio3({
  legend,
  name,
  value,
  onChange,
  labels = { yes: "Sim", no: "Não", unknown: "Não sei" },
  hideUnknown,
}: {
  legend: string;
  name: string;
  value: TriState;
  onChange: (v: TriState) => void;
  labels?: { yes: string; no: string; unknown: string };
  hideUnknown?: boolean;
}) {
  const options: TriState[] = hideUnknown ? ["yes", "no"] : ["yes", "no", "unknown"];
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-brand-navy">{legend}</legend>
      <div className="mt-1 flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            key={option}
            className={`cursor-pointer rounded-lg border px-3 py-2 text-sm ${
              value === option
                ? "border-brand-teal bg-brand-surface-soft font-semibold text-brand-navy"
                : "border-brand-border bg-white text-brand-text"
            }`}
          >
            <input
              type="radio"
              name={name}
              className="sr-only"
              checked={value === option}
              onChange={() => onChange(option)}
            />
            {labels[option]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function DiffCard({
  title,
  diff,
  unit,
}: {
  title: string;
  diff: number | null;
  unit: "money" | "months";
}) {
  let body = "—";
  let tone = "text-brand-muted";
  let direction = "";
  if (diff !== null) {
    if (diff === 0) {
      body = "não muda";
    } else {
      direction = diff < 0 ? "↓" : "↑";
      tone = diff < 0 ? "text-brand-teal-dark" : "text-brand-warning";
      body =
        unit === "money"
          ? formatCentsBRL(Math.abs(diff))
          : `${Math.abs(diff)} ${Math.abs(diff) === 1 ? "mês" : "meses"}`;
    }
  }
  return (
    <div className="rounded-xl border border-brand-border bg-white p-4 text-center">
      <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">{title}</p>
      <p className={`mt-1 font-serif text-xl font-bold ${tone}`}>
        {direction ? `${direction} ` : ""}
        {body}
      </p>
      <p className="mt-0.5 text-xs text-brand-muted">
        {diff === null
          ? "sem dados suficientes"
          : diff === 0
            ? ""
            : diff < 0
              ? unit === "money"
                ? "a menos"
                : "a menos pagando"
              : unit === "money"
                ? "a mais"
                : "a mais pagando"}
      </p>
    </div>
  );
}

export function DebtSwitchComparator() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [result, setResult] = useState<DebtSwitchResult | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const startedRef = useRef(false);

  const { ref: resultRef, reveal } = useRevealResult();

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    if (!startedRef.current) {
      startedRef.current = true;
      track("debt_switch_start");
    }
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function compare() {
    const problems: string[] = [];
    const installmentCents = toCents(form.installment);
    const remaining = toCount(form.remaining);
    const newInstallmentCents = toCents(form.newInstallment);
    const newCount = toCount(form.newCount);

    if (form.installment.trim() === "" || installmentCents === null)
      problems.push("Informe o valor da parcela atual (ex.: 800,00).");
    if (form.remaining.trim() === "" || remaining === null)
      problems.push("Informe quantas parcelas ainda faltam na dívida atual.");
    if (form.newInstallment.trim() === "" || newInstallmentCents === null)
      problems.push("Informe o valor da nova parcela.");
    if (form.newCount.trim() === "" || newCount === null)
      problems.push("Informe o número de parcelas da nova condição.");
    if (form.cashOut === "yes" && toCents(form.cashOutValue) === null)
      problems.push("Informe quanto dinheiro extra a nova operação libera.");

    setErrors(problems);
    reveal();
    if (problems.length > 0) {
      setResult(null);
      return;
    }

    const current: CurrentDebtInput = {
      payoffBalanceCents: toCents(form.payoff),
      installmentCents,
      remainingInstallments: remaining,
      fixedInstallments: form.fixed,
      officialFutureTotalCents: toCents(form.officialTotal),
      rate:
        toPercent(form.currentRate) !== null
          ? { percent: toPercent(form.currentRate)!, period: form.currentRatePeriod }
          : null,
      cetAnnualPercent: toPercent(form.currentCet),
      modality: form.modality,
    };
    const offer: NewOfferInput = {
      amountCents: toCents(form.newAmount),
      installmentCents: newInstallmentCents,
      installments: newCount,
      rate:
        toPercent(form.newRate) !== null
          ? { percent: toPercent(form.newRate)!, period: form.newRatePeriod }
          : null,
      cetAnnualPercent: toPercent(form.newCet),
      externalCostsCents: toCents(form.externalCosts),
      cashOut: form.cashOut,
      cashOutCents: toCents(form.cashOutValue),
      upfrontPaymentAsked: form.upfront === "yes",
      newGuarantee: form.guarantee,
    };

    const r = compareDebtSwitch(current, offer, SWITCH_TYPE_MAP[form.switchType] ?? "unknown");
    setResult(r);
    reveal();
    track("debt_switch_complete");
    if (r.completeness === "partial") track("debt_switch_partial_result");
    if (r.warnings.includes("upfront-payment-alert")) track("debt_switch_fraud_warning");
  }

  function clearAll() {
    setForm(EMPTY);
    setResult(null);
    setErrors([]);
  }

  const plain = result ? buildPlainSummary(result) : null;
  const upfrontAlert = result?.warnings.includes("upfront-payment-alert") ?? false;
  const newInstitution =
    form.switchType === "portabilidade" || form.switchType === "emprestimo-novo";

  return (
    <section
      aria-label="Comparação entre a dívida atual e a nova condição"
      className="rounded-2xl border border-brand-border bg-brand-surface-soft/50 p-4 sm:p-6"
    >
      <p className="text-sm leading-relaxed text-brand-muted">
        Grátis, sem cadastro e sem CPF. Seus números ficam no seu dispositivo durante esta
        comparação — nada é enviado ou salvo.
      </p>

      <div className="mt-4">
        <label htmlFor="tipo-troca" className="block text-sm font-semibold text-brand-navy">
          Como sua dívida seria trocada? <span className="font-normal text-brand-muted">(opcional)</span>
        </label>
        <select
          id="tipo-troca"
          value={form.switchType}
          onChange={(e) => set("switchType", e.target.value)}
          className="mt-1 w-full rounded-xl border border-brand-border bg-white px-4 py-3 text-base text-brand-text outline-none focus:border-brand-teal"
        >
          <option value="">Prefiro não classificar / não sei</option>
          <option value="portabilidade">Outra instituição ofereceu portabilidade</option>
          <option value="renegociacao">Meu banco ofereceu uma renegociação</option>
          <option value="emprestimo-novo">Quero pegar outro empréstimo para quitar esta dívida</option>
          <option value="outro">Recebi outra proposta / outro</option>
        </select>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <fieldset className="rounded-xl border border-brand-border bg-white p-4">
          <legend className="px-1 font-serif text-lg font-bold text-brand-navy">
            1. Sua dívida atual
          </legend>
          <div className="space-y-4">
            <Field
              id="payoff"
              label="Quanto custa quitar sua dívida hoje? (R$)"
              hint="Use de preferência o saldo atualizado para quitação informado pela instituição."
              value={form.payoff}
              onChange={(v) => set("payoff", v)}
              placeholder="8.430,00"
            />
            <details className="text-sm">
              <summary className="cursor-pointer font-medium text-brand-teal-dark">
                Onde encontro isso?
              </summary>
              <p className="mt-2 leading-relaxed text-brand-text">
                No aplicativo ou atendimento do seu banco, peça o <strong>saldo para quitação
                antecipada</strong> (ou o extrato/documento descritivo do contrato — a instituição
                é obrigada a fornecer as informações da sua dívida). Esse valor costuma ser menor
                que a soma das parcelas restantes, porque quitar antes reduz proporcionalmente os
                juros. Se não souber agora, dá para continuar sem ele — o resultado fica parcial.
              </p>
            </details>
            <Field
              id="installment"
              label="Parcela atual (R$)"
              value={form.installment}
              onChange={(v) => set("installment", v)}
              placeholder="800,00"
            />
            <Field
              id="remaining"
              label="Parcelas restantes"
              value={form.remaining}
              onChange={(v) => set("remaining", v)}
              numeric
              placeholder="12"
            />
            <Radio3
              legend="Suas parcelas restantes têm o mesmo valor?"
              name="fixed"
              value={form.fixed}
              onChange={(v) => set("fixed", v)}
            />
            <details className="text-sm">
              <summary className="cursor-pointer font-medium text-brand-teal-dark">
                Adicionar taxa, CET e modalidade (opcional)
              </summary>
              <div className="mt-3 space-y-4">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Field
                      id="current-rate"
                      label="Taxa de juros atual (%)"
                      value={form.currentRate}
                      onChange={(v) => set("currentRate", v)}
                      placeholder="4,2"
                    />
                  </div>
                  <div>
                    <label htmlFor="current-rate-period" className="block text-sm font-semibold text-brand-navy">
                      Período
                    </label>
                    <select
                      id="current-rate-period"
                      value={form.currentRatePeriod}
                      onChange={(e) => set("currentRatePeriod", e.target.value as "month" | "year")}
                      className="mt-1 rounded-xl border border-brand-border bg-white px-3 py-3 text-base"
                    >
                      <option value="month">ao mês</option>
                      <option value="year">ao ano</option>
                    </select>
                  </div>
                </div>
                <Field
                  id="current-cet"
                  label="CET atual (% ao ano)"
                  value={form.currentCet}
                  onChange={(v) => set("currentCet", v)}
                  placeholder="41,5"
                />
                <div>
                  <label htmlFor="modality" className="block text-sm font-semibold text-brand-navy">
                    Modalidade
                  </label>
                  <select
                    id="modality"
                    value={form.modality}
                    onChange={(e) => set("modality", e.target.value as DebtModality)}
                    className="mt-1 w-full rounded-xl border border-brand-border bg-white px-4 py-3 text-base"
                  >
                    <option value="nao-sei">Não sei / prefiro não dizer</option>
                    <option value="pessoal">Empréstimo pessoal</option>
                    <option value="consignado">Consignado</option>
                    <option value="cartao">Cartão de crédito</option>
                    <option value="cheque-especial">Cheque especial</option>
                    <option value="financiamento">Financiamento</option>
                    <option value="outra">Outra</option>
                  </select>
                </div>
                <Field
                  id="official-total"
                  label="Total restante informado pela instituição (R$, opcional)"
                  hint="Se a instituição informou quanto você pagaria ao todo mantendo o contrato, use esse valor."
                  value={form.officialTotal}
                  onChange={(v) => set("officialTotal", v)}
                />
              </div>
            </details>
          </div>
        </fieldset>

        <fieldset className="rounded-xl border border-brand-border bg-white p-4">
          <legend className="px-1 font-serif text-lg font-bold text-brand-navy">
            2. A nova condição
          </legend>
          <div className="space-y-4">
            <Field
              id="new-amount"
              label="Valor da nova operação (R$)"
              hint="Quanto será contratado para quitar a dívida atual."
              value={form.newAmount}
              onChange={(v) => set("newAmount", v)}
              placeholder="8.000,00"
            />
            <Field
              id="new-installment"
              label="Nova parcela (R$)"
              value={form.newInstallment}
              onChange={(v) => set("newInstallment", v)}
              placeholder="500,00"
            />
            <Field
              id="new-count"
              label="Número de parcelas"
              value={form.newCount}
              onChange={(v) => set("newCount", v)}
              numeric
              placeholder="18"
            />
            <Radio3
              legend="A nova operação também vai liberar dinheiro extra para você?"
              name="cashout"
              value={form.cashOut}
              onChange={(v) => set("cashOut", v)}
            />
            {form.cashOut === "yes" ? (
              <Field
                id="cashout-value"
                label="Quanto? (R$)"
                value={form.cashOutValue}
                onChange={(v) => set("cashOutValue", v)}
                placeholder="3.000,00"
              />
            ) : null}
            <Radio3
              legend="Pediram algum pagamento ANTES de liberar o dinheiro?"
              name="upfront"
              value={form.upfront}
              onChange={(v) => set("upfront", v as "yes" | "no")}
              hideUnknown
            />
            <details className="text-sm">
              <summary className="cursor-pointer font-medium text-brand-teal-dark">
                Adicionar taxa, CET, custos e garantia (opcional)
              </summary>
              <div className="mt-3 space-y-4">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Field
                      id="new-rate"
                      label="Nova taxa de juros (%)"
                      value={form.newRate}
                      onChange={(v) => set("newRate", v)}
                      placeholder="2,9"
                    />
                  </div>
                  <div>
                    <label htmlFor="new-rate-period" className="block text-sm font-semibold text-brand-navy">
                      Período
                    </label>
                    <select
                      id="new-rate-period"
                      value={form.newRatePeriod}
                      onChange={(e) => set("newRatePeriod", e.target.value as "month" | "year")}
                      className="mt-1 rounded-xl border border-brand-border bg-white px-3 py-3 text-base"
                    >
                      <option value="month">ao mês</option>
                      <option value="year">ao ano</option>
                    </select>
                  </div>
                </div>
                <Field
                  id="new-cet"
                  label="Novo CET (% ao ano)"
                  value={form.newCet}
                  onChange={(v) => set("newCet", v)}
                  placeholder="29,2"
                />
                <Field
                  id="external-costs"
                  label="Custos pagos fora das parcelas (R$, opcional)"
                  hint="Custos legítimos do contrato (ex.: registro). Pagamento exigido ANTES da liberação não entra aqui — responda a pergunta acima."
                  value={form.externalCosts}
                  onChange={(v) => set("externalCosts", v)}
                />
                <Radio3
                  legend="A nova operação exige alguma garantia que a atual não possui?"
                  name="guarantee"
                  value={form.guarantee}
                  onChange={(v) => set("guarantee", v)}
                />
              </div>
            </details>
          </div>
        </fieldset>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={compare}
          className="rounded-xl bg-brand-navy px-6 py-3.5 font-semibold text-white transition-colors hover:bg-brand-navy/90"
        >
          Comparar dívidas
        </button>
        <button
          type="button"
          onClick={() => {
            setForm(EXAMPLE);
            setResult(null);
            setErrors([]);
          }}
          className="rounded-xl border border-brand-border bg-white px-5 py-3.5 font-medium text-brand-navy hover:bg-brand-surface-soft"
        >
          Ver exemplo
        </button>
        <button
          type="button"
          onClick={clearAll}
          className="rounded-xl border border-brand-border bg-white px-5 py-3.5 font-medium text-brand-navy hover:bg-brand-surface-soft"
        >
          Limpar comparação
        </button>
      </div>

      <div ref={resultRef} aria-live="polite" className="mt-6 scroll-mt-24">
        {errors.length > 0 ? (
          <ul className="list-disc rounded-xl border border-brand-warning/40 bg-brand-warning-soft p-4 pl-8 text-sm text-brand-text">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : null}

        {result ? (
          <div>
            <h2 className="font-serif text-2xl font-bold text-brand-navy">O que muda?</h2>
            <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-brand-muted">
              {result.completeness === "complete" ? "Comparação completa" : "Comparação parcial"}
            </p>
            {result.completeness === "partial" ? (
              <p className="mt-1 text-sm text-brand-muted">
                Falta: {result.missing.join("; ")}. Para uma comparação mais confiável, confirme
                esses dados com as instituições.
              </p>
            ) : null}

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <DiffCard title="Parcela" diff={result.monthlyDiffCents} unit="money" />
              <DiffCard title="Prazo" diff={result.termDiffMonths} unit="months" />
              <DiffCard
                title="Total dos pagamentos informados"
                diff={result.totalsComparable ? result.totalDiffCents : null}
                unit="money"
              />
            </div>

            {plain ? (
              <p className="mt-4 rounded-xl border border-brand-border bg-white p-4 text-base leading-relaxed text-brand-text">
                <strong>Em português claro:</strong> {plain}
              </p>
            ) : null}

            <ul className="mt-4 space-y-1.5 text-sm leading-relaxed text-brand-text">
              {result.sentences.map((s) => (
                <li key={s}>• {s}</li>
              ))}
            </ul>

            {result.currentFutureTotalCents !== null || result.newTotalCents !== null ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-brand-border bg-white p-4 text-sm">
                  <p className="font-bold text-brand-navy">Se você mantiver a dívida atual</p>
                  {result.currentFutureTotalCents !== null ? (
                    <p className="mt-1 text-brand-text">
                      {result.currentFutureTotalSource === "official"
                        ? "Total restante informado pela instituição: "
                        : "Soma nominal das parcelas restantes informadas: "}
                      <strong>{formatCentsBRL(result.currentFutureTotalCents)}</strong>
                    </p>
                  ) : (
                    <p className="mt-1 text-brand-muted">
                      Sem estimativa: parcela variável nesta modalidade.
                    </p>
                  )}
                  {result.payoffVsFutureCents !== null ? (
                    <p className="mt-2 text-brand-text">
                      Saldo para quitar hoje:{" "}
                      <strong>
                        {formatCentsBRL(
                          result.currentFutureTotalCents! - result.payoffVsFutureCents,
                        )}
                      </strong>
                      . A diferença de {formatCentsBRL(result.payoffVsFutureCents)} pode incluir
                      juros e outros componentes do contrato — quitar antes reduz
                      proporcionalmente os juros.
                    </p>
                  ) : null}
                </div>
                <div className="rounded-xl border border-brand-border bg-white p-4 text-sm">
                  <p className="font-bold text-brand-navy">Se você trocar</p>
                  {result.newTotalCents !== null ? (
                    <p className="mt-1 text-brand-text">
                      Nova parcela × novo prazo{" "}
                      {form.externalCosts.trim() !== "" ? "+ custos informados " : ""}={" "}
                      <strong>{formatCentsBRL(result.newTotalCents)}</strong>
                    </p>
                  ) : null}
                  {result.cashOutCents !== null && result.cashOutCents > 0 ? (
                    <p className="mt-2 text-brand-text">
                      Deste valor, <strong>{formatCentsBRL(result.cashOutCents)}</strong> são
                      dinheiro novo liberado — não custo da troca. Os totais acima não são
                      comparados como equivalentes.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {result.rateDiffMonthlyPP !== null || result.cetDiffAnnualPP !== null ? (
              <div className="mt-4 rounded-xl border border-brand-border bg-white p-4 text-sm">
                {result.rateDiffMonthlyPP !== null ? (
                  <p className="text-brand-text">
                    Diferença de taxa:{" "}
                    <strong>
                      {result.rateDiffMonthlyPP > 0 ? "+" : "−"}
                      {Math.abs(result.rateDiffMonthlyPP).toFixed(2).replace(".", ",")} ponto(s)
                      percentual(is) ao mês
                    </strong>{" "}
                    {result.rateDiffMonthlyPP < 0 ? "(nova taxa menor)" : "(nova taxa maior)"}.
                  </p>
                ) : null}
                {result.cetDiffAnnualPP !== null ? (
                  <p className="mt-1 text-brand-text">
                    Diferença de CET:{" "}
                    <strong>
                      {result.cetDiffAnnualPP > 0 ? "+" : "−"}
                      {Math.abs(result.cetDiffAnnualPP).toFixed(1).replace(".", ",")} p.p. ao ano
                    </strong>
                    . CET menor não significa automaticamente melhor decisão: prazo, parcela e
                    valor total também entram na comparação.
                  </p>
                ) : (
                  <p className="mt-1 text-brand-muted">
                    CET não informado — sem ele, a comparação do custo efetivo fica incompleta.{" "}
                    <Link href="/juros-e-cet/o-que-e-cet/" className="font-semibold underline">
                      Entender o CET
                    </Link>
                  </p>
                )}
              </div>
            ) : null}

            {upfrontAlert ? (
              <div className="mt-4 rounded-xl border border-brand-danger/50 bg-white p-4">
                <p className="font-bold text-brand-danger">Atenção: pagamento antes da liberação</p>
                <p className="mt-1 text-sm leading-relaxed text-brand-text">
                  Cobrança antecipada para &ldquo;liberar&rdquo; crédito não é custo normal de uma
                  operação — é o sinal mais comum de golpe. Antes de pagar qualquer valor, rode a
                  verificação de sinais.
                </p>
                <p className="mt-2 text-sm">
                  <Link
                    href="/calculadoras/sinais-de-golpe/"
                    onClick={() => track("debt_switch_fraud_click")}
                    className="font-semibold text-brand-danger underline"
                  >
                    Verificar sinais da proposta →
                  </Link>
                </p>
              </div>
            ) : null}

            {result.warnings.includes("guarantee-added") ? (
              <p className="mt-4 rounded-xl border border-brand-border bg-white p-4 text-sm leading-relaxed text-brand-text">
                <strong>A troca não altera apenas o preço:</strong> uma operação com garantia
                (veículo, imóvel, salário ou benefício) pode ter condições diferentes, mas envolve
                riscos e características próprias. Entenda antes em{" "}
                <Link href="/emprestimos/emprestimo-com-garantia/" className="font-semibold underline">
                  empréstimo com garantia
                </Link>
                .
              </p>
            ) : null}

            {result.warnings.includes("portability-limits-check") ? (
              <p className="mt-4 rounded-xl border border-brand-border bg-white p-4 text-sm leading-relaxed text-brand-text">
                <strong>Revise o tipo da operação:</strong> nas regras vigentes de portabilidade,
                o valor e o prazo da nova operação não podem superar o saldo devedor e o prazo
                remanescente da dívida original (há exceções previstas na regulamentação). Se a
                proposta ultrapassa isso, verifique se é realmente uma portabilidade formal ou
                outro tipo de crédito —{" "}
                <Link href="/emprestimos/portabilidade-de-credito/" className="font-semibold underline">
                  como funciona a portabilidade
                </Link>
                .
              </p>
            ) : null}

            {result.warnings.includes("possible-undeclared-cash-out") ? (
              <p className="mt-4 rounded-xl border border-brand-border bg-white p-4 text-sm leading-relaxed text-brand-text">
                <strong>Confira um detalhe:</strong> o valor da nova operação é maior que o saldo
                para quitar a dívida atual. Verifique se ela libera dinheiro extra — isso muda a
                comparação.
              </p>
            ) : null}

            <div className="mt-5 rounded-xl border border-brand-border bg-white p-4">
              <p className="font-bold text-brand-navy">Antes de decidir</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-brand-text">
                <li>Confirme com a instituição atual o saldo atualizado para quitação;</li>
                <li>Confirme o CET, o prazo e o total das parcelas da nova operação por escrito;</li>
                <li>Verifique custos adicionais e se existe troco/dinheiro novo;</li>
                <li>Confirme se a operação é uma portabilidade formal ou outro tipo de crédito;</li>
                <li>Nunca pague nada antes de o dinheiro ser liberado.</li>
              </ul>
            </div>

            {!upfrontAlert ? (
              <div className="mt-4 flex flex-wrap gap-4 text-sm">
                {newInstitution ? (
                  <Link
                    href="/calculadoras/consultar-instituicao/"
                    onClick={() => track("debt_switch_institution_click")}
                    className="font-semibold text-brand-teal-dark underline"
                  >
                    Verificar a nova instituição no Banco Central →
                  </Link>
                ) : null}
                {form.newRate.trim() !== "" ? (
                  <Link
                    href="/calculadoras/minha-taxa-esta-cara/"
                    onClick={() => track("debt_switch_rate_tool_click")}
                    className="font-semibold text-brand-teal-dark underline"
                  >
                    Colocar a nova taxa em contexto (média do BC) →
                  </Link>
                ) : !newInstitution ? (
                  <Link
                    href="/calculadoras/comparador-de-propostas/"
                    onClick={() => track("debt_switch_comparator_click")}
                    className="font-semibold text-brand-teal-dark underline"
                  >
                    Tem mais de uma proposta nova? Compare lado a lado →
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <p className="mt-6 rounded-lg border border-brand-warning/30 bg-brand-warning-soft p-4 text-sm leading-relaxed text-brand-warning">
        Ferramenta educativa. Os resultados dependem dos valores informados e não constituem
        recomendação para contratar, renegociar ou portar uma dívida. Confirme saldo, CET e
        condições diretamente com as instituições envolvidas.
      </p>
    </section>
  );
}
