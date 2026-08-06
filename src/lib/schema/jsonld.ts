import { SITE_NAME, SITE_URL, SITE_DESCRIPTION } from "@/lib/site";
import type { Article } from "@/lib/content/articles";
import type { Author } from "@/lib/validation/frontmatter";

/**
 * JSON-LD coerente com o conteúdo visível. Nunca usamos AggregateRating,
 * LocalBusiness ou FinancialService: o portal é editorial, não uma financeira.
 */

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    description: SITE_DESCRIPTION,
    logo: `${SITE_URL}/brand/credito-por-perto-icon.svg`,
  };
}

export function webSiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    inLanguage: "pt-BR",
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
}

export function articleJsonLd(article: Article, author: Author) {
  const fm = article.frontmatter;
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: fm.title,
    description: fm.description,
    inLanguage: "pt-BR",
    mainEntityOfPage: article.canonical,
    datePublished: fm.publishedAt,
    ...(fm.updatedAt ? { dateModified: fm.updatedAt } : {}),
    author: author.isTeam
      ? {
          "@type": "Organization",
          name: author.name,
          url: `${SITE_URL}/quem-somos/`,
        }
      : {
          "@type": "Person",
          name: author.name,
          url: `${SITE_URL}/autores/${author.id}/`,
        },
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
}

export interface BreadcrumbItem {
  name: string;
  path: string;
}

export function breadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}

export function webPageJsonLd(title: string, description: string, path: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    description,
    url: `${SITE_URL}${path}`,
    inLanguage: "pt-BR",
    isPartOf: { "@id": `${SITE_URL}/#website` },
  };
}
