/**
 * Chamada de JORNADA dentro de um artigo.
 *
 * Irmão do `<ToolCallout>`, com uma diferença de propósito que decide quando
 * usar cada um:
 *
 * - `ToolCallout` serve quando o parágrafo pede UMA conta específica: "veja
 *   se essa parcela cabe";
 * - `JourneyCallout` serve quando o artigo descreve uma SITUAÇÃO inteira e a
 *   pessoa provavelmente precisa de mais de uma conta em sequência: "está
 *   com várias dívidas".
 *
 * Não são intercambiáveis, e usar os dois no mesmo artigo é normal — o
 * primeiro no meio, onde a conta ajuda o argumento; o segundo perto do fim,
 * onde o leitor já entendeu o assunto e precisa de um caminho.
 *
 * Rótulo e destino vêm do registry: renomear uma situação não deixa texto
 * desatualizado espalhado pelos MDX, e um id inexistente quebra o build.
 */
import Link from "next/link";
import { getJourney, journeyPath } from "@/lib/journeys/registry";

export function JourneyCallout({ id, note }: { id: string; note?: string }) {
  const journey = getJourney(id);
  if (!journey) {
    throw new Error(
      `JourneyCallout: jornada "${id}" não existe em data/journey-registry.json.`,
    );
  }

  return (
    <aside
      className="not-prose my-6 rounded-xl border border-brand-navy/20 bg-brand-navy/5 p-4"
      aria-label={`Caminho: ${journey.title}`}
      data-no-ads="journey-callout"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-teal-dark">
        Está vivendo isso agora?
      </p>
      <p className="mt-2 font-serif text-base font-bold leading-snug text-brand-navy">
        {journey.moment}
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-brand-text">
        {note ?? journey.momentCopy}
      </p>
      <Link
        href={journeyPath(journey.id)}
        className="mt-3 inline-flex items-center gap-1 rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold !text-white !no-underline transition hover:bg-brand-navy/90 hover:!text-white"
      >
        {journey.momentCta}
        <span aria-hidden="true">→</span>
      </Link>
      <p className="mt-2 text-xs text-brand-muted">
        Nenhuma etapa é obrigatória — use só o que ajudar na sua decisão.
      </p>
    </aside>
  );
}
