import { adsenseClient, isAdsenseEnabled } from "@/lib/adsense/config";

/**
 * Script da conta do AdSense.
 *
 * É este script — e não uma unidade de anúncio — que conecta o site à conta e
 * permite que o Google revise o domínio. Nenhum bloco de anúncio depende dele
 * para existir: os slots continuam exigindo IDs próprios.
 *
 * Por que uma tag `<script>` comum, e não `next/script`: o React 19 iça
 * automaticamente para o `<head>` qualquer `<script async src>` renderizado
 * numa árvore de componentes. O resultado no HTML servido é exatamente o
 * snippet que o AdSense manda colar entre `<head>` e `</head>` — async,
 * portanto sem bloquear a renderização e sem custo de LCP.
 *
 * Em previews do Vercel nunca carrega: ambiente de teste não deve gerar
 * impressões nem confundir a revisão do Google.
 */
export function AdsenseScript() {
  if (!isAdsenseEnabled()) return null;
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") {
    return null;
  }
  return (
    <script
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient()}`}
      crossOrigin="anonymous"
    />
  );
}
