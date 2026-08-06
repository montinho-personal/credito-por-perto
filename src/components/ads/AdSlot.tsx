import {
  adsenseClient,
  isAdsenseEnabled,
  slotFor,
  type AdPlacement,
} from "@/lib/adsense/config";

/**
 * Slot de anúncio do Google AdSense.
 *
 * Enquanto NEXT_PUBLIC_ADSENSE_ENABLED !== "true" ou não houver IDs reais:
 * - nada é renderizado (nenhuma caixa vazia, nenhuma requisição);
 * - o layout não é afetado.
 *
 * Quando ativado, o contêiner reserva altura mínima para evitar CLS e é
 * identificado como publicidade.
 */
export function AdSlot({
  placement,
  pageHasSubstantialContent = true,
}: {
  placement: AdPlacement;
  pageHasSubstantialContent?: boolean;
}) {
  if (!isAdsenseEnabled() || !pageHasSubstantialContent) return null;
  const slot = slotFor(placement);
  if (!slot) return null;

  return (
    <div
      className="my-8"
      role="complementary"
      aria-label="Publicidade"
      data-ad-placement={placement}
    >
      <p className="mb-1 text-center text-[0.65rem] uppercase tracking-widest text-brand-muted">
        Publicidade
      </p>
      <div style={{ minHeight: 280 }} className="overflow-hidden">
        <ins
          className="adsbygoogle block"
          style={{ display: "block" }}
          data-ad-client={adsenseClient()}
          data-ad-slot={slot}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    </div>
  );
}
