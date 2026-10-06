/**
 * Cidades para o passo "Em qual cidade você está?" do simulador do Banco do
 * Povo. Sai dos guias publicados e dos dossiês — nenhuma cidade, endereço ou
 * data digitado à mão. O simulador só APONTA para o guia: o endereço da
 * unidade continua morando no guia, para não duplicar conteúdo local.
 *
 * Só roda no servidor (lê o disco); a página passa a lista pronta ao
 * componente.
 */

import { getLocalDossier, getPublishedLocalGuides } from "@/lib/content/local";

export interface BppCityOption {
  /** Nome exibido, como no guia. */
  name: string;
  /** Caminho do guia local. */
  path: string;
  /** O dossiê tem a unidade do Banco do Povo verificada em fonte oficial. */
  hasVerifiedUnit: boolean;
  /** Data da verificação mais recente da unidade (AAAA-MM-DD). */
  checkedAt: string | null;
}

export function getBppCityOptions(): BppCityOption[] {
  return getPublishedLocalGuides()
    .filter((g) => g.frontmatter.localityType !== "state")
    .map((g) => {
      const dossier = g.frontmatter.dossierId ? getLocalDossier(g.frontmatter.dossierId) : undefined;
      const programs = (dossier?.verifiedLocalPrograms ?? []).filter((p) => /banco do povo/i.test(p.program));
      const checkedAt = programs.map((p) => p.checkedAt).sort().at(-1) ?? null;
      return {
        name: g.frontmatter.localityName,
        path: g.urlPath,
        hasVerifiedUnit: programs.length > 0,
        checkedAt,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}
