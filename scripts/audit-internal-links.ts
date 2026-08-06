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

/* Estratégia de linkagem: todo artigo publicado precisa de links internos
   contextuais de saída e de pelo menos um link externo para fonte oficial
   (docs/editorial.md, seção "Estratégia de linkagem"). */
const OFFICIAL_DOMAINS = [
  "bcb.gov.br",
  "registrato.bcb.gov.br",
  "planalto.gov.br",
  "gov.br",
  "caixa.gov.br",
  "consumidor.gov.br",
  "ibge.gov.br",
  "cfc.org.br",
];

function externalLinks(text: string): string[] {
  const links: string[] = [];
  for (const match of text.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)) {
    links.push(match[1]!);
  }
  for (const match of text.matchAll(/href="(https?:\/\/[^"]+)"/g)) {
    links.push(match[1]!);
  }
  return links;
}

for (const article of getPublishedArticles()) {
  const internal = extractLinks(article.content);
  if (internal.length < 2) {
    findings.push({
      severity: "warning",
      rule: "artigo-com-poucos-links-internos",
      pages: [article.urlPath],
      detail: `Apenas ${internal.length} link(s) interno(s) no corpo — a estratégia pede pelo menos 2.`,
    });
  }
  const externals = externalLinks(article.content);
  const officialExternals = externals.filter((url) =>
    OFFICIAL_DOMAINS.some((domain) => new URL(url).hostname.endsWith(domain)),
  );
  if (officialExternals.length === 0) {
    findings.push({
      severity: "warning",
      rule: "artigo-sem-link-externo-oficial",
      pages: [article.urlPath],
      detail:
        "Nenhum link externo para fonte oficial no corpo do artigo — a estratégia pede pelo menos 1.",
    });
  }
  for (const url of externals) {
    const hostname = new URL(url).hostname;
    if (!url.startsWith("https://")) {
      findings.push({
        severity: "critical",
        rule: "link-externo-sem-https",
        pages: [article.urlPath],
        detail: `Link externo sem HTTPS: ${url}`,
      });
    }
    if (!OFFICIAL_DOMAINS.some((domain) => hostname.endsWith(domain))) {
      findings.push({
        severity: "info",
        rule: "link-externo-fora-da-lista-oficial",
        pages: [article.urlPath],
        detail: `Link externo para domínio não catalogado: ${hostname} — conferir na revisão.`,
      });
    }
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
