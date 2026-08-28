"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { useRevealResult } from "./use-reveal-result";
import {
  buildSummaryText,
  compareProposals,
  formatCentsBRL,
  formatPercentBR,
  parseBRLToCents,
  parsePercentBR,
  validateProposal,
  type ComparisonResult,
  type ProposalInput,
} from "@/lib/calculators/proposal-comparison";
import {
  trackCompareAddThird,
  trackCompareComplete,
  trackCompareCopySummary,
  trackCompareScamWarningView,
  trackCompareStart,
} from "@/components/calculators/comparator-analytics";

/* ---------- Estado do formulário (apenas em memória, nunca enviado) ---------- */

interface ProposalFormState {
  nickname: string;
  netAmount: string;
  installments: string;
  installmentValue: string;
  cet: string;
  cetUnknown: boolean;
  showAdvanced: boolean;
  interestValue: string;
  interestPeriod: "monthly" | "annual";
  externalCosts: string;
  upfrontPayment: boolean;
}

const EMPTY_PROPOSAL: ProposalFormState = {
  nickname: "",
  netAmount: "",
  installments: "",
  installmentValue: "",
  cet: "",
  cetUnknown: false,
  showAdvanced: false,
  interestValue: "",
  interestPeriod: "monthly",
  externalCosts: "",
  upfrontPayment: false,
};

const EXAMPLE: [ProposalFormState, ProposalFormState] = [
  { ...EMPTY_PROPOSAL, netAmount: "10.000,00", installments: "24", installmentValue: "620,00", cet: "32" },
  { ...EMPTY_PROPOSAL, netAmount: "10.000,00", installments: "36", installmentValue: "470,00", cet: "28" },
];

const LETTERS = ["A", "B", "C"] as const;

function labelFor(state: ProposalFormState, index: number): string {
  const base = `Proposta ${LETTERS[index]}`;
  const nick = state.nickname.trim();
  return nick ? `${base} (${nick})` : base;
}

function toInput(state: ProposalFormState, index: number): ProposalInput | string[] {
  const label = labelFor(state, index);
  const netAmountCents = parseBRLToCents(state.netAmount);
  const installments = /^\d+$/.test(state.installments.trim())
    ? Number(state.installments.trim())
    : Number.NaN;
  const installmentCents = parseBRLToCents(state.installmentValue);
  const errors: string[] = [];
  if (netAmountCents === null) errors.push(`Informe quanto você recebe na ${label}.`);
  if (!Number.isInteger(installments)) errors.push(`Informe o número de parcelas da ${label}.`);
  if (installmentCents === null) errors.push(`Informe o valor da parcela da ${label}.`);

  let cetAnnualPercent: number | undefined;
  if (!state.cetUnknown && state.cet.trim() !== "") {
    const parsed = parsePercentBR(state.cet);
    if (parsed === null) errors.push(`O CET da ${label} precisa ser um percentual (ex.: 32,4).`);
    else cetAnnualPercent = parsed;
  }

  let interestRate: ProposalInput["interestRate"];
  if (state.showAdvanced && state.interestValue.trim() !== "") {
    const parsed = parsePercentBR(state.interestValue);
    if (parsed === null) errors.push(`A taxa de juros da ${label} precisa ser um percentual.`);
    else interestRate = { value: parsed, period: state.interestPeriod };
  }

  let externalCostsCents: number | undefined;
  if (state.showAdvanced && state.externalCosts.trim() !== "") {
    const parsed = parseBRLToCents(state.externalCosts);
    if (parsed === null) errors.push(`Os custos fora das parcelas da ${label} precisam ser um valor em reais.`);
    else externalCostsCents = parsed;
  }

  if (errors.length > 0) return errors;

  const input: ProposalInput = {
    label,
    netAmountCents: netAmountCents!,
    installments,
    installmentCents: installmentCents!,
    cetAnnualPercent,
    interestRate,
    externalCostsCents,
    upfrontPaymentRequested: state.showAdvanced && state.upfrontPayment,
  };
  const engineErrors = validateProposal(input);
  return engineErrors.length > 0 ? engineErrors : input;
}

/* ---------- Campos ---------- */

function TextField({
  id,
  label,
  hint,
  value,
  onChange,
  onBlur,
  suffix,
  placeholder,
  inputMode = "decimal",
  disabled,
  describedBy,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  suffix?: string;
  placeholder?: string;
  inputMode?: "decimal" | "numeric" | "text";
  disabled?: boolean;
  describedBy?: string;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-brand-navy">
        {label}
      </label>
      {hint ? (
        <p id={hintId} className="mt-0.5 text-xs text-brand-muted">
          {hint}
        </p>
      ) : null}
      <div className="mt-1.5 flex items-center gap-2">
        <input
          id={id}
          type="text"
          inputMode={inputMode}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          aria-describedby={[hintId, describedBy].filter(Boolean).join(" ") || undefined}
          className="w-full rounded-lg border border-brand-border bg-white px-3 py-2.5 text-brand-text focus:border-brand-teal disabled:bg-brand-surface-soft disabled:text-brand-muted"
        />
        {suffix ? <span className="shrink-0 text-sm text-brand-muted">{suffix}</span> : null}
      </div>
    </div>
  );
}

function formatMoneyField(v: string): string {
  const cents = parseBRLToCents(v);
  if (cents === null) return v;
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/* ---------- Formulário de uma proposta ---------- */

function ProposalFieldset({
  index,
  state,
  update,
}: {
  index: number;
  state: ProposalFormState;
  update: (patch: Partial<ProposalFormState>) => void;
}) {
  const id = useId();
  const [showCetHelp, setShowCetHelp] = useState(false);
  return (
    <fieldset className="rounded-2xl border border-brand-border bg-white p-5">
      <legend className="px-1 font-serif text-lg font-bold text-brand-navy">
        Proposta {LETTERS[index]}
      </legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id={`${id}-net`}
          label="Quanto você recebe?"
          hint="Valor líquido que cai na conta"
          value={state.netAmount}
          onChange={(v) => update({ netAmount: v })}
          onBlur={() => update({ netAmount: formatMoneyField(state.netAmount) })}
          suffix="R$"
          placeholder="10.000,00"
        />
        <TextField
          id={`${id}-installments`}
          label="Quantas parcelas?"
          value={state.installments}
          onChange={(v) => update({ installments: v.replace(/\D/g, "") })}
          inputMode="numeric"
          placeholder="24"
        />
        <TextField
          id={`${id}-installment`}
          label="Quanto é cada parcela?"
          value={state.installmentValue}
          onChange={(v) => update({ installmentValue: v })}
          onBlur={() => update({ installmentValue: formatMoneyField(state.installmentValue) })}
          suffix="R$"
          placeholder="620,00"
        />
        <div>
          <TextField
            id={`${id}-cet`}
            label="CET informado (ao ano)"
            value={state.cet}
            onChange={(v) => update({ cet: v })}
            suffix="% a.a."
            placeholder="32,4"
            disabled={state.cetUnknown}
          />
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
            <label className="flex items-center gap-2 text-xs text-brand-muted">
              <input
                type="checkbox"
                checked={state.cetUnknown}
                onChange={(e) => update({ cetUnknown: e.target.checked, cet: "" })}
                className="h-4 w-4 rounded border-brand-border"
              />
              Não sei / não encontrei
            </label>
            <button
              type="button"
              onClick={() => setShowCetHelp((v) => !v)}
              aria-expanded={showCetHelp}
              className="text-xs font-medium text-brand-teal-dark underline"
            >
              Onde encontro isso?
            </button>
          </div>
          {showCetHelp ? (
            <p className="mt-2 rounded-lg bg-brand-surface-soft p-3 text-xs leading-relaxed text-brand-muted">
              Procure &ldquo;Custo Efetivo Total&rdquo; ou &ldquo;CET&rdquo; na proposta, na simulação ou
              no contrato — geralmente em % ao ano. Taxa de juros não é a mesma
              coisa que CET: o CET inclui também tarifas, tributos e seguros.
            </p>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        onClick={() => update({ showAdvanced: !state.showAdvanced })}
        aria-expanded={state.showAdvanced}
        className="mt-4 text-sm font-medium text-brand-teal-dark underline"
      >
        {state.showAdvanced ? "Ocultar detalhes" : "Adicionar detalhes (opcional)"}
      </button>

      {state.showAdvanced ? (
        <div className="mt-4 grid gap-4 border-t border-brand-border pt-4 sm:grid-cols-2">
          <div>
            <TextField
              id={`${id}-interest`}
              label="Taxa de juros informada (opcional)"
              hint="Taxa de juros não é a mesma coisa que CET"
              value={state.interestValue}
              onChange={(v) => update({ interestValue: v })}
              suffix="%"
              placeholder="2,9"
            />
            <div
              role="radiogroup"
              aria-label={`Período da taxa de juros da Proposta ${LETTERS[index]}`}
              className="mt-2 flex gap-4 text-sm"
            >
              {(
                [
                  ["monthly", "ao mês"],
                  ["annual", "ao ano"],
                ] as const
              ).map(([period, text]) => (
                <label key={period} className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name={`${id}-period`}
                    checked={state.interestPeriod === period}
                    onChange={() => update({ interestPeriod: period })}
                  />
                  {text}
                </label>
              ))}
            </div>
          </div>
          <TextField
            id={`${id}-external`}
            label="Custos fora das parcelas (opcional)"
            hint="Tarifas ou seguros pagos à parte, se houver"
            value={state.externalCosts}
            onChange={(v) => update({ externalCosts: v })}
            onBlur={() => update({ externalCosts: formatMoneyField(state.externalCosts) })}
            suffix="R$"
          />
          <TextField
            id={`${id}-nickname`}
            label="Apelido (opcional, só para você)"
            hint="Ex.: 'banco da folha'. Fica apenas nesta tela."
            value={state.nickname}
            onChange={(v) => update({ nickname: v.slice(0, 30) })}
            inputMode="text"
          />
          <div className="sm:col-span-2">
            <label className="flex items-start gap-2 text-sm text-brand-text">
              <input
                type="checkbox"
                checked={state.upfrontPayment}
                onChange={(e) => update({ upfrontPayment: e.target.checked })}
                className="mt-0.5 h-4 w-4 rounded border-brand-border"
              />
              Pediram algum pagamento <strong>antes</strong> de liberar o dinheiro?
            </label>
          </div>
        </div>
      ) : null}
    </fieldset>
  );
}

/* ---------- Resultado ---------- */

const CRITERION_LABELS: Record<string, string> = {
  lowestInstallment: "Menor parcela",
  shortestTerm: "Menor prazo",
  lowestCet: "Menor CET informado",
  lowestTotalPaid: "Menor total pago",
};

function tradeOffSentence(result: ComparisonResult): string[] {
  const sentences: string[] = [];
  for (const pair of result.pairs) {
    const a = result.proposals[pair.aIndex];
    const b = result.proposals[pair.bIndex];
    if (!a || !b) continue;
    // Quem tem a parcela menor neste par?
    if (pair.installmentDiffCents === 0) continue;
    const [cheap, other] = pair.installmentDiffCents < 0 ? [b, a] : [a, b];
    const monthly = Math.abs(pair.installmentDiffCents);
    const termDiff =
      cheap.installments - other.installments;
    const totalDiff = cheap.totalPaidCents - other.totalPaidCents;
    if (termDiff > 0 && totalDiff > 0) {
      sentences.push(
        `A ${cheap.label} reduz a parcela em ${formatCentsBRL(monthly)} por mês, mas mantém a dívida por mais ${termDiff} ${termDiff === 1 ? "mês" : "meses"} e, pelos valores informados, termina custando ${formatCentsBRL(totalDiff)} a mais.`,
      );
    } else if (totalDiff < 0) {
      sentences.push(
        `A ${cheap.label} tem parcela ${formatCentsBRL(monthly)} menor e, pelos valores informados, também custa ${formatCentsBRL(Math.abs(totalDiff))} a menos no total.`,
      );
    }
  }
  return sentences;
}

function ComparisonResultView({
  result,
  onCopy,
  copied,
}: {
  result: ComparisonResult;
  onCopy: () => void;
  copied: boolean;
}) {
  const { proposals, criteria, warnings } = result;

  const rows: Array<{ label: string; values: string[]; bestIndexes?: number[] }> = [
    { label: "Valor recebido", values: proposals.map((p) => formatCentsBRL(p.netAmountCents)) },
    {
      label: "Parcela",
      values: proposals.map((p) => formatCentsBRL(p.installmentCents)),
      bestIndexes: criteria.find((c) => c.key === "lowestInstallment")?.winners,
    },
    { label: "Número de parcelas", values: proposals.map((p) => String(p.installments)) },
    {
      label: "Prazo",
      values: proposals.map((p) => `${p.installments} meses`),
      bestIndexes: criteria.find((c) => c.key === "shortestTerm")?.winners,
    },
    {
      label: "CET informado",
      values: proposals.map((p) =>
        p.cetAnnualPercent !== undefined
          ? `${formatPercentBR(p.cetAnnualPercent)} a.a.`
          : "não informado",
      ),
      bestIndexes: criteria.find((c) => c.key === "lowestCet")?.available
        ? criteria.find((c) => c.key === "lowestCet")?.winners
        : undefined,
    },
    {
      label: "Juros informados",
      values: proposals.map((p) =>
        p.interestRate
          ? `${formatPercentBR(p.interestRate.value)} ${p.interestRate.period === "monthly" ? "a.m." : "a.a."}${
              p.interestRate.period === "monthly" && p.equivalentAnnualPercent !== undefined
                ? ` (≈ ${formatPercentBR(p.equivalentAnnualPercent)} a.a. efetiva)`
                : ""
            }`
          : "—",
      ),
    },
    {
      label: "Custos fora das parcelas",
      values: proposals.map((p) =>
        p.externalCostsCents > 0 ? formatCentsBRL(p.externalCostsCents) : "—",
      ),
    },
    {
      label: "Total pago",
      values: proposals.map((p) => formatCentsBRL(p.totalPaidCents)),
      bestIndexes: criteria.find((c) => c.key === "lowestTotalPaid")?.winners,
    },
    {
      label: "Custo em reais",
      values: proposals.map((p) => formatCentsBRL(p.nominalCostCents)),
    },
  ];

  const maxTotal = Math.max(...proposals.map((p) => p.totalPaidCents));
  const tradeOffs = tradeOffSentence(result);
  const dominant = result.dominantIndex !== null ? proposals[result.dominantIndex] : null;

  return (
    <div className="mt-8 border-t border-brand-border pt-6">
      <h2 tabIndex={-1} className="font-serif text-2xl font-bold text-brand-navy" id="resultado-comparacao">
        Resumo da comparação
      </h2>

      {warnings.upfrontPaymentFlag ? (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-brand-danger/40 bg-brand-danger-soft p-4 text-sm leading-relaxed text-brand-danger"
        >
          <p className="font-bold">Atenção: pagamento antes da liberação merece cuidado.</p>
          <p className="mt-1">
            Pedir depósito, &ldquo;taxa&rdquo; ou &ldquo;seguro&rdquo; antes de soltar o dinheiro é um
            importante sinal de alerta — instituições autorizadas descontam custos do valor liberado ou os
            incluem nas parcelas. Antes de qualquer pagamento, leia{" "}
            <Link href="/credito-seguro/deposito-antecipado-e-golpe/" className="underline">
              por que o depósito antecipado é o golpe mais comum
            </Link>{" "}
            e{" "}
            <Link href="/credito-seguro/como-consultar-se-instituicao-e-autorizada/" className="underline">
              como conferir se a instituição é autorizada pelo Banco Central
            </Link>
            .
          </p>
        </div>
      ) : null}

      {warnings.totalBelowNet.length > 0 ? (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-brand-warning/40 bg-brand-warning-soft p-4 text-sm text-brand-warning"
        >
          <p>
            <strong>Revise os valores da {proposals[warnings.totalBelowNet[0] ?? 0]?.label}:</strong> o total
            pago ficou menor que o valor recebido. Isso é raro (acontece em créditos subsidiados) — se não
            for o seu caso, confira parcela e número de parcelas.
          </p>
        </div>
      ) : null}

      {warnings.differentNetAmounts ? (
        <div className="mt-4 rounded-xl border border-brand-warning/40 bg-brand-warning-soft p-4 text-sm leading-relaxed text-brand-warning">
          <p>
            <strong>Estas propostas não liberam o mesmo valor.</strong> O total pago, sozinho, não diz
            qual é mais barata quando os valores recebidos são diferentes. Para uma comparação mais justa,
            compare propostas que entregam aproximadamente o mesmo valor líquido.
          </p>
        </div>
      ) : null}

      {/* Cards de critérios */}
      <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {criteria.map((c) => {
          if (!c.available) {
            return (
              <div key={c.key} className="rounded-xl bg-brand-surface-soft p-4">
                <dt className="text-xs font-semibold uppercase tracking-wide text-brand-muted">
                  {CRITERION_LABELS[c.key]}
                </dt>
                <dd className="mt-1 text-sm text-brand-muted">
                  Sem dados suficientes (CET não informado)
                </dd>
              </div>
            );
          }
          const winnersText = c.winners.map((i) => proposals[i]?.label).join(" e ");
          const first = proposals[c.winners[0] ?? 0]!;
          const valueText =
            c.key === "lowestInstallment"
              ? `${formatCentsBRL(first.installmentCents)}/mês`
              : c.key === "shortestTerm"
                ? `${first.installments} meses`
                : c.key === "lowestCet"
                  ? `${formatPercentBR(first.cetAnnualPercent!)} a.a.`
                  : formatCentsBRL(first.totalPaidCents);
          return (
            <div key={c.key} className="rounded-xl bg-brand-teal-soft p-4">
              <dt className="text-xs font-semibold uppercase tracking-wide text-brand-teal-dark">
                {CRITERION_LABELS[c.key]}
              </dt>
              <dd className="mt-1">
                <span className="block font-bold text-brand-navy">
                  {winnersText}
                  {c.winners.length > 1 ? " (empate)" : ""}
                </span>
                <span className="text-sm text-brand-muted">{valueText}</span>
              </dd>
            </div>
          );
        })}
      </dl>

      {/* Trade-off — o coração da ferramenta */}
      {tradeOffs.length > 0 ? (
        <div className="mt-6 rounded-2xl border-2 border-brand-navy/15 bg-white p-5">
          <h3 className="font-serif text-lg font-bold text-brand-navy">O trade-off, em uma frase</h3>
          {tradeOffs.map((sentence) => (
            <p key={sentence} className="mt-2 text-base leading-relaxed text-brand-text">
              {sentence}
            </p>
          ))}
        </div>
      ) : null}

      {dominant && !warnings.differentNetAmounts ? (
        <p className="mt-4 rounded-xl bg-brand-surface-soft p-4 text-sm leading-relaxed text-brand-text">
          Com os dados informados, a <strong>{dominant.label}</strong> tem parcela igual ou menor, prazo
          igual ou menor e custo igual ou menor que as demais em todos os critérios que puderam ser
          avaliados. A decisão continua sendo sua — confira as condições completas na proposta.
        </p>
      ) : null}

      {warnings.missingCet && !warnings.allMissingCet ? (
        <p className="mt-4 text-sm leading-relaxed text-brand-muted">
          Uma das propostas está sem CET. Sem ele, a comparação do custo efetivo fica incompleta — procure
          o &ldquo;Custo Efetivo Total&rdquo; na proposta ou peça à instituição antes de contratar.
        </p>
      ) : null}
      {warnings.allMissingCet ? (
        <p className="mt-4 text-sm leading-relaxed text-brand-muted">
          Nenhuma proposta tem CET informado, então comparamos apenas parcela, prazo e total pago. O CET é
          a informação que resume o custo efetivo — as instituições são obrigadas a informá-lo antes da
          contratação.
        </p>
      ) : null}

      {/* Gráfico simples e acessível: total pago */}
      <div className="mt-6">
        <h3 className="font-serif text-lg font-bold text-brand-navy">Total pago, lado a lado</h3>
        <div className="mt-3 space-y-2">
          {proposals.map((p) => (
            <div key={p.label} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-sm font-medium text-brand-navy">{p.label}</span>
              <div className="h-6 flex-1 rounded bg-brand-surface-soft">
                <div
                  className="flex h-6 items-center rounded bg-brand-navy/80 px-2"
                  style={{ width: `${Math.max(8, (p.totalPaidCents / maxTotal) * 100)}%` }}
                >
                  <span className="whitespace-nowrap text-xs font-semibold text-white">
                    {formatCentsBRL(p.totalPaidCents)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Matriz completa */}
      <div className="mt-6 overflow-x-auto rounded-xl border border-brand-border">
        <table className="w-full min-w-[30rem] border-collapse text-sm">
          <caption className="sr-only">Comparação completa das propostas, critério a critério</caption>
          <thead className="bg-brand-surface-soft text-left">
            <tr>
              <th scope="col" className="px-3 py-2 font-bold text-brand-navy">
                Critério
              </th>
              {proposals.map((p) => (
                <th key={p.label} scope="col" className="px-3 py-2 font-bold text-brand-navy">
                  {p.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t border-brand-border">
                <th scope="row" className="px-3 py-2 text-left font-medium text-brand-navy">
                  {row.label}
                </th>
                {row.values.map((value, i) => {
                  const isBest = row.bestIndexes?.includes(i) ?? false;
                  return (
                    <td key={proposals[i]?.label ?? i} className="px-3 py-2 tabular-nums">
                      {value}
                      {isBest ? (
                        <span className="ml-1.5 rounded bg-brand-teal-soft px-1.5 py-0.5 text-xs font-semibold text-brand-teal-dark">
                          ↓ menor
                        </span>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-brand-muted">
        &ldquo;↓ menor&rdquo; marca o menor valor de cada critério. Menor nem sempre significa melhor
        para o seu caso: cada dimensão tem um trade-off.
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onCopy}
          className="rounded-lg border border-brand-border px-4 py-2 text-sm font-medium text-brand-navy hover:bg-brand-surface-soft"
        >
          {copied ? "Resumo copiado ✓" : "Copiar resumo"}
        </button>
      </div>
      <p className="mt-2 text-xs text-brand-muted">
        O resumo é um texto simples com os números — bom para mandar para alguém de confiança ou levar à
        conversa com a instituição.
      </p>
    </div>
  );
}

/* ---------- Componente principal ---------- */

export function ProposalComparator() {
  const [proposals, setProposals] = useState<ProposalFormState[]>([
    { ...EMPTY_PROPOSAL },
    { ...EMPTY_PROPOSAL },
  ]);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [exampleLoaded, setExampleLoaded] = useState(false);
  const startedRef = useRef(false);
  const scamTrackedRef = useRef(false);
  const { ref: resultRef, reveal } = useRevealResult();

  function updateProposal(index: number, patch: Partial<ProposalFormState>) {
    if (!startedRef.current) {
      startedRef.current = true;
      trackCompareStart();
    }
    setProposals((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function loadExample() {
    setProposals([{ ...EXAMPLE[0] }, { ...EXAMPLE[1] }]);
    setExampleLoaded(true);
    setResult(null);
    setErrors([]);
  }

  function clearAll() {
    setProposals([{ ...EMPTY_PROPOSAL }, { ...EMPTY_PROPOSAL }]);
    setResult(null);
    setErrors([]);
    setExampleLoaded(false);
    setCopied(false);
  }

  function addThird() {
    setProposals((prev) => [...prev, { ...EMPTY_PROPOSAL }]);
    trackCompareAddThird();
  }

  function removeThird() {
    setProposals((prev) => prev.slice(0, 2));
    setResult(null);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setCopied(false);
    const parsed = proposals.map(toInput);
    const parseErrors = parsed.filter((p): p is string[] => Array.isArray(p)).flat();
    if (parseErrors.length > 0) {
      setErrors(parseErrors);
      setResult(null);
      return;
    }
    try {
      const comparison = compareProposals(parsed as ProposalInput[]);
      setErrors([]);
      setResult(comparison);
      const cetCount = comparison.proposals.filter((p) => p.cetAnnualPercent !== undefined).length;
      trackCompareComplete({
        proposals: comparison.proposals.length as 2 | 3,
        cetInformed:
          cetCount === comparison.proposals.length ? "all" : cetCount === 0 ? "none" : "some",
        advancedUsed: proposals.some((p) => p.showAdvanced),
        exampleUsed: exampleLoaded,
      });
      if (comparison.warnings.upfrontPaymentFlag && !scamTrackedRef.current) {
        scamTrackedRef.current = true;
        trackCompareScamWarningView();
      }
      reveal();
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Não foi possível comparar. Revise os valores."]);
      setResult(null);
    }
  }

  async function copySummary() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(buildSummaryText(result));
      setCopied(true);
      trackCompareCopySummary();
      setTimeout(() => setCopied(false), 4000);
    } catch {
      // Clipboard bloqueado: mantém o texto disponível na tela.
      setCopied(false);
    }
  }

  return (
    <section
      aria-label="Comparador de propostas de crédito"
      className="rounded-2xl border border-brand-border bg-brand-surface-soft/50 p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm leading-relaxed text-brand-muted">
          Não precisamos saber qual banco fez a proposta — compare apenas os números. Nada do que você
          digita aqui é enviado ou salvo.
        </p>
        <button
          type="button"
          onClick={exampleLoaded ? clearAll : loadExample}
          className="rounded-lg border border-brand-border bg-white px-4 py-2 text-sm font-medium text-brand-navy hover:bg-brand-surface-soft"
        >
          {exampleLoaded ? "Limpar exemplo e comparar as minhas" : "Ver exemplo preenchido"}
        </button>
      </div>

      <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-5">
        {proposals.map((state, index) => (
          <ProposalFieldset
            key={index}
            index={index}
            state={state}
            update={(patch) => updateProposal(index, patch)}
          />
        ))}

        <div className="flex flex-wrap gap-3">
          {proposals.length < 3 ? (
            <button
              type="button"
              onClick={addThird}
              className="rounded-lg border border-dashed border-brand-border bg-white px-4 py-2 text-sm font-medium text-brand-navy hover:bg-brand-surface-soft"
            >
              + Adicionar terceira proposta
            </button>
          ) : (
            <button
              type="button"
              onClick={removeThird}
              className="rounded-lg border border-brand-border bg-white px-4 py-2 text-sm font-medium text-brand-muted hover:bg-brand-surface-soft"
            >
              Remover terceira proposta
            </button>
          )}
        </div>

        {errors.length > 0 ? (
          <div
            role="alert"
            className="rounded-lg border border-brand-danger/40 bg-brand-danger-soft p-4 text-sm text-brand-danger"
          >
            <ul className="list-disc space-y-1 pl-4">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className="w-full rounded-lg bg-brand-teal-dark px-6 py-3 font-semibold text-white hover:bg-brand-teal sm:w-auto"
          >
            Comparar propostas
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="rounded-lg px-4 py-2 text-sm font-medium text-brand-muted underline hover:text-brand-navy"
          >
            Limpar comparação
          </button>
        </div>
      </form>

      <div ref={resultRef} aria-live="polite" className="scroll-mt-24">
        {result ? (
          <ComparisonResultView result={result} onCopy={copySummary} copied={copied} />
        ) : null}
      </div>

      <p className="mt-6 rounded-lg border border-brand-warning/30 bg-brand-warning-soft p-4 text-sm leading-relaxed text-brand-warning">
        Ferramenta educativa. Os cálculos dependem dos valores informados e não constituem recomendação de
        contratação. Confirme os dados e condições diretamente na proposta ou no contrato da instituição.
        A ferramenta compara números — a decisão continua sendo sua.
      </p>
    </section>
  );
}
