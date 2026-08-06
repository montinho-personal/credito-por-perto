import type { Metadata } from "next";
import { ArticleView, articleMetadata } from "@/components/article/ArticleView";
import { getAllArticles } from "@/lib/content/articles";

interface Props {
  params: Promise<{ slug: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllArticles()
    .filter((a) => a.frontmatter.category === "juros-e-cet")
    .map((a) => ({ slug: a.frontmatter.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return articleMetadata("juros-e-cet", slug);
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  return <ArticleView category="juros-e-cet" slug={slug} />;
}
