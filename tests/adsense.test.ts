import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("configuração do AdSense", () => {
  it("fica desativado por padrão (sem env vars)", async () => {
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_ENABLED", "");
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_CLIENT", "");
    const { isAdsenseEnabled } = await import("@/lib/adsense/config");
    expect(isAdsenseEnabled()).toBe(false);
  });

  it("não ativa só com a flag, sem client ID real", async () => {
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_CLIENT", "");
    const { isAdsenseEnabled } = await import("@/lib/adsense/config");
    expect(isAdsenseEnabled()).toBe(false);
  });

  it("não ativa só com client ID, sem flag explícita", async () => {
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_ENABLED", "false");
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_CLIENT", "ca-pub-0000000000000000");
    const { isAdsenseEnabled } = await import("@/lib/adsense/config");
    expect(isAdsenseEnabled()).toBe(false);
  });

  it("nunca renderiza anúncio em página sem conteúdo substancial", async () => {
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_CLIENT", "ca-pub-0000000000000000");
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_SLOT_ARTICLE_TOP", "1234");
    const { shouldRenderAd } = await import("@/lib/adsense/config");
    expect(shouldRenderAd("article-top", false)).toBe(false);
  });

  it("sem slot configurado, o placement não renderiza", async () => {
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_CLIENT", "ca-pub-0000000000000000");
    const { shouldRenderAd } = await import("@/lib/adsense/config");
    expect(shouldRenderAd("sidebar", true)).toBe(false);
  });
});
