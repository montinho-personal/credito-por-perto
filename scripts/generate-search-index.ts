/**
 * Gera public/search-index.json com o conteúdo publicado, para a busca
 * client-side de /busca/ (nada é enviado ao servidor).
 */
import fs from "node:fs";
import path from "node:path";
import { getPublishedArticles } from "../src/lib/content/articles";
import { getPublishedLocalGuides } from "../src/lib/content/local";
import { CATEGORIES } from "../src/lib/content/categories";

interface SearchEntry {
  title: string;
  description: string;
  url: string;
  section: string;
}

const entries: SearchEntry[] = [
  ...getPublishedArticles().map((article) => ({
    title: article.frontmatter.title,
    description: article.frontmatter.description,
    url: article.urlPath,
    section: CATEGORIES[article.frontmatter.category].label,
  })),
  ...getPublishedLocalGuides().map((guide) => ({
    title: guide.frontmatter.title,
    description: guide.frontmatter.description,
    url: guide.urlPath,
    section: "Guias locais",
  })),
  {
    title: "Calculadora de empréstimo",
    description:
      "Estime parcela, total pago e juros pelo sistema Price, com tabela de amortização.",
    url: "/calculadoras/emprestimo/",
    section: "Calculadoras",
  },
  {
    title: "Glossário de crédito",
    description:
      "CET, IOF, amortização, margem consignável e outros termos explicados em linguagem simples.",
    url: "/glossario/",
    section: "Glossário",
  },
];

const outPath = path.join(process.cwd(), "public", "search-index.json");
fs.writeFileSync(outPath, JSON.stringify(entries, null, 2));
console.log(`Índice de busca gerado com ${entries.length} entradas em ${outPath}`);
