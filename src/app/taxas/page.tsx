import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { webPageJsonLd } from "@/lib/schema/jsonld";
import { JsonLd } from "@/components/seo/JsonLd";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { RadarHistory } from "@/components/radar/RadarHistory";
import { getRadarData, type RadarSeries } from "@/lib/bcb/radar-service";
import { formatRefMonth } from "@/lib/bcb/rates-service";
import {
  buildMovementSentence,
  buildYearSentence,
  formatPP,
  formatRate,
  MOVEMENT_ARROW,
  MOVEMENT_LABEL,
} from "@/lib/bcb/radar-insights";
import { ToolNextSteps } from "@/components/journeys/ToolNextSteps";

/** Revalidação diária: as séries do BC são mensais. */
export const revalidate = 86400;

export const metadata: Metadata = buildMetadata({
  title: "Radar de taxas de crédito: acompanhe os dados do Banco Central",
  description:
    "Acompanhe as taxas médias de empréstimo pessoal, consignado, cartão, cheque especial e financiamento de veículos com dados oficiais e histórico do Banco Central.",
  path: "/taxas/",
});

/** Ordem editorial dos cards principais; o restante vem em seguida. */
const FEATURED_ORDER = [
  "pessoal-nao-consignado",
  "consignado-total",
  "consignado-inss",
  "cheque-especial",
  "cartao-rotativo",
  "veiculos",
];

function orderSeries(series: RadarSeries[]): RadarSeries[] {
  const rank = (id: string) => {
    const i = FEATURED_ORDER.indexOf(id);
    return i === -1 ? FEATURED_ORDER.length : i;
  };
  return [...series].sort((a, b) => rank(a.internalId) - rank(b.internalId));
}

function RateCard({ s }: { s: RadarSeries }) {
  const { stats } = s;
  return (
    <a
      href={`#${s.internalId}`}
      className="block rounded-xl border border-brand-border bg-white p-4 transition-colors hover:border-brand-teal"
    >
      <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">{s.displayName}</p>
      <p className="mt-1 font-serif text-2xl font-bold text-brand-navy">
        {formatRate(stats.latest.value)} <span className="text-base font-normal">a.m.</span>
      </p>
      <p className="text-xs text-brand-muted">Referência: {formatRefMonth(stats.latest.refMonth)}</p>
      {stats.movement && stats.diffPrevPP !== null ? (
        <p className="mt-1 text-sm text-brand-text">
          {MOVEMENT_ARROW[stats.movement]} {MOVEMENT_LABEL[stats.movement]} no último dado
          {stats.movement !== "same" ? ` (${formatPP(stats.diffPrevPP)} p.p.)` : ""}
        </p>
      ) : null}
      <p className="mt-2 text-sm font-semibold text-brand-teal-dark">Ver histórico ↓</p>
    </a>
  );
}

export default async function TaxasPage() {
  const radar = await getRadarData();
  const series = orderSeries(radar.series);
  const sample = series[0];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <JsonLd
        data={webPageJsonLd(
          "Radar de taxas de crédito",
          "Taxas médias das principais modalidades de crédito para pessoas físicas, com dados oficiais e histórico do Banco Central do Brasil.",
          "/taxas/",
        )}
      />
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: "Radar de taxas", path: "/taxas/" },
        ]}
      />

      <header className="mt-6">
        <h1 className="font-serif text-3xl font-bold leading-tight text-brand-navy md:text-4xl">
          Radar de taxas de crédito
        </h1>
        <p className="mt-3 text-lg leading-relaxed text-brand-muted">
          Os juros estão subindo ou caindo? Acompanhe as principais taxas médias de crédito com
          dados oficiais do Banco Central: o último dado disponível, o período de referência, a
          variação e o histórico de cada modalidade.
        </p>
        {sample ? (
          <p className="mt-2 text-sm text-brand-muted">
            Último dado oficial disponível: referência {formatRefMonth(sample.stats.latest.refMonth)}.
            Dados atualizados automaticamente a partir do Banco Central — nosso sistema consultou o
            BC em {radar.fetchedAt.split("-").reverse().join("/")}.
          </p>
        ) : null}
      </header>

      {series.length === 0 ? (
        <div className="mt-8 rounded-xl border border-brand-border bg-white p-6">
          <p className="font-bold text-brand-navy">
            Não conseguimos consultar os dados oficiais agora.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-brand-text">
            Isso é uma indisponibilidade técnica — nenhum número é exibido sem fonte. Tente
            novamente mais tarde ou consulte diretamente a{" "}
            <a
              href="https://www.bcb.gov.br/estatisticas/txjuros"
              rel="noopener noreferrer"
              target="_blank"
              className="font-semibold underline"
            >
              página de taxas de juros do Banco Central
            </a>
            .
          </p>
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {series.map((s) => (
              <RateCard key={s.internalId} s={s} />
            ))}
          </div>
          {radar.failed.length > 0 ? (
            <p className="mt-3 text-xs text-brand-muted">
              Algumas modalidades estão temporariamente sem dado válido nesta atualização e ficaram
              fora da lista — nenhum número é exibido sem validação.
            </p>
          ) : null}

          <p className="mt-6 rounded-lg border border-brand-warning/30 bg-brand-warning-soft p-4 text-sm leading-relaxed text-brand-warning">
            A taxa média serve como referência de mercado — ela não é um teto legal nem uma oferta
            garantida. A taxa oferecida a uma pessoa pode ser diferente conforme instituição,
            modalidade, perfil, garantias e condições da operação.
          </p>

          <div className="mt-10 space-y-10">
            {series.map((s) => (
              <section key={s.internalId} id={s.internalId} aria-labelledby={`h-${s.internalId}`}>
                <h2 id={`h-${s.internalId}`} className="font-serif text-2xl font-bold text-brand-navy">
                  {s.displayName}
                </h2>
                <p className="mt-1 text-sm text-brand-muted">{s.officialName} — % ao mês.</p>
                <p className="mt-2 text-base leading-relaxed text-brand-text">
                  {buildMovementSentence(s.stats)}
                  {buildYearSentence(s.stats) ? ` ${buildYearSentence(s.stats)}` : ""}
                </p>
                <div className="mt-3">
                  <RadarHistory
                    internalId={s.internalId}
                    displayName={s.displayName}
                    history={s.history}
                  />
                </div>
                <p className="mt-2 text-xs text-brand-muted">
                  Fonte: Banco Central do Brasil — série SGS {s.monthlySeries}. {s.methodology}{" "}
                  Referência: {formatRefMonth(s.stats.latest.refMonth)}.{" "}
                  <a href={s.sourceUrl} rel="noopener noreferrer" target="_blank" className="font-semibold underline">
                    Ver dado oficial
                  </a>
                  {s.relatedGuidePath ? (
                    <>
                      {" · "}
                      <Link href={s.relatedGuidePath} className="underline">
                        guia da modalidade
                      </Link>
                    </>
                  ) : null}
                </p>
              </section>
            ))}
          </div>

          <div className="mt-10 rounded-xl bg-brand-surface-soft p-5 text-sm leading-relaxed">
            <p className="font-bold text-brand-navy">Tem duas propostas na mão?</p>
            <p className="mt-1 text-brand-text">
              Taxa é só uma parte da comparação — o{" "}
              <Link href="/calculadoras/comparador-de-propostas/" className="font-semibold text-brand-teal-dark underline">
                comparador de propostas
              </Link>{" "}
              coloca parcela, prazo, CET e total lado a lado.
            </p>
          </div>
        </>
      )}

      <ToolNextSteps toolId="radar-de-taxas" />


      <section aria-labelledby="perguntas-radar" className="article-body mt-12">
        <h2 id="perguntas-radar">O que são as taxas médias do Banco Central?</h2>
        <p>
          São estatísticas oficiais que o BC publica mensalmente: a taxa média das{" "}
          <strong>novas operações</strong> de crédito contratadas no mês de referência, em cada
          modalidade, ponderada pelo valor das concessões — aqui, sempre da família
          &ldquo;recursos livres, pessoas físicas&rdquo;, em % ao mês. Não é tabela de preços nem
          promessa de taxa.
        </p>

        <h2 id="por-que-diferente">Por que a sua taxa pode ser diferente da média?</h2>
        <p>
          Porque a média junta perfis, prazos, garantias e instituições muito diferentes. A taxa
          oferecida a você depende do seu caso — a média serve de referência para saber se a sua
          proposta está perto ou longe do mercado. É exatamente essa comparação que a ferramenta{" "}
          <Link href="/calculadoras/minha-taxa-esta-cara/">minha taxa está cara?</Link> faz.
        </p>

        <h2 id="media-e-teto">Taxa média é teto?</h2>
        <p>
          Não. Média não é limite legal: existem operações acima e abaixo dela por construção.
          Uma taxa acima da média não é automaticamente abusiva — e uma abaixo não é
          automaticamente boa. O contexto completo está em{" "}
          <Link href="/juros-e-cet/juros-abusivos-como-saber/">juros abusivos: como saber</Link>.
        </p>

        <h2 id="taxa-e-cet-radar">Taxa de juros é igual ao CET?</h2>
        <p>
          Não. As séries do Radar medem a taxa de juros; o CET (Custo Efetivo Total) inclui também
          tarifas, seguros e demais encargos. Para comparar propostas, o número decisivo é o CET —
          entenda em <Link href="/juros-e-cet/o-que-e-cet/">o que é CET</Link>.
        </p>

        <h2 id="periodo-referencia">Por que os dados têm período de referência?</h2>
        <p>
          Porque as séries são mensais e o BC publica cada mês algumas semanas depois de fechado.
          Por isso o Radar nunca fala em &ldquo;taxa de hoje&rdquo;: mostra sempre o{" "}
          <strong>último dado oficial disponível</strong> com o mês de referência ao lado — e,
          separadamente, a data em que nosso sistema consultou o BC.
        </p>

        <h2 id="metodologia-radar">Como funciona o Radar?</h2>
        <p>
          Usamos exclusivamente séries do SGS (Sistema Gerenciador de Séries Temporais) do Banco
          Central, todas da mesma família metodológica, com o código exibido em cada modalidade —
          nada de médias próprias. As variações são calculadas sobre os valores brutos e mostradas
          em pontos percentuais; buracos na série não são preenchidos por interpolação; um dado
          fora da faixa de plausibilidade ou com anomalia extrema é retido para revisão em vez de
          publicado. A atualização é automática (consulta diária ao BC, dado novo quando o BC
          publica) e, se a fonte estiver indisponível, mantemos o último dado oficial armazenado —
          nunca inventamos número. Como consultar direto na fonte:{" "}
          <Link href="/juros-e-cet/como-consultar-taxa-media-do-bc/">
            passo a passo no site do BC
          </Link>
          . Encontrou algo divergente? Veja a{" "}
          <Link href="/politica-de-correcoes/">política de correções</Link>. Metodologia revisada
          em 27/08/2026.
        </p>
      </section>
    </div>
  );
}
