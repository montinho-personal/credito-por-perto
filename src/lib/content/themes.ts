import type { ArticleFrontmatter } from "@/lib/validation/frontmatter";

/**
 * Temas (clusters de leitura) do blog: agrupamentos curados que cruzam
 * categorias, para o leitor filtrar por assunto. Um artigo pode pertencer
 * a mais de um tema; quem não casa com nenhum aparece só em "Todos".
 */
export const ARTICLE_THEMES = [
  { key: "modalidades", label: "Modalidades" },
  { key: "consignado", label: "Consignado" },
  { key: "fgts", label: "FGTS" },
  { key: "juros-cet", label: "Juros e CET" },
  { key: "seguranca", label: "Golpes e segurança" },
  { key: "dividas", label: "Dívidas e negativado" },
  { key: "perfis", label: "Por perfil" },
  { key: "decisao", label: "Como decidir" },
] as const;

export type ThemeKey = (typeof ARTICLE_THEMES)[number]["key"];

const byTags = (tags: string[], wanted: string[]) =>
  tags.some((tag) => wanted.includes(tag));

export function getArticleThemes(fm: ArticleFrontmatter): ThemeKey[] {
  const themes = new Set<ThemeKey>();
  const tags = fm.tags ?? [];
  const cluster = fm.cluster ?? "";

  if (
    cluster === "consignado" ||
    byTags(tags, [
      "consignado",
      "margem-consignavel",
      "margem",
      "rmc",
      "rcc",
      "cartao-consignado",
      "inss",
      "servidor-publico",
      "sougov",
      "siape",
      "averbacao",
    ])
  ) {
    themes.add("consignado");
  }

  if (
    cluster === "fgts" ||
    byTags(tags, ["fgts", "saque-aniversario", "saque-rescisao", "antecipacao"])
  ) {
    themes.add("fgts");
  }

  if (
    fm.category === "juros-e-cet" ||
    cluster === "custos" ||
    cluster === "juros" ||
    byTags(tags, ["cet", "juros", "taxa-de-juros", "taxa-media", "iof"])
  ) {
    themes.add("juros-cet");
  }

  if (
    fm.category === "credito-seguro" ||
    cluster === "seguranca" ||
    byTags(tags, ["golpe", "golpes", "fraude", "desconto-indevido", "seguranca"])
  ) {
    themes.add("seguranca");
  }

  if (
    cluster === "dividas" ||
    byTags(tags, [
      "negativado",
      "divida",
      "renegociacao",
      "rotativo",
      "superendividamento",
      "atraso",
      "score",
    ])
  ) {
    themes.add("dividas");
  }

  if (
    cluster === "perfis" ||
    byTags(tags, [
      "mei",
      "autonomo",
      "aposentado",
      "pensionista",
      "servidor-publico",
      "clt",
      "trabalhador",
    ])
  ) {
    themes.add("perfis");
  }

  if (
    cluster === "decisao" ||
    byTags(tags, ["decisao", "comparacao", "planejamento", "analise-de-credito", "jornada"])
  ) {
    themes.add("decisao");
  }

  if (cluster === "modalidades" || byTags(tags, ["garantia", "emprestimo-pessoal"])) {
    themes.add("modalidades");
  }

  return [...themes];
}
