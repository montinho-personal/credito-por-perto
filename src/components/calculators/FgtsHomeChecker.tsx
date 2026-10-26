"use client";

import Link from "next/link";
import { useState } from "react";
import {
  checkFgtsHome,
  installmentCover,
  type Answer,
  type CheckState,
  type FgtsHomeAnswers,
  type Goal,
  type Purpose,
} from "@/lib/calculators/fgts-home";

/*
 * Sem eventos de analytics próprios: as respostas e os valores ficam no
 * aparelho. O resultado é recalculado a cada resposta, sem botão.
 */

const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

/** "1.234,56" ou "1234" → centavos; vazio ou inválido → null. */
function parseMoney(text: string): number | null {
  const clean = text.replace(/[^\d,]/g, "").replace(",", ".");
  if (!clean) return null;
  const value = Number(clean);
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : null;
}

const GOALS: { id: Goal; label: string; hint: string }[] = [
  { id: "comprar", label: "Comprar ou construir", hint: "Entrada, parte do pagamento ou compra à vista" },
  { id: "amortizar", label: "Amortizar ou quitar", hint: "Abater o saldo de um financiamento que já tenho" },
  { id: "prestacao", label: "Pagar parte das prestações", hint: "Até 80% da prestação, por 12 meses" },
];

const PURPOSES: { id: Purpose; label: string }[] = [
  { id: "residencial-urbano", label: "Comprar ou construir imóvel residencial urbano" },
  { id: "reforma", label: "Reformar, ampliar ou concluir um imóvel" },
  { id: "terreno", label: "Comprar só o terreno" },
  { id: "material", label: "Comprar material de construção" },
  { id: "comercial", label: "Imóvel comercial" },
  { id: "rural", label: "Imóvel rural" },
  { id: "para-outra-pessoa", label: "Imóvel para um familiar ou outra pessoa" },
];

const STATE_COPY: Record<CheckState, { label: string; className: string }> = {
  atende: { label: "Atende", className: "border-brand-teal/40 bg-white" },
  "nao-atende": { label: "Não atende", className: "border-brand-warning/50 bg-brand-warning-soft" },
  confirmar: { label: "Falta confirmar", className: "border-brand-border bg-white" },
};

function YesNo({
  name,
  legend,
  hint,
  value,
  onChange,
}: {
  name: string;
  legend: string;
  hint?: string;
  value: Answer | undefined;
  onChange: (v: Answer) => void;
}) {
  const options: { v: Answer; label: string }[] = [
    { v: "sim", label: "Sim" },
    { v: "nao", label: "Não" },
    { v: "nao-sei", label: "Não sei" },
  ];
  return (
    <fieldset className="mt-5">
      <legend className="font-semibold text-brand-navy">{legend}</legend>
      {hint ? <p className="mt-0.5 text-sm text-brand-muted">{hint}</p> : null}
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o.v}
            className={`cursor-pointer rounded-xl border px-4 py-2.5 text-sm font-medium ${
              value === o.v ? "border-brand-navy bg-brand-navy text-white" : "border-brand-border bg-white text-brand-navy"
            }`}
          >
            <input type="radio" name={name} value={o.v} checked={value === o.v} onChange={() => onChange(o.v)} className="sr-only" />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function FgtsHomeChecker() {
  const [a, setA] = useState<FgtsHomeAnswers>({ goal: "comprar" });
  const [valueText, setValueText] = useState("");
  const [installmentText, setInstallmentText] = useState("");
  const [balanceText, setBalanceText] = useState("");

  const set = <K extends keyof FgtsHomeAnswers>(k: K, v: FgtsHomeAnswers[K]) => setA((prev) => ({ ...prev, [k]: v }));
  const result = checkFgtsHome({ ...a, propertyValueCents: parseMoney(valueText) });
  const installment = parseMoney(installmentText);
  const cover = a.goal === "prestacao" && installment ? installmentCover(installment, parseMoney(balanceText)) : null;

  const summaryCopy =
    result.summary === "atende"
      ? "Pelas suas respostas, você atende às condições listadas pela Caixa para esta forma de uso."
      : result.summary === "nao-atende"
        ? "Pelas suas respostas, alguma condição não é atendida. Veja qual, abaixo."
        : "Pelas suas respostas, ainda falta confirmar alguma condição. Veja qual, abaixo.";

  return (
    <section
      aria-label="Verificador de uso do FGTS na casa própria"
      className="rounded-2xl border border-brand-border bg-brand-surface-soft/50 p-4 sm:p-6"
    >
      <p className="text-sm leading-relaxed text-brand-muted">
        Sem cadastro e sem CPF. As respostas não são enviadas nem salvas: a verificação acontece no seu navegador.
      </p>

      <fieldset className="mt-4">
        <legend className="font-serif text-xl font-bold text-brand-navy">Como você quer usar o FGTS?</legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {GOALS.map((g) => (
            <label
              key={g.id}
              className={`cursor-pointer rounded-xl border px-4 py-3 ${
                a.goal === g.id ? "border-brand-navy bg-white ring-2 ring-brand-navy" : "border-brand-border bg-white"
              }`}
            >
              <input
                type="radio"
                name="objetivo"
                value={g.id}
                checked={a.goal === g.id}
                onChange={() => setA({ goal: g.id })}
                className="sr-only"
              />
              <span className="block font-semibold text-brand-navy">{g.label}</span>
              <span className="mt-0.5 block text-sm text-brand-muted">{g.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {a.goal === "comprar" ? (
        <>
          <YesNo name="tres-anos" legend="Você tem 3 anos ou mais de trabalho com FGTS?" hint="Somando todos os períodos com carteira assinada, seguidos ou não." value={a.threeYears} onChange={(v) => set("threeYears", v)} />
          <YesNo name="sfh" legend="Você tem financiamento habitacional ativo no SFH?" hint="Em qualquer parte do país." value={a.activeSfh} onChange={(v) => set("activeSfh", v)} />
          <YesNo
            name="regiao"
            legend="Você já tem imóvel residencial na região onde mora ou trabalha?"
            hint="No município onde mora, onde trabalha, nos vizinhos a eles ou na mesma região metropolitana. Vale ser dono, possuidor, promitente comprador, usufrutuário ou cessionário."
            value={a.propertyInRegion}
            onChange={(v) => set("propertyInRegion", v)}
          />
          <fieldset className="mt-5">
            <legend className="font-semibold text-brand-navy">Para que o FGTS seria usado?</legend>
            <select
              value={a.purpose ?? ""}
              onChange={(e) => set("purpose", (e.target.value || undefined) as Purpose | undefined)}
              className="mt-2 w-full rounded-xl border border-brand-border bg-white px-4 py-3 text-base text-brand-text outline-none focus:border-brand-teal"
            >
              <option value="">Escolha</option>
              {PURPOSES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </fieldset>
          <YesNo name="moradia" legend="O imóvel é para você morar?" value={a.ownHome} onChange={(v) => set("ownHome", v)} />
          <div className="mt-5">
            <label htmlFor="valor-imovel" className="font-semibold text-brand-navy">
              Valor do imóvel (opcional)
            </label>
            <p className="mt-0.5 text-sm text-brand-muted">O que vale é a avaliação do agente financeiro.</p>
            <input
              id="valor-imovel"
              inputMode="decimal"
              placeholder="Ex.: 350.000"
              value={valueText}
              onChange={(e) => setValueText(e.target.value)}
              className="mt-2 w-full rounded-xl border border-brand-border bg-white px-4 py-3 text-base text-brand-text outline-none focus:border-brand-teal sm:max-w-60"
            />
          </div>
          <YesNo name="fgts-recente" legend="O imóvel foi comprado com FGTS há menos de 3 anos?" hint="Contados do registro na matrícula." value={a.boughtWithFgtsRecently} onChange={(v) => set("boughtWithFgtsRecently", v)} />
        </>
      ) : (
        <>
          <YesNo
            name="contrato"
            legend="O seu financiamento é do SFH?"
            hint="Ou do SFI, assinado a partir de 12/06/2021, com imóvel avaliado dentro do limite do SFH. O tipo está no contrato."
            value={a.contractEligible}
            onChange={(v) => set("contractEligible", v)}
          />
          {a.goal === "amortizar" ? (
            <YesNo name="ultimo-uso" legend="Você usou o FGTS para amortizar ou quitar este contrato há menos de 2 anos?" value={a.usedForAmortizationRecently} onChange={(v) => set("usedForAmortizationRecently", v)} />
          ) : (
            <>
              <YesNo name="tres-anos-p" legend="Você tem 3 anos ou mais de trabalho com FGTS?" hint="Somando todos os períodos, seguidos ou não." value={a.threeYears} onChange={(v) => set("threeYears", v)} />
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="prestacao" className="font-semibold text-brand-navy">Valor da prestação</label>
                  <input id="prestacao" inputMode="decimal" placeholder="Ex.: 2.000" value={installmentText} onChange={(e) => setInstallmentText(e.target.value)} className="mt-2 w-full rounded-xl border border-brand-border bg-white px-4 py-3 text-base text-brand-text outline-none focus:border-brand-teal" />
                </div>
                <div>
                  <label htmlFor="saldo-fgts" className="font-semibold text-brand-navy">Saldo do FGTS (opcional)</label>
                  <input id="saldo-fgts" inputMode="decimal" placeholder="Ex.: 10.000" value={balanceText} onChange={(e) => setBalanceText(e.target.value)} className="mt-2 w-full rounded-xl border border-brand-border bg-white px-4 py-3 text-base text-brand-text outline-none focus:border-brand-teal" />
                </div>
              </div>
            </>
          )}
        </>
      )}

      <div aria-live="polite" className="mt-6">
        <h2 className="font-serif text-xl font-bold text-brand-navy">O que as suas respostas mostram</h2>
        <p className="mt-1 text-sm leading-relaxed text-brand-text">{summaryCopy}</p>
        <ul className="mt-3 space-y-2">
          {result.checks.map((c) => (
            <li key={c.id} className={`rounded-xl border p-4 ${STATE_COPY[c.state].className}`}>
              <p className="text-sm">
                <span className="font-bold text-brand-navy">{STATE_COPY[c.state].label}:</span>{" "}
                <span className="font-semibold text-brand-navy">{c.label}</span>
              </p>
              <p className="mt-1 text-sm text-brand-text">{c.detail}</p>
            </li>
          ))}
        </ul>

        {cover ? (
          <div className="mt-4 rounded-xl border border-brand-border bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Quanto o FGTS pode cobrir</p>
            <p className="mt-1 font-serif text-2xl font-bold text-brand-navy">até {brl(cover.monthlyCents)} por mês</p>
            <p className="mt-1 text-sm text-brand-text">
              80% da prestação de {brl(installment!)}, por 12 meses seguidos: até {brl(cover.twelveMonthsCents)} no total.
              {parseMoney(balanceText)
                ? ` O saldo informado cobre ${cover.monthsCovered} ${cover.monthsCovered === 1 ? "mês" : "meses"} nesse teto.`
                : ""}
            </p>
          </div>
        ) : null}

        <p className="mt-4 text-sm leading-relaxed text-brand-muted">
          Este verificador confere as condições publicadas pela Caixa e pela Lei nº 8.036/1990. A Caixa verifica o enquadramento a
          cada uso do FGTS, pelo Manual de Moradia Própria, e pode pedir documentos e condições que esta lista não cobre. A
          resposta final é do agente financeiro. As regras explicadas estão em{" "}
          <Link href="/emprestimos/usar-fgts-para-comprar-imovel/">como usar o FGTS para comprar imóvel</Link>.
        </p>
      </div>
    </section>
  );
}
