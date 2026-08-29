/**
 * NÚCLEO DO FINANCIAL NEXT STEP ENGINE
 * ============================================================================
 *
 * A regra de escolha do próximo passo, isolada de onde os dados vêm.
 *
 * POR QUE ESTA SEPARAÇÃO EXISTE
 *
 * O mesmo cálculo precisa acontecer em dois lugares. No servidor, para que a
 * página da ferramenta já saia do build com os próximos passos em HTML —
 * crawlable, visível sem JavaScript, sem deslocamento de layout. E no
 * navegador, para refinar a sugestão quando a pessoa está no meio de uma
 * jornada, contexto que só existe na sessão dela.
 *
 * Duas implementações da mesma regra divergiriam na primeira alteração. Então
 * a regra mora aqui, opera sobre um retrato serializável dos registries
 * (`NextStepSnapshot`), e é chamada dos dois lados. Este arquivo não conhece
 * `fs`, Next.js nem React — só entra dado, só sai dado.
 *
 * AS QUATRO INVARIANTES
 *
 * 1. no máximo dois passos: um principal, um secundário;
 * 2. nada que já foi usado volta a ser sugerido — é o que impede o
 *    A → B → A → B, e é por isso que `completedIds` acumula;
 * 3. encerrar é sempre oferecido, e "sem próximo passo" é desfecho legítimo;
 * 4. nenhum campo aqui carrega valor financeiro. Só identificadores e texto
 *    editorial escrito de antemão.
 */

export interface ToolSnapshot {
  id: string;
  /** A dúvida do leitor, já escrita como ele a formularia. */
  question: string;
  route: string;
  cta: string;
  whenItHelps: string;
  defaultNextSteps: string[];
}

export interface StepSnapshot {
  id: string;
  title: string;
  href: string;
  cta: string;
  whyThisStep: string;
  /** Id da ferramenta quando houver; senão, o id do passo. */
  trackingId: string;
  optional: boolean;
  /** true quando o destino não é ferramenta (guia local, artigo-roteiro). */
  isContent: boolean;
}

export interface JourneySnapshot {
  id: string;
  shortTitle: string;
  completionMessage: string;
  steps: StepSnapshot[];
}

export interface NextStepSnapshot {
  /** Ferramenta de onde a pessoa está saindo. */
  tool: ToolSnapshot;
  /** Ferramentas alcançáveis por `defaultNextSteps`. */
  tools: Record<string, ToolSnapshot>;
  /** Jornadas em que esta ferramenta aparece. */
  journeys: Record<string, JourneySnapshot>;
  /**
   * Jornada assumida quando a pessoa chega sem contexto. Só é preenchida
   * quando a ferramenta pertence a UMA única jornada: com duas ou mais,
   * escolher seria inventar a situação de quem chegou pela busca.
   */
  impliedJourneyId?: string;
}

export interface NextStepQuery {
  journeyId?: string;
  /** Ids de ferramenta e/ou de passo já percorridos. Nunca valores. */
  completedIds?: string[];
}

export interface NextStepSuggestion {
  title: string;
  href: string;
  cta: string;
  reason: string;
  trackingId: string;
}

export interface NextStepResult {
  hasNext: boolean;
  primary?: NextStepSuggestion;
  secondary?: NextStepSuggestion;
  completion: { message: string; href: string; label: string };
  progressLabel?: string;
  journeyId?: string;
  journeyTitle?: string;
}

export const DECISION_HUB_PATH = "/decisoes-financeiras/";

export const GENERIC_COMPLETION =
  "Você já tem o que precisava desta análise. Se outra decisão aparecer, a Central mostra por onde começar.";

function fromStep(step: StepSnapshot): NextStepSuggestion {
  return {
    title: step.title,
    href: step.href,
    cta: step.cta,
    reason: step.whyThisStep,
    trackingId: step.trackingId,
  };
}

function fromTool(tool: ToolSnapshot): NextStepSuggestion {
  return {
    title: tool.question,
    href: tool.route,
    cta: tool.cta,
    reason: tool.whenItHelps,
    trackingId: tool.id,
  };
}

/**
 * Um passo está fora quando já foi usado. A checagem olha os dois ids
 * possíveis — o do passo e o da ferramenta — porque a mesma ferramenta
 * aparece em jornadas diferentes sob ids de passo diferentes, e ter usado o
 * comparador numa jornada é ter usado o comparador em qualquer outra.
 */
function isDone(step: StepSnapshot, done: ReadonlySet<string>): boolean {
  return done.has(step.id) || done.has(step.trackingId);
}

export function selectNextStep(
  snapshot: NextStepSnapshot,
  query: NextStepQuery = {},
): NextStepResult {
  const done = new Set(query.completedIds ?? []);
  done.add(snapshot.tool.id);

  /* Contexto inválido (jornada renomeada, sessão antiga) degrada para o
     caminho sem jornada em vez de quebrar a página de quem está lendo. */
  const journeyId =
    (query.journeyId && snapshot.journeys[query.journeyId] ? query.journeyId : undefined) ??
    snapshot.impliedJourneyId;
  const journey = journeyId ? snapshot.journeys[journeyId] : undefined;

  const completion = {
    message: journey?.completionMessage ?? GENERIC_COMPLETION,
    href: DECISION_HUB_PATH,
    label: "Ver outros momentos",
  };

  if (journey) {
    const remaining = journey.steps.filter((s) => !isDone(s, done));
    const usedCount = journey.steps.length - remaining.length;
    const progressLabel =
      journey.steps.length > 1
        ? `Passo ${Math.min(usedCount + 1, journey.steps.length)} de ${journey.steps.length}`
        : undefined;

    const [first, second] = remaining;
    if (!first) {
      return {
        hasNext: false,
        completion,
        progressLabel,
        journeyId: journey.id,
        journeyTitle: journey.shortTitle,
      };
    }
    return {
      hasNext: true,
      primary: fromStep(first),
      secondary: second ? fromStep(second) : undefined,
      completion,
      progressLabel,
      journeyId: journey.id,
      journeyTitle: journey.shortTitle,
    };
  }

  const [primary, secondary] = snapshot.tool.defaultNextSteps
    .filter((id) => !done.has(id))
    .map((id) => snapshot.tools[id])
    .filter((t): t is ToolSnapshot => t !== undefined)
    .slice(0, 2)
    .map(fromTool);

  if (!primary) return { hasNext: false, completion };
  return { hasNext: true, primary, secondary, completion };
}
