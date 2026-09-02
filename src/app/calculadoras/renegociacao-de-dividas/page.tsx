import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { webPageJsonLd } from "@/lib/schema/jsonld";
import { JsonLd } from "@/components/seo/JsonLd";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { RenegotiationCalculator } from "@/components/calculators/RenegotiationCalculator";

export const metadata: Metadata = buildMetadata({
  title: "Calculadora de Renegociação de Dívidas — compare acordos",
  description:
    "Compare propostas de acordo: entrada, parcelas, prazo e valor total. Veja a diferença entre pagar à vista e parcelado e confira o desconto anunciado. Sem cadastro.",
  path: "/calculadoras/renegociacao-de-dividas/",
});

export default function RenegociacaoPage() {
  return (
    <div
      data-track-area="ferramenta"
      data-track="renegociacao-de-dividas"
      className="mx-auto max-w-5xl px-4 py-8">
      <JsonLd
        data={webPageJsonLd(
          "Calculadora de Renegociação de Dívidas",
          "Compare propostas de acordo — à vista, com entrada ou parceladas — e veja quanto cada uma custa no total, sem recomendação de aceitar ou recusar.",
          "/calculadoras/renegociacao-de-dividas/",
        )}
      />
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: "Ferramentas", path: "/calculadoras/" },
          { name: "Renegociação de dívidas", path: "/calculadoras/renegociacao-de-dividas/" },
        ]}
      />

      <header className="mt-6">
        <h1 className="font-serif text-3xl font-bold leading-tight text-brand-navy md:text-4xl">
          Calculadora de renegociação de dívidas
        </h1>
        <p className="mt-3 text-lg leading-relaxed text-brand-muted">
          Compare propostas de acordo e veja quanto você realmente pagaria à vista ou
          parcelado.{" "}
          <strong>
            O desconto anunciado não responde quanto sai do seu bolso até o fim
          </strong>{" "}
          — entrada, parcela, prazo e total, sim. Coloque as condições lado a lado antes de
          fechar.
        </p>
      </header>

      <div className="mt-8">
        <RenegotiationCalculator />
      </div>

      <section aria-labelledby="perguntas-renegociacao" className="article-body mt-12">
        <h2 id="perguntas-renegociacao">Como calcular o total de um acordo?</h2>
        <p>
          <strong>
            Entrada + soma das parcelas + custos adicionais informados no acordo.
          </strong>{" "}
          É só isso, e é justamente o número que a proposta costuma não mostrar em destaque.
          O erro mais comum é olhar &ldquo;18 × R$ 340&rdquo;, chegar a R$ 6.120 e esquecer
          a entrada de R$ 1.000 — o acordo custa R$ 7.120, não R$ 6.120.
        </p>

        <h2 id="desconto-sobre-o-que">
          &ldquo;70% de desconto&rdquo; significa o quê?
        </h2>
        <p>
          Significa uma redução <em>sobre alguma base</em> — e a base muda tudo. Um desconto
          anunciado pode estar calculado sobre o saldo atualizado com encargos, sobre o saldo
          contábil do credor ou sobre outro valor que você não vê. Por isso esta calculadora
          nunca diz &ldquo;desconto de X%&rdquo; sozinho: ela diz{" "}
          <strong>redução em relação ao saldo que você informou</strong>, deixando explícito
          o denominador da conta.
        </p>
        <p>
          Se o percentual que você calcular aqui não bater com o anunciado, a explicação mais
          provável é base de cálculo diferente, não irregularidade. Vale perguntar ao credor
          sobre qual valor o desconto foi calculado.
        </p>

        <h2 id="reducao-nao-e-juros">A diferença é tudo &ldquo;juros perdoados&rdquo;?</h2>
        <p>
          Não necessariamente, e é por isso que não usamos esse termo. O saldo apresentado
          para negociação pode conter principal, juros, multa, correção e outros encargos, em
          proporções que a proposta raramente detalha. Chamar a diferença inteira de
          &ldquo;juros&rdquo; seria inventar uma composição que não foi informada. Aqui ela é
          o que dá para afirmar: uma redução em reais e em percentual sobre o saldo
          informado.
        </p>

        <h2 id="a-vista-ou-parcelado">É melhor pagar à vista ou parcelado?</h2>
        <p>
          Não existe resposta única, e a ferramenta não escolhe por você. O que ela mostra é
          o trade-off real: o pagamento à vista costuma somar menos no total, mas exige todo
          o dinheiro de uma vez; o parcelamento alivia o mês e quase sempre aumenta o total.
          A pergunta que decide não é aritmética — é se o desembolso único cabe sem
          desmontar sua reserva e sem criar uma dívida nova mais cara.
        </p>

        <h2 id="parcela-menor">Por que a parcela menor pode custar mais?</h2>
        <p>
          Porque parcela e total são números diferentes. Uma proposta de 36 × R$ 245 tem
          parcela mais leve que 18 × R$ 340, mas soma R$ 8.820 contra R$ 7.120 — R$ 1.700 a
          mais. Comparar acordos pela parcela é o erro que mais custa caro em renegociação, e
          é exatamente o que esta calculadora existe para evitar. Se a dúvida é se a parcela
          cabe, use a{" "}
          <Link href="/calculadoras/parcela-no-orcamento/">
            calculadora de parcela no orçamento
          </Link>
          .
        </p>

        <h2 id="entrada">A entrada reduz o custo total?</h2>
        <p>
          Ela reduz o valor financiado, o que costuma reduzir o total do acordo — mas isso
          só aparece quando você soma entrada e parcelas na mesma conta. Uma entrada alta com
          parcelas longas pode custar mais que uma entrada menor com prazo curto. Compare os
          totais, nunca as parcelas isoladas.
        </p>

        <h2 id="renegociacao-ou-emprestimo">
          Renegociação e novo empréstimo são a mesma coisa?
        </h2>
        <p>
          Não. Na renegociação, o próprio credor apresenta condições novas para uma dívida
          que já existe com ele. No novo empréstimo, outra instituição entra na história: você
          contrata uma operação de crédito, com taxa e CET próprios, e usa o dinheiro para
          quitar a dívida antiga. São contas diferentes e riscos diferentes. Se a proposta na
          sua mão cria uma operação nova, a ferramenta certa é{" "}
          <Link href="/calculadoras/trocar-divida/">vale a pena trocar esta dívida?</Link>, e
          o caminho de decisão está em{" "}
          <Link href="/organizacao-financeira/renegociacao-ou-emprestimo/">
            renegociação ou novo empréstimo
          </Link>
          .
        </p>

        <h2 id="atrasar-acordo">O que acontece se eu atrasar uma parcela do acordo?</h2>
        <p>
          Depende do que foi acordado — e essa não é uma resposta evasiva. Se houve{" "}
          <strong>novação</strong>, a dívida anterior se extingue e é substituída pela nova (
          <a
            href="https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm"
            rel="noopener noreferrer"
            target="_blank"
          >
            art. 360 do Código Civil
          </a>
          ). Mas a intenção de novar não se presume: o{" "}
          <a
            href="https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm"
            rel="noopener noreferrer"
            target="_blank"
          >
            art. 361
          </a>{" "}
          diz que, sem ânimo de novar expresso ou inequívoco, a segunda obrigação apenas
          confirma a primeira. Na prática, muitos acordos trazem cláusula expressa prevendo o
          que acontece em caso de descumprimento. Por isso a resposta honesta é: leia essa
          cláusula antes de assinar e guarde uma cópia do acordo.
        </p>

        <h2 id="baixa-negativacao">Paguei o acordo. Quando meu nome sai da lista?</h2>
        <p>
          A{" "}
          <a
            href="https://www.stj.jus.br/sites/portalp/Paginas/Comunicacao/Noticias-antigas/2014/2014-09-12_16-35_Credor-tem-cinco-dias-uteis-apos-quitacao-do-debito-para-pedir-exclusao-de-cadastro-negativo.aspx"
            rel="noopener noreferrer"
            target="_blank"
          >
            Súmula 548 do STJ
          </a>{" "}
          firmou que cabe ao credor pedir a exclusão do registro no prazo de cinco dias úteis
          contados do integral e efetivo pagamento do débito. Atenção ao
          &ldquo;integral&rdquo;: em acordo parcelado, isso costuma significar o fim de todas
          as parcelas, não a primeira. Guarde o comprovante e, se o prazo passar, registre
          reclamação nos canais oficiais — SAC, ouvidoria e{" "}
          <a href="https://www.consumidor.gov.br" rel="noopener noreferrer" target="_blank">
            consumidor.gov.br
          </a>
          .
        </p>

        <h2 id="antes-de-pagar">O que conferir antes de pagar</h2>
        <ul>
          <li>
            Confirme o credor e o canal — procure o contato pelo aplicativo oficial ou pelo
            número do verso do cartão, nunca por link recebido;
          </li>
          <li>Confira o beneficiário do boleto ou do Pix antes de concluir;</li>
          <li>Revise o valor e o vencimento contra o que foi combinado;</li>
          <li>Peça o acordo por escrito, com todas as parcelas e a cláusula de atraso;</li>
          <li>Guarde comprovante de cada pagamento e o termo de quitação no final.</li>
        </ul>
        <p>
          Se algo na abordagem parecer estranho — urgência incomum, cobrança de taxa para
          &ldquo;liberar&rdquo; a negociação, Pix para pessoa física —, vale passar pela{" "}
          <Link href="/calculadoras/sinais-de-golpe/">verificação de sinais de golpe</Link>{" "}
          antes de transferir qualquer valor. Uma entrada de acordo é normal; uma taxa cobrada
          para destravar o acordo não é a mesma coisa.
        </p>

        <h2 id="metodologia-renegociacao">Como fazemos a comparação?</h2>
        <p>
          Só aritmética verificável, sem projeção escondida:{" "}
          <strong>TOTAL DO ACORDO = entrada + parcelas + custos adicionais informados</strong>
          ; <strong>REDUÇÃO NOMINAL = saldo informado − total do acordo</strong>; e{" "}
          <strong>PERCENTUAL = redução ÷ saldo informado × 100</strong>. Quando as parcelas
          têm valores diferentes, usamos o total parcelado que você informar — multiplicar a
          primeira parcela pelo número de parcelas daria um número errado.
        </p>
        <p>
          O que a calculadora <strong>não</strong> faz: não calcula CET (que tem definição
          normativa e pressupõe fluxo de caixa datado), não chama a diferença de
          &ldquo;juros&rdquo; sem conhecer a composição do saldo, não usa a dívida original
          como base do percentual e não elege proposta vencedora. Os rótulos são factuais —
          menor total, menor parcela, menor prazo, menor desembolso inicial — porque qual
          desses eixos importa mais depende do seu bolso, não da conta. Tudo roda no seu
          navegador: nenhum valor é enviado ou salvo.
        </p>
        <p>
          Fontes das regras citadas: Código Civil, arts. 360 e 361 (novação); Súmula 548 do
          STJ (prazo de exclusão do registro após pagamento); Código de Defesa do Consumidor.
          Encontrou algo errado? Veja a{" "}
          <Link href="/politica-de-correcoes/">política de correções</Link>. Metodologia
          revisada em 29/08/2026.
        </p>
      </section>
    </div>
  );
}
