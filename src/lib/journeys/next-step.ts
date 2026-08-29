/**
 * FINANCIAL NEXT STEP ENGINE — LADO DO SERVIDOR
 * ============================================================================
 *
 * Monta o retrato serializável que o núcleo (`next-step-core.ts`) consome e
 * expõe os atalhos usados por páginas, auditoria e testes.
 *
 * O retrato é deliberadamente PEQUENO: só a ferramenta atual, as ferramentas
 * que ela pode sugerir e as jornadas em que ela aparece. É esse objeto que
 * viaja para o navegador junto com o HTML da página da ferramenta — mandar o
 * registry inteiro seria pagar banda para dado que ninguém vai usar ali.
 *
 * Nenhum campo do retrato depende do que a pessoa digitou: ele é idêntico
 * para todo mundo que abre aquela ferramenta, e por isso pode ser gerado no
 * build e servido estático.
 */
import { getTool, getTools, type Tool } from "@/lib/tools/registry";
import {
  getJourney,
  getJourneys,
  journeysUsingTool,
  resolveStep,
  type Journey,
} from "@/lib/journeys/registry";
import {
  selectNextStep,
  type JourneySnapshot,
  type NextStepQuery,
  type NextStepResult,
  type NextStepSnapshot,
  type StepSnapshot,
  type ToolSnapshot,
} from "@/lib/journeys/next-step-core";

export type {
  NextStepResult,
  NextStepSnapshot,
  NextStepSuggestion,
} from "@/lib/journeys/next-step-core";

function toolSnapshot(tool: Tool): ToolSnapshot {
  return {
    id: tool.id,
    question: tool.question,
    route: tool.route,
    cta: tool.cta,
    whenItHelps: tool.whenItHelps,
    defaultNextSteps: tool.defaultNextSteps,
  };
}

export function journeySnapshot(journey: Journey): JourneySnapshot {
  const steps: StepSnapshot[] = journey.steps.map((step) => {
    const resolved = resolveStep(step);
    return {
      id: step.id,
      title: step.title,
      href: resolved.href,
      cta: resolved.cta,
      whyThisStep: step.whyThisStep,
      trackingId: step.toolId ?? step.id,
      optional: step.optional,
      isContent: step.toolId === undefined,
    };
  });
  return {
    id: journey.id,
    shortTitle: journey.shortTitle,
    completionMessage: journey.completionMessage,
    steps,
  };
}

/**
 * Retrato para uma ferramenta. Inclui as jornadas em que ela aparece e as
 * ferramentas do seu fallback — nada além disso.
 */
export function buildNextStepSnapshot(toolId: string): NextStepSnapshot {
  const tool = getTool(toolId);
  if (!tool) {
    throw new Error(`NextStepEngine: ferramenta "${toolId}" não existe no registry.`);
  }

  const tools: Record<string, ToolSnapshot> = {};
  for (const id of tool.defaultNextSteps) {
    const target = getTool(id);
    if (!target) {
      throw new Error(
        `NextStepEngine: "${toolId}" declara próximo passo inexistente "${id}".`,
      );
    }
    tools[id] = toolSnapshot(target);
  }

  const related = journeysUsingTool(toolId);
  const journeys: Record<string, JourneySnapshot> = {};
  for (const journey of related) {
    journeys[journey.id] = journeySnapshot(journey);
  }

  return {
    tool: toolSnapshot(tool),
    tools,
    journeys,
    impliedJourneyId: related.length === 1 ? related[0]?.id : undefined,
  };
}

export function computeNextStep(
  toolId: string,
  query: NextStepQuery = {},
): NextStepResult {
  return selectNextStep(buildNextStepSnapshot(toolId), query);
}

/**
 * Percorre o caminho principal acumulando o que já foi visitado.
 *
 * Existe para a auditoria e para o teste anti-loop: com o acúmulo, a
 * caminhada tem de terminar sempre. Se não terminar, o motor está mandando
 * alguém em círculo — o defeito clássico deste tipo de sugestão, e o mais
 * fácil de introduzir sem perceber ao editar dois arquivos JSON.
 */
export function walkPrimaryPath(
  startToolId: string,
  journeyId?: string,
  maxHops = 20,
): string[] {
  const path: string[] = [startToolId];
  const done: string[] = [startToolId];
  let current = startToolId;

  for (let hop = 0; hop < maxHops; hop += 1) {
    const result = computeNextStep(current, { journeyId, completedIds: done });
    if (!result.hasNext || !result.primary) return path;

    const nextId = result.primary.trackingId;
    path.push(nextId);
    done.push(nextId);

    /* Passo de conteúdo (guia local, artigo-roteiro) encerra a caminhada: ele
       não é ferramenta e não tem próximo passo próprio a computar. */
    if (!getTool(nextId)) return path;
    current = nextId;
  }

  throw new Error(
    `NextStepEngine: caminho a partir de "${startToolId}" não terminou em ${maxHops} passos.`,
  );
}

/** Ferramentas sem nenhuma jornada — alimenta a auditoria. */
export function toolsWithoutJourney(): string[] {
  const covered = new Set<string>();
  for (const journey of getJourneys()) {
    for (const step of journey.steps) {
      if (step.toolId) covered.add(step.toolId);
    }
  }
  return getTools()
    .map((t) => t.id)
    .filter((id) => !covered.has(id));
}

export { getJourney };
