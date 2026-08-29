"use client";

/**
 * Calculadora de Renegociação de Dívidas.
 *
 * A pessoa chega vendo "70% DE DESCONTO!" ou "parcelas a partir de R$ 199".
 * O trabalho desta tela é tirar o marketing da frente e devolver quatro
 * números por proposta: quanto sai agora, quanto sai por mês, por quanto
 * tempo e quanto sai no total.
 *
 * Decisões de interface que carregam a política do produto:
 *
 * - o saldo de referência é OPCIONAL. Sem ele não dá para calcular redução
 *   percentual, mas ainda dá para comparar propostas entre si — e bloquear a
 *   ferramenta por causa de um número que a pessoa pode não ter em mãos seria
 *   punir quem mais precisa;
 * - o total aparece em destaque em cada card, com a entrada somada. O erro
 *   mais comum de quem recebe um acordo é olhar "18 × R$ 340" e esquecer os
 *   R$ 1.000 de entrada;
 * - os rótulos são factuais ("Menor total", "Menor parcela"). Não existe
 *   estrela, troféu, "recomendada" nem ordenação por qualidade;
 * - nada é enviado a lugar nenhum. Os cálculos rodam aqui.
 */

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  analyzeRenegotiation,
  COMPARISON_LABEL_TEXT,
  emptyOffer,
  formatCentsBRL,
  formatPercentBR,
  parseBRLToCents,
  type ComparisonLabel,
  type OfferResult,
  type OfferType,
  type RenegotiationOffer,
} from "@/lib/calculators/debt-renegotiation";
import { useRevealResult } from "@/components/calculators/use-reveal-result";
import {
  trackRenegotiationAddOffer,
  trackRenegotiationClear,
  trackRenegotiationComplete,
  trackRenegotiationCopySummary,
  trackRenegotiationDiscountCheck,
  trackRenegotiationStart,
  trackRenegotiationToolClick,
} from "@/components/calculators/renegotiation-analytics";

/* ------------------------------------------------------------------ *
 * Campos
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
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  numeric?: boolean;
  placeholder?: string;
  prefix?: string;
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
            prefix ? "pl-12 pr-4" : "px-4"
          }`}
        />
      </div>
    </div>
  );
}

const OFFER_TYPE_LABEL: Record<OfferType, string> = {
  cash: "À vista",
  "entry-installments": "Entrada + parcelas",
  "installments-only": "Só parcelas",
};

/* ------------------------------------------------------------------ *
 * Estado de uma proposta no formulário
 * ------------------------------------------------------------------ */

interface OfferForm {
  id: string;
  type: OfferType;
  cash: string;
  entry: string;
  count: string;
  installment: string;
  installmentsTotal: string;
  sameInstallments: boolean;
  extraCosts: string;
}

function blankForm(id: string): OfferForm {
  return {
    id,
    type: "cash",
    cash: "",
    entry: "",
    count: "",
    installment: "",
    installmentsTotal: "",
    sameInstallments: true,
    extraCosts: "",
  };
}

function toOffer(form: OfferForm): RenegotiationOffer {
  const base = emptyOffer(form.id);
  const extra = parseBRLToCents(form.extraCosts) ?? 0;

  if (form.type === "cash") {
    return { ...base, type: "cash", cashCents: parseBRLToCents(form.cash), extraCostsCents: extra };
  }

  const count = Number.parseInt(form.count, 10);
  return {
    ...base,
    type: form.type,
    cashCents: null,
    entryCents: form.type === "entry-installments" ? (parseBRLToCents(form.entry) ?? 0) : 0,
    installmentMode: form.sameInstallments ? "uniform" : "total",
    installmentCount: Number.isFinite(count) && count > 0 ? count : 0,
    installmentCents: form.sameInstallments ? parseBRLToCents(form.installment) : null,
    installmentsTotalCents: form.sameInstallments
      ? null
      : parseBRLToCents(form.installmentsTotal),
    extraCostsCents: extra,
  };
}

function isFormTouched(form: OfferForm): boolean {
  return Boolean(
    form.cash || form.entry || form.count || form.installment || form.installmentsTotal,
  );
}

/* ------------------------------------------------------------------ *
 * Card de proposta no resultado
 * ------------------------------------------------------------------ */

function ResultCard({
  offer,
  labels,
  index,
}: {
  offer: OfferResult;
  labels: ComparisonLabel[];
  index: number;
}) {
  return (
    <li className="rounded-2xl border border-brand-border bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-serif text-lg font-bold text-brand-navy">
          Proposta {String.fromCharCode(65 + index)} · {offer.label}
        </h3>
      </div>

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

      {/* Os quatro eixos, sempre na mesma ordem. */}
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-brand-border py-4">
        <div>
          <dt className="text-xs uppercase tracking-wide text-brand-muted">Sai agora</dt>
          <dd className="mt-0.5 text-lg font-semibold text-brand-navy">
            {formatCentsBRL(offer.upfrontCents)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-brand-muted">Por mês</dt>
          <dd className="mt-0.5 text-lg font-semibold text-brand-navy">
            {offer.installmentCents !== null
              ? formatCentsBRL(offer.installmentCents)
              : offer.installmentCount > 0
                ? "Parcelas variáveis"
                : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-brand-muted">Prazo</dt>
          <dd className="mt-0.5 text-lg font-semibold text-brand-navy">
            {offer.installmentCount > 0
              ? `${offer.installmentCount} ${offer.installmentCount === 1 ? "mês" : "meses"}`
              : "Pagamento único"}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-brand-muted">Total</dt>
          <dd
            className="mt-0.5 text-xl font-bold text-brand-navy"
            data-testid={`total-${offer.id}`}
          >
            {formatCentsBRL(offer.totalCents)}
          </dd>
        </div>
      </dl>

      {offer.extraCostsCents > 0 ? (
        <p className="mt-3 text-sm text-brand-muted">
          Inclui {formatCentsBRL(offer.extraCostsCents)} de custos adicionais informados.
        </p>
      ) : null}

      {offer.reductionCents !== null && offer.reductionPercent !== null ? (
        <p className="mt-3 text-sm leading-relaxed text-brand-text">
          {offer.relationToReference === "below" ? (
            <>
              <strong>Redução de {formatCentsBRL(offer.reductionCents)}</strong> em relação
              ao saldo informado ({formatPercentBR(offer.reductionPercent)}).
            </>
          ) : offer.relationToReference === "equal" ? (
            <>O total é igual ao saldo informado.</>
          ) : (
            <>
              O total é{" "}
              <strong>{formatCentsBRL(Math.abs(offer.reductionCents))} maior</strong> que o
              saldo informado.
            </>
          )}
        </p>
      ) : null}

      <p className="mt-3 text-sm leading-relaxed text-brand-muted">{offer.sentence}</p>
    </li>
  );
}

/* ------------------------------------------------------------------ *
 * Ferramenta
 * ------------------------------------------------------------------ */

export function RenegotiationCalculator() {
  const [balance, setBalance] = useState("");
  const [originalDebt, setOriginalDebt] = useState("");
  const [announcedDiscount, setAnnouncedDiscount] = useState("");
  const [showOptional, setShowOptional] = useState(false);
  const [forms, setForms] = useState<OfferForm[]>([blankForm("a")]);
  const [submitted, setSubmitted] = useState(false);
  const [started, setStarted] = useState(false);
  const [copied, setCopied] = useState(false);
  const { ref, reveal } = useRevealResult();

  const markStarted = useCallback(() => {
    if (!started) {
      setStarted(true);
      trackRenegotiationStart();
    }
  }, [started]);

  const patch = useCallback(
    (id: string, changes: Partial<OfferForm>) => {
      markStarted();
      setForms((prev) => prev.map((f) => (f.id === id ? { ...f, ...changes } : f)));
    },
    [markStarted],
  );

  const addOffer = useCallback(() => {
    setForms((prev) => {
      if (prev.length >= 3) return prev;
      const next = [...prev, blankForm(["a", "b", "c"][prev.length]!)];
      trackRenegotiationAddOffer(next.length as 2 | 3);
      return next;
    });
  }, []);

  const removeOffer = useCallback((id: string) => {
    setForms((prev) => (prev.length <= 1 ? prev : prev.filter((f) => f.id !== id)));
  }, []);

  const clearAll = useCallback(() => {
    setBalance("");
    setOriginalDebt("");
    setAnnouncedDiscount("");
    setForms([blankForm("a")]);
    setSubmitted(false);
    setCopied(false);
    trackRenegotiationClear();
  }, []);

  const result = useMemo(() => {
    const announced = announcedDiscount.trim().replace(",", ".");
    const announcedValue = announced === "" ? null : Number.parseFloat(announced);
    return analyzeRenegotiation({
      referenceBalanceCents: parseBRLToCents(balance),
      originalDebtCents: parseBRLToCents(originalDebt),
      announcedDiscountPercent:
        announcedValue !== null && Number.isFinite(announcedValue) ? announcedValue : null,
      offers: forms.filter(isFormTouched).map(toOffer),
    });
  }, [balance, originalDebt, announcedDiscount, forms]);

  const handleSubmit = useCallback(() => {
    setSubmitted(true);
    if (result.status === "ok") {
      trackRenegotiationComplete({
        offers: result.offers.length as 1 | 2 | 3,
        hasCashOffer: result.offers.some((o) => o.type === "cash"),
        hasEntry: result.offers.some((o) => o.upfrontCents > 0 && o.type !== "cash"),
        hasReferenceBalance: result.referenceBalanceCents !== null,
        usedVariableInstallments: forms.some((f) => !f.sameInstallments),
      });
      if (result.discountCheck) {
        trackRenegotiationDiscountCheck(result.discountCheck.matches);
      }
    }
    reveal();
  }, [result, forms, reveal]);

  const summary = useMemo(() => {
    if (result.status !== "ok") return "";
    const lines: string[] = [];
    if (result.referenceBalanceCents !== null) {
      lines.push(
        `Saldo usado como referência: ${formatCentsBRL(result.referenceBalanceCents)}`,
      );
    }
    for (const offer of result.offers) {
      lines.push(`${offer.label}: total ${formatCentsBRL(offer.totalCents)}`);
    }
    lines.push("", "Calculado em creditoporperto.com/calculadoras/renegociacao-de-dividas/");
    return lines.join("\n");
  }, [result]);

  const copySummary = useCallback(() => {
    void navigator.clipboard.writeText(summary).then(() => {
      setCopied(true);
      trackRenegotiationCopySummary();
      window.setTimeout(() => setCopied(false), 2500);
    });
  }, [summary]);

  const showResult = submitted && result.status === "ok" && result.offers.length > 0;

  return (
    <div>
      {/* ---------------- Etapa 1: a dívida ---------------- */}
      <section
        aria-labelledby="etapa-divida"
        className="rounded-2xl border border-brand-border bg-brand-surface-soft p-5"
      >
        <h2 id="etapa-divida" className="font-serif text-xl font-bold text-brand-navy">
          1. A dívida
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field
            id="saldo"
            label="Saldo apresentado para negociação"
            hint="O valor que o credor mostrou como saldo antes do acordo. Se você não tiver esse número, pule — dá para comparar as propostas mesmo assim."
            value={balance}
            onChange={(v) => {
              markStarted();
              setBalance(v);
            }}
            placeholder="12.000,00"
            prefix="R$"
          />
        </div>

        <button
          type="button"
          onClick={() => setShowOptional((v) => !v)}
          aria-expanded={showOptional}
          className="mt-4 text-sm font-semibold text-brand-teal-dark underline underline-offset-2"
        >
          {showOptional ? "Ocultar campos opcionais" : "Campos opcionais (desconto anunciado)"}
        </button>

        {showOptional ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field
              id="desconto-anunciado"
              label="A oferta anuncia algum percentual de desconto?"
              hint="Ex.: 70. Vamos conferir com os valores que você informar."
              value={announcedDiscount}
              onChange={setAnnouncedDiscount}
              placeholder="70"
              numeric
            />
            <Field
              id="divida-original"
              label="Você sabe quanto era a dívida originalmente?"
              hint="Só como contexto. A redução continua sendo calculada sobre o saldo apresentado."
              value={originalDebt}
              onChange={setOriginalDebt}
              placeholder="6.000,00"
              prefix="R$"
            />
          </div>
        ) : null}
      </section>

      {/* ---------------- Etapa 2: propostas ---------------- */}
      <section aria-labelledby="etapa-propostas" className="mt-6">
        <h2 id="etapa-propostas" className="font-serif text-xl font-bold text-brand-navy">
          2. As propostas
        </h2>

        <div className="mt-4 space-y-4">
          {forms.map((form, index) => (
            <fieldset
              key={form.id}
              className="rounded-2xl border border-brand-border bg-white p-5"
            >
              <legend className="px-1 font-serif text-base font-bold text-brand-navy">
                Proposta {String.fromCharCode(65 + index)}
              </legend>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <div
                  role="radiogroup"
                  aria-label={`Formato da proposta ${String.fromCharCode(65 + index)}`}
                  className="flex flex-wrap gap-2"
                >
                  {(Object.keys(OFFER_TYPE_LABEL) as OfferType[]).map((type) => (
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
                      {OFFER_TYPE_LABEL[type]}
                    </button>
                  ))}
                </div>
                {forms.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeOffer(form.id)}
                    className="text-sm text-brand-muted underline underline-offset-2 hover:text-brand-navy"
                  >
                    Remover
                  </button>
                ) : null}
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {form.type === "cash" ? (
                  <Field
                    id={`cash-${form.id}`}
                    label="Valor para pagamento"
                    value={form.cash}
                    onChange={(v) => patch(form.id, { cash: v })}
                    placeholder="5.800,00"
                    prefix="R$"
                  />
                ) : (
                  <>
                    {form.type === "entry-installments" ? (
                      <Field
                        id={`entry-${form.id}`}
                        label="Entrada"
                        value={form.entry}
                        onChange={(v) => patch(form.id, { entry: v })}
                        placeholder="1.000,00"
                        prefix="R$"
                      />
                    ) : null}
                    <Field
                      id={`count-${form.id}`}
                      label="Número de parcelas"
                      value={form.count}
                      onChange={(v) => patch(form.id, { count: v })}
                      placeholder="18"
                      numeric
                    />
                    {form.sameInstallments ? (
                      <Field
                        id={`installment-${form.id}`}
                        label="Valor de cada parcela"
                        value={form.installment}
                        onChange={(v) => patch(form.id, { installment: v })}
                        placeholder="340,00"
                        prefix="R$"
                      />
                    ) : (
                      <Field
                        id={`installments-total-${form.id}`}
                        label="Total parcelado informado no acordo"
                        hint="Some o que o acordo indica para o conjunto das parcelas."
                        value={form.installmentsTotal}
                        onChange={(v) => patch(form.id, { installmentsTotal: v })}
                        placeholder="6.120,00"
                        prefix="R$"
                      />
                    )}
                  </>
                )}

                <Field
                  id={`extra-${form.id}`}
                  label="Custos adicionais informados (opcional)"
                  hint="Qualquer valor fora da entrada e das parcelas que o acordo mencione."
                  value={form.extraCosts}
                  onChange={(v) => patch(form.id, { extraCosts: v })}
                  placeholder="0,00"
                  prefix="R$"
                />
              </div>

              {form.type !== "cash" ? (
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
                      Nesse caso informamos o total parcelado — multiplicar a primeira parcela
                      pelo número de parcelas daria um número errado.
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
            onClick={addOffer}
            className="mt-4 w-full rounded-xl border border-dashed border-brand-teal px-4 py-3 text-sm font-semibold text-brand-teal-dark hover:bg-brand-surface-soft"
          >
            + Adicionar proposta para comparar
          </button>
        ) : null}
      </section>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          className="flex-1 rounded-xl bg-brand-navy px-6 py-4 text-base font-bold text-white hover:bg-brand-navy/90 sm:flex-none"
        >
          Comparar acordo
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
        pedimos CPF, nome, telefone nem o nome do credor.
      </p>

      {/* ---------------- Resultado ---------------- */}
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
        <section
          ref={ref}
          aria-labelledby="resultado-renegociacao"
          className="mt-10 scroll-mt-24"
        >
          <h2
            id="resultado-renegociacao"
            data-result-heading
            tabIndex={-1}
            className="font-serif text-2xl font-bold text-brand-navy"
          >
            O que cada proposta custa
          </h2>

          {result.referenceBalanceCents !== null ? (
            <p className="mt-2 text-base text-brand-text">
              Saldo usado como referência:{" "}
              <strong>{formatCentsBRL(result.referenceBalanceCents)}</strong>
            </p>
          ) : null}

          <ul className="mt-5 grid gap-4 lg:grid-cols-3">
            {result.offers.map((offer, index) => (
              <ResultCard
                key={offer.id}
                offer={offer}
                labels={result.labels[offer.id] ?? []}
                index={index}
              />
            ))}
          </ul>

          {/* Quanto custa parcelar */}
          {result.cashVsInstallment ? (
            <div className="mt-6 rounded-2xl border border-brand-teal/30 bg-brand-teal-soft/40 p-5">
              <h3 className="font-serif text-lg font-bold text-brand-navy">
                Quanto custa parcelar?
              </h3>
              <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-brand-muted">À vista</dt>
                  <dd className="mt-0.5 text-lg font-semibold text-brand-navy">
                    {formatCentsBRL(result.cashVsInstallment.cashTotalCents)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-brand-muted">
                    Parcelado
                  </dt>
                  <dd className="mt-0.5 text-lg font-semibold text-brand-navy">
                    {formatCentsBRL(result.cashVsInstallment.installmentTotalCents)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-brand-muted">
                    Diferença
                  </dt>
                  <dd className="mt-0.5 text-lg font-bold text-brand-navy">
                    {result.cashVsInstallment.differenceCents >= 0 ? "+" : "−"}
                    {formatCentsBRL(Math.abs(result.cashVsInstallment.differenceCents))}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-sm leading-relaxed text-brand-text">
                {result.cashVsInstallment.sentence}
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

          {/* Conferidor do desconto anunciado */}
          {result.discountCheck ? (
            <div className="mt-6 rounded-2xl border border-brand-border bg-brand-surface-soft p-5">
              <h3 className="font-serif text-lg font-bold text-brand-navy">
                O desconto anunciado bate com os valores?
              </h3>
              {result.discountCheck.sentences.map((line) => (
                <p key={line} className="mt-2 text-sm leading-relaxed text-brand-text">
                  {line}
                </p>
              ))}
            </div>
          ) : null}

          {/* Notas sobre a base do percentual */}
          {result.notes.length > 0 ? (
            <div className="mt-6 rounded-xl border border-brand-border bg-white p-4">
              {result.notes.map((note) => (
                <p key={note} className="mt-1 text-xs leading-relaxed text-brand-muted">
                  {note}
                </p>
              ))}
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={copySummary}
              className="rounded-xl border border-brand-border px-5 py-3 text-sm font-semibold text-brand-navy hover:bg-brand-surface-soft"
            >
              {copied ? "Resumo copiado" : "Copiar resumo"}
            </button>
          </div>

          {/* Próximo passo contextual: no máximo um principal e um secundário. */}
          <NextSteps result={result} />

          <p className="mt-8 rounded-xl border border-brand-border bg-white p-4 text-xs leading-relaxed text-brand-muted">
            Ferramenta educativa baseada nos valores que você informou. Ela não analisa o
            contrato completo, não recomenda aceitar ou recusar uma proposta e não substitui a
            leitura das condições. Confirme valores, vencimentos, consequências de atraso e
            demais condições diretamente com o credor antes de fechar o acordo.
          </p>
        </section>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Próximo passo
 * ------------------------------------------------------------------ */

/**
 * No máximo um CTA principal e um secundário, escolhidos pelo que os números
 * mostram. Despejar as doze ferramentas aqui transformaria o resultado num
 * menu e enterraria a informação que a pessoa veio buscar.
 */
function NextSteps({ result }: { result: ReturnType<typeof analyzeRenegotiation> }) {
  const temParcelado = result.offers.some((o) => o.installmentCount > 0);
  const temAVista = result.offers.some((o) => o.type === "cash");

  return (
    <div className="mt-8 rounded-2xl border border-brand-navy/15 bg-brand-navy/5 p-5">
      <h3 className="font-serif text-lg font-bold text-brand-navy">Próximo passo</h3>

      {temParcelado ? (
        <>
          <p className="mt-2 text-sm leading-relaxed text-brand-text">
            Saber qual proposta soma menos não responde à pergunta que decide o acordo:{" "}
            <strong>a parcela cabe no seu mês?</strong>
          </p>
          <Link
            href="/calculadoras/parcela-no-orcamento/"
            onClick={() => trackRenegotiationToolClick("budget")}
            className="mt-3 inline-flex rounded-lg bg-brand-navy px-4 py-2.5 text-sm font-semibold !text-white !no-underline hover:bg-brand-navy/90"
          >
            Analisar a parcela no orçamento →
          </Link>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm leading-relaxed text-brand-text">
            Antes de tirar o valor da reserva para pagar à vista, veja como esse desembolso
            afeta o seu mês.
          </p>
          <Link
            href="/calculadoras/parcela-no-orcamento/"
            onClick={() => trackRenegotiationToolClick("budget")}
            className="mt-3 inline-flex rounded-lg bg-brand-navy px-4 py-2.5 text-sm font-semibold !text-white !no-underline hover:bg-brand-navy/90"
          >
            Ver o impacto no orçamento →
          </Link>
        </>
      )}

      <ul className="mt-5 space-y-2 border-t border-brand-navy/10 pt-4 text-sm leading-relaxed text-brand-text">
        <li>
          Esta é uma entre várias dívidas?{" "}
          <Link
            href="/calculadoras/plano-para-sair-das-dividas/"
            onClick={() => trackRenegotiationToolClick("debt_plan")}
            className="font-semibold text-brand-teal-dark"
          >
            Veja onde ela entra no seu plano
          </Link>
          .
        </li>
        <li>
          A proposta é pegar um empréstimo em outro lugar para quitar esta dívida? Isso é
          outra conta —{" "}
          <Link
            href="/calculadoras/trocar-divida/"
            onClick={() => trackRenegotiationToolClick("debt_switch")}
            className="font-semibold text-brand-teal-dark"
          >
            compare a troca
          </Link>
          .
        </li>
        {temAVista ? (
          <li>
            O contrato ainda está em dia e você quer liquidar antes do prazo?{" "}
            <Link
              href="/calculadoras/quitacao-antecipada/"
              onClick={() => trackRenegotiationToolClick("early_payoff")}
              className="font-semibold text-brand-teal-dark"
            >
              Isso é quitação antecipada
            </Link>
            , com regras próprias.
          </li>
        ) : null}
        <li>
          Alguma coisa na cobrança te deixou desconfortável?{" "}
          <Link
            href="/calculadoras/sinais-de-golpe/"
            onClick={() => trackRenegotiationToolClick("fraud")}
            className="font-semibold text-brand-teal-dark"
          >
            Confira os sinais antes de pagar
          </Link>
          .
        </li>
      </ul>
    </div>
  );
}
