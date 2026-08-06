/**
 * Auditoria de metadados: títulos e descrições únicos em todo o site
 * (conteúdo MDX + páginas estáticas com buildMetadata), limites de tamanho
 * e datas coerentes (sem datas futuras; updatedAt >= publishedAt).
 */
import fs from "node:fs";
import path from "node:path";
import { getAllArticles } from "../src/lib/content/articles";
import { getAllLocalGuides } from "../src/lib/content/local";
import {
  buildReport,
  finishAudit,
  normalizeForComparison,
  writeJsonReport,
  type Finding,
} from "./lib/audit-helpers";

const findings: Finding[] = [];

interface PageMeta {
  page: string;
  title: string;
  description: string;
}

const metas: PageMeta[] = [
  ...getAllArticles().map((a) => ({
    page: a.urlPath,
    title: a.frontmatter.title,
    description: a.frontmatter.description,
  })),
  ...getAllLocalGuides().map((g) => ({
    page: g.urlPath,
    title: g.frontmatter.title,
    description: g.frontmatter.description,
  })),
];

/* Extrai title/description de chamadas buildMetadata nas páginas estáticas */
function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name === "page.tsx" ? [full] : [];
  });
}
for (const file of walk(path.join(process.cwd(), "src", "app"))) {
  const text = fs.readFileSync(file, "utf8");
  const match =
    /buildMetadata\(\{\s*title:\s*(?:"([^"]+)"|`([^`]+)`)[\s\S]*?description:\s*"([^"]+)"[\s\S]*?path:\s*"([^"]+)"/m.exec(
      text,
    );
  if (match) {
    metas.push({
      page: match[4]!,
      title: (match[1] ?? match[2])!,
      description: match[3]!,
    });
  }
}

/* Unicidade */
const titleMap = new Map<string, string>();
const descMap = new Map<string, string>();
for (const meta of metas) {
  const titleKey = normalizeForComparison(meta.title);
  const descKey = normalizeForComparison(meta.description);
  const titleOwner = titleMap.get(titleKey);
  if (titleOwner && titleOwner !== meta.page) {
    findings.push({
      severity: "critical",
      rule: "titulo-duplicado",
      pages: [titleOwner, meta.page],
      detail: `Título repetido: "${meta.title}"`,
    });
  }
  titleMap.set(titleKey, meta.page);
  const descOwner = descMap.get(descKey);
  if (descOwner && descOwner !== meta.page) {
    findings.push({
      severity: "critical",
      rule: "descricao-duplicada",
      pages: [descOwner, meta.page],
      detail: "Meta description repetida.",
    });
  }
  descMap.set(descKey, meta.page);

  if (meta.title.length > 110) {
    findings.push({
      severity: "warning",
      rule: "titulo-longo",
      pages: [meta.page],
      detail: `Título com ${meta.title.length} caracteres.`,
    });
  }
  if (meta.description.length > 180) {
    findings.push({
      severity: "warning",
      rule: "descricao-longa",
      pages: [meta.page],
      detail: `Descrição com ${meta.description.length} caracteres.`,
    });
  }
}

/* Datas coerentes */
const today = new Date().toISOString().slice(0, 10);
for (const article of getAllArticles()) {
  const fm = article.frontmatter;
  for (const [field, value] of Object.entries({
    publishedAt: fm.publishedAt,
    updatedAt: fm.updatedAt,
    reviewedAt: fm.reviewedAt,
    sourceCheckedAt: fm.sourceCheckedAt,
  })) {
    if (value && value > today) {
      findings.push({
        severity: "critical",
        rule: "data-futura",
        pages: [article.urlPath],
        detail: `${field} está no futuro: ${value}`,
      });
    }
  }
  if (fm.updatedAt && fm.updatedAt < fm.publishedAt) {
    findings.push({
      severity: "critical",
      rule: "updated-antes-de-published",
      pages: [article.urlPath],
      detail: "updatedAt anterior a publishedAt.",
    });
  }
}

const report = buildReport("metadados", findings);
writeJsonReport("metadata-report.json", report);
finishAudit(report);
