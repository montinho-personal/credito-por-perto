import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { itemListJsonLd, webPageJsonLd } from "@/lib/schema/jsonld";
import { getJourneys, journeyAnchor } from "@/lib/journeys/registry";
import { getTools, getToolsBySituation } from "@/lib/tools/registry";
import { MomentGrid } from "@/components/journeys/MomentGrid";
import { JourneySection } from "@/components/journeys/JourneySection";
import { HubResume } from "@/components/journeys/HubResume";

export const metadata: Metadata = buildMetadata({
  title: "Central de Decisões Financeiras: qual é o seu momento?",
  description:
    "Você não precisa saber qual calculadora usar. Escolha o que está acontecendo — pegar crédito, recebi proposta, várias dívidas, acho que é golpe — e veja o próximo passo.",
  path: "/decisoes-financeiras/",
});

/**
 * CENTRAL DE DECISÕES FINANCEIRAS
 * ============================================================================
 *
 * A camada que faltava entre o problema do leitor e as catorze ferramentas.
 *
 * O hub `/calculadoras/` continua existindo e continua sendo o catálogo. Ele
 * resolve bem o caso de quem já sabe o que procura, e resolve mal o caso mais
 * comum: alguém que sabe descrever a situação ("recebi uma proposta e não sei
 * se está cara") e não sabe o nome da conta que responde a ela. Esta página
 * inverte a entrada — situação primeiro, ferramenta depois.
 *
 * POR QUE TUDO NUMA PÁGINA SÓ
 *
 * As dez jornadas estão inteiras neste HTML, cada uma numa âncora. Nenhuma
 * tem URL própria, e isso foi decidido, não esquecido:
 *
 * - dez URLs de jornada seriam dez páginas finas disputando as mesmas
 *   consultas que os artigos já respondem com profundidade — "estou
 *   endividado, por onde começo?" é a promessa de `/como-sair-das-dividas/`,
 *   e uma jornada com quatro botões não a serve melhor;
 * - passo em URL separada é o padrão que transforma orientação em funil de
 *   pageview. Aqui a página inteira é servida de uma vez e o leitor decide
 *   quanto dela vai usar;
 * - âncora funciona sem JavaScript. A Central inteira — cards, jornadas,
 *   passos, links — é HTML estático navegável e rastreável. O JavaScript só
 *   acrescenta memória de sessão e medição.
 *
 * ÁREA PROTEGIDA DE ANÚNCIO
 * A página inteira carrega `data-no-ads`. Um anúncio entre a pergunta e os
 * cards, ou dentro de uma jornada, seria lido como uma das opções sugeridas —
 * e no caminho de quem escolheu "estou com dívidas" ou "acho que é golpe" o
 * dano é óbvio. Ver docs/adsense-protected-areas.md.
 */
export default function DecisoesFinanceirasPage() {
  const journeys = getJourneys();
  const groups = getToolsBySituation();
  const tools = getTools();

  const resumeIndex = journeys.map((j) => ({
    id: j.id,
    shortTitle: j.shortTitle,
    anchor: journeyAnchor(j.id),
  }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8" data-no-ads="decision-hub">
      <JsonLd
        data={webPageJsonLd(
          "Central de Decisões Financeiras",
          "Escolha a situação financeira que você está vivendo e veja quais ferramentas ajudam a organizar os números dessa decisão.",
          "/decisoes-financeiras/",
        )}
      />
      <JsonLd
        data={itemListJsonLd(
          journeys.map((journey) => ({
            name: journey.moment,
            path: `/decisoes-financeiras/#${journeyAnchor(journey.id)}`,
          })),
        )}
      />
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: "Central de decisões", path: "/decisoes-financeiras/" },
        ]}
      />

      {/* ---------------------------------------------------------------- *
       * Hero
       * ---------------------------------------------------------------- */}
      <header className="mt-6">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-teal-dark">
          Central de Decisões Financeiras
        </p>
        <h1 className="mt-2 font-serif text-3xl font-bold leading-tight text-brand-navy md:text-4xl">
          Qual é o seu momento financeiro?
        </h1>
        <p className="mt-3 max-w-3xl text-lg leading-relaxed text-brand-muted">
          <strong>
            Você não precisa saber qual ferramenta usar. Só precisa saber o que
            está tentando resolver.
          </strong>{" "}
          Conte o que está acontecendo e veja qual conta ajuda nessa decisão.
        </p>
        <p className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <a
            href="#momentos"
            className="inline-flex rounded-lg bg-brand-navy px-5 py-3 font-semibold text-white transition hover:bg-brand-navy/90"
          >
            Escolher meu momento
          </a>
          <Link
            href="/calculadoras/"
            className="inline-flex items-center py-2 font-semibold text-brand-teal-dark underline underline-offset-2"
          >
            Já sei o que procuro: ver todas as ferramentas
          </Link>
        </p>
      </header>

      <HubResume journeys={resumeIndex} />

      {/* ---------------------------------------------------------------- *
       * Storytelling — curto, antes da escolha
       * ---------------------------------------------------------------- */}
      <section
        aria-labelledby="por-que-existe"
        className="mt-10 rounded-2xl border border-brand-border bg-brand-surface-soft p-6"
      >
        <h2 id="por-que-existe" className="font-serif text-xl font-bold text-brand-navy">
          Dinheiro traz decisões
        </h2>
        <p className="mt-2 max-w-3xl leading-relaxed text-brand-text">
          Pegar ou não pegar. Aceitar ou comparar. Parcelar ou pagar à vista.
          Renegociar ou continuar. Quitar ou esperar. Atacar uma dívida ou
          outra. Quase sempre essas decisões chegam cercadas de taxa, parcela,
          prazo, desconto e custo total — números difíceis de comparar no
          momento em que a resposta é pedida.
        </p>
        <p className="mt-3 max-w-3xl leading-relaxed text-brand-text">
          Foi para isso que estas ferramentas existem.{" "}
          <strong>Você diz qual decisão está enfrentando; elas colocam os
          números em ordem.</strong> Uma decisão financeira de cada vez.
        </p>
      </section>

      {/* ---------------------------------------------------------------- *
       * Porta 1 — os momentos
       * ---------------------------------------------------------------- */}
      <section aria-labelledby="momentos" className="mt-12 scroll-mt-24" id="momentos">
        <h2
          id="momentos-titulo"
          className="font-serif text-2xl font-bold text-brand-navy"
        >
          O que está acontecendo com você agora?
        </h2>
        <p className="mt-2 max-w-3xl leading-relaxed text-brand-muted">
          Talvez você esteja pensando em pegar um empréstimo. Talvez já tenha
          recebido uma proposta. Talvez esteja tentando sair das dívidas, ou
          decidindo entre pagar agora e parcelar. Cada situação pede uma conta
          diferente — escolha onde você está hoje.
        </p>
        <MomentGrid headingId="momentos-titulo" />
      </section>

      {/* ---------------------------------------------------------------- *
       * As jornadas, inteiras, no mesmo HTML
       * ---------------------------------------------------------------- */}
      <section aria-labelledby="caminhos" className="mt-14">
        <h2 id="caminhos" className="font-serif text-2xl font-bold text-brand-navy">
          Os caminhos, passo a passo
        </h2>
        <p className="mt-2 max-w-3xl leading-relaxed text-brand-muted">
          Nenhum caminho é obrigatório e nenhum precisa ser feito inteiro. Use
          só o que ajuda na sua decisão — e encerre quando já tiver o que
          precisava.
        </p>
        {journeys.map((journey) => (
          <JourneySection key={journey.id} journey={journey} />
        ))}
      </section>

      {/* ---------------------------------------------------------------- *
       * Como funciona
       * ---------------------------------------------------------------- */}
      <section
        aria-labelledby="como-funciona"
        className="mt-14 rounded-2xl border border-brand-border bg-white p-6"
      >
        <h2 id="como-funciona" className="font-serif text-2xl font-bold text-brand-navy">
          Como funciona
        </h2>
        <ol className="mt-5 grid gap-5 md:grid-cols-3">
          <li>
            <p className="font-serif text-base font-bold text-brand-navy">
              1. Escolha sua situação
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-brand-muted">
              Não precisa saber o nome da ferramenta, nem o que significa CET.
              Basta reconhecer a frase que descreve o seu momento.
            </p>
          </li>
          <li>
            <p className="font-serif text-base font-bold text-brand-navy">
              2. Faça a análise
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-brand-muted">
              As contas rodam no seu navegador. Sem cadastro, sem CPF e sem
              enviar nada do que você digita para lugar nenhum.
            </p>
          </li>
          <li>
            <p className="font-serif text-base font-bold text-brand-navy">
              3. Veja o próximo passo
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-brand-muted">
              No fim de cada ferramenta há uma sugestão de continuidade — e a
              opção de encerrar, que é um desfecho tão válido quanto seguir.
            </p>
          </li>
        </ol>
      </section>

      {/* ---------------------------------------------------------------- *
       * Porta 2 — catálogo completo
       * ---------------------------------------------------------------- */}
      <section aria-labelledby="catalogo" className="mt-14">
        <h2 id="catalogo" className="font-serif text-2xl font-bold text-brand-navy">
          Todas as ferramentas financeiras gratuitas
        </h2>
        <p className="mt-2 max-w-3xl leading-relaxed text-brand-muted">
          Para quem já sabe o que procura: as {tools.length} ferramentas do
          portal, agrupadas por situação. Nenhuma pede cadastro ou CPF.
        </p>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {groups.map((group) => (
            <div key={group.situation.id}>
              <h3 className="text-sm font-semibold text-brand-navy">
                {group.situation.label}
              </h3>
              <ul className="mt-2 space-y-1.5">
                {group.tools.map((tool) => (
                  <li key={tool.id}>
                    <Link
                      href={tool.route}
                      className="text-sm text-brand-text underline underline-offset-2 hover:text-brand-navy"
                    >
                      {tool.shortName}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-6 text-sm">
          <Link
            href="/calculadoras/"
            className="font-semibold text-brand-teal-dark underline underline-offset-2"
          >
            Ver o catálogo completo, com a explicação de cada uma
          </Link>
        </p>
      </section>

      {/* ---------------------------------------------------------------- *
       * Confiança e limites
       * ---------------------------------------------------------------- */}
      <section
        aria-labelledby="confianca"
        className="article-body mt-14 border-t border-brand-border pt-8"
      >
        <h2 id="confianca">Ferramentas para entender, não para empurrar uma oferta</h2>
        <p>
          Estas ferramentas organizam informações, cálculos e referências
          oficiais. Elas <strong>não escolhem banco, empréstimo ou acordo por
          você</strong>, não indicam instituição, não aprovam nem negam crédito
          e não produzem nota, score ou classificação de pessoa. Escolher um
          momento aqui descreve uma situação de hoje — não define quem você é.
        </p>
        <p>
          A escolha das ferramentas de cada caminho é editorial e determinística:
          está declarada em um registro que qualquer pessoa pode conferir, não
          depende de perfil e é a mesma para todo mundo que escolhe aquele
          momento. Como as contas são feitas, e com quais fontes, está na{" "}
          <Link href="/metodologia/">metodologia</Link>.
        </p>
        <p>
          <strong>Privacidade:</strong> as ferramentas calculam no seu
          navegador. Valores, taxas e respostas não são enviados a nenhum
          servidor e não alimentam analytics. Se você percorre um caminho, o
          que fica guardado é apenas o identificador do caminho e das etapas —
          na sessão do seu navegador, apagável a qualquer momento pelo botão
          &ldquo;apagar meu progresso&rdquo;, e some sozinho quando você fecha a
          aba. Detalhes na{" "}
          <Link href="/politica-de-privacidade/">política de privacidade</Link>.
        </p>
        <p className="text-sm">
          As ferramentas ajudam a organizar informações e cálculos, mas não
          substituem a leitura do contrato nem orientação jurídica ou financeira
          individual quando o caso pedir.
        </p>
      </section>
    </div>
  );
}
