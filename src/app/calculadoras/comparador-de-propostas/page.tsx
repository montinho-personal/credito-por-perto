import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { webPageJsonLd } from "@/lib/schema/jsonld";
import { JsonLd } from "@/components/seo/JsonLd";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ProposalComparator } from "@/components/calculators/ProposalComparator";
import { ToolNextSteps } from "@/components/journeys/ToolNextSteps";

export const metadata: Metadata = buildMetadata({
  title: "Comparador de propostas de crédito: parcela, prazo, CET e total",
  description:
    "Compare gratuitamente até 3 propostas de crédito lado a lado: parcela, prazo, CET e total pago. Sem cadastro, sem informar banco e sem indicação de contratação.",
  path: "/calculadoras/comparador-de-propostas/",
});

const PAGE_TITLE = "Compare propostas de crédito lado a lado";
const PAGE_DESCRIPTION =
  "Veja parcela, prazo, CET e valor total antes de decidir — sem cadastro e sem indicar banco.";

export default function ComparadorDePropostasPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
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
          Qual proposta custa menos de verdade? <strong>Parcela menor não significa crédito mais
          barato.</strong> Coloque até 3 propostas na mesma mesa e veja parcela, prazo, CET e total pago —
          sem cadastro, sem informar o banco e sem ninguém decidindo por você.
        </p>
      </header>

      <div className="mt-8">
        <ProposalComparator />
      </div>

      {/* Conteúdo editorial indexável */}
      <ToolNextSteps toolId="comparador-de-propostas" />

      <section aria-labelledby="como-comparar" className="article-body mt-12">
        <h2 id="como-comparar">Como comparar duas propostas de crédito?</h2>
        <p>
          Pegue as duas propostas e localize quatro números em cada uma: o <strong>valor líquido que cai
          na conta</strong>, o <strong>número de parcelas</strong>, o <strong>valor de cada parcela</strong>{" "}
          e o <strong>CET anual</strong>. Digite-os acima. A ferramenta mostra o total pago, o custo em
          reais e onde exatamente as propostas diferem. O método completo, com os cinco números que
          importam, está em{" "}
          <Link href="/organizacao-financeira/como-comparar-propostas-de-credito/">
            como comparar propostas de crédito
          </Link>
          .
        </p>

        <h2 id="parcela-menor">Por que a menor parcela pode custar mais?</h2>
        <p>
          Porque distribuir a dívida por mais meses pode reduzir o valor mensal enquanto aumenta o total
          desembolsado: os juros correm por mais tempo. Não é uma regra universal — depende dos termos de
          cada proposta. É exatamente esse trade-off que o comparador coloca em uma frase: quanto a parcela
          cai, quantos meses a mais a dívida dura e quanto isso custa ao final.
        </p>

        <h2 id="o-que-e-cet">O que é CET?</h2>
        <p>
          O <strong>Custo Efetivo Total</strong> é a taxa que resume o custo completo da operação: juros,
          tarifas, tributos, seguros e demais encargos. As instituições são obrigadas a informá-lo antes da
          contratação. <strong>Juros ≠ CET</strong>: duas propostas com a mesma taxa de juros podem ter
          CETs bem diferentes. O guia completo está em{" "}
          <Link href="/juros-e-cet/o-que-e-cet/">o que é CET</Link>.
        </p>

        <h2 id="cet-ou-juros">CET ou taxa de juros: qual comparar?</h2>
        <p>
          Entre propostas comparáveis, o CET ajuda a mostrar qual possui menor custo efetivo — é ele que
          captura tarifas e seguros embutidos que a taxa de juros esconde. Mas prazo, valor da parcela e
          adequação ao seu orçamento também importam. Por isso o comparador nunca reduz a resposta a um
          número só. E cuidado com unidades: 3% ao mês não é 36% ao ano — a conversão composta está em{" "}
          <Link href="/juros-e-cet/taxa-mensal-e-taxa-anual/">taxa mensal × taxa anual</Link>.
        </p>

        <h2 id="total-pago">Como calcular o valor total de um empréstimo?</h2>
        <p>
          Multiplique o valor da parcela pelo número de parcelas e some custos pagos fora delas, se
          houver. A diferença entre esse total e o valor que você recebe é o custo do crédito em reais.
          Essa conta não substitui o CET oficial — ela mostra, em dinheiro, o que sai do seu bolso com base
          nos valores informados.
        </p>

        <h2 id="sem-cet">O que fazer se a proposta não informar CET?</h2>
        <p>
          Marque &ldquo;não sei&rdquo; e compare mesmo assim — parcela, prazo e total pago já revelam
          muito. Mas procure o CET na proposta ou peça à instituição antes de assinar: sem ele, a
          comparação do custo efetivo fica incompleta, e a informação é obrigatória.
        </p>

        <h2 id="prazos-diferentes">Posso comparar empréstimos de prazos diferentes?</h2>
        <p>
          Pode — e é aí que o comparador mais ajuda, porque mostra o trade-off: a proposta de prazo maior
          costuma ter parcela menor e total maior. Só evite comparar pelo total quando os{" "}
          <strong>valores recebidos</strong> são diferentes: nesse caso a ferramenta avisa e reduz as
          conclusões, porque as propostas não são equivalentes.
        </p>

        <h2 id="antes-de-assinar">O que verificar antes de assinar?</h2>
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
          Conceitos e obrigações citados seguem fontes oficiais: a regulamentação do CET do{" "}
          <a href="https://www.bcb.gov.br" rel="noopener noreferrer" target="_blank">
            Banco Central do Brasil
          </a>
          , o direito à liquidação antecipada com redução proporcional dos juros do{" "}
          <a
            href="https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm"
            rel="noopener noreferrer"
            target="_blank"
          >
            Código de Defesa do Consumidor (art. 52)
          </a>{" "}
          e a vedação de tarifa por quitação antecipada da Resolução CMN nº 3.516/2007. Última revisão da
          metodologia: 27/08/2026.
        </p>

        <h2 id="proximos-passos">Talvez você também precise</h2>
        <ul>
          <li>
            <Link href="/calculadoras/emprestimo/">Calculadora de empréstimo</Link> — estime a parcela a
            partir de valor, taxa e prazo;
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
