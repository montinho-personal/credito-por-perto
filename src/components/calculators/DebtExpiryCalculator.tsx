"use client";

import Link from "next/link";
import { useState } from "react";
import { useRevealResult } from "./use-reveal-result";
import { formatIsoDate, todayInBrazil } from "@/lib/calculators/civil-date";
import {
  computeDebtExpiry,
  describeDays,
  type DeadlineStatus,
  type DebtExpiryOutcome,
} from "@/lib/calculators/debt-expiry";

/*
 * Sem eventos de analytics próprios: a data digitada nunca sai do aparelho.
 * A conta é refeita a cada clique, com o "hoje" do fuso de Brasília.
 */

const ISSUE_COPY = {
  "data-invalida": "Informe uma data válida de vencimento.",
  "vencimento-no-futuro": "A data de vencimento está no futuro. Os prazos só começam a contar depois do vencimento.",
  "vencimento-muito-antigo": "Para vencimentos anteriores a 1990, confira a situação diretamente nos birôs e com o credor.",
} as const;

function StatusLine({ status, done, pending }: { status: DeadlineStatus; done: string; pending: string }) {
  if (status.kind === "hoje") return <p className="mt-2 text-sm font-semibold text-brand-navy">O prazo se completa hoje.</p>;
  if (status.kind === "passou")
    return (
      <p className="mt-2 text-sm font-semibold text-brand-navy">
        {done} há {describeDays(status.days)}.
      </p>
    );
  return (
    <p className="mt-2 text-sm text-brand-text">
      {pending}: faltam {describeDays(status.days)}.
    </p>
  );
}

export function DebtExpiryCalculator() {
  const [due, setDue] = useState("");
  const [outcome, setOutcome] = useState<DebtExpiryOutcome | null>(null);
  const { ref, reveal } = useRevealResult();

  function calculate(e: React.FormEvent) {
    e.preventDefault();
    setOutcome(computeDebtExpiry({ dueIso: due, todayIso: todayInBrazil() }));
    reveal();
  }

  return (
    <section
      aria-label="Calculadora de prazo da dívida no cadastro de inadimplentes"
      className="rounded-2xl border border-brand-border bg-brand-surface-soft/50 p-4 sm:p-6"
    >
      <form onSubmit={calculate}>
        <label htmlFor="vencimento-divida" className="font-serif text-xl font-bold text-brand-navy">
          Qual foi a data de vencimento da dívida?
        </label>
        <p className="mt-1 text-sm leading-relaxed text-brand-muted">
          É a data em que a conta ou a parcela deveria ter sido paga. Ela aparece na consulta aos birôs de crédito. Em dívida
          parcelada, use o vencimento da parcela que foi registrada.
        </p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            id="vencimento-divida"
            type="date"
            required
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="w-full rounded-xl border border-brand-border bg-white px-4 py-3.5 text-lg font-semibold text-brand-navy outline-none focus:border-brand-teal sm:max-w-60"
          />
          <button
            type="submit"
            className="rounded-xl bg-brand-navy px-6 py-3.5 font-semibold text-white transition-colors hover:bg-brand-navy/90"
          >
            Ver os prazos
          </button>
        </div>
        <p className="mt-3 text-xs text-brand-muted">
          A conta é feita no seu navegador. A data não é enviada nem gravada.
        </p>
      </form>

      <div ref={ref} aria-live="polite" className="mt-5 scroll-mt-24">
        {outcome?.kind === "invalid" ? (
          <p className="rounded-xl border border-brand-warning/40 bg-brand-warning-soft p-4 text-sm text-brand-text">
            {ISSUE_COPY[outcome.issue]}
          </p>
        ) : null}

        {outcome?.kind === "ok" ? (
          <div>
            <h2 data-result-heading tabIndex={-1} className="font-serif text-xl font-bold text-brand-navy outline-none">
              Os prazos de uma dívida vencida em {formatIsoDate(due)}
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-brand-border bg-white p-5">
                <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Cadastro de inadimplentes</p>
                <p className="mt-1 font-serif text-3xl font-bold text-brand-navy">
                  {formatIsoDate(outcome.result.registryEndIso)}
                </p>
                <p className="mt-1 text-sm text-brand-text">
                  5 anos contados de {formatIsoDate(outcome.result.registryStartIso)}, o dia seguinte ao vencimento. Depois desse
                  prazo, a informação negativa dessa dívida não pode continuar no cadastro.
                </p>
                <StatusLine status={outcome.result.registryStatus} done="O prazo se completou" pending="Até lá" />
              </div>
              <div className="rounded-xl border border-brand-border bg-white p-5">
                <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Cobrança na Justiça</p>
                <p className="mt-1 font-serif text-3xl font-bold text-brand-navy">
                  {formatIsoDate(outcome.result.prescriptionEndIso)}
                </p>
                <p className="mt-1 text-sm text-brand-text">
                  Prazo de referência de 5 anos para a prescrição da cobrança judicial, contado do vencimento, se nada o
                  interromper.
                </p>
                <StatusLine status={outcome.result.prescriptionStatus} done="O prazo de referência se completou" pending="Até lá" />
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-brand-border bg-white p-5 text-sm leading-relaxed text-brand-text">
              <p className="font-semibold text-brand-navy">O que essas datas não mudam</p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5">
                <li>
                  <strong>A dívida continua existindo.</strong> Sair do cadastro e prescrever a cobrança judicial não apagam o
                  débito, que pode seguir no cadastro interno do credor e ser cobrado sem ameaça nem constrangimento.
                </li>
                <li>
                  <strong>Reconhecer a dívida reinicia a prescrição.</strong> Um acordo, uma confissão ou outro ato que reconheça o
                  débito interrompe a prescrição, que recomeça a contar daquela data (uma vez só). Protesto e ação na Justiça
                  também interrompem.
                </li>
                <li>
                  <strong>Protesto em cartório não sai pelo tempo.</strong> Ele depende de cancelamento no cartório; veja{" "}
                  <Link href="/organizacao-financeira/protesto-em-cartorio/">protesto em cartório</Link>.
                </li>
                <li>
                  <strong>Datas de referência.</strong> Prazo que termine em feriado se prorroga para o dia útil seguinte, e
                  situações específicas, como dívidas com regras próprias de prescrição, podem ter outras datas.
                </li>
              </ul>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
