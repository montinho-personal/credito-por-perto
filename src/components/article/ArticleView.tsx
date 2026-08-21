import { notFound } from "next/navigation";
import Image from "next/image";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import type { Metadata } from "next";
import { getArticle, getRelatedArticles } from "@/lib/content/articles";
import { getAuthor } from "@/lib/content/authors";
import { getSourceLedger } from "@/lib/content/ledgers";
import { CATEGORIES, type CategoryId } from "@/lib/content/categories";
import { buildMetadata } from "@/lib/metadata/build";
import { SITE_URL } from "@/lib/site";
import { articleJsonLd } from "@/lib/schema/jsonld";
import { JsonLd } from "@/components/seo/JsonLd";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { mdxComponents } from "@/components/content/mdx-components";
import {
  ArticleHeader,
  AuthorBox,
  EditorialDisclosure,
  RelatedArticles,
  TableOfContents,
} from "@/components/article/ArticleShell";
import { SourceList } from "@/components/content/sources";
import { AdSlot } from "@/components/ads/AdSlot";

/**
 * Um artigo é acessível quando publicado. Rascunhos e demais estados
 * editoriais só são acessíveis fora de produção, sempre com noindex
 * (o header X-Robots-Tag de preview cobre qualquer ambiente não-produção).
 */
function isArticleVisible(status: string): boolean {
  if (status === "published") return true;
  return process.env.VERCEL_ENV !== "production";
}

export function articleMetadata(
  category: CategoryId,
  slug: string,
): Metadata {
  const article = getArticle(category, slug);
  if (!article || !isArticleVisible(article.frontmatter.status)) return {};
  const fm = article.frontmatter;
  return buildMetadata({
    title: fm.title,
    description: fm.description,
    path: article.urlPath,
    noindex: fm.noindex || fm.status !== "published",
    ogType: "article",
    publishedTime: fm.publishedAt,
    modifiedTime: fm.updatedAt,
    authors: [getAuthor(fm.authorId)?.name ?? ""],
    image: fm.featuredImage ? `${SITE_URL}${fm.featuredImage}` : undefined,
    imageAlt: fm.imageAlt,
  });
}

export function ArticleView({
  category,
  slug,
}: {
  category: CategoryId;
  slug: string;
}) {
  const article = getArticle(category, slug);
  if (!article || !isArticleVisible(article.frontmatter.status)) {
    notFound();
  }
  const fm = article.frontmatter;
  const author = getAuthor(fm.authorId);
  if (!author) {
    throw new Error(`Autor não encontrado: ${fm.authorId}`);
  }
  const reviewer = fm.reviewerId ? getAuthor(fm.reviewerId) : undefined;
  const ledger = getSourceLedger(fm.slug);
  const related = getRelatedArticles(article);
  const categoryDef = CATEGORIES[category];

  return (
    <article className="mx-auto max-w-3xl px-4 py-8">
      <JsonLd data={articleJsonLd(article, author)} />
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: categoryDef.label, path: categoryDef.basePath },
          { name: fm.title, path: article.urlPath },
        ]}
      />
      <div className="mt-6">
        <ArticleHeader article={article} author={author} reviewer={reviewer} />
      </div>
      {fm.featuredImage && fm.imageAlt ? (
        <Image
          src={fm.featuredImage}
          alt={fm.imageAlt}
          width={1600}
          height={900}
          priority
          sizes="(max-width: 768px) 100vw, 768px"
          className="mt-6 w-full rounded-xl border border-brand-border"
        />
      ) : null}
      {fm.status !== "published" ? (
        <p className="mt-6 rounded-lg border border-brand-warning/40 bg-brand-warning-soft p-4 text-sm font-medium text-brand-warning">
          Rascunho em elaboração — este conteúdo ainda não passou por todas as
          etapas de revisão editorial e não está publicado.
        </p>
      ) : null}
      <TableOfContents content={article.content} />
      <AdSlot placement="article-top" />
      <div className="article-body">
        <MDXRemote
          source={article.content}
          components={mdxComponents}
          options={{
            // Conteúdo MDX é de primeira parte (repositório); expressões JSX
            // são necessárias para props como items={[...]}. Chamadas
            // perigosas continuam bloqueadas (blockDangerousJS padrão).
            blockJS: false,
            mdxOptions: { remarkPlugins: [remarkGfm] },
          }}
        />
      </div>
      <AdSlot placement="article-bottom" />
      {ledger ? <SourceList ledger={ledger} /> : null}
      <EditorialDisclosure />
      <AuthorBox author={author} />
      <RelatedArticles articles={related} />
    </article>
  );
}
