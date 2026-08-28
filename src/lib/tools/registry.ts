/**
 * REGISTRY DAS FERRAMENTAS
 * ============================================================================
 *
 * Fonte única de verdade sobre as ferramentas do site.
 *
 * Antes deste módulo, o mesmo conjunto vivia escrito à mão em três lugares —
 * o rodapé (`src/lib/site.ts`), o índice de busca (`src/lib/search/
 * build-docs.ts`) e o hub (`src/app/calculadoras/page.tsx`). Já havia
 * divergido: a calculadora de margem consignável aparecia no hub e na busca,
 * mas não no rodapé. Ninguém percebeu porque nada checava.
 *
 * Agora o caminho é um só: a ferramenta entra em `data/tool-registry.json` e
 * o hub, o rodapé, a busca, os callouts nos artigos e a auditoria de
 * cobertura passam a enxergá-la. Esquecer de listar em algum lugar deixou de
 * ser possível.
 */
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "@/lib/content/paths";

export interface ToolSituation {
  id: string;
  /** Rótulo na voz do leitor, não na do produto. */
  label: string;
  lead: string;
}

export interface Tool {
  id: string;
  name: string;
  shortName: string;
  /** Caminho canônico, sempre com barra final. */
  route: string;
  cta: string;
  situation: string;
  /** A dúvida do leitor, escrita como ele a formularia. */
  question: string;
  whenItHelps: string;
  /** Frase de abertura do callout dentro de um artigo. */
  calloutLead: string;
  /**
   * Termos cuja presença num texto indica que a ferramenta provavelmente
   * ajuda ali. Alimentam a auditoria de cobertura — são pista, não veredito:
   * a auditoria aponta, quem decide é o editorial.
   */
  triggerTerms: string[];
  /**
   * Aparece na seleção do rodapé. O rodapé não lista as doze: uma coluna com
   * doze itens é o que deixava o rodapé três vezes mais alto que as outras
   * colunas. Ele mostra uma seleção e aponta para o hub, que tem todas.
   */
  inFooter?: boolean;
}

interface RegistryFile {
  situations: ToolSituation[];
  tools: Tool[];
}

let cache: RegistryFile | null = null;

function load(): RegistryFile {
  if (cache) return cache;
  cache = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, "tool-registry.json"), "utf8"),
  ) as RegistryFile;
  return cache;
}

export function getTools(): Tool[] {
  return load().tools;
}

export function getToolSituations(): ToolSituation[] {
  return load().situations;
}

export function getTool(id: string): Tool | undefined {
  return getTools().find((t) => t.id === id);
}

export function getToolByRoute(route: string): Tool | undefined {
  return getTools().find((t) => t.route === route);
}

export interface ToolGroup {
  situation: ToolSituation;
  tools: Tool[];
}

/**
 * Agrupa na ordem das situações declaradas. A ordem importa: ela reproduz a
 * linha do tempo do leitor — desconfiar, contratar, conviver com a dívida,
 * entender a conta.
 */
export function getToolsBySituation(): ToolGroup[] {
  const tools = getTools();
  return getToolSituations()
    .map((situation) => ({
      situation,
      tools: tools.filter((t) => t.situation === situation.id),
    }))
    .filter((group) => group.tools.length > 0);
}

/** Todas as rotas de ferramenta — usada por auditorias e testes. */
export function getToolRoutes(): string[] {
  return getTools().map((t) => t.route);
}

/** Seleção do rodapé, na ordem do registry. */
export function getFooterTools(): Tool[] {
  return getTools().filter((t) => t.inFooter === true);
}
