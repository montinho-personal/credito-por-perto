import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";

/**
 * Porteiro do GA4, no mesmo espírito do AdSense: sem ID real configurado,
 * nada é renderizado (nem o banner de consentimento — sem cookies não há o
 * que consentir; o Vercel Analytics não usa cookies). Em previews do Vercel
 * nunca carrega (VERCEL_ENV !== production).
 */
export function AnalyticsGate() {
  const measurementId = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID?.trim();
  if (!measurementId || !/^G-[A-Z0-9]+$/.test(measurementId)) return null;
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") {
    return null;
  }
  return <GoogleAnalytics measurementId={measurementId} />;
}
