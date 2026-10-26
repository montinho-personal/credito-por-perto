import { describe, expect, it } from "vitest";
import { checkFgtsHome, installmentCover, MAX_PROPERTY_VALUE_CENTS } from "../src/lib/calculators/fgts-home";

const okPurchase = {
  goal: "comprar" as const,
  threeYears: "sim" as const,
  activeSfh: "nao" as const,
  propertyInRegion: "nao" as const,
  purpose: "residencial-urbano" as const,
  ownHome: "sim" as const,
  propertyValueCents: 400_000_00,
  boughtWithFgtsRecently: "nao" as const,
};

describe("checkFgtsHome — compra", () => {
  it("todas as respostas dentro da regra: atende, sem 'aprovado'", () => {
    const r = checkFgtsHome(okPurchase);
    expect(r.summary).toBe("atende");
    expect(r.checks.every((c) => c.state === "atende")).toBe(true);
    expect(JSON.stringify(r).toLowerCase()).not.toContain("aprovad");
  });

  it("imóvel na região decide 'não atende' e explica", () => {
    const r = checkFgtsHome({ ...okPurchase, propertyInRegion: "sim" });
    expect(r.summary).toBe("nao-atende");
    expect(r.checks.find((c) => c.id === "imovel-na-regiao")?.state).toBe("nao-atende");
  });

  it("menos de 3 anos ou SFH ativo: não atende", () => {
    expect(checkFgtsHome({ ...okPurchase, threeYears: "nao" }).summary).toBe("nao-atende");
    expect(checkFgtsHome({ ...okPurchase, activeSfh: "sim" }).summary).toBe("nao-atende");
  });

  it("finalidades vedadas pela Caixa", () => {
    for (const purpose of ["comercial", "rural", "reforma", "terreno", "material", "para-outra-pessoa"] as const) {
      expect(checkFgtsHome({ ...okPurchase, purpose }).summary, purpose).toBe("nao-atende");
    }
  });

  it("teto de avaliação: igual ao limite atende, acima não atende, vazio pede confirmação", () => {
    expect(checkFgtsHome({ ...okPurchase, propertyValueCents: MAX_PROPERTY_VALUE_CENTS }).summary).toBe("atende");
    expect(checkFgtsHome({ ...okPurchase, propertyValueCents: MAX_PROPERTY_VALUE_CENTS + 1 }).summary).toBe("nao-atende");
    expect(checkFgtsHome({ ...okPurchase, propertyValueCents: null }).summary).toBe("confirmar");
  });

  it("'não sei' vira 'falta confirmar', nunca 'não atende'", () => {
    const r = checkFgtsHome({ ...okPurchase, threeYears: "nao-sei" });
    expect(r.summary).toBe("confirmar");
  });
});

describe("checkFgtsHome — amortizar e prestação", () => {
  it("amortizar: contrato elegível e 2 anos desde o último uso", () => {
    expect(checkFgtsHome({ goal: "amortizar", contractEligible: "sim", usedForAmortizationRecently: "nao" }).summary).toBe("atende");
    expect(checkFgtsHome({ goal: "amortizar", contractEligible: "sim", usedForAmortizationRecently: "sim" }).summary).toBe("nao-atende");
  });

  it("prestação: contrato elegível e 3 anos de FGTS", () => {
    expect(checkFgtsHome({ goal: "prestacao", contractEligible: "sim", threeYears: "sim" }).summary).toBe("atende");
    expect(checkFgtsHome({ goal: "prestacao", contractEligible: "sim", threeYears: "nao" }).summary).toBe("nao-atende");
    expect(checkFgtsHome({ goal: "prestacao" }).summary).toBe("confirmar");
  });
});

describe("installmentCover — até 80% por 12 meses", () => {
  it("prestação de R$ 2.000: até R$ 1.600 por mês, R$ 19.200 em 12 meses", () => {
    const c = installmentCover(2_000_00, 10_000_00);
    expect(c).toEqual({ monthlyCents: 1_600_00, twelveMonthsCents: 19_200_00, monthsCovered: 6 });
  });
  it("saldo grande cobre no máximo 12 meses por pedido", () => {
    expect(installmentCover(2_000_00, 100_000_00)?.monthsCovered).toBe(12);
  });
  it("sem saldo informado, só o teto; prestação inválida devolve null", () => {
    expect(installmentCover(1_000_00, null)?.monthsCovered).toBe(0);
    expect(installmentCover(0, null)).toBeNull();
  });
});
