/**
 * Monta os documentos da busca a partir do conteúdo publicado. Roda no
 * build (script) e nos testes — nunca no navegador (usa fs via loaders).
 *
 * Regras: só conteúdo canônico e publicado; páginas institucionais ficam
 * fora (não competem com conteúdo editorial); dedupe por URL.
 */
import { getPublishedArticles } from "@/lib/content/articles";
import { getPublishedLocalGuides } from "@/lib/content/local";
import { CATEGORIES } from "@/lib/content/categories";
import type { SearchDoc } from "./types";

const CONTENT_MAX_CHARS = 2400;

/** Extrai H2/H3 do MDX. */
function extractHeadings(mdx: string): string[] {
  const headings: string[] = [];
  for (const line of mdx.split("\n")) {
    const match = /^#{2,3}\s+(.+)$/.exec(line.trim());
    if (match?.[1]) headings.push(match[1].trim());
  }
  return headings;
}

/** Converte MDX em texto puro aproximado, para o campo de menor peso. */
function toPlainText(mdx: string): string {
  return mdx
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\{[^}]*\}/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_`>|#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, CONTENT_MAX_CHARS);
}

const STATE_NAMES: Record<string, string> = {
  sp: "São Paulo",
};

export function buildSearchDocs(): SearchDoc[] {
  const docs: SearchDoc[] = [];

  for (const article of getPublishedArticles()) {
    const fm = article.frontmatter;
    docs.push({
      id: article.urlPath,
      url: article.urlPath,
      title: fm.title,
      description: fm.description,
      section: CATEGORIES[fm.category].label,
      type: "artigo",
      tags: [...(fm.tags ?? [])],
      keywords: [fm.cluster ?? "", fm.category].filter(Boolean),
      headings: extractHeadings(article.content),
      content: toPlainText(article.content),
      featured: fm.featured === true,
      updatedAt: fm.updatedAt ?? fm.publishedAt,
    });
  }

  for (const guide of getPublishedLocalGuides()) {
    const fm = guide.frontmatter;
    const stateName = STATE_NAMES[fm.stateCode] ?? fm.stateCode.toUpperCase();
    docs.push({
      id: guide.urlPath,
      url: guide.urlPath,
      title: fm.title,
      description: fm.description,
      section: "Guias locais",
      type: "guia-local",
      tags: [],
      keywords: [
        fm.localityName,
        `${fm.localityName} ${fm.stateCode}`,
        `emprestimo ${fm.localityName}`,
        `credito ${fm.localityName}`,
      ],
      headings: extractHeadings(guide.content),
      content: toPlainText(guide.content),
      city: fm.localityName,
      state: stateName,
      stateCode: fm.stateCode,
      updatedAt: fm.updatedAt ?? fm.publishedAt,
    });
  }

  docs.push(
    {
      id: "/calculadoras/emprestimo/",
      url: "/calculadoras/emprestimo/",
      title: "Calculadora de empréstimo",
      description:
        "Estime parcela, total pago e juros pelo sistema Price, com tabela de amortização.",
      section: "Calculadoras",
      type: "calculadora",
      tags: ["calculadora", "simulador", "parcela", "juros"],
      keywords: ["calcular emprestimo", "simular emprestimo", "price"],
      headings: [],
      content: "",
    },
    {
      id: "/calculadoras/margem-consignavel/",
      url: "/calculadoras/margem-consignavel/",
      title: "Calculadora de margem consignável",
      description:
        "Descubra quanto do seu benefício ou salário pode ser comprometido com consignado (INSS e CLT).",
      section: "Calculadoras",
      type: "calculadora",
      tags: ["calculadora", "margem", "consignado", "inss", "clt"],
      keywords: ["calcular margem", "margem consignavel", "simular margem"],
      headings: [],
      content: "",
    },
    {
      id: "/glossario/",
      url: "/glossario/",
      title: "Glossário de crédito",
      description:
        "CET, IOF, amortização, margem consignável e outros termos explicados em linguagem simples.",
      section: "Glossário",
      type: "glossario",
      tags: ["glossario", "termos", "definicao"],
      keywords: ["o que significa", "dicionario de credito", "cet", "iof", "amortizacao"],
      headings: [],
      content: "",
    },
  );

  // Dedupe por id (canonical) — a última ocorrência não sobrescreve a primeira.
  const seen = new Set<string>();
  return docs.filter((doc) => {
    if (seen.has(doc.id)) return false;
    seen.add(doc.id);
    return true;
  });
}
