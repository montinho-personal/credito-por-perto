/**
 * Auditoria de fontes: todo artigo publicado precisa de registro de fontes
 * (SourceLedger) com datas de consulta válidas; gera relatório de frescor
 * para orientar re-verificação periódica.
 */
import { getAllArticles } from "../src/lib/content/articles";
import { getSourceLedger } from "../src/lib/content/ledgers";
import {
  buildReport,
  finishAudit,
  writeJsonReport,
  type Finding,
} from "./lib/audit-helpers";

const STALE_AFTER_DAYS = 180;

const findings: Finding[] = [];
const today = new Date();

for (const article of getAllArticles()) {
  const fm = article.frontmatter;
  const published = fm.status === "published";
  const ledger = getSourceLedger(fm.slug);

  if (!ledger || ledger.claims.length === 0) {
    findings.push({
      severity: published ? "critical" : "warning",
      rule: "sem-registro-de-fontes",
      pages: [article.urlPath],
      detail: "Artigo sem SourceLedger com afirmações e fontes.",
    });
    continue;
  }

  if (ledger.articleSlug !== fm.slug) {
    findings.push({
      severity: "critical",
      rule: "ledger-slug-divergente",
      pages: [article.urlPath],
      detail: `Ledger aponta para "${ledger.articleSlug}".`,
    });
  }

  for (const claim of ledger.claims) {
    const accessed = new Date(`${claim.accessedAt}T00:00:00Z`);
    if (Number.isNaN(accessed.getTime())) {
      findings.push({
        severity: "critical",
        rule: "data-de-consulta-invalida",
        pages: [article.urlPath],
        detail: `Claim ${claim.claimId} com accessedAt inválido.`,
      });
      continue;
    }
    if (accessed.getTime() > today.getTime()) {
      findings.push({
        severity: "critical",
        rule: "data-de-consulta-futura",
        pages: [article.urlPath],
        detail: `Claim ${claim.claimId} com data de consulta no futuro.`,
      });
    }
    const ageDays = (today.getTime() - accessed.getTime()) / 86_400_000;
    if (published && ageDays > STALE_AFTER_DAYS) {
      findings.push({
        severity: "warning",
        rule: "fonte-precisa-reverificacao",
        pages: [article.urlPath],
        detail: `Claim ${claim.claimId} consultado há ${Math.round(ageDays)} dias — re-verificar.`,
      });
    }
  }

  if (published && !fm.sourceCheckedAt) {
    findings.push({
      severity: "warning",
      rule: "sem-source-checked-at",
      pages: [article.urlPath],
      detail: "Artigo publicado sem data de verificação de fontes no frontmatter.",
    });
  }
}

const report = buildReport("frescor-de-fontes", findings);
writeJsonReport("source-freshness-report.json", report);
finishAudit(report);
