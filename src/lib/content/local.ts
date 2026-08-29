import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import {
  localGuideFrontmatterSchema,
  type LocalGuideFrontmatter,
} from "@/lib/validation/frontmatter";
import { LOCAL_GUIDES_DIR, LOCAL_DOSSIERS_DIR } from "@/lib/content/paths";
import { canonicalUrl } from "@/lib/seo/canonical";

export interface LocalGuide {
  frontmatter: LocalGuideFrontmatter;
  content: string;
  urlPath: string;
  canonical: string;
  fileName: string;
}

let cache: LocalGuide[] | null = null;

export function localGuideUrlPath(fm: LocalGuideFrontmatter): string {
  if (fm.localityType === "state") {
    return `/emprestimos/${fm.stateCode}/`;
  }
  if (fm.localityType === "municipality") {
    return `/emprestimos/${fm.stateCode}/${fm.citySlug}/`;
  }
  // district / neighborhood / region abaixo de um município
  return `/emprestimos/${fm.stateCode}/${fm.citySlug}/${fm.districtSlug}/`;
}

export function getAllLocalGuides(): LocalGuide[] {
  if (cache) return cache;
  if (!fs.existsSync(LOCAL_GUIDES_DIR)) return [];
  const files = fs
    .readdirSync(LOCAL_GUIDES_DIR)
    .filter((f) => f.endsWith(".mdx"))
    .sort();
  cache = files.map((fileName) => {
    const raw = fs.readFileSync(path.join(LOCAL_GUIDES_DIR, fileName), "utf8");
    const { data, content } = matter(raw);
    const parsed = localGuideFrontmatterSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error(
        `Frontmatter inválido em ${fileName}: ${parsed.error.message}`,
      );
    }
    const fm = parsed.data;
    const urlPath = localGuideUrlPath(fm);
    return {
      frontmatter: fm,
      content,
      urlPath,
      canonical: canonicalUrl(urlPath),
      fileName,
    };
  });
  return cache;
}

/**
 * Guia local é indexável somente quando publicado, sem noindex,
 * com dossiê e data de verificação — regra central do SEO local.
 */
export function isLocalGuideIndexable(guide: LocalGuide): boolean {
  const fm = guide.frontmatter;
  return (
    fm.status === "published" &&
    !fm.noindex &&
    Boolean(fm.dossierId) &&
    Boolean(fm.lastVerifiedAt)
  );
}

export function getPublishedLocalGuides(): LocalGuide[] {
  return getAllLocalGuides().filter(isLocalGuideIndexable);
}

export function getLocalGuideByPath(urlPath: string): LocalGuide | undefined {
  return getAllLocalGuides().find((g) => g.urlPath === urlPath);
}

export interface LocalDossier {
  localityId: string;
  localityName: string;
  localityType: string;
  stateCode: string;
  officialAdministrativeStatus: string;
  municipalitiesInvolved?: string[];
  officialSources: Array<{
    organization: string;
    documentTitle: string;
    sourceLocation: string;
    checkedAt: string;
    extractedFact: string;
    relevanceToReader: string;
  }>;
  consumerProtectionResources: Array<{
    organization: string;
    service: string;
    officialSource: string;
    checkedAt: string;
  }>;
  /**
   * Programas públicos com atendimento vinculado ao município. O tipo já
   * divergiu do formato real dos arquivos (`name`/`responsibleEntity` contra
   * `program`/`detail`) sem ninguém notar, porque este campo não era
   * renderizado em lugar nenhum. Agora ele alimenta o mapa financeiro, e o
   * formato de todos os dossiês foi unificado no que segue.
   */
  verifiedLocalPrograms: Array<{
    program: string;
    detail: string;
    officialSource: string;
    checkedAt: string;
  }>;
  verifiedServiceInformation: Array<{
    institution: string;
    information: string;
    officialSource: string;
    checkedAt: string;
  }>;
  uniqueLocalQuestions: string[];
  localRisksOrWarnings: string[];
  decisionImpact: string[];
  pendingVerification?: string[];
}

export function getLocalDossier(dossierId: string): LocalDossier | undefined {
  const file = path.join(LOCAL_DOSSIERS_DIR, `${dossierId}.json`);
  if (!fs.existsSync(file)) return undefined;
  return JSON.parse(fs.readFileSync(file, "utf8")) as LocalDossier;
}
