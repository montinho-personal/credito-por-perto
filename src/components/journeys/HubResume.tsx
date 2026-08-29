"use client";

/**
 * Registra a visita à Central e, quando há uma jornada em curso na sessão,
 * oferece retomá-la.
 *
 * A faixa não existe no HTML do servidor — o que ela mostra depende do estado
 * da sessão daquela pessoa, e a página é estática, servida igual para todo
 * mundo. Por isso ela fica logo abaixo do título e acima dos cards, num
 * espaço que só é ocupado quando há algo a retomar: o deslocamento acontece
 * uma vez, antes de a leitura começar, e nunca no meio dela.
 *
 * O botão de recomeçar fica ao lado do de continuar, com o mesmo peso.
 * Guardar um id de situação, mesmo por uma sessão, pede que a saída seja tão
 * fácil quanto a entrada.
 */
import { useEffect } from "react";
import { clearJourney } from "@/lib/journeys/context";
import { useJourneyContext } from "@/lib/journeys/use-journey-context";
import { trackHubView, trackRestart } from "@/lib/journeys/analytics";

export function HubResume({
  journeys,
}: {
  /** id → rótulo curto e âncora, resolvidos no servidor. */
  journeys: Array<{ id: string; shortTitle: string; anchor: string }>;
}) {
  const context = useJourneyContext();

  useEffect(() => {
    trackHubView();
  }, []);

  const journey = context
    ? journeys.find((j) => j.id === context.journeyId)
    : undefined;
  if (!journey || !context) return null;

  const done = context.completedIds.length;

  return (
    <div className="mt-6 rounded-xl border border-brand-teal/30 bg-brand-teal-soft/40 px-4 py-3">
      <p className="text-sm leading-relaxed text-brand-text">
        Você começou o caminho <strong>{journey.shortTitle}</strong>
        {done > 0
          ? ` e já passou por ${done} ${done === 1 ? "etapa" : "etapas"}.`
          : "."}
      </p>
      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <a href={`#${journey.anchor}`} className="font-semibold text-brand-teal-dark">
          Continuar de onde parei
        </a>
        <button
          type="button"
          onClick={() => {
            clearJourney();
            trackRestart(context.journeyId);
          }}
          className="font-semibold text-brand-muted underline underline-offset-2 hover:text-brand-navy"
        >
          Começar de novo
        </button>
      </p>
    </div>
  );
}
