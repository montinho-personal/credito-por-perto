/**
 * Auditoria de links internos: links quebrados (URL que não existe) e
 * páginas órfãs (publicadas mas sem nenhum link interno apontando para elas).
 */
import fs from "node:fs";
import path from "node:path";
import { getAllArticles, getPublishedArticles } from "../src/lib/content/articles";
import { getAllLocalGuides } from "../src/lib/content/local";
import { STATIC_INDEXABLE_PATHS } from "../src/lib/seo/sitemap-entries";
import {
  buildReport,
  finishAudit,
  writeJsonReport,
  type Finding,
} from "./lib/audit-helpers";

const findings: Finding[] = [];
const articles = getAllArticles();
const guides = getAllLocalGuides();

const knownPaths = new Set<string>([
  ...STATIC_INDEXABLE_PATHS,
  "/busca/",
  "/feed.xml",
  ...articles.map((a) => a.urlPath),
  ...guides.map((g) => g.urlPath),
  ...new Set(guides.map((g) => `/emprestimos/${g.frontmatter.stateCode}/`)),
]);

function extractLinks(text: string): string[] {
  const links: string[] = [];
  for (const match of text.matchAll(/\]\((\/[^)\s#?]*)[^)]*\)/g)) {
    links.push(match[1]!);
  }
  for (const match of text.matchAll(/href=\{?["'](\/[^"'#?]*)["']\}?/g)) {
    links.push(match[1]!);
  }
  return links;
}

/* Fontes de links: conteúdo MDX + páginas TSX do app + configuração de navegação */
const linkSources: Array<{ source: string; text: string }> = [
  ...articles.map((a) => ({ source: a.urlPath, text: a.content })),
  ...guides.map((g) => ({ source: g.urlPath, text: g.content })),
];

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith(".tsx") || entry.name.endsWith(".ts") ? [full] : [];
  });
}
for (const file of walk(path.join(process.cwd(), "src"))) {
  linkSources.push({
    source: path.relative(process.cwd(), file),
    text: fs.readFileSync(file, "utf8"),
  });
}

const incomingLinks = new Map<string, Set<string>>();
for (const { source, text } of linkSources) {
  for (const link of extractLinks(text)) {
    const normalized = link.endsWith("/") || link.includes(".") ? link : `${link}/`;
    if (!knownPaths.has(normalized)) {
      findings.push({
        severity: "critical",
        rule: "link-interno-quebrado",
        pages: [source],
        detail: `Link para URL inexistente: ${link}`,
      });
    }
    if (!incomingLinks.has(normalized)) incomingLinks.set(normalized, new Set());
    if (normalized !== source) incomingLinks.get(normalized)!.add(source);
  }
}

/* Páginas órfãs: artigos publicados sem nenhum link interno recebido.
   Listagens automáticas (hubs, blog) linkam todos os artigos publicados,
   então consideramos órfã a página que também não recebe link contextual. */
for (const article of getPublishedArticles()) {
  const incoming = incomingLinks.get(article.urlPath) ?? new Set();
  const contextual = [...incoming].filter((s) => s.startsWith("/"));
  if (contextual.length === 0) {
    findings.push({
      severity: "warning",
      rule: "pagina-sem-links-contextuais",
      pages: [article.urlPath],
      detail:
        "Nenhum outro conteúdo linka esta página; ela depende só das listagens automáticas.",
    });
  }
}

const report = buildReport("links-internos", findings);
writeJsonReport("internal-links-report.json", report);
finishAudit(report);
