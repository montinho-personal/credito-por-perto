"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  computeBudgetImpact,
  type BudgetImpactResult,
  type BudgetInput,
} from "@/lib/calculators/budget-impact";
import {
  formatCentsBRL,
  parseBRLToCents,
} from "@/lib/calculators/proposal-comparison";

/* Eventos de uso — NUNCA renda, despesas, dívidas, reserva ou parcela. */
interface GtagWindow extends Window {
  gtag?: (...args: unknown[]) => void;
}
function gtag(...args: unknown[]) {
  const w = window as GtagWindow;
  if (typeof w.gtag === "function") w.gtag(...args);
}

interface FormState {
  scope: "individual" | "familiar";
  income: string;
  incomeVaries: "yes" | "no";
  expenses: string;
  provisions: string;
  debts: string;
  buffer: string;
  installment: string;
}

const EMPTY: FormState = {
  scope: "individual",
  income: "",
  incomeVaries: "no",
  expenses: "",
  provisions: "",
  debts: "",
  buffer: "",
  installment: "",
};

const EXAMPLE: FormState = {
  ...EMPTY,
  income: "5.000,00",
  expenses: "3.000,00",
  debts: "600,00",
  installment: "700,00",
};

function toCents(raw: string): number | null {
  if (raw.trim() === "") return null;
  return parseBRLToCents(raw);
}

function Field({
  id,
  label,
  value,
  onChange,
  hint,
  placeholder,
  optional,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  placeholder?: string;
  optional?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-brand-navy">
        {label}{" "}
        {optional ? <span className="font-normal text-brand-muted">(opcional)</span> : null}
      </label>
      {hint ? <p className="mt-0.5 text-xs text-brand-muted">{hint}</p> : null}
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border border-brand-border bg-white px-4 py-3 text-base text-brand-text outline-none focus:border-brand-teal"
      />
    </div>
  );
}

function Bar({ label, cents, maxCents }: { label: string; cents: number; maxCents: number }) {
  const width = maxCents > 0 ? Math.max(2, Math.min(100, (Math.abs(cents) / maxCents) * 100)) : 2;
  return (
    <div className="text-sm">
      <div className="flex justify-between">
        <span className="text-brand-text">{label}</span>
        <span className="font-semibold text-brand-navy">
          {cents < 0 ? "−" : ""}
          {formatCentsBRL(Math.abs(cents))}
        </span>
      </div>
      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-brand-surface-soft">
        <div
          className={`h-full rounded-full ${cents < 0 ? "bg-brand-warning" : "bg-brand-teal"}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

export function BudgetImpactSimulator() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<string[]>([]);
  const [confirmZeroExpenses, setConfirmZeroExpenses] = useState(false);
  const [computed, setComputed] = useState<{
    result: BudgetImpactResult;
    base: BudgetInput;
    installmentLabel: string;
  } | null>(null);
  const [scenario, setScenario] = useState<string>("");
  const startedRef = useRef(false);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    if (!startedRef.current) {
      startedRef.current = true;
      gtag("event", "budget_tool_start");
    }
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function buildInput(installmentCents: number): BudgetInput {
    return {
      monthlyNetIncomeCents: toCents(form.income) ?? 0,
      recurringExpensesCents: toCents(form.expenses) ?? 0,
      existingDebtPaymentsCents: toCents(form.debts) ?? 0,
      monthlyProvisionsCents: toCents(form.provisions) ?? 0,
      desiredBufferCents: toCents(form.buffer),
      newInstallmentCents: installmentCents,
      incomeVaries: form.incomeVaries === "yes",
    };
  }

  function calculate() {
    const problems: string[] = [];
    const income = toCents(form.income);
    const expenses = toCents(form.expenses);
    const debts = form.debts.trim() === "" ? 0 : toCents(form.debts);
    const installment = toCents(form.installment);

    if (income === null || income < 0) problems.push("Informe sua renda líquida mensal.");
    if (expenses === null || expenses < 0)
      problems.push("Informe quanto você gasta por mês com despesas que precisa manter.");
    if (debts === null || debts < 0)
      problems.push("Informe o total das outras parcelas (use 0 se não houver).");
    if (installment === null || installment < 0)
      problems.push("Informe a parcela que você está pensando em assumir.");
    if (form.buffer.trim() !== "" && toCents(form.buffer) === null)
      problems.push("O valor da reserva desejada parece incompleto — confira os números.");

    if (problems.length === 0 && expenses === 0 && !confirmZeroExpenses) {
      setConfirmZeroExpenses(true);
      setErrors(["Você informou R$ 0,00 de despesas mensais. Se estiver correto, toque em Calcular novamente para confirmar."]);
      setComputed(null);
      return;
    }

    setErrors(problems);
    setConfirmZeroExpenses(false);
    if (problems.length > 0) {
      setComputed(null);
      return;
    }

    const base = buildInput(installment!);
    const result = computeBudgetImpact(base);
    setComputed({ result, base, installmentLabel: formatCentsBRL(installment!) });
    setScenario("");
    gtag("event", "budget_tool_complete");
  }

  function applyScenario(raw: string) {
    if (!computed) return;
    const cents = toCents(raw);
    if (cents === null || cents < 0) return;
    const base = { ...computed.base, newInstallmentCents: cents };
    setComputed({
      result: computeBudgetImpact(base),
      base,
      installmentLabel: formatCentsBRL(cents),
    });
    gtag("event", "budget_tool_scenario_change");
  }

  function clearAll() {
    setForm(EMPTY);
    setComputed(null);
    setErrors([]);
    setScenario("");
    setConfirmZeroExpenses(false);
  }

  const r = computed?.result ?? null;
  const base = computed?.base ?? null;
  const hasExistingDebts = base !== null && base.existingDebtPaymentsCents > 0;
  const negativeOutcome =
    r !== null &&
    (r.warnings.includes("already-negative") || r.warnings.includes("installment-exceeds-free-cash"));

  return (
    <section
      aria-label="Simulação do impacto de uma nova parcela no orçamento"
      className="rounded-2xl border border-brand-border bg-brand-surface-soft/50 p-4 sm:p-6"
    >
      <p className="text-sm leading-relaxed text-brand-muted">
        Grátis, sem cadastro e sem CPF. Seus valores não precisam sair do seu dispositivo para
        fazer este cálculo — nada é enviado ou salvo.
      </p>

      <div className="mt-5 space-y-5">
        <fieldset>
          <legend className="text-sm font-semibold text-brand-navy">Esse orçamento é:</legend>
          <div className="mt-1 flex gap-2">
            {(["individual", "familiar"] as const).map((option) => (
              <label
                key={option}
                className={`cursor-pointer rounded-lg border px-3 py-2 text-sm ${
                  form.scope === option
                    ? "border-brand-teal bg-white font-semibold text-brand-navy"
                    : "border-brand-border bg-white text-brand-text"
                }`}
              >
                <input
                  type="radio"
                  name="scope"
                  className="sr-only"
                  checked={form.scope === option}
                  onChange={() => set("scope", option)}
                />
                {option === "individual" ? "Só meu" : "Da minha casa/família"}
              </label>
            ))}
          </div>
        </fieldset>

        <Field
          id="income"
          label="1. Quanto entra líquido por mês? (R$)"
          hint="Use o valor que realmente entra no orçamento depois dos descontos — e, se a renda varia, um mês recorrente, não um mês excepcional."
          value={form.income}
          onChange={(v) => set("income", v)}
          placeholder="5.000,00"
        />

        <fieldset>
          <legend className="text-sm font-semibold text-brand-navy">
            Sua renda costuma variar bastante de um mês para outro?
          </legend>
          <div className="mt-1 flex gap-2">
            {(["no", "yes"] as const).map((option) => (
              <label
                key={option}
                className={`cursor-pointer rounded-lg border px-3 py-2 text-sm ${
                  form.incomeVaries === option
                    ? "border-brand-teal bg-white font-semibold text-brand-navy"
                    : "border-brand-border bg-white text-brand-text"
                }`}
              >
                <input
                  type="radio"
                  name="income-varies"
                  className="sr-only"
                  checked={form.incomeVaries === option}
                  onChange={() => set("incomeVaries", option)}
                />
                {option === "no" ? "Não" : "Sim"}
              </label>
            ))}
          </div>
        </fieldset>

        <Field
          id="expenses"
          label="2. Quanto você gasta por mês com despesas que precisa manter? (R$)"
          hint="Moradia, alimentação, contas, transporte, saúde e outros gastos recorrentes importantes."
          value={form.expenses}
          onChange={(v) => set("expenses", v)}
          placeholder="3.000,00"
        />

        <Field
          id="debts"
          label="3. Quanto você já paga por mês em outras parcelas ou dívidas? (R$)"
          hint="Financiamento, empréstimo, consignado, compras parceladas. Se alguma parcela já está nas despesas acima, não coloque de novo. Use 0 se não houver."
          value={form.debts}
          onChange={(v) => set("debts", v)}
          placeholder="600,00"
        />

        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-brand-teal-dark">
            Adicionar gastos que não acontecem todo mês e reserva desejada (opcional)
          </summary>
          <div className="mt-3 space-y-4">
            <Field
              id="provisions"
              label="Valor separado por mês para gastos que não são mensais (R$)"
              hint="IPVA, IPTU, material escolar, manutenção, seguro anual — o rateio mensal deles."
              value={form.provisions}
              onChange={(v) => set("provisions", v)}
              optional
            />
            <Field
              id="buffer"
              label="Quanto você gostaria de preservar por mês para imprevistos, reserva ou objetivos? (R$)"
              hint="Manter uma margem para imprevistos evita que qualquer surpresa vire dívida nova. Sem valor definido? Deixe em branco."
              value={form.buffer}
              onChange={(v) => set("buffer", v)}
              optional
            />
          </div>
        </details>

        <Field
          id="installment"
          label="4. Qual parcela você está pensando em assumir? (R$)"
          value={form.installment}
          onChange={(v) => set("installment", v)}
          placeholder="700,00"
        />
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={calculate}
          className="rounded-xl bg-brand-navy px-6 py-3.5 font-semibold text-white transition-colors hover:bg-brand-navy/90"
        >
          Calcular impacto
        </button>
        <button
          type="button"
          onClick={() => {
            setForm(EXAMPLE);
            setComputed(null);
            setErrors([]);
            setConfirmZeroExpenses(false);
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
          Limpar meu orçamento
        </button>
      </div>

      <div aria-live="polite" className="mt-6">
        {errors.length > 0 ? (
          <ul className="list-disc rounded-xl border border-brand-warning/40 bg-brand-warning-soft p-4 pl-8 text-sm text-brand-text">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : null}

        {r && base ? (
          <div>
            <h2 className="font-serif text-2xl font-bold text-brand-navy">
              O que essa parcela faria com seu orçamento?
            </h2>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-brand-border bg-white p-4 text-center">
                <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">
                  Antes da nova parcela
                </p>
                <p className="mt-1 font-serif text-xl font-bold text-brand-navy">
                  {r.freeCashBeforeCents < 0 ? "−" : ""}
                  {formatCentsBRL(Math.abs(r.freeCashBeforeCents))}
                </p>
                <p className="mt-0.5 text-xs text-brand-muted">
                  {r.freeCashBeforeCents < 0 ? "déficit pelos valores informados" : "livres pelos valores informados"}
                </p>
              </div>
              <div className="rounded-xl border border-brand-border bg-white p-4 text-center">
                <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">
                  Nova parcela
                </p>
                <p className="mt-1 font-serif text-xl font-bold text-brand-navy">
                  {computed!.installmentLabel}
                </p>
              </div>
              <div className="rounded-xl border border-brand-border bg-white p-4 text-center">
                <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">
                  Depois da nova parcela
                </p>
                <p className="mt-1 font-serif text-xl font-bold text-brand-navy">
                  {r.freeCashAfterCents < 0 ? "−" : ""}
                  {formatCentsBRL(Math.abs(r.freeCashAfterCents))}
                </p>
                <p className="mt-0.5 text-xs text-brand-muted">
                  {r.freeCashAfterCents < 0 ? "faltariam por mês" : "restariam por mês"}
                </p>
              </div>
            </div>

            <ul className="mt-4 space-y-1.5 rounded-xl border border-brand-border bg-white p-4 text-sm leading-relaxed text-brand-text">
              {r.sentences.map((s) => (
                <li key={s}>• {s}</li>
              ))}
            </ul>

            <div className="mt-4 space-y-3 rounded-xl border border-brand-border bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">
                Seu mês em barras
              </p>
              <Bar label="Renda líquida" cents={base.monthlyNetIncomeCents} maxCents={base.monthlyNetIncomeCents} />
              <Bar
                label="Despesas + parcelas existentes + provisões"
                cents={base.recurringExpensesCents + base.existingDebtPaymentsCents + base.monthlyProvisionsCents}
                maxCents={base.monthlyNetIncomeCents}
              />
              <Bar label="Nova parcela" cents={base.newInstallmentCents} maxCents={base.monthlyNetIncomeCents} />
              <Bar label="Folga restante" cents={r.freeCashAfterCents} maxCents={base.monthlyNetIncomeCents} />
            </div>

            {r.installmentIncomeRatio !== null || r.totalDebtIncomeRatio !== null ? (
              <div className="mt-4 rounded-xl border border-brand-border bg-white p-4 text-sm leading-relaxed text-brand-text">
                <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">
                  Em perspectiva
                </p>
                {r.installmentIncomeRatio !== null ? (
                  <p className="mt-1">
                    A nova parcela corresponde a{" "}
                    <strong>{r.installmentIncomeRatio.toFixed(1).replace(".", ",")}% da renda líquida</strong>
                    {r.installmentFreeCashRatio !== null ? (
                      <>
                        {" "}— mas a{" "}
                        <strong>
                          {r.installmentFreeCashRatio.toFixed(1).replace(".", ",")}% da folga informada
                        </strong>{" "}
                        que existia antes dela.
                      </>
                    ) : (
                      "."
                    )}
                  </p>
                ) : null}
                {r.totalDebtIncomeRatio !== null && base.existingDebtPaymentsCents > 0 ? (
                  <p className="mt-1">
                    Somando as parcelas existentes e a nova, os compromissos informados
                    representariam{" "}
                    <strong>{r.totalDebtIncomeRatio.toFixed(1).replace(".", ",")}% da renda líquida</strong>.
                  </p>
                ) : null}
                {r.freeCashAfterBufferCents !== null && r.freeCashAfterBufferCents >= 0 ? (
                  <p className="mt-1">
                    Depois da reserva que você definiu, permaneceriam{" "}
                    <strong>{formatCentsBRL(r.freeCashAfterBufferCents)}</strong> por mês.
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="mt-4 rounded-xl border border-brand-border bg-white p-4">
              <p className="text-sm font-bold text-brand-navy">E se a parcela fosse outra?</p>
              <p className="mt-0.5 text-xs text-brand-muted">
                Veja como diferentes parcelas afetariam seu orçamento — sem recomendação de valor.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {[0.5, 0.75, 1.25].map((factor) => {
                  const value = Math.round((base.newInstallmentCents * factor) / 100) * 100;
                  return (
                    <button
                      key={factor}
                      type="button"
                      onClick={() => applyScenario(String(value / 100).replace(".", ","))}
                      className="rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-brand-navy hover:border-brand-teal"
                    >
                      {formatCentsBRL(value)}
                    </button>
                  );
                })}
                <input
                  aria-label="Testar outro valor de parcela"
                  type="text"
                  inputMode="decimal"
                  value={scenario}
                  onChange={(e) => setScenario(e.target.value)}
                  onBlur={() => scenario.trim() !== "" && applyScenario(scenario)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applyScenario(scenario);
                  }}
                  placeholder="Outro valor"
                  className="w-32 rounded-lg border border-brand-border bg-white px-3 py-2 text-sm outline-none focus:border-brand-teal"
                />
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-brand-border bg-white p-4">
              <p className="font-bold text-brand-navy">Antes de assumir a parcela, pense também:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-brand-text">
                <li>Sua renda é estável?</li>
                <li>Existem gastos anuais que não entraram na conta?</li>
                <li>Alguma despesa pode aumentar nos próximos meses?</li>
                <li>Você mantém alguma margem para imprevistos?</li>
                <li>As dívidas existentes estão sob controle?</li>
              </ul>
            </div>

            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              {negativeOutcome ? (
                <>
                  <Link
                    href="/organizacao-financeira/renegociacao-ou-emprestimo/"
                    onClick={() => gtag("event", "budget_tool_article_click")}
                    className="font-semibold text-brand-teal-dark underline"
                  >
                    Veja o que fazer quando a conta não fecha →
                  </Link>
                  {hasExistingDebts ? (
                    <Link
                      href="/calculadoras/trocar-divida/"
                      onClick={() => gtag("event", "budget_tool_debt_switch_click")}
                      className="font-semibold text-brand-teal-dark underline"
                    >
                      Vale trocar uma dívida atual? →
                    </Link>
                  ) : null}
                </>
              ) : (
                <>
                  <Link
                    href="/calculadoras/comparador-de-propostas/"
                    onClick={() => gtag("event", "budget_tool_comparator_click")}
                    className="font-semibold text-brand-teal-dark underline"
                  >
                    A parcela parece administrável? Ainda falta saber quanto o crédito custa →
                  </Link>
                  <Link
                    href="/calculadoras/minha-taxa-esta-cara/"
                    onClick={() => gtag("event", "budget_tool_rate_tool_click")}
                    className="font-semibold text-brand-teal-dark underline"
                  >
                    Colocar a taxa em contexto →
                  </Link>
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>

      <p className="mt-6 rounded-lg border border-brand-warning/30 bg-brand-warning-soft p-4 text-sm leading-relaxed text-brand-warning">
        Ferramenta educativa. O resultado depende dos valores informados e não constitui
        recomendação para contratar crédito ou assumir uma nova dívida. A ferramenta não conhece
        despesas futuras, variações de renda ou condições pessoais — ela organiza o que você
        informa.
      </p>
    </section>
  );
}
