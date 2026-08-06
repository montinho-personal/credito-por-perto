import { describe, expect, it } from "vitest";
import {
  articleFrontmatterSchema,
  localGuideFrontmatterSchema,
} from "@/lib/validation/frontmatter";
import { slugify, extractHeadings } from "@/lib/text/slug";

const validArticle = {
  title: "Título de exemplo com tamanho suficiente",
  slug: "titulo-de-exemplo",
  description:
    "Descrição de exemplo com comprimento adequado para os limites de SEO definidos.",
  excerpt: "Resumo do artigo para listagens e cartões.",
  category: "emprestimos",
  cluster: "modalidades",
  tags: ["exemplo"],
  authorId: "equipe-editorial",
  status: "draft",
  publishedAt: "2026-08-01",
  contentType: "guide",
};

describe("articleFrontmatterSchema", () => {
  it("aceita frontmatter válido", () => {
    expect(articleFrontmatterSchema.safeParse(validArticle).success).toBe(true);
  });

  it("rejeita slug com acentos ou maiúsculas", () => {
    expect(
      articleFrontmatterSchema.safeParse({ ...validArticle, slug: "Título" })
        .success,
    ).toBe(false);
  });

  it("rejeita updatedAt anterior a publishedAt", () => {
    expect(
      articleFrontmatterSchema.safeParse({
        ...validArticle,
        updatedAt: "2026-07-01",
      }).success,
    ).toBe(false);
  });

  it("rejeita campos desconhecidos (strict)", () => {
    expect(
      articleFrontmatterSchema.safeParse({ ...validArticle, extra: true })
        .success,
    ).toBe(false);
  });

  it("exige imageAlt quando há featuredImage", () => {
    expect(
      articleFrontmatterSchema.safeParse({
        ...validArticle,
        featuredImage: "/images/x.png",
      }).success,
    ).toBe(false);
  });
});

describe("localGuideFrontmatterSchema", () => {
  const validGuide = {
    title: "Empréstimos em Cidade Exemplo (SP): guia local",
    localityName: "Cidade Exemplo",
    localityType: "municipality",
    stateCode: "sp",
    citySlug: "cidade-exemplo",
    description:
      "Guia local de exemplo com descrição dentro dos limites definidos para SEO.",
    excerpt: "Resumo do guia local de exemplo.",
    authorId: "equipe-editorial",
    status: "draft",
    noindex: true,
    publishedAt: "2026-08-01",
  };

  it("aceita rascunho sem dossiê", () => {
    expect(localGuideFrontmatterSchema.safeParse(validGuide).success).toBe(true);
  });

  it("bloqueia publicação sem dossiê e sem data de verificação", () => {
    expect(
      localGuideFrontmatterSchema.safeParse({
        ...validGuide,
        status: "published",
      }).success,
    ).toBe(false);
    expect(
      localGuideFrontmatterSchema.safeParse({
        ...validGuide,
        status: "published",
        dossierId: "x",
        lastVerifiedAt: "2026-08-01",
      }).success,
    ).toBe(true);
  });
});

describe("slugify e headings", () => {
  it("gera slugs sem acentos em português claro", () => {
    expect(slugify("Empréstimos em São Paulo: guia atualizado")).toBe(
      "emprestimos-em-sao-paulo-guia-atualizado",
    );
  });

  it("extrai H2/H3 ignorando blocos de código", () => {
    const md = "## Primeiro\n\n```\n## dentro de código\n```\n\n### Segundo\n";
    const headings = extractHeadings(md);
    expect(headings).toHaveLength(2);
    expect(headings[0]).toMatchObject({ depth: 2, id: "primeiro" });
    expect(headings[1]).toMatchObject({ depth: 3, id: "segundo" });
  });
});
