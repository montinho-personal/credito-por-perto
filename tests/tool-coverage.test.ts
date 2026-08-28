import { readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getTool,
  getToolRoutes,
  getTools,
  getToolSituations,
  getToolsBySituation,
} from "@/lib/tools/registry";
import { FOOTER_NAV } from "@/lib/site";
import { getAllArticles } from "@/lib/content/articles";
import { getAllLocalGuides } from "@/lib/content/local";

const read = (p: string) => readFileSync(resolvePath(process.cwd(), p), "utf8");

describe("registry de ferramentas", () => {
  const tools = getTools();

  it("tem ferramenta e nenhum id repetido", () => {
    expect(tools.length).toBeGreaterThan(0);
    expect(new Set(tools.map((t) => t.id)).size).toBe(tools.length);
  });

  it("toda rota é interna, absoluta e termina com barra", () => {
    for (const tool of tools) {
      expect(tool.route, tool.id).toMatch(/^\/[a-z0-9/-]*\/$/);
    }
  });

  it("nenhuma rota se repete", () => {
    const routes = getToolRoutes();
    expect(new Set(routes).size).toBe(routes.length);
  });

  it("toda ferramenta pertence a uma situação declarada", () => {
    const ids = new Set(getToolSituations().map((s) => s.id));
    for (const tool of tools) {
      expect(ids.has(tool.situation), `${tool.id} → ${tool.situation}`).toBe(true);
    }
  });

  it("o agrupamento cobre todas as ferramentas, sem perder nenhuma", () => {
    const grouped = getToolsBySituation().flatMap((g) => g.tools);
    expect(grouped).toHaveLength(tools.length);
  });

  it("a pergunta de cada ferramenta é escrita na voz do leitor", () => {
    for (const tool of tools) {
      expect(tool.question.length, tool.id).toBeGreaterThan(15);
      expect(tool.calloutLead.length, tool.id).toBeGreaterThan(30);
    }
  });

  it("nenhuma ferramenta promete resultado, indica instituição ou ranqueia", () => {
    const texto = JSON.stringify(tools).toLowerCase();
    for (const proibido of [
      "melhor opção",
      "as melhores",
      "ranking",
      "aprovação garantida",
      "recomendamos",
      "indicamos",
      "crédito aprovado",
    ]) {
      expect(texto).not.toContain(proibido);
    }
  });

  it("getTool devolve undefined para id inexistente, sem estourar", () => {
    expect(getTool("ferramenta-que-nao-existe")).toBeUndefined();
  });
});

describe("as superfícies obrigatórias listam todas as ferramentas", () => {
  const tools = getTools();

  it("o hub é gerado a partir do registry, não de uma lista paralela", () => {
    const hub = read("src/app/calculadoras/page.tsx");
    expect(hub).toContain("@/lib/tools/registry");
    /* Nenhuma rota escrita à mão: o hub não pode ter lista própria. */
    expect(hub).not.toMatch(/href="\/calculadoras\/[a-z-]+\//);
  });

  /*
   * O rodapé já listou as doze ferramentas à mão, e essa coluna de vinte
   * itens era a maior fonte de poluição visual do site. A exigência mudou de
   * "lista todas" para "leva a todas": ele mostra a seleção `inFooter`,
   * montada a partir do registry, e aponta para o hub.
   */
  it("o rodapé é montado a partir do registry, sem lista paralela", () => {
    const footer = read("src/components/layout/SiteFooter.tsx");
    expect(footer).toContain("@/lib/tools/registry");
    expect(footer).not.toMatch(/href="\/calculadoras\/[a-z-]+\//);
  });

  it("o rodapé leva ao hub, que dá acesso a todas as ferramentas", () => {
    expect(read("src/components/layout/SiteFooter.tsx")).toContain('"/calculadoras/"');
  });

  it("a seleção do rodapé existe e é enxuta o bastante para uma coluna", () => {
    const selecionadas = tools.filter((t) => t.inFooter);
    expect(selecionadas.length).toBeGreaterThanOrEqual(4);
    expect(selecionadas.length).toBeLessThanOrEqual(7);
  });

  it("nenhuma coluna do rodapé volta a virar parede de texto", () => {
    for (const [nome, links] of Object.entries(FOOTER_NAV)) {
      expect(links.length, `coluna "${nome}" com ${links.length} itens`).toBeLessThanOrEqual(7);
    }
  });

  it("o índice de busca cita todas as ferramentas", () => {
    const docs = read("src/lib/search/build-docs.ts");
    for (const tool of tools) {
      expect(docs, tool.id).toContain(tool.route);
    }
  });
});

describe("cobertura semântica nas páginas", () => {
  const routes = new Set(getToolRoutes());
  const ids = new Set(getTools().map((t) => t.id));
  const pages = [
    ...getAllArticles().map((a) => ({ label: a.frontmatter.slug, body: a.content })),
    ...getAllLocalGuides().map((g) => ({ label: g.fileName, body: g.content })),
  ];

  it("nenhuma página aponta para rota de ferramenta inexistente", () => {
    for (const page of pages) {
      for (const match of page.body.matchAll(/\/calculadoras\/[a-z0-9-]*\//g)) {
        expect(routes.has(match[0]), `${page.label} → ${match[0]}`).toBe(true);
      }
    }
  });

  it("todo <ToolCallout> referencia uma ferramenta que existe", () => {
    let total = 0;
    for (const page of pages) {
      for (const match of page.body.matchAll(/<ToolCallout\s+id="([a-z0-9-]+)"/g)) {
        total++;
        expect(ids.has(match[1]!), `${page.label} → ${match[1]}`).toBe(true);
      }
    }
    expect(total).toBeGreaterThan(20);
  });

  it("toda ferramenta tem porta de entrada em ao menos 4 páginas", () => {
    for (const tool of getTools()) {
      const count = pages.filter(
        (p) => p.body.includes(tool.route) || p.body.includes(`<ToolCallout id="${tool.id}"`),
      ).length;
      expect(count, `${tool.id} aparece em ${count} páginas`).toBeGreaterThanOrEqual(4);
    }
  });

  it("quase nenhum artigo publicado fica sem ferramenta alguma", () => {
    const semFerramenta = getAllArticles()
      .filter((a) => a.frontmatter.status === "published")
      .filter(
        (a) =>
          !a.content.includes("/calculadoras/") &&
          !a.content.includes("/taxas/") &&
          !a.content.includes("<ToolCallout"),
      )
      .map((a) => a.frontmatter.slug);
    /* Um ou outro artigo pode legitimamente não ter ferramenta que sirva —
       forçar link em todos produziria entulho. O que não pode é virar regra. */
    expect(semFerramenta.length, semFerramenta.join(", ")).toBeLessThanOrEqual(2);
  });
});
