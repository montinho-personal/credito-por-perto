/**
 * AUDITORIA DO SITEMAP
 * ============================================================================
 *
 * O sitemap é o argumento que o site apresenta ao buscador para pedir
 * rastreamento. Num site novo, onde o orçamento de rastreamento é curto, a
 * qualidade desse argumento decide a ordem da fila — e ele se degrada em
 * silêncio: uma entrada perde o `lastmod`, uma data declarada envelhece
 * enquanto a página muda, uma URL noindex entra por engano.
 *
 * A checagem central é a das DATAS DECLARADAS. `STATIC_PAGE_DATES` e o
 * `updatedAt` do registry de ferramentas são escritos à mão porque a
 * alternativa — data do build — faria o sitemap jurar que tudo mudou a cada
 * deploy. O preço de declarar é envelhecer sem avisar; esta auditoria cobra
 * esse preço, comparando cada data com o `git log` do arquivo da página.
 *
 * O git só existe no desenvolvimento (o build da Vercel usa clone raso), e
 * é exatamente onde a auditoria roda.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { getSitemapEntries, STATIC_INDEXABLE_PATHS } from "../src/lib/seo/sitemap-entries";
import {
  STATIC_PAGE_DATES,
  pageFileForRoute,
  isInternalOnlyChange,
} from "../src/lib/seo/static-page-dates";
import { getTools } from "../src/lib/tools/registry";
import { SITE_URL } from "../src/lib/site";
import {
  buildReport,
  finishAudit,
  writeJsonReport,
  type Finding,
} from "./lib/audit-helpers";

const findings: Finding[] = [];
const entries = getSitemapEntries();

/* ========================================================================== *
 * 1. Toda entrada precisa de lastmod
 * ========================================================================== */

const semData = entries.filter((e) => !e.lastModified);
for (const entry of semData) {
  findings.push({
    severity: "warning",
    rule: "entrada-sem-lastmod",
    pages: [entry.url.replace(SITE_URL, "")],
    detail:
      "Entrada do sitemap sem lastmod. Sem data, a URL entra na fila de rastreamento sem argumento — e num site novo é a fila que decide.",
  });
}

/* ========================================================================== *
 * 2. Datas plausíveis
 * ========================================================================== */

const hoje = new Date().toISOString().slice(0, 10);
for (const entry of entries) {
  const data = entry.lastModified;
  if (!data) continue;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    findings.push({
      severity: "critical",
      rule: "lastmod-em-formato-invalido",
      pages: [entry.url.replace(SITE_URL, "")],
      detail: `lastmod "${data}" não está em AAAA-MM-DD.`,
    });
  } else if (data > hoje) {
    findings.push({
      severity: "critical",
      rule: "lastmod-no-futuro",
      pages: [entry.url.replace(SITE_URL, "")],
      detail: `lastmod ${data} é posterior a hoje (${hoje}).`,
    });
  }
}

/* ========================================================================== *
 * 3. A data declarada acompanha o arquivo?
 * ========================================================================== */

function lastCommitDate(file: string): string | null {
  const full = path.join(process.cwd(), file);
  if (!fs.existsSync(full)) return null;
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%cs", "--", file], {
      encoding: "utf8",
    }).trim();
    return out.length === 10 ? out : null;
  } catch {
    /* Sem histórico (clone raso, árvore sem git): a checagem simplesmente não
       roda. Ela é uma rede de segurança do desenvolvimento, não um requisito
       de build. */
    return null;
  }
}

const declaradas: Array<[string, string, string]> = [
  ...Object.entries(STATIC_PAGE_DATES).map(
    ([route, date]) => [route, date, pageFileForRoute(route)] as [string, string, string],
  ),
  ...getTools().map(
    (t) => [t.route, t.updatedAt, pageFileForRoute(t.route)] as [string, string, string],
  ),
];

let conferidas = 0;
for (const [route, declarada, file] of declaradas) {
  const commit = lastCommitDate(file);
  if (!commit) continue;
  conferidas += 1;
  /* Mudança registrada como interna não move a data: o arquivo mudou, o que o
     leitor vê não. A exceção vale só para a data exata do commit interno — se
     algo novo entrar depois, o aviso volta sozinho. */
  if (commit > declarada && !isInternalOnlyChange(route, commit)) {
    findings.push({
      severity: "warning",
      rule: "lastmod-defasado",
      pages: [route],
      detail: `Declarado ${declarada}, mas ${file} mudou em ${commit}. Se a mudança altera o que o leitor vê, atualize a data; se foi refatoração interna, ela está certa como está.`,
    });
  }
}

/* ========================================================================== *
 * 4. Nada de noindex nem de duplicata no sitemap
 * ========================================================================== */

const vistos = new Set<string>();
for (const entry of entries) {
  if (vistos.has(entry.url)) {
    findings.push({
      severity: "critical",
      rule: "url-duplicada-no-sitemap",
      pages: [entry.url.replace(SITE_URL, "")],
      detail: "A mesma URL aparece duas vezes no sitemap.",
    });
  }
  vistos.add(entry.url);

  if (!entry.url.startsWith(SITE_URL)) {
    findings.push({
      severity: "critical",
      rule: "url-fora-do-dominio-canonico",
      pages: [entry.url],
      detail: `URL do sitemap fora de ${SITE_URL}.`,
    });
  }
  if (!entry.url.endsWith("/")) {
    findings.push({
      severity: "warning",
      rule: "url-sem-barra-final",
      pages: [entry.url.replace(SITE_URL, "")],
      detail: "URL do sitemap sem barra final — divergente da forma canônica do portal.",
    });
  }
}

/* A busca é noindex por decisão e não pode voltar ao sitemap por descuido. */
if (STATIC_INDEXABLE_PATHS.some((p) => p === "/busca/")) {
  findings.push({
    severity: "critical",
    rule: "pagina-noindex-no-sitemap",
    pages: ["/busca/"],
    detail: "A busca é noindex e está listada como indexável.",
  });
}

findings.push({
  severity: "info",
  rule: "resumo",
  pages: ["/sitemap.xml"],
  detail: `${entries.length} URLs, ${entries.length - semData.length} com lastmod, ${conferidas} datas declaradas conferidas contra o histórico do git.`,
});

const report = buildReport("sitemap", findings);
writeJsonReport("sitemap-report.json", report);
finishAudit(report);
