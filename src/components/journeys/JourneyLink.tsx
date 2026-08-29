"use client";

/**
 * Link que sai da Central para uma ferramenta ou conteúdo.
 *
 * Faz três coisas que um `<Link>` puro não faria: registra em qual jornada a
 * pessoa está (para que o próximo passo, do outro lado, seja o certo), marca
 * o passo como percorrido e emite o evento de navegação.
 *
 * O que ele NÃO faz: acrescentar query string ao destino. O contexto viaja em
 * `sessionStorage`, não na URL — ver `src/lib/journeys/context.ts` para o
 * motivo. Consequência prática: sem JavaScript, este componente continua
 * sendo um link comum que leva ao lugar certo. A jornada perde a memória, não
 * o caminho.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { markStepDone, startJourney } from "@/lib/journeys/context";
import { trackToolOpen } from "@/lib/journeys/analytics";

export function JourneyLink({
  href,
  journeyId,
  stepId,
  targetId,
  className,
  children,
}: {
  href: string;
  /** Ausente quando o link não nasce de uma jornada (catálogo, home). */
  journeyId?: string;
  stepId?: string;
  /** Id da ferramenta ou do passo, para o evento. */
  targetId: string;
  className?: string;
  children: ReactNode;
}) {
  function handleClick() {
    if (journeyId) {
      startJourney(journeyId);
      if (stepId) markStepDone(stepId);
      markStepDone(targetId);
    }
    trackToolOpen(journeyId ?? null, targetId);
  }

  return (
    <Link href={href} onClick={handleClick} className={className}>
      {children}
    </Link>
  );
}
