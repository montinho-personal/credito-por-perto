import { describe, expect, it } from "vitest";
import { queryForAnalytics, searchTools } from "@/components/tools/ToolFinder";
import { getToolSearchEntries } from "@/lib/tools/registry";

/*
 * Os "testes de usuário" do briefing da central, com as consultas que uma
 * pessoa leiga digitaria. O primeiro resultado precisa ser a ferramenta que
 * resolve a dúvida.
 */
const entries = getToolSearchEntries();
const first = (q: string) => searchTools(entries, q)[0]?.id;
const ids = (q: string) => searchTools(entries, q).map((e) => e.id);

describe("busca da central: quem sabe o que procura", () => {
  it("nomes de ferramenta", () => {
    expect(first("calculadora de empréstimo")).toBe("emprestimo");
    expect(first("financiamento de veículo")).toBe("financiamento-veiculo");
    expect(first("financiamento imobiliário")).toBe("financiamento-imobiliario");
    expect(first("CET")).toBe("cet");
    expect(first("SAC ou Price")).toBe("sac-x-price");
    expect(first("IOF empréstimo")).toBe("iof-emprestimo");
    expect(first("conversor de taxas")).toBe("conversor-de-taxas");
    expect(first("margem consignável")).toBe("margem-consignavel");
  });
});

describe("busca da central: quem descreve a dúvida", () => {
  it("pessoa 1: quero financiar um carro de 80 mil", () => {
    expect(first("quanto fica um carro de 80 mil")).toBe("financiamento-veiculo");
  });
  it("pessoa 2: apartamento de 500 mil", () => {
    expect(first("casa 500 mil")).toBe("financiamento-imobiliario");
    expect(first("apartamento de 500 mil")).toBe("financiamento-imobiliario");
  });
  it("pessoa 3: recebi uma proposta e não sei se está cara", () => {
    expect(ids("taxa está cara").slice(0, 3)).toContain("minha-taxa-esta-cara");
    expect(first("estou pagando juros demais")).toBe("minha-taxa-esta-cara");
  });
  it("pessoa 4: não sabe o que é CET", () => {
    expect(first("quanto realmente estou pagando")).toBe("cet");
    expect(first("quanto esse empréstimo custa de verdade")).toBe("cet");
  });
  it("pessoa 5: tenho quatro dívidas", () => {
    expect(first("tenho várias dívidas")).toBe("plano-para-sair-das-dividas");
    expect(first("qual dívida pagar primeiro")).toBe("plano-para-sair-das-dividas");
  });
  it("pessoa 6: pediram pix antes de liberar", () => {
    expect(first("pediram pix antes de liberar empréstimo")).toBe("sinais-de-golpe");
    expect(first("banco é verdadeiro")).toBe("consultar-instituicao");
  });
  it("pessoa 7: 3% ao mês dá quanto ao ano", () => {
    expect(first("3% ao mês")).toBe("conversor-de-taxas");
    expect(first("3% ao mês dá quanto ao ano")).toBe("conversor-de-taxas");
    expect(first("taxa aa para am")).toBe("conversor-de-taxas");
  });
  it("outras dúvidas leigas", () => {
    expect(first("essa parcela cabe")).toBe("parcela-no-orcamento");
    expect(first("quitar dívida")).toBe("quitacao-antecipada");
    expect(first("financiamento de 300 mil")).toBe("financiamento-imobiliario");
    expect(first("parcela de carro")).toBe("financiamento-veiculo");
    expect(first("saldo devedor")).toBe("quitacao-antecipada");
    expect(first("paguei o mínimo do cartão")).toBe("juros-cartao-credito");
    expect(first("com parcela de 2000 quanto consigo financiar")).toBe("quanto-consigo-financiar");
  });
  it("erro de digitação e acento não atrapalham", () => {
    expect(first("emprestimo")).toBe("emprestimo");
    expect(first("financiament")).toMatch(/financiamento/);
  });
  it("consulta sem sentido: nenhum resultado, sem erro", () => {
    expect(searchTools(entries, "xyzw qqq")).toEqual([]);
    expect(searchTools(entries, "a")).toEqual([]);
  });
});

describe("a consulta que vai para a medição", () => {
  it("sai normalizada, sem número e curta", () => {
    expect(queryForAnalytics("Casa 500 mil")).toBe("casa mil");
    expect(queryForAnalytics("R$ 15.000 em 24x")).toBe("r em x");
    expect(queryForAnalytics("CET")).toBe("cet");
    expect(queryForAnalytics("12")).toBeNull();
    expect(queryForAnalytics("a".repeat(80))!.length).toBe(40);
  });
});
