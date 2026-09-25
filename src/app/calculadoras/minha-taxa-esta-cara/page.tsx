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
  title: "Minha taxa está cara? Compare à média do Banco Central",
  description:
    "Recebeu uma proposta? Informe a taxa de juros e a modalidade e compare com a média oficial do Banco Central: abaixo, próxima ou acima. Sem cadastro.",
  path: "/calculadoras/minha-taxa-esta-cara/",
});

export default async function MinhaTaxaEstaCaraPage() {
  const rates = await getBcbRates();
  const sample = rates.series.find((s) => s.internalId === "pessoal-nao-consignado");

  return (
    <div
      data-track-area="ferramenta"
      data-track="minha-taxa-esta-cara"
      className="mx-auto max-w-4xl px-4 py-8">
      <JsonLd
        data={webPageJsonLd(
          "Minha taxa está cara?",
          "Informe a taxa de juros da sua proposta e a modalidade de crédito e veja se ela está abaixo, próxima ou acima da média oficial do Banco Central para o mesmo tipo de crédito.",
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
          Recebeu uma proposta de crédito e não sabe se a taxa está alta? &ldquo;4% ao mês é
          muito?&rdquo; Sozinho, esse número diz pouco. Informe a taxa de juros, escolha a
          modalidade e compare com a <strong>média oficial do Banco Central</strong> para o mesmo
          tipo de crédito. Sem cadastro e sem indicar banco.
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
          pelo valor concedido. É essa média que a ferramenta usa: você informa a taxa de juros da
          proposta, escolhe a modalidade equivalente e vê três números lado a lado: a sua taxa, a
          média de referência e a diferença entre elas, em pontos percentuais e em percentual.
        </p>

        <h2 id="depende-da-modalidade">2%, 3%, 4% ou 5% ao mês é muito? Depende da modalidade</h2>
        <p>
          Um percentual sozinho não é alto nem baixo. A mesma taxa pode ficar abaixo da média em
          uma modalidade e bem acima em outra, porque cada tipo de crédito tem risco e garantia
          diferentes: no consignado a parcela sai direto do salário ou do benefício, no cheque
          especial não há garantia nenhuma. Por isso não existe uma &ldquo;taxa normal&rdquo; ou
          uma &ldquo;taxa boa&rdquo; que valha para todo crédito. Compare sempre com a média da{" "}
          <strong>mesma modalidade</strong>: empréstimo pessoal com empréstimo pessoal,
          financiamento de veículo com financiamento de veículo.
        </p>

        <h2 id="media-bc">O que é a taxa média do Banco Central?</h2>
        <p>
          É uma estatística oficial: a média das taxas efetivamente contratadas pelos clientes de
          todas as instituições, em cada modalidade, no mês de referência. Não é tabela de preços nem
          promessa. Os dados vêm do SGS, o Sistema Gerenciador de Séries Temporais do BC, e cada
          resultado desta página mostra a série exata usada, com link para a fonte. Outras
          &ldquo;médias&rdquo; que circulam na internet podem ser calculadas de outro jeito; aqui a
          referência é sempre a série oficial, com nome e mês à vista. Quem quiser ver a média{" "}
          <em>por banco</em> encontra o caminho em{" "}
          <Link href="/juros-e-cet/como-consultar-taxa-media-do-bc/">
            como consultar a taxa média no BC
          </Link>
          . Para acompanhar se os juros do mercado estão subindo ou caindo, o{" "}
          <Link href="/taxas/">Radar de taxas de crédito</Link> mostra a evolução de cada
          modalidade.
        </p>

        <h2 id="diferente-da-media">Por que minha taxa veio acima da média?</h2>
        <p>
          Porque a média agrega perfis muito diferentes. O próprio Banco Central informa que as taxas
          variam conforme a situação cadastral do cliente, as garantias oferecidas e as
          características de cada operação. Por isso duas pessoas podem receber taxas diferentes na
          mesma modalidade, mesmo com score parecido. A ferramenta não conhece seu histórico, o
          prazo nem a política da instituição, e não tenta explicar o seu caso. Ela mostra onde o
          número está em relação à média; o motivo da diferença só a instituição pode detalhar.
        </p>

        <h2 id="media-nao-e-limite">A média do Banco Central é o limite que o banco pode cobrar?</h2>
        <p>
          Não. <strong>Média não é teto, não é preço obrigatório e não é conceito jurídico.</strong>{" "}
          Ela resume operações contratadas a taxas diferentes, umas acima e outras abaixo dela.
          Estar acima da média não é, por si só, sinal de erro na proposta.
        </p>

        <h2 id="acima-da-media">Taxa acima da média significa juros abusivos?</h2>
        <p>
          Não necessariamente. Uma diferença em relação à média do Banco Central, sozinha, não
          determina juridicamente que uma taxa seja abusiva, e por isso esta ferramenta nunca usa
          palavras como &ldquo;abusiva&rdquo; ou &ldquo;ilegal&rdquo;. Uma conclusão desse tipo
          depende da análise do contrato, da época em que foi assinado e dos critérios aplicados
          pela Justiça. O que os tribunais consideram, e como a média entra nessa discussão, está
          no guia{" "}
          <Link href="/juros-e-cet/juros-abusivos-como-saber/">juros abusivos: como saber</Link>.
        </p>

        <h2 id="contrato-assinado">Serve para um contrato que já assinei?</h2>
        <p>
          Serve para saber como a sua taxa se posiciona em relação à média <em>mais recente</em>{" "}
          da modalidade. A ferramenta não refaz a comparação para o mês em que um contrato antigo
          foi assinado: o resultado mostra o histórico dos últimos meses, mas a diferença é
          calculada sempre sobre o dado mais recente. Para proposta nova, essa é a comparação que
          interessa; para contrato antigo, o guia de juros abusivos explica por que a data da
          contratação importa.
        </p>

        <h2 id="juros-ou-cet">Taxa de juros e CET são iguais?</h2>
        <p>
          Não. A taxa de juros remunera o dinheiro emprestado; o{" "}
          <Link href="/juros-e-cet/o-que-e-cet/">CET</Link> soma juros, tarifas, tributos e seguros.
          As séries usadas aqui são de <em>taxa de juros</em>, por isso a ferramenta pergunta qual
          número você tem e não compara CET com essa referência. Na proposta ou no contrato, procure
          a linha &ldquo;taxa de juros&rdquo;, mensal ou anual. Para descobrir o custo efetivo da
          operação a partir das parcelas e tarifas, use a{" "}
          <Link href="/calculadoras/cet/">calculadora de CET</Link>.
        </p>

        <h2 id="conversao">Posso comparar taxa anual com taxa mensal?</h2>
        <p>
          Pode, desde que a conversão seja feita com juros compostos. Se sua proposta mostra a taxa
          ao ano, marque &ldquo;% a.a.&rdquo; e a ferramenta converte para a taxa mensal
          equivalente antes de comparar. Nunca divida por 12: a taxa anual equivalente é sempre
          maior que 12 vezes a mensal. Para converter qualquer taxa sem comparar, use o{" "}
          <Link href="/calculadoras/conversor-de-taxas/">conversor de taxa mensal para anual</Link>
          ; a explicação está em{" "}
          <Link href="/juros-e-cet/taxa-mensal-e-taxa-anual/">taxa mensal × taxa anual</Link>.
        </p>

        <h2 id="negociar">O que posso fazer se minha taxa estiver acima da média?</h2>
        <ul>
          <li>Peça propostas em 2 ou 3 instituições, por escrito e com CET;</li>
          <li>
            Coloque-as lado a lado no{" "}
            <Link href="/calculadoras/comparador-de-propostas/">
              comparador de propostas de empréstimo
            </Link>
            : parcela menor nem sempre é crédito mais barato;
          </li>
          <li>
            Leve a média oficial para a conversa com a instituição: é um dado público, com fonte e
            mês de referência;
          </li>
          <li>
            Para contrato já assinado, conheça a{" "}
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
          inventar número. Modalidades só entram quando a série oficial correspondente é confirmada.
          O cartão de crédito <em>rotativo</em> não está entre as opções desta ferramenta: a média
          oficial do rotativo aparece na{" "}
          <Link href="/calculadoras/juros-cartao-credito/">calculadora de juros do cartão</Link>.
          Última revisão da metodologia: 27/08/2026; textos revistos em 24/09/2026.
        </p>
      </section>
    </div>
  );
}
