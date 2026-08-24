import { z } from "zod";

/**
 * Estados editoriais do fluxo de produção (docs/editorial.md).
 * Conteúdo só é indexável e listado quando status === "published".
 */
export const EDITORIAL_STATES = [
  "idea",
  "briefing",
  "research",
  "draft",
  "fact-check",
  "originality-review",
  "technical-review",
  "legal-review",
  "approved",
  "scheduled",
  "published",
  "needs-update",
  "archived",
] as const;

export type EditorialState = (typeof EDITORIAL_STATES)[number];

export const CONTENT_TYPES = [
  "guide",
  "comparison",
  "news",
  "safety",
  "local",
  "glossary",
] as const;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato YYYY-MM-DD");

export const articleFrontmatterSchema = z
  .object({
    title: z.string().min(10).max(110),
    slug: z
      .string()
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Slug deve usar apenas minúsculas, números e hífens (sem acentos)",
      ),
    description: z.string().min(50).max(180),
    excerpt: z.string().min(30).max(400),
    category: z.enum([
      "emprestimos",
      "juros-e-cet",
      "credito-seguro",
      "organizacao-financeira",
    ]),
    cluster: z.string().min(2),
    tags: z.array(z.string()).min(1).max(10),
    authorId: z.string().min(2),
    reviewerId: z.string().optional(),
    status: z.enum(EDITORIAL_STATES),
    publishedAt: isoDate,
    updatedAt: isoDate.optional(),
    reviewedAt: isoDate.optional(),
    sourceCheckedAt: isoDate.optional(),
    featuredImage: z.string().optional(),
    imageAlt: z.string().optional(),
    /** Dimensões reais da capa quando fogem do padrão 1600×900 */
    imageWidth: z.number().int().positive().optional(),
    imageHeight: z.number().int().positive().optional(),
    featured: z.boolean().optional(),
    noindex: z.boolean().optional(),
    canonical: z.string().optional(),
    contentType: z.enum(CONTENT_TYPES),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.updatedAt && data.updatedAt < data.publishedAt) {
      ctx.addIssue({
        code: "custom",
        message: "updatedAt não pode ser anterior a publishedAt",
        path: ["updatedAt"],
      });
    }
    if (data.featuredImage && !data.imageAlt) {
      ctx.addIssue({
        code: "custom",
        message: "featuredImage exige imageAlt",
        path: ["imageAlt"],
      });
    }
  });

export type ArticleFrontmatter = z.infer<typeof articleFrontmatterSchema>;

export const LOCALITY_TYPES = [
  "country",
  "state",
  "municipality",
  "district",
  "neighborhood",
  "region",
] as const;

export const localGuideFrontmatterSchema = z
  .object({
    title: z.string().min(10).max(110),
    localityName: z.string().min(2),
    localityType: z.enum(LOCALITY_TYPES),
    /** UF em minúsculas, ex.: "sp" */
    stateCode: z.string().regex(/^[a-z]{2}$/),
    /** Slug do município (para municipality, district, neighborhood, region) */
    citySlug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .optional(),
    /** Slug do bairro/região quando a página é de nível abaixo do município */
    districtSlug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .optional(),
    /** IDs de municípios envolvidos quando a localidade cruza fronteiras (ex.: Alphaville) */
    municipalitiesInvolved: z.array(z.string()).optional(),
    description: z.string().min(50).max(180),
    excerpt: z.string().min(30).max(400),
    authorId: z.string().min(2),
    status: z.enum(EDITORIAL_STATES),
    publishedAt: isoDate,
    updatedAt: isoDate.optional(),
    lastVerifiedAt: isoDate.optional(),
    noindex: z.boolean().optional(),
    /** ID do dossiê local em content/local-dossiers/ — obrigatório para publicar */
    dossierId: z.string().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.status === "published") {
      if (!data.dossierId) {
        ctx.addIssue({
          code: "custom",
          message:
            "Página local não pode ser publicada sem dossiê local (dossierId)",
          path: ["dossierId"],
        });
      }
      if (!data.lastVerifiedAt) {
        ctx.addIssue({
          code: "custom",
          message:
            "Página local não pode ser publicada sem data real de verificação (lastVerifiedAt)",
          path: ["lastVerifiedAt"],
        });
      }
    }
  });

export type LocalGuideFrontmatter = z.infer<typeof localGuideFrontmatterSchema>;

export const authorSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    role: z.string(),
    /** true quando é uma identificação editorial coletiva, não uma pessoa */
    isTeam: z.boolean(),
    bio: z.string(),
    expertiseNote: z.string().optional(),
  })
  .strict();

export type Author = z.infer<typeof authorSchema>;
