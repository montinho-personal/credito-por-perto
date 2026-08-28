/**
 * MONTAGEM DO MAPA FINANCEIRO DE UMA LOCALIDADE
 * ============================================================================
 *
 * Junta as duas camadas descritas em financial-map.ts:
 *
 *   camada local   ← dossiê da cidade (content/local-dossiers/*.json)
 *   camada geral   ← registry (data/financial-map/registry.json)
 *
 * O ponto delicado é a DEDUPLICAÇÃO. Os dossiês foram escritos antes deste
 * módulo e quase todos repetem o consumidor.gov.br dentro de
 * `consumerProtectionResources`. Se esse item entrasse como recurso LOCAL,
 * toda cidade passaria no Indexability Gate por causa de um link federal —
 * o gate mediria ruído em vez de substância local. Por isso qualquer item do
 * dossiê cuja fonte oficial já esteja no registry como NATIONAL/STATEWIDE é
 * descartado da camada local: ele reaparece, uma vez só, pela camada geral.
 */

import fs from "node:fs";
import path from "node:path";
import {
  evaluateCityIndexability,
  findDoorwayCollisions,
  isLocalCoverage,
  resolveCityResources,
  type CityKey,
  type FinancialResource,
  type IndexabilityResult,
  type RegistryResource,
  type ResourceCategory,
} from "@/lib/local/financial-map";
import { getAllLocalGuides, getLocalDossier, type LocalDossier } from "@/lib/content/local";
import { getLocalities } from "@/lib/local-seo/states";

const REGISTRY_FILE = path.join(process.cwd(), "data", "financial-map", "registry.json");

let registryCache: RegistryResource[] | null = null;

export function getResourceRegistry(): RegistryResource[] {
  if (registryCache) return registryCache;
  const raw = JSON.parse(fs.readFileSync(REGISTRY_FILE, "utf8")) as {
    resources: RegistryResource[];
  };
  registryCache = raw.resources;
  return registryCache;
}

/* ========================================================================== *
 * Normalização de fonte e deduplicação
 * ========================================================================== */

/** host + primeiro segmento do caminho, sem www — granularidade suficiente. */
export function sourceFingerprint(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    const firstSegment = parsed.pathname.split("/").filter(Boolean)[0] ?? "";
    return `${host}/${firstSegment}`;
  } catch {
    return url.trim().toLowerCase();
  }
}

/**
 * Fingerprints que o registry já cobre — não podem virar recurso local.
 *
 * A comparação é por host + primeiro segmento, e NUNCA só por host. A versão
 * por host parecia mais segura e estava errada: `procon.sp.gov.br/caieiras/`
 * é a página oficial do Procon MUNICIPAL de Caieiras, hospedada no portal
 * estadual. Bloquear o host inteiro apagava o recurso mais local de cinco
 * cidades e as jogava em NOINDEX por falta de camada local — um falso
 * negativo do gate causado pela deduplicação, não pelo conteúdo.
 *
 * Com a regra por segmento, `procon.sp.gov.br/` (a fundação estadual, no
 * registry) e `procon.sp.gov.br/caieiras/` (o Procon da cidade, no dossiê)
 * são coisas diferentes — que é o que de fato são.
 */
function registryFingerprints(registry: RegistryResource[]): Set<string> {
  return new Set(registry.map((r) => sourceFingerprint(r.officialSource)));
}

function coveredByRegistry(url: string, fingerprints: Set<string>): boolean {
  return fingerprints.has(sourceFingerprint(url));
}

/* ========================================================================== *
 * Dossiê → recursos
 * ========================================================================== */

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function categoryForOrganization(text: string): ResourceCategory {
  const t = text.toLowerCase();
  if (/superendivid|cejusc|concilia|media/.test(t)) return "debt-mediation";
  if (/banco do povo|microcr|cr[eé]dito|fomento|desenvolve/.test(t)) return "public-credit";
  if (/educa[çc][ãa]o financeira|oficina|curso/.test(t)) return "financial-education";
  return "consumer-protection";
}

function accessModeFor(text: string): FinancialResource["accessMode"] {
  const t = text.toLowerCase();
  const hasOnline = /on-line|online|site|portal|digital|whatsapp|aplicativo|e-mail/.test(t);
  const hasPresencial = /rua |avenida |av\.|pra[çc]a|nº|n°|presencial|balc[ãa]o|posto/.test(t);
  if (hasOnline && hasPresencial) return "misto";
  if (hasOnline) return "online";
  return "presencial";
}

/**
 * Converte o dossiê da cidade na camada local de recursos.
 *
 * `verifiedServiceInformation` NÃO vira recurso: é informação de atendimento
 * sobre algo que já está listado ("o Procon fica dentro do Ganha Tempo"), e
 * contá-la como recurso inflaria artificialmente a camada local que o gate
 * mede. Ela é devolvida à parte, para aparecer como nota.
 */
export function localResourcesFromDossier(
  dossier: LocalDossier,
  registry: RegistryResource[],
): FinancialResource[] {
  const fingerprints = registryFingerprints(registry);
  const out: FinancialResource[] = [];

  for (const item of dossier.consumerProtectionResources ?? []) {
    if (coveredByRegistry(item.officialSource, fingerprints)) continue;
    out.push({
      id: `${dossier.localityId}--${slugify(item.organization)}`,
      name: item.organization,
      operator: item.organization,
      category: categoryForOrganization(item.organization),
      coverage: "IN_CITY",
      whatItSolves:
        "Atendimento de defesa do consumidor na própria cidade para conflitos de crédito, cobrança e contrato.",
      howToAccess: item.service,
      accessMode: accessModeFor(item.service),
      officialSource: item.officialSource,
      verifiedAt: item.checkedAt,
    });
  }

  for (const item of dossier.verifiedLocalPrograms ?? []) {
    if (coveredByRegistry(item.officialSource, fingerprints)) continue;
    out.push({
      id: `${dossier.localityId}--${slugify(item.program)}`,
      name: item.program,
      operator: dossier.localityName,
      category: categoryForOrganization(item.program),
      coverage: "IN_CITY",
      whatItSolves:
        "Programa público de crédito ou apoio econômico com atendimento vinculado a este município.",
      howToAccess: item.detail,
      accessMode: accessModeFor(item.detail),
      officialSource: item.officialSource,
      verifiedAt: item.checkedAt,
    });
  }

  return out;
}

/* ========================================================================== *
 * Mapa completo por localidade
 * ========================================================================== */

export interface CityFinancialMap {
  city: CityKey;
  resources: FinancialResource[];
  /** Informação de atendimento verificada — nota, não recurso contável. */
  serviceNotes: LocalDossier["verifiedServiceInformation"];
  /** O que ainda não foi confirmado — nunca apresentado como recurso. */
  pendingVerification: string[];
  indexability: IndexabilityResult;
}

export function cityKeyFromLocalityId(localityId: string): CityKey | null {
  const locality = getLocalities().find((l) => l.id === localityId);
  if (!locality) return null;
  return {
    ibgeCode: locality.ibgeCode ?? null,
    stateCode: locality.stateCode,
    citySlug: locality.citySlug ?? null,
    localityId: locality.id,
    localityName: locality.name,
    localityType: locality.localityType,
  };
}

/**
 * Colisões de doorway são uma propriedade do conjunto, não de uma página.
 * Por isso o cálculo roda uma vez sobre todas as localidades com dossiê e o
 * resultado é reaproveitado — inclusive na renderização de uma página só.
 */
let collisionCache: Set<string> | null = null;

export function getDoorwayCollisionIds(): Set<string> {
  if (collisionCache) return collisionCache;
  const registry = getResourceRegistry();
  const entries: Array<{ city: CityKey; resources: FinancialResource[] }> = [];

  for (const guide of getAllLocalGuides()) {
    const { dossierId } = guide.frontmatter;
    if (!dossierId) continue;
    const dossier = getLocalDossier(dossierId);
    const city = cityKeyFromLocalityId(dossierId);
    if (!dossier || !city) continue;
    entries.push({ city, resources: localResourcesFromDossier(dossier, registry) });
  }

  const ids = new Set<string>();
  for (const collision of findDoorwayCollisions(entries)) {
    for (const id of collision.localityIds) ids.add(id);
  }
  collisionCache = ids;
  return ids;
}

export function buildCityFinancialMap(
  localityId: string,
  today: string,
): CityFinancialMap | null {
  const city = cityKeyFromLocalityId(localityId);
  if (!city) return null;

  const registry = getResourceRegistry();
  const dossier = getLocalDossier(localityId);
  const localResources = dossier ? localResourcesFromDossier(dossier, registry) : [];
  const resources = resolveCityResources(city, localResources, registry);

  const indexability = evaluateCityIndexability({
    city,
    hasDossier: Boolean(dossier),
    resources,
    doorwayCollision: getDoorwayCollisionIds().has(localityId),
    today,
  });

  return {
    city,
    resources,
    serviceNotes: dossier?.verifiedServiceInformation ?? [],
    pendingVerification: dossier?.pendingVerification ?? [],
    indexability,
  };
}

/** Quantos recursos desta cidade existem por serem daquela cidade. */
export function countLocalResources(map: CityFinancialMap): number {
  return map.resources.filter((r) => isLocalCoverage(r.coverage)).length;
}
