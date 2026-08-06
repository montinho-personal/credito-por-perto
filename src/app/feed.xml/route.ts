import { getRecentArticles } from "@/lib/content/articles";
import { SITE_NAME, SITE_URL, SITE_DESCRIPTION } from "@/lib/site";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export const dynamic = "force-static";

export function GET() {
  const articles = getRecentArticles(30);
  const items = articles
    .map((article) => {
      const fm = article.frontmatter;
      const pubDate = new Date(`${fm.publishedAt}T12:00:00Z`).toUTCString();
      return `    <item>
      <title>${escapeXml(fm.title)}</title>
      <link>${article.canonical}</link>
      <guid isPermaLink="true">${article.canonical}</guid>
      <description>${escapeXml(fm.description)}</description>
      <pubDate>${pubDate}</pubDate>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_NAME)}</title>
    <link>${SITE_URL}/</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>pt-BR</language>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
