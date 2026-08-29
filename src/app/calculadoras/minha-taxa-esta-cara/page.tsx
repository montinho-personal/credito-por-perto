import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { webPageJsonLd } from "@/lib/schema/jsonld";
import { JsonLd } from "@/components/seo/JsonLd";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { RateChecker } from "@/components/calculators/RateChecker";
import { getBcbRates, formatRefMonth } from "@/lib/bcb/rates-service";
import {
  CLASSIFICATION_THRESHOLDS,
} from "@/lib/calculators/rate-comparison";
import { ToolNextSteps } from "@/components/journeys/ToolNextSteps";

/** Revalidação diária: as séries do BC são mensais. */
export const revalidate = 86400;

export const metadata: Metadata = buildMetadata({
  title: "Minha taxa está cara? Compare com a média do Banco Central",
  description:
    "Informe a taxa do seu empréstimo e veja como ela se compara à média oficial do Banco Central para a mesma modalidade. Grátis, sem cadastro e sem indicar banco.",
  path: "/calculadoras/minha-taxa-esta-cara/",
});

export default async function MinhaTaxaEstaCaraPage() {
  const rates = await getBcbRates();
  const sample = rates.series.find((s) => s.internalId === "pessoal-nao-consignado");

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <JsonLd
        data={webPageJsonLd(
          "Minha taxa está cara?",
          "Compare a taxa da sua proposta com a referência oficial do Banco Central para a mesma modalidade de crédito.",
          "/calculadoras/minha-taxa-esta-cara/",
        )}
      />
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: "Calculadoras", path: "/calculadoras/" },
          { name: "Minha taxa está cara?", path: "/calculadoras/minha-taxa-esta-cara/" },
        ]}
      />

      <header className="mt-6">
        <h1 className="font-serif text-3xl font-bold leading-tight text-brand-navy md:text-4xl">
          Minha taxa está cara?
        </h1>
        <p className="mt-3 text-lg leading-relaxed text-brand-muted">
          &ldquo;4% ao mês é muito?&rdquo; Sozinho, esse número diz pouco. Informe a taxa da sua
          proposta e compare com a <strong>média oficial do Banco Central</strong> para a mesma
          modalidade de crédito. Grátis, sem cadastro e sem indicar banco.
        </p>
        {sample ? (
          <p className="mt-2 text-sm text-brand-muted">
            Referência mais recente disponível: {formatRefMonth(sample.latest.refMonth)}.
          </p>
        ) : null}
      </header>

      <div className="mt-8">
        <RateChecker rates={rates} />
      </div>

      <ToolNextSteps toolId="minha-taxa-esta-cara" />


      <section aria-labelledby="perguntas-taxa" className="article-body mt-12">
        <h2 id="perguntas-taxa">Como saber se minha taxa está alta?</h2>
        <p>
          Comparando com a referência certa. O Banco Central publica, todo mês, a{" "}
          <strong>taxa média das novas operações</strong> de cada modalidade de crédito, ponderada
          pelo valor concedido. É essa média que a ferramenta usa: você informa sua taxa, escolhe a
          modalidade equivalente e vê a diferença em pontos percentuais. A evolução dessas
          médias, com histórico e variação mês a mês, está no{" "}
          <Link href="/taxas/">Radar de taxas de crédito</Link>. Uma taxa só começa a fazer
          sentido quando você sabe com o que está comparando.
        </p>

        <h2 id="media-bc">O que é a taxa média do Banco Central?</h2>
        <p>
          É uma estatística oficial: a média das taxas efetivamente contratadas pelos clientes de
          todas as instituições, em cada modalidade, no mês de referência. Não é tabela de preços nem
          promessa. Os dados vêm do SGS, o Sistema Gerenciador de Séries Temporais do BC, e cada
          resultado desta página mostra a série exata usada, com link para a fonte. Quem quiser ver a
          média <em>por banco</em> encontra o caminho em{" "}
          <Link href="/juros-e-cet/como-consultar-taxa-media-do-bc/">
            como consultar a taxa média no BC
          </Link>
          .
        </p>

        <h2 id="diferente-da-media">Por que minha taxa pode ser diferente da média?</h2>
        <p>
          Porque a média agrega perfis muito diferentes. O próprio Banco Central informa que as taxas
          variam conforme a situação cadastral do cliente, as garantias oferecidas e as
          características de cada operação. Sua taxa pode estar acima da média e ainda refletir
          condições específicas da sua operação — e pode estar abaixo por relacionamento, garantia ou
          convênio.
        </p>

        <h2 id="media-nao-e-limite">Média significa limite?</h2>
        <p>
          Não. <strong>Média não é teto, não é preço obrigatório e não é conceito jurídico.</strong>{" "}
          Estar acima da média não significa automaticamente cobrança ilegal — e é por isso que esta
          ferramenta nunca usa palavras como &ldquo;abusiva&rdquo;. O que a Justiça considera, e por
          que a média entra como referência nessa discussão, está no guia{" "}
          <Link href="/juros-e-cet/juros-abusivos-como-saber/">juros abusivos: como saber</Link>.
        </p>

        <h2 id="juros-ou-cet">Taxa de juros e CET são iguais?</h2>
        <p>
          Não. A taxa de juros remunera o dinheiro emprestado; o{" "}
          <Link href="/juros-e-cet/o-que-e-cet/">CET</Link> soma juros, tarifas, tributos e seguros.
          As séries usadas aqui são de <em>taxa de juros</em> — por isso a ferramenta pergunta qual
          número você tem e não compara CET com essa referência.
        </p>

        <h2 id="conversao">Como converter juros mensais em anuais?</h2>
        <p>
          Com juros compostos: <code>anual = (1 + mensal)¹² − 1</code>. Nunca multiplicando por 12 —
          3% ao mês equivale a 42,58% ao ano, não a 36%. A conversão inversa usa{" "}
          <code>mensal = (1 + anual)^(1/12) − 1</code>. A explicação completa está em{" "}
          <Link href="/juros-e-cet/taxa-mensal-e-taxa-anual/">taxa mensal × taxa anual</Link>.
        </p>

        <h2 id="acima-da-media">Estar acima da média significa juros abusivos?</h2>
        <p>
          Uma diferença em relação à média do Banco Central, sozinha, não determina juridicamente que
          uma taxa seja abusiva. A média serve como referência — não como sentença. Diferenças
          grandes são um bom motivo para cotar em outras instituições e entender o que explica o
          número, não uma conclusão pronta.
        </p>

        <h2 id="negociar">O que posso fazer se minha taxa estiver acima da média?</h2>
        <ul>
          <li>Peça propostas em 2 ou 3 instituições, por escrito e com CET;</li>
          <li>
            Coloque-as lado a lado no{" "}
            <Link href="/calculadoras/comparador-de-propostas/">Comparador de Propostas</Link> —
            parcela menor nem sempre é crédito mais barato;
          </li>
          <li>
            Use a média oficial como argumento na negociação: dado do BC na mesa muda conversas;
          </li>
          <li>
            Para contrato já assinado, avalie a{" "}
            <Link href="/emprestimos/portabilidade-de-credito/">portabilidade de crédito</Link>.
          </li>
        </ul>

        <h2 id="metodologia">Como fazemos a comparação?</h2>
        <p>
          O Crédito por Perto compara a taxa que você informa com a taxa média oficial publicada pelo
          Banco Central para novas operações da modalidade selecionada, no período mais recente
          disponível. Em detalhe:
        </p>
        <ol>
          <li>Você informa sua taxa e a periodicidade (% a.m. ou % a.a.);</li>
          <li>
            Identificamos a série oficial correspondente à modalidade (todas da família &ldquo;taxa
            média mensal de juros — recursos livres — pessoas físicas&rdquo;, em % a.m.);
          </li>
          <li>
            Se a sua taxa for anual, convertemos para a equivalente mensal composta antes de
            comparar — nunca dividimos por 12;
          </li>
          <li>
            Calculamos a diferença em pontos percentuais (<code>sua taxa − referência</code>) e a
            diferença relativa (<code>(sua taxa ÷ referência − 1) × 100</code>);
          </li>
          <li>
            Rotulamos o resultado com uma classificação <strong>editorial</strong>, apenas para
            facilitar a leitura: &ldquo;próxima&rdquo; quando a diferença relativa fica dentro de ±
            {CLASSIFICATION_THRESHOLDS.nearBandRelativePct}%, e &ldquo;diferença
            significativa&rdquo; quando a taxa passa do dobro da referência (+
            {CLASSIFICATION_THRESHOLDS.farAboveRelativePct}%). Esses limites não têm valor legal —
            são uma régua de leitura, declarada aqui;
          </li>
          <li>
            Mostramos o mês de referência do dado, a data da consulta, o nome oficial da série e o
            link para a fonte no Banco Central.
          </li>
        </ol>
        <p>
          Os dados são buscados automaticamente da API oficial do BC e revalidados todos os dias no
          servidor. Se a API estiver indisponível, mantemos o último dado oficial validado (sempre
          com o mês de referência à vista) — e, sem nenhum dado válido, a ferramenta avisa em vez de
          inventar número. Modalidades só entram quando a série oficial correspondente é confirmada:
          o cartão de crédito <em>rotativo</em>, por exemplo, ficou fora desta versão porque só
          confirmamos a série anual, e não misturamos unidades. Última revisão da metodologia:
          27/08/2026.
        </p>
      </section>
    </div>
  );
}
