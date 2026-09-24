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

export interface ToolCategory {
  id: string;
  /** Título da seção no catálogo, por assunto. */
  label: string;
  lead: string;
}

/**
 * Caminho por situação ("Vou financiar um veículo"): dois a quatro passos,
 * na ordem, e a jornada completa na Central de Decisões. É a porta de quem
 * não sabe o nome da conta que resolve a dúvida.
 */
export interface ToolPath {
  id: string;
  label: string;
  lead: string;
  toolIds: string[];
  journeyId: string;
}

export type ToolType =
  | "calculadora"
  | "simulador"
  | "comparador"
  | "conversor"
  | "planejador"
  | "radar"
  | "verificador"
  | "consulta";

export interface Tool {
  id: string;
  name: string;
  shortName: string;
  /** Caminho canônico, sempre com barra final. */
  route: string;
  cta: string;
  /** O que a ferramenta faz — decide o ícone do card. */
  type: ToolType;
  /** Categoria do catálogo (assunto). */
  category: string;
  situation: string;
  /** A dúvida do leitor, escrita como ele a formularia. */
  question: string;
  whenItHelps: string;
  /** Frase de abertura do callout dentro de um artigo. */
  calloutLead: string;
  /**
   * Característica útil, curta, mostrada no card: "Até 3 propostas", "Média
   * do Banco Central". Nunca tempo inventado nem promessa.
   */
  badge: string;
  /**
   * Como o leitor pede a ferramenta sem saber o nome dela: "3% ao mês dá
   * quanto ao ano", "casa 500 mil", "banco é verdadeiro". Alimentam a busca
   * da central e a do site.
   */
  aliases: string[];
  /** Termos de busca editoriais (sem acento faz o mesmo efeito). */
  keywords: string[];
  /** Etiquetas do índice de busca. */
  tags: string[];
  /**
   * Termos cuja presença num texto indica que a ferramenta provavelmente
   * ajuda ali. Alimentam a auditoria de cobertura — são pista, não veredito:
   * a auditoria aponta, quem decide é o editorial.
   */
  triggerTerms: string[];
  /**
   * Próximos passos quando a pessoa chega à ferramenta SEM contexto de
   * jornada — por busca orgânica, por link de artigo, pelo rodapé. No máximo
   * dois, em ordem de utilidade: o primeiro vira o botão, o segundo vira uma
   * linha de texto. Despejar as treze aqui transformaria o resultado num menu
   * e enterraria a informação que a pessoa veio buscar.
   *
   * Não é sequência obrigatória nem funil: o motor remove da lista o que já
   * foi usado, e uma ferramenta sem próximo passo útil simplesmente encerra.
   */
  defaultNextSteps: string[];
  /**
   * Data da última alteração visível ao leitor, no formato ISO. Alimenta o
   * `lastmod` do sitemap — ver src/lib/seo/static-page-dates.ts para o motivo
   * de ela ser declarada em vez de gerada no build.
   */
  updatedAt: string;
  /**
   * Aparece na seleção do rodapé. O rodapé não lista as doze: uma coluna com
   * doze itens é o que deixava o rodapé três vezes mais alto que as outras
   * colunas. Ele mostra uma seleção e aponta para o hub, que tem todas.
   */
  inFooter?: boolean;
  /**
   * Destaque da central. Seleção editorial: enquanto o Search Console não
   * tiver volume, nada aqui se chama "mais usada".
   */
  featured?: boolean;
}

interface RegistryFile {
  situations: ToolSituation[];
  categories: ToolCategory[];
  paths: ToolPath[];
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

export function getToolCategories(): ToolCategory[] {
  return load().categories;
}

export interface CategoryGroup {
  category: ToolCategory;
  tools: Tool[];
}

/** Catálogo por assunto, na ordem das categorias e das ferramentas do registro. */
export function getToolsByCategory(): CategoryGroup[] {
  const tools = getTools();
  return getToolCategories()
    .map((category) => ({ category, tools: tools.filter((t) => t.category === category.id) }))
    .filter((group) => group.tools.length > 0);
}

/** Destaques da central, na ordem do registro. */
export function getFeaturedTools(): Tool[] {
  return getTools().filter((t) => t.featured === true);
}

/** Caminhos por situação, com as ferramentas resolvidas na ordem declarada. */
export function getToolPaths(): Array<ToolPath & { tools: Tool[] }> {
  return load().paths.map((p) => ({
    ...p,
    tools: p.toolIds.map((id) => getTool(id)).filter((t): t is Tool => t !== undefined),
  }));
}

/**
 * Retrato leve de cada ferramenta para a busca da central, que roda no
 * navegador: só texto de catálogo, nenhum valor. É o que o componente
 * cliente recebe do servidor.
 */
export interface ToolSearchEntry {
  id: string;
  name: string;
  route: string;
  cta: string;
  type: ToolType;
  category: string;
  categoryLabel: string;
  question: string;
  whenItHelps: string;
  badge: string;
  /** Nome, nome curto e pergunta. */
  names: string[];
  /** Sinônimos leigos. */
  aliases: string[];
  /** Palavras-chave, termos de auditoria e etiquetas: pista, não identidade. */
  hints: string[];
}

export function getToolSearchEntries(): ToolSearchEntry[] {
  const labels = new Map(getToolCategories().map((c) => [c.id, c.label]));
  return getTools().map((t) => ({
    id: t.id,
    name: t.name,
    route: t.route,
    cta: t.cta,
    type: t.type,
    category: t.category,
    categoryLabel: labels.get(t.category) ?? t.category,
    question: t.question,
    whenItHelps: t.whenItHelps,
    badge: t.badge,
    names: [t.name, t.shortName, t.question],
    aliases: t.aliases,
    hints: [...t.keywords, ...t.triggerTerms, ...t.tags],
  }));
}

/** Todas as rotas de ferramenta — usada por auditorias e testes. */
export function getToolRoutes(): string[] {
  return getTools().map((t) => t.route);
}

/** Seleção do rodapé, na ordem do registry. */
export function getFooterTools(): Tool[] {
  return getTools().filter((t) => t.inFooter === true);
}
