"use client";

import { useSyncExternalStore } from "react";
import Script from "next/script";
import Link from "next/link";
import { track } from "@/lib/analytics/track";

/**
 * GA4 com consentimento explícito (LGPD): o script só é carregado depois que
 * o visitante aceita no banner. A escolha fica em localStorage e pode ser
 * revista limpando os dados do navegador (conforme a política de cookies).
 */
const CONSENT_KEY = "cpp-consent-analytics";
const CONSENT_EVENT = "cpp-consent-change";

type Consent = "granted" | "denied" | null;

function readConsent(): Consent {
  try {
    const value = window.localStorage.getItem(CONSENT_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

function subscribeConsent(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CONSENT_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CONSENT_EVENT, onChange);
  };
}

export function GoogleAnalytics({ measurementId }: { measurementId: string }) {
  const consent = useSyncExternalStore(
    subscribeConsent,
    readConsent,
    () => null,
  );

  function decide(choice: Exclude<Consent, null>) {
    try {
      window.localStorage.setItem(CONSENT_KEY, choice);
    } catch {
      // Sem armazenamento disponível: trata como sessão sem consentimento.
    }
    window.dispatchEvent(new Event(CONSENT_EVENT));
    /* O evento só chega ao GA4 quando a escolha foi "aceitar" — no "recusar"
       o script nunca carrega e `track()` não encontra `window.gtag`, então
       nada sai. É a ordem certa: quem recusou não é medido nem para dizer
       que recusou. A taxa de aceite se calcula sobre sessões, não sobre
       cliques no banner. O `setTimeout(0)` dá ao React a chance de montar o
       script antes da chamada. */
    if (choice === "granted") {
      window.setTimeout(() => track("consent_choice", { choice }), 0);
    }
  }

  if (consent === "granted") {
    return (
      <>
        <Script
          id="ga4-loader"
          strategy="afterInteractive"
          src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        />
        <Script id="ga4-init" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${measurementId}', { anonymize_ip: true });`}
        </Script>
      </>
    );
  }

  if (consent === "denied") return null;

  return (
    <div
      role="dialog"
      aria-label="Preferências de cookies"
      /* O banner tem evento próprio (`consent_choice`); sem esta marca os dois
         botões também virariam clique genérico, e "Recusar" — cujo clique não
         pode ser medido — apareceria no relatório pela porta dos fundos. */
      data-track-ignore=""
      className="fixed inset-x-0 bottom-0 z-50 border-t border-neutral-200 bg-white p-4 shadow-lg"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center">
        <p className="flex-1 text-sm text-neutral-700">
          Usamos cookies de estatística (Google Analytics) apenas com o seu
          consentimento, para entender quais conteúdos ajudam mais. Detalhes na{" "}
          <Link href="/politica-de-cookies/" className="underline">
            política de cookies
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => decide("denied")}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          >
            Recusar
          </button>
          <button
            type="button"
            onClick={() => decide("granted")}
            className="rounded-lg bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Aceitar
          </button>
        </div>
      </div>
    </div>
  );
}
