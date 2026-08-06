import { describe, expect, it } from "vitest";
import { canonicalUrl, isValidCanonical } from "@/lib/seo/canonical";
import { SITE_URL } from "@/lib/site";

describe("canonicalUrl", () => {
  it("gera URL absoluta, https, com www e trailing slash", () => {
    expect(canonicalUrl("/emprestimos/emprestimo-pessoal/")).toBe(
      `${SITE_URL}/emprestimos/emprestimo-pessoal/`,
    );
  });

  it("adiciona trailing slash quando ausente", () => {
    expect(canonicalUrl("/sobre")).toBe(`${SITE_URL}/sobre/`);
  });

  it("normaliza caminho sem barra inicial", () => {
    expect(canonicalUrl("glossario/")).toBe(`${SITE_URL}/glossario/`);
  });

  it("remove parâmetros e fragmentos", () => {
    expect(canonicalUrl("/busca/?q=cet#resultado")).toBe(`${SITE_URL}/busca/`);
  });

  it("rejeita URL completa como entrada", () => {
    expect(() => canonicalUrl("https://outro.com/pagina/")).toThrow();
  });
});

describe("isValidCanonical", () => {
  it("aceita canônicas da política", () => {
    expect(isValidCanonical(`${SITE_URL}/`)).toBe(true);
    expect(isValidCanonical(`${SITE_URL}/emprestimos/sp/campinas/`)).toBe(true);
  });

  it("rejeita http, sem www, sem trailing slash, com query ou domínio externo", () => {
    expect(isValidCanonical("http://www.creditoporperto.com.br/x/")).toBe(false);
    expect(isValidCanonical("https://creditoporperto.com.br/x/")).toBe(false);
    expect(isValidCanonical(`${SITE_URL}/pagina`)).toBe(false);
    expect(isValidCanonical(`${SITE_URL}/pagina/?utm=1`)).toBe(false);
    expect(isValidCanonical("https://www.exemplo.com/pagina/")).toBe(false);
  });
});
