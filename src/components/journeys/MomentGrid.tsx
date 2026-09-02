/**
 * Os cards de entrada da Central — a primeira e mais importante escolha.
 *
 * Cada card nomeia uma SITUAÇÃO, nunca uma ferramenta. Quem chega dizendo
 * "recebi uma proposta" não precisa saber que existe um comparador de CET,
 * um radar de taxas e uma consulta ao Banco Central: precisa reconhecer a
 * própria frase e clicar nela.
 *
 * Cada card é um link de âncora para a seção da jornada, que já está no HTML
 * da mesma página. Isso resolve três coisas de uma vez: funciona sem
 * JavaScript, não cria URL fina para cada jornada e o buscador enxerga o
 * caminho inteiro. E mantém a promessa de 1 a 3 escolhas — um clique para
 * chegar ao caminho, outro para chegar à ferramenta.
 */
import { getJourneyFamilies, getJourneys, journeyAnchor } from "@/lib/journeys/registry";

export function MomentGrid({ headingId }: { headingId: string }) {
  const journeys = getJourneys();
  const families = getJourneyFamilies();

  return (
    <div data-track-area="central-decisoes" aria-labelledby={headingId}>
      {families.map((family) => {
        const inFamily = journeys.filter((j) => j.family === family.id);
        if (inFamily.length === 0) return null;

        return (
          <section key={family.id} className="mt-8 first:mt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-brand-teal-dark">
              {family.label}
            </h3>
            <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {inFamily.map((journey) => (
                <li key={journey.id}>
                  <a
                    href={`#${journeyAnchor(journey.id)}`}
                    className="flex h-full flex-col rounded-xl border border-brand-border bg-white p-5 transition hover:border-brand-teal hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy"
                  >
                    <span className="font-serif text-lg font-bold leading-snug text-brand-navy">
                      {journey.moment}
                    </span>
                    <span className="mt-2 flex-1 text-sm leading-relaxed text-brand-muted">
                      {journey.momentCopy}
                    </span>
                    <span className="mt-4 text-sm font-semibold text-brand-teal-dark">
                      {journey.momentCta} <span aria-hidden="true">→</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
