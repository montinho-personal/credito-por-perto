/**
 * Auditoria de legibilidade: mede se o texto está "leve" — frases curtas,
 * poucos travessões, parágrafos que respiram. Regra do proprietário
 * (16/08/2026): o leitor comum precisa entender sem esforço.
 *
 * Métricas por artigo (sobre o texto editorial, sem código/frontmatter):
 * - média de palavras por frase (alvo ≤ 22; aviso > 26);
 * - % de frases longas, com mais de 30 palavras (alvo ≤ 15%; aviso > 25%);
 * - travessões por 100 palavras (alvo ≤ 1,2; aviso > 1,8).
 * Avisos não quebram o build — orientam a fila de reescrita.
 */
import { getPublishedArticles } from "../src/lib/content/articles";
import { getPublishedLocalGuides } from "../src/lib/content/local";
import {
  buildReport,
  editorialText,
  finishAudit,
  writeJsonReport,
  type Finding,
} from "./lib/audit-helpers";

interface Doc {
  label: string;
  body: string;
}

const docs: Doc[] = [
  ...getPublishedArticles().map((a) => ({ label: a.urlPath, body: a.content })),
  ...getPublishedLocalGuides().map((g) => ({ label: g.urlPath, body: g.content })),
];

export interface ReadabilityMetrics {
  words: number;
  sentences: number;
  avgWordsPerSentence: number;
  longSentencePct: number;
  dashesPer100Words: number;
}

export function measureReadability(mdxBody: string): ReadabilityMetrics {
  const text = editorialText(mdxBody);
  const sentences = text
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).length >= 3);
  const wordCounts = sentences.map((s) => s.split(/\s+/).length);
  const words = wordCounts.reduce((a, b) => a + b, 0);
  const longSentences = wordCounts.filter((n) => n > 30).length;
  const dashes = (text.match(/—/g) ?? []).length;
  return {
    words,
    sentences: sentences.length,
    avgWordsPerSentence: sentences.length ? words / sentences.length : 0,
    longSentencePct: sentences.length
      ? (longSentences / sentences.length) * 100
      : 0,
    dashesPer100Words: words ? (dashes / words) * 100 : 0,
  };
}

const findings: Finding[] = [];

for (const doc of docs) {
  const m = measureReadability(doc.body);
  const problems: string[] = [];
  if (m.avgWordsPerSentence > 26) {
    problems.push(`média de ${m.avgWordsPerSentence.toFixed(1)} palavras/frase (alvo ≤ 22)`);
  }
  if (m.longSentencePct > 25) {
    problems.push(`${m.longSentencePct.toFixed(0)}% de frases com 30+ palavras (alvo ≤ 15%)`);
  }
  if (m.dashesPer100Words > 1.8) {
    problems.push(`${m.dashesPer100Words.toFixed(1)} travessões/100 palavras (alvo ≤ 1,2)`);
  }
  if (problems.length > 0) {
    findings.push({
      severity: "warning",
      rule: "texto-pesado",
      pages: [doc.label],
      detail: problems.join("; "),
    });
  }
}

const report = buildReport("legibilidade", findings);
writeJsonReport("readability-report.json", report);
finishAudit(report);
