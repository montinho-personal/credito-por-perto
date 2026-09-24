import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { webPageJsonLd } from "@/lib/schema/jsonld";
import { JsonLd } from "@/components/seo/JsonLd";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ProposalComparator } from "@/components/calculators/ProposalComparator";
import { ToolNextSteps } from "@/components/journeys/ToolNextSteps";
import { CET_RULES } from "@/lib/calculators/cet";

/**
 * INTENÇÃO: a pessoa JÁ RECEBEU duas ou três propostas e quer saber qual custa
 * menos. Não é marketplace ("comparador de empréstimos" que busca ofertas com
 * CPF) nem simulador de parcela (/calculadoras/emprestimo/). O método de
 * comparar, em texto, é do artigo /organizacao-financeira/como-comparar-
 * propostas-de-credito/; esta página executa a comparação e tira as dúvidas
 * de quem está com as propostas na mão. Ver data/query-ownership-map.json.
 */
export const metadata: Metadata = buildMetadata({
  title: "Comparar propostas de empréstimo: CET e total pago",
  description:
    "Já recebeu duas ou três propostas? Compare lado a lado parcela, prazo, CET, valor liberado e total pago. Grátis, sem CPF e sem buscar ofertas.",
  path: "/calculadoras/comparador-de-propostas/",
});

const PAGE_TITLE = "Compare as propostas de empréstimo que você já recebeu";
const PAGE_DESCRIPTION =
  "Coloque até 3 propostas lado a lado e veja parcela, prazo, CET, valor liberado e total pago antes de assinar. Sem cadastro, sem CPF e sem indicar banco.";

export default function ComparadorDePropostasPage() {
  return (
    <div
      data-track-area="ferramenta"
      data-track="comparador-de-propostas"
      className="mx-auto max-w-4xl px-4 py-8">
      <JsonLd
        data={webPageJsonLd(
          PAGE_TITLE,
          PAGE_DESCRIPTION,
          "/calculadoras/comparador-de-propostas/",
        )}
      />
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: "Calculadoras", path: "/calculadoras/" },
          { name: "Comparador de propostas", path: "/calculadoras/comparador-de-propostas/" },
        ]}
      />

      <header className="mt-6">
        <h1 className="font-serif text-3xl font-bold leading-tight text-brand-navy md:text-4xl">
          {PAGE_TITLE}
        </h1>
        <p className="mt-3 text-lg leading-relaxed text-brand-muted">
          Tem duas propostas e quer saber qual custa menos de verdade? Coloque lado a lado até 3 propostas
          que você já recebeu, de bancos diferentes ou não, e veja parcela, prazo, CET, valor liberado e
          total pago antes de assinar. <strong>Parcela menor não significa empréstimo mais barato.</strong>{" "}
          Sem cadastro, sem CPF e sem informar o banco: aqui não buscamos ofertas, só colocamos os seus
          números na mesma mesa.
        </p>
      </header>

      <div className="mt-8">
        <ProposalComparator />
      </div>

      {/* Conteúdo editorial indexável */}
      <ToolNextSteps toolId="comparador-de-propostas" />

      <section aria-labelledby="como-comparar" className="article-body mt-12">
        <h2 id="como-comparar">Como comparar duas propostas de empréstimo aqui?</h2>
        <p>
          Com as propostas na mão, localize quatro números em cada uma: o <strong>valor líquido que cai na
          conta</strong>, o <strong>número de parcelas</strong>, o <strong>valor de cada parcela</strong> e o{" "}
          <strong>CET anual</strong>. Digite-os acima. A ferramenta mostra o total pago, o custo em reais e
          onde exatamente as propostas diferem. Use o valor que cai na conta, não o valor solicitado: IOF,
          tarifa ou seguro descontados na liberação fazem duas propostas de &ldquo;R$ 10 mil&rdquo; entregarem
          valores diferentes. Se ainda está juntando propostas, o passo a passo para pedir os números certos
          está no guia{" "}
          <Link href="/organizacao-financeira/como-comparar-propostas-de-credito/">
            como comparar propostas de crédito
          </Link>
          .
        </p>

        <h2 id="parcela-menor">Parcela menor ou custo menor: por que a menor parcela pode custar mais?</h2>
        <p>
          Porque distribuir a dívida por mais meses reduz o valor mensal e costuma aumentar o total
          desembolsado: os juros correm por mais tempo. &ldquo;Uma tem parcela menor, mas prazo maior&rdquo;
          é a situação mais comum, e não há resposta universal: depende dos termos de cada proposta. O
          comparador coloca esse trade-off em uma frase: quanto a parcela cai, quantos meses a mais a dívida
          dura e quanto isso custa no final.
        </p>

        <h2 id="o-que-e-cet">O que é CET e onde encontrar na proposta?</h2>
        <p>
          O <strong>Custo Efetivo Total</strong> é a taxa anual que resume o custo completo do empréstimo:
          juros, tarifas, tributos como o IOF, seguros e demais encargos. Pela Resolução CMN nº 4.881/2020, a
          instituição informa o CET antes da contratação e apresenta o demonstrativo, com o valor de cada
          componente. Procure-o na proposta, na simulação formal ou nesse demonstrativo, e peça por escrito
          se não estiver lá. O conceito completo está em{" "}
          <Link href="/juros-e-cet/o-que-e-cet/">o que é CET</Link>.
        </p>

        <h2 id="cet-ou-juros">CET ou taxa de juros: qual comparar?</h2>
        <p>
          O CET. Menor taxa de juros não significa necessariamente empréstimo mais barato: uma proposta com
          juros menores e seguro ou tarifa embutidos pode ter CET maior, e duas propostas com juros
          diferentes podem chegar a CETs parecidos. É por isso que a proposta &ldquo;com juros menores&rdquo;
          às vezes sai mais cara. Mesmo assim, o CET não decide sozinho: prazo, valor da parcela e o que cabe
          no seu orçamento também contam, e o comparador mostra tudo junto. Cuidado com unidades: 3% ao mês
          não é 36% ao ano, e a conversão composta está em{" "}
          <Link href="/juros-e-cet/taxa-mensal-e-taxa-anual/">taxa mensal e taxa anual</Link>.
        </p>

        <h2 id="total-pago">Como calcular o total pago e o custo do empréstimo em reais?</h2>
        <p>
          Multiplique o valor da parcela pelo número de parcelas e some os custos pagos fora delas, se
          houver: esse é o total pago. A diferença entre o total pago e o valor que caiu na sua conta é o
          custo do empréstimo em reais, a resposta mais direta para &ldquo;qual vou pagar menos no
          final?&rdquo;. Essa conta não substitui o CET oficial: ela mostra, em dinheiro, o que sai do seu
          bolso com os valores informados.
        </p>

        <h2 id="sem-cet">O banco não informou o CET. E agora?</h2>
        <p>
          Marque &ldquo;não sei&rdquo; e compare mesmo assim: parcela, prazo, valor liberado e total pago já
          revelam muito. Antes de assinar, peça o CET por escrito, porque a informação é obrigatória antes
          da contratação. Se você tem o valor recebido, as parcelas e os custos, a{" "}
          <Link href="/calculadoras/cet/">calculadora de CET</Link> estima a taxa a partir desse fluxo.
        </p>

        <h2 id="prazos-diferentes">Posso comparar empréstimos com prazos diferentes ou de bancos diferentes?</h2>
        <p>
          Pode, e é aí que o comparador mais ajuda. Com prazos diferentes, olhe dois números: o CET, que é
          uma taxa anual e por isso já leva o tempo em conta, e o total pago, que soma mais parcelas quando
          o prazo é maior. A proposta mais longa costuma ter parcela menor e total maior. Bancos diferentes
          não mudam nada: a ferramenta compara números, não instituições. Só evite comparar pelo total
          quando os <strong>valores recebidos</strong> são diferentes: nesse caso a ferramenta avisa e reduz
          as conclusões, porque as propostas não são equivalentes.
        </p>

        <h2 id="antes-de-assinar">Qual proposta escolher? O que verificar antes de assinar</h2>
        <p>
          A ferramenta mostra qual proposta tem o menor custo nos critérios que você informou. Isso não é o
          mesmo que dizer qual é a melhor para você: a proposta mais barata no total pode ter uma parcela que
          não cabe no mês. Antes de decidir, veja{" "}
          <Link href="/calculadoras/parcela-no-orcamento/">se a parcela cabe no seu orçamento</Link> e confira:
        </p>
        <ul>
          <li>Confirme o CET e o valor total a pagar por escrito;</li>
          <li>Verifique tarifas e seguros embutidos — <Link href="/juros-e-cet/seguro-prestamista/">seguro é facultativo</Link>, e venda casada é vedada;</li>
          <li>Confira o número e o valor das parcelas no contrato, não no anúncio;</li>
          <li>Pergunte o que acontece em caso de atraso;</li>
          <li>Lembre que <Link href="/juros-e-cet/quitacao-antecipada-de-emprestimo/">antecipar parcelas reduz juros por direito</Link>, sem tarifa nos contratos atuais;</li>
          <li>
            Confirme que está tratando com{" "}
            <Link href="/credito-seguro/como-consultar-se-instituicao-e-autorizada/">
              instituição autorizada pelo Banco Central
            </Link>{" "}
            — e nunca pague nada antes de o dinheiro ser liberado.
          </li>
        </ul>

        <h2 id="metodologia">Como calculamos</h2>
        <p>
          As fórmulas são simples e ficam à vista:
        </p>
        <p>
          <code>total pago = parcelas × valor da parcela + custos fora das parcelas</code>
          <br />
          <code>custo em reais = total pago − valor líquido recebido</code>
        </p>
        <p>
          Diferenças de CET são apresentadas em <strong>pontos percentuais</strong> (28% → 32% é uma
          diferença de 4 pontos percentuais, não &ldquo;4% maior&rdquo;). Quando você informa uma taxa
          mensal, mostramos a equivalente anual efetiva composta — <code>(1 + mensal)¹² − 1</code> — que
          não é a mesma coisa que o CET. O CET exibido é sempre o <strong>informado pela
          instituição</strong>: não recalculamos nem estimamos CET, porque uma parcela pode embutir IOF,
          seguros, tarifas e fluxos que uma estimativa simplificada não captura. Todo o cálculo acontece no
          seu navegador, em centavos inteiros (sem erros de arredondamento binário), e nada é enviado ou
          armazenado.
        </p>
        <p>
          Conceitos e obrigações citados seguem fontes oficiais: a regulamentação do CET (
          <a href={CET_RULES.resolution.url} rel="noopener noreferrer" target="_blank">
            {CET_RULES.resolution.title}
          </a>
          , verificada em {CET_RULES.verifiedAt}), o direito à liquidação antecipada com redução proporcional dos juros do{" "}
          <a
            href="https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm"
            rel="noopener noreferrer"
            target="_blank"
          >
            Código de Defesa do Consumidor (art. 52)
          </a>{" "}
          e a vedação de tarifa por quitação antecipada da Resolução CMN nº 3.516/2007. Última revisão da
          metodologia: 27/08/2026; textos revisados em 24/09/2026.
        </p>

        <h2 id="proximos-passos">Talvez você também precise</h2>
        <ul>
          <li>
            <Link href="/calculadoras/emprestimo/">Calculadora de empréstimo</Link> — ainda não tem proposta?
            Estime a parcela a partir de valor, taxa e prazo;
          </li>
          <li>
            <Link href="/calculadoras/minha-taxa-esta-cara/">Minha taxa está cara?</Link> — coloque
            a taxa da proposta em contexto, comparando com a média oficial do Banco Central;
          </li>
          <li>
            <Link href="/juros-e-cet/como-consultar-taxa-media-do-bc/">
              Consultar a taxa média do Banco Central
            </Link>{" "}
            — veja se a proposta está dentro do mercado;
          </li>
          <li>
            <Link href="/emprestimos/portabilidade-de-credito/">Portabilidade de crédito</Link> — para o
            contrato caro que você já assinou;
          </li>
          <li>
            <Link href="/calculadoras/margem-consignavel/">Calculadora de margem consignável</Link> — para
            propostas de consignado.
          </li>
        </ul>
      </section>
    </div>
  );
}
