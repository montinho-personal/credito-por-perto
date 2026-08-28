/**
 * AUDITORIA DE COBERTURA DE FERRAMENTAS
 * ============================================================================
 *
 * Esta auditoria existe para transformar em regra verificável o que antes era
 * lembrança: *artigo novo, veja se alguma ferramenta ajuda; ferramenta nova,
 * veja onde ela se encaixa*. Lembrança não escala — em 58 artigos, 19 tinham
 * ficado sem nenhuma ferramenta, e três ferramentas apareciam em três páginas.
 *
 * O que ela checa:
 *
 *   1. link para rota de ferramenta que não existe no registry (crítico);
 *   2. ferramenta que o registry conhece mas que o hub, o rodapé ou a busca
 *      não listam (crítico) — foi assim que a margem consignável sumiu do
 *      rodapé sem ninguém notar;
 *   3. página cujo texto aciona os termos de uma ferramenta e que não a
 *      oferece em lugar nenhum (aviso);
 *   4. página sem nenhuma ferramenta, tendo acionado algum termo (aviso);
 *   5. ferramenta oferecida em menos páginas que o mínimo saudável (aviso).
 *
 * Os avisos são PISTA, não veredito. A auditoria aponta onde a ferramenta
 * caberia; quem decide se cabe de verdade é o editorial. Forçar link em todo
 * casamento de termo produziria exatamente o entulho que o leitor não quer.
 */
import fs from "node:fs";
import path from "node:path";
import { getAllArticles } from "../src/lib/content/articles";
import { getAllLocalGuides } from "../src/lib/content/local";
import { getTools, type Tool } from "../src/lib/tools/registry";
import { buildReport, finishAudit, writeJsonReport, type Finding } from "./lib/audit-helpers";

/** Abaixo disso, a ferramenta está publicada mas praticamente escondida. */
const MIN_ENTRY_POINTS = 4;
/** Termos acionados a partir dos quais a ausência da ferramenta vira aviso. */
const MIN_TRIGGERS_TO_SUGGEST = 2;

const findings: Finding[] = [];
const tools = getTools();
const toolsById = new Map(tools.map((t) => [t.id, t]));

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Rotas de ferramenta citadas no texto, em markdown ou em <ToolCallout>. */
function referencedTools(body: string): Set<string> {
  const found = new Set<string>();
  for (const tool of tools) {
    if (body.includes(tool.route)) found.add(tool.id);
  }
  for (const match of body.matchAll(/<ToolCallout\s+id="([a-z0-9-]+)"/g)) {
    found.add(match[1]!);
  }
  return found;
}

/** Termos da ferramenta presentes no texto normalizado. */
function triggeredTerms(tool: Tool, normalized: string): string[] {
  return tool.triggerTerms.filter((term) => normalized.includes(normalize(term)));
}

/* ------------------------------------------------------------------ *
 * 1. Links para ferramenta inexistente
 * ------------------------------------------------------------------ */

const knownRoutes = new Set(tools.map((t) => t.route));

interface Page {
  label: string;
  urlPath: string;
  body: string;
  published: boolean;
}

const pages: Page[] = [
  ...getAllArticles().map((a) => ({
    label: a.frontmatter.slug,
    urlPath: a.urlPath,
    body: a.content,
    published: a.frontmatter.status === "published",
  })),
  ...getAllLocalGuides().map((g) => ({
    label: g.fileName,
    urlPath: g.urlPath,
    body: g.content,
    published: g.frontmatter.status === "published",
  })),
];

for (const page of pages) {
  for (const match of page.body.matchAll(/\/calculadoras\/[a-z0-9-]*\//g)) {
    if (!knownRoutes.has(match[0])) {
      findings.push({
        severity: "critical",
        rule: "link-para-ferramenta-inexistente",
        pages: [page.urlPath],
        detail: `Link para ${match[0]}, que não existe em data/tool-registry.json.`,
      });
    }
  }
  for (const match of page.body.matchAll(/<ToolCallout\s+id="([a-z0-9-]+)"/g)) {
    if (!toolsById.has(match[1]!)) {
      findings.push({
        severity: "critical",
        rule: "callout-de-ferramenta-inexistente",
        pages: [page.urlPath],
        detail: `<ToolCallout id="${match[1]}"> não corresponde a nenhuma ferramenta.`,
      });
    }
  }
}

/* ------------------------------------------------------------------ *
 * 2. Ferramenta ausente das superfícies obrigatórias
 * ------------------------------------------------------------------ */

const SURFACES = [
  { file: "src/app/calculadoras/page.tsx", name: "hub /calculadoras/" },
  { file: "src/components/layout/SiteFooter.tsx", name: "rodapé" },
  { file: "src/lib/search/build-docs.ts", name: "índice de busca" },
];

for (const surface of SURFACES) {
  const source = fs.readFileSync(path.join(process.cwd(), surface.file), "utf8");
  /*
   * Superfície gerada a partir do registry não pode ficar desatualizada, por
   * construção. O rodapé entrou nesse grupo: ele já listou as doze
   * ferramentas à mão, e essa coluna de vinte itens era a maior fonte de
   * poluição visual do site. Hoje mostra a seleção `inFooter` e aponta para o
   * hub — por isso a exigência mudou de "lista todas" para "leva a todas",
   * checada logo abaixo.
   */
  if (source.includes("@/lib/tools/registry")) continue;
  for (const tool of tools) {
    if (!source.includes(tool.route)) {
      findings.push({
        severity: "critical",
        rule: "ferramenta-fora-de-superficie-obrigatoria",
        pages: [surface.file],
        detail: `"${tool.name}" (${tool.route}) não aparece no ${surface.name}.`,
      });
    }
  }
}

/* O rodapé precisa levar ao hub: é ele que garante o acesso às doze. */
const footerSource = fs.readFileSync(
  path.join(process.cwd(), "src/components/layout/SiteFooter.tsx"),
  "utf8",
);
if (!footerSource.includes('"/calculadoras/"')) {
  findings.push({
    severity: "critical",
    rule: "rodape-sem-link-para-o-hub",
    pages: ["src/components/layout/SiteFooter.tsx"],
    detail:
      "O rodapé mostra só a seleção de ferramentas e não aponta para /calculadoras/ — as demais ficariam inacessíveis a partir dele.",
  });
}
if (tools.filter((t) => t.inFooter).length === 0) {
  findings.push({
    severity: "warning",
    rule: "rodape-sem-ferramenta-em-destaque",
    pages: ["data/tool-registry.json"],
    detail: "Nenhuma ferramenta marcada com inFooter — a coluna do rodapé fica vazia.",
  });
}

/* ------------------------------------------------------------------ *
 * 3 e 4. Oportunidades semânticas
 * ------------------------------------------------------------------ */

const entryPoints = new Map<string, string[]>(tools.map((t) => [t.id, []]));

for (const page of pages) {
  if (!page.published) continue;
  const normalized = normalize(page.body);
  const referenced = referencedTools(page.body);

  for (const id of referenced) {
    entryPoints.get(id)?.push(page.urlPath);
  }

  const missed: string[] = [];
  for (const tool of tools) {
    if (referenced.has(tool.id)) continue;
    const hits = triggeredTerms(tool, normalized);
    if (hits.length >= MIN_TRIGGERS_TO_SUGGEST) {
      missed.push(`${tool.shortName} (${hits.slice(0, 3).join(", ")})`);
    }
  }

  if (referenced.size === 0 && missed.length > 0) {
    findings.push({
      severity: "warning",
      rule: "pagina-sem-nenhuma-ferramenta",
      pages: [page.urlPath],
      detail: `Nenhuma ferramenta oferecida. Candidatas pelo texto: ${missed.join("; ")}.`,
    });
  } else if (missed.length > 0) {
    findings.push({
      severity: "info",
      rule: "ferramenta-candidata-nao-oferecida",
      pages: [page.urlPath],
      detail: `Já oferece ${referenced.size} ferramenta(s). Também casam com o texto: ${missed.join("; ")}.`,
    });
  }
}

/* ------------------------------------------------------------------ *
 * 5. Ferramenta com poucas portas de entrada
 * ------------------------------------------------------------------ */

for (const tool of tools) {
  const entries = entryPoints.get(tool.id) ?? [];
  if (entries.length < MIN_ENTRY_POINTS) {
    findings.push({
      severity: "warning",
      rule: "ferramenta-com-poucas-portas-de-entrada",
      pages: [tool.route],
      detail: `Oferecida em ${entries.length} página(s) publicada(s); mínimo saudável é ${MIN_ENTRY_POINTS}.`,
    });
  }
}

const report = buildReport("cobertura-de-ferramentas", findings);
writeJsonReport("tool-coverage-report.json", report);
finishAudit(report);
