import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { webPageJsonLd } from "@/lib/schema/jsonld";
import { JsonLd } from "@/components/seo/JsonLd";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ToolNextSteps } from "@/components/journeys/ToolNextSteps";
import {
  CreditCardInterestCalculator,
  SimulateCardButton,
  type RotativoReference,
} from "@/components/calculators/CreditCardInterestCalculator";
import { ScenarioTable } from "@/components/calculators/HomeFinancingSimulator";
import { getBcbRates, formatRefMonth } from "@/lib/bcb/rates-service";
import { simulateCycle } from "@/lib/calculators/credit-card";
import {
  BC_RATES_PAGE,
  INTEREST_CAP,
  PORTABILITY,
  ROTATIVO_DURATION,
  formatIsoDate,
} from "@/lib/calculators/credit-card-rules";

/**
 * Página da calculadora de juros do cartão.
 *
 * INTENÇÃO: "quanto custa" não pagar a fatura inteira. O artigo "Como sair
 * do rotativo" é dono de "como sair"; "Fatura do cartão: como funciona", de
 * como a fatura funciona. Os três se apontam e não repetem conteúdo.
 *
 * UM CICLO SÓ. A regra do rotativo limita a permanência do saldo até a
 * fatura seguinte; a página não simula "12 meses de rotativo", como fazem
 * calculadoras concorrentes que passam do teto legal.
 *
 * DADOS: a média do rotativo é a mesma série do Radar de taxas (SGS 25477,
 * cartão de crédito ROTATIVO, % a.m.) — nunca a do parcelado. Sem dado
 * válido, os exemplos usam uma taxa HIPOTÉTICA, identificada como tal, e a
 * calculadora segue funcionando: quem informa a taxa é a pessoa.
 *
 * REGRAS: só as do módulo `credit-card-rules.ts`, com fonte e data. Multa,
 * mora e IOF não têm percentual publicado aqui — a pesquisa não conseguiu
 * ler o texto oficial; a calculadora pede os valores do contrato.
 */

export const revalidate = 86400;

const PATH = "/calculadoras/juros-cartao-credito/";
const TITLE = "Calculadora de juros do cartão: rotativo e fatura";
const DESCRIPTION =
  "Informe a fatura, quanto pagou e a taxa para estimar o saldo no rotativo e os juros até a próxima fatura, com encargos separados. Sem cadastro.";
const REVIEWED = "23/09/2026";

/** Sem a média oficial, os exemplos usam esta taxa — sempre rotulada como hipotética. */
const HYPOTHETICAL_MONTHLY_RATE = 15;

export const metadata: Metadata = buildMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const pct = (v: number, digits = 2) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

function cycle(invoiceReais: number, paidReais: number, rate: number) {
  const o = simulateCycle({ invoiceCents: invoiceReais * 100, paidCents: paidReais * 100, ratePercent: rate, rateUnit: "am" });
  return o.kind === "ok" ? o.result : null;
}

export default async function JurosCartaoPage() {
  const rates = await getBcbRates();
  const series = rates.series.find((s) => s.internalId === "cartao-rotativo");
  const reference: RotativoReference | null = series
    ? {
        monthlyRatePercent: series.latest.value,
        refMonthLabel: formatRefMonth(series.latest.refMonth),
        sourceUrl: series.sourceUrl,
        seriesCode: series.monthlySeries,
      }
    : null;

  const rate = reference ? Math.round(reference.monthlyRatePercent * 100) / 100 : HYPOTHETICAL_MONTHLY_RATE;
  const rateLabel = reference
    ? `${pct(rate)}% ao mês, a taxa média do rotativo do cartão para pessoas físicas no Banco Central em ${reference.refMonthLabel}`
    : `${pct(rate)}% ao mês, uma taxa hipotética — não é a de nenhuma instituição`;

  const main = cycle(5_000, 2_000, rate);
  const balances = [1_000, 2_000, 3_000, 5_000].flatMap((reais) => {
    // Fatura do dobro, metade paga: o saldo em aberto entra no rotativo.
    const r = cycle(reais * 2, reais, rate);
    return r ? [{ reais, r }] : [];
  });
  const capExample = 1_000_00;

  return (
    <div data-track-area="ferramenta" data-track="juros-cartao-credito" className="mx-auto max-w-3xl px-4 py-8">
      <JsonLd data={webPageJsonLd(TITLE, DESCRIPTION, PATH)} />
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: "Calculadoras", path: "/calculadoras/" },
          { name: "Juros do cartão", path: PATH },
        ]}
      />

      <h1 className="mt-6 font-serif text-3xl font-bold leading-tight text-brand-navy md:text-4xl">
        Calculadora de juros do cartão de crédito
      </h1>
      <p className="mt-3 text-lg leading-relaxed text-brand-muted">
        Veja quanto do saldo da sua fatura entra no rotativo e estime os juros até a próxima fatura.
      </p>

      <div className="mt-6">
        <CreditCardInterestCalculator reference={reference} context="ferramenta" />
      </div>

      <ToolNextSteps toolId="juros-cartao-credito" />

      <section aria-labelledby="como-calcular" className="article-body mt-12">
        <h2 id="como-calcular">Como calcular os juros do cartão de crédito?</h2>
        <p>
          Em três passos: subtraia do total da fatura o que você pagou, e o que sobra é o saldo em aberto;
          multiplique esse saldo pela taxa mensal do rotativo, e o resultado são os juros de um ciclo, até a
          próxima fatura; some os dois para ter o saldo estimado relacionado ao que ficou em aberto.
        </p>
        {main ? (
          <p>
            Uma fatura de R$ 5.000 com R$ 2.000 pagos deixa R$ 3.000 em aberto. A {rateLabel}, os juros de
            um ciclo ficam em {brl(main.interestCents)}, e o saldo relacionado a essa dívida vai para cerca de{" "}
            {brl(main.balanceAfterCents)} — antes de IOF, de encargos de atraso e de qualquer compra nova.
          </p>
        ) : null}
        {main ? (
          <SimulateCardButton label="Simular fatura de R$ 5.000 pagando R$ 2.000" detail={{ exampleId: "5000-pagando-2000", invoiceCents: 5_000_00, paidCents: 2_000_00 }} />
        ) : null}

        <h2 id="pagar-parte">Quanto custa pagar apenas parte da fatura?</h2>
        <p>
          O que conta é o valor que fica em aberto. Com a mesma taxa ({rateLabel}), um ciclo no rotativo
          custa:
        </p>
        {balances.length > 0 ? (
          <ScenarioTable
            caption="Juros de um ciclo no rotativo para saldos em aberto diferentes"
            head={["Saldo em aberto", "Juros do ciclo", "Saldo estimado"]}
            rows={balances.map(({ reais, r }) => ({
              key: String(reais),
              cells: [brl(reais * 100), brl(r.interestCents), brl(r.balanceAfterCents)],
            }))}
          />
        ) : null}
        <p>
          Premissas: um ciclo mensal completo, a taxa acima, sem IOF, sem encargos de atraso e sem compras
          novas. O botão de cada valor leva os números à calculadora, onde dá para usar a taxa da sua fatura.
        </p>
        <div className="flex flex-wrap gap-x-2">
          {[1_000, 2_000, 3_000].map((reais) => (
            <SimulateCardButton
              key={reais}
              label={`Simular R$ ${reais.toLocaleString("pt-BR")} em aberto`}
              detail={{ exampleId: `${reais}-em-aberto`, invoiceCents: reais * 200, paidCents: reais * 100 }}
            />
          ))}
        </div>

        <h2 id="rotativo">O que é o crédito rotativo?</h2>
        <p>
          É o financiamento automático do saldo da fatura que não foi pago integralmente. Pagou menos que o
          total, dentro das condições do cartão, e o restante passa a ser uma dívida com juros — em geral os
          mais altos entre as modalidades de crédito à pessoa física, como mostram as{" "}
          <a href={BC_RATES_PAGE} target="_blank" rel="noopener noreferrer">
            taxas médias publicadas pelo Banco Central
          </a>
          . Como a fatura funciona, das datas de fechamento e vencimento ao limite, está em{" "}
          <Link href="/organizacao-financeira/fatura-do-cartao-como-funciona/">fatura do cartão: como funciona</Link>.
        </p>

        <h2 id="quanto-tempo">Quanto tempo o saldo pode ficar no rotativo?</h2>
        <p>
          {ROTATIVO_DURATION.summary} Por isso a calculadora mostra um ciclo — da fatura atual até a próxima —
          e não vários meses seguidos de rotativo, como fazem simulações que multiplicam a taxa por 12
          meses.
        </p>

        <h2 id="abaixo-do-minimo">O que acontece se eu pagar menos que o mínimo?</h2>
        <p>
          Aí a situação deixa de ser só o rotativo: há atraso, e podem ser cobrados encargos de atraso, como
          multa e juros de mora, além dos juros. A calculadora trata esse caso à parte: informe o pagamento
          mínimo que está na fatura e, se quiser incluir multa e mora, os percentuais do seu contrato — ela
          não usa nenhum percentual por conta própria e mostra cada encargo numa linha. O mínimo em si não
          tem um percentual único: vale o que está na sua fatura.
        </p>

        <h2 id="limite">Existe limite para os juros e encargos do cartão?</h2>
        <p>
          Existe. {INTEREST_CAP.summary} Na prática: numa dívida alcançada pela regra, com valor original de{" "}
          {brl(capExample)}, os juros e encargos financeiros somados não passam de{" "}
          {brl(capExample * INTEREST_CAP.shareOfOriginal)} — o total pode chegar ao dobro do valor original,
          não mais que isso.
        </p>
        <p>
          O limite vale para o que foi acumulado, não é a taxa: a taxa do contrato continua sendo a informada
          na fatura. E ele depende da origem da dívida — a regra vale desde{" "}
          {formatIsoDate(INTEREST_CAP.effectiveFrom)} — e do valor original da operação, que não é o saldo
          total do cartão, com compras novas. A calculadora compara com o limite quando você informa o valor
          original e os encargos já cobrados. Se a conta passar do limite, ela pede para conferir os dados, e
          não conclui nada sobre a cobrança.
        </p>

        <h2 id="parcelamento">Rotativo e parcelamento da fatura são a mesma coisa?</h2>
        <p>
          Não. O rotativo é o financiamento automático do saldo até a próxima fatura; o parcelamento da fatura
          divide a dívida em parcelas, com outra taxa e outro CET. Depois do rotativo, o saldo precisa ser
          quitado ou ir para o parcelamento. O limite de juros e encargos alcança tanto o rotativo quanto o
          parcelamento da fatura. Compare as opções da sua fatura pelo{" "}
          <Link href="/juros-e-cet/o-que-e-cet/">CET</Link> — o{" "}
          <Link href="/calculadoras/comparador-de-propostas/">comparador de propostas</Link> coloca duas lado a
          lado.
        </p>

        <h2 id="comparar">Como comparar as opções da própria fatura?</h2>
        <p>
          Pelo custo em reais e pelo CET de cada forma de pagar o saldo, no mesmo prazo. Se a ideia é trocar a
          dívida do cartão por outro crédito mais barato, a ferramenta{" "}
          <Link href="/calculadoras/trocar-divida/">trocar dívida</Link> compara o custo das duas antes. E{" "}
          {PORTABILITY.summary.charAt(0).toLowerCase() + PORTABILITY.summary.slice(1)} O plano completo para
          sair da dívida, na ordem certa, está em{" "}
          <Link href="/organizacao-financeira/como-sair-do-rotativo/">como sair do rotativo do cartão</Link>;
          e, se o cartão não é a única dívida,{" "}
          <Link href="/organizacao-financeira/qual-divida-pagar-primeiro/">qual dívida pagar primeiro</Link>.
        </p>

        <h2 id="perguntas-frequentes">Perguntas frequentes</h2>

        <h3>Pagar o mínimo é entrar no rotativo?</h3>
        <p>
          Sim: o saldo que sobra entre o mínimo e o total é financiado pelo rotativo até a próxima fatura. Pagar
          abaixo do mínimo já é outra situação, com encargos de atraso.
        </p>

        <h3>A taxa anual que a calculadora mostra é o CET?</h3>
        <p>
          Não. É a taxa mensal convertida para anual por juros compostos — (1 + mensal)<sup>12</sup> − 1 —, só
          para dar a dimensão. O CET inclui tributos, tarifas e outros encargos e é informado pela instituição.
        </p>

        <h3>A calculadora mostra o valor da próxima fatura?</h3>
        <p>
          Não. Ela estima o saldo relacionado ao valor que ficou em aberto. A próxima fatura também traz compras
          novas, parcelas de compras anteriores, anuidade, tarifas e IOF, que a calculadora não conhece.
        </p>

        <h3>A dívida do cartão pode dobrar?</h3>
        <p>
          Nas dívidas alcançadas pela regra, os juros e encargos financeiros não podem passar de 100% do valor
          original — ou seja, somados ao valor original, chegam no máximo ao dobro. O IOF e as compras novas
          ficam fora dessa conta, e a regra vale desde {formatIsoDate(INTEREST_CAP.effectiveFrom)}.
        </p>

        <h2 id="como-calculamos">Como calculamos</h2>
        <ol>
          <li>Subtraímos o valor pago do total da fatura.</li>
          <li>O que sobra é o saldo em aberto (nunca negativo).</li>
          <li>
            Aplicamos a taxa informada ao saldo por um ciclo mensal completo: juros = saldo × taxa mensal. Taxa ao
            ano é convertida para a mensal equivalente, (1 + anual)<sup>1/12</sup> − 1, nunca dividida por 12.
          </li>
          <li>
            Somamos apenas os encargos que você informou — multa e juros de mora pelos percentuais do contrato
            (mora proporcional aos dias), IOF e outros pelo valor da fatura —, cada um na sua linha.
          </li>
          <li>Comparamos com o limite de juros e encargos quando você informa o valor original e o já cobrado.</li>
          <li>Mostramos cada componente separado, arredondado ao centavo.</li>
        </ol>
        <p>
          <strong>Privacidade:</strong> o cálculo acontece no seu navegador. Nenhum valor digitado é enviado,
          gravado ou usado em medição de audiência.
        </p>

        <h2 id="fontes">Fontes e verificação</h2>
        <ul>
          <li>
            {INTEREST_CAP.source.organization} —{" "}
            <a href={INTEREST_CAP.source.url} target="_blank" rel="noopener noreferrer">
              {INTEREST_CAP.source.title}
            </a>{" "}
            (limite de juros e encargos e portabilidade). Informações verificadas em {INTEREST_CAP.verifiedAt}.
          </li>
          <li>
            {ROTATIVO_DURATION.source.organization} — {ROTATIVO_DURATION.source.title} (permanência no rotativo).
            Informações verificadas em {ROTATIVO_DURATION.verifiedAt}.
          </li>
          <li>
            Banco Central do Brasil — taxa média mensal de juros, pessoas físicas, cartão de crédito rotativo (
            {reference ? (
              <a href={reference.sourceUrl} target="_blank" rel="noopener noreferrer">
                série SGS {reference.seriesCode}
              </a>
            ) : (
              "série SGS 25477"
            )}
            ){reference ? `, referência de ${reference.refMonthLabel}` : ", referência temporariamente indisponível"}; e{" "}
            <a href={BC_RATES_PAGE} target="_blank" rel="noopener noreferrer">
              taxas de juros por instituição
            </a>
            .
          </li>
        </ul>
        <p>
          Conteúdo e ferramenta da Equipe Editorial do Crédito por Perto, que não concede crédito, não emite
          cartão, não negocia dívidas e não recebe por nenhuma contratação. Encontrou algo errado? Veja a{" "}
          <Link href="/politica-de-correcoes/">política de correções</Link>. Metodologia revisada em {REVIEWED}.
        </p>
      </section>
    </div>
  );
}
