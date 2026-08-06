/**
 * Configuração central do Google AdSense.
 *
 * Os anúncios ficam DESATIVADOS até que o proprietário forneça IDs reais
 * via variáveis de ambiente. Nunca invente um Publisher ID.
 */

export type AdPlacement =
  | "article-top"
  | "article-inline"
  | "article-bottom"
  | "sidebar"
  | "category";

export function adsenseClient(): string {
  return process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "";
}

/** Anúncios só são ativados com flag explícita + client ID real. */
export function isAdsenseEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_ADSENSE_ENABLED === "true" &&
    adsenseClient().length > 0
  );
}

const SLOT_ENV: Record<AdPlacement, string | undefined> = {
  "article-top": process.env.NEXT_PUBLIC_ADSENSE_SLOT_ARTICLE_TOP,
  "article-inline": process.env.NEXT_PUBLIC_ADSENSE_SLOT_ARTICLE_INLINE,
  "article-bottom": process.env.NEXT_PUBLIC_ADSENSE_SLOT_ARTICLE_BOTTOM,
  sidebar: process.env.NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR,
  category: process.env.NEXT_PUBLIC_ADSENSE_SLOT_CATEGORY,
};

export function slotFor(placement: AdPlacement): string {
  return SLOT_ENV[placement] ?? "";
}

/**
 * Um slot só renderiza quando o AdSense está habilitado, o slot tem ID
 * e a página tem conteúdo editorial suficiente (decidido pelo chamador).
 */
export function shouldRenderAd(
  placement: AdPlacement,
  pageHasSubstantialContent: boolean,
): boolean {
  return (
    isAdsenseEnabled() && slotFor(placement).length > 0 && pageHasSubstantialContent
  );
}
