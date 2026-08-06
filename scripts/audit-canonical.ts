/**
 * Auditoria de canonicalização (docs/canonical-policy.md).
 *
 * Verifica: canonicals absolutas/HTTPS/www/trailing-slash, unicidade,
 * coerência com o sitemap, ausência de rascunhos e noindex no sitemap e
 * links internos apontando para caminhos canônicos.
 * Falhas críticas devem interromper o build de produção (exit code 1).
 */
import fs from "node:fs";
import path from "node:path";
import { getAllArticles, getPublishedArticles } from "../src/lib/content/articles";
import {
  getAllLocalGuides,
  isLocalGuideIndexable,
} from "../src/lib/content/local";
import { getSitemapEntries, STATIC_INDEXABLE_PATHS } from "../src/lib/seo/sitemap-entries";
import { isValidCanonical } from "../src/lib/seo/canonical";
import { SITE_URL } from "../src/lib/site";
import {
  buildReport,
  finishAudit,
  writeHtmlReport,
  writeJsonReport,
  type Finding,
} from "./lib/audit-helpers";

const findings: Finding[] = [];

const articles = getAllArticles();
const guides = getAllLocalGuides();

/* 1. Canonicals válidas e autorreferenciais */
for (const article of articles) {
  if (!isValidCanonical(article.canonical)) {
    findings.push({
      severity: "critical",
      rule: "canonical-invalida",
      pages: [article.urlPath],
      detail: `Canonical fora da política: ${article.canonical}`,
    });
  }
  if (
    !article.frontmatter.canonical &&
    article.canonical !== `${SITE_URL}${article.urlPath}`
  ) {
    findings.push({
      severity: "critical",
      rule: "canonical-nao-autorreferencial",
      pages: [article.urlPath],
      detail: "Canonical não aponta para a própria URL.",
    });
  }
}
for (const guide of guides) {
  if (!isValidCanonical(guide.canonical)) {
    findings.push({
      severity: "critical",
      rule: "canonical-invalida",
      pages: [guide.urlPath],
      detail: `Canonical fora da política: ${guide.canonical}`,
    });
  }
  const genericTargets = ["/", "/emprestimos/"];
  if (genericTargets.includes(guide.canonical.replace(SITE_URL, ""))) {
    findings.push({
      severity: "critical",
      rule: "pagina-local-canonical-generica",
      pages: [guide.urlPath],
      detail: "Página local com canonical apontando para página genérica.",
    });
  }
}

/* 2. Canonicals duplicadas (duas páginas donas da mesma URL) */
const canonicalSeen = new Map<string, string>();
for (const doc of [...articles, ...guides]) {
  const existing = canonicalSeen.get(doc.canonical);
  if (existing && existing !== doc.urlPath) {
    findings.push({
      severity: "critical",
      rule: "canonical-duplicada",
      pages: [existing, doc.urlPath],
      detail: `Duas páginas declaram a mesma canonical: ${doc.canonical}`,
    });
  }
  canonicalSeen.set(doc.canonical, doc.urlPath);
}

/* 3. Sitemap: só URLs canônicas, publicadas e indexáveis */
const sitemapUrls = new Set(getSitemapEntries().map((e) => e.url));
for (const url of sitemapUrls) {
  if (!isValidCanonical(url)) {
    findings.push({
      severity: "critical",
      rule: "sitemap-url-fora-da-politica",
      pages: [url],
      detail: "URL do sitemap não segue a política de canonical.",
    });
  }
}
for (const article of articles) {
  const inSitemap = sitemapUrls.has(article.canonical);
  const shouldBe =
    article.frontmatter.status === "published" && !article.frontmatter.noindex;
  if (inSitemap && !shouldBe) {
    findings.push({
      severity: "critical",
      rule: "sitemap-inclui-nao-indexavel",
      pages: [article.urlPath],
      detail: "Rascunho ou página noindex presente no sitemap.",
    });
  }
  if (!inSitemap && shouldBe) {
    findings.push({
      severity: "critical",
      rule: "sitemap-omite-pagina-publicada",
      pages: [article.urlPath],
      detail: "Página publicada e indexável ausente do sitemap.",
    });
  }
}
for (const guide of guides) {
  const inSitemap = sitemapUrls.has(guide.canonical);
  if (inSitemap && !isLocalGuideIndexable(guide)) {
    findings.push({
      severity: "critical",
      rule: "sitemap-inclui-local-nao-aprovado",
      pages: [guide.urlPath],
      detail: "Guia local não aprovado presente no sitemap.",
    });
  }
}

/* 4. Links internos devem usar o formato canônico (trailing slash, sem domínio) */
const knownPaths = new Set<string>([
  ...STATIC_INDEXABLE_PATHS,
  "/busca/",
  ...articles.map((a) => a.urlPath),
  ...guides.map((g) => g.urlPath),
]);

function extractInternalLinks(text: string): string[] {
  const links: string[] = [];
  const mdLinks = text.matchAll(/\]\((\/[^)\s#?]*)[^)]*\)/g);
  for (const match of mdLinks) links.push(match[1]!);
  const hrefs = text.matchAll(/href=["'](\/[^"'#?]*)["']/g);
  for (const match of hrefs) links.push(match[1]!);
  return links;
}

const contentFiles: Array<{ page: string; text: string }> = [
  ...articles.map((a) => ({ page: a.urlPath, text: a.content })),
  ...guides.map((g) => ({ page: g.urlPath, text: g.content })),
];

for (const { page, text } of contentFiles) {
  for (const link of extractInternalLinks(text)) {
    if (!link.endsWith("/")) {
      findings.push({
        severity: "critical",
        rule: "link-interno-sem-trailing-slash",
        pages: [page],
        detail: `Link interno "${link}" não usa o padrão canônico com barra final.`,
      });
    }
  }
}

/* 5. Padrão de trailing slash nas rotas estáticas declaradas */
for (const staticPath of STATIC_INDEXABLE_PATHS) {
  if (staticPath !== "/" && !staticPath.endsWith("/")) {
    findings.push({
      severity: "critical",
      rule: "rota-estatica-sem-trailing-slash",
      pages: [staticPath],
      detail: "Rota declarada fora do padrão de trailing slash.",
    });
  }
}

/* 6. Canonical customizada apontando para página inexistente */
for (const article of articles) {
  if (article.frontmatter.canonical) {
    const target = article.frontmatter.canonical.replace(SITE_URL, "");
    if (!knownPaths.has(target)) {
      findings.push({
        severity: "critical",
        rule: "canonical-para-url-desconhecida",
        pages: [article.urlPath],
        detail: `Canonical customizada aponta para URL desconhecida: ${target}`,
      });
    }
  }
}

/* 7. Sanidade: previews nunca devem gerar sitemap de produção */
const nextConfig = fs.readFileSync(
  path.join(process.cwd(), "next.config.ts"),
  "utf8",
);
if (!nextConfig.includes("X-Robots-Tag")) {
  findings.push({
    severity: "critical",
    rule: "preview-sem-noindex",
    pages: ["next.config.ts"],
    detail: "Header X-Robots-Tag de preview não encontrado na configuração.",
  });
}

const report = buildReport("canonical", findings);
writeJsonReport("canonical-report.json", report);
writeHtmlReport("canonical-report.html", report);
finishAudit(report);
