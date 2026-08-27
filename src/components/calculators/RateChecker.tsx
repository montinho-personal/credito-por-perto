"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import type { BcbRatesResult, SeriesData } from "@/lib/bcb/rates-service";
import { formatRefMonth } from "@/lib/bcb/rates-service";
import {
  compareRate,
  formatRateBR,
  parseRateBR,
  type RateComparisonResult,
  type RateUnit,
} from "@/lib/calculators/rate-comparison";

/* Eventos de uso — nunca a taxa digitada, nunca modalidade+taxa combinadas. */
interface GtagWindow extends Window {
  gtag?: (...args: unknown[]) => void;
}
function gtag(...args: unknown[]) {
  const w = window as GtagWindow;
  if (typeof w.gtag === "function") w.gtag(...args);
}

/** Agrupamento amigável: primeiro a família, depois o subtipo. */
const FAMILIES: Array<{ id: string; label: string; members: string[] }> = [
  { id: "pessoal", label: "Empréstimo pessoal", members: ["pessoal-nao-consignado"] },
  {
    id: "consignado",
    label: "Consignado",
    members: ["consignado-inss", "consignado-privado", "consignado-publico", "consignado-total"],
  },
  { id: "cheque", label: "Cheque especial", members: ["cheque-especial"] },
  { id: "cartao", label: "Cartão parcelado com juros", members: ["cartao-parcelado"] },
  { id: "veiculo", label: "Financiamento de veículo", members: ["veiculos"] },
];

const SUBTYPE_LABELS: Record<string, string> = {
  "consignado-inss": "Aposentado ou pensionista do INSS",
  "consignado-privado": "Trabalhador CLT (setor privado)",
  "consignado-publico": "Servidor público",
  "consignado-total": "Não sei / outro",
};

function HistorySparkline({ series }: { series: SeriesData }) {
  const points = series.history;
  if (points.length < 2) return null;
  const w = 320;
  const h = 72;
  const pad = 6;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const coords = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * (w - pad * 2);
    const y = h - pad - ((p.value - min) / span) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const first = points[0]!;
  const last = points[points.length - 1]!;
  return (
    <div className="mt-5">
      <h4 className="text-sm font-bold text-brand-navy">
        Como essa referência mudou (últimos {points.length} meses)
      </h4>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={`Evolução da taxa média: de ${formatRateBR(first.value)} ao mês em ${formatRefMonth(first.refMonth)} para ${formatRateBR(last.value)} ao mês em ${formatRefMonth(last.refMonth)}`}
        className="mt-2 w-full max-w-md text-brand-teal-dark"
      >
        <polyline
          points={coords.join(" ")}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <details className="mt-1 text-xs text-brand-muted">
        <summary className="cursor-pointer font-medium">Ver os valores mês a mês</summary>
        <table className="mt-2 border-collapse text-xs">
          <caption className="sr-only">Taxa média mensal por mês de referência</caption>
          <thead>
            <tr>
              <th scope="col" className="pr-4 text-left font-semibold">Mês</th>
              <th scope="col" className="text-left font-semibold">Taxa média</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.refMonth}>
                <td className="pr-4">{formatRefMonth(p.refMonth)}</td>
                <td className="tabular-nums">{formatRateBR(p.value)} a.m.</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

const CLASSIFICATION_COPY: Record<
  RateComparisonResult["classification"],
  { title: string; body: string }
> = {
  below_reference: {
    title: "Sua taxa está abaixo da referência",
    body: "A taxa informada está abaixo da referência média desta modalidade. Ainda vale comparar CET, prazo, parcela e custo total antes de decidir.",
  },
  near_reference: {
    title: "Sua taxa está próxima da referência",
    body: "Sua taxa está próxima da referência utilizada. Isso não significa que seja automaticamente boa ou ruim para o seu caso.",
  },
  above_reference: {
    title: "Sua taxa está acima da referência",
    body: "Sua taxa está acima da referência. Vale comparar outras propostas e verificar o CET e o custo total antes de decidir.",
  },
  far_above_reference: {
    title: "A diferença em relação à referência é significativa",
    body: "Confirme se a modalidade selecionada é mesmo a da sua proposta, revise os dados e considere comparar outras condições.",
  },
};

export function RateChecker({ rates }: { rates: BcbRatesResult }) {
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [seriesId, setSeriesId] = useState<string | null>(null);
  const [rateText, setRateText] = useState("");
  const [unit, setUnit] = useState<RateUnit>("monthly");
  const [rateKind, setRateKind] = useState<"interest" | "cet" | "unknown">("interest");
  const [result, setResult] = useState<RateComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmedHigh, setConfirmedHigh] = useState(false);
  const startedRef = useRef(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const byId = useMemo(
    () => new Map(rates.series.map((s) => [s.internalId, s])),
    [rates.series],
  );

  const availableFamilies = FAMILIES.filter((f) =>
    f.members.some((m) => byId.has(m)),
  );
  const family = availableFamilies.find((f) => f.id === familyId) ?? null;
  const availableMembers = family
    ? family.members.filter((m) => byId.has(m))
    : [];
  const series = seriesId ? byId.get(seriesId) ?? null : null;

  function start() {
    if (!startedRef.current) {
      startedRef.current = true;
      gtag("event", "rate_compare_start");
    }
  }

  function pickFamily(id: string) {
    start();
    setFamilyId(id);
    setResult(null);
    setError(null);
    const f = availableFamilies.find((x) => x.id === id);
    const members = f ? f.members.filter((m) => byId.has(m)) : [];
    setSeriesId(members.length === 1 ? members[0]! : null);
  }

  function loadExample() {
    start();
    setFamilyId("pessoal");
    setSeriesId("pessoal-nao-consignado");
    setRateText("4,2");
    setUnit("monthly");
    setRateKind("interest");
    setResult(null);
    setError(null);
  }

  function clearAll() {
    setFamilyId(null);
    setSeriesId(null);
    setRateText("");
    setUnit("monthly");
    setRateKind("interest");
    setResult(null);
    setError(null);
    setConfirmedHigh(false);
  }

  function handleCompare(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!series) {
      setError("Escolha a modalidade do seu crédito.");
      return;
    }
    if (rateKind === "cet") {
      setResult(null);
      setError(null);
      // A UI mostra o bloco explicativo de CET; nada a calcular.
      gtag("event", "rate_compare_cet_informed");
      return;
    }
    const parsed = parseRateBR(rateText);
    if (parsed === null) {
      setError("Informe a taxa como número — por exemplo, 4,20.");
      return;
    }
    try {
      const comparison = compareRate({
        userRate: parsed,
        userUnit: unit,
        referenceMonthly: series.latest.value,
      });
      if (comparison.confirmSuggested && !confirmedHigh) {
        setError(
          `Você informou ${formatRateBR(parsed)} ${unit === "monthly" ? "ao mês" : "ao ano"}. Confirme se o número e a unidade estão corretos e toque em Comparar de novo para prosseguir.`,
        );
        setConfirmedHigh(true);
        return;
      }
      setResult(comparison);
      gtag("event", "rate_compare_complete", {
        family: familyId,
        unit,
        outcome: comparison.classification,
      });
      requestAnimationFrame(() => {
        resultRef.current
          ?.querySelector<HTMLElement>("#resultado-taxa")
          ?.focus({ preventScroll: false });
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível comparar.");
    }
  }

  if (rates.series.length === 0) {
    return (
      <section
        aria-label="Comparador de taxa com o Banco Central"
        className="rounded-2xl border border-brand-border bg-brand-surface-soft/50 p-6"
      >
        <p className="font-semibold text-brand-navy">
          Os dados oficiais do Banco Central estão temporariamente indisponíveis.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-brand-muted">
          A comparação usa exclusivamente as séries oficiais de taxa média do BC, e neste momento não
          conseguimos obtê-las. Tente novamente mais tarde ou consulte diretamente a{" "}
          <a
            href="https://www.bcb.gov.br/estatisticas/txjuros"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            página oficial de taxas de juros do Banco Central
          </a>
          .
        </p>
      </section>
    );
  }

  const copy = result ? CLASSIFICATION_COPY[result.classification] : null;

  return (
    <section
      aria-label="Comparador de taxa com o Banco Central"
      className="rounded-2xl border border-brand-border bg-brand-surface-soft/50 p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm leading-relaxed text-brand-muted">
          Sem cadastro e sem informar banco. A taxa que você digita não é enviada nem salva — só os
          dados do BC vêm do servidor.
        </p>
        <button
          type="button"
          onClick={loadExample}
          className="rounded-lg border border-brand-border bg-white px-4 py-2 text-sm font-medium text-brand-navy hover:bg-brand-surface-soft"
        >
          Ver exemplo
        </button>
      </div>

      <form onSubmit={handleCompare} noValidate className="mt-4 space-y-5">
        <fieldset>
          <legend className="text-sm font-bold text-brand-navy">
            1. Que tipo de crédito você recebeu?
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {availableFamilies.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => pickFamily(f.id)}
                aria-pressed={familyId === f.id}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                  familyId === f.id
                    ? "border-brand-teal-dark bg-brand-teal-dark text-white"
                    : "border-brand-border bg-white text-brand-navy hover:bg-brand-surface-soft"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </fieldset>

        {family && availableMembers.length > 1 ? (
          <fieldset>
            <legend className="text-sm font-bold text-brand-navy">Qual tipo de consignado?</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {availableMembers.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setSeriesId(id);
                    setResult(null);
                  }}
                  aria-pressed={seriesId === id}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    seriesId === id
                      ? "border-brand-teal-dark bg-brand-teal-dark text-white"
                      : "border-brand-border bg-white text-brand-navy hover:bg-brand-surface-soft"
                  }`}
                >
                  {SUBTYPE_LABELS[id] ?? byId.get(id)?.displayName}
                </button>
              ))}
            </div>
          </fieldset>
        ) : null}

        {series ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="taxa" className="block text-sm font-bold text-brand-navy">
                2. Qual taxa apareceu na sua proposta?
              </label>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  id="taxa"
                  type="text"
                  inputMode="decimal"
                  value={rateText}
                  placeholder="4,20"
                  onChange={(e) => {
                    setRateText(e.target.value);
                    setConfirmedHigh(false);
                  }}
                  className="w-full rounded-lg border border-brand-border bg-white px-3 py-2.5 text-brand-text focus:border-brand-teal"
                />
                <div
                  role="radiogroup"
                  aria-label="Periodicidade da taxa"
                  className="flex shrink-0 gap-2 text-sm"
                >
                  {(
                    [
                      ["monthly", "% a.m."],
                      ["annual", "% a.a."],
                    ] as const
                  ).map(([u, label]) => (
                    <label key={u} className="flex items-center gap-1">
                      <input
                        type="radio"
                        name="unidade"
                        checked={unit === u}
                        onChange={() => setUnit(u)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <fieldset>
              <legend className="text-sm font-bold text-brand-navy">
                3. Esse número é taxa de juros ou CET?
              </legend>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {(
                  [
                    ["interest", "Taxa de juros"],
                    ["cet", "CET"],
                    ["unknown", "Não sei"],
                  ] as const
                ).map(([kind, label]) => (
                  <label key={kind} className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="tipo"
                      checked={rateKind === kind}
                      onChange={() => setRateKind(kind)}
                    />
                    {label}
                  </label>
                ))}
              </div>
              {rateKind === "unknown" ? (
                <p className="mt-2 rounded-lg bg-brand-surface-soft p-3 text-xs leading-relaxed text-brand-muted">
                  Procure na proposta algo como &ldquo;Taxa de juros: X% a.m.&rdquo; ou &ldquo;Taxa
                  efetiva: X% a.a.&rdquo;. Não confunda com o &ldquo;CET&rdquo;, que soma tarifas e
                  seguros. Se só encontrar o CET, marque a opção CET.
                </p>
              ) : null}
            </fieldset>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-lg border border-brand-warning/40 bg-brand-warning-soft p-4 text-sm text-brand-warning">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className="w-full rounded-lg bg-brand-teal-dark px-6 py-3 font-semibold text-white hover:bg-brand-teal sm:w-auto"
          >
            Comparar minha taxa
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="rounded-lg px-4 py-2 text-sm font-medium text-brand-muted underline hover:text-brand-navy"
          >
            Limpar
          </button>
        </div>
      </form>

      <div ref={resultRef} aria-live="polite">
        {rateKind === "cet" && series ? (
          <div className="mt-6 rounded-xl border border-brand-border bg-white p-5 text-sm leading-relaxed">
            <p className="font-bold text-brand-navy">CET e taxa de juros não são a mesma coisa.</p>
            <p className="mt-2 text-brand-text">
              O CET soma juros, tarifas, tributos e seguros — por isso ele é maior que a taxa de
              juros, e compará-lo com uma referência de <em>taxa de juros</em> distorceria o
              resultado. Três caminhos:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-brand-text">
              <li>
                Procure a <strong>taxa de juros</strong> na proposta (algo como &ldquo;taxa: X%
                a.m.&rdquo;) e volte aqui;
              </li>
              <li>
                <Link href="/juros-e-cet/o-que-e-cet/" className="underline">
                  Entenda o CET
                </Link>{" "}
                e o que entra nele;
              </li>
              <li>
                Tem duas propostas? O{" "}
                <Link href="/calculadoras/comparador-de-propostas/" className="underline">
                  Comparador de Propostas
                </Link>{" "}
                compara CET com CET.
              </li>
            </ul>
          </div>
        ) : null}

        {result && series && copy ? (
          <div className="mt-6 border-t border-brand-border pt-6">
            <h2
              id="resultado-taxa"
              tabIndex={-1}
              className="font-serif text-2xl font-bold text-brand-navy"
            >
              {copy.title}
            </h2>

            <dl className="mt-4 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl bg-white p-4 ring-1 ring-brand-border">
                <dt className="text-xs font-semibold uppercase tracking-wide text-brand-muted">
                  Sua taxa
                </dt>
                <dd className="mt-1 text-2xl font-bold text-brand-navy">
                  {formatRateBR(result.userMonthly)} a.m.
                </dd>
                <dd className="text-xs text-brand-muted">
                  ≈ {formatRateBR(result.userAnnualEquivalent)} a.a. (equivalente composta)
                </dd>
              </div>
              <div className="rounded-xl bg-brand-teal-soft p-4">
                <dt className="text-xs font-semibold uppercase tracking-wide text-brand-teal-dark">
                  Média de referência do BC
                </dt>
                <dd className="mt-1 text-2xl font-bold text-brand-navy">
                  {formatRateBR(series.latest.value)} a.m.
                </dd>
                <dd className="text-xs text-brand-muted">
                  Mês de referência: {formatRefMonth(series.latest.refMonth)}
                </dd>
              </div>
              <div className="rounded-xl bg-white p-4 ring-1 ring-brand-border">
                <dt className="text-xs font-semibold uppercase tracking-wide text-brand-muted">
                  Diferença
                </dt>
                <dd className="mt-1 text-2xl font-bold text-brand-navy">
                  {result.diffPointsMonthly >= 0 ? "+" : "−"}
                  {formatRateBR(Math.abs(result.diffPointsMonthly)).replace("%", "")} p.p. ao mês
                </dd>
                <dd className="text-xs text-brand-muted">
                  Diferença relativa: {result.diffRelativePct >= 0 ? "+" : "−"}
                  {formatRateBR(Math.abs(result.diffRelativePct))} sobre a referência
                </dd>
              </div>
            </dl>

            <p className="mt-4 text-base leading-relaxed text-brand-text">{copy.body}</p>
            <p className="mt-3 rounded-xl bg-brand-surface-soft p-4 text-sm leading-relaxed text-brand-text">
              <strong>
                Isso não significa automaticamente que sua taxa seja abusiva ou que exista erro na
                proposta.
              </strong>{" "}
              O próprio Banco Central informa que as taxas variam conforme o perfil do cliente, as
              garantias e as condições de cada operação. Média é referência — não é teto nem preço
              obrigatório.
            </p>

            <HistorySparkline series={series} />

            <div className="mt-5 rounded-xl border border-brand-border bg-white p-4 text-sm">
              <p className="font-bold text-brand-navy">Fonte</p>
              <p className="mt-1 leading-relaxed text-brand-muted">
                Banco Central do Brasil — {series.officialName} (série SGS{" "}
                {series.monthlySeries}). {series.methodology} Dados referentes a{" "}
                {formatRefMonth(series.latest.refMonth)}; consulta em {rates.fetchedAt}.
              </p>
              <a
                href={series.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => gtag("event", "rate_compare_bcb_source_click")}
                className="mt-2 inline-block font-semibold text-brand-teal-dark underline"
              >
                Ver no Banco Central →
              </a>
            </div>

            <div className="mt-5">
              <h3 className="font-serif text-lg font-bold text-brand-navy">O que fazer agora?</h3>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-brand-text">
                <li>
                  Taxa é só uma parte da proposta. Compare parcela, prazo, CET e total pago no{" "}
                  <Link
                    href="/calculadoras/comparador-de-propostas/"
                    className="font-semibold underline"
                  >
                    Comparador de Propostas
                  </Link>
                  ;
                </li>
                <li>
                  Veja a taxa média de <em>cada banco</em> na{" "}
                  <Link href="/juros-e-cet/como-consultar-taxa-media-do-bc/" className="underline">
                    consulta oficial do BC
                  </Link>
                  , e use o número na negociação;
                </li>
                {result.classification === "above_reference" ||
                result.classification === "far_above_reference" ? (
                  <li>
                    Para contrato já assinado, a{" "}
                    <Link href="/emprestimos/portabilidade-de-credito/" className="underline">
                      portabilidade
                    </Link>{" "}
                    leva a dívida para quem cobra menos — e o guia de{" "}
                    <Link href="/juros-e-cet/juros-abusivos-como-saber/" className="underline">
                      juros abusivos
                    </Link>{" "}
                    explica o que a Justiça considera (uma diferença em relação à média, sozinha,
                    não determina juridicamente que a taxa seja abusiva);
                  </li>
                ) : (
                  <li>
                    Antes de decidir, confira o{" "}
                    <Link href="/juros-e-cet/o-que-e-cet/" className="underline">
                      CET
                    </Link>{" "}
                    e o total a pagar — taxa menor não garante custo menor.
                  </li>
                )}
              </ul>
            </div>
          </div>
        ) : null}
      </div>

      <p className="mt-6 rounded-lg border border-brand-warning/30 bg-brand-warning-soft p-4 text-sm leading-relaxed text-brand-warning">
        Ferramenta educativa. A comparação usa a taxa média oficial mais recente disponível do Banco
        Central para a modalidade selecionada e não constitui recomendação, avaliação jurídica nem
        oferta de crédito. Sua taxa pode estar acima da média e ainda refletir condições específicas
        da sua operação.
      </p>
    </section>
  );
}
