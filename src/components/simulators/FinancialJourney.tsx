/**
 * FINANCIAL JOURNEY — a narrativa visual dos simuladores
 * ============================================================================
 *
 * VOCÊ ESTÁ AQUI → CENÁRIO BASE → MARCOS → DESTINO. Todo simulador da família
 * /simuladores/ conta a história com esta peça: uma lista ordenada de
 * passos, cada um com data, título e detalhe. No celular a linha é vertical
 * (a horizontal não cabe); no desktop, horizontal. É HTML e texto: nenhum
 * marco depende de gráfico ou de cor para ser entendido.
 *
 * Sem confete, sem medalha: o progresso é o próprio caminho.
 */

export interface JourneyStep {
  key: string;
  /** Rótulo curto acima do passo: "Hoje", "Primeiro marco", "Fim". */
  label: string;
  /** O que acontece: "Cartão termina", "Saldo R$ 0". */
  title: string;
  /** Data ou prazo, quando houver. */
  when?: string;
  detail?: string;
  /** Passo de destaque (o destino). */
  emphasis?: boolean;
}

export function FinancialJourney({ steps, ariaLabel }: { steps: JourneyStep[]; ariaLabel: string }) {
  return (
    <ol aria-label={ariaLabel} className="relative mt-4 space-y-4 border-l-2 border-brand-border pl-5 md:grid md:grid-cols-5 md:gap-3 md:space-y-0 md:border-l-0 md:border-t-2 md:pl-0 md:pt-5">
      {steps.map((step, i) => (
        <li key={step.key} className="relative">
          <span
            aria-hidden="true"
            className={`absolute -left-[31px] top-1 h-4 w-4 rounded-full border-2 border-white md:-top-[31px] md:left-0 ${step.emphasis ? "bg-brand-navy" : i === 0 ? "bg-brand-gold" : "bg-brand-teal"}`}
          />
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">{step.label}</p>
          {step.when ? <p className="mt-0.5 text-sm font-semibold tabular-nums text-brand-teal-dark">{step.when}</p> : null}
          <p className={`mt-0.5 font-serif font-bold leading-snug text-brand-navy ${step.emphasis ? "text-xl" : "text-base"}`}>{step.title}</p>
          {step.detail ? <p className="mt-0.5 text-sm leading-relaxed text-brand-muted">{step.detail}</p> : null}
        </li>
      ))}
    </ol>
  );
}
