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
      id: "/calculadoras/consultar-instituicao/",
      url: "/calculadoras/consultar-instituicao/",
      title: "Essa instituição aparece no Banco Central?",
      description:
        "Pesquise uma instituição financeira por nome ou CNPJ nos dados oficiais do Banco Central — grátis, sem cadastro e sem salvar o que você digita.",
      section: "Calculadoras",
      type: "calculadora",
      tags: ["banco-central", "instituicao-autorizada", "seguranca", "cnpj"],
      keywords: [
        "consultar financeira banco central",
        "essa financeira existe",
        "financeira autorizada banco central",
        "consultar cnpj financeira",
        "verificar instituicao financeira",
        "banco e verdadeiro",
      ],
      headings: [],
      content: "",
    },
    {
      id: "/calculadoras/trocar-divida/",
      url: "/calculadoras/trocar-divida/",
      title: "Vale a pena trocar esta dívida?",
      description:
        "Compare a dívida atual com uma nova condição — portabilidade, renegociação ou novo empréstimo — e veja o que muda na parcela, no prazo e no total.",
      section: "Calculadoras",
      type: "calculadora",
      tags: ["portabilidade", "renegociacao", "quitacao", "divida"],
      keywords: [
        "vale a pena trocar divida",
        "emprestimo para quitar divida",
        "emprestimo para pagar cartao",
        "portabilidade de emprestimo vale a pena",
        "refinanciar divida",
        "trocar divida cara por barata",
      ],
      headings: [],
      content: "",
    },
    {
      id: "/calculadoras/sinais-de-golpe/",
      url: "/calculadoras/sinais-de-golpe/",
      title: "Essa proposta tem sinais de golpe?",
      description:
        "Responda perguntas rápidas e veja sinais de alerta antes de enviar dinheiro ou dados — sem cadastro e sem coleta de respostas.",
      section: "Calculadoras",
      type: "calculadora",
      tags: ["golpe", "fraude", "seguranca", "pix", "whatsapp"],
      keywords: [
        "emprestimo e golpe",
        "pediram pix para liberar emprestimo",
        "taxa para liberar emprestimo",
        "golpe emprestimo whatsapp",
        "financeira falsa",
      ],
      headings: [],
      content: "",
    },
    {
      id: "/calculadoras/minha-taxa-esta-cara/",
      url: "/calculadoras/minha-taxa-esta-cara/",
      title: "Minha taxa está cara?",
      description:
        "Compare a taxa da sua proposta com a média oficial do Banco Central para a mesma modalidade — sem cadastro e sem indicar banco.",
      section: "Calculadoras",
      type: "calculadora",
      tags: ["taxa", "juros", "banco central", "media", "comparar"],
      keywords: [
        "minha taxa esta alta",
        "juros de 4 ao mes e muito",
        "taxa media banco central",
        "comparar taxa de juros",
      ],
      headings: [],
      content: "",
    },
    {
      id: "/calculadoras/comparador-de-propostas/",
      url: "/calculadoras/comparador-de-propostas/",
      title: "Comparador de propostas de crédito",
      description:
        "Compare até 3 propostas lado a lado: parcela, prazo, CET e total pago — sem cadastro e sem indicar banco.",
      section: "Calculadoras",
      type: "calculadora",
      tags: ["comparador", "propostas", "cet", "parcela", "total pago"],
      keywords: [
        "comparar emprestimos",
        "comparar propostas de credito",
        "qual emprestimo e mais barato",
        "comparar cet",
      ],
      headings: [],
      content: "",
    },
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
