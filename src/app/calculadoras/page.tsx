import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { collectionPageJsonLd, itemListJsonLd } from "@/lib/schema/jsonld";
import { journeyAnchor } from "@/lib/journeys/registry";
import {
  getFeaturedTools,
  getToolPaths,
  getToolSearchEntries,
  getTools,
  getToolsByCategory,
} from "@/lib/tools/registry";
import { ToolCard } from "@/components/tools/ToolCard";
import { ToolFinder } from "@/components/tools/ToolFinder";
import { SituationPaths } from "@/components/tools/SituationPaths";

const PATH = "/calculadoras/";
const TITLE = "Calculadoras de empréstimo, financiamento e juros";
const DESCRIPTION =
  "Simule empréstimos e financiamentos, compare propostas, calcule CET, IOF, juros e parcelas e organize dívidas. Grátis, sem cadastro e sem CPF.";

export const metadata: Metadata = buildMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

/**
 * CENTRAL DE CALCULADORAS E FERRAMENTAS
 * ============================================================================
 *
 * Três portas, porque há três jeitos de chegar aqui:
 *
 *   1. busca: quem sabe mais ou menos o que quer ("CET", "parcela de carro");
 *   2. situação: quem só sabe descrever a dúvida ("vou financiar um imóvel");
 *   3. catálogo por assunto: quem quer ver tudo.
 *
 * Nenhuma obriga a passar pela outra. Primeiro a busca, a situação e seis
 * destaques; o catálogo completo vem depois (revelação progressiva). Com 50
 * ou 100 ferramentas, a estrutura é a mesma: mais cards dentro das mesmas
 * categorias, ou uma categoria a mais no registro, sem tocar neste arquivo.
 *
 * TUDO VEM DO REGISTRO. Cards, categorias, destaques, caminhos e a busca leem
 * `data/tool-registry.json`. Nenhuma rota de ferramenta é escrita aqui.
 *
 * A Central de Decisões (/decisoes-financeiras/) continua sendo a porta de
 * quem tem uma situação e quer o próximo passo, com jornada inteira. Esta
 * página é o catálogo; os caminhos por situação daqui apontam para lá.
 */
export default function CalculadorasPage() {
  const tools = getTools();
  const groups = getToolsByCategory();
  const featured = getFeaturedTools();
  const paths = getToolPaths().map((p) => ({
    id: p.id,
    label: p.label,
    lead: p.lead,
    journeyHref: `/decisoes-financeiras/#${journeyAnchor(p.journeyId)}`,
    tools: p.tools.map((t) => ({ id: t.id, name: t.name, route: t.route, question: t.question, cta: t.cta, type: t.type })),
  }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <JsonLd data={collectionPageJsonLd(TITLE, DESCRIPTION, PATH)} />
      <JsonLd data={itemListJsonLd(tools.map((tool) => ({ name: tool.name, path: tool.route })))} />
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: "Calculadoras", path: PATH },
        ]}
      />

      {/* ---------------------------------------------------------------- *
       * Hero: o que existe, para quem, sem cadastro, sem indicação de banco
       * ---------------------------------------------------------------- */}
      <header className="mt-6">
        <h1 className="font-serif text-3xl font-bold leading-tight text-brand-navy md:text-4xl">
          Calculadoras de empréstimo, financiamento e juros
        </h1>
        <p className="mt-3 max-w-3xl text-lg leading-relaxed text-brand-muted">
          {tools.length} ferramentas para entender parcelas, juros, financiamentos, dívidas e propostas com números claros. Você
          informa os dados, a conta aparece inteira e a decisão continua sendo sua.
        </p>
        <ToolFinder
          entries={getToolSearchEntries()}
          featured={featured.map((t) => t.id)}
          examples={["financiamento de 300 mil", "parcela de carro", "CET", "3% ao mês", "quitar dívida", "banco é verdadeiro"]}
        />
        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-brand-muted" aria-label="Como as ferramentas funcionam">
          <li>Sem cadastro</li>
          <li>Sem CPF</li>
          <li>Cálculo no seu aparelho</li>
          <li>Sem indicação de banco</li>
        </ul>
      </header>

      {/* ---------------------------------------------------------------- *
       * Porta 2: situação
       * ---------------------------------------------------------------- */}
      <section aria-labelledby="resolver" className="mt-12">
        <h2 id="resolver" className="font-serif text-2xl font-bold text-brand-navy">
          O que você quer resolver?
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-brand-muted">
          Escolha a situação e veja por onde começar. Você não precisa saber o nome de nenhuma conta.
        </p>
        <SituationPaths paths={paths} headingId="resolver" />
      </section>

      {/* ---------------------------------------------------------------- *
       * Destaques: seleção editorial, sem "mais usadas" sem dado
       * ---------------------------------------------------------------- */}
      <section aria-labelledby="destaques" className="mt-12">
        <h2 id="destaques" className="font-serif text-2xl font-bold text-brand-navy">
          Ferramentas em destaque
        </h2>
        <ul data-track-area="destaques-ferramentas" data-track-event="calculator_card_click" className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((tool) => (
            <li key={tool.id}>
              <ToolCard tool={tool} compact />
            </li>
          ))}
        </ul>
      </section>

      {/* ---------------------------------------------------------------- *
       * Porta 3: catálogo por assunto
       * ---------------------------------------------------------------- */}
      <nav aria-label="Categorias" data-track-area="cards-ferramentas" className="mt-12 border-t border-brand-border pt-8">
        <p className="text-sm font-semibold text-brand-navy">Todas as ferramentas, por assunto</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {groups.map((group) => (
            <li key={group.category.id}>
              <a
                href={`#${group.category.id}`}
                data-track-event="calculator_category_select"
                data-track={group.category.id}
                className="inline-flex min-h-11 items-center rounded-full border border-brand-border bg-white px-4 text-sm font-medium text-brand-navy transition hover:border-brand-teal hover:text-brand-teal-dark"
              >
                {group.category.label} <span className="ml-1.5 text-xs text-brand-muted">{group.tools.length}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div data-track-area="cards-ferramentas" data-track-event="calculator_card_click">
        {groups.map((group) => (
          <section key={group.category.id} id={group.category.id} aria-labelledby={`${group.category.id}-titulo`} className="mt-12 scroll-mt-24">
            <h2 id={`${group.category.id}-titulo`} className="font-serif text-2xl font-bold text-brand-navy">
              {group.category.label}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-brand-muted">{group.category.lead}</p>
            <ul className="mt-5 grid gap-4 md:grid-cols-2">
              {group.tools.map((tool) => (
                <li key={tool.id}>
                  <ToolCard tool={tool} heading />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {/* ---------------------------------------------------------------- *
       * Não sabe qual usar? Central de Decisões
       * ---------------------------------------------------------------- */}
      <section aria-labelledby="nao-sei" data-track-area="chamada-jornada" className="mt-14 rounded-2xl border border-brand-border bg-brand-teal-soft p-6">
        <h2 id="nao-sei" className="font-serif text-2xl font-bold text-brand-navy">
          Não sabe qual ferramenta usar?
        </h2>
        <p className="mt-2 max-w-3xl leading-relaxed text-brand-text">
          Aqui é o catálogo: serve para quem sabe o que quer calcular. Se você tem uma situação e não sabe o próximo passo, a
          Central de Decisões pergunta o que está acontecendo e monta o caminho, passo a passo, com as mesmas ferramentas.
        </p>
        <Link
          href="/decisoes-financeiras/"
          className="mt-4 inline-flex min-h-11 items-center gap-1 rounded-lg bg-brand-navy px-4 text-sm font-semibold text-white transition hover:bg-brand-navy/90"
        >
          Mostrar meu próximo passo <span aria-hidden="true">→</span>
        </Link>
      </section>

      {/*
        O Mapa Financeiro não é uma calculadora e não tem URL própria: vive
        dentro de cada guia local, para não competir com a página que já tem
        histórico. Esta porta evita que ele fique invisível.
      */}
      <section aria-labelledby="ajuda-na-cidade" data-track-area="ponte-local" className="mt-8 rounded-2xl border border-brand-border bg-brand-surface-soft p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-teal-dark">Não é calculadora, é atendimento</p>
        <h2 id="ajuda-na-cidade" className="mt-2 font-serif text-2xl font-bold text-brand-navy">
          Onde pedir ajuda na sua cidade
        </h2>
        <p className="mt-2 max-w-3xl leading-relaxed text-brand-muted">
          Cada guia local traz o <strong>Mapa Financeiro da cidade</strong>: os serviços públicos e gratuitos que atendem quem mora
          ali quando o assunto é dívida, cobrança ou contrato de crédito. Procon municipal, programas de renegociação, Defensoria e
          canais federais, com fonte oficial e data de verificação em cada um. Não há empresa, nem ranking, nem ordem de preferência.
        </p>
        <Link
          href="/emprestimos/guias-locais/"
          className="mt-4 inline-flex min-h-11 items-center gap-1 rounded-lg border border-brand-navy px-4 text-sm font-semibold text-brand-navy transition hover:bg-white"
        >
          Ver os guias por cidade <span aria-hidden="true">→</span>
        </Link>
      </section>

      {/* ---------------------------------------------------------------- *
       * Como fazemos as contas: metodologia, fontes, privacidade, correções
       * ---------------------------------------------------------------- */}
      <section aria-labelledby="como-fazemos" data-track-area="conteudo" className="mt-14 border-t border-brand-border pt-8">
        <h2 id="como-fazemos" className="font-serif text-2xl font-bold text-brand-navy">
          Como fazemos as contas
        </h2>
        <dl className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="font-semibold text-brand-navy">Metodologia</dt>
            <dd className="mt-1 text-sm leading-relaxed text-brand-muted">
              Toda ferramenta faz uma aritmética que dá para conferir no papel e mostra a conta em vez de esconder: fórmula,
              premissas, arredondamento e limitações estão na própria página. Nenhuma decide por você: não existe aqui nota,
              ranking, score ou indicação de instituição.{" "}
              <Link href="/metodologia/" className="font-semibold text-brand-teal-dark underline underline-offset-2">
                Ver a metodologia
              </Link>
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-brand-navy">Fontes</dt>
            <dd className="mt-1 text-sm leading-relaxed text-brand-muted">
              Regras e taxas vêm de fonte oficial, com data: Banco Central, Conselho Monetário Nacional, legislação federal e Receita
              Federal. Quando a ferramenta usa a média do Banco Central, ela mostra o mês de referência. Quando o número oficial é
              de terceiro, como o saldo de quitação, a ferramenta pede o número em vez de estimá-lo.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-brand-navy">Privacidade</dt>
            <dd className="mt-1 text-sm leading-relaxed text-brand-muted">
              Os cálculos rodam no seu navegador. Valores, taxas, renda e resultados não são enviados a servidor nenhum, não
              alimentam medição de audiência e não ficam salvos. Nenhuma ferramenta pede CPF, cadastro ou conta.{" "}
              <Link href="/politica-de-privacidade/" className="font-semibold text-brand-teal-dark underline underline-offset-2">
                Política de privacidade
              </Link>
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-brand-navy">Correções</dt>
            <dd className="mt-1 text-sm leading-relaxed text-brand-muted">
              Conteúdo e ferramentas da Equipe Editorial do Crédito por Perto, que não concede crédito, não faz análise de crédito e
              não recebe de instituição por indicação. Encontrou uma conta errada? A{" "}
              <Link href="/politica-de-correcoes/" className="font-semibold text-brand-teal-dark underline underline-offset-2">
                política de correções
              </Link>{" "}
              explica como avisar.
            </dd>
          </div>
        </dl>
      </section>

      {/* ---------------------------------------------------------------- *
       * Conteúdo relacionado
       * ---------------------------------------------------------------- */}
      <section aria-labelledby="relacionado" data-track-area="relacionados" className="mt-12">
        <h2 id="relacionado" className="font-serif text-2xl font-bold text-brand-navy">
          Para entender antes de calcular
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {([
            ["Guia completo do empréstimo", "/emprestimos/guia-completo-de-emprestimo/"],
            ["O que é CET e por que ele compara propostas", "/juros-e-cet/o-que-e-cet/"],
            ["Como comparar propostas de crédito", "/organizacao-financeira/como-comparar-propostas-de-credito/"],
            ["Taxa mensal e taxa anual: como converter", "/juros-e-cet/taxa-mensal-e-taxa-anual/"],
            ["Como sair das dívidas", "/organizacao-financeira/como-sair-das-dividas/"],
            ["Como identificar golpes de empréstimo", "/credito-seguro/como-identificar-golpes-de-emprestimo/"],
          ] as Array<[string, string]>).map(([label, href]: [string, string]) => (
            <li key={href}>
              <Link href={href} className="block rounded-xl border border-brand-border bg-white px-4 py-3 text-sm font-semibold text-brand-navy transition hover:border-brand-teal">
                {label} <span aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
