import fs from "node:fs";
import path from "node:path";

export interface Finding {
  severity: "critical" | "warning" | "info";
  rule: string;
  pages: string[];
  detail: string;
  score?: number;
  excerpt?: string;
}

export interface AuditReport {
  audit: string;
  generatedAt: string;
  totals: { critical: number; warning: number; info: number };
  ignoredElements?: string[];
  findings: Finding[];
}

const REPORTS_DIR = path.join(process.cwd(), "reports");

export function buildReport(
  audit: string,
  findings: Finding[],
  ignoredElements?: string[],
): AuditReport {
  return {
    audit,
    generatedAt: new Date().toISOString(),
    totals: {
      critical: findings.filter((f) => f.severity === "critical").length,
      warning: findings.filter((f) => f.severity === "warning").length,
      info: findings.filter((f) => f.severity === "info").length,
    },
    ...(ignoredElements ? { ignoredElements } : {}),
    findings,
  };
}

export function writeJsonReport(fileName: string, report: AuditReport): void {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(REPORTS_DIR, fileName),
    `${JSON.stringify(report, null, 2)}\n`,
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function writeHtmlReport(fileName: string, report: AuditReport): void {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const rows = report.findings
    .map(
      (f) => `<tr class="${f.severity}">
  <td>${f.severity}</td>
  <td>${escapeHtml(f.rule)}</td>
  <td>${f.pages.map(escapeHtml).join("<br>")}</td>
  <td>${escapeHtml(f.detail)}${f.score !== undefined ? ` (score: ${f.score.toFixed(3)})` : ""}${
    f.excerpt ? `<br><em>${escapeHtml(f.excerpt)}</em>` : ""
  }</td>
</tr>`,
    )
    .join("\n");
  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>Relatório: ${escapeHtml(report.audit)}</title>
<style>
body{font-family:system-ui,sans-serif;margin:2rem;color:#1d2b3a}
table{border-collapse:collapse;width:100%}
td,th{border:1px solid #ddd;padding:.5rem;text-align:left;vertical-align:top;font-size:.9rem}
tr.critical td:first-child{color:#b42318;font-weight:700}
tr.warning td:first-child{color:#92400e;font-weight:700}
tr.info td:first-child{color:#52657a}
</style></head><body>
<h1>${escapeHtml(report.audit)}</h1>
<p>Gerado em ${report.generatedAt} — críticos: ${report.totals.critical}, avisos: ${report.totals.warning}, informativos: ${report.totals.info}</p>
${
  report.ignoredElements
    ? `<p>Elementos ignorados na comparação: ${report.ignoredElements.map(escapeHtml).join(", ")}</p>`
    : ""
}
<table><thead><tr><th>Severidade</th><th>Regra</th><th>Páginas</th><th>Detalhe</th></tr></thead>
<tbody>${rows || '<tr><td colspan="4">Nenhum apontamento.</td></tr>'}</tbody></table>
</body></html>\n`;
  fs.writeFileSync(path.join(REPORTS_DIR, fileName), html);
}

export function finishAudit(report: AuditReport): void {
  const { critical, warning } = report.totals;
  console.log(
    `[${report.audit}] críticos: ${critical}, avisos: ${warning}, informativos: ${report.totals.info}`,
  );
  for (const f of report.findings.filter((x) => x.severity !== "info")) {
    console.log(`  - [${f.severity}] ${f.rule}: ${f.pages.join(", ")} — ${f.detail}`);
  }
  if (critical > 0) {
    console.error(`[${report.audit}] FALHAS CRÍTICAS — corrigir antes de publicar.`);
    process.exitCode = 1;
  }
}

/* ---------- utilidades de texto para similaridade ---------- */

/**
 * Extrai o texto editorial de um MDX, ignorando frontmatter, componentes JSX,
 * código, tabelas de sintaxe e formatação — só o texto comparável.
 */
export function editorialText(mdxBody: string): string {
  return mdxBody
    .replace(/^---[\s\S]*?---/, "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\{[^}]*\}/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#*_>|`-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function shingles(text: string, size = 5): Set<string> {
  const words = normalizeForComparison(text).split(" ").filter(Boolean);
  const result = new Set<string>();
  for (let i = 0; i + size <= words.length; i++) {
    result.add(words.slice(i, i + size).join(" "));
  }
  return result;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  return intersection / (a.size + b.size - intersection);
}

export function cosineTfIdf(
  aText: string,
  bText: string,
  corpus: string[],
): number {
  const docs = corpus.map((d) =>
    normalizeForComparison(d).split(" ").filter(Boolean),
  );
  const df = new Map<string, number>();
  for (const doc of docs) {
    for (const term of new Set(doc)) {
      df.set(term, (df.get(term) ?? 0) + 1);
    }
  }
  const n = docs.length;
  const vector = (text: string) => {
    const terms = normalizeForComparison(text).split(" ").filter(Boolean);
    const tf = new Map<string, number>();
    for (const t of terms) tf.set(t, (tf.get(t) ?? 0) + 1);
    const vec = new Map<string, number>();
    for (const [term, count] of tf) {
      const idf = Math.log((n + 1) / ((df.get(term) ?? 0) + 1)) + 1;
      vec.set(term, (count / terms.length) * idf);
    }
    return vec;
  };
  const va = vector(aText);
  const vb = vector(bText);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const [term, weight] of va) {
    dot += weight * (vb.get(term) ?? 0);
    normA += weight * weight;
  }
  for (const [, weight] of vb) normB += weight * weight;
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Parágrafos editoriais de um corpo MDX (texto puro, sem componentes). */
export function paragraphsOf(mdxBody: string): string[] {
  return mdxBody
    .replace(/^---[\s\S]*?---/, "")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(
      (block) =>
        block.length > 80 &&
        !block.startsWith("#") &&
        !block.startsWith("<") &&
        !block.startsWith("|") &&
        !block.startsWith("```") &&
        !block.startsWith("-") &&
        !block.startsWith("1."),
    )
    .map((block) => normalizeForComparison(block.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")));
}

export function headingSequence(mdxBody: string): string[] {
  const headings: string[] = [];
  for (const line of mdxBody.split("\n")) {
    const match = /^(#{2,3})\s+(.+)$/.exec(line.trim());
    if (match) headings.push(normalizeForComparison(match[2]!));
  }
  return headings;
}
