/**
 * Auditoria do Mapa Financeiro da Cidade.
 *
 * Checa o que nenhum teste unitário pega, porque depende dos dados reais:
 * recurso sem fonte oficial pública, fonte que não sustenta a afirmação,
 * serviço comercial infiltrado no registry, verificação envelhecida, colisão
 * de doorway entre cidades e divergência entre o estado editorial da página e
 * a decisão do Indexability Gate.
 */
import {
  findDoorwayCollisions,
  isLocalCoverage,
  type CityKey,
  type FinancialResource,
} from "../src/lib/local/financial-map";
import {
  buildCityFinancialMap,
  cityKeyFromLocalityId,
  getResourceRegistry,
  localResourcesFromDossier,
} from "../src/lib/local/city-map";
import { getAllLocalGuides, getLocalDossier } from "../src/lib/content/local";
import { getLocalities } from "../src/lib/local-seo/states";
import { buildReport, finishAudit, writeJsonReport, type Finding } from "./lib/audit-helpers";

const TODAY = new Date().toISOString().slice(0, 10);
const STALE_WARNING_DAYS = 240;

/** Domínios aceitos como fonte primária para um recurso público. */
const PUBLIC_DOMAIN = /\.(gov\.br|jus\.br|def\.br|leg\.br|mp\.br)(\/|$|:)/;

/** Fontes que nunca valem como prova de existência de um serviço público. */
const FORBIDDEN_SOURCE = /google\.[a-z.]+\/maps|maps\.app\.goo\.gl|waze\.|facebook\.com|instagram\.com|wikipedia\.org|reclameaqui/i;

/** Vocabulário comercial que não pode aparecer num mapa de serviço público. */
const COMMERCIAL_TERMS = [
  "melhor banco",
  "as melhores",
  "ranking",
  "taxa a partir de",
  "contrate agora",
  "simule agora",
  "aprovação garantida",
  "crédito rápido",
];

const findings: Finding[] = [];
const localities = getLocalities();

/* ------------------------------------------------------------------ *
 * Registry
 * ------------------------------------------------------------------ */

const registry = getResourceRegistry();
const registryIds = new Set<string>();

for (const resource of registry) {
  const where = [`registry:${resource.id}`];

  if (registryIds.has(resource.id)) {
    findings.push({
      severity: "critical",
      rule: "registry-id-duplicado",
      pages: where,
      detail: "Dois recursos do registry compartilham o mesmo id.",
    });
  }
  registryIds.add(resource.id);

  if (!PUBLIC_DOMAIN.test(resource.officialSource)) {
    findings.push({
      severity: "critical",
      rule: "fonte-nao-oficial",
      pages: where,
      detail: `Fonte fora de domínio público: ${resource.officialSource}`,
    });
  }
  if (FORBIDDEN_SOURCE.test(resource.officialSource)) {
    findings.push({
      severity: "critical",
      rule: "fonte-proibida",
      pages: where,
      detail: "Mapa, rede social ou agregador usado como fonte oficial.",
    });
  }
  if (isLocalCoverage(resource.coverage)) {
    findings.push({
      severity: "critical",
      rule: "registry-com-cobertura-local",
      pages: where,
      detail:
        "Recurso IN_CITY/SERVES_CITY no registry — camada local pertence ao dossiê da cidade.",
    });
  }
  if (
    !resource.scope.national &&
    (resource.scope.stateCodes ?? []).length === 0 &&
    (resource.scope.ibgeCodes ?? []).length === 0
  ) {
    findings.push({
      severity: "critical",
      rule: "recurso-sem-escopo",
      pages: where,
      detail: "Recurso sem escopo declarado não alcança cidade nenhuma.",
    });
  }
}

const registryText = JSON.stringify(registry).toLowerCase();
for (const term of COMMERCIAL_TERMS) {
  if (registryText.includes(term)) {
    findings.push({
      severity: "critical",
      rule: "linguagem-comercial-no-mapa",
      pages: ["registry"],
      detail: `Termo comercial "${term}" no registry de serviços públicos.`,
    });
  }
}

/* ------------------------------------------------------------------ *
 * Camada local, cidade a cidade
 * ------------------------------------------------------------------ */

function daysSince(iso: string): number | null {
  const then = Date.parse(`${iso}T00:00:00Z`);
  const now = Date.parse(`${TODAY}T00:00:00Z`);
  if (Number.isNaN(then) || Number.isNaN(now)) return null;
  return Math.round((now - then) / 86_400_000);
}

const doorwayEntries: Array<{ city: CityKey; resources: FinancialResource[] }> = [];

for (const guide of getAllLocalGuides()) {
  const fm = guide.frontmatter;
  const page = guide.urlPath;
  const dossierId = fm.dossierId;

  if (!dossierId) continue;

  const locality = localities.find((l) => l.id === dossierId);
  if (locality && locality.localityType === "municipality" && !locality.ibgeCode) {
    findings.push({
      severity: "critical",
      rule: "municipio-sem-codigo-ibge",
      pages: [page],
      detail:
        "Município sem código IBGE em data/localities.json — a chave primária do mapa financeiro.",
    });
  }

  const dossier = getLocalDossier(dossierId);
  const city = cityKeyFromLocalityId(dossierId);
  if (!dossier || !city) continue;

  const localResources = localResourcesFromDossier(dossier, registry);
  doorwayEntries.push({ city, resources: localResources });

  for (const resource of localResources) {
    if (!PUBLIC_DOMAIN.test(resource.officialSource)) {
      findings.push({
        severity: "critical",
        rule: "fonte-nao-oficial",
        pages: [page],
        detail: `"${resource.name}" tem fonte fora de domínio público: ${resource.officialSource}`,
      });
    }
    if (FORBIDDEN_SOURCE.test(resource.officialSource)) {
      findings.push({
        severity: "critical",
        rule: "fonte-proibida",
        pages: [page],
        detail: `"${resource.name}" usa mapa/rede social/agregador como fonte.`,
      });
    }
    const age = daysSince(resource.verifiedAt);
    if (age !== null && age > STALE_WARNING_DAYS) {
      findings.push({
        severity: "warning",
        rule: "verificacao-local-envelhecendo",
        pages: [page],
        detail: `"${resource.name}" verificado há ${age} dias.`,
      });
    }
  }

  const map = buildCityFinancialMap(dossierId, TODAY);
  if (!map) continue;
  const { decision, reasons } = map.indexability;

  if (decision === "DO_NOT_GENERATE") {
    findings.push({
      severity: "critical",
      rule: "rota-local-sem-lastro",
      pages: [page],
      detail: `Indexability Gate: DO_NOT_GENERATE — ${reasons.join(" ")}`,
    });
  }
  if (fm.status === "published" && decision === "NOINDEX") {
    findings.push({
      severity: "critical",
      rule: "publicada-sem-camada-local",
      pages: [page],
      detail: `Página publicada que o gate manda não indexar — ${reasons.join(" ")}`,
    });
  }
  if (decision === "REVIEW") {
    findings.push({
      severity: "warning",
      rule: "mapa-local-para-revisar",
      pages: [page],
      detail: reasons.join(" "),
    });
  }
  if (fm.noindex && decision === "INDEX") {
    findings.push({
      severity: "warning",
      rule: "noindex-manual-contra-gate",
      pages: [page],
      detail: "Frontmatter força noindex numa página que o gate aprovaria.",
    });
  }
}

/* ------------------------------------------------------------------ *
 * Anti-doorway
 * ------------------------------------------------------------------ */

for (const collision of findDoorwayCollisions(doorwayEntries)) {
  findings.push({
    severity: "critical",
    rule: "camada-local-indistinguivel",
    pages: collision.localityIds,
    detail:
      "Removido o nome da localidade, a camada local destas cidades fica idêntica — é doorway.",
  });
}

const report = buildReport("mapa-financeiro", findings);
writeJsonReport("financial-map-report.json", report);
finishAudit(report);
