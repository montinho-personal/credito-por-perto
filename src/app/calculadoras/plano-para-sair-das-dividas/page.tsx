import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { webPageJsonLd } from "@/lib/schema/jsonld";
import { JsonLd } from "@/components/seo/JsonLd";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { DebtPlanBuilder } from "@/components/calculators/DebtPlanBuilder";
import { ToolNextSteps } from "@/components/journeys/ToolNextSteps";

export const metadata: Metadata = buildMetadata({
  title: "Plano para sair das dívidas: veja qual pagar primeiro",
  description:
    "Monte um plano para sair das dívidas: liste o que deve, veja qual pagar primeiro (avalanche ou bola de neve) e quanto sobra por mês. Sem cadastro.",
  path: "/calculadoras/plano-para-sair-das-dividas/",
});

export default function PlanoParaSairDasDividasPage() {
  return (
    <div
      data-track-area="ferramenta"
      data-track="plano-para-sair-das-dividas"
      className="mx-auto max-w-5xl px-4 py-8">
      <JsonLd
        data={webPageJsonLd(
          "Plano para sair das dívidas",
          "Monte um plano para sair das dívidas: liste o que deve, veja qual pagar primeiro (avalanche ou bola de neve) e quanto sobra por mês. Sem cadastro.",
          "/calculadoras/plano-para-sair-das-dividas/",
        )}
      />
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: "Calculadoras", path: "/calculadoras/" },
          { name: "Plano para sair das dívidas", path: "/calculadoras/plano-para-sair-das-dividas/" },
        ]}
      />

      <header className="mt-6">
        <h1 className="font-serif text-3xl font-bold leading-tight text-brand-navy md:text-4xl">
          Plano para sair das dívidas
        </h1>
        <p className="mt-3 text-lg leading-relaxed text-brand-muted">
          Monte o seu plano de ação: organize o que deve, veja quais dívidas merecem atenção antes
          da conta e compare qual delas cada método priorizaria primeiro.{" "}
          <strong>Coloque todas as dívidas na mesa e depois decida qual atacar primeiro.</strong>
        </p>
      </header>

      <div className="mt-8">
        <DebtPlanBuilder />
      </div>

      <ToolNextSteps toolId="plano-para-sair-das-dividas" />


      <section aria-labelledby="perguntas-plano" className="article-body mt-12">
        <h2 id="perguntas-plano">Qual dívida pagar primeiro?</h2>
        <p>
          Não existe uma ordem universal. Existem duas lógicas consagradas — priorizar a de maior
          juros ou a de menor saldo — e um conjunto de situações práticas que pode passar na frente
          das duas: dívida atrasada, garantia vinculada, bem ou serviço essencial, cobrança em
          curso. Por isso a ferramenta separa <strong>prioridade matemática</strong> de{" "}
          <strong>prioridade prática</strong>, e nunca mistura as duas em silêncio. O detalhamento
          está em{" "}
          <Link href="/organizacao-financeira/qual-divida-pagar-primeiro/">
            qual dívida pagar primeiro
          </Link>
          .
        </p>

        <h2 id="organizar">Como montar um plano para sair das dívidas?</h2>
        <p>Em passos, que são os mesmos que a ferramenta acima segue:</p>
        <ol>
          <li>
            <strong>Liste todas as dívidas:</strong> credor, saldo atualizado, pagamento mensal, taxa
            (se souber), atraso e se existe garantia. O{" "}
            <Link href="/credito-seguro/como-consultar-dividas-no-registrato/">
              Registrato, do Banco Central
            </Link>
            , mostra as operações de crédito no seu CPF, mas não cobre dívidas de comércio,
            serviços e contas de consumo, que entram pelos extratos. Dívida com agiota também entra
            na lista; o que a lei diz sobre ela está em{" "}
            <Link href="/credito-seguro/agiota-e-emprestimo-informal/">agiota e empréstimo informal</Link>.
          </li>
          <li>
            <strong>Veja quanto sobra por mês</strong> depois das despesas que precisam continuar
            existindo.
          </li>
          <li>
            <strong>Separe o que é urgente:</strong> atraso, garantia, bem ou serviço essencial.
          </li>
          <li>
            <strong>Escolha a ordem</strong> para o dinheiro extra: maior juros (avalanche) ou menor
            saldo (bola de neve).
          </li>
          <li>
            <strong>Negocie o que não cabe</strong>, com tudo por escrito.
          </li>
          <li>
            <strong>Evite dívida nova</strong> enquanto o plano estiver em andamento.
          </li>
          <li>
            <strong>Acompanhe todo mês</strong> e refaça a conta quando uma dívida terminar.
          </li>
        </ol>
        <p>
          O plano completo, com cada passo explicado, está em{" "}
          <Link href="/organizacao-financeira/como-sair-das-dividas/">como sair das dívidas</Link>.
        </p>

        <h2 id="avalanche">O que é o método avalanche?</h2>
        <p>
          Você mantém os pagamentos necessários de todas as dívidas e direciona o valor que sobra
          para a de <strong>maior taxa de juros</strong>. Quando ela é quitada, o valor que era dela
          reforça a próxima da fila. O objetivo é reduzir o impacto dos juros: atacar primeiro o que
          cresce mais rápido tende a diminuir o custo financeiro total.
        </p>

        <h2 id="bola-de-neve">O que é o método bola de neve?</h2>
        <p>
          Mesma mecânica, critério diferente: o valor adicional vai para a dívida de{" "}
          <strong>menor saldo</strong>, independentemente da taxa. O objetivo é eliminar uma dívida
          mais rapidamente e reduzir o número de compromissos em aberto. A lista encurta antes,
          ainda que o custo do caminho seja maior.
        </p>

        <h2 id="qual-metodo">Avalanche ou bola de neve: qual a diferença?</h2>
        <p>
          A avalanche prioriza o <em>custo</em>; a bola de neve prioriza <em>eliminar compromissos</em>.
          Nenhum dos dois é a estratégia correta para todo mundo, e esta ferramenta não elege
          vencedor: ela mostra a ordem de cada um com os seus números e, quando os dados permitem,
          o custo estimado de cada caminho. A escolha entre sustentar um plano mais barato ou um
          plano mais visível é sua.
        </p>

        <h2 id="juros-maiores">Vale pagar primeiro a dívida com juros maiores?</h2>
        <p>
          Do ponto de vista aritmético, atacar a maior taxa tende a reduzir o total de juros: é a
          lógica da avalanche. Mas a resposta muda quando outra dívida traz consequência mais grave
          em caso de não pagamento, como a perda de um bem dado em garantia ou a interrupção de um
          serviço essencial. Por isso a ferramenta mostra essas condições <em>antes</em> da ordem.
        </p>

        <h2 id="nao-cabe">E se eu não conseguir pagar todas as parcelas?</h2>
        <p>
          Nesse caso o primeiro problema não é escolher uma estratégia: é fazer os pagamentos
          caberem no orçamento. A ferramenta detecta quando o valor disponível não cobre a soma dos
          pagamentos e muda de modo: mostra a diferença mensal, destaca as dívidas com condições
          sensíveis e encaminha para negociação. Ela{" "}
          <strong>não indica qual parcela deixar de pagar</strong>, porque essa decisão tem
          consequências jurídicas e patrimoniais que dependem de cada contrato.
        </p>
        <p>
          Ganhando pouco, regras de bolso como a 50/30/20 (metade da renda para necessidades, 30%
          para o resto e 20% para dívidas e reserva) servem de ponto de partida, mas raramente
          fecham com renda apertada. A conta que decide é a do seu mês: quanto entra, quanto precisa
          sair e quanto sobra, como mostra{" "}
          <Link href="/calculadoras/parcela-no-orcamento/">quanto de parcela cabe no meu orçamento</Link>.
        </p>

        <h2 id="dinheiro-extra">O que fazer com um dinheiro extra?</h2>
        <p>
          Informe o valor e veja qual dívida cada estratégia priorizaria. Um cuidado importante: em
          contratos de parcela fixa, o valor adicional precisa ser pedido como amortização
          antecipada, e a instituição informa se ele reduz o prazo ou a parcela — o efeito real
          depende das regras do contrato. Para comparar o saldo de quitação com as parcelas que
          faltam, use a{" "}
          <Link href="/calculadoras/quitacao-antecipada/">calculadora de quitação antecipada</Link>.
        </p>

        <h2 id="emprestimo-para-quitar">Vale pegar um empréstimo para quitar outras dívidas?</h2>
        <p>
          Pode fazer sentido quando o custo total cai de verdade e a causa do endividamento já foi
          tratada. Vira armadilha quando a parcela menor vem de um prazo muito maior e o total pago
          aumenta. Compare a dívida inteira, não só a parcela, em{" "}
          <Link href="/calculadoras/trocar-divida/">vale a pena trocar esta dívida?</Link> Esta
          ferramenta não recomenda contratar crédito novo para fechar o plano.
        </p>

        <h2 id="despesas-basicas">
          O que fazer se as dívidas comprometem as despesas básicas?
        </h2>
        <p>
          Pelos valores informados, o pagamento das dívidas pode estar comprometendo recursos
          necessários às despesas básicas. Nessa situação, pode ser útil buscar orientação
          especializada ou canais de defesa do consumidor: Procon, Defensoria Pública e o{" "}
          <a href="https://www.consumidor.gov.br" rel="noopener noreferrer" target="_blank">
            Consumidor.gov.br
          </a>
          , canal público de interlocução entre consumidores e empresas participantes. Existe também
          um caminho legal específico, descrito no{" "}
          <Link href="/organizacao-financeira/lei-do-superendividamento/">
            guia da Lei nº 14.181/2021
          </Link>
          . Esta ferramenta não classifica ninguém como superendividado: isso tem definição
          jurídica própria e não se deduz de uma conta.
        </p>

        <h2 id="negociar">Como negociar dívidas?</h2>
        <p>
          Chegando preparado: saldo atualizado, tempo de atraso, quanto cabe no mês e quanto você
          tem à vista. Os canais vão do credor à ouvidoria, ao Consumidor.gov.br e ao Procon. O
          roteiro completo, com o que exigir por escrito antes de pagar, está em{" "}
          <Link href="/organizacao-financeira/como-negociar-dividas/">como negociar dívidas</Link>.
        </p>

        <h2 id="plano-do-governo">Qual é o plano do governo para quitar dívidas?</h2>
        <p>
          Em 2026, o governo federal lançou o Novo Desenrola Brasil, pela Medida Provisória nº
          1.355/2026, com frentes para famílias, Fies, rural e empresas. Segundo o Ministério da
          Fazenda, a frente{" "}
          <a href="https://www.gov.br/fazenda/pt-br/acesso-a-informacao/acoes-e-programas/novo-desenrola-brasil/faq/desenrola-brasil-familias" rel="noopener noreferrer" target="_blank">
            Desenrola Famílias
          </a>{" "}
          ficou disponível até 31/08/2026; o Desenrola Rural teve o prazo prorrogado até
          20/12/2026 pelo Decreto nº 12.956/2026. Situação verificada em 03/09/2026; como programas
          mudam, confira no gov.br antes de contar com eles. A adesão era feita diretamente com a
          instituição em que está a dívida, não por intermediário: site ou mensagem que cobra para
          &ldquo;entrar no programa&rdquo; merece desconfiança. Os detalhes estão em{" "}
          <Link href="/organizacao-financeira/como-negociar-dividas/">como negociar dívidas</Link>.
        </p>

        <h2 id="desconto">Como quitar dívida com desconto grande?</h2>
        <p>
          Descontos altos, às vezes anunciados como &ldquo;até 90%&rdquo;, aparecem principalmente em
          dívidas antigas e em atraso, quando o próprio credor oferece em renegociação ou feirão.
          Não há percentual garantido: depende do credor, do tempo de atraso e da dívida. Antes de
          aceitar, some entrada, parcelas e custos do acordo na{" "}
          <Link href="/calculadoras/renegociacao-de-dividas/">calculadora de renegociação de dívidas</Link>{" "}
          e pague só por canal oficial do credor.
        </p>

        <h2 id="metodologia">Como montamos o plano?</h2>
        <p>
          Com regras explícitas, sem algoritmo secreto e sem inteligência artificial: (1) reunimos
          os valores informados; (2) somamos os pagamentos mensais cadastrados; (3) comparamos com o
          valor que você consegue destinar, obtendo o valor adicional; (4) a avalanche ordena por
          taxa mensal equivalente, da maior para a menor; (5) a bola de neve ordena por saldo, do
          menor para o maior; (6) condições especiais — atraso, garantia, bem essencial, urgência —
          aparecem <strong>separadamente</strong>, nunca embutidas na ordem; (7) a projeção de
          quitação só é feita quando todas as dívidas têm saldo, taxa e pagamento informados e o
          orçamento cobre os pagamentos; (8) toda projeção é estimativa, com hipóteses declaradas.
        </p>
        <p>
          Desempates documentados: na avalanche, taxas iguais colocam o <em>menor saldo</em>{" "}
          primeiro; na bola de neve, saldos iguais colocam a <em>maior taxa</em> primeiro. Taxas em
          unidades diferentes são convertidas por equivalência composta — mensal para anual por
          (1 + i)<sup>12</sup> − 1 e anual para mensal por (1 + i)<sup>1/12</sup> − 1, nunca
          multiplicando ou dividindo por 12. Dinheiro em centavos inteiros, sem arredondamento em
          etapas intermediárias. Quando uma dívida é quitada na simulação, o pagamento dela passa a
          reforçar a próxima da ordem — é o efeito cascata.
        </p>

        <h2 id="limitacoes">O que esta ferramenta não sabe</h2>
        <p>
          Ela trabalha apenas com o que você digita, e há muita coisa fora do alcance dela: as
          regras completas de cada contrato, mudanças futuras de taxa, descontos que você venha a
          negociar, compras novas no cartão, multas futuras, a situação jurídica de cada dívida, sua
          renda futura e despesas inesperadas. Por isso ela nunca promete data de quitação nem
          economia garantida — e por isso os números aparecem sempre como estimativa da simulação.
        </p>
        <p>
          Fontes e referências: Banco Central do Brasil (educação financeira e informações sobre
          crédito), Código de Defesa do Consumidor e Lei nº 14.181/2021 (prevenção e tratamento do
          superendividamento), Consumidor.gov.br (canal público de interlocução). Encontrou algo
          errado? Veja a <Link href="/politica-de-correcoes/">política de correções</Link>.
          Metodologia revisada em 28/08/2026.
        </p>
      </section>
    </div>
  );
}
