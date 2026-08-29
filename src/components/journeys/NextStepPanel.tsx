"use client";

/**
 * O bloco "E agora?" no fim de cada ferramenta.
 *
 * Hoje uma ferramenta termina no resultado, e o leitor sai mesmo quando a
 * decisão dele ainda depende de outra conta que o site já tem pronta. Este
 * painel fecha essa lacuna — com três cuidados que valem mais que o recurso:
 *
 * RENDERIZA DUAS VEZES, DE PROPÓSITO
 * O servidor já manda um par de sugestões em HTML, calculado sem contexto: é
 * o que o buscador enxerga e o que a pessoa vê se o JavaScript não rodar.
 * Depois da hidratação, havendo jornada em curso na sessão, o MESMO motor
 * (`selectNextStep`, chamado dos dois lados) recalcula com esse contexto e o
 * texto se ajusta. O primeiro render é sempre idêntico ao do servidor —
 * `useJourneyContext` devolve `null` no servidor, então não há divergência de
 * hidratação.
 *
 * O ajuste pode mudar a altura do bloco. Ele fica no fim da página justamente
 * por isso: o que ele empurra é o rodapé, não o texto que a pessoa está
 * lendo. Foi a razão de não colocá-lo acima do resultado, onde seria mais
 * visível e mexeria com a leitura em curso.
 *
 * NUNCA MAIS DE DOIS PASSOS
 * Um botão principal e uma linha secundária. O terceiro vira menu, e menu é
 * o que a Central existe para evitar.
 *
 * ENCERRAR É UM DESFECHO, NÃO UMA DESISTÊNCIA
 * A opção de encerrar aparece sempre, com o mesmo peso visual dos demais
 * links. Quando não há passo útil, ela é a única coisa que aparece.
 */
import { useEffect } from "react";
import Link from "next/link";
import {
  selectNextStep,
  type NextStepResult,
  type NextStepSnapshot,
} from "@/lib/journeys/next-step-core";
import { clearJourney, markStepDone } from "@/lib/journeys/context";
import { useJourneyContext } from "@/lib/journeys/use-journey-context";
import {
  trackNextStepClick,
  trackPathComplete,
  trackRestart,
} from "@/lib/journeys/analytics";

export function NextStepPanel({
  snapshot,
  initial,
}: {
  snapshot: NextStepSnapshot;
  initial: NextStepResult;
}) {
  const context = useJourneyContext();

  useEffect(() => {
    /* Chegar à ferramenta já conta como ter percorrido o passo: sem isso, ela
       reapareceria como sugestão de si mesma na próxima volta à Central.
       Escrever no storage é sincronizar um sistema externo — a leitura de
       volta chega pelo hook, não por um setState aqui. */
    markStepDone(snapshot.tool.id);
  }, [snapshot.tool.id]);

  const result = context
    ? selectNextStep(snapshot, {
        journeyId: context.journeyId,
        completedIds: context.completedIds,
      })
    : initial;

  const journeyId = context?.journeyId ?? null;
  const { primary, secondary, completion } = result;

  return (
    <aside
      aria-labelledby="proximo-passo-titulo"
      /* data-no-ads: área protegida. Um anúncio aqui seria lido como o próximo
         passo recomendado pelo site — ver docs/adsense-protected-areas.md. */
      data-no-ads="next-step"
      className="mt-10 rounded-2xl border border-brand-navy/15 bg-brand-navy/5 p-5 md:p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="proximo-passo-titulo"
          className="font-serif text-xl font-bold text-brand-navy"
        >
          E agora?
        </h2>
        {result.progressLabel && result.journeyTitle ? (
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-teal-dark">
            {result.journeyTitle} · {result.progressLabel}
          </p>
        ) : null}
      </div>

      {primary ? (
        <>
          <p className="mt-3 font-serif text-base font-bold leading-snug text-brand-navy">
            {primary.title}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-brand-text">
            {primary.reason}
          </p>
          <Link
            href={primary.href}
            onClick={() => {
              markStepDone(primary.trackingId);
              trackNextStepClick(snapshot.tool.id, primary.trackingId, "primary");
            }}
            className="mt-3 inline-flex items-center gap-1 rounded-lg bg-brand-navy px-4 py-2.5 text-sm font-semibold !text-white !no-underline transition hover:bg-brand-navy/90 hover:!text-white"
          >
            {primary.cta} <span aria-hidden="true">→</span>
          </Link>
        </>
      ) : null}

      {secondary ? (
        <p className="mt-5 border-t border-brand-navy/10 pt-4 text-sm leading-relaxed text-brand-text">
          {secondary.title}{" "}
          <Link
            href={secondary.href}
            onClick={() => {
              markStepDone(secondary.trackingId);
              trackNextStepClick(snapshot.tool.id, secondary.trackingId, "secondary");
            }}
            className="font-semibold text-brand-teal-dark"
          >
            {secondary.cta}
          </Link>
          .
        </p>
      ) : null}

      <div className={primary ? "mt-5 border-t border-brand-navy/10 pt-4" : "mt-3"}>
        <p className="text-sm leading-relaxed text-brand-text">
          <strong>Não precisa fazer todas as etapas.</strong> {completion.message}
        </p>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <Link
            href={completion.href}
            onClick={() => {
              if (journeyId) trackPathComplete(journeyId, "encerrou");
            }}
            className="font-semibold text-brand-teal-dark"
          >
            {completion.label}
          </Link>
          {journeyId ? (
            <button
              type="button"
              onClick={() => {
                clearJourney();
                trackRestart(journeyId);
              }}
              className="font-semibold text-brand-muted underline underline-offset-2 hover:text-brand-navy"
            >
              Apagar meu progresso
            </button>
          ) : null}
        </p>
      </div>
    </aside>
  );
}
