/**
 * Monta os documentos da busca a partir do conteúdo publicado. Roda no
 * build (script) e nos testes — nunca no navegador (usa fs via loaders).
 *
 * Regras: só conteúdo canônico e publicado; páginas institucionais ficam
 * fora (não competem com conteúdo editorial); dedupe por URL.
 */
import { getPublishedArticles } from "@/lib/content/articles";
import { getPublishedLocalGuides } from "@/lib/content/local";
import { buildCityFinancialMap } from "@/lib/local/city-map";
import { CATEGORIES } from "@/lib/content/categories";
import { getTools } from "@/lib/tools/registry";
import type { SearchDoc } from "./types";

const CONTENT_MAX_CHARS = 2400;

/**
 * Nomes e formas de acesso dos recursos do Mapa Financeiro daquela cidade,
 * em texto corrido, para que a busca enxergue "Procon", "Ganha Tempo",
 * "Poupatempo" e afins dentro da página local.
 */
function financialMapText(dossierId: string | undefined): string {
  if (!dossierId) return "";
  const map = buildCityFinancialMap(dossierId, new Date().toISOString().slice(0, 10));
  if (!map) return "";
  return map.resources
    .map((r) => `${r.name} ${r.operator} ${r.howToAccess}`)
    .join(" ");
}

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
      /*
       * O Mapa Financeiro é montado fora do MDX, então nem os nomes dos
       * órgãos nem o título da seção entravam no índice: quem buscasse
       * "procon cotia" não achava a página que tem exatamente isso. Aqui as
       * duas camadas são costuradas de volta.
       */
      headings: [
        ...extractHeadings(guide.content),
        `Onde pedir ajuda em ${fm.localityName}`,
      ],
      content: [
        toPlainText(guide.content),
        financialMapText(fm.dossierId),
      ]
        .filter(Boolean)
        .join(" "),
      city: fm.localityName,
      state: stateName,
      stateCode: fm.stateCode,
      updatedAt: fm.updatedAt ?? fm.publishedAt,
    });
  }

  docs.push(
    {
      /* A Central entra na busca com as palavras de quem NÃO sabe o nome da
         ferramenta — que é exatamente o público dela. */
      id: "/decisoes-financeiras/",
      url: "/decisoes-financeiras/",
      title: "Qual é o seu momento financeiro?",
      description:
        "Escolha o que está acontecendo — pegar crédito, recebi proposta, várias dívidas, acho que é golpe — e veja quais contas ajudam nessa decisão.",
      section: "Ferramentas",
      type: "calculadora",
      tags: ["decisao", "jornada", "por-onde-comecar", "ferramentas"],
      keywords: [
        "nao sei por onde comecar",
        "qual calculadora usar",
        "preciso de ajuda com dinheiro",
        "estou com dividas o que fazer",
        "recebi proposta de emprestimo o que fazer",
        "central de decisoes financeiras",
      ],
      headings: [],
      content: "",
    },
    /* As ferramentas vêm do registro (data/tool-registry.json): nome,
       descrição, etiquetas, palavras-chave e sinônimos leigos. Ferramenta
       nova entra na busca sem ninguém editar este arquivo. */
    ...getTools().map(
      (tool): SearchDoc => ({
        id: tool.route,
        url: tool.route,
        title: tool.name,
        description: tool.whenItHelps,
        section: tool.route.startsWith("/calculadoras/") ? "Calculadoras" : "Ferramentas",
        type: "calculadora",
        tags: tool.tags,
        keywords: tool.keywords,
        headings: [],
        /* Sinônimos leigos entram com peso de corpo: encontram a ferramenta
           sem passar na frente do artigo que explica o assunto. */
        content: tool.aliases.join(". "),
      }),
    ),
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
