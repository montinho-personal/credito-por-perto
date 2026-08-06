import { SITE_URL } from "@/lib/site";

/**
 * Política de canonicalização (docs/canonical-policy.md):
 * - sempre absoluta, HTTPS, com www;
 * - sempre com trailing slash (padrão único do projeto);
 * - sem parâmetros de consulta nem fragmentos.
 */
export function canonicalUrl(path: string): string {
  if (/^https?:\/\//.test(path)) {
    throw new Error(
      `canonicalUrl espera um caminho relativo, não uma URL completa: ${path}`,
    );
  }
  let clean = path.split("#")[0]!.split("?")[0]!;
  if (!clean.startsWith("/")) {
    clean = `/${clean}`;
  }
  if (!clean.endsWith("/")) {
    clean = `${clean}/`;
  }
  return `${SITE_URL}${clean}`;
}

/** Valida se uma URL respeita a política de canonical do projeto. */
export function isValidCanonical(url: string): boolean {
  if (!url.startsWith(`${SITE_URL}/`) && url !== `${SITE_URL}/`) return false;
  if (!url.startsWith("https://www.")) return false;
  if (url.includes("?") || url.includes("#")) return false;
  if (!url.endsWith("/")) return false;
  return true;
}
