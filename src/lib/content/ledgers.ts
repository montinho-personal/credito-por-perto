import fs from "node:fs";
import path from "node:path";
import { BRIEFINGS_DIR, SOURCE_LEDGERS_DIR } from "@/lib/content/paths";

/** Briefing de originalidade obrigatório antes da redação (aditivo, seção 2). */
export interface OriginalityBrief {
  proposedTitle: string;
  primaryIntent: string;
  secondaryIntents: string[];
  targetReader: string;
  readerSituation: string;
  centralQuestion: string;
  uniqueAngle: string;
  originalContribution: string[];
  primarySources: string[];
  supportingSources: string[];
  contentArchetype:
    | "complete-guide"
    | "decision-guide"
    | "comparison"
    | "explainer"
    | "calculator-support"
    | "fraud-alert"
    | "checklist"
    | "local-guide"
    | "glossary"
    | "news-analysis";
  proposedStructure: string[];
  uniqueExamples: string[];
  proposedVisuals: string[];
  pagesThatMayCompete: string[];
  informationThatMustNotBeRepeated: string[];
  localEvidenceRequired?: string[];
  publicationDecision: "create" | "merge" | "update-existing" | "discard";
}

/** Registro de fontes e afirmações por artigo (aditivo, seção 11). */
export interface SourceLedger {
  articleSlug: string;
  claims: Array<{
    claimId: string;
    claimText: string;
    sourceOrganization: string;
    sourceTitle: string;
    sourceLocation: string;
    sourceType:
      | "official"
      | "primary-institution"
      | "academic"
      | "journalistic"
      | "commercial";
    accessedAt: string;
    effectiveDate?: string;
    expiresAt?: string;
    notes?: string;
  }>;
}

export function getBriefing(slug: string): OriginalityBrief | undefined {
  const file = path.join(BRIEFINGS_DIR, `${slug}.json`);
  if (!fs.existsSync(file)) return undefined;
  return JSON.parse(fs.readFileSync(file, "utf8")) as OriginalityBrief;
}

export function getSourceLedger(slug: string): SourceLedger | undefined {
  const file = path.join(SOURCE_LEDGERS_DIR, `${slug}.json`);
  if (!fs.existsSync(file)) return undefined;
  return JSON.parse(fs.readFileSync(file, "utf8")) as SourceLedger;
}

export function listBriefingSlugs(): string[] {
  if (!fs.existsSync(BRIEFINGS_DIR)) return [];
  return fs
    .readdirSync(BRIEFINGS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
}

export function listLedgerSlugs(): string[] {
  if (!fs.existsSync(SOURCE_LEDGERS_DIR)) return [];
  return fs
    .readdirSync(SOURCE_LEDGERS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
}
