import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { itemListJsonLd, webPageJsonLd } from "@/lib/schema/jsonld";
import { getTools, getToolsBySituation } from "@/lib/tools/registry";

export const metadata: Metadata = buildMetadata({
  title: "Ferramentas de crédito gratuitas, sem cadastro",
  description:
    "Todas as calculadoras e verificações do Crédito por Perto reunidas por situação: antes de contratar, com a dívida correndo, para entender os números e quando algo parece golpe.",
  path: "/calculadoras/",
});

/**
 * Hub de ferramentas.
 *
 * A grade anterior listava as doze ferramentas em ordem de criação, sem dizer
 * a quem cada uma servia — o leitor tinha de adivinhar pelo nome. Agora o
 * agrupamento segue a situação em que a pessoa chega ("já tenho a dívida",
 * "desconfiei de algo"), porque é assim que a dúvida aparece na cabeça dela.
 *
 * A página inteira é montada a partir de `data/tool-registry.json`: ferramenta
 * nova aparece aqui sem ninguém precisar lembrar de editar este arquivo.
 */
export default function CalculadorasPage() {
  const groups = getToolsBySituation();
  const tools = getTools();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <JsonLd
        data={webPageJsonLd(
          "Ferramentas de crédito",
          "Calculadoras e verificações gratuitas para decisões de crédito, organizadas pela situação do leitor.",
          "/calculadoras/",
        )}
      />
      <JsonLd
        data={itemListJsonLd(
          tools.map((tool) => ({ name: tool.name, path: tool.route })),
        )}
      />
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: "Ferramentas", path: "/calculadoras/" },
        ]}
      />

      <header className="mt-6">
        <h1 className="font-serif text-3xl font-bold leading-tight text-brand-navy md:text-4xl">
          Ferramentas de crédito
        </h1>
        <p className="mt-3 max-w-3xl text-lg leading-relaxed text-brand-muted">
          {tools.length} ferramentas gratuitas para você conferir números e
          instituições antes de decidir.{" "}
          <strong>
            Nenhuma pede cadastro, CPF ou dado pessoal, e nada do que você digita
            sai do seu aparelho
          </strong>{" "}
          — os cálculos rodam no seu navegador. Nenhuma delas avalia, promete ou
          nega crédito, e nenhuma indica instituição.
        </p>
      </header>

      <nav aria-label="Situações" className="mt-8">
        <p className="text-sm font-semibold text-brand-navy">Qual é a sua situação?</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {groups.map((group) => (
            <li key={group.situation.id}>
              <a
                href={`#${group.situation.id}`}
                className="inline-flex rounded-full border border-brand-border bg-white px-4 py-2 text-sm font-medium text-brand-navy transition hover:border-brand-teal hover:text-brand-teal-dark"
              >
                {group.situation.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {groups.map((group) => (
        <section
          key={group.situation.id}
          id={group.situation.id}
          aria-labelledby={`${group.situation.id}-titulo`}
          className="mt-12 scroll-mt-24"
        >
          <h2
            id={`${group.situation.id}-titulo`}
            className="font-serif text-2xl font-bold text-brand-navy"
          >
            {group.situation.label}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-brand-muted">
            {group.situation.lead}
          </p>

          <ul className="mt-5 grid gap-4 md:grid-cols-2">
            {group.tools.map((tool) => (
              <li key={tool.id}>
                <Link
                  href={tool.route}
                  className="flex h-full flex-col rounded-xl border border-brand-border bg-white p-5 transition hover:border-brand-teal hover:shadow-sm"
                >
                  <span className="font-serif text-lg font-bold leading-snug text-brand-navy">
                    {tool.question}
                  </span>
                  <span className="mt-2 flex-1 text-sm leading-relaxed text-brand-muted">
                    {tool.whenItHelps}
                  </span>
                  <span className="mt-4 text-sm font-semibold text-brand-teal-dark">
                    {tool.cta} <span aria-hidden="true">→</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {/*
        O Mapa Financeiro não é uma calculadora e não tem URL própria: vive
        dentro de cada guia local, para não competir com a página que já tem
        histórico. A consequência foi ficar invisível — quem procurava por ele
        aqui não achava. Esta porta resolve isso sem criar URL concorrente.
      */}
      <section
        aria-labelledby="ajuda-na-cidade"
        className="mt-12 rounded-2xl border border-brand-border bg-brand-surface-soft p-6"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-teal-dark">
          Não é calculadora — é atendimento
        </p>
        <h2
          id="ajuda-na-cidade"
          className="mt-2 font-serif text-2xl font-bold text-brand-navy"
        >
          Onde pedir ajuda na sua cidade
        </h2>
        <p className="mt-2 max-w-3xl leading-relaxed text-brand-muted">
          Cada guia local traz o <strong>Mapa Financeiro da cidade</strong>: os
          serviços públicos e gratuitos que atendem quem mora ali quando o
          assunto é dívida, cobrança ou contrato de crédito — Procon municipal,
          programas de renegociação, Defensoria e canais federais, com fonte
          oficial e data de verificação em cada um. Não há empresa, nem ranking,
          nem ordem de preferência.
        </p>
        <Link
          href="/emprestimos/guias-locais/"
          className="mt-4 inline-flex items-center gap-1 rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-navy/90"
        >
          Ver os guias por cidade <span aria-hidden="true">→</span>
        </Link>
      </section>

      <section aria-labelledby="como-usamos" className="article-body mt-14 border-t border-brand-border pt-8">
        <h2 id="como-usamos">O que estas ferramentas fazem — e o que não fazem</h2>
        <p>
          Todas elas fazem aritmética que você poderia conferir no papel, e
          mostram a conta em vez de esconder. Nenhuma decide por você: não existe
          aqui &ldquo;melhor opção&rdquo;, nota, ranking, score ou indicação de
          instituição. Quando o número oficial é de terceiro — o saldo de
          quitação, por exemplo — a ferramenta pede o número em vez de estimá-lo,
          porque falsa precisão atrapalha mais que a ausência do dado.
        </p>
        <p>
          <strong>Privacidade:</strong> os cálculos rodam no seu navegador.
          Valores, taxas e respostas não são enviados a nenhum servidor, não
          alimentam analytics e não ficam salvos. Nenhuma ferramenta pede CPF,
          cadastro ou conta.
        </p>
        <p>
          Se você quer entender o assunto antes de calcular, comece pelo{" "}
          <Link href="/emprestimos/guia-completo-de-emprestimo/">
            guia completo do empréstimo
          </Link>{" "}
          ou pelo{" "}
          <Link href="/juros-e-cet/o-que-e-cet/">que é CET</Link>. Encontrou algo
          errado em alguma conta? A{" "}
          <Link href="/politica-de-correcoes/">política de correções</Link>{" "}
          explica como avisar.
        </p>
      </section>
    </div>
  );
}
