import { describe, expect, it } from "vitest";
import { addYearsCivil, computeDebtExpiry, describeDays } from "../src/lib/calculators/debt-expiry";

describe("addYearsCivil (Código Civil, art. 132, § 3º)", () => {
  it("expira no dia de igual número", () => {
    expect(addYearsCivil("2021-03-11", 5)).toBe("2026-03-11");
  });
  it("29/02 sem correspondência vai para o dia imediato", () => {
    expect(addYearsCivil("2020-02-29", 5)).toBe("2025-03-01");
    expect(addYearsCivil("2020-02-29", 4)).toBe("2024-02-29");
  });
  it("31 de um mês curto não existe no ano final só se o mês mudar: 31/01 + 5 anos", () => {
    expect(addYearsCivil("2021-01-31", 5)).toBe("2026-01-31");
  });
});

describe("computeDebtExpiry", () => {
  it("cadastro conta do dia seguinte ao vencimento; prescrição, do vencimento", () => {
    const o = computeDebtExpiry({ dueIso: "2021-03-10", todayIso: "2026-10-26" });
    expect(o.kind).toBe("ok");
    if (o.kind !== "ok") return;
    expect(o.result.registryStartIso).toBe("2021-03-11");
    expect(o.result.registryEndIso).toBe("2026-03-11");
    expect(o.result.prescriptionEndIso).toBe("2026-03-10");
    expect(o.result.registryStatus.kind).toBe("passou");
    expect(o.result.prescriptionStatus.kind).toBe("passou");
  });

  it("dívida recente: prazos no futuro, com dias restantes", () => {
    const o = computeDebtExpiry({ dueIso: "2025-10-25", todayIso: "2026-10-26" });
    if (o.kind !== "ok") throw new Error("esperava ok");
    expect(o.result.registryEndIso).toBe("2030-10-26");
    expect(o.result.registryStatus).toEqual({ kind: "futuro", days: 1461 });
  });

  it("vencimento no último dia do ano: o dia seguinte já é o ano novo", () => {
    const o = computeDebtExpiry({ dueIso: "2022-12-31", todayIso: "2026-10-26" });
    if (o.kind !== "ok") throw new Error("esperava ok");
    expect(o.result.registryStartIso).toBe("2023-01-01");
    expect(o.result.registryEndIso).toBe("2028-01-01");
    expect(o.result.prescriptionEndIso).toBe("2027-12-31");
  });

  it("prazo que vence hoje", () => {
    const o = computeDebtExpiry({ dueIso: "2021-10-25", todayIso: "2026-10-26" });
    if (o.kind !== "ok") throw new Error("esperava ok");
    expect(o.result.registryStatus).toEqual({ kind: "hoje" });
  });

  it("recusa data inválida, futura ou antiga demais", () => {
    expect(computeDebtExpiry({ dueIso: "2026-02-30", todayIso: "2026-10-26" })).toEqual({ kind: "invalid", issue: "data-invalida" });
    expect(computeDebtExpiry({ dueIso: "2027-01-01", todayIso: "2026-10-26" })).toEqual({ kind: "invalid", issue: "vencimento-no-futuro" });
    expect(computeDebtExpiry({ dueIso: "1985-01-01", todayIso: "2026-10-26" })).toEqual({ kind: "invalid", issue: "vencimento-muito-antigo" });
  });
});

describe("describeDays", () => {
  it("lê dias, meses e anos aproximados", () => {
    expect(describeDays(1)).toBe("1 dia");
    expect(describeDays(20)).toBe("20 dias");
    expect(describeDays(400)).toBe("cerca de 1 ano e 1 mês");
    expect(describeDays(730)).toBe("cerca de 2 anos");
  });
});
