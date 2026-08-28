"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  attentionLabel,
  buildDebtPlan,
  buildPlanText,
  formatMonths,
  type DebtInput,
  type DebtPlanResult,
  type DebtType,
  type PaymentKind,
  type RateUnit,
  type TriState,
  type UrgentFlag,
} from "@/lib/calculators/debt-plan";
import { formatCentsBRL, parseBRLToCents, parsePercentBR } from "@/lib/calculators/proposal-comparison";
import { useRevealResult } from "./use-reveal-result";

/* Eventos de uso — NUNCA saldo, taxa, atraso, pagamento ou apelido. */
interface GtagWindow extends Window {
  gtag?: (...args: unknown[]) => void;
}
function gtag(...args: unknown[]) {
  const w = window as GtagWindow;
  if (typeof w.gtag === "function") w.gtag(...args);
}

const MAX_DEBTS = 15;

const TYPE_OPTIONS: { value: DebtType; label: string }[] = [
  { value: "cartao", label: "Cartão de crédito" },
  { value: "cheque-especial", label: "Cheque especial" },
  { value: "emprestimo-pessoal", label: "Empréstimo pessoal" },
  { value: "consignado", label: "Consignado" },
  { value: "financiamento-veiculo", label: "Financiamento de veículo" },
  { value: "financiamento-imobiliario", label: "Financiamento imobiliário" },
  { value: "parcelamento", label: "Parcelamento" },
  { value: "renegociada", label: "Dívida renegociada" },
  { value: "crediario", label: "Crediário" },
  { value: "outro", label: "Outro" },
];

const PAYMENT_KIND_OPTIONS: { value: PaymentKind; label: string }[] = [
  { value: "parcela-fixa", label: "Parcela fixa" },
  { value: "minimo", label: "Pagamento mínimo" },
  { value: "costumo-pagar", label: "Valor que costumo pagar" },
  { value: "nao-sei", label: "Não sei" },
];

const URGENT_OPTIONS: { value: UrgentFlag; label: string }[] = [
  { value: "nenhuma", label: "Nenhuma" },
  { value: "acordo-vencendo", label: "Acordo com prazo para vencer" },
  { value: "cobranca-judicial", label: "Cobrança judicial" },
  { value: "risco-perda-bem", label: "Risco informado de perda de bem" },
  { value: "servico-interrupcao", label: "Serviço sujeito a interrupção" },
  { value: "nao-sei", label: "Não sei" },
];

interface DebtForm {
  id: string;
  label: string;
  type: DebtType;
  balance: string;
  payment: string;
  paymentKind: PaymentKind;
  rate: string;
  rateUnit: RateUnit;
  overdue: boolean;
  essential: TriState;
  collateral: TriState;
  urgent: UrgentFlag;
}

function emptyDebt(index: number): DebtForm {
  return {
    id: `debt-${index}-${Math.random().toString(36).slice(2, 8)}`,
    label: "",
    type: "cartao",
    balance: "",
    payment: "",
    paymentKind: "nao-sei",
    rate: "",
    rateUnit: "mensal",
    overdue: false,
    essential: "unknown",
    collateral: "unknown",
    urgent: "nenhuma",
  };
}

function Field({
  id,
  label,
  hint,
  value,
  onChange,
  placeholder,
  numeric,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  numeric?: boolean;
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

function Chips<T extends string>({
  legend,
  options,
  value,
  onChange,
  name,
}: {
  legend: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  name: string;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-brand-navy">{legend}</legend>
      <div className="mt-1 flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o.value}
            className={`cursor-pointer rounded-lg border px-3 py-2 text-sm ${
              value === o.value
                ? "border-brand-teal bg-white font-semibold text-brand-navy"
                : "border-brand-border bg-white text-brand-text"
            }`}
          >
            <input
              type="radio"
              name={name}
              className="sr-only"
              checked={value === o.value}
              onChange={() => onChange(o.value)}
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function toCents(raw: string): number {
  if (raw.trim() === "") return 0;
  return parseBRLToCents(raw) ?? 0;
}

export function DebtPlanBuilder() {
  const [debts, setDebts] = useState<DebtForm[]>([emptyDebt(0), emptyDebt(1)]);
  const [available, setAvailable] = useState("");
  const [lump, setLump] = useState("");
  const [method, setMethod] = useState<"avalanche" | "snowball">("avalanche");
  const [errors, setErrors] = useState<string[]>([]);
  const [result, setResult] = useState<DebtPlanResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [started, setStarted] = useState(false);
  const { ref: resultRef, reveal } = useRevealResult();

  const runningTotals = useMemo(() => {
    const balance = debts.reduce((s, d) => s + toCents(d.balance), 0);
    const payment = debts.reduce((s, d) => s + toCents(d.payment), 0);
    const filled = debts.filter((d) => toCents(d.balance) > 0).length;
    return { balance, payment, filled };
  }, [debts]);

  function touch() {
    if (!started) {
      setStarted(true);
      gtag("event", "debt_plan_start");
    }
  }

  function update(id: string, patch: Partial<DebtForm>) {
    touch();
    setDebts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  function addDebt() {
    touch();
    setDebts((prev) => (prev.length >= MAX_DEBTS ? prev : [...prev, emptyDebt(prev.length)]));
  }

  function removeDebt(id: string) {
    setDebts((prev) => (prev.length <= 2 ? prev : prev.filter((d) => d.id !== id)));
    setResult(null);
  }

  function labelFor(d: DebtForm, index: number): string {
    if (d.label.trim() !== "") return d.label.trim();
    const type = TYPE_OPTIONS.find((t) => t.value === d.type)?.label ?? "Dívida";
    return `${type} ${index + 1}`;
  }

  function calculate() {
    const problems: string[] = [];
    const withBalance = debts.filter((d) => toCents(d.balance) > 0);
    if (withBalance.length < 2) {
      problems.push("Informe o saldo de pelo menos 2 dívidas para comparar estratégias.");
    }
    debts.forEach((d, i) => {
      const balance = toCents(d.balance);
      if (d.balance.trim() !== "" && balance <= 0) {
        problems.push(`${labelFor(d, i)}: saldo inválido — use apenas valores positivos.`);
      }
      if (d.rate.trim() !== "" && d.rateUnit !== "sem-juros" && d.rateUnit !== "nao-sei") {
        const parsed = parsePercentBR(d.rate);
        if (parsed === null || parsed < 0) {
          problems.push(`${labelFor(d, i)}: taxa inválida.`);
        }
      }
    });

    setErrors(problems);
    if (problems.length > 0) {
      setResult(null);
      reveal();
      return;
    }

    const inputs: DebtInput[] = debts
      .filter((d) => toCents(d.balance) > 0)
      .map((d, i) => {
        const rateParsed = d.rate.trim() === "" ? null : parsePercentBR(d.rate);
        const rateUnit: RateUnit =
          d.rateUnit === "sem-juros"
            ? "sem-juros"
            : rateParsed === null
              ? "nao-sei"
              : d.rateUnit === "anual"
                ? "anual"
                : "mensal";
        return {
          id: d.id,
          label: labelFor(d, i),
          type: d.type,
          balanceCents: toCents(d.balance),
          monthlyPaymentCents: toCents(d.payment),
          paymentKind: d.paymentKind,
          rateValue: rateUnit === "sem-juros" ? null : rateParsed,
          rateUnit,
          overdue: d.overdue,
          overdueDays: null,
          essential: d.essential,
          collateral: d.collateral,
          urgent: d.urgent,
        };
      });

    const availableCents = available.trim() === "" ? null : toCents(available);
    const r = buildDebtPlan({
      debts: inputs,
      monthlyAvailableCents: availableCents,
      lumpSumCents: lump.trim() === "" ? null : toCents(lump),
    });
    setResult(r);
    setCopied(false);
    reveal();
    gtag("event", "debt_plan_complete");
  }

  function clearAll() {
    setDebts([emptyDebt(0), emptyDebt(1)]);
    setAvailable("");
    setLump("");
    setErrors([]);
    setResult(null);
    setCopied(false);
  }

  async function copyPlan() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(buildPlanText(result, method));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const order = result ? (method === "avalanche" ? result.avalanche : result.snowball) : null;
  const projection = result
    ? method === "avalanche"
      ? result.projection.avalanche
      : result.projection.snowball
    : null;
  const byId = new Map((result?.debts ?? []).map((d) => [d.id, d]));
  const deficit = result?.budget.status === "deficit";

  return (
    <section
      aria-label="Plano para sair das dívidas"
      className="rounded-2xl border border-brand-border bg-brand-surface-soft/50 p-4 sm:p-6"
    >
      <p className="text-sm leading-relaxed text-brand-muted">
        Grátis, sem cadastro, sem CPF e sem nome de banco. Seus valores são usados apenas no seu
        navegador para montar esta simulação — nada é enviado ou salvo.
      </p>

      {/* ETAPA 1 — DÍVIDAS */}
      <h2 className="mt-6 font-serif text-xl font-bold text-brand-navy">1. Liste suas dívidas</h2>
      <div className="mt-3 space-y-4">
        {debts.map((d, i) => (
          <div key={d.id} className="rounded-xl border border-brand-border bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold text-brand-navy">Dívida {i + 1}</p>
              {debts.length > 2 ? (
                <button
                  type="button"
                  onClick={() => removeDebt(d.id)}
                  className="rounded-lg border border-brand-border px-3 py-1.5 text-sm text-brand-text hover:bg-brand-surface-soft"
                >
                  Remover dívida {i + 1}
                </button>
              ) : null}
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor={`type-${d.id}`} className="block text-sm font-semibold text-brand-navy">
                  Tipo
                </label>
                <select
                  id={`type-${d.id}`}
                  value={d.type}
                  onChange={(e) => update(d.id, { type: e.target.value as DebtType })}
                  className="mt-1 w-full rounded-xl border border-brand-border bg-white px-4 py-3 text-base"
                >
                  {TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <Field
                id={`label-${d.id}`}
                label="Apelido (opcional)"
                hint="Ex.: Cartão 1, Carro. Não precisa do nome do banco."
                value={d.label}
                onChange={(v) => update(d.id, { label: v })}
                placeholder={`Dívida ${i + 1}`}
              />
              <Field
                id={`balance-${d.id}`}
                label="Quanto falta pagar? (R$)"
                hint="Use, de preferência, o saldo atualizado informado pelo credor."
                value={d.balance}
                onChange={(v) => update(d.id, { balance: v })}
                placeholder="3.400,00"
              />
              <Field
                id={`payment-${d.id}`}
                label="Quanto você paga por mês? (R$)"
                value={d.payment}
                onChange={(v) => update(d.id, { payment: v })}
                placeholder="300,00"
              />
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
              <Field
                id={`rate-${d.id}`}
                label="Taxa de juros (opcional)"
                hint="Sem a taxa, a bola de neve funciona; a avalanche não consegue ordenar."
                value={d.rate}
                onChange={(v) => update(d.id, { rate: v })}
                placeholder="4,50"
              />
              <div>
                <label htmlFor={`unit-${d.id}`} className="block text-sm font-semibold text-brand-navy">
                  Unidade
                </label>
                <select
                  id={`unit-${d.id}`}
                  value={d.rateUnit}
                  onChange={(e) => update(d.id, { rateUnit: e.target.value as RateUnit })}
                  className="mt-1 w-full rounded-xl border border-brand-border bg-white px-4 py-3 text-base"
                >
                  <option value="mensal">% ao mês</option>
                  <option value="anual">% ao ano</option>
                  <option value="sem-juros">Sem juros (0%)</option>
                  <option value="nao-sei">Não sei</option>
                </select>
              </div>
            </div>

            <details className="mt-3 text-sm">
              <summary className="cursor-pointer font-medium text-brand-teal-dark">
                Situação desta dívida (atraso, garantia, urgência)
              </summary>
              <div className="mt-3 space-y-3">
                <Chips
                  name={`kind-${d.id}`}
                  legend="O valor mensal é:"
                  options={PAYMENT_KIND_OPTIONS}
                  value={d.paymentKind}
                  onChange={(v) => update(d.id, { paymentKind: v })}
                />
                <label className="flex items-center gap-2 text-sm text-brand-text">
                  <input
                    type="checkbox"
                    checked={d.overdue}
                    onChange={(e) => update(d.id, { overdue: e.target.checked })}
                    className="h-5 w-5 rounded border-brand-border"
                  />
                  Esta dívida está atrasada
                </label>
                <Chips
                  name={`essential-${d.id}`}
                  legend="Está ligada a um bem ou serviço que você considera essencial?"
                  options={[
                    { value: "yes" as TriState, label: "Sim" },
                    { value: "no" as TriState, label: "Não" },
                    { value: "unknown" as TriState, label: "Não sei" },
                  ]}
                  value={d.essential}
                  onChange={(v) => update(d.id, { essential: v })}
                />
                <Chips
                  name={`collateral-${d.id}`}
                  legend="Existe garantia vinculada à dívida?"
                  options={[
                    { value: "yes" as TriState, label: "Sim" },
                    { value: "no" as TriState, label: "Não" },
                    { value: "unknown" as TriState, label: "Não sei" },
                  ]}
                  value={d.collateral}
                  onChange={(v) => update(d.id, { collateral: v })}
                />
                <div>
                  <label htmlFor={`urgent-${d.id}`} className="block text-sm font-semibold text-brand-navy">
                    Existe alguma situação urgente que você já conhece?
                  </label>
                  <select
                    id={`urgent-${d.id}`}
                    value={d.urgent}
                    onChange={(e) => update(d.id, { urgent: e.target.value as UrgentFlag })}
                    className="mt-1 w-full rounded-xl border border-brand-border bg-white px-4 py-3 text-base"
                  >
                    {URGENT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </details>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={addDebt}
          disabled={debts.length >= MAX_DEBTS}
          className="rounded-xl border border-brand-border bg-white px-5 py-3 font-medium text-brand-navy hover:bg-brand-surface-soft disabled:opacity-50"
        >
          + Adicionar outra dívida
        </button>
        {runningTotals.filled > 0 ? (
          <p className="text-sm text-brand-muted">
            {runningTotals.filled} {runningTotals.filled === 1 ? "dívida" : "dívidas"} · saldo total
            informado {formatCentsBRL(runningTotals.balance)} · pagamentos mensais informados{" "}
            {formatCentsBRL(runningTotals.payment)}
          </p>
        ) : null}
      </div>

      {/* ETAPA 2 — ORÇAMENTO */}
      <h2 className="mt-8 font-serif text-xl font-bold text-brand-navy">
        2. Quanto você consegue destinar por mês?
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field
          id="available"
          label="Valor mensal para essas dívidas (R$)"
          hint="Informe quanto consegue pagar mantendo as despesas básicas do seu orçamento."
          value={available}
          onChange={(v) => {
            touch();
            setAvailable(v);
          }}
          placeholder="2.500,00"
        />
        <Field
          id="lump"
          label="Valor extra disponível agora (opcional)"
          hint="Informe apenas um valor que você realmente pretende destinar às dívidas."
          value={lump}
          onChange={(v) => setLump(v)}
          placeholder="1.000,00"
        />
      </div>
      <p className="mt-2 text-sm">
        <Link
          href="/calculadoras/parcela-no-orcamento/"
          onClick={() => gtag("event", "debt_plan_budget_tool_click")}
          className="font-medium text-brand-teal-dark underline"
        >
          Não sabe quanto consegue destinar? Calcule no seu orçamento →
        </Link>
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={calculate}
          className="rounded-xl bg-brand-navy px-6 py-3.5 font-semibold text-white transition-colors hover:bg-brand-navy/90"
        >
          Montar meu plano
        </button>
        <button
          type="button"
          onClick={clearAll}
          className="rounded-xl border border-brand-border bg-white px-5 py-3.5 font-medium text-brand-navy hover:bg-brand-surface-soft"
        >
          Apagar meu plano
        </button>
      </div>

      {/* RESULTADO */}
      <div ref={resultRef} aria-live="polite" className="mt-6 scroll-mt-24">
        {errors.length > 0 ? (
          <ul className="list-disc rounded-xl border border-brand-warning/40 bg-brand-warning-soft p-4 pl-8 text-sm text-brand-text">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : null}

        {result ? (
          <div className="space-y-6">
            {/* MAPA */}
            <div>
              <h2 className="font-serif text-2xl font-bold text-brand-navy">Seu mapa de dívidas</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-brand-border bg-white p-4 text-center">
                  <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">
                    Saldo total informado
                  </p>
                  <p className="mt-1 font-serif text-xl font-bold text-brand-navy">
                    {formatCentsBRL(result.totals.balanceCents)}
                  </p>
                  <p className="mt-0.5 text-xs text-brand-muted">
                    {result.totals.count} dívidas cadastradas
                  </p>
                </div>
                <div className="rounded-xl border border-brand-border bg-white p-4 text-center">
                  <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">
                    Pagamentos mensais informados
                  </p>
                  <p className="mt-1 font-serif text-xl font-bold text-brand-navy">
                    {formatCentsBRL(result.totals.basePaymentsCents)}
                  </p>
                </div>
                <div className="rounded-xl border border-brand-border bg-white p-4 text-center">
                  <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">
                    {deficit ? "Diferença mensal" : "Valor adicional por mês"}
                  </p>
                  <p
                    className={`mt-1 font-serif text-xl font-bold ${
                      deficit ? "text-brand-warning" : "text-brand-teal-dark"
                    }`}
                  >
                    {result.budget.additionalCents === null
                      ? "—"
                      : `${result.budget.additionalCents < 0 ? "−" : ""}${formatCentsBRL(Math.abs(result.budget.additionalCents))}`}
                  </p>
                </div>
              </div>

              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {result.debts.map((d) => (
                  <li key={d.id} className="rounded-xl border border-brand-border bg-white p-3 text-sm">
                    <p className="font-semibold text-brand-navy">{d.label}</p>
                    <p className="text-brand-text">
                      Saldo {formatCentsBRL(d.balanceCents)} ·{" "}
                      {d.monthlyRate === null
                        ? "taxa não informada"
                        : `${(d.monthlyRate * 100).toFixed(2).replace(".", ",")}% a.m.`}{" "}
                      · pagamento {formatCentsBRL(d.monthlyPaymentCents)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            {/* DÉFICIT — PRIMEIRO, ORGANIZE */}
            {deficit ? (
              <div className="rounded-xl border border-brand-warning/40 bg-brand-warning-soft p-4 text-sm leading-relaxed text-brand-text">
                <p className="font-bold text-brand-navy">
                  Seu primeiro problema não é escolher avalanche ou bola de neve.
                </p>
                <p className="mt-1">
                  Pelos valores informados, o que você consegue destinar por mês não cobre a soma
                  dos pagamentos cadastrados — a diferença é de{" "}
                  <strong>{formatCentsBRL(Math.abs(result.budget.additionalCents ?? 0))}</strong>.
                  Nesse cenário não faz sentido rodar uma estratégia de aceleração como se estivesse
                  tudo em dia.
                </p>
                <p className="mt-2">
                  Esta ferramenta <strong>não indica qual parcela deixar de pagar</strong>: essa
                  decisão tem consequências jurídicas e patrimoniais que dependem de cada contrato.
                  O caminho costuma passar por rever condições e negociar:
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>
                    <Link href="/organizacao-financeira/como-negociar-dividas/" className="font-semibold underline">
                      Como negociar dívidas
                    </Link>{" "}
                    — a preparação que muda a proposta, e os canais oficiais na ordem;
                  </li>
                  <li>
                    <Link href="/calculadoras/parcela-no-orcamento/" className="font-semibold underline">
                      Quanto de parcela cabe no meu orçamento
                    </Link>{" "}
                    — para medir a folga real do mês;
                  </li>
                  <li>
                    Se as dívidas comprometem recursos necessários às despesas básicas, pode ser útil
                    procurar orientação especializada — Procon, Defensoria Pública ou o{" "}
                    <a
                      href="https://www.consumidor.gov.br"
                      rel="noopener noreferrer"
                      target="_blank"
                      onClick={() => gtag("event", "debt_plan_official_help_click")}
                      className="font-semibold underline"
                    >
                      Consumidor.gov.br
                    </a>
                    , canal público de interlocução entre consumidores e empresas participantes.
                  </li>
                </ul>
              </div>
            ) : null}

            {/* ATENÇÕES */}
            {result.attentionIds.length > 0 ? (
              <div className="rounded-xl border border-brand-border bg-white p-4">
                <h3 className="font-serif text-lg font-bold text-brand-navy">
                  Antes de escolher uma estratégia
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-brand-text">
                  Encontramos {result.attentionIds.length}{" "}
                  {result.attentionIds.length === 1 ? "dívida" : "dívidas"} com condições que merecem
                  revisão. Condições como garantia, atraso ou consequências específicas podem alterar
                  a prioridade prática. Confira diretamente com o credor antes de seguir apenas a
                  ordem matemática.
                </p>
                <ul className="mt-3 space-y-2 text-sm">
                  {result.attentionIds.map((id) => {
                    const d = byId.get(id);
                    if (!d) return null;
                    return (
                      <li key={id} className="rounded-lg border border-brand-warning/40 bg-brand-warning-soft p-3">
                        <p className="font-semibold text-brand-navy">{d.label}</p>
                        <p className="text-brand-text">
                          Você informou: {d.attentionReasons.map(attentionLabel).join("; ")}.
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            {/* ESTRATÉGIAS */}
            <div>
              <h3 className="font-serif text-xl font-bold text-brand-navy">Compare as estratégias</h3>
              <div className="mt-2 flex gap-2" role="tablist" aria-label="Estratégias">
                {(
                  [
                    ["avalanche", "Avalanche"],
                    ["snowball", "Bola de neve"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={method === value}
                    onClick={() => {
                      setMethod(value);
                      setCopied(false);
                      gtag("event", "debt_plan_method_view");
                    }}
                    className={`rounded-lg border px-4 py-2 text-sm ${
                      method === value
                        ? "border-brand-teal bg-white font-semibold text-brand-navy"
                        : "border-brand-border bg-white text-brand-text"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <p className="mt-3 text-sm leading-relaxed text-brand-text">
                {method === "avalanche"
                  ? "A avalanche prioriza a dívida de maior taxa de juros, mantendo os pagamentos necessários das demais. O objetivo é reduzir o impacto dos juros."
                  : "A bola de neve prioriza a dívida de menor saldo, mantendo os pagamentos necessários das demais. O objetivo é eliminar uma dívida mais rápido e reduzir o número de compromissos."}
              </p>

              {order && order.orderedIds.length > 0 ? (
                <ol className="mt-3 space-y-2">
                  {order.orderedIds.map((id, i) => {
                    const d = byId.get(id);
                    if (!d) return null;
                    return (
                      <li key={id} className="rounded-xl border border-brand-border bg-white p-3 text-sm">
                        <span className="font-semibold text-brand-navy">
                          {i + 1}º {d.label}
                        </span>{" "}
                        —{" "}
                        {method === "avalanche"
                          ? d.monthlyRate !== null
                            ? `${(d.monthlyRate * 100).toFixed(2).replace(".", ",")}% a.m.`
                            : "taxa não informada"
                          : formatCentsBRL(d.balanceCents)}
                      </li>
                    );
                  })}
                </ol>
              ) : null}

              {order && order.unrankedIds.length > 0 ? (
                <div className="mt-3 rounded-xl border border-brand-warning/40 bg-brand-warning-soft p-4 text-sm leading-relaxed text-brand-text">
                  <p className="font-bold text-brand-navy">
                    Não conseguimos ordenar todas as dívidas por juros.
                  </p>
                  <p className="mt-1">
                    Sem a taxa informada, estas ficaram de fora da ordem da avalanche:{" "}
                    {order.unrankedIds.map((id) => byId.get(id)?.label).filter(Boolean).join(", ")}.
                    Taxa não informada não é o mesmo que taxa zero — por isso não as colocamos numa
                    posição inventada.
                  </p>
                  <p className="mt-2">
                    <Link
                      href="/juros-e-cet/como-consultar-taxa-media-do-bc/"
                      className="font-semibold underline"
                    >
                      Onde encontro a taxa da minha dívida?
                    </Link>
                  </p>
                </div>
              ) : null}
            </div>

            {/* PLANO DO MÊS */}
            {!deficit && result.budget.additionalCents !== null && order && order.orderedIds.length > 0 ? (
              <div className="rounded-xl border border-brand-border bg-white p-4">
                <h3 className="font-serif text-lg font-bold text-brand-navy">Seu plano para este mês</h3>
                {result.budget.additionalCents > 0 ? (
                  <>
                    <p className="mt-1 text-sm leading-relaxed text-brand-text">
                      Mantenha os pagamentos informados de todas as dívidas. Pelo método{" "}
                      {method === "avalanche" ? "avalanche" : "bola de neve"}, o valor adicional de{" "}
                      <strong>{formatCentsBRL(result.budget.additionalCents)}</strong> iria para{" "}
                      <strong>{byId.get(order.orderedIds[0]!)?.label}</strong>.
                    </p>
                    <p className="mt-2 text-sm text-brand-text">
                      Pagamento previsto para essa dívida:{" "}
                      <strong>
                        {formatCentsBRL(
                          (byId.get(order.orderedIds[0]!)?.monthlyPaymentCents ?? 0) +
                            result.budget.additionalCents,
                        )}
                      </strong>{" "}
                      — sendo{" "}
                      {formatCentsBRL(byId.get(order.orderedIds[0]!)?.monthlyPaymentCents ?? 0)} de
                      pagamento base e {formatCentsBRL(result.budget.additionalCents)} de adicional.
                    </p>
                    {byId.get(order.orderedIds[0]!)?.revolving === false ? (
                      <p className="mt-2 rounded-lg border border-brand-border bg-brand-surface-soft p-3 text-sm leading-relaxed text-brand-text">
                        Esta é uma dívida de parcela fixa. O valor adicional precisa ser pedido como{" "}
                        <strong>amortização antecipada</strong>, e a instituição informa se ele reduz
                        o prazo ou a parcela — o efeito real depende das regras do contrato. Peça a
                        ela uma simulação de amortização, e veja{" "}
                        <Link href="/calculadoras/quitacao-antecipada/" className="font-semibold underline">
                          como comparar o saldo para quitação
                        </Link>
                        .
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="mt-1 text-sm leading-relaxed text-brand-text">
                    Pelos valores informados, não existe valor adicional disponível neste mês. O
                    plano segue organizando os pagamentos e mostrando a ordem de prioridade — sem
                    fingir aceleração que os números não sustentam.
                  </p>
                )}
              </div>
            ) : null}

            {/* PROJEÇÃO */}
            {projection ? (
              <div className="rounded-xl border border-brand-border bg-white p-4">
                <h3 className="font-serif text-lg font-bold text-brand-navy">
                  Projeção estimada desta simulação
                </h3>
                {projection.monthsToPayoff !== null ? (
                  <p className="mt-1 text-sm leading-relaxed text-brand-text">
                    Na simulação informada, a quitação de todas as dívidas seria estimada em
                    aproximadamente{" "}
                    <strong>{formatMonths(projection.monthsToPayoff)}</strong>, com cerca de{" "}
                    <strong>{formatCentsBRL(projection.totalInterestCents)}</strong> em juros
                    estimados no período.
                  </p>
                ) : (
                  <p className="mt-1 text-sm leading-relaxed text-brand-text">
                    Com os valores informados, esta simulação não alcança a quitação dentro do
                    horizonte utilizado. Isso costuma indicar que os pagamentos mal cobrem os
                    encargos — vale revisar condições e considerar negociação.
                  </p>
                )}

                {result.projection.baseline?.monthsToPayoff && projection.monthsToPayoff ? (
                  <p className="mt-2 text-sm text-brand-text">
                    Sem o valor adicional, a mesma simulação levaria cerca de{" "}
                    {formatMonths(result.projection.baseline.monthsToPayoff)} — uma diferença
                    estimada de{" "}
                    {formatMonths(
                      result.projection.baseline.monthsToPayoff - projection.monthsToPayoff,
                    )}
                    .
                  </p>
                ) : null}

                {result.projection.avalanche?.monthsToPayoff &&
                result.projection.snowball?.monthsToPayoff ? (
                  <p className="mt-2 text-sm text-brand-text">
                    Nesta simulação, a avalanche resultou em{" "}
                    {formatCentsBRL(result.projection.avalanche.totalInterestCents)} de juros
                    estimados e a bola de neve, em{" "}
                    {formatCentsBRL(result.projection.snowball.totalInterestCents)}. São estimativas
                    dos mesmos dados, não uma recomendação de método.
                  </p>
                ) : null}

                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer font-medium text-brand-teal-dark">
                    Hipóteses usadas nesta projeção
                  </summary>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-brand-text">
                    {result.assumptions.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </details>
                <p className="mt-3 text-xs leading-relaxed text-brand-muted">
                  A projeção é uma simulação educacional. O saldo real pode mudar por regras
                  contratuais, datas, encargos, taxas variáveis, pagamentos e condições de
                  renegociação.
                </p>
              </div>
            ) : result.projection.blockers.length > 0 ? (
              <div className="rounded-xl border border-brand-border bg-white p-4 text-sm leading-relaxed text-brand-text">
                <p className="font-bold text-brand-navy">
                  Este é um plano de prioridade, sem projeção de prazo.
                </p>
                <p className="mt-1">
                  Para estimar quanto tempo levaria, faltam dados que não vamos inventar:
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {result.projection.blockers.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* CHECKLIST + CTAs */}
            <div className="rounded-xl border border-brand-border bg-white p-4 text-sm leading-relaxed text-brand-text">
              <h3 className="font-serif text-lg font-bold text-brand-navy">Antes de começar</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Confirme os saldos atualizados com cada credor;</li>
                <li>Confira as taxas — elas mudam a ordem da avalanche;</li>
                <li>Verifique as condições para pagamentos antecipados de cada contrato;</li>
                <li>Mantenha os pagamentos necessários das demais dívidas;</li>
                <li>Revise as dívidas atrasadas ou com garantia antes de seguir a ordem;</li>
                <li>Não contrate crédito novo automaticamente só para “fechar” o plano.</li>
              </ul>

              <div className="mt-4 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={copyPlan}
                  className="rounded-xl border border-brand-border bg-white px-5 py-3 font-medium text-brand-navy hover:bg-brand-surface-soft"
                >
                  {copied ? "Plano copiado ✓" : "Copiar plano"}
                </button>
                <Link
                  href="/calculadoras/quitacao-antecipada/"
                  onClick={() => gtag("event", "debt_plan_early_payoff_click")}
                  className="font-semibold text-brand-teal-dark underline"
                >
                  Tem dinheiro extra para a dívida priorizada? Simule a quitação →
                </Link>
                <Link
                  href="/calculadoras/trocar-divida/"
                  onClick={() => gtag("event", "debt_plan_debt_switch_click")}
                  className="font-semibold text-brand-teal-dark underline"
                >
                  Recebeu uma renegociação para substituir uma dessas dívidas? Compare a troca →
                </Link>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <p className="mt-6 rounded-lg border border-brand-warning/30 bg-brand-warning-soft p-4 text-sm leading-relaxed text-brand-warning">
        Ferramenta educativa baseada nos valores informados. As projeções são estimativas e não
        substituem a análise do contrato, orientação jurídica ou aconselhamento financeiro
        individual.
      </p>
    </section>
  );
}
