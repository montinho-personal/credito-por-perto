import { describe, expect, it } from "vitest";
import { remarkFaqAccordion } from "../src/lib/content/remark-faq-accordion";
import { getAllArticles } from "../src/lib/content/articles";
import { getAllLocalGuides } from "../src/lib/content/local";
import { slugify } from "../src/lib/text/slug";

/* ========================================================================== *
 * Helpers — uma árvore mdast mínima, montada à mão
 * ========================================================================== */

type Node = {
  type: string;
  depth?: number;
  value?: string;
  children?: Node[];
  name?: string;
  attributes?: Array<{ type: string; name: string; value: string }>;
};

const h = (depth: number, text: string): Node => ({
  type: "heading",
  depth,
  children: [{ type: "text", value: text }],
});
const p = (text: string): Node => ({
  type: "paragraph",
  children: [{ type: "text", value: text }],
});

function transform(children: Node[]): Node[] {
  const tree = { type: "root" as const, children };
  /* O plugin devolve uma função que muta a árvore, como manda o contrato do
     remark — daí a chamada em duas etapas. */
  (remarkFaqAccordion() as (t: typeof tree) => void)(tree);
  return tree.children;
}

function findAccordion(nodes: Node[]): Node | undefined {
  return nodes.find((n) => n.type === "mdxJsxFlowElement" && n.name === "FaqAccordion");
}

function attr(node: Node, name: string): string | undefined {
  return node.attributes?.find((a) => a.name === name)?.value;
}

/* ========================================================================== *
 * Comportamento do plugin
 * ========================================================================== */

describe("remarkFaqAccordion", () => {
  it("agrupa cada pergunta com a resposta que vem abaixo dela", () => {
    const out = transform([
      h(2, "Um assunto qualquer"),
      p("Texto do corpo."),
      h(2, "Perguntas frequentes"),
      h(3, "Primeira pergunta?"),
      p("Resposta um."),
      p("Continuação da resposta um."),
      h(3, "Segunda pergunta?"),
      p("Resposta dois."),
    ]);

    const accordion = findAccordion(out);
    expect(accordion).toBeDefined();
    expect(accordion!.children).toHaveLength(2);

    const [first, second] = accordion!.children as Node[];
    expect(attr(first!, "question")).toBe("Primeira pergunta?");
    expect(first!.children).toHaveLength(2);
    expect(attr(second!, "question")).toBe("Segunda pergunta?");
    expect(second!.children).toHaveLength(1);
  });

  it("mantém o id que a pergunta já tinha como título", () => {
    const out = transform([h(2, "Perguntas frequentes"), h(3, "Existe Banco do Povo?"), p("Sim.")]);
    const item = (findAccordion(out)!.children as Node[])[0]!;
    /* Mesmo slug de antes: link publicado para a âncora continua funcionando. */
    expect(attr(item, "id")).toBe(slugify("Existe Banco do Povo?"));
  });

  it("não toca no que vem antes nem depois da seção", () => {
    const out = transform([
      h(2, "Antes"),
      p("Parágrafo de antes."),
      h(2, "Perguntas frequentes"),
      h(3, "Pergunta?"),
      p("Resposta."),
      h(2, "Depois"),
      p("Parágrafo de depois."),
    ]);

    expect(out[0]).toEqual(h(2, "Antes"));
    expect(out[1]).toEqual(p("Parágrafo de antes."));
    expect(out[out.length - 2]).toEqual(h(2, "Depois"));
    expect(out[out.length - 1]).toEqual(p("Parágrafo de depois."));
  });

  it("preserva texto de abertura que venha antes da primeira pergunta", () => {
    const out = transform([
      h(2, "Perguntas frequentes"),
      p("As dúvidas que mais chegam:"),
      h(3, "Pergunta?"),
      p("Resposta."),
    ]);
    /* A frase de abertura não é resposta de ninguém e fica fora do acordeão. */
    expect(out[1]).toEqual(p("As dúvidas que mais chegam:"));
    expect(findAccordion(out)!.children).toHaveLength(1);
  });

  it("ignora páginas sem seção de perguntas", () => {
    const input = [h(2, "Só conteúdo"), p("Sem FAQ aqui.")];
    expect(transform([...input])).toEqual(input);
  });

  it("não transforma seção de perguntas sem nenhum H3", () => {
    const input = [h(2, "Perguntas frequentes"), p("Texto solto, sem perguntas.")];
    expect(transform([...input])).toEqual(input);
  });

  it("reconhece o título com acento, caixa ou espaço diferentes", () => {
    for (const titulo of ["Perguntas Frequentes", "PERGUNTAS FREQUENTES", " perguntas frequentes "]) {
      const out = transform([h(2, titulo), h(3, "P?"), p("R.")]);
      expect(findAccordion(out), `título "${titulo}"`).toBeDefined();
    }
  });
});

/* ========================================================================== *
 * Cobertura real do corpus
 * ========================================================================== */

describe("cobertura das FAQs publicadas", () => {
  const docs = [
    ...getAllArticles().map((a) => ({ url: a.urlPath, body: a.content })),
    ...getAllLocalGuides().map((g) => ({ url: g.urlPath, body: g.content })),
  ];

  const comFaq = docs.filter((d) => /^## Perguntas frequentes\s*$/m.test(d.body));

  it("encontra a seção de FAQ nas páginas que a declaram", () => {
    expect(comFaq.length).toBeGreaterThanOrEqual(80);
  });

  it("toda página com FAQ tem pelo menos duas perguntas em H3", () => {
    for (const doc of comFaq) {
      const faq = doc.body.split(/^## Perguntas frequentes\s*$/m)[1] ?? "";
      const antesDaProximaSecao = faq.split(/^## /m)[0] ?? "";
      const perguntas = antesDaProximaSecao.match(/^### .+$/gm) ?? [];
      expect(perguntas.length, `${doc.url} tem ${perguntas.length} pergunta(s)`).toBeGreaterThanOrEqual(2);
    }
  });

  it("nenhuma pergunta gera id vazio ou duplicado na mesma página", () => {
    for (const doc of comFaq) {
      const faq = doc.body.split(/^## Perguntas frequentes\s*$/m)[1] ?? "";
      const antesDaProximaSecao = faq.split(/^## /m)[0] ?? "";
      const ids = (antesDaProximaSecao.match(/^### (.+)$/gm) ?? []).map((linha) =>
        slugify(linha.replace(/^### /, "").trim()),
      );
      for (const id of ids) expect(id.length, `${doc.url}`).toBeGreaterThan(0);
      expect(new Set(ids).size, `${doc.url} repete id de pergunta`).toBe(ids.length);
    }
  });
});
