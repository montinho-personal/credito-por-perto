/**
 * Uma jornada, inteira, numa seção da Central.
 *
 * TRÊS DECISÕES QUE ESTE COMPONENTE CARREGA
 *
 * A jornada NÃO é um wizard. Todos os passos aparecem de uma vez, numerados,
 * cada um com o próprio botão. Um wizard esconderia o passo 3 até a pessoa
 * concluir o 2 — e é assim que se constrói a sensação de "ainda falta coisa",
 * que aumenta pageview e não ajuda ninguém. Aqui quem chegou sabendo que
 * precisa só do passo 3 clica no passo 3.
 *
 * A jornada NÃO tem URL própria. Ela vive numa âncora desta página. Dez URLs
 * de jornada seriam dez páginas finas competindo com os artigos que já
 * respondem às mesmas perguntas com profundidade — o custo em canibalização
 * superaria o ganho em navegação.
 *
 * A jornada NÃO conclui nada. Não há barra de progresso preenchendo, nem
 * "conclua para liberar". O que existe é um encerramento explícito, sempre
 * disponível, dizendo que parar ali é um desfecho legítimo.
 */
import Link from "next/link";
import {
  journeyAnchor,
  resolveJourneySteps,
  type Journey,
} from "@/lib/journeys/registry";
import { JourneyLink } from "@/components/journeys/JourneyLink";

export function JourneySection({ journey }: { journey: Journey }) {
  const steps = resolveJourneySteps(journey);
  const anchor = journeyAnchor(journey.id);
  const titleId = `${anchor}-titulo`;

  return (
    <section
      id={anchor}
      aria-labelledby={titleId}
      className="mt-10 scroll-mt-24 rounded-2xl border border-brand-border bg-white p-5 md:p-7"
    >
      <h3 id={titleId} className="font-serif text-2xl font-bold leading-tight text-brand-navy">
        {journey.title}
      </h3>
      <p className="mt-2 max-w-3xl leading-relaxed text-brand-muted">
        {journey.openingCopy}
      </p>

      <ol className="mt-6 space-y-4">
        {steps.map((step, index) => (
          <li
            key={step.id}
            className="rounded-xl border border-brand-border bg-brand-surface-soft/60 p-4"
          >
            <div className="flex items-baseline gap-3">
              <span
                aria-hidden="true"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-navy text-sm font-bold text-white"
              >
                {index + 1}
              </span>
              <div className="min-w-0">
                <h4 className="font-serif text-base font-bold leading-snug text-brand-navy">
                  <span className="sr-only">
                    Passo {index + 1} de {steps.length}:{" "}
                  </span>
                  {step.title}
                </h4>
                {step.optional ? (
                  <p className="mt-1 text-xs font-medium uppercase tracking-wide text-brand-muted">
                    Opcional — pule se não for o seu caso
                  </p>
                ) : null}
              </div>
            </div>

            <p className="mt-2.5 pl-10 text-sm leading-relaxed text-brand-text">
              {step.whyThisStep}
            </p>
            {step.condition ? (
              <p className="mt-1.5 pl-10 text-sm italic leading-relaxed text-brand-muted">
                {step.condition}.
              </p>
            ) : null}

            <div className="mt-3 pl-10">
              <JourneyLink
                href={step.href}
                journeyId={journey.id}
                stepId={step.id}
                targetId={step.toolId ?? step.id}
                className="inline-flex items-center gap-1 rounded-lg bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-navy/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy"
              >
                {step.cta} <span aria-hidden="true">→</span>
              </JourneyLink>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-6 border-t border-brand-border pt-4">
        <p className="text-sm leading-relaxed text-brand-text">
          <strong>Você pode parar por aqui quando quiser.</strong>{" "}
          {journey.completionMessage}
        </p>
        {journey.relatedContent.length > 0 ? (
          <p className="mt-3 text-sm leading-relaxed text-brand-muted">
            Para entender o assunto por escrito:{" "}
            {journey.relatedContent.map((item, index) => (
              <span key={item.path}>
                {index > 0 ? " · " : ""}
                <Link
                  href={item.path}
                  className="font-semibold text-brand-teal-dark underline"
                >
                  {item.label}
                </Link>
              </span>
            ))}
            .
          </p>
        ) : null}
      </div>
    </section>
  );
}
