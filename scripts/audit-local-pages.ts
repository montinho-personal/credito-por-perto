/**
 * Auditoria de qualidade das páginas locais (docs/local-content-policy.md).
 *
 * Uma página local só pode estar publicada/indexável com: classificação
 * administrativa correta, dossiê com fontes oficiais verificadas, recurso
 * local acionável, data de verificação e conteúdo que não dependa da troca
 * do nome da cidade (essa última checagem vive em audit-originality).
 */
import { getAllLocalGuides, getLocalDossier } from "../src/lib/content/local";
import { getLocalities } from "../src/lib/local-seo/states";
import {
  buildReport,
  finishAudit,
  writeJsonReport,
  type Finding,
} from "./lib/audit-helpers";

const findings: Finding[] = [];
const localities = getLocalities();

for (const guide of getAllLocalGuides()) {
  const fm = guide.frontmatter;
  const published = fm.status === "published";

  /* Classificação administrativa deve bater com a base de localidades */
  const locality = localities.find(
    (l) =>
      l.stateCode === fm.stateCode &&
      (l.citySlug ?? "") === (fm.citySlug ?? "") &&
      (l.districtSlug ?? "") === (fm.districtSlug ?? ""),
  );
  if (!locality) {
    findings.push({
      severity: "critical",
      rule: "localidade-fora-da-base",
      pages: [guide.urlPath],
      detail: "Localidade não cadastrada em data/localities.json.",
    });
  } else if (locality.localityType !== fm.localityType) {
    findings.push({
      severity: "critical",
      rule: "classificacao-administrativa-divergente",
      pages: [guide.urlPath],
      detail: `Frontmatter diz "${fm.localityType}", base diz "${locality.localityType}".`,
    });
  }

  /* Regiões multi-município (ex.: Alphaville) precisam declarar municípios */
  if (
    fm.localityType === "region" &&
    (!fm.municipalitiesInvolved || fm.municipalitiesInvolved.length === 0)
  ) {
    findings.push({
      severity: "critical",
      rule: "regiao-sem-municipios-declarados",
      pages: [guide.urlPath],
      detail: "Região sem municipalitiesInvolved no frontmatter.",
    });
  }

  const dossier = fm.dossierId ? getLocalDossier(fm.dossierId) : undefined;
  if (!dossier) {
    findings.push({
      severity: published ? "critical" : "warning",
      rule: "sem-dossie-local",
      pages: [guide.urlPath],
      detail: "Guia local sem dossiê estruturado (LocalEvidence).",
    });
    continue;
  }

  if (published) {
    if (dossier.officialSources.length === 0) {
      findings.push({
        severity: "critical",
        rule: "publicada-sem-fonte-oficial",
        pages: [guide.urlPath],
        detail: "Página local publicada sem fonte oficial verificada no dossiê.",
      });
    }
    if (dossier.consumerProtectionResources.length === 0) {
      findings.push({
        severity: "critical",
        rule: "publicada-sem-recurso-local-acionavel",
        pages: [guide.urlPath],
        detail:
          "Página local publicada sem canal de proteção ao consumidor verificado.",
      });
    }
    if (!fm.lastVerifiedAt) {
      findings.push({
        severity: "critical",
        rule: "publicada-sem-data-de-verificacao",
        pages: [guide.urlPath],
        detail: "Página local publicada sem data real de verificação.",
      });
    }
    if (fm.noindex) {
      findings.push({
        severity: "warning",
        rule: "publicada-com-noindex",
        pages: [guide.urlPath],
        detail: "Guia publicado mas marcado noindex — estado inconsistente.",
      });
    }
  } else {
    if (!fm.noindex) {
      findings.push({
        severity: "critical",
        rule: "rascunho-sem-noindex",
        pages: [guide.urlPath],
        detail: "Guia local em rascunho sem noindex explícito.",
      });
    }
    if ((dossier.pendingVerification ?? []).length === 0) {
      findings.push({
        severity: "warning",
        rule: "rascunho-sem-pendencias-registradas",
        pages: [guide.urlPath],
        detail:
          "Rascunho sem lista de verificações pendentes — registrar o que falta.",
      });
    }
  }
}

const report = buildReport("qualidade-local", findings);
writeJsonReport("local-quality-report.json", report);
finishAudit(report);
