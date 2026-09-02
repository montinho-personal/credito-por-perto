import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { webPageJsonLd } from "@/lib/schema/jsonld";
import { JsonLd } from "@/components/seo/JsonLd";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { CashVsInstallmentsCalculator } from "@/components/calculators/CashVsInstallmentsCalculator";

export const metadata: Metadata = buildMetadata({
  title: "À vista ou parcelado? Compare o preço até o fim",
  description:
    "Compare preço à vista, entrada, parcelas e total. Veja quanto custa parcelar, qual é a diferença em reais e qual desconto à vista está sendo oferecido. Sem cadastro.",
  path: "/calculadoras/a-vista-ou-parcelado/",
});

export default function AVistaOuParceladoPage() {
  return (
    <div
      data-track-area="ferramenta"
      data-track="a-vista-ou-parcelado"
      className="mx-auto max-w-5xl px-4 py-8">
      <JsonLd
        data={webPageJsonLd(
          "À vista ou parcelado?",
          "Compare o preço à vista com o parcelado e veja quanto cada opção custa até o fim, sem recomendação de forma de pagamento.",
          "/calculadoras/a-vista-ou-parcelado/",
        )}
      />
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: "Ferramentas", path: "/calculadoras/" },
          { name: "À vista ou parcelado", path: "/calculadoras/a-vista-ou-parcelado/" },
        ]}
      />

      <header className="mt-6">
        <h1 className="font-serif text-3xl font-bold leading-tight text-brand-navy md:text-4xl">
          À vista ou parcelado?
        </h1>
        <p className="mt-3 text-lg leading-relaxed text-brand-muted">
          Compare o preço à vista com as parcelas e veja quanto cada opção custa até o fim.{" "}
          <strong>A parcela pode diminuir enquanto o total aumenta</strong> — e são duas
          perguntas diferentes: qual opção custa menos, e qual preserva mais caixa agora.
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

        <h2 id="alem-do-preco">O que considerar além do preço?</h2>
        <ul>
          <li>
            <strong>O que você faria com o dinheiro.</strong> Se ele ficaria parado, o custo
            de usá-lo agora é menor. Se cobriria uma despesa que está chegando, é maior;
          </li>
          <li>
            <strong>Sua reserva.</strong> Pagar à vista usando o que sobrou de reserva troca um
            desconto pequeno por um risco grande no próximo imprevisto;
          </li>
          <li>
            <strong>O limite ocupado.</strong> Parcelar no cartão compromete limite por meses,
            o que pode faltar numa emergência;
          </li>
          <li>
            <strong>As despesas dos próximos meses.</strong> Uma parcela confortável hoje pode
            não ser confortável em janeiro.
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

        <h2 id="metodologia-avista">Como fazemos a comparação?</h2>
        <p>
          Só aritmética verificável. <strong>Total = entrada + parcelas + custos obrigatórios
          da opção</strong>; <strong>diferença = total parcelado − preço à vista</strong>;{" "}
          <strong>percentual = diferença ÷ preço à vista × 100</strong>. Quando as parcelas
          variam, usamos o total divulgado — multiplicar a primeira parcela daria um número
          errado. No modo avançado, o valor presente usa equivalência composta para converter
          taxa anual em mensal (nunca dividindo por 12) e distingue anuidade antecipada de
          postecipada.
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
          revisada em 29/08/2026.
        </p>
      </section>
    </div>
  );
}
