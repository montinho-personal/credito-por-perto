import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { webPageJsonLd } from "@/lib/schema/jsonld";
import { JsonLd } from "@/components/seo/JsonLd";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { BudgetImpactSimulator } from "@/components/calculators/BudgetImpactSimulator";
import { ToolNextSteps } from "@/components/journeys/ToolNextSteps";

export const metadata: Metadata = buildMetadata({
  title: "Quanto de parcela cabe no meu orçamento? Faça a conta completa",
  description:
    "Veja como uma nova parcela afetaria seu orçamento mensal: informe renda, despesas e dívidas e descubra quanto sobra antes e depois dela. Grátis, sem cadastro.",
  path: "/calculadoras/parcela-no-orcamento/",
});

export default function ParcelaNoOrcamentoPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <JsonLd
        data={webPageJsonLd(
          "Quanto de parcela cabe no meu orçamento?",
          "Simule o impacto de uma nova parcela na sua renda, nos seus gastos e na folga que sobra no mês — sem recomendação de contratação.",
          "/calculadoras/parcela-no-orcamento/",
        )}
      />
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: "Calculadoras", path: "/calculadoras/" },
          { name: "Parcela no orçamento", path: "/calculadoras/parcela-no-orcamento/" },
        ]}
      />

      <header className="mt-6">
        <h1 className="font-serif text-3xl font-bold leading-tight text-brand-navy md:text-4xl">
          Quanto de parcela cabe no meu orçamento?
        </h1>
        <p className="mt-3 text-lg leading-relaxed text-brand-muted">
          Veja como uma nova parcela afetaria sua renda, seus gastos e a folga que sobra no mês.
          Porque uma parcela de R$ 800 não pesa igual para todo mundo — <strong>não pergunte
          apenas se ela cabe na renda; veja se cabe na vida que essa renda precisa pagar</strong>.
        </p>
      </header>

      <div className="mt-8">
        <BudgetImpactSimulator />
      </div>

      <ToolNextSteps toolId="parcela-no-orcamento" />


      <section aria-labelledby="perguntas-orcamento" className="article-body mt-12">
        <h2 id="perguntas-orcamento">Como saber se uma parcela cabe no orçamento?</h2>
        <p>
          Fazendo a conta inteira: renda líquida, menos as despesas que precisam existir, menos as
          parcelas que você já paga, menos o que separa para gastos não mensais. O que sobra é a
          sua folga — e é nela, não na renda, que a nova parcela vai morder. A ferramenta acima
          mostra a folga antes e depois da parcela, pelos valores que você informar.
        </p>

        <h2 id="percentual-renda">Por que não basta olhar o percentual da renda?</h2>
        <p>
          Porque renda é só metade da conta: o que você já precisa pagar também importa. Duas
          pessoas com renda de R$ 5.000 podem viver realidades opostas — uma gasta R$ 2.500 por
          mês, a outra, R$ 4.700. Uma parcela de R$ 600 representa 12% da renda das duas, mas
          consome 24% da folga da primeira e o triplo do que sobra para a segunda. Regras como
          &ldquo;até 30% da renda&rdquo; vêm de políticas de concessão e de limites operacionais
          (como a margem do consignado) — servem para o credor decidir quanto emprestar, não para
          dizer que a parcela é confortável para o seu mês.
        </p>

        <h2 id="folga-mensal">Como calcular sua folga mensal?</h2>
        <p>
          Folga = renda líquida − despesas recorrentes − parcelas existentes − provisão para
          gastos não mensais. É a mesma lógica de orçamento pessoal que o Banco Central ensina no
          material de cidadania financeira: organizar o que entra e o que sai antes de qualquer
          decisão de crédito. O número que resulta é a sua margem de manobra verdadeira.
        </p>

        <h2 id="o-que-incluir">O que incluir nas despesas?</h2>
        <p>
          Tudo o que precisa continuar existindo: moradia, alimentação, contas de consumo,
          transporte, saúde, educação e as assinaturas que você não pretende cortar. O erro mais
          comum é esquecer os gastos que não acontecem todo mês — IPVA, IPTU, material escolar,
          manutenção do carro, presentes de fim de ano. O campo de provisão mensal existe para
          eles: divida o total anual por 12 e inclua.
        </p>

        <h2 id="outras-dividas">Como considerar outras dívidas?</h2>
        <p>
          Some o que já sai todo mês em parcelas: financiamento, empréstimo, consignado, compras
          parceladas no cartão. Só cuide para não contar duas vezes — se uma parcela já entrou nas
          despesas, não a repita no campo de dívidas. E se a ideia é justamente substituir uma
          dívida atual por outra, a comparação certa é a da ferramenta{" "}
          <Link href="/calculadoras/trocar-divida/">vale a pena trocar esta dívida?</Link>
        </p>

        <h2 id="margem-imprevistos">Por que deixar margem para imprevistos?</h2>
        <p>
          Porque um orçamento que fecha exato só fecha até o primeiro imprevisto. Se renda menos
          compromissos menos parcela dá zero, qualquer conserto, remédio ou mês mais fraco vai
          exigir cortar despesa, usar reserva — ou contratar crédito novo, muitas vezes caro. A
          ferramenta não impõe um valor de reserva: você define a margem que quer preservar, e o
          resultado mostra se ela sobrevive à nova parcela.
        </p>

        <h2 id="margem-consignavel">Margem consignável significa que a parcela cabe no orçamento?</h2>
        <p>
          Não. A margem consignável é um limite legal e operacional de desconto em folha — a
          existência de margem não significa automaticamente que a parcela seja confortável para o
          orçamento doméstico. O desconto acontece antes de o dinheiro chegar, mas as despesas da
          casa continuam as mesmas. Calcule a margem em{" "}
          <Link href="/calculadoras/margem-consignavel/">margem consignável</Link> e o conforto,
          aqui.
        </p>

        <h2 id="orcamento-negativo">O que fazer se o orçamento já estiver negativo?</h2>
        <p>
          Primeiro, sem pânico e sem culpa — a ferramenta aceita orçamento negativo porque essa é
          a realidade de muita gente. O caminho costuma começar por{" "}
          <Link href="/organizacao-financeira/renegociacao-ou-emprestimo/">
            renegociar as dívidas existentes
          </Link>{" "}
          e revisar as despesas de maior peso. Se pagar as dívidas está comprometendo despesas
          básicas da casa, pode ser importante buscar orientação financeira e de defesa do
          consumidor: a{" "}
          <Link href="/organizacao-financeira/lei-do-superendividamento/">
            Lei do Superendividamento
          </Link>{" "}
          (Lei nº 14.181/2021) criou um processo de repactuação com todos os credores, via Procon
          ou Defensoria, preservando um mínimo para a sobrevivência.
        </p>

        <h2 id="parcela-menor">Parcela menor significa empréstimo melhor?</h2>
        <p>
          Não necessariamente — parcela menor pode ser só prazo maior, com custo total mais alto.
          Cabendo no orçamento, o passo seguinte é comparar o custo do crédito: CET, prazo e total
          a pagar, no <Link href="/calculadoras/comparador-de-propostas/">comparador de propostas</Link>{" "}
          e no guia <Link href="/juros-e-cet/o-que-e-cet/">o que é CET</Link>.
        </p>

        <h2 id="metodologia-orcamento">Como calculamos?</h2>
        <p>
          Aritmética transparente, no seu navegador: <strong>folga antes</strong> = renda líquida
          − despesas − parcelas existentes − provisões; <strong>folga depois</strong> = folga
          antes − nova parcela; se você definir uma margem desejada, <strong>folga final</strong>{" "}
          = folga depois − margem. Os percentuais (parcela/renda, parcela/folga, compromissos
          totais/renda) são contexto, nunca veredito — não usamos nenhuma regra fixa de
          percentual &ldquo;seguro&rdquo;, porque ela não existe: o conforto de uma parcela
          depende do que cada orçamento já carrega. A ferramenta não conhece todas as despesas
          futuras, riscos, variações de renda ou condições pessoais; ela organiza os valores que
          você informa. Referências: material de cidadania financeira do Banco Central sobre
          orçamento pessoal e familiar e a{" "}
          <a
            href="https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14181.htm"
            rel="noopener noreferrer"
            target="_blank"
          >
            Lei nº 14.181/2021
          </a>{" "}
          (superendividamento). Encontrou algo errado? Veja a{" "}
          <Link href="/politica-de-correcoes/">política de correções</Link>. Metodologia revisada
          em 27/08/2026.
        </p>
      </section>
    </div>
  );
}
