/**
 * FINANCIAL JOURNEY REGISTRY
 * ============================================================================
 *
 * A camada que falta entre o problema do leitor e a ferramenta que ajuda.
 *
 * O hub `/calculadoras/` já agrupava as ferramentas por situação, mas ainda
 * pedia que a pessoa reconhecesse a ferramenta pelo nome. Quem chega dizendo
 * "recebi uma proposta e não sei se está cara" não procura um "comparador de
 * CET" — procura o próximo passo. Este registry descreve as JORNADAS: a
 * sequência de perguntas que resolve uma situação, com a ferramenta anexada a
 * cada pergunta.
 *
 * TRÊS REGRAS QUE O MODELO IMPÕE
 *
 * 1. ROTA NUNCA É ESCRITA AQUI. Um passo aponta para uma ferramenta por
 *    `toolId`, resolvido em `data/tool-registry.json`. Renomear uma rota não
 *    deixa link morto na Central — e um `toolId` inexistente explode no build,
 *    em vez de virar 404 silencioso em produção.
 * 2. NENHUM PASSO É OBRIGATÓRIO. `optional` marca o que dá para pular sem
 *    perder o fio, mas mesmo o passo não-opcional é sugestão: a Central
 *    orienta, não conduz. Não existe "conclua para liberar".
 * 3. A JORNADA NÃO CALCULA NADA. Ela roteia. O número continua sendo
 *    responsabilidade da ferramenta, que já sabe explicar o próprio resultado.
 *
 * O QUE ESTE MÓDULO DELIBERADAMENTE NÃO FAZ
 *
 * - Não classifica a pessoa. Não existe perfil, score, nível ou rótulo. A
 *   escolha de um momento descreve uma situação de hoje, não quem ela é;
 * - Não guarda nem transporta valor financeiro. O contexto de jornada é
 *   `journeyId` + ids de passo, e mais nada — ver `src/lib/journeys/context.ts`;
 * - Não recomenda instituição, produto ou decisão.
 */
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "@/lib/content/paths";
import { getTool, type Tool } from "@/lib/tools/registry";

export interface JourneyFamily {
  id: string;
  label: string;
}

export interface JourneyStep {
  id: string;
  title: string;
  /** Ferramenta do passo. Ausente quando o passo aponta para conteúdo. */
  toolId?: string;
  /** Destino quando o passo não é ferramenta (guias locais, artigo-roteiro). */
  linkPath?: string;
  linkLabel?: string;
  /** Restrição de aplicabilidade, em uma linha, exibida como nota. */
  condition?: string;
  /** Por que este passo existe — a explicação, não a instrução. */
  whyThisStep: string;
  optional: boolean;
}

export interface Journey {
  id: string;
  family: string;
  /** Rótulo do card de entrada, na primeira pessoa do leitor. */
  moment: string;
  momentCopy: string;
  momentCta: string;
  title: string;
  shortTitle: string;
  entryQuestion: string;
  openingCopy: string;
  completionMessage: string;
  /** Sufixo do evento GA4. Nunca contém dado da pessoa. */
  analyticsId: string;
  steps: JourneyStep[];
  relatedContent: Array<{ label: string; path: string }>;
  /**
   * Posição no bloco da home. Ausente = fica só na Central.
   *
   * A home mostra sete situações, não as dez: um bloco com dez cards volta a
   * ser a parede de opções que a Central existe para desfazer. As três de
   * fora (dívida única, mercado, ajuda local) são as de menor volume de
   * entrada e continuam a um clique, pelo "ver todos os caminhos".
   */
  homeOrder?: number;
}

interface JourneyRegistryFile {
  families: JourneyFamily[];
  journeys: Journey[];
}

let cache: JourneyRegistryFile | null = null;

function load(): JourneyRegistryFile {
  if (cache) return cache;
  cache = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, "journey-registry.json"), "utf8"),
  ) as JourneyRegistryFile;
  return cache;
}

export function getJourneys(): Journey[] {
  return load().journeys;
}

export function getJourneyFamilies(): JourneyFamily[] {
  return load().families;
}

export function getJourney(id: string): Journey | undefined {
  return getJourneys().find((j) => j.id === id);
}

/** Situações destacadas na home, na ordem declarada. */
export function getHomeJourneys(): Journey[] {
  return getJourneys()
    .filter((j) => typeof j.homeOrder === "number")
    .sort((a, b) => (a.homeOrder ?? 0) - (b.homeOrder ?? 0));
}

/** Âncora da jornada dentro da Central. Não é URL própria — ver docs. */
export function journeyAnchor(journeyId: string): string {
  return `momento-${journeyId}`;
}

export function journeyPath(journeyId: string): string {
  return `/decisoes-financeiras/#${journeyAnchor(journeyId)}`;
}

/**
 * Resolve o destino de um passo. Um passo tem ferramenta OU link — nunca os
 * dois, nunca nenhum. A validação vive aqui porque é o único ponto por onde
 * todo consumidor passa.
 */
export interface ResolvedStep extends JourneyStep {
  tool?: Tool;
  href: string;
  cta: string;
  /** Explicação da ferramenta, quando houver — evita reescrever a promessa. */
  helps?: string;
}

export function resolveStep(step: JourneyStep): ResolvedStep {
  if (step.toolId) {
    const tool = getTool(step.toolId);
    if (!tool) {
      throw new Error(
        `Jornada: passo "${step.id}" aponta para ferramenta inexistente "${step.toolId}".`,
      );
    }
    return { ...step, tool, href: tool.route, cta: tool.cta, helps: tool.whenItHelps };
  }
  if (step.linkPath && step.linkLabel) {
    return { ...step, href: step.linkPath, cta: step.linkLabel };
  }
  throw new Error(
    `Jornada: passo "${step.id}" não tem toolId nem par linkPath/linkLabel.`,
  );
}

export function resolveJourneySteps(journey: Journey): ResolvedStep[] {
  return journey.steps.map(resolveStep);
}

/** Jornadas em que a ferramenta aparece — usada pela auditoria e pelo engine. */
export function journeysUsingTool(toolId: string): Journey[] {
  return getJourneys().filter((j) => j.steps.some((s) => s.toolId === toolId));
}

/** Todas as ferramentas alcançáveis a partir de alguma jornada. */
export function toolsCoveredByJourneys(): Set<string> {
  const ids = new Set<string>();
  for (const journey of getJourneys()) {
    for (const step of journey.steps) {
      if (step.toolId) ids.add(step.toolId);
    }
  }
  return ids;
}
