import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

/**
 * O contrato mudou quando o Publisher ID real passou a existir no código: o
 * SCRIPT da conta é carregado por padrão, porque é ele que conecta o site ao
 * AdSense e permite a revisão do Google.
 *
 * A garantia que continua valendo, e que estes testes existem para proteger:
 * carregar o script NÃO é o mesmo que exibir anúncio. Nenhuma unidade
 * renderiza sem um slot ID próprio e sem conteúdo editorial suficiente.
 */
describe("configuração do AdSense", () => {
  it("usa o Publisher ID real da conta quando não há sobrescrita", async () => {
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_CLIENT", "");
    const { adsenseClient } = await import("@/lib/adsense/config");
    expect(adsenseClient()).toMatch(/^ca-pub-\d{16}$/);
  });

  it("fica ativo por padrão, para que o Google encontre o código", async () => {
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_ENABLED", "");
    const { isAdsenseEnabled } = await import("@/lib/adsense/config");
    expect(isAdsenseEnabled()).toBe(true);
  });

  it('o interruptor de emergência ("false") desliga tudo', async () => {
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_ENABLED", "false");
    const { isAdsenseEnabled, shouldRenderAd } = await import(
      "@/lib/adsense/config"
    );
    expect(isAdsenseEnabled()).toBe(false);
    expect(shouldRenderAd("article-bottom", true)).toBe(false);
  });

  it("script ativo não basta: sem slot configurado nada renderiza", async () => {
    const { isAdsenseEnabled, shouldRenderAd } = await import(
      "@/lib/adsense/config"
    );
    expect(isAdsenseEnabled()).toBe(true);
    expect(shouldRenderAd("article-bottom", true)).toBe(false);
    expect(shouldRenderAd("sidebar", true)).toBe(false);
    expect(shouldRenderAd("category", true)).toBe(false);
  });

  it("nunca renderiza anúncio em página sem conteúdo substancial", async () => {
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_SLOT_ARTICLE_BOTTOM", "1234567890");
    const { shouldRenderAd } = await import("@/lib/adsense/config");
    expect(shouldRenderAd("article-bottom", false)).toBe(false);
    expect(shouldRenderAd("article-bottom", true)).toBe(true);
  });
});
