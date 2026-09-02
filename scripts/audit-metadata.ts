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

/* Mídia: alt obrigatório em toda imagem; título obrigatório em todo vídeo
   (regra do proprietário, 21/08/2026). */
const mediaDocs = [
  ...getAllArticles().map((a) => ({ page: a.urlPath, body: a.content })),
  ...getAllLocalGuides().map((g) => ({ page: g.urlPath, body: g.content })),
];
for (const doc of mediaDocs) {
  for (const tag of doc.body.match(/<ArticleImage[\s\S]*?\/>/g) ?? []) {
    if (!/alt="[^"]{10,}"/.test(tag)) {
      findings.push({
        severity: "critical",
        rule: "imagem-sem-alt",
        pages: [doc.page],
        detail:
          "ArticleImage sem alt descritivo (mínimo 10 caracteres). Alt é obrigatório em toda imagem.",
      });
    }
  }
  for (const tag of doc.body.match(/<VideoEmbed[\s\S]*?\/>/g) ?? []) {
    if (!/title="[^"]{10,}"/.test(tag)) {
      findings.push({
        severity: "critical",
        rule: "video-sem-titulo",
        pages: [doc.page],
        detail: "VideoEmbed sem title descritivo (mínimo 10 caracteres).",
      });
    }
  }
  if (/!\[\]\(/.test(doc.body) || /<img[\s>]/.test(doc.body)) {
    findings.push({
      severity: "critical",
      rule: "imagem-fora-do-padrao",
      pages: [doc.page],
      detail:
        "Imagem markdown sem alt ou <img> cru no corpo. Use o componente ArticleImage, com alt.",
    });
  }
}

/* ------------------------------------------------------------------ */
/* Nome do arquivo da capa × slug da página                            */
/* ------------------------------------------------------------------ */

/**
 * O Google diz que o nome do arquivo "dá pistas sobre o assunto da imagem" e
 * pede nome curto e descritivo. É sinal FRACO — pista, não fator de peso —,
 * e é exatamente por isso que a regra mora aqui como AVISO e não como crítico:
 * quebrar o build por um sinal fraco seria desproporcional.
 *
 * O que justifica a regra mesmo assim é o histórico: 26 das 39 capas
 * publicadas tinham nome abreviado à mão na hora de salvar
 * (`quando-vale-a-pena-capa.webp` para `/quando-vale-a-pena-fazer-emprestimo/`),
 * e ninguém percebeu por um mês porque nada olhava. Deriva silenciosa de novo.
 *
 * Renomear depois custa mais que nascer certo — a imagem publicada acumula
 * histórico, e trocar a URL joga esse histórico fora. O aviso aparece na capa
 * seguinte, que é quando corrigir ainda é de graça.
 */
for (const doc of [...getAllArticles(), ...getAllLocalGuides()]) {
  const featured = doc.frontmatter.featuredImage;
  if (!featured) continue;
  const file = featured.split("/").pop() ?? "";
  const base = file.replace(/-capa\.webp$/, "").replace(/\.webp$/, "");
  const slug = doc.urlPath.replace(/\/$/, "").split("/").pop() ?? "";
  /* Guia local escapa da comparação direta: o slug da URL é só a cidade
     (`/emprestimos/sp/campinas/`), e o arquivo carrega cidade + intenção
     (`emprestimo-em-campinas-sp.webp`) — mais descritivo que o slug, que é o
     que a recomendação pede. Basta conter a cidade. */
  const ok = base === slug || base.includes(slug);
  if (!ok) {
    findings.push({
      severity: "warning",
      rule: "capa-com-nome-fora-do-slug",
      pages: [doc.urlPath],
      detail: `A capa "${file}" não corresponde ao slug "${slug}". Nome de arquivo é pista de assunto para o buscador; renomear depois de publicada custa o histórico da imagem. O padrão é <slug>-capa.webp.`,
    });
  }
}

const report = buildReport("metadados", findings);
writeJsonReport("metadata-report.json", report);
finishAudit(report);
