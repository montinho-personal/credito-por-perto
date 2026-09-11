import { SITE_NAME, SITE_URL, SITE_DESCRIPTION } from "@/lib/site";
import type { Article } from "@/lib/content/articles";
import type { LocalGuide } from "@/lib/content/local";
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

function authorNode(author: Author) {
  return author.isTeam
    ? {
        "@type": "Organization",
        name: author.name,
        url: `${SITE_URL}/quem-somos/`,
      }
    : {
        "@type": "Person",
        name: author.name,
        url: `${SITE_URL}/autores/${author.id}/`,
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
    ...(fm.featuredImage ? { image: [`${SITE_URL}${fm.featuredImage}`] } : {}),
    author: authorNode(author),
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
}

/**
 * Guia local. Substitui o WebPage que estas páginas emitiam: o WebPage não
 * carrega data nenhuma, e data é justamente o que diferencia este conteúdo —
 * endereço e horário de repartição pública envelhecem, e as listas de terceiros
 * que disputam as mesmas buscas não datam nada.
 *
 * `spatialCoverage` declara a cidade de que a página trata. É descrição do
 * conteúdo, não de um estabelecimento: seguimos sem LocalBusiness e sem
 * FinancialService, porque o portal é editorial e não atende no balcão.
 */
export function localGuideJsonLd(
  guide: LocalGuide,
  author: Author | undefined,
  stateName?: string,
) {
  const fm = guide.frontmatter;
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: fm.title,
    description: fm.description,
    inLanguage: "pt-BR",
    mainEntityOfPage: guide.canonical,
    datePublished: fm.publishedAt,
    ...(fm.updatedAt ? { dateModified: fm.updatedAt } : {}),
    ...(fm.featuredImage ? { image: [`${SITE_URL}${fm.featuredImage}`] } : {}),
    spatialCoverage: {
      "@type": "Place",
      name: fm.localityName,
      ...(stateName
        ? {
            containedInPlace: {
              "@type": "AdministrativeArea",
              name: stateName,
            },
          }
        : {}),
    },
    ...(author ? { author: authorNode(author) } : {}),
    publisher: { "@id": `${SITE_URL}/#organization` },
    isPartOf: { "@id": `${SITE_URL}/#website` },
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

export function webPageJsonLd(
  title: string,
  description: string,
  path: string,
  image?: string,
) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    description,
    url: `${SITE_URL}${path}`,
    inLanguage: "pt-BR",
    isPartOf: { "@id": `${SITE_URL}/#website` },
    ...(image ? { image: [`${SITE_URL}${image}`] } : {}),
  };
}

/**
 * Lista ordenada de páginas internas — usada no hub de ferramentas.
 * Descreve o que a página realmente mostra: uma lista, sem nota nem
 * classificação, coerente com a regra de não usar AggregateRating.
 */
export function itemListJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListOrder: "https://schema.org/ItemListUnordered",
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: `${SITE_URL}${item.path}`,
    })),
  };
}
