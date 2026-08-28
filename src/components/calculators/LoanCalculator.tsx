"use client";

import { useId, useState } from "react";
import { useRevealResult } from "./use-reveal-result";
import {
  calculateLoan,
  formatBRL,
  monthlyToAnnualRate,
  validateLoanInput,
  type LoanResult,
} from "@/lib/calculators/loan";

function NumberField({
  id,
  label,
  hint,
  value,
  onChange,
  min,
  step,
  suffix,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  min?: number;
  step?: string;
  suffix?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-brand-navy">
        {label}
      </label>
      {hint ? <p className="mt-0.5 text-xs text-brand-muted">{hint}</p> : null}
      <div className="mt-1.5 flex items-center gap-2">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-brand-border bg-white px-3 py-2.5 text-brand-text focus:border-brand-teal"
        />
        {suffix ? (
          <span className="shrink-0 text-sm text-brand-muted">{suffix}</span>
        ) : null}
      </div>
    </div>
  );
}

export function LoanCalculator() {
  const formId = useId();
  const [principal, setPrincipal] = useState("5000");
  const [rate, setRate] = useState("3");
  const [installments, setInstallments] = useState("12");
  const [fees, setFees] = useState("0");
  const [result, setResult] = useState<LoanResult | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [showSchedule, setShowSchedule] = useState(false);

  const { ref: resultRef, reveal } = useRevealResult();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const input = {
      principal: Number(principal),
      monthlyRatePercent: Number(rate),
      installments: Number(installments),
      additionalFees: Number(fees) || 0,
    };
    const validationErrors = validateLoanInput(input);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      setResult(null);
      reveal();
      return;
    }
    setErrors([]);
    setResult(calculateLoan(input));
    reveal();
  }

  const annualRate = Number(rate) >= 0 ? monthlyToAnnualRate(Number(rate)) : 0;

  return (
    <section
      aria-label="Calculadora de parcelas de empréstimo"
      className="rounded-2xl border border-brand-border bg-white p-6 shadow-sm"
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="grid gap-5 sm:grid-cols-2">
          <NumberField
            id={`${formId}-principal`}
            label="Valor solicitado"
            hint="Quanto você pretende pedir emprestado"
            value={principal}
            onChange={setPrincipal}
            min={1}
            step="100"
            suffix="R$"
          />
          <NumberField
            id={`${formId}-rate`}
            label="Taxa de juros mensal"
            hint="Informada na proposta, em % ao mês"
            value={rate}
            onChange={setRate}
            min={0}
            step="0.01"
            suffix="% a.m."
          />
          <NumberField
            id={`${formId}-installments`}
            label="Número de parcelas"
            hint="Quantidade de meses para pagar"
            value={installments}
            onChange={setInstallments}
            min={1}
            step="1"
          />
          <NumberField
            id={`${formId}-fees`}
            label="Taxas adicionais (opcional)"
            hint="Tarifas fixas somadas ao valor financiado"
            value={fees}
            onChange={setFees}
            min={0}
            step="10"
            suffix="R$"
          />
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
          Calcular parcelas
        </button>
      </form>

      {result ? (
        <div ref={resultRef} className="mt-6 scroll-mt-24 border-t border-brand-border pt-6" aria-live="polite">
          <h2 className="font-serif text-xl font-bold text-brand-navy">
            Resultado estimado
          </h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-brand-teal-soft p-4">
              <dt className="text-xs font-semibold uppercase tracking-wide text-brand-teal-dark">
                Parcela mensal
              </dt>
              <dd className="mt-1 text-2xl font-bold text-brand-navy">
                {formatBRL(result.installmentValue)}
              </dd>
            </div>
            <div className="rounded-xl bg-brand-surface-soft p-4">
              <dt className="text-xs font-semibold uppercase tracking-wide text-brand-muted">
                Total pago
              </dt>
              <dd className="mt-1 text-2xl font-bold text-brand-navy">
                {formatBRL(result.totalPaid)}
              </dd>
            </div>
            <div className="rounded-xl bg-brand-surface-soft p-4">
              <dt className="text-xs font-semibold uppercase tracking-wide text-brand-muted">
                Total de juros
              </dt>
              <dd className="mt-1 text-2xl font-bold text-brand-navy">
                {formatBRL(result.totalInterest)}
              </dd>
            </div>
            <div className="rounded-xl bg-brand-surface-soft p-4">
              <dt className="text-xs font-semibold uppercase tracking-wide text-brand-muted">
                Taxa anual equivalente
              </dt>
              <dd className="mt-1 text-2xl font-bold text-brand-navy">
                {annualRate.toLocaleString("pt-BR", {
                  maximumFractionDigits: 2,
                })}
                % a.a.
              </dd>
            </div>
          </dl>

          <button
            type="button"
            onClick={() => setShowSchedule((v) => !v)}
            aria-expanded={showSchedule}
            className="mt-5 rounded-lg border border-brand-border px-4 py-2 text-sm font-medium text-brand-navy hover:bg-brand-surface-soft"
          >
            {showSchedule ? "Ocultar" : "Ver"} tabela de amortização
          </button>

          {showSchedule ? (
            <div className="mt-4 max-h-96 overflow-auto rounded-xl border border-brand-border">
              <table className="w-full min-w-[36rem] border-collapse text-sm">
                <caption className="sr-only">
                  Tabela de amortização mês a mês pelo sistema Price
                </caption>
                <thead className="sticky top-0 bg-brand-surface-soft text-left">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-bold text-brand-navy">Mês</th>
                    <th scope="col" className="px-3 py-2 font-bold text-brand-navy">Parcela</th>
                    <th scope="col" className="px-3 py-2 font-bold text-brand-navy">Juros</th>
                    <th scope="col" className="px-3 py-2 font-bold text-brand-navy">Amortização</th>
                    <th scope="col" className="px-3 py-2 font-bold text-brand-navy">Saldo devedor</th>
                  </tr>
                </thead>
                <tbody>
                  {result.schedule.map((row) => (
                    <tr key={row.month} className="border-t border-brand-border">
                      <td className="px-3 py-1.5 tabular-nums">{row.month}</td>
                      <td className="px-3 py-1.5 tabular-nums">{formatBRL(row.payment)}</td>
                      <td className="px-3 py-1.5 tabular-nums">{formatBRL(row.interest)}</td>
                      <td className="px-3 py-1.5 tabular-nums">{formatBRL(row.amortization)}</td>
                      <td className="px-3 py-1.5 tabular-nums">{formatBRL(row.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}

      <p className="mt-6 rounded-lg border border-brand-warning/30 bg-brand-warning-soft p-4 text-sm leading-relaxed text-brand-warning">
        Esta calculadora apresenta apenas uma estimativa educativa, usando o
        sistema Price (parcelas fixas com juros compostos). O valor real depende
        do CET, do IOF, das tarifas, dos seguros, da política da instituição e
        das condições oferecidas ao consumidor. Nenhum dado digitado aqui é
        enviado ou armazenado: o cálculo acontece no seu navegador.
      </p>
    </section>
  );
}
