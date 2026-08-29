"use client";

/**
 * À vista ou parcelado?
 *
 * A pessoa está numa loja com duas condições na mão e a parcela parece leve.
 * O trabalho desta tela é mostrar o preço até o fim de cada opção e nomear o
 * trade-off — sem escolher.
 *
 * Decisões de interface que carregam a política do produto:
 *
 * - a comparação NOMINAL é a experiência principal. O valor presente fica
 *   num bloco recolhido: quem chega aqui quer saber "quanto pago a mais",
 *   não estudar fluxo de caixa descontado;
 * - o modo avançado pergunta QUANDO vence a primeira parcela. Assumir 30
 *   dias mudaria o resultado por um fator (1+i) sem avisar ninguém;
 * - o desconto à vista e o custo de parcelar aparecem separados, cada um com
 *   sua base escrita ao lado. São dois percentuais diferentes para a mesma
 *   compra, e confundi-los é o erro que esta página existe para desfazer;
 * - nada é enviado a lugar nenhum.
 */

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  comparePaymentOptions,
  COMPARISON_LABEL_TEXT,
  emptyOption,
  formatCentsBRL,
  formatPercentBR,
  parseBRLToCents,
  PAYMENT_METHOD_LABEL,
  type ComparisonLabel,
  type OptionResult,
  type PaymentMethod,
  type PaymentOption,
  type PaymentType,
} from "@/lib/calculators/cash-vs-installments";
import { useRevealResult } from "@/components/calculators/use-reveal-result";
import {
  trackCashAddOption,
  trackCashAdvancedOpen,
  trackCashBudgetClick,
  trackCashClear,
  trackCashComplete,
  trackCashCopySummary,
  trackCashStart,
} from "@/components/calculators/cash-installments-analytics";

/* ------------------------------------------------------------------ *
 * Campo
 * ------------------------------------------------------------------ */

function Field({
  id,
  label,
  value,
  onChange,
  hint,
  numeric,
  placeholder,
  prefix,
  suffix,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  numeric?: boolean;
  placeholder?: string;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-brand-navy">
        {label}
      </label>
      {hint ? <p className="mt-0.5 text-xs leading-snug text-brand-muted">{hint}</p> : null}
      <div className="relative mt-1">
        {prefix ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base text-brand-muted"
          >
            {prefix}
          </span>
        ) : null}
        <input
          id={id}
          type="text"
          inputMode={numeric ? "numeric" : "decimal"}
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full rounded-xl border border-brand-border bg-white py-3 text-base text-brand-text outline-none focus:border-brand-teal ${
            prefix ? "pl-12" : "pl-4"
          } ${suffix ? "pr-12" : "pr-4"}`}
        />
        {suffix ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-base text-brand-muted"
          >
            {suffix}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Estado do formulário
 * ------------------------------------------------------------------ */

interface OptionForm {
  id: string;
  type: PaymentType;
  method: PaymentMethod;
  cash: string;
  entry: string;
  count: string;
  installment: string;
  installmentsTotal: string;
  sameInstallments: boolean;
  extraCosts: string;
}

function blankForm(id: string, type: PaymentType): OptionForm {
  return {
    id,
    type,
    method: type === "cash" ? "pix" : "cartao",
    cash: "",
    entry: "",
    count: "",
    installment: "",
    installmentsTotal: "",
    sameInstallments: true,
    extraCosts: "",
  };
}

function toOption(form: OptionForm): PaymentOption {
  const base = emptyOption(form.id, form.type);
  const extra = parseBRLToCents(form.extraCosts) ?? 0;

  if (form.type === "cash") {
    return {
      ...base,
      type: "cash",
      method: form.method,
      cashCents: parseBRLToCents(form.cash),
      extraCostsCents: extra,
    };
  }

  const count = Number.parseInt(form.count, 10);
  return {
    ...base,
    type: "installments",
    method: form.method,
    cashCents: null,
    entryCents: parseBRLToCents(form.entry) ?? 0,
    installmentMode: form.sameInstallments ? "uniform" : "total",
    installmentCount: Number.isFinite(count) && count > 0 ? count : 0,
    installmentCents: form.sameInstallments ? parseBRLToCents(form.installment) : null,
    installmentsTotalCents: form.sameInstallments
      ? null
      : parseBRLToCents(form.installmentsTotal),
    extraCostsCents: extra,
  };
}

function isTouched(form: OptionForm): boolean {
  return Boolean(form.cash || form.entry || form.count || form.installment || form.installmentsTotal);
}

/* ------------------------------------------------------------------ *
 * Card de resultado
 * ------------------------------------------------------------------ */

function ResultCard({
  option,
  labels,
}: {
  option: OptionResult;
  labels: ComparisonLabel[];
}) {
  return (
    <li className="rounded-2xl border border-brand-border bg-white p-5">
      <h3 className="font-serif text-lg font-bold text-brand-navy">{option.label}</h3>

      {labels.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {labels.map((label) => (
            <li
              key={label}
              className="rounded-full bg-brand-teal-soft px-2.5 py-0.5 text-xs font-semibold text-brand-teal-dark"
            >
              {COMPARISON_LABEL_TEXT[label]}
            </li>
          ))}
        </ul>
      ) : null}

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-brand-border py-4">
        <div>
          <dt className="text-xs uppercase tracking-wide text-brand-muted">Sai agora</dt>
          <dd className="mt-0.5 text-lg font-semibold text-brand-navy">
            {formatCentsBRL(option.upfrontCents)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-brand-muted">Por mês</dt>
          <dd className="mt-0.5 text-lg font-semibold text-brand-navy">
            {option.installmentCents !== null
              ? formatCentsBRL(option.installmentCents)
              : option.installmentCount > 0
                ? "Parcelas variáveis"
                : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-brand-muted">Prazo</dt>
          <dd className="mt-0.5 text-lg font-semibold text-brand-navy">
            {option.installmentCount > 0
              ? `${option.installmentCount} ${option.installmentCount === 1 ? "mês" : "meses"}`
              : "Pagamento único"}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-brand-muted">
            Total até o fim
          </dt>
          <dd
            className="mt-0.5 text-xl font-bold text-brand-navy"
            data-testid={`total-${option.id}`}
          >
            {formatCentsBRL(option.totalCents)}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-brand-muted">{option.sentence}</p>
    </li>
  );
}

/* ------------------------------------------------------------------ *
 * Ferramenta
 * ------------------------------------------------------------------ */

export function CashVsInstallmentsCalculator() {
  const [referencePrice, setReferencePrice] = useState("");
  const [showReference, setShowReference] = useState(false);
  const [forms, setForms] = useState<OptionForm[]>([
    blankForm("a", "cash"),
    blankForm("b", "installments"),
  ]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [rateValue, setRateValue] = useState("");
  const [rateUnit, setRateUnit] = useState<"mensal" | "anual">("mensal");
  const [firstInstallment, setFirstInstallment] = useState<"hoje" | "em-um-mes">("em-um-mes");
  const [submitted, setSubmitted] = useState(false);
  const [started, setStarted] = useState(false);
  const [copied, setCopied] = useState(false);
  const { ref, reveal } = useRevealResult();

  const markStarted = useCallback(() => {
    if (!started) {
      setStarted(true);
      trackCashStart();
    }
  }, [started]);

  const patch = useCallback(
    (id: string, changes: Partial<OptionForm>) => {
      markStarted();
      setForms((prev) => prev.map((f) => (f.id === id ? { ...f, ...changes } : f)));
    },
    [markStarted],
  );

  const addOption = useCallback(() => {
    setForms((prev) => {
      if (prev.length >= 3) return prev;
      const next = [...prev, blankForm(["a", "b", "c"][prev.length]!, "installments")];
      trackCashAddOption(next.length as 2 | 3);
      return next;
    });
  }, []);

  const removeOption = useCallback((id: string) => {
    setForms((prev) => (prev.length <= 1 ? prev : prev.filter((f) => f.id !== id)));
  }, []);

  const clearAll = useCallback(() => {
    setReferencePrice("");
    setForms([blankForm("a", "cash"), blankForm("b", "installments")]);
    setRateValue("");
    setSubmitted(false);
    setCopied(false);
    trackCashClear();
  }, []);

  const result = useMemo(() => {
    const rate = rateValue.trim().replace(",", ".");
    const rateNumber = rate === "" ? null : Number.parseFloat(rate);
    return comparePaymentOptions({
      referencePriceCents: parseBRLToCents(referencePrice),
      options: forms.filter(isTouched).map(toOption),
      opportunityRate:
        advancedOpen && rateNumber !== null && Number.isFinite(rateNumber) && rateNumber >= 0
          ? { value: rateNumber, unit: rateUnit, firstInstallment }
          : null,
    });
  }, [referencePrice, forms, advancedOpen, rateValue, rateUnit, firstInstallment]);

  const handleSubmit = useCallback(() => {
    setSubmitted(true);
    if (result.status === "ok") {
      trackCashComplete({
        options: result.options.length as 1 | 2 | 3,
        hasCashOption: result.options.some((o) => o.type === "cash"),
        hasEntry: result.options.some((o) => o.type === "installments" && o.upfrontCents > 0),
        hasReferencePrice: result.cashDiscount !== null,
        variableInstallments: forms.some((f) => !f.sameInstallments),
        relation: result.cashVsInstallments?.relation ?? "none",
      });
    }
    reveal();
  }, [result, forms, reveal]);

  const summary = useMemo(() => {
    if (result.status !== "ok") return "";
    const lines = result.options.map(
      (o) => `${o.label}: total ${formatCentsBRL(o.totalCents)}`,
    );
    if (result.cashVsInstallments && result.cashVsInstallments.differenceCents !== 0) {
      lines.push(
        `Diferença: ${formatCentsBRL(Math.abs(result.cashVsInstallments.differenceCents))}`,
      );
    }
    lines.push("", "Calculado em creditoporperto.com/calculadoras/a-vista-ou-parcelado/");
    return lines.join("\n");
  }, [result]);

  const copySummary = useCallback(() => {
    void navigator.clipboard.writeText(summary).then(() => {
      setCopied(true);
      trackCashCopySummary();
      window.setTimeout(() => setCopied(false), 2500);
    });
  }, [summary]);

  const showResult = submitted && result.status === "ok" && result.options.length > 0;
  const parcelaExemplo = result.options.find((o) => o.installmentCents !== null);

  return (
    <div>
      {/* -------- Formas de pagamento -------- */}
      <section aria-labelledby="formas" className="rounded-2xl border border-brand-border bg-brand-surface-soft p-5">
        <h2 id="formas" className="font-serif text-xl font-bold text-brand-navy">
          As condições de pagamento
        </h2>

        <div className="mt-4 space-y-4">
          {forms.map((form, index) => (
            <fieldset key={form.id} className="rounded-2xl border border-brand-border bg-white p-5">
              <legend className="px-1 font-serif text-base font-bold text-brand-navy">
                Opção {String.fromCharCode(65 + index)}
              </legend>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <div
                  role="radiogroup"
                  aria-label={`Formato da opção ${String.fromCharCode(65 + index)}`}
                  className="flex flex-wrap gap-2"
                >
                  {(["cash", "installments"] as PaymentType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      role="radio"
                      aria-checked={form.type === type}
                      onClick={() => patch(form.id, { type })}
                      className={`rounded-lg border px-3 py-2 text-sm ${
                        form.type === type
                          ? "border-brand-teal bg-brand-surface-soft font-semibold text-brand-navy"
                          : "border-brand-border bg-white text-brand-text"
                      }`}
                    >
                      {type === "cash" ? "À vista" : "Parcelado"}
                    </button>
                  ))}
                </div>
                {forms.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeOption(form.id)}
                    className="text-sm text-brand-muted underline underline-offset-2 hover:text-brand-navy"
                  >
                    Remover
                  </button>
                ) : null}
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {form.type === "cash" ? (
                  <>
                    <Field
                      id={`cash-${form.id}`}
                      label="Quanto custa à vista?"
                      value={form.cash}
                      onChange={(v) => patch(form.id, { cash: v })}
                      placeholder="4.500,00"
                      prefix="R$"
                    />
                    <div>
                      <label
                        htmlFor={`method-${form.id}`}
                        className="block text-sm font-semibold text-brand-navy"
                      >
                        Forma de pagamento (opcional)
                      </label>
                      <p className="mt-0.5 text-xs leading-snug text-brand-muted">
                        Só um rótulo para você se organizar — não muda nenhuma conta.
                      </p>
                      <select
                        id={`method-${form.id}`}
                        value={form.method}
                        onChange={(e) =>
                          patch(form.id, { method: e.target.value as PaymentMethod })
                        }
                        className="mt-1 w-full rounded-xl border border-brand-border bg-white px-4 py-3 text-base text-brand-text outline-none focus:border-brand-teal"
                      >
                        {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => (
                          <option key={m} value={m}>
                            {PAYMENT_METHOD_LABEL[m]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    <Field
                      id={`entry-${form.id}`}
                      label="Entrada (se houver)"
                      value={form.entry}
                      onChange={(v) => patch(form.id, { entry: v })}
                      placeholder="0,00"
                      prefix="R$"
                    />
                    <Field
                      id={`count-${form.id}`}
                      label="Número de parcelas"
                      value={form.count}
                      onChange={(v) => patch(form.id, { count: v })}
                      placeholder="12"
                      numeric
                    />
                    {form.sameInstallments ? (
                      <Field
                        id={`installment-${form.id}`}
                        label="Valor de cada parcela"
                        value={form.installment}
                        onChange={(v) => patch(form.id, { installment: v })}
                        placeholder="425,00"
                        prefix="R$"
                      />
                    ) : (
                      <Field
                        id={`installments-total-${form.id}`}
                        label="Total parcelado divulgado"
                        hint="Some o que o anúncio indica para o conjunto das parcelas."
                        value={form.installmentsTotal}
                        onChange={(v) => patch(form.id, { installmentsTotal: v })}
                        placeholder="5.100,00"
                        prefix="R$"
                      />
                    )}
                  </>
                )}

                <Field
                  id={`extra-${form.id}`}
                  label="Outro custo obrigatório desta opção (opcional)"
                  hint="Só se ele existir apenas nesta forma de pagamento. Frete igual nas duas não precisa entrar."
                  value={form.extraCosts}
                  onChange={(v) => patch(form.id, { extraCosts: v })}
                  placeholder="0,00"
                  prefix="R$"
                />
              </div>

              {form.type === "installments" ? (
                <label className="mt-4 flex items-start gap-2 text-sm text-brand-text">
                  <input
                    type="checkbox"
                    checked={!form.sameInstallments}
                    onChange={(e) => patch(form.id, { sameInstallments: !e.target.checked })}
                    className="mt-0.5 h-4 w-4"
                  />
                  <span>
                    As parcelas têm valores diferentes
                    <span className="block text-xs text-brand-muted">
                      Nesse caso usamos o total divulgado — multiplicar a primeira parcela
                      daria um número errado.
                    </span>
                  </span>
                </label>
              ) : null}
            </fieldset>
          ))}
        </div>

        {forms.length < 3 ? (
          <button
            type="button"
            onClick={addOption}
            className="mt-4 w-full rounded-xl border border-dashed border-brand-teal px-4 py-3 text-sm font-semibold text-brand-teal-dark hover:bg-white"
          >
            + Adicionar outra forma de pagamento
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => setShowReference((v) => !v)}
          aria-expanded={showReference}
          className="mt-4 text-sm font-semibold text-brand-teal-dark underline underline-offset-2"
        >
          {showReference ? "Ocultar preço de referência" : "Existe um preço normal antes do desconto à vista?"}
        </button>

        {showReference ? (
          <div className="mt-4 max-w-sm">
            <Field
              id="preco-referencia"
              label="Preço de referência anunciado"
              hint="O valor de tabela, antes do desconto à vista. Usado só como base do percentual de desconto."
              value={referencePrice}
              onChange={(v) => {
                markStarted();
                setReferencePrice(v);
              }}
              placeholder="5.000,00"
              prefix="R$"
            />
          </div>
        ) : null}
      </section>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          className="flex-1 rounded-xl bg-brand-navy px-6 py-4 text-base font-bold text-white hover:bg-brand-navy/90 sm:flex-none"
        >
          Comparar
        </button>
        <button
          type="button"
          onClick={clearAll}
          className="rounded-xl border border-brand-border px-5 py-4 text-sm font-semibold text-brand-navy hover:bg-brand-surface-soft"
        >
          Limpar comparação
        </button>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-brand-muted">
        Tudo roda no seu navegador. Nenhum valor é enviado, salvo ou compartilhado — e não
        pedimos cadastro, CPF nem o nome da loja.
      </p>

      {/* -------- Resultado -------- */}
      {submitted && result.status === "blocked" ? (
        <div
          ref={ref}
          role="alert"
          className="mt-8 scroll-mt-24 rounded-2xl border border-brand-warning/40 bg-brand-warning-soft p-5"
        >
          <h2
            data-result-heading
            tabIndex={-1}
            className="font-serif text-lg font-bold text-brand-warning"
          >
            Faltam dados para comparar
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-brand-text">
            {result.blockingReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {showResult ? (
        <section ref={ref} aria-labelledby="resultado-avista" className="mt-10 scroll-mt-24">
          <h2
            id="resultado-avista"
            data-result-heading
            tabIndex={-1}
            className="font-serif text-2xl font-bold text-brand-navy"
          >
            O preço até o fim
          </h2>

          <ul className="mt-5 grid gap-4 lg:grid-cols-3">
            {result.options.map((option) => (
              <ResultCard
                key={option.id}
                option={option}
                labels={result.labels[option.id] ?? []}
              />
            ))}
          </ul>

          {/* Diferença entre à vista e parcelado */}
          {result.cashVsInstallments ? (
            <div className="mt-6 rounded-2xl border border-brand-teal/30 bg-brand-teal-soft/40 p-5">
              <h3 className="font-serif text-lg font-bold text-brand-navy">
                {result.cashVsInstallments.relation === "equal"
                  ? "Mesmo total, momentos diferentes"
                  : "Quanto custa parcelar?"}
              </h3>
              <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-brand-muted">À vista</dt>
                  <dd className="mt-0.5 text-lg font-semibold text-brand-navy">
                    {formatCentsBRL(result.cashVsInstallments.cashTotalCents)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-brand-muted">Parcelado</dt>
                  <dd className="mt-0.5 text-lg font-semibold text-brand-navy">
                    {formatCentsBRL(result.cashVsInstallments.installmentTotalCents)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-brand-muted">Diferença</dt>
                  <dd className="mt-0.5 text-lg font-bold text-brand-navy">
                    {result.cashVsInstallments.differenceCents === 0
                      ? formatCentsBRL(0)
                      : `${result.cashVsInstallments.differenceCents > 0 ? "+" : "−"}${formatCentsBRL(Math.abs(result.cashVsInstallments.differenceCents))}`}
                  </dd>
                </div>
              </dl>
              {result.cashVsInstallments.sentences.map((line) => (
                <p key={line} className="mt-3 text-sm leading-relaxed text-brand-text">
                  {line}
                </p>
              ))}
            </div>
          ) : null}

          {/* Desconto à vista — base diferente, bloco diferente */}
          {result.cashDiscount ? (
            <div className="mt-6 rounded-2xl border border-brand-border bg-white p-5">
              <h3 className="font-serif text-lg font-bold text-brand-navy">
                O desconto à vista anunciado
              </h3>
              <p className="mt-2 text-2xl font-bold text-brand-navy">
                {formatCentsBRL(result.cashDiscount.discountCents)}{" "}
                <span className="text-lg font-semibold text-brand-muted">
                  ({formatPercentBR(result.cashDiscount.discountPercent)})
                </span>
              </p>
              <p className="mt-2 text-sm leading-relaxed text-brand-text">
                {result.cashDiscount.sentence}
              </p>
            </div>
          ) : null}

          {/* Trade-offs */}
          {result.tradeoffs.length > 0 ? (
            <div className="mt-6 rounded-2xl border border-brand-border bg-white p-5">
              <h3 className="font-serif text-lg font-bold text-brand-navy">
                O que muda de uma para a outra
              </h3>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-brand-text">
                {result.tradeoffs.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span aria-hidden="true" className="text-brand-teal-dark">
                      •
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Modo avançado, recolhido por padrão */}
          <div className="mt-6 rounded-2xl border border-brand-border bg-brand-surface-soft p-5">
            <button
              type="button"
              aria-expanded={advancedOpen}
              onClick={() => {
                setAdvancedOpen((v) => {
                  if (!v) trackCashAdvancedOpen();
                  return !v;
                });
              }}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <span className="font-serif text-lg font-bold text-brand-navy">
                E o valor do dinheiro no tempo?
              </span>
              <span aria-hidden="true" className="text-brand-teal-dark">
                {advancedOpen ? "−" : "+"}
              </span>
            </button>
            <p className="mt-2 text-sm leading-relaxed text-brand-muted">
              Pagar depois não é igual a pagar hoje, mesmo quando o total é o mesmo. Se quiser
              usar uma rentabilidade como referência, informe uma taxa líquida estimada.
            </p>

            {advancedOpen ? (
              <div className="mt-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    id="taxa-oportunidade"
                    label="Taxa de referência"
                    hint="Uma taxa líquida que você considere realista. Não sugerimos nenhuma."
                    value={rateValue}
                    onChange={setRateValue}
                    placeholder="1"
                    suffix="%"
                  />
                  <div>
                    <span className="block text-sm font-semibold text-brand-navy">Período</span>
                    <div role="radiogroup" aria-label="Período da taxa" className="mt-1 flex gap-2">
                      {(["mensal", "anual"] as const).map((unit) => (
                        <button
                          key={unit}
                          type="button"
                          role="radio"
                          aria-checked={rateUnit === unit}
                          onClick={() => setRateUnit(unit)}
                          className={`flex-1 rounded-lg border px-3 py-3 text-sm ${
                            rateUnit === unit
                              ? "border-brand-teal bg-white font-semibold text-brand-navy"
                              : "border-brand-border bg-white text-brand-text"
                          }`}
                        >
                          {unit === "mensal" ? "Ao mês" : "Ao ano"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <fieldset className="mt-4">
                  <legend className="text-sm font-semibold text-brand-navy">
                    Quando vence a primeira parcela?
                  </legend>
                  <p className="mt-0.5 text-xs leading-snug text-brand-muted">
                    Muda a conta: uma parcela paga hoje não é descontada no tempo.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(
                      [
                        ["em-um-mes", "Em cerca de 30 dias"],
                        ["hoje", "Hoje, no ato"],
                      ] as const
                    ).map(([value, label]) => (
                      <label
                        key={value}
                        className={`cursor-pointer rounded-lg border px-3 py-2 text-sm ${
                          firstInstallment === value
                            ? "border-brand-teal bg-white font-semibold text-brand-navy"
                            : "border-brand-border bg-white text-brand-text"
                        }`}
                      >
                        <input
                          type="radio"
                          name="primeira-parcela"
                          className="sr-only"
                          checked={firstInstallment === value}
                          onChange={() => setFirstInstallment(value)}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </fieldset>

                {result.presentValue ? (
                  <div className="mt-5 rounded-xl border border-brand-border bg-white p-4">
                    <p className="text-xs uppercase tracking-wide text-brand-muted">
                      Valor presente do plano parcelado
                    </p>
                    <p className="mt-1 text-2xl font-bold text-brand-navy">
                      {formatCentsBRL(result.presentValue.presentValueCents)}
                    </p>
                    {result.presentValue.sentences.map((line) => (
                      <p key={line} className="mt-2 text-sm leading-relaxed text-brand-text">
                        {line}
                      </p>
                    ))}
                    <p className="mt-3 border-t border-brand-border pt-3 text-sm leading-relaxed text-brand-muted">
                      Nessa taxa, um preço à vista abaixo de{" "}
                      <strong>{formatCentsBRL(result.presentValue.breakEvenCashPriceCents)}</strong>{" "}
                      teria menor custo presente que o parcelamento informado.
                    </p>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-brand-muted">
                    Informe uma taxa para ver o valor presente.
                  </p>
                )}
              </div>
            ) : null}
          </div>

          {/* Notas sobre as bases */}
          {result.notes.length > 0 ? (
            <div className="mt-6 rounded-xl border border-brand-border bg-white p-4">
              {result.notes.map((note) => (
                <p key={note} className="mt-1 text-xs leading-relaxed text-brand-muted">
                  {note}
                </p>
              ))}
            </div>
          ) : null}

          <div className="mt-6">
            <button
              type="button"
              onClick={copySummary}
              className="rounded-xl border border-brand-border px-5 py-3 text-sm font-semibold text-brand-navy hover:bg-brand-surface-soft"
            >
              {copied ? "Resumo copiado" : "Copiar resumo"}
            </button>
          </div>

          {/* Próximo passo: um só */}
          <div className="mt-8 rounded-2xl border border-brand-navy/15 bg-brand-navy/5 p-5">
            <h3 className="font-serif text-lg font-bold text-brand-navy">Próximo passo</h3>
            <p className="mt-2 text-sm leading-relaxed text-brand-text">
              {parcelaExemplo?.installmentCents
                ? `Saber quanto o parcelamento custa não responde à outra pergunta que decide a compra: ${formatCentsBRL(parcelaExemplo.installmentCents)} por mês cabem no seu orçamento?`
                : "A outra pergunta que decide a compra é se esse desembolso cabe no seu mês."}
            </p>
            <Link
              href="/calculadoras/parcela-no-orcamento/"
              onClick={trackCashBudgetClick}
              className="mt-3 inline-flex rounded-lg bg-brand-navy px-4 py-2.5 text-sm font-semibold !text-white !no-underline hover:bg-brand-navy/90"
            >
              Ver se a parcela cabe →
            </Link>
            {/*
              Bloco próprio em vez do <ToolNextSteps> da Central porque a copy
              cita o valor da parcela analisada — contexto que o motor genérico
              não tem. A contrapartida é não refinar por jornada; a saída para
              a Central fica logo abaixo para que o caminho não termine aqui.
            */}
            <p className="mt-4 border-t border-brand-navy/10 pt-3 text-sm leading-relaxed text-brand-text">
              <strong>Não precisa fazer todas as etapas.</strong> Para olhar
              outra decisão,{" "}
              <Link
                href="/decisoes-financeiras/"
                className="font-semibold text-brand-teal-dark"
              >
                veja os outros momentos
              </Link>
              .
            </p>
          </div>

          <p className="mt-8 rounded-xl border border-brand-border bg-white p-4 text-xs leading-relaxed text-brand-muted">
            Ferramenta educativa baseada nos valores que você informou. Ela compara os números
            das condições de pagamento e não indica qual escolher — a decisão depende também do
            seu caixa, das suas despesas dos próximos meses e do que mais você faria com esse
            dinheiro.
          </p>
        </section>
      ) : null}
    </div>
  );
}
