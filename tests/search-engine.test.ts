import { beforeAll, describe, expect, it } from "vitest";
import { buildSearchDocs } from "@/lib/search/build-docs";
import { SearchEngine } from "@/lib/search/engine";
import { normalizeSearchText } from "@/lib/search/normalize";
import { expandQuery } from "@/lib/search/synonyms";

let engine: SearchEngine;

beforeAll(() => {
  engine = new SearchEngine(buildSearchDocs());
});

const firstUrl = (query: string) => engine.search(query)[0]?.doc.url;
const topUrls = (query: string, n = 5) =>
  engine.search(query, n).map((hit) => hit.doc.url);

describe("normalização", () => {
  it("iguala acentos, caixa e pontuação", () => {
    expect(normalizeSearchText("Empréstimo")).toBe("emprestimo");
    expect(normalizeSearchText("  EMPRESTIMO!  ")).toBe("emprestimo");
    expect(normalizeSearchText("Santana de Parnaíba")).toBe(
      "santana de parnaiba",
    );
  });
});

describe("sinônimos", () => {
  it("expande acrônimo e termo composto nos dois sentidos", () => {
    expect(expandQuery("cet")).toEqual(
      expect.arrayContaining(["custo", "efetivo", "total"]),
    );
    expect(expandQuery("custo efetivo total")).toEqual(
      expect.arrayContaining(["cet"]),
    );
  });

  it("não expande termos fora dos grupos", () => {
    expect(expandQuery("banco")).toEqual([]);
  });
});

describe("ranking — o resultado certo vem primeiro", () => {
  it("consignado → pilar do consignado no topo", () => {
    expect(firstUrl("consignado")).toBe("/emprestimos/emprestimo-consignado/");
  });

  it("cet → guia do CET no topo, acima de menções incidentais", () => {
    expect(firstUrl("cet")).toBe("/juros-e-cet/o-que-e-cet/");
  });

  it("custo efetivo total → conteúdo de CET no topo", () => {
    expect(topUrls("custo efetivo total", 3)).toContain(
      "/juros-e-cet/o-que-e-cet/",
    );
  });

  it("negativado → guia do negativado no topo", () => {
    expect(firstUrl("negativado")).toBe(
      "/emprestimos/emprestimo-para-negativado/",
    );
  });

  it("mei → guia de MEI no topo", () => {
    expect(firstUrl("mei")).toBe("/emprestimos/emprestimo-para-mei/");
  });

  it("portabilidade → guia de portabilidade no topo", () => {
    expect(firstUrl("portabilidade")).toBe(
      "/emprestimos/portabilidade-de-credito/",
    );
  });

  it("emprestimo pessoal (sem acento) → pilar de empréstimo pessoal no topo", () => {
    expect(firstUrl("emprestimo pessoal")).toBe(
      "/emprestimos/emprestimo-pessoal/",
    );
  });

  it("fgts → conteúdos de FGTS no topo", () => {
    const urls = topUrls("fgts", 3);
    expect(
      urls.some(
        (u) =>
          u.includes("saque-aniversario") || u.includes("fgts"),
      ),
    ).toBe(true);
  });

  it("golpe → cluster de segurança no topo", () => {
    expect(topUrls("golpe", 3).join()).toContain("/credito-seguro/");
  });

  it("rotativo → plano de saída do rotativo no topo", () => {
    expect(firstUrl("rotativo")).toBe(
      "/organizacao-financeira/como-sair-do-rotativo/",
    );
  });
});

describe("busca local", () => {
  it("santa isabel → guia local em primeiro", () => {
    expect(firstUrl("santa isabel")).toBe("/emprestimos/sp/santa-isabel/");
  });

  it("santa isabel sp → guia local em primeiro", () => {
    expect(firstUrl("santa isabel sp")).toBe("/emprestimos/sp/santa-isabel/");
  });

  it("santana parnaiba (sem 'de', sem acento) → guia local em primeiro", () => {
    expect(firstUrl("santana parnaiba")).toBe(
      "/emprestimos/sp/santana-de-parnaiba/",
    );
  });

  it("emprestimo santa isabel → guia local em primeiro", () => {
    expect(firstUrl("emprestimo santa isabel")).toBe(
      "/emprestimos/sp/santa-isabel/",
    );
  });

  it("credito carapicuiba → guia local em primeiro", () => {
    expect(firstUrl("credito carapicuiba")).toBe(
      "/emprestimos/sp/carapicuiba/",
    );
  });
});

describe("tolerância a erros (fuzzy)", () => {
  it("consigando → encontra consignado", () => {
    expect(topUrls("consigando", 5).join()).toContain("consignado");
  });

  it("portablidade → encontra portabilidade", () => {
    expect(topUrls("portablidade", 5).join()).toContain("portabilidade");
  });

  it("emprestmo → encontra empréstimos", () => {
    expect(engine.search("emprestmo").length).toBeGreaterThan(0);
  });
});

describe("qualidade do índice", () => {
  it("sem resultados para consulta sem sentido", () => {
    expect(engine.search("zxqwvzzk")).toHaveLength(0);
  });

  it("consulta de 1 caractere não busca", () => {
    expect(engine.search("c")).toHaveLength(0);
  });

  it("documentos são únicos por URL", () => {
    const docs = buildSearchDocs();
    const ids = docs.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("páginas institucionais ficam fora do índice", () => {
    const docs = buildSearchDocs();
    const urls = docs.map((d) => d.url);
    expect(urls).not.toContain("/politica-de-privacidade/");
    expect(urls).not.toContain("/aviso-legal/");
  });

  it("calculadoras aparecem para 'calculadora'", () => {
    expect(topUrls("calculadora", 4).join()).toContain("/calculadoras/");
  });
});
