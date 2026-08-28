"use client";

import { useId, useState } from "react";
import {
  calculateMargin,
  MARGIN_RULES,
  validateMarginInput,
  type MarginProfile,
  type MarginResult,
} from "@/lib/calculators/margin";
import { formatBRL } from "@/lib/calculators/loan";
import { useRevealResult } from "./use-reveal-result";

export function MarginCalculator() {
  const formId = useId();
  const [profile, setProfile] = useState<MarginProfile>("inss");
  const [income, setIncome] = useState("1518");
  const [payments, setPayments] = useState("0");
  const [result, setResult] = useState<MarginResult | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const { ref: resultRef, reveal } = useRevealResult();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const input = {
      profile,
      netIncome: Number(income),
      currentLoanPayments: Number(payments) || 0,
    };
    const validationErrors = validateMarginInput(input);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      setResult(null);
      reveal();
      return;
    }
    setErrors([]);
    setResult(calculateMargin(input));
    reveal();
  }

  const rule = MARGIN_RULES[profile];

  return (
    <section
      aria-label="Calculadora de margem consignável"
      className="rounded-2xl border border-brand-border bg-white p-6 shadow-sm"
    >
      <form onSubmit={handleSubmit} noValidate>
        <fieldset>
          <legend className="text-sm font-semibold text-brand-navy">
            Qual é a sua situação?
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {(Object.keys(MARGIN_RULES) as Array<MarginProfile | "verifiedAt">)
              .filter((k): k is MarginProfile => k !== "verifiedAt")
              .map((key) => (
                <label
                  key={key}
                  className={`cursor-pointer rounded-lg border px-4 py-2.5 text-sm font-medium ${
                    profile === key
                      ? "border-brand-teal bg-brand-teal-soft text-brand-teal-dark"
                      : "border-brand-border text-brand-text hover:bg-brand-surface-soft"
                  }`}
                >
                  <input
                    type="radio"
                    name={`${formId}-profile`}
                    value={key}
                    checked={profile === key}
                    onChange={() => setProfile(key)}
                    className="sr-only"
                  />
                  {MARGIN_RULES[key].label}
                </label>
              ))}
          </div>
        </fieldset>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <label
              htmlFor={`${formId}-income`}
              className="block text-sm font-semibold text-brand-navy"
            >
              Benefício ou salário líquido mensal
            </label>
            <p className="mt-0.5 text-xs text-brand-muted">
              Valor que efetivamente cai na conta, em reais
            </p>
            <input
              id={`${formId}-income`}
              type="number"
              inputMode="decimal"
              min={1}
              step="10"
              value={income}
              onChange={(e) => setIncome(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-brand-border bg-white px-3 py-2.5"
            />
          </div>
          <div>
            <label
              htmlFor={`${formId}-payments`}
              className="block text-sm font-semibold text-brand-navy"
            >
              Parcelas de consignado já ativas
            </label>
            <p className="mt-0.5 text-xs text-brand-muted">
              Soma mensal dos contratos atuais (0 se não houver)
            </p>
            <input
              id={`${formId}-payments`}
              type="number"
              inputMode="decimal"
              min={0}
              step="10"
              value={payments}
              onChange={(e) => setPayments(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-brand-border bg-white px-3 py-2.5"
            />
          </div>
        </div>

        {errors.length > 0 ? (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-brand-danger/40 bg-brand-danger-soft p-4 text-sm text-brand-danger"
          >
            <ul className="list-disc space-y-1 pl-4">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <button
          type="submit"
          className="mt-5 w-full rounded-lg bg-brand-teal-dark px-5 py-3 font-semibold text-white hover:bg-brand-teal sm:w-auto"
        >
          Calcular margem
        </button>
      </form>

      {result ? (
        <div ref={resultRef} className="mt-6 scroll-mt-24 border-t border-brand-border pt-6" aria-live="polite">
          <h2 className="font-serif text-xl font-bold text-brand-navy">
            Estimativa de margem
          </h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-brand-teal-soft p-4">
              <dt className="text-xs font-semibold uppercase tracking-wide text-brand-teal-dark">
                Margem para empréstimo ({rule.loanPercent}%)
              </dt>
              <dd className="mt-1 text-2xl font-bold text-brand-navy">
                {formatBRL(result.loanLimit)}
              </dd>
            </div>
            <div className="rounded-xl bg-brand-success-soft p-4">
              <dt className="text-xs font-semibold uppercase tracking-wide text-brand-success">
                Disponível após parcelas atuais
              </dt>
              <dd className="mt-1 text-2xl font-bold text-brand-navy">
                {formatBRL(result.loanAvailable)}
              </dd>
            </div>
            <div className="rounded-xl bg-brand-surface-soft p-4">
              <dt className="text-xs font-semibold uppercase tracking-wide text-brand-muted">
                Fatia do cartão consignado ({rule.cardPercent}%)
              </dt>
              <dd className="mt-1 text-2xl font-bold text-brand-navy">
                {formatBRL(result.cardReserve)}
              </dd>
            </div>
            {rule.benefitCardPercent > 0 ? (
              <div className="rounded-xl bg-brand-surface-soft p-4">
                <dt className="text-xs font-semibold uppercase tracking-wide text-brand-muted">
                  Fatia do cartão benefício ({rule.benefitCardPercent}%)
                </dt>
                <dd className="mt-1 text-2xl font-bold text-brand-navy">
                  {formatBRL(result.benefitCardReserve)}
                </dd>
              </div>
            ) : null}
          </dl>
          <p className="mt-4 text-sm leading-relaxed text-brand-muted">
            Margem disponível é um <strong>teto legal</strong>, não uma
            recomendação de uso: a parcela precisa caber no seu orçamento real,
            não só na margem.
          </p>
        </div>
      ) : null}

      <p className="mt-6 rounded-lg border border-brand-warning/30 bg-brand-warning-soft p-4 text-sm leading-relaxed text-brand-warning">
        Estimativa educativa com os percentuais vigentes verificados em{" "}
        {MARGIN_RULES.verifiedAt.split("-").reverse().join("/")} (
        {rule.legalBasis}). Os limites legais mudam com o tempo e a margem
        oficial é a informada nos canais oficiais (Meu INSS, Carteira de
        Trabalho Digital ou seu órgão). Nenhum dado digitado é enviado ou
        armazenado.
      </p>
    </section>
  );
}
