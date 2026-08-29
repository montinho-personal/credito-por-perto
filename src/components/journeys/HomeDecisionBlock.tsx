/**
 * O bloco da home que abre a Central.
 *
 * Ele fica logo abaixo do hero, antes de qualquer lista de modalidades ou de
 * artigos, porque a pergunta que ele faz vem antes de todas elas: quem chega
 * na home raramente sabe se o que procura é um guia, uma calculadora ou um
 * canal de reclamação — sabe apenas o que está acontecendo.
 *
 * São sete situações, não catorze ferramentas. A home nunca deve virar
 * vitrine de calculadora: problema primeiro, ferramenta depois.
 */
import Link from "next/link";
import { getHomeJourneys, journeyAnchor } from "@/lib/journeys/registry";

export function HomeDecisionBlock() {
  const journeys = getHomeJourneys();

  return (
    <section
      aria-labelledby="comece-pela-situacao"
      className="mt-14 rounded-2xl border border-brand-border bg-brand-surface-soft p-6 md:p-8"
      data-no-ads="decision-hub"
    >
      <p className="text-sm font-semibold uppercase tracking-wide text-brand-teal-dark">
        Central de Decisões Financeiras
      </p>
      <h2
        id="comece-pela-situacao"
        className="mt-1 font-serif text-2xl font-bold text-brand-navy"
      >
        Não sabe por onde começar?
      </h2>
      <p className="mt-2 max-w-2xl leading-relaxed text-brand-muted">
        Escolha o que está acontecendo agora.{" "}
        <strong>
          Você não precisa saber qual ferramenta usar — só o que está tentando
          resolver.
        </strong>
      </p>

      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

      <p className="mt-5 text-sm">
        <Link
          href="/decisoes-financeiras/"
          className="font-semibold text-brand-teal-dark underline underline-offset-2"
        >
          Ver todos os caminhos
        </Link>
        <span className="text-brand-muted"> · </span>
        <Link
          href="/calculadoras/"
          className="font-semibold text-brand-navy underline underline-offset-2"
        >
          Já sei o que procuro: ver as ferramentas
        </Link>
      </p>
    </section>
  );
}
