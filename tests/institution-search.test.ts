import { describe, expect, it } from "vitest";
import {
  buildSearchIndex,
  formatCnpj,
  isValidCnpj,
  looksLikeCnpj,
  normalizeCnpjInput,
  normalizeName,
  searchInstitutions,
  type InstitutionRecord,
} from "@/lib/institutions/search";
import {
  parseInstitutionRow,
  validateResourcePayload,
} from "@/lib/bcb/institutions-service";

/* CNPJs de teste com dígitos verificadores calculados pelo algoritmo oficial. */
const VALID_CNPJ = "11444777000161"; // exemplo clássico de DV válido
const VALID_CNPJ_2 = "11222333000181";

function record(partial: Partial<InstitutionRecord> & { name: string }): InstitutionRecord {
  return {
    id: partial.id ?? partial.name,
    name: partial.name,
    shortName: partial.shortName,
    cnpjDigits: partial.cnpjDigits ?? null,
    type: partial.type ?? null,
    uf: partial.uf ?? null,
    municipio: partial.municipio ?? null,
    situacao: partial.situacao ?? null,
    sourceLabel: partial.sourceLabel ?? "Teste",
  };
}

const RECORDS: InstitutionRecord[] = [
  record({ name: "ABC Crédito Financeiro S.A.", cnpjDigits: VALID_CNPJ }),
  record({ name: "ABC Sociedade de Crédito Direto S.A.", cnpjDigits: VALID_CNPJ_2 }),
  record({ name: "Banco Exemplar S.A.", shortName: "Exemplar", cnpjDigits: "12345678000195" }),
  record({ name: "Financeira Ômega Ltda", cnpjDigits: "99887766000155" }),
  record({ name: "Cooperativa de Crédito Raiz", cnpjDigits: "11223344" }),
];

const INDEX = buildSearchIndex(RECORDS);

describe("validação de CNPJ", () => {
  it("aceita CNPJ com dígitos verificadores corretos, com e sem máscara (casos A/B)", () => {
    expect(isValidCnpj("11.444.777/0001-61")).toBe(true);
    expect(isValidCnpj("11444777000161")).toBe(true);
  });

  it("rejeita dígitos verificadores errados e sequências repetidas (caso C)", () => {
    expect(isValidCnpj("11444777000162")).toBe(false);
    expect(isValidCnpj("00000000000000")).toBe(false);
    expect(isValidCnpj("123")).toBe(false);
  });

  it("normaliza máscara e formata de volta", () => {
    expect(normalizeCnpjInput("11.444.777/0001-61")).toBe("11444777000161");
    expect(formatCnpj("11444777000161")).toBe("11.444.777/0001-61");
  });

  it("detecta intenção de CNPJ vs nome", () => {
    expect(looksLikeCnpj("11.444.777/0001-61")).toBe(true);
    expect(looksLikeCnpj("11444777")).toBe(true);
    expect(looksLikeCnpj("Banco Exemplar")).toBe(false);
    expect(looksLikeCnpj("Fin Credito Alfa")).toBe(false);
  });
});

describe("normalização de nome", () => {
  it("remove acentos, pontuação e normaliza S.A. (caso G)", () => {
    expect(normalizeName("Financeira Ômega Ltda")).toBe("financeira omega ltda");
    expect(normalizeName("Banco Exemplar S.A.")).toBe("banco exemplar sa");
    expect(normalizeName("Banco  Exemplar   S/A")).toBe("banco exemplar sa");
  });
});

describe("busca por CNPJ", () => {
  it("caso A/B: CNPJ exato encontra a instituição, com ou sem máscara", () => {
    for (const q of [VALID_CNPJ, "11.444.777/0001-61"]) {
      const out = searchInstitutions(INDEX, q);
      expect(out.mode).toBe("cnpj");
      expect(out.matches).toHaveLength(1);
      expect(out.matches[0]!.record.name).toBe("ABC Crédito Financeiro S.A.");
      expect(out.matches[0]!.quality).toBe("exact");
    }
  });

  it("caso D: CNPJ válido não cadastrado retorna vazio (nunca acusação)", () => {
    const out = searchInstitutions(INDEX, "04252011000110");
    expect(out.mode).toBe("cnpj");
    expect(out.matches).toHaveLength(0);
  });

  it("raiz de CNPJ na base casa como 'strong', nunca 'exact'", () => {
    const out = searchInstitutions(INDEX, "11223344000199");
    expect(out.matches).toHaveLength(1);
    expect(out.matches[0]!.record.name).toBe("Cooperativa de Crédito Raiz");
    expect(out.matches[0]!.quality).toBe("strong");
  });
});

describe("busca por nome", () => {
  it("caso E: razão social completa é correspondência exata", () => {
    const out = searchInstitutions(INDEX, "Banco Exemplar S.A.");
    expect(out.mode).toBe("name");
    expect(out.matches[0]!.record.name).toBe("Banco Exemplar S.A.");
    expect(out.matches[0]!.quality).toBe("exact");
  });

  it("caso F: nome parcial encontra sem afirmar identidade", () => {
    const out = searchInstitutions(INDEX, "Exemplar");
    expect(out.matches.length).toBeGreaterThan(0);
    expect(out.matches[0]!.record.name).toBe("Banco Exemplar S.A.");
    expect(out.matches[0]!.quality).not.toBe("exact");
  });

  it("caso G: busca sem acento encontra nome acentuado", () => {
    const out = searchInstitutions(INDEX, "financeira omega");
    expect(out.matches[0]!.record.name).toBe("Financeira Ômega Ltda");
  });

  it("caso H: nomes parecidos retornam múltiplos resultados para o usuário escolher", () => {
    const out = searchInstitutions(INDEX, "ABC Credito");
    expect(out.matches.length).toBeGreaterThanOrEqual(2);
    const names = out.matches.map((m) => m.record.name);
    expect(names).toContain("ABC Crédito Financeiro S.A.");
    expect(names).toContain("ABC Sociedade de Crédito Direto S.A.");
    // nenhum dos dois pode ser marcado como exato — o usuário seleciona
    expect(out.matches.every((m) => m.quality !== "exact")).toBe(true);
  });

  it("caso M: nome sem relação retorna vazio", () => {
    const out = searchInstitutions(INDEX, "Mercearia do Zé");
    expect(out.matches).toHaveLength(0);
  });
});

describe("parser da base oficial (tolerância e sanidade)", () => {
  it("mapeia variações de nome de campo", () => {
    const a = parseInstitutionRow(
      { NOME_INSTITUICAO: "Banco Teste S.A.", CNPJ: "11444777000161", SEGMENTO: "Banco Múltiplo", UF: "SP" },
      "Fonte A",
      0,
    );
    expect(a?.name).toBe("Banco Teste S.A.");
    expect(a?.cnpjDigits).toBe("11444777000161");
    expect(a?.type).toBe("Banco Múltiplo");

    const b = parseInstitutionRow(
      { NomeInstituicao: "Financeira Teste", NrCnpj: "11.444.777/0001-61", Sigla: "FinTeste" },
      "Fonte B",
      1,
    );
    expect(b?.name).toBe("Financeira Teste");
    expect(b?.cnpjDigits).toBe("11444777000161");
    expect(b?.shortName).toBe("FinTeste");
  });

  it("aceita CNPJ raiz de 8 dígitos com zeros à esquerda", () => {
    const row = parseInstitutionRow({ NOME: "Coop Teste", CNPJ: "1223344" }, "F", 0);
    expect(row?.cnpjDigits).toBe("01223344");
  });

  it("descarta linha sem nome", () => {
    expect(parseInstitutionRow({ CNPJ: "11444777000161" }, "F", 0)).toBeNull();
  });

  it("proteção contra dado corrompido: payload abaixo do piso é rejeitado", () => {
    const rows = Array.from({ length: 7 }, (_, i) => ({
      NOME_INSTITUICAO: `Inst ${i}`,
      CNPJ: "11444777000161",
    }));
    expect(validateResourcePayload(rows, "F", 50)).toBeNull();
  });

  it("schema drift: campos irreconhecíveis derrubam a validação em vez de publicar lixo", () => {
    const rows = Array.from({ length: 60 }, (_, i) => ({ XPTO: i, FOO: "bar" }));
    expect(validateResourcePayload(rows, "F", 50)).toBeNull();
  });

  it("payload saudável passa e preserva os campos", () => {
    const rows = Array.from({ length: 60 }, (_, i) => ({
      NOME_INSTITUICAO: `Instituição ${i}`,
      CNPJ: "11444777000161",
      SEGMENTO: "SCFI",
    }));
    const parsed = validateResourcePayload(rows, "Fonte", 50);
    expect(parsed).not.toBeNull();
    expect(parsed).toHaveLength(60);
    expect(parsed![0]!.sourceLabel).toBe("Fonte");
  });
});
