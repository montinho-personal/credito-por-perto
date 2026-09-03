/**
 * Configuração central do Google AdSense.
 *
 * O Publisher ID abaixo foi emitido pela conta do proprietário no AdSense e
 * fornecido por ele. Publisher ID não é segredo: ele aparece no código-fonte
 * de qualquer página que exibe AdSense. Nunca invente um.
 *
 * Estado atual: o SCRIPT da conta é carregado (é o que conecta o site à conta
 * e permite a revisão do Google), mas NENHUMA unidade de anúncio renderiza —
 * os slots continuam exigindo IDs próprios, que ainda não existem.
 */

/** Emitido pelo AdSense do proprietário. */
const PUBLISHER_ID = "ca-pub-1065686330826144";

export type AdPlacement =
  | "article-top"
  | "article-inline"
  | "article-bottom"
  | "sidebar"
  | "category";

export function adsenseClient(): string {
  return process.env.NEXT_PUBLIC_ADSENSE_CLIENT || PUBLISHER_ID;
}

/**
 * Interruptor de emergência: definir NEXT_PUBLIC_ADSENSE_ENABLED="false"
 * desliga o AdSense por completo sem precisar de novo deploy de código.
 */
export function isAdsenseEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_ADSENSE_ENABLED !== "false" &&
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
