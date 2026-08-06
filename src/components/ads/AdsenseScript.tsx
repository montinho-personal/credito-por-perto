import Script from "next/script";
import { adsenseClient, isAdsenseEnabled } from "@/lib/adsense/config";

/**
 * Script do AdSense — só entra na página quando os anúncios estão
 * explicitamente habilitados com um client ID real. Em previews do Vercel
 * nunca carrega (VERCEL_ENV !== production).
 */
export function AdsenseScript() {
  if (!isAdsenseEnabled()) return null;
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") {
    return null;
  }
  return (
    <Script
      id="adsense-loader"
      strategy="lazyOnload"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient()}`}
      crossOrigin="anonymous"
    />
  );
}
