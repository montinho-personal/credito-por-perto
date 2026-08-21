import type { Metadata } from "next";
import { canonicalUrl } from "@/lib/seo/canonical";
import { SITE_NAME } from "@/lib/site";

interface PageMetadataInput {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
  ogType?: "website" | "article";
  publishedTime?: string;
  modifiedTime?: string;
  authors?: string[];
  /** URL absoluta da imagem de destaque (Open Graph / Twitter Card) */
  image?: string;
  imageAlt?: string;
}

/**
 * Constrói metadados consistentes: título único, descrição única,
 * canonical absoluta autorreferencial, Open Graph e Twitter Cards.
 */
export function buildMetadata(input: PageMetadataInput): Metadata {
  const url = canonicalUrl(input.path);
  return {
    title: input.title,
    description: input.description,
    alternates: {
      canonical: url,
    },
    robots: input.noindex
      ? { index: false, follow: false }
      : { index: true, follow: true },
    openGraph: {
      title: input.title,
      description: input.description,
      url,
      siteName: SITE_NAME,
      locale: "pt_BR",
      type: input.ogType ?? "website",
      ...(input.ogType === "article"
        ? {
            publishedTime: input.publishedTime,
            modifiedTime: input.modifiedTime,
            authors: input.authors,
          }
        : {}),
      ...(input.image
        ? {
            images: [
              {
                url: input.image,
                width: 1600,
                height: 900,
                alt: input.imageAlt,
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      ...(input.image ? { images: [input.image] } : {}),
    },
  };
}
