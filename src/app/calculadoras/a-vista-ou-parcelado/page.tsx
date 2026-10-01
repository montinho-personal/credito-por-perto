import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { webPageJsonLd } from "@/lib/schema/jsonld";
import { JsonLd } from "@/components/seo/JsonLd";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { CashVsInstallmentsCalculator } from "@/components/calculators/CashVsInstallmentsCalculator";
import { presentValueOfInstallments } from "@/lib/calculators/cash-vs-installments";
import { formatPercentBR } from "@/lib/calculators/proposal-comparison";

const DESCRIPTION =
  "Compare à vista e parcelado pelo total e veja, com a taxa que você escolher, o desconto à vista que empata as duas opções. Sem cadastro.";

export const metadata: Metadata = buildMetadata({
  title: "À vista ou parcelado? Calculadora do desconto mínimo",
  description:
    "Compare à vista e parcelado pelo total e veja, com a taxa que você escolher, o desconto à vista que empata as duas opções. Sem cadastro.",
  path: "/calculadoras/a-vista-ou-parcelado/",
});

/*
 * Tabela ilustrativa do desconto de equilíbrio, calculada pelo mesmo motor
 * da ferramenta: parcelas iguais sem acréscimo, primeira em 30 dias.
 * As taxas são hipotéticas e aparecem rotuladas assim na página.
 */
const EXAMPLE_RATES = [0.005, 0.01] as const;
const EXAMPLE_COUNTS = [1, 3, 6, 10, 12] as const;
const breakEvenDiscount = (count: number, monthlyRate: number) =>
  (1 - presentValueOfInstallments(1, count, monthlyRate, "em-um-mes") / count) * 100;

export default function AVistaOuParceladoPage() {
  return (
    <div
      data-track-area="ferramenta"
      data-track="a-vista-ou-parcelado"
      className="mx-auto max-w-5xl px-4 py-8">
      <JsonLd
        data={webPageJsonLd(
          "À vista ou parcelado? Calculadora do desconto mínimo",
          DESCRIPTION,
          "/calculadoras/a-vista-ou-parcelado/",
        )}
      />
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: "Calculadoras", path: "/calculadoras/" },
          { name: "À vista ou parcelado", path: "/calculadoras/a-vista-ou-parcelado/" },
        ]}
      />

      <header className="mt-6">
        <h1 className="font-serif text-3xl font-bold leading-tight text-brand-navy md:text-4xl">
          À vista ou parcelado?
        </h1>
        <p className="mt-3 text-lg leading-relaxed text-brand-muted">
          Compare o preço à vista com as parcelas e veja quanto cada opção custa até o fim. Com
          uma taxa de rendimento que você escolher, a ferramenta também mostra{" "}
          <strong>o desconto à vista que empata as duas opções</strong>. Qual opção custa menos e
          qual preserva mais caixa agora são perguntas diferentes, e a conta mostra as duas.
        </p>
      </header>

      <div className="mt-8">
        <CashVsInstallmentsCalculator />
      </div>

      <section aria-labelledby="perguntas-avista" className="article-body mt-12">
        <h2 id="perguntas-avista">Como calcular o custo do parcelamento?</h2>
        <p>
          <strong>Total parcelado = entrada + (parcelas × valor da parcela) + custos
          obrigatórios da opção.</strong> Depois, compare com o preço à vista: a diferença é
          quanto o parcelamento acrescenta. Um exemplo: R$ 4.500 à vista contra 12 × R$ 425
          dá R$ 5.100 — <strong>R$ 600 a mais</strong>, ou 13,33% sobre o preço à vista.
        </p>

        <h2 id="desconto-minimo">Qual é o desconto mínimo para pagar à vista?</h2>
        <p>
          Depende de três coisas: <strong>quantas parcelas</strong>, <strong>quando vence a
          primeira</strong> e <strong>quanto o dinheiro renderia</strong> se ficasse com você
          enquanto as parcelas são pagas. Quanto mais longo o parcelamento e maior o rendimento,
          maior o desconto necessário para as duas opções empatarem. A tabela mostra esse ponto
          de equilíbrio para uma compra parcelada sem acréscimo, com a primeira parcela em 30
          dias:
        </p>
        <div className="not-prose my-4 overflow-x-auto rounded-xl border border-brand-border bg-white">
          <table className="w-full text-sm">
            <caption className="px-4 pt-3 text-left text-xs text-brand-muted">
              Desconto à vista que empata com o parcelado sem juros (taxas hipotéticas)
            </caption>
            <thead>
              <tr className="border-b border-brand-border text-left text-xs uppercase tracking-wide text-brand-muted">
                <th className="px-4 py-2">Parcelas</th>
                {EXAMPLE_RATES.map((rate) => (
                  <th key={rate} className="px-4 py-2">
                    Rendendo {formatPercentBR(rate * 100, rate * 100 < 1 ? 1 : 0)} ao mês
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {EXAMPLE_COUNTS.map((count) => (
                <tr key={count} className="border-t border-brand-border/60 text-brand-text">
                  <td className="px-4 py-1.5 font-semibold">{count}x</td>
                  {EXAMPLE_RATES.map((rate) => (
                    <td key={rate} className="px-4 py-1.5">
                      {formatPercentBR(breakEvenDiscount(count, rate))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          As taxas de 0,5% e 1% ao mês são <strong>hipotéticas</strong>, escolhidas só para
          mostrar a conta. Não são sugestão nem previsão de rendimento. Se a primeira parcela for
          paga no ato, os percentuais ficam menores. Na ferramenta, abra &ldquo;E o valor do
          dinheiro no tempo?&rdquo;, informe a taxa líquida que você considera realista e veja o
          desconto de equilíbrio da sua compra, em reais e em percentual.
        </p>

        <h2 id="cinco-por-cento">Vale a pena pagar à vista com 5% de desconto?</h2>
        <p>
          Não existe resposta única para 5%. Pela tabela acima, em 10 parcelas sem juros, 5% de
          desconto fica acima do equilíbrio se o dinheiro renderia 0,5% ao mês (2,70%) e um pouco
          abaixo se renderia 1% ao mês (5,29%). Em 3 parcelas, 5% fica acima do equilíbrio nos
          dois casos. O mesmo desconto pode ser grande para um parcelamento curto e pequeno para
          um longo. Por isso a ferramenta pede o número de parcelas e a taxa, em vez de
          responder com uma regra fixa.
        </p>

        <h2 id="parcelar-e-investir">Parcelar e investir o dinheiro: como entra na conta?</h2>
        <p>
          É a ideia por trás do valor presente: em vez de pagar tudo hoje, você deixa o dinheiro
          aplicado e retira cada parcela no vencimento. Se o rendimento acumulado no período for
          maior que o desconto oferecido, o parcelamento custa menos em valor de hoje. Se for
          menor, pagar à vista custa menos. A conta só vale com algumas condições:
        </p>
        <ul>
          <li>
            <strong>Taxa líquida.</strong> Use o rendimento depois de imposto e custos, não a taxa
            bruta anunciada;
          </li>
          <li>
            <strong>Dinheiro realmente aplicado.</strong> Se o valor acabar gasto em outra coisa,
            o rendimento da conta não existe;
          </li>
          <li>
            <strong>Liquidez.</strong> A aplicação precisa permitir resgatar o valor de cada
            parcela na data certa;
          </li>
          <li>
            <strong>Rendimento não é garantido.</strong> A taxa é uma referência sua, e o
            resultado é um cenário, não uma promessa.
          </li>
        </ul>

        <h2 id="parcelado-sem-juros">
          Parcelado sem juros é igual ao preço à vista?
        </h2>
        <p>
          Em valor nominal, quando os totais batem, sim: R$ 4.800 à vista e 12 × R$ 400 somam
          o mesmo. Mas <strong>isso não significa que as duas opções sejam economicamente
          equivalentes</strong>. O dinheiro sai em momentos diferentes, e isso tem valor nos
          dois sentidos: pagar à vista encerra o compromisso agora; parcelar mantém o valor
          com você por mais tempo — e mantém a obrigação em aberto, ocupando limite e
          orçamento futuro.
        </p>
        <p>
          É por isso que esta calculadora não conclui &ldquo;então parcele&rdquo; quando os
          totais empatam. A conta empata; a decisão, não.
        </p>

        <h2 id="desconto-a-vista">Como calcular o desconto à vista?</h2>
        <p>
          <strong>Desconto = (preço de referência − preço à vista) ÷ preço de
          referência.</strong> Se a loja anuncia R$ 5.000 e cobra R$ 4.600 no Pix, o desconto
          é de R$ 400, ou 8%.
        </p>

        <h2 id="duas-bases">
          Por que o desconto à vista e o custo de parcelar dão percentuais diferentes?
        </h2>
        <p>
          Porque usam <strong>bases diferentes</strong>. No mesmo exemplo — referência
          R$ 5.000, à vista R$ 4.600, parcelado 12 × R$ 440 (R$ 5.280):
        </p>
        <ul>
          <li>
            <strong>Desconto à vista:</strong> R$ 400 sobre R$ 5.000 = <strong>8%</strong>;
          </li>
          <li>
            <strong>Custo de parcelar:</strong> R$ 680 sobre R$ 4.600 ={" "}
            <strong>14,78%</strong>.
          </li>
        </ul>
        <p>
          São dois números corretos que respondem a perguntas distintas. Não devem ser
          somados nem comparados entre si — e é exatamente aí que a maioria das comparações
          se perde. A ferramenta mostra os dois com o denominador escrito ao lado.
        </p>

        <h2 id="parcela-menor">Parcela menor significa compra mais barata?</h2>
        <p>
          Não. Parcela e total são números diferentes, e alongar o prazo quase sempre aumenta
          o total. Compare o preço até o fim, nunca só a prestação. Se a dúvida é se a parcela
          cabe no mês, isso é outra conta:{" "}
          <Link href="/calculadoras/parcela-no-orcamento/">
            quanto de parcela cabe no meu orçamento
          </Link>
          .
        </p>

        <h2 id="chamar-de-juros">A diferença é &ldquo;juros&rdquo;?</h2>
        <p>
          Não necessariamente, e por isso a ferramenta não usa esse termo. A diferença entre o
          total parcelado e o preço à vista pode conter juros, mas também pode ser
          simplesmente uma política de preço da loja — desconto concedido a quem paga à vista,
          e não encargo cobrado de quem parcela. Sem conhecer a estrutura, o que dá para
          afirmar é quanto o parcelamento acrescenta ao preço, não a que título.
        </p>

        <h2 id="credito-a-vista">Crédito à vista ou parcelado: qual a diferença?</h2>
        <p>
          Pagamento à vista é o pagamento integral no momento da compra, em dinheiro, Pix,
          débito ou no crédito em uma vez. Na maquininha, <strong>crédito à vista</strong> é a
          compra lançada inteira na próxima fatura do cartão; <strong>crédito parcelado</strong>{" "}
          divide o valor em várias faturas. Para quem compra, o crédito à vista funciona como
          pagar em uma parcela daqui a alguns dias ou semanas, até o vencimento da fatura.
        </p>
        <p>
          <strong>O crédito à vista tem juros?</strong> A compra em si não tem acréscimo. Os juros
          aparecem quando a fatura não é paga inteira: o saldo vai para o rotativo ou para o
          parcelamento da fatura, que têm juros próprios (a média de cada um está no{" "}
          <Link href="/taxas/">Radar de taxas</Link>). Para ver quanto isso custa, use a{" "}
          <Link href="/calculadoras/juros-cartao-credito/">calculadora de juros do cartão</Link>.
          Já no parcelado com juros, cobrado pelo banco do cartão, o total sai maior que o preço;
          some todas as parcelas e compare aqui antes de confirmar.
        </p>

        <h2 id="ipva-iptu">Serve para IPVA, IPTU e outras contas com cota única?</h2>
        <p>
          Serve. Informe a cota única com desconto como opção à vista e as parcelas como opção
          parcelada, com o valor de cada uma. A ferramenta mostra a diferença em reais e, com uma
          taxa que você escolher, o desconto de equilíbrio. Os percentuais de desconto, o número
          de parcelas e as datas de vencimento são definidos por cada estado (IPVA) ou município
          (IPTU) e mudam de ano para ano: confira os do seu caso no site da Secretaria da Fazenda
          do estado ou da prefeitura.
        </p>

        <h2 id="desvantagens">Quais são as desvantagens de pagar à vista e de parcelar?</h2>
        <p>Cada forma de pagamento tem um custo que não aparece no preço:</p>
        <ul>
          <li>
            <strong>À vista, o caixa sai todo de uma vez.</strong> Pagar usando o que sobrou de
            reserva troca um desconto pequeno por um risco grande no próximo imprevisto. E, se o
            dinheiro ficaria aplicado, ele deixa de render;
          </li>
          <li>
            <strong>Parcelado, o compromisso fica em aberto.</strong> Parcelar no cartão ocupa
            limite por meses, o que pode faltar numa emergência, e soma parcelas às despesas dos
            próximos meses. Uma parcela confortável hoje pode não ser confortável em janeiro;
          </li>
          <li>
            <strong>Nos dois casos, pesa o uso do dinheiro.</strong> Se ele ficaria parado, o custo
            de usá-lo agora é menor. Se cobriria uma despesa que está chegando, é maior.
          </li>
        </ul>

        <h2 id="usar-reserva">Vale usar toda a reserva para pagar à vista?</h2>
        <p>
          Essa é uma decisão sua, e a ferramenta não a toma. O que ela pode fazer é mostrar o
          tamanho real do desconto: se a diferença entre as opções for pequena em relação ao
          que você tem guardado, o desconto pode não compensar ficar sem colchão. Vale ler{" "}
          <Link href="/organizacao-financeira/reserva-de-emergencia/">
            quanto guardar de reserva de emergência
          </Link>{" "}
          antes de zerar o caixa por um desconto.
        </p>

        <h2 id="valor-presente">O que é valor presente?</h2>
        <p>
          É quanto vale hoje um dinheiro que só sai no futuro. Se você tem uma aplicação
          rendendo, R$ 400 que só saem daqui a doze meses &ldquo;custam&rdquo; hoje menos que
          R$ 400 — porque nesse tempo o valor rendeu. Por isso, quando os totais nominais
          empatam, o parcelamento pode ter valor presente menor.
        </p>
        <p>
          O modo avançado da ferramenta calcula isso com uma taxa que{" "}
          <strong>você informa</strong> — não sugerimos nenhuma, porque rendimento não é
          garantido e imposto, liquidez e risco mudam a conta. Ele também pergunta quando
          vence a primeira parcela: pagar a primeira hoje ou em trinta dias muda o resultado, e
          assumir uma das duas em silêncio seria errar sem avisar.
        </p>

        <h2 id="excel">Como fazer essa conta no Excel?</h2>
        <p>
          A função é <strong>VP</strong> (valor presente). Para 10 parcelas de R$ 100 com
          rendimento de 1% ao mês e a primeira em 30 dias, use{" "}
          <code>=VP(1%;10;-100)</code>, que dá cerca de R$ 947,13. Com a primeira parcela no
          ato, acrescente o tipo 1: <code>=VP(1%;10;-100;0;1)</code>. O desconto de equilíbrio é{" "}
          <strong>1 − valor presente ÷ total parcelado</strong>: 1 − 947,13 ÷ 1.000 = 5,29%. A
          taxa precisa estar no mesmo período das parcelas; para converter uma taxa anual em
          mensal, use o{" "}
          <Link href="/calculadoras/conversor-de-taxas/">conversor de taxas</Link>.
        </p>

        <h2 id="metodologia-avista">Como fazemos a comparação?</h2>
        <p>
          Só aritmética verificável. <strong>Total = entrada + parcelas + custos obrigatórios
          da opção</strong>; <strong>diferença = total parcelado − preço à vista</strong>;{" "}
          <strong>percentual = diferença ÷ preço à vista × 100</strong>. Quando as parcelas
          variam, usamos o total divulgado — multiplicar a primeira parcela daria um número
          errado. No modo avançado, o valor presente usa equivalência composta para converter
          taxa anual em mensal (nunca dividindo por 12) e distingue anuidade antecipada de
          postecipada. O desconto de equilíbrio é{" "}
          <strong>(1 − valor presente ÷ total parcelado) × 100</strong>, sobre o total
          parcelado nominal.
        </p>
        <p>
          O que a ferramenta <strong>não</strong> faz: não recomenda pagar à vista nem
          parcelar, não calcula CET (nem sempre existe operação de crédito e nunca há dados
          suficientes), não chama a diferença de juros, não considera pontos, milhas ou
          cashback — cujo valor depende de regras, limites e validade — e não sugere taxa de
          rendimento. Os rótulos são factuais: menor total, menor desembolso imediato, menor
          parcela e menor prazo. Tudo roda no seu navegador: nenhum valor é enviado ou salvo.
        </p>
        <p>
          Encontrou algo errado? Veja a{" "}
          <Link href="/politica-de-correcoes/">política de correções</Link>. Metodologia
          revisada em 01/10/2026.
        </p>
      </section>
    </div>
  );
}
