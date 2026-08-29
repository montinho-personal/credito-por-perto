/**
 * MAPA FINANCEIRO DA CIDADE
 * ============================================================================
 *
 * Transforma a página local em um guia de utilidade: quais recursos públicos
 * oficiais o morador daquela cidade pode usar quando o assunto é dívida,
 * crédito ou defesa do consumidor.
 *
 * O QUE ESTE MÓDULO NÃO FAZ (por decisão, não por limitação):
 *
 * - Não lista bancos, financeiras, correspondentes ou qualquer serviço
 *   comercial. Não existe ranking, nota, score ou "melhor opção da cidade";
 * - Não usa Google Maps, agregadores ou diretórios como fonte. Um recurso só
 *   entra com URL de órgão público e data real de verificação;
 * - Não infere cobertura. Se não há fonte dizendo que o órgão atende aquela
 *   cidade, o recurso não aparece naquela cidade;
 * - Não usa GPS nem calcula distância. A pergunta do leitor é "isso atende a
 *   minha cidade?", não "quantos metros daqui?".
 *
 * ARQUITETURA — POR QUE UM REGISTRY SEPARADO DO DOSSIÊ
 *
 * Recurso nacional (consumidor.gov.br) e estadual (PAS do Procon-SP) é o
 * mesmo para todas as cidades. Copiá-lo em cada dossiê produziria
 * exatamente o que a política local proíbe: páginas que só trocam o nome da
 * cidade. Por isso:
 *
 *   - recursos NATIONAL/STATEWIDE/REGIONAL vivem UMA vez no registry, com o
 *     escopo declarado, e são resolvidos para a cidade por regra;
 *   - recursos IN_CITY/SERVES_CITY vêm do dossiê daquela cidade, que já
 *     carrega verificação individual com `checkedAt`.
 *
 * O que diferencia a página de Barueri da de Cotia é, então, exatamente o que
 * deve diferenciar: a camada local. É isso que o Indexability Gate mede.
 */

/* ========================================================================== *
 * 1. Tipos
 * ========================================================================== */

/**
 * Alcance declarado do recurso. A ordem do array é a ordem de exibição:
 * o que é da cidade aparece antes do que é do país.
 */
export const COVERAGE_TYPES = [
  "IN_CITY",
  "SERVES_CITY",
  "REGIONAL",
  "STATEWIDE",
  "NATIONAL",
] as const;

export type CoverageType = (typeof COVERAGE_TYPES)[number];

/** Alcance que só existe porque a cidade tem aquele recurso. */
export const LOCAL_COVERAGE: readonly CoverageType[] = ["IN_CITY", "SERVES_CITY"];

export const RESOURCE_CATEGORIES = [
  "consumer-protection",
  "debt-mediation",
  "public-credit",
  "financial-education",
  "official-registry",
  "complaint-channel",
] as const;

export type ResourceCategory = (typeof RESOURCE_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<ResourceCategory, string> = {
  "consumer-protection": "Defesa do consumidor",
  "debt-mediation": "Renegociação e mediação de dívidas",
  "public-credit": "Crédito público e microcrédito",
  "financial-education": "Educação financeira",
  "official-registry": "Consulta oficial",
  "complaint-channel": "Canal de reclamação",
};

/** Como o morador chega ao recurso. Não é endereço: é modo de acesso. */
export type AccessMode = "presencial" | "online" | "telefone" | "misto";

/**
 * Estado de saúde do recurso no pipeline de reverificação.
 *
 * A distinção entre `source_unavailable` e `removed` é a regra mais
 * importante deste módulo: um portal de prefeitura fora do ar por uma tarde
 * NÃO é prova de que o Procon da cidade deixou de existir. Tratar os dois
 * casos como iguais apagaria recursos reais do mapa.
 */
export type ResourceHealthState =
  | "active"
  | "source_unavailable"
  | "removed"
  | "unverified";

export interface ResourceHealth {
  state: ResourceHealthState;
  /** Última TENTATIVA de checagem. Sobe mesmo quando a checagem falha. */
  lastCheckAttemptAt: string;
  /** Nota interna sobre o motivo do estado atual. */
  note?: string;
}

export interface FinancialResource {
  id: string;
  name: string;
  /** Órgão responsável — sempre público. */
  operator: string;
  category: ResourceCategory;
  coverage: CoverageType;
  /** Para que serve, na dúvida do leitor — não na linguagem do órgão. */
  whatItSolves: string;
  /** Como acessar: canal, agendamento, telefone público. */
  howToAccess: string;
  accessMode: AccessMode;
  /** URL oficial do órgão. Nunca agregador, diretório ou mapa. */
  officialSource: string;
  /** Restrição real de público (ex.: hipossuficiência). */
  eligibilityNote?: string;
  /**
   * Data da última verificação BEM-SUCEDIDA. Nunca é avançada por checagem
   * que falhou — ver `applyCheckResult` em resource-health.ts.
   */
  verifiedAt: string;
  health?: ResourceHealth;
}

/**
 * Escopo do recurso no registry. `ibgeCodes` tem prioridade sobre
 * `stateCodes`, que tem prioridade sobre `national`.
 */
export interface ResourceScope {
  national?: boolean;
  stateCodes?: string[];
  /** Códigos IBGE de 7 dígitos — chave primária de município. */
  ibgeCodes?: string[];
}

export interface RegistryResource extends FinancialResource {
  scope: ResourceScope;
}

/** Identidade da cidade para o resolver. IBGE é a chave primária. */
export interface CityKey {
  /** Código IBGE de 7 dígitos (município) ou 2 dígitos (UF). */
  ibgeCode: string | null;
  stateCode: string;
  citySlug: string | null;
  localityId: string;
  localityName: string;
  localityType: string;
}

/* ========================================================================== *
 * 2. Resolução: quais recursos valem para esta cidade
 * ========================================================================== */

const COVERAGE_ORDER: Record<CoverageType, number> = {
  IN_CITY: 0,
  SERVES_CITY: 1,
  REGIONAL: 2,
  STATEWIDE: 3,
  NATIONAL: 4,
};

/**
 * Um recurso do registry vale para a cidade quando o escopo diz isso —
 * nunca por proximidade, semelhança de nome ou "deve atender a região".
 */
export function scopeCoversCity(scope: ResourceScope, city: CityKey): boolean {
  if (scope.ibgeCodes && scope.ibgeCodes.length > 0) {
    return city.ibgeCode !== null && scope.ibgeCodes.includes(city.ibgeCode);
  }
  if (scope.stateCodes && scope.stateCodes.length > 0) {
    return scope.stateCodes.includes(city.stateCode);
  }
  return scope.national === true;
}

/** Recurso só chega ao leitor quando o estado de saúde permite. */
export function isRenderable(resource: FinancialResource): boolean {
  const state = resource.health?.state ?? "active";
  return state === "active" || state === "source_unavailable";
}

export function isLocalCoverage(coverage: CoverageType): boolean {
  return LOCAL_COVERAGE.includes(coverage);
}

function sortResources(a: FinancialResource, b: FinancialResource): number {
  const byCoverage = COVERAGE_ORDER[a.coverage] - COVERAGE_ORDER[b.coverage];
  if (byCoverage !== 0) return byCoverage;
  return a.name.localeCompare(b.name, "pt-BR");
}

/**
 * Junta a camada local (do dossiê) com a camada de registry, elimina
 * duplicatas por id e ordena da cidade para o país.
 */
export function resolveCityResources(
  city: CityKey,
  localResources: FinancialResource[],
  registry: RegistryResource[],
): FinancialResource[] {
  const seen = new Set<string>();
  const out: FinancialResource[] = [];

  for (const resource of localResources) {
    if (seen.has(resource.id) || !isRenderable(resource)) continue;
    seen.add(resource.id);
    out.push(resource);
  }

  for (const resource of registry) {
    if (seen.has(resource.id) || !isRenderable(resource)) continue;
    if (!scopeCoversCity(resource.scope, city)) continue;
    seen.add(resource.id);
    const { scope: _scope, ...rest } = resource;
    out.push(rest);
  }

  return out.sort(sortResources);
}

export interface ResourceGroup {
  category: ResourceCategory;
  label: string;
  resources: FinancialResource[];
}

export function groupByCategory(resources: FinancialResource[]): ResourceGroup[] {
  const groups: ResourceGroup[] = [];
  for (const category of RESOURCE_CATEGORIES) {
    const inCategory = resources.filter((r) => r.category === category);
    if (inCategory.length === 0) continue;
    groups.push({ category, label: CATEGORY_LABEL[category], resources: inCategory });
  }
  return groups;
}

/* ========================================================================== *
 * 3. Teste anti-doorway
 * ========================================================================== */

/**
 * A pergunta que a política local faz: "se eu remover o nome da cidade,
 * estas páginas ainda são substancialmente diferentes?".
 *
 * A assinatura ignora de propósito tudo que é igual por construção —
 * recursos nacionais e estaduais — e olha só para a camada que justifica a
 * existência de uma URL por cidade. Também remove o nome da localidade, para
 * que "Procon de Cotia" e "Procon de Jandira" não passem no teste só por
 * causa do topônimo.
 *
 * `whatItSolves` fica DE FORA. Na camada local ele é texto-modelo escrito por
 * nós ("atendimento de defesa do consumidor na própria cidade…"), idêntico em
 * todas as cidades. Incluí-lo inflava toda assinatura com ~90 caracteres
 * comuns e disfarçava justamente a semelhança que este teste existe para
 * encontrar. O que diferencia de verdade é `howToAccess`: endereço, horário,
 * canal e forma de agendamento verificados naquele município.
 */
export function localSignature(city: CityKey, resources: FinancialResource[]): string {
  const nameTokens = new Set(
    city.localityName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2),
  );

  const parts = resources
    .filter((r) => isLocalCoverage(r.coverage))
    .map((r) =>
      [r.category, r.operator, r.howToAccess]
        .join(" ")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length > 2 && !nameTokens.has(t))
        .join(" "),
    )
    .sort();

  return parts.join(" | ");
}

/** Cidades cuja camada local é indistinguível depois de remover o topônimo. */
export function findDoorwayCollisions(
  entries: Array<{ city: CityKey; resources: FinancialResource[] }>,
): Array<{ signature: string; localityIds: string[] }> {
  const buckets = new Map<string, string[]>();
  for (const entry of entries) {
    const signature = localSignature(entry.city, entry.resources);
    if (signature.trim() === "") continue;
    const bucket = buckets.get(signature) ?? [];
    bucket.push(entry.city.localityId);
    buckets.set(signature, bucket);
  }
  return [...buckets.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([signature, localityIds]) => ({ signature, localityIds: localityIds.sort() }));
}

/* ========================================================================== *
 * 4. Indexability Gate
 * ========================================================================== */

/**
 * EXISTIR NO BANCO DE DADOS NÃO SIGNIFICA MERECER UMA URL INDEXÁVEL.
 *
 * - DO_NOT_GENERATE — a página não deveria existir (sem identidade oficial,
 *   sem dossiê, sem nenhum recurso). Não é caso de noindex: é caso de não
 *   gerar rota;
 * - NOINDEX — a página pode existir para quem chega por link, mas não entra
 *   no índice: o que ela tem é o que qualquer cidade do país tem;
 * - REVIEW — tem substância local, mas a verificação envelheceu ou uma fonte
 *   caiu. Fica no índice e entra na fila de revisão humana;
 * - INDEX — camada local real, verificada e distinta.
 */
export type IndexDecision = "INDEX" | "NOINDEX" | "REVIEW" | "DO_NOT_GENERATE";

export interface IndexabilityInput {
  city: CityKey;
  hasDossier: boolean;
  resources: FinancialResource[];
  /** Assinaturas colidentes vindas de findDoorwayCollisions. */
  doorwayCollision?: boolean;
  /** Data de referência — explícita para o resultado ser determinístico. */
  today: string;
}

export interface IndexabilityResult {
  decision: IndexDecision;
  /** Motivos legíveis, sempre preenchidos — inclusive no INDEX. */
  reasons: string[];
  localResourceCount: number;
  /** Verificação local mais antiga em dias, ou null sem camada local. */
  oldestLocalVerificationDays: number | null;
}

/** Camada local mínima para a URL se sustentar sozinha. */
export const MIN_LOCAL_RESOURCES = 1;
/** Acima disso, a verificação local vira fila de revisão. */
export const STALE_VERIFICATION_DAYS = 365;

function daysBetween(fromIso: string, toIso: string): number | null {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return Math.round((to - from) / 86_400_000);
}

export function evaluateCityIndexability(input: IndexabilityInput): IndexabilityResult {
  const { city, resources, today } = input;
  const renderable = resources.filter(isRenderable);
  const local = renderable.filter((r) => isLocalCoverage(r.coverage));

  const ages = local
    .map((r) => daysBetween(r.verifiedAt, today))
    .filter((d): d is number => d !== null);
  const oldestLocalVerificationDays = ages.length > 0 ? Math.max(...ages) : null;

  const base = { localResourceCount: local.length, oldestLocalVerificationDays };

  /* --- Não gerar rota ---------------------------------------------------- */
  const blocking: string[] = [];
  if (city.localityType === "municipality" && !city.ibgeCode) {
    blocking.push("Município sem código IBGE — identidade oficial não confirmada.");
  }
  if (!input.hasDossier) {
    blocking.push("Sem dossiê local verificado.");
  }
  if (renderable.length === 0) {
    blocking.push("Nenhum recurso oficial exibível para esta localidade.");
  }
  if (blocking.length > 0) {
    return { decision: "DO_NOT_GENERATE", reasons: blocking, ...base };
  }

  /* --- Existe, mas não merece índice ------------------------------------- */
  const noindex: string[] = [];
  if (local.length < MIN_LOCAL_RESOURCES) {
    noindex.push(
      "Sem recurso próprio da cidade: a página ofereceria apenas o que vale para o país inteiro.",
    );
  }
  if (input.doorwayCollision) {
    noindex.push(
      "Camada local idêntica à de outra cidade depois de remover o nome da localidade.",
    );
  }
  if (noindex.length > 0) {
    return { decision: "NOINDEX", reasons: noindex, ...base };
  }

  /* --- Indexável, mas precisa de olho humano ------------------------------ */
  const review: string[] = [];
  if (
    oldestLocalVerificationDays !== null &&
    oldestLocalVerificationDays > STALE_VERIFICATION_DAYS
  ) {
    review.push(
      `Verificação local mais antiga tem ${oldestLocalVerificationDays} dias — acima do limite de ${STALE_VERIFICATION_DAYS}.`,
    );
  }
  const unavailable = local.filter((r) => r.health?.state === "source_unavailable");
  if (unavailable.length > 0) {
    review.push(
      `Fonte oficial indisponível na última checagem: ${unavailable.map((r) => r.name).join(", ")}.`,
    );
  }
  if (review.length > 0) {
    return { decision: "REVIEW", reasons: review, ...base };
  }

  return {
    decision: "INDEX",
    reasons: [
      `${local.length} recurso(s) próprio(s) da localidade, verificado(s) e distinto(s).`,
    ],
    ...base,
  };
}

/** Só INDEX e REVIEW seguem no índice; REVIEW é indexável com pendência. */
export function decisionAllowsIndexing(decision: IndexDecision): boolean {
  return decision === "INDEX" || decision === "REVIEW";
}

/** DO_NOT_GENERATE é o único caso em que a rota não deve nem existir. */
export function decisionAllowsRoute(decision: IndexDecision): boolean {
  return decision !== "DO_NOT_GENERATE";
}
