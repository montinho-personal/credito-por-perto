import type { Metadata } from "next";
import { ArticleView, articleMetadata } from "@/components/article/ArticleView";
import { getAllArticles } from "@/lib/content/articles";

interface Props {
  params: Promise<{ slug: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllArticles()
    .filter((a) => a.frontmatter.category === "credito-seguro")
    .map((a) => ({ slug: a.frontmatter.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return articleMetadata("credito-seguro", slug);
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  return <ArticleView category="credito-seguro" slug={slug} />;
}
