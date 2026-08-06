import type { Metadata } from "next";
import {
  LocalGuideView,
  localGuideMetadata,
} from "@/components/local/LocalGuideView";
import { getAllLocalGuides } from "@/lib/content/local";

interface Props {
  params: Promise<{ slug: string; cidade: string; bairro: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllLocalGuides()
    .filter((g) => g.frontmatter.districtSlug && g.frontmatter.citySlug)
    .map((g) => ({
      slug: g.frontmatter.stateCode,
      cidade: g.frontmatter.citySlug!,
      bairro: g.frontmatter.districtSlug!,
    }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, cidade, bairro } = await params;
  return localGuideMetadata(`/emprestimos/${slug}/${cidade}/${bairro}/`);
}

export default async function Page({ params }: Props) {
  const { slug, cidade, bairro } = await params;
  return <LocalGuideView urlPath={`/emprestimos/${slug}/${cidade}/${bairro}/`} />;
}
