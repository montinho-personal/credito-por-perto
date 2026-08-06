import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import {
  articleFrontmatterSchema,
  type ArticleFrontmatter,
} from "@/lib/validation/frontmatter";
import { ARTICLES_DIR } from "@/lib/content/paths";
import { CATEGORIES } from "@/lib/content/categories";
import { canonicalUrl } from "@/lib/seo/canonical";

export interface Article {
  frontmatter: ArticleFrontmatter;
  content: string;
  /** Caminho relativo da página, ex.: /emprestimos/emprestimo-pessoal/ */
  urlPath: string;
  canonical: string;
  fileName: string;
}

let cache: Article[] | null = null;

export function articleUrlPath(fm: ArticleFrontmatter): string {
  return `${CATEGORIES[fm.category].basePath}${fm.slug}/`;
}

/** Carrega e valida todos os artigos MDX, qualquer estado editorial. */
export function getAllArticles(): Article[] {
  if (cache) return cache;
  if (!fs.existsSync(ARTICLES_DIR)) return [];
  const files = fs
    .readdirSync(ARTICLES_DIR)
    .filter((f) => f.endsWith(".mdx"))
    .sort();
  cache = files.map((fileName) => {
    const raw = fs.readFileSync(path.join(ARTICLES_DIR, fileName), "utf8");
    const { data, content } = matter(raw);
    const parsed = articleFrontmatterSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error(
        `Frontmatter inválido em ${fileName}: ${parsed.error.message}`,
      );
    }
    const fm = parsed.data;
    const urlPath = articleUrlPath(fm);
    return {
      frontmatter: fm,
      content,
      urlPath,
      canonical: fm.canonical ?? canonicalUrl(urlPath),
      fileName,
    };
  });
  return cache;
}

/** Somente artigos publicados — os únicos listáveis, indexáveis e presentes no sitemap. */
export function getPublishedArticles(): Article[] {
  return getAllArticles().filter((a) => a.frontmatter.status === "published");
}

export function getArticle(
  category: string,
  slug: string,
): Article | undefined {
  return getAllArticles().find(
    (a) => a.frontmatter.category === category && a.frontmatter.slug === slug,
  );
}

export function getPublishedByCategory(category: string): Article[] {
  return getPublishedArticles()
    .filter((a) => a.frontmatter.category === category)
    .sort((a, b) =>
      (b.frontmatter.updatedAt ?? b.frontmatter.publishedAt).localeCompare(
        a.frontmatter.updatedAt ?? a.frontmatter.publishedAt,
      ),
    );
}

export function getRecentArticles(limit: number): Article[] {
  return [...getPublishedArticles()]
    .sort((a, b) =>
      (b.frontmatter.updatedAt ?? b.frontmatter.publishedAt).localeCompare(
        a.frontmatter.updatedAt ?? a.frontmatter.publishedAt,
      ),
    )
    .slice(0, limit);
}

export function getFeaturedArticles(limit: number): Article[] {
  return getPublishedArticles()
    .filter((a) => a.frontmatter.featured)
    .slice(0, limit);
}

export function getRelatedArticles(article: Article, limit = 4): Article[] {
  const tags = new Set(article.frontmatter.tags);
  return getPublishedArticles()
    .filter((a) => a.urlPath !== article.urlPath)
    .map((a) => ({
      article: a,
      score:
        (a.frontmatter.category === article.frontmatter.category ? 2 : 0) +
        (a.frontmatter.cluster === article.frontmatter.cluster ? 2 : 0) +
        a.frontmatter.tags.filter((t) => tags.has(t)).length,
    }))
    .sort((x, y) => y.score - x.score)
    .slice(0, limit)
    .map((x) => x.article);
}
