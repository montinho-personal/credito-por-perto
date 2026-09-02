"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRevealResult } from "./use-reveal-result";
import { track } from "@/lib/analytics/track";
import {
  computeEarlyPayoff,
  type EarlyPayoffResult,
  type InstallmentsEqual,
} from "@/lib/calculators/early-payoff";
import {
  formatCentsBRL,
  parseBRLToCents,
  parsePercentBR,
} from "@/lib/calculators/proposal-comparison";
import {
  comparePayoffOptions,
  isQuoteOutdated,
  simulatePartialAmortization,
  type AmortizationSystem,
  type OfficialComparison,
  type PartialAmortizationResult,
  type RateUnit,
} from "@/lib/calculators/partial-amortization";

/* Eventos de uso — NUNCA saldo, parcela, quantidade ou taxa. */

type Modality =
  | ""
  | "pessoal"
  | "consignado"
  | "veiculo"
  | "imobiliario"
  | "consorcio"
  | "rotativo-cheque"
  | "outra";

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

function Bar({ label, cents, maxCents, highlight }: { label: string; cents: number; maxCents: number; highlight?: boolean }) {
  const width = maxCents > 0 ? Math.max(3, Math.min(100, (cents / maxCents) * 100)) : 3;
  return (
    <div className="text-sm">
      <div className="flex justify-between">
        <span className="text-brand-text">{label}</span>
        <span className="font-semibold text-brand-navy">{formatCentsBRL(cents)}</span>
      </div>
      <div className="mt-1 h-3 overflow-hidden rounded-full bg-brand-surface-soft">
        <div
          className={`h-full rounded-full ${highlight ? "bg-brand-teal" : "bg-brand-navy"}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

const HOW_TO_GET_BALANCE = (
  <div className="rounded-xl border border-brand-border bg-white p-4 text-sm leading-relaxed text-brand-text">
    <p className="font-bold text-brand-navy">Onde encontro o saldo para quitação?</p>
    <ul className="mt-2 list-disc space-y-1 pl-5">
      <li>No aplicativo ou internet banking da instituição, procure &ldquo;antecipar parcelas&rdquo; ou &ldquo;quitar contrato&rdquo;;</li>
      <li>Ou peça pelo atendimento oficial o <strong>saldo devedor atualizado para quitação antecipada</strong>, com o demonstrativo por escrito e a data de validade do valor;</li>
      <li>
        A instituição é obrigada a fornecer as informações da sua dívida, e a liquidação
        antecipada com redução proporcional de juros é direito do consumidor —{" "}
        <Link href="/juros-e-cet/quitacao-antecipada-de-emprestimo/" className="font-semibold underline">
          veja o roteiro completo do pedido
        </Link>
        ;
      </li>
      <li>Confira se o valor veio <strong>menor</strong> que a soma das parcelas restantes — se vier igual, o desconto proporcional pode não ter sido aplicado: conteste.</li>
    </ul>
  </div>
);

export function EarlyPayoffCalculator() {
  const [hasBalance, setHasBalance] = useState<"" | "yes" | "no">("");
  const [modality, setModality] = useState<Modality>("");
  const [goal, setGoal] = useState<"full" | "partial">("full");
  const [payoff, setPayoff] = useState("");
  const [remaining, setRemaining] = useState("");
  const [installment, setInstallment] = useState("");
  const [equal, setEqual] = useState<InstallmentsEqual>("yes");
  const [informedTotal, setInformedTotal] = useState("");
  const [rate, setRate] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [result, setResult] = useState<EarlyPayoffResult | null>(null);
  /* Modo 1 — validade do saldo informado pela instituição */
  const [validUntil, setValidUntil] = useState("");
  /* Modo 2 — amortização parcial */
  const [subMode, setSubMode] = useState<"oficial" | "simular">("oficial");
  const [optTermMonths, setOptTermMonths] = useState("");
  const [optTermPayment, setOptTermPayment] = useState("");
  const [optPayMonths, setOptPayMonths] = useState("");
  const [optPayPayment, setOptPayPayment] = useState("");
  const [comparison, setComparison] = useState<OfficialComparison | null>(null);
  const [pBalance, setPBalance] = useState("");
  const [pMonths, setPMonths] = useState("");
  const [pRate, setPRate] = useState("");
  const [pRateUnit, setPRateUnit] = useState<RateUnit>("mensal");
  const [pSystem, setPSystem] = useState<AmortizationSystem>("nao-sei");
  const [pExtra, setPExtra] = useState("");
  const [partial, setPartial] = useState<PartialAmortizationResult | null>(null);
  const startedRef = useRef(false);

  const ineligible = modality === "consorcio" || modality === "rotativo-cheque";

  const { ref: resultRef, reveal } = useRevealResult();

  function started() {
    if (!startedRef.current) {
      startedRef.current = true;
      track("early_payoff_start");
    }
  }

  function calculate() {
    const problems: string[] = [];
    const payoffCents = toCents(payoff);
    const remainingCount = remaining.trim() === "" ? null : Number(remaining.trim());
    const installmentCents = toCents(installment);
    const informedTotalCents = toCents(informedTotal);

    if (payoffCents === null || payoffCents <= 0)
      problems.push("Informe o saldo para quitação (ex.: 12.100,00).");
    if (equal !== "no") {
      if (
        remainingCount === null ||
        !Number.isInteger(remainingCount) ||
        remainingCount <= 0 ||
        remainingCount > 1200
      )
        problems.push("Informe quantas parcelas ainda faltam (número inteiro).");
      if (installmentCents === null || installmentCents <= 0)
        problems.push("Informe o valor da parcela (ex.: 850,00).");
    }

    setErrors(problems);
    reveal();
    if (problems.length > 0) {
      setResult(null);
      return;
    }

    const r = computeEarlyPayoff({
      payoffBalanceCents: payoffCents!,
      remainingInstallments: remainingCount,
      installmentCents,
      installmentsEqual: equal,
      informedFutureTotalCents: informedTotalCents,
    });
    setResult(r);
    reveal();
    track("early_payoff_complete");
  }

  function compareOfficial() {
    const n = (v: string) => (v.trim() === "" ? 0 : Number(v.trim()));
    const c = comparePayoffOptions(
      { months: n(optTermMonths), paymentCents: toCents(optTermPayment) ?? 0 },
      { months: n(optPayMonths), paymentCents: toCents(optPayPayment) ?? 0 },
    );
    setComparison(c);
    reveal();
    track("early_payoff_scenario_compare");
  }

  function runPartial() {
    const r = simulatePartialAmortization({
      balanceCents: toCents(pBalance) ?? 0,
      remainingMonths: pMonths.trim() === "" ? 0 : Number(pMonths.trim()),
      rateValue: pRate.trim() === "" ? null : parsePercentBR(pRate),
      rateUnit: pRateUnit,
      system: pSystem,
      extraPaymentCents: toCents(pExtra) ?? 0,
    });
    setPartial(r);
    reveal();
    track("early_payoff_partial_mode");
  }

  function clearAll() {
    setHasBalance("");
    setModality("");
    setGoal("full");
    setPayoff("");
    setRemaining("");
    setInstallment("");
    setEqual("yes");
    setInformedTotal("");
    setRate("");
    setErrors([]);
    setResult(null);
    setValidUntil("");
    setOptTermMonths(""); setOptTermPayment(""); setOptPayMonths(""); setOptPayPayment("");
    setComparison(null);
    setPBalance(""); setPMonths(""); setPRate(""); setPExtra("");
    setPSystem("nao-sei");
    setPartial(null);
  }

  return (
    <section
      aria-label="Calculadora de quitação antecipada"
      className="rounded-2xl border border-brand-border bg-brand-surface-soft/50 p-4 sm:p-6"
    >
      <p className="text-sm leading-relaxed text-brand-muted">
        Grátis, sem cadastro, sem CPF e sem nome de banco. Seus valores não precisam sair do seu
        dispositivo para fazer esta comparação — nada é enviado ou salvo.
      </p>

      <div className="mt-5 space-y-5">
        <div>
          <label htmlFor="modalidade-quitacao" className="block text-sm font-semibold text-brand-navy">
            Que tipo de dívida você quer quitar?{" "}
            <span className="font-normal text-brand-muted">(opcional)</span>
          </label>
          <select
            id="modalidade-quitacao"
            value={modality}
            onChange={(e) => {
              started();
              setModality(e.target.value as Modality);
            }}
            className="mt-1 w-full rounded-xl border border-brand-border bg-white px-4 py-3 text-base"
          >
            <option value="">Prefiro não dizer / não sei</option>
            <option value="pessoal">Empréstimo pessoal</option>
            <option value="consignado">Consignado</option>
            <option value="veiculo">Financiamento de veículo</option>
            <option value="imobiliario">Financiamento imobiliário</option>
            <option value="consorcio">Consórcio</option>
            <option value="rotativo-cheque">Cartão rotativo / cheque especial</option>
            <option value="outra">Outra</option>
          </select>
        </div>

        {ineligible ? (
          <div className="rounded-xl border border-brand-border bg-white p-4 text-sm leading-relaxed text-brand-text">
            {modality === "consorcio" ? (
              <>
                <p className="font-bold text-brand-navy">Esta calculadora não se aplica a consórcio.</p>
                <p className="mt-1">
                  Consórcio não é empréstimo: as regras de saída, contemplação e devolução de
                  valores são próprias. Entenda as diferenças em{" "}
                  <Link href="/emprestimos/consorcio-ou-emprestimo/" className="font-semibold underline">
                    consórcio ou empréstimo
                  </Link>
                  .
                </p>
              </>
            ) : (
              <>
                <p className="font-bold text-brand-navy">
                  Rotativo e cheque especial não funcionam por parcelas fixas.
                </p>
                <p className="mt-1">
                  Nessas dívidas, o custo cresce com o uso — quitar é pagar o saldo do dia, e o
                  caminho costuma ser tirá-las do juro mais alto. Veja{" "}
                  <Link href="/organizacao-financeira/como-sair-do-rotativo/" className="font-semibold underline">
                    como sair do rotativo
                  </Link>{" "}
                  e, com uma proposta na mão,{" "}
                  <Link href="/calculadoras/trocar-divida/" className="font-semibold underline">
                    compare a troca da dívida
                  </Link>
                  .
                </p>
              </>
            )}
          </div>
        ) : (
          <>
            <fieldset>
              <legend className="text-sm font-semibold text-brand-navy">Você quer:</legend>
              <div className="mt-1 flex flex-wrap gap-2">
                {(
                  [
                    ["full", "Quero quitar tudo agora"],
                    ["partial", "Quero amortizar uma parte"],
                  ] as const
                ).map(([value, label]) => (
                  <label
                    key={value}
                    className={`cursor-pointer rounded-lg border px-3 py-2 text-sm ${
                      goal === value
                        ? "border-brand-teal bg-white font-semibold text-brand-navy"
                        : "border-brand-border bg-white text-brand-text"
                    }`}
                  >
                    <input
                      type="radio"
                      name="goal"
                      className="sr-only"
                      checked={goal === value}
                      onChange={() => {
                        started();
                        setGoal(value);
                      }}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            {goal === "partial" ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-brand-border bg-white p-4 text-sm leading-relaxed text-brand-text">
                  <p className="font-bold text-brand-navy">
                    Amortizar uma parte: dois caminhos, com confiabilidades diferentes.
                  </p>
                  <p className="mt-1">
                    O efeito de uma amortização extraordinária depende do contrato e da
                    instituição. O caminho mais confiável é comparar as duas simulações que{" "}
                    <strong>ela</strong> calculou. A simulação com os seus dados é educacional e só
                    roda quando você sabe o sistema de amortização.
                  </p>
                </div>

                <fieldset>
                  <legend className="text-sm font-semibold text-brand-navy">Como quer seguir?</legend>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {(
                      [
                        ["oficial", "Comparar simulações da instituição"],
                        ["simular", "Simular com meus dados"],
                      ] as const
                    ).map(([value, label]) => (
                      <label
                        key={value}
                        className={`cursor-pointer rounded-lg border px-3 py-2 text-sm ${
                          subMode === value
                            ? "border-brand-teal bg-white font-semibold text-brand-navy"
                            : "border-brand-border bg-white text-brand-text"
                        }`}
                      >
                        <input
                          type="radio"
                          name="submode"
                          className="sr-only"
                          checked={subMode === value}
                          onChange={() => setSubMode(value)}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </fieldset>

                {subMode === "oficial" ? (
                  <div className="space-y-4">
                    <p className="text-sm leading-relaxed text-brand-text">
                      Peça à instituição as duas simulações usando o mesmo valor de amortização e
                      preencha abaixo. Assim os números comparados são os do seu contrato.
                    </p>
                    <div className="rounded-xl border border-brand-border bg-white p-4">
                      <p className="font-semibold text-brand-navy">Opção A — reduzir o prazo</p>
                      <div className="mt-2 grid gap-3 sm:grid-cols-2">
                        <Field id="opt-term-months" label="Novo prazo (pagamentos)" value={optTermMonths}
                          onChange={setOptTermMonths} numeric placeholder="18" />
                        <Field id="opt-term-payment" label="Valor da parcela (R$)" value={optTermPayment}
                          onChange={setOptTermPayment} placeholder="850,00" />
                      </div>
                    </div>
                    <div className="rounded-xl border border-brand-border bg-white p-4">
                      <p className="font-semibold text-brand-navy">Opção B — reduzir a parcela</p>
                      <div className="mt-2 grid gap-3 sm:grid-cols-2">
                        <Field id="opt-pay-months" label="Prazo (pagamentos)" value={optPayMonths}
                          onChange={setOptPayMonths} numeric placeholder="24" />
                        <Field id="opt-pay-payment" label="Nova parcela (R$)" value={optPayPayment}
                          onChange={setOptPayPayment} placeholder="680,00" />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button type="button" onClick={compareOfficial}
                        className="rounded-xl bg-brand-navy px-6 py-3.5 font-semibold text-white hover:bg-brand-navy/90">
                        Comparar as duas opções
                      </button>
                      <button type="button" onClick={clearAll}
                        className="rounded-xl border border-brand-border bg-white px-5 py-3.5 font-medium text-brand-navy hover:bg-brand-surface-soft">
                        Limpar simulação
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field id="p-balance" label="Saldo devedor atual (R$)"
                        hint="Quanto ainda está em aberto, segundo a instituição."
                        value={pBalance} onChange={setPBalance} placeholder="20.000,00" />
                      <Field id="p-months" label="Parcelas que ainda faltam" value={pMonths}
                        onChange={setPMonths} numeric placeholder="24" />
                      <Field id="p-rate" label="Taxa de juros do contrato" value={pRate}
                        onChange={setPRate} placeholder="1,50" />
                      <div>
                        <label htmlFor="p-rate-unit" className="block text-sm font-semibold text-brand-navy">
                          Unidade da taxa
                        </label>
                        <select id="p-rate-unit" value={pRateUnit}
                          onChange={(e) => setPRateUnit(e.target.value as RateUnit)}
                          className="mt-1 w-full rounded-xl border border-brand-border bg-white px-4 py-3 text-base">
                          <option value="mensal">% ao mês</option>
                          <option value="anual">% ao ano</option>
                          <option value="sem-juros">Sem juros (0%)</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="p-system" className="block text-sm font-semibold text-brand-navy">
                          Sistema de amortização
                        </label>
                        <p className="mt-0.5 text-xs text-brand-muted">
                          Está no contrato. Se não souber, não tem problema — a ferramenta avisa o
                          que dá para fazer.
                        </p>
                        <select id="p-system" value={pSystem}
                          onChange={(e) => setPSystem(e.target.value as AmortizationSystem)}
                          className="mt-1 w-full rounded-xl border border-brand-border bg-white px-4 py-3 text-base">
                          <option value="nao-sei">Não sei</option>
                          <option value="price">Price (parcela fixa)</option>
                          <option value="sac">SAC (parcela decrescente)</option>
                          <option value="outro">Outro</option>
                        </select>
                      </div>
                      <Field id="p-extra" label="Quanto pretende antecipar? (R$)" value={pExtra}
                        onChange={setPExtra} placeholder="5.000,00" />
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button type="button" onClick={runPartial}
                        className="rounded-xl bg-brand-navy px-6 py-3.5 font-semibold text-white hover:bg-brand-navy/90">
                        Simular amortização
                      </button>
                      <button type="button" onClick={clearAll}
                        className="rounded-xl border border-brand-border bg-white px-5 py-3.5 font-medium text-brand-navy hover:bg-brand-surface-soft">
                        Limpar simulação
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <fieldset>
                  <legend className="text-sm font-semibold text-brand-navy">
                    Você já sabe quanto a instituição cobra para quitar sua dívida hoje?
                  </legend>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {(
                      [
                        ["yes", "Sim, tenho o saldo para quitação"],
                        ["no", "Não, ainda não tenho"],
                      ] as const
                    ).map(([value, label]) => (
                      <label
                        key={value}
                        className={`cursor-pointer rounded-lg border px-3 py-2 text-sm ${
                          hasBalance === value
                            ? "border-brand-teal bg-white font-semibold text-brand-navy"
                            : "border-brand-border bg-white text-brand-text"
                        }`}
                      >
                        <input
                          type="radio"
                          name="has-balance"
                          className="sr-only"
                          checked={hasBalance === value}
                          onChange={() => {
                            started();
                            setHasBalance(value);
                            if (value === "no") track("early_payoff_no_balance");
                          }}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </fieldset>

                {hasBalance === "no" ? (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-brand-warning/40 bg-brand-warning-soft p-4 text-sm leading-relaxed text-brand-text">
                      <p className="font-bold text-brand-navy">Primeiro descubra o saldo de quitação.</p>
                      <p className="mt-1">
                        Multiplicar a parcela pelas parcelas restantes mostra o que ainda{" "}
                        <em>sairia do seu bolso</em> — mas <strong>não</strong> é o valor de
                        quitar hoje: a liquidação antecipada reduz proporcionalmente os juros e
                        demais acréscimos futuros. Sem o saldo oficial, qualquer número seria
                        falsa precisão — por isso esta calculadora não o inventa.
                      </p>
                    </div>
                    {HOW_TO_GET_BALANCE}
                    <p className="text-sm text-brand-text">
                      Com o saldo em mãos, volte aqui e marque{" "}
                      <strong>&ldquo;Sim, tenho o saldo&rdquo;</strong> para ver a comparação.
                    </p>
                  </div>
                ) : null}

                {hasBalance === "yes" ? (
                  <div className="space-y-4">
                    <Field
                      id="payoff"
                      label="Quanto custa quitar hoje? (R$)"
                      hint="O saldo para quitação antecipada informado pela instituição."
                      value={payoff}
                      onChange={(v) => setPayoff(v)}
                      placeholder="12.100,00"
                    />
                    <Field
                      id="valid-until"
                      label="Esse valor vale até que data? (opcional)"
                      hint="Use o formato AAAA-MM-DD. O saldo de quitação costuma valer só para uma data."
                      value={validUntil}
                      onChange={setValidUntil}
                      placeholder="2026-09-05"
                    />
                    <fieldset>
                      <legend className="text-sm font-semibold text-brand-navy">
                        As parcelas restantes têm o mesmo valor?
                      </legend>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {(
                          [
                            ["yes", "Sim"],
                            ["no", "Não"],
                            ["unknown", "Não sei"],
                          ] as const
                        ).map(([value, label]) => (
                          <label
                            key={value}
                            className={`cursor-pointer rounded-lg border px-3 py-2 text-sm ${
                              equal === value
                                ? "border-brand-teal bg-white font-semibold text-brand-navy"
                                : "border-brand-border bg-white text-brand-text"
                            }`}
                          >
                            <input
                              type="radio"
                              name="equal"
                              className="sr-only"
                              checked={equal === value}
                              onChange={() => setEqual(value)}
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    </fieldset>

                    {equal === "no" ? (
                      <Field
                        id="informed-total"
                        label="Qual é a soma das parcelas que ainda faltam? (R$)"
                        hint="Como as parcelas variam, use a soma informada pela instituição (extrato/demonstrativo). Sem ela, mostramos um resultado parcial."
                        value={informedTotal}
                        onChange={(v) => setInformedTotal(v)}
                      />
                    ) : (
                      <>
                        <Field
                          id="remaining-payoff"
                          label="Quantas parcelas ainda faltam?"
                          value={remaining}
                          onChange={(v) => setRemaining(v)}
                          numeric
                          placeholder="18"
                        />
                        <Field
                          id="installment-payoff"
                          label="Qual o valor de cada parcela? (R$)"
                          value={installment}
                          onChange={(v) => setInstallment(v)}
                          placeholder="850,00"
                        />
                      </>
                    )}

                    <details className="text-sm">
                      <summary className="cursor-pointer font-medium text-brand-teal-dark">
                        Adicionar taxa de juros (opcional)
                      </summary>
                      <div className="mt-3">
                        <Field
                          id="rate-payoff"
                          label="Taxa de juros do contrato (% ao mês)"
                          hint="Não entra no cálculo da diferença — serve só para o passo seguinte: comparar sua taxa com a média do BC."
                          value={rate}
                          onChange={(v) => setRate(v)}
                          placeholder="2,5"
                        />
                      </div>
                    </details>

                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={calculate}
                        className="rounded-xl bg-brand-navy px-6 py-3.5 font-semibold text-white transition-colors hover:bg-brand-navy/90"
                      >
                        Calcular diferença
                      </button>
                      <button
                        type="button"
                        onClick={clearAll}
                        className="rounded-xl border border-brand-border bg-white px-5 py-3.5 font-medium text-brand-navy hover:bg-brand-surface-soft"
                      >
                        Limpar cálculo
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </>
        )}
      </div>

      <div ref={resultRef} aria-live="polite" className="mt-6 scroll-mt-24">
        {errors.length > 0 ? (
          <ul className="list-disc rounded-xl border border-brand-warning/40 bg-brand-warning-soft p-4 pl-8 text-sm text-brand-text">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : null}

        {comparison && comparison.status === "compared" ? (
          <div className="rounded-xl border border-brand-border bg-white p-4">
            <h2 className="font-serif text-xl font-bold text-brand-navy">
              As duas opções da instituição, lado a lado
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-brand-border p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Reduzir o prazo</p>
                <p className="mt-1 font-serif text-xl font-bold text-brand-navy">
                  {formatCentsBRL(comparison.reduceTerm!.totalCents)}
                </p>
                <p className="mt-0.5 text-xs text-brand-muted">
                  {comparison.reduceTerm!.months} pagamentos de {formatCentsBRL(comparison.reduceTerm!.paymentCents)}
                </p>
              </div>
              <div className="rounded-xl border border-brand-border p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Reduzir a parcela</p>
                <p className="mt-1 font-serif text-xl font-bold text-brand-navy">
                  {formatCentsBRL(comparison.reducePayment!.totalCents)}
                </p>
                <p className="mt-0.5 text-xs text-brand-muted">
                  {comparison.reducePayment!.months} pagamentos de {formatCentsBRL(comparison.reducePayment!.paymentCents)}
                </p>
              </div>
            </div>
            <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-brand-text">
              {comparison.sentences.map((s) => (<li key={s}>• {s}</li>))}
            </ul>
            <p className="mt-3 text-xs leading-relaxed text-brand-muted">
              Totais calculados como parcela × prazo, com os números que a instituição informou.
              Esta ferramenta não escolhe por você.
            </p>
          </div>
        ) : null}

        {comparison && comparison.status === "incomplete" ? (
          <div className="rounded-xl border border-brand-warning/40 bg-brand-warning-soft p-4 text-sm leading-relaxed text-brand-text">
            {comparison.sentences.map((s) => (<p key={s}>{s}</p>))}
          </div>
        ) : null}

        {partial && partial.status === "simulated" ? (
          <div className="rounded-xl border border-brand-border bg-white p-4">
            <h2 className="font-serif text-xl font-bold text-brand-navy">
              Simulação estimada da amortização
            </h2>
            <p className="mt-1 text-sm text-brand-text">
              Saldo depois do aporte: <strong>{formatCentsBRL(partial.balanceAfterCents!)}</strong>.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-brand-border p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Reduzindo o prazo</p>
                <p className="mt-1 font-serif text-lg font-bold text-brand-navy">
                  {partial.reduceTerm!.months} pagamentos
                </p>
                <p className="mt-0.5 text-xs text-brand-muted">
                  primeira parcela {formatCentsBRL(partial.reduceTerm!.firstPaymentCents)} · juros estimados{" "}
                  {formatCentsBRL(partial.reduceTerm!.totalInterestCents)}
                </p>
              </div>
              <div className="rounded-xl border border-brand-border p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Reduzindo a parcela</p>
                <p className="mt-1 font-serif text-lg font-bold text-brand-navy">
                  {partial.reducePayment!.months} pagamentos
                </p>
                <p className="mt-0.5 text-xs text-brand-muted">
                  primeira parcela {formatCentsBRL(partial.reducePayment!.firstPaymentCents)} · juros estimados{" "}
                  {formatCentsBRL(partial.reducePayment!.totalInterestCents)}
                </p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-brand-text">
              Menos tempo pagando ou menos compromisso por mês são objetivos diferentes. A
              ferramenta mostra os dois cenários; a escolha é sua — e o número oficial é o da
              instituição.
            </p>
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer font-medium text-brand-teal-dark">
                Hipóteses desta simulação
              </summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-brand-text">
                {partial.assumptions.map((a) => (<li key={a}>{a}</li>))}
              </ul>
            </details>
          </div>
        ) : null}

        {partial && partial.status === "blocked" ? (
          <div className="rounded-xl border border-brand-warning/40 bg-brand-warning-soft p-4 text-sm leading-relaxed text-brand-text">
            <p className="font-bold text-brand-navy">Não vamos estimar isso com os dados atuais.</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {partial.warnings.includes("system-unknown") ? (
                <li>
                  Sem saber se o contrato é Price ou SAC, qualquer projeção seria chute. Peça à
                  instituição as duas simulações — reduzir prazo e reduzir parcela — usando o
                  mesmo valor de amortização, e volte na opção “Comparar simulações da instituição”.
                </li>
              ) : null}
              {partial.warnings.includes("extra-exceeds-balance") ? (
                <li>O valor que você quer antecipar é maior que o saldo informado. Confira os números.</li>
              ) : null}
              {partial.warnings.includes("extra-equals-balance") ? (
                <li>
                  O valor iguala o saldo: isso é quitação total, não amortização parcial. Use o modo
                  “Quitar tudo agora” com o valor oficial de quitação.
                </li>
              ) : null}
              {partial.warnings.includes("missing-rate") ? (<li>Informe a taxa de juros do contrato.</li>) : null}
              {partial.warnings.includes("missing-balance") ? (<li>Informe o saldo devedor atual.</li>) : null}
              {partial.warnings.includes("missing-term") ? (<li>Informe quantas parcelas ainda faltam.</li>) : null}
              {partial.warnings.includes("payment-below-interest") ? (
                <li>Com esses números, a parcela não cobriria os juros — confira taxa e prazo.</li>
              ) : null}
            </ul>
          </div>
        ) : null}

        {result ? (
          <div>
            <h2 className="font-serif text-2xl font-bold text-brand-navy">O que muda ao quitar hoje?</h2>
            {validUntil.trim() !== "" && isQuoteOutdated(validUntil.trim(), new Date().toISOString().slice(0, 10)) ? (
              <p className="mt-2 rounded-lg border border-brand-warning/40 bg-brand-warning-soft p-3 text-sm text-brand-text">
                O valor informado tinha validade até {validUntil.trim()} e pode estar desatualizado.
                Peça o saldo de quitação novamente antes de pagar.
              </p>
            ) : null}

            {result.futureTotalCents !== null && result.differenceCents !== null ? (
              <>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-brand-border bg-white p-4 text-center">
                    <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">
                      Se continuar pagando
                    </p>
                    <p className="mt-1 font-serif text-xl font-bold text-brand-navy">
                      {formatCentsBRL(result.futureTotalCents)}
                    </p>
                    <p className="mt-0.5 text-xs text-brand-muted">
                      {result.futureTotalSource === "fixed-installments"
                        ? "soma das parcelas restantes informadas"
                        : "soma informada por você"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-brand-border bg-white p-4 text-center">
                    <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">
                      Se quitar hoje
                    </p>
                    <p className="mt-1 font-serif text-xl font-bold text-brand-navy">
                      {formatCentsBRL(result.payoffBalanceCents)}
                    </p>
                    <p className="mt-0.5 text-xs text-brand-muted">saldo informado pela instituição</p>
                  </div>
                  <div className="rounded-xl border border-brand-border bg-white p-4 text-center">
                    <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">
                      Diferença ao quitar agora
                    </p>
                    <p
                      className={`mt-1 font-serif text-xl font-bold ${
                        result.differenceCents >= 0 ? "text-brand-teal-dark" : "text-brand-warning"
                      }`}
                    >
                      {result.differenceCents < 0 ? "−" : ""}
                      {formatCentsBRL(Math.abs(result.differenceCents))}
                    </p>
                    {result.differencePercent !== null && result.differenceCents > 0 ? (
                      <p className="mt-0.5 text-xs text-brand-muted">
                        redução de {result.differencePercent.toFixed(1).replace(".", ",")}% sobre a
                        soma informada
                      </p>
                    ) : null}
                  </div>
                </div>

                {result.differenceCents > 0 ? (
                  <div className="mt-4 space-y-3 rounded-xl border border-brand-border bg-white p-4">
                    <Bar
                      label="Continuar pagando as parcelas"
                      cents={result.futureTotalCents}
                      maxCents={result.futureTotalCents}
                    />
                    <Bar
                      label="Quitar agora"
                      cents={result.payoffBalanceCents}
                      maxCents={result.futureTotalCents}
                      highlight
                    />
                  </div>
                ) : null}
              </>
            ) : null}

            <ul className="mt-4 space-y-1.5 rounded-xl border border-brand-border bg-white p-4 text-sm leading-relaxed text-brand-text">
              {result.sentences.map((s) => (
                <li key={s}>• {s}</li>
              ))}
            </ul>

            {result.warnings.includes("very-large-difference") ? (
              <p className="mt-3 rounded-xl border border-brand-warning/40 bg-brand-warning-soft p-4 text-sm leading-relaxed text-brand-text">
                A diferença ficou muito grande em relação à soma das parcelas — vale conferir se
                os valores foram digitados corretamente (um zero a mais ou a menos muda tudo).
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              <Link
                href="/calculadoras/plano-para-sair-das-dividas/"
                onClick={() => track("early_payoff_debt_plan_click")}
                className="text-brand-teal-dark underline"
              >
                Tem outras dívidas? Veja a ordem de ataque no seu plano
              </Link>
              <Link
                href="/calculadoras/trocar-divida/"
                onClick={() => track("early_payoff_debt_switch_click")}
                className="font-semibold text-brand-teal-dark underline"
              >
                Vai pegar outro crédito para quitar esta dívida? Compare antes →
              </Link>
              {rate.trim() !== "" ? (
                <Link
                  href="/calculadoras/minha-taxa-esta-cara/"
                  onClick={() => track("early_payoff_rate_tool_click")}
                  className="text-brand-teal-dark underline"
                >
                  Sua taxa está cara? Compare com o BC
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <p className="mt-6 rounded-lg border border-brand-warning/30 bg-brand-warning-soft p-4 text-sm leading-relaxed text-brand-warning">
        Ferramenta educativa. Ela compara o custo da dívida com os valores que você informou — a
        calculadora não determina o saldo oficial de quitação, e não determina se usar sua
        reserva financeira é a melhor decisão para você. Confirme o saldo e as condições
        diretamente com a instituição.
      </p>
    </section>
  );
}
