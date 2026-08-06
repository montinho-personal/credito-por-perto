/**
 * Auditoria de originalidade interna (docs/originality-policy.md).
 *
 * Compara somente o conteúdo editorial (headers, footers, navegação,
 * componentes compartilhados e avisos padronizados ficam de fora, pois a
 * comparação parte do corpo MDX, não do HTML renderizado).
 *
 * Bloqueia (crítico): títulos/descrições duplicados, introduções ou
 * conclusões idênticas, parágrafos idênticos, corpo quase idêntico e páginas
 * locais que diferem apenas pelo nome da localidade.
 */
import { getAllArticles } from "../src/lib/content/articles";
import { getAllLocalGuides } from "../src/lib/content/local";
import {
  buildReport,
  cosineTfIdf,
  editorialText,
  finishAudit,
  headingSequence,
  jaccard,
  normalizeForComparison,
  paragraphsOf,
  shingles,
  writeHtmlReport,
  writeJsonReport,
  type Finding,
} from "./lib/audit-helpers";

interface Doc {
  url: string;
  title: string;
  description: string;
  body: string;
  isLocal: boolean;
  localityName?: string;
}

const docs: Doc[] = [
  ...getAllArticles().map((a) => ({
    url: a.urlPath,
    title: a.frontmatter.title,
    description: a.frontmatter.description,
    body: a.content,
    isLocal: false,
  })),
  ...getAllLocalGuides().map((g) => ({
    url: g.urlPath,
    title: g.frontmatter.title,
    description: g.frontmatter.description,
    body: g.content,
    isLocal: true,
    localityName: g.frontmatter.localityName,
  })),
];

const findings: Finding[] = [];

/* Títulos, H1 e descrições duplicados ou quase idênticos */
for (let i = 0; i < docs.length; i++) {
  for (let j = i + 1; j < docs.length; j++) {
    const a = docs[i]!;
    const b = docs[j]!;
    if (normalizeForComparison(a.title) === normalizeForComparison(b.title)) {
      findings.push({
        severity: "critical",
        rule: "titulo-h1-duplicado",
        pages: [a.url, b.url],
        detail: "Título/H1 idêntico em duas páginas.",
      });
    } else {
      const titleSim = jaccard(
        new Set(normalizeForComparison(a.title).split(" ")),
        new Set(normalizeForComparison(b.title).split(" ")),
      );
      if (titleSim > 0.8) {
        findings.push({
          severity: "warning",
          rule: "titulo-excessivamente-semelhante",
          pages: [a.url, b.url],
          detail: "Títulos com sobreposição alta de palavras.",
          score: titleSim,
        });
      }
    }
    if (
      normalizeForComparison(a.description) ===
      normalizeForComparison(b.description)
    ) {
      findings.push({
        severity: "critical",
        rule: "meta-description-duplicada",
        pages: [a.url, b.url],
        detail: "Meta description idêntica em duas páginas.",
      });
    }
  }
}

/* Introduções e conclusões repetidas */
function firstParagraph(body: string): string {
  return paragraphsOf(body)[0] ?? "";
}
function lastParagraph(body: string): string {
  const paragraphs = paragraphsOf(body);
  return paragraphs[paragraphs.length - 1] ?? "";
}

for (let i = 0; i < docs.length; i++) {
  for (let j = i + 1; j < docs.length; j++) {
    const a = docs[i]!;
    const b = docs[j]!;
    const introA = firstParagraph(a.body);
    const introB = firstParagraph(b.body);
    if (introA && introA === introB) {
      findings.push({
        severity: "critical",
        rule: "introducao-duplicada",
        pages: [a.url, b.url],
        detail: "Introdução idêntica em duas páginas.",
      });
    } else if (introA && introB) {
      const sim = jaccard(shingles(introA, 4), shingles(introB, 4));
      if (sim > 0.5) {
        findings.push({
          severity: "warning",
          rule: "introducao-semelhante",
          pages: [a.url, b.url],
          detail: "Introduções muito parecidas.",
          score: sim,
        });
      }
    }
    const concA = lastParagraph(a.body);
    const concB = lastParagraph(b.body);
    if (concA && concA === concB) {
      findings.push({
        severity: "critical",
        rule: "conclusao-duplicada",
        pages: [a.url, b.url],
        detail: "Conclusão idêntica em duas páginas.",
      });
    }
  }
}

/* Parágrafos idênticos e quase idênticos entre documentos */
for (let i = 0; i < docs.length; i++) {
  for (let j = i + 1; j < docs.length; j++) {
    const a = docs[i]!;
    const b = docs[j]!;
    const paragraphsB = new Set(paragraphsOf(b.body));
    for (const paragraph of paragraphsOf(a.body)) {
      if (paragraphsB.has(paragraph)) {
        findings.push({
          severity: "critical",
          rule: "paragrafo-exato-duplicado",
          pages: [a.url, b.url],
          detail: "Parágrafo idêntico presente em duas páginas.",
          excerpt: `${paragraph.slice(0, 120)}…`,
        });
      }
    }
  }
}

/* Similaridade geral do corpo: shingles + TF-IDF por cosseno */
const corpus = docs.map((d) => editorialText(d.body));
for (let i = 0; i < docs.length; i++) {
  for (let j = i + 1; j < docs.length; j++) {
    const a = docs[i]!;
    const b = docs[j]!;
    const shingleSim = jaccard(
      shingles(editorialText(a.body)),
      shingles(editorialText(b.body)),
    );
    const cosine = cosineTfIdf(
      editorialText(a.body),
      editorialText(b.body),
      corpus,
    );
    if (shingleSim > 0.6) {
      findings.push({
        severity: "critical",
        rule: "corpo-quase-identico",
        pages: [a.url, b.url],
        detail: "Corpo editorial praticamente duplicado (shingles).",
        score: shingleSim,
      });
    } else if (shingleSim > 0.25 || cosine > 0.85) {
      findings.push({
        severity: "warning",
        rule: "corpo-similar",
        pages: [a.url, b.url],
        detail: `Similaridade relevante (shingles ${shingleSim.toFixed(3)}, cosseno ${cosine.toFixed(3)}) — revisar diferenciação.`,
        score: Math.max(shingleSim, cosine),
      });
    }

    /* Sequência de headings idêntica indica texto-molde */
    const headingsA = headingSequence(a.body);
    const headingsB = headingSequence(b.body);
    if (
      headingsA.length >= 4 &&
      headingsA.length === headingsB.length &&
      headingsA.every((h, idx) => h === headingsB[idx])
    ) {
      findings.push({
        severity: "warning",
        rule: "sequencia-headings-identica",
        pages: [a.url, b.url],
        detail: "Mesma sequência de H2/H3 em duas páginas — indício de molde.",
      });
    }
  }
}

/* Páginas locais que diferem apenas pelo nome da localidade */
const localDocs = docs.filter((d) => d.isLocal);
for (let i = 0; i < localDocs.length; i++) {
  for (let j = i + 1; j < localDocs.length; j++) {
    const a = localDocs[i]!;
    const b = localDocs[j]!;
    const strip = (doc: Doc) =>
      normalizeForComparison(
        editorialText(doc.body).replaceAll(
          normalizeForComparison(doc.localityName ?? ""),
          " __localidade__ ",
        ),
      );
    const sim = jaccard(shingles(strip(a)), shingles(strip(b)));
    if (sim > 0.7) {
      findings.push({
        severity: "critical",
        rule: "pagina-local-so-troca-nome",
        pages: [a.url, b.url],
        detail:
          "Páginas locais praticamente idênticas após remover o nome da localidade.",
        score: sim,
      });
    } else if (sim > 0.45) {
      findings.push({
        severity: "warning",
        rule: "paginas-locais-proximas-semelhantes",
        pages: [a.url, b.url],
        detail: "Páginas locais com sobreposição alta — revisar diferenciação.",
        score: sim,
      });
    }
  }
}

/* Expressões genéricas / padrões de IA usados em excesso */
const GENERIC_PHRASES = [
  "no cenario financeiro atual",
  "nos dias de hoje",
  "em um mundo cada vez mais",
  "voce ja se perguntou",
  "e importante ressaltar",
  "vale destacar",
  "nesse sentido",
  "quando o assunto e",
  "pode ser uma excelente opcao",
  "cada vez mais brasileiros",
  "tomar uma decisao informada",
  "melhor se adapta as suas necessidades",
  "em conclusao",
  "neste artigo vamos explorar",
  "continue lendo para descobrir",
];
const phraseCounts = new Map<string, string[]>();
for (const doc of docs) {
  const text = normalizeForComparison(editorialText(doc.body));
  for (const phrase of GENERIC_PHRASES) {
    if (text.includes(phrase)) {
      phraseCounts.set(phrase, [...(phraseCounts.get(phrase) ?? []), doc.url]);
    }
  }
}
for (const [phrase, pages] of phraseCounts) {
  findings.push({
    severity: pages.length >= 3 ? "warning" : "info",
    rule: "expressao-generica-recorrente",
    pages,
    detail: `Expressão "${phrase}" presente em ${pages.length} página(s).`,
  });
}

const report = buildReport("originalidade", findings, [
  "header",
  "footer",
  "navegação",
  "breadcrumbs",
  "blocos de publicidade",
  "avisos legais padronizados",
  "caixas de autoria",
  "componentes compartilhados",
]);
writeJsonReport("originality-report.json", report);
writeHtmlReport("originality-report.html", report);
finishAudit(report);
