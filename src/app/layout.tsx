import type { Metadata, Viewport } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import { SITE_NAME, SITE_DESCRIPTION, SITE_URL } from "@/lib/site";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Analytics } from "@vercel/analytics/next";
import { AdsenseScript } from "@/components/ads/AdsenseScript";
import { AnalyticsGate } from "@/components/analytics/AnalyticsGate";
import { ClickTracking } from "@/components/analytics/ClickTracking";
import { SearchProvider } from "@/components/search/SearchProvider";
import { JsonLd } from "@/components/seo/JsonLd";
import { organizationJsonLd, webSiteJsonLd } from "@/lib/schema/jsonld";
import "@/styles/globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
  display: "swap",
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  /**
   * Sem `template`, de propósito (21/09/2026).
   *
   * O sufixo `%s | Crédito por Perto` somava 20 caracteres a toda página e
   * nunca chegava a ser exibido: os títulos já estouravam o corte da busca
   * sozinhos. Pior, gastava o espaço em que cabe a palavra que a pessoa
   * realmente digita — "como funciona", "quanto custa", "existe?".
   *
   * A marca não se perde nisso. O Google monta o nome do site a partir do
   * nó WebSite do JSON-LD (jsonld.ts) e do og:site_name, e o exibe em linha
   * própria, acima do título. Repetir a marca dentro do título era duplicar
   * o que a SERP já mostra.
   *
   * Páginas institucionais curtas ("Contato", "Aviso legal") trazem a marca
   * escrita no próprio título, porque ali ela desambigua em vez de competir.
   */
  title: `${SITE_NAME} | Guia de Empréstimos e Crédito`,
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: {
    types: {
      "application/rss+xml": `${SITE_URL}/feed.xml`,
    },
  },
  verification: {
    // Token público de verificação do Search Console (fornecido pelo
    // proprietário em 16/08/2026); a env var, se definida, tem precedência.
    google:
      process.env.NEXT_PUBLIC_GSC_VERIFICATION ??
      "k9BnbFalRbgB2DdkWjCBzVzz09uBDHxoC5O96t4k1lU",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${sourceSerif.variable}`}>
      <body className="flex min-h-screen flex-col font-sans">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand-navy focus:px-4 focus:py-2 focus:text-white"
        >
          Pular para o conteúdo
        </a>
        <JsonLd data={organizationJsonLd()} />
        <JsonLd data={webSiteJsonLd()} />
        <SearchProvider>
          <SiteHeader />
          <main id="conteudo" className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </SearchProvider>
        <AdsenseScript />
        <AnalyticsGate />
        <ClickTracking />
        <Analytics />
      </body>
    </html>
  );
}
