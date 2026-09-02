/**
 * A ponte entre o guia de uma cidade e a Central de Decisões.
 *
 * POR QUE ELA EXISTE
 *
 * Quem busca "empréstimo em Sumaré" tem uma pergunta local — *onde resolver
 * perto de mim* — e o guia responde: Procon municipal, microcrédito público,
 * canais oficiais. Só que resolver **onde** raramente encerra o assunto. A
 * pessoa continua com a dívida, a proposta ou a desconfiança que a levou a
 * pesquisar. Até aqui, a página terminava nas fontes consultadas e a deixava
 * sozinha com isso.
 *
 * TRÊS DECISÕES QUE ESTE COMPONENTE CARREGA
 *
 * 1. QUATRO SITUAÇÕES, NÃO DEZ. Repetir a Central inteira no fim de um guia
 *    local devolveria a parede de opções que ela existe para desfazer. Entram
 *    só as situações que a página local NÃO resolve — e `ajuda-local` fica de
 *    fora por ser exatamente a página em que a pessoa está.
 *
 * 2. DEPOIS DO CONTEÚDO LOCAL, NUNCA ANTES. A ponte aparece após o Mapa
 *    Financeiro da cidade. Colocá-la no topo trocaria a promessa da página
 *    (informação local verificada) por um menu de calculadoras, que é o
 *    contrário do que a pessoa buscou.
 *
 * 3. TEXTO CURTO, PORQUE ELE SE REPETE EM TODAS AS CIDADES. A política local
 *    proíbe páginas que só trocam o nome do município, e a auditoria mede
 *    isso: os guias hoje têm similaridade máxima de 0,15 entre pares, contra
 *    um limite de 0,45 para aviso. Um bloco compartilhado consome parte dessa
 *    margem — pequena, medida e monitorada pela auditoria a cada build, mas
 *    real. É o motivo de este bloco não crescer.
 */
import Link from "next/link";
import { getLocalBridgeJourneys, journeyAnchor } from "@/lib/journeys/registry";

export function LocalJourneyBridge({ localityName }: { localityName: string }) {
  const journeys = getLocalBridgeJourneys();
  if (journeys.length === 0) return null;

  return (
    <section
      data-track-area="ponte-local"
      data-track="ponte-decisoes"
      aria-labelledby="ponte-decisoes"
      className="mt-10 rounded-2xl border border-brand-border bg-brand-surface-soft p-5 md:p-6"
      data-no-ads="decision-hub"
    >
      <h2 id="ponte-decisoes" className="font-serif text-xl font-bold text-brand-navy">
        E se a dúvida for sobre a decisão em si?
      </h2>
      <p className="mt-2 max-w-3xl leading-relaxed text-brand-text">
        Os canais acima resolvem <strong>onde pedir ajuda em {localityName}</strong>.
        Se o que trava é a decisão — pegar ou não pegar, aceitar ou comparar,
        quitar ou esperar —, escolha o que está acontecendo e veja quais contas
        ajudam.
      </p>

      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {journeys.map((journey) => (
          <li key={journey.id}>
            <Link
              href={`/decisoes-financeiras/#${journeyAnchor(journey.id)}`}
              className="flex h-full items-center rounded-xl border border-brand-border bg-white px-4 py-3 text-sm font-semibold leading-snug text-brand-navy transition hover:border-brand-teal hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy"
            >
              {journey.moment}
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-sm">
        <Link
          href="/decisoes-financeiras/"
          className="font-semibold text-brand-teal-dark underline underline-offset-2"
        >
          Ver todos os momentos
        </Link>
        <span className="text-brand-muted">
          {" "}— nenhuma etapa é obrigatória, e as contas rodam no seu navegador.
        </span>
      </p>
    </section>
  );
}
