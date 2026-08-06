/**
 * Auditoria de canibalização e propriedade de intenção
 * (data/query-ownership-map.json + briefings dos artigos).
 *
 * Cada intenção principal tem uma única URL proprietária; dois conteúdos não
 * podem disputar a mesma consulta.
 */
import fs from "node:fs";
import path from "node:path";
import { getAllArticles } from "../src/lib/content/articles";
import { getAllLocalGuides } from "../src/lib/content/local";
import { getBriefing } from "../src/lib/content/ledgers";
import { STATIC_INDEXABLE_PATHS } from "../src/lib/seo/sitemap-entries";
import {
  buildReport,
  finishAudit,
  normalizeForComparison,
  writeJsonReport,
  type Finding,
} from "./lib/audit-helpers";

interface OwnershipMap {
  [intent: string]: { canonicalOwner: string; supportingPages: string[] };
}

const map = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "data", "query-ownership-map.json"), "utf8"),
) as OwnershipMap;

const findings: Finding[] = [];
const articles = getAllArticles();
const guides = getAllLocalGuides();
const knownPaths = new Set<string>([
  ...STATIC_INDEXABLE_PATHS,
  ...articles.map((a) => a.urlPath),
  ...guides.map((g) => g.urlPath),
]);

/* 1. Donos e páginas de apoio precisam existir */
const owners = new Map<string, string>();
for (const [intent, entry] of Object.entries(map)) {
  if (!knownPaths.has(entry.canonicalOwner)) {
    findings.push({
      severity: "critical",
      rule: "dono-inexistente",
      pages: [entry.canonicalOwner],
      detail: `Intenção "${intent}" aponta para URL que não existe.`,
    });
  }
  for (const support of entry.supportingPages) {
    if (!knownPaths.has(support)) {
      findings.push({
        severity: "critical",
        rule: "pagina-apoio-inexistente",
        pages: [support],
        detail: `Página de apoio da intenção "${intent}" não existe.`,
      });
    }
  }
  const previous = owners.get(normalizeForComparison(intent));
  if (previous) {
    findings.push({
      severity: "critical",
      rule: "intencao-duplicada-no-mapa",
      pages: [previous, entry.canonicalOwner],
      detail: `Intenção "${intent}" registrada mais de uma vez.`,
    });
  }
  owners.set(normalizeForComparison(intent), entry.canonicalOwner);
}

/* 2. Duas páginas não podem declarar a mesma intenção primária no briefing */
const intentToPage = new Map<string, string>();
for (const article of articles) {
  const briefing = getBriefing(article.frontmatter.slug);
  if (!briefing) {
    findings.push({
      severity: article.frontmatter.status === "published" ? "critical" : "warning",
      rule: "artigo-sem-briefing",
      pages: [article.urlPath],
      detail: "Artigo sem briefing de originalidade registrado.",
    });
    continue;
  }
  const intent = normalizeForComparison(briefing.primaryIntent);
  const existing = intentToPage.get(intent);
  if (existing) {
    findings.push({
      severity: "critical",
      rule: "intencao-primaria-disputada",
      pages: [existing, article.urlPath],
      detail: `Duas páginas declaram a intenção primária "${briefing.primaryIntent}".`,
    });
  }
  intentToPage.set(intent, article.urlPath);

  /* 3. A intenção primária do briefing deve ter dono no mapa — e ser a própria página */
  const owner = owners.get(intent);
  if (!owner) {
    findings.push({
      severity: "warning",
      rule: "intencao-fora-do-mapa",
      pages: [article.urlPath],
      detail: `Intenção "${briefing.primaryIntent}" não registrada em query-ownership-map.json.`,
    });
  } else if (owner !== article.urlPath) {
    findings.push({
      severity: "critical",
      rule: "pagina-disputa-intencao-de-outra",
      pages: [article.urlPath, owner],
      detail: `Página declara intenção cujo dono é outra URL.`,
    });
  }
}

const report = buildReport("canibalizacao", findings);
writeJsonReport("cannibalization-report.json", report);
finishAudit(report);
