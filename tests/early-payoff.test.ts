import { describe, expect, it } from "vitest";
import {
  computeEarlyPayoff,
  type EarlyPayoffInput,
} from "@/lib/calculators/early-payoff";

function input(partial: Partial<EarlyPayoffInput> = {}): EarlyPayoffInput {
  return {
    payoffBalanceCents: 1_210_000,
    remainingInstallments: 18,
    installmentCents: 85_000,
    installmentsEqual: "yes",
    informedFutureTotalCents: null,
    ...partial,
  };
}

describe("casos obrigatórios", () => {
  it("caso A: 18 × R$850 vs saldo R$12.100 → futuro 15.300, diferença 3.200 (≈20,92%)", () => {
    const r = computeEarlyPayoff(input());
    expect(r.futureTotalCents).toBe(1_530_000);
    expect(r.futureTotalSource).toBe("fixed-installments");
    expect(r.differenceCents).toBe(320_000);
    expect(r.differencePercent).toBeCloseTo(20.915, 2);
    const text = r.sentences.join(" ");
    expect(text).toContain("quitar hoje exigiria R$ 12.100,00 em vez de R$ 15.300,00");
    expect(text).toContain("diferença de aproximadamente R$ 3.200,00");
  });

  it("caso B: saldo igual à soma → diferença zero, sem acusação", () => {
    const r = computeEarlyPayoff(input({ payoffBalanceCents: 1_530_000 }));
    expect(r.differenceCents).toBe(0);
    expect(r.sentences.join(" ")).toContain("custaria o mesmo");
    expect(r.sentences.join(" ")).not.toMatch(/errado|banco est/i);
  });

  it("caso C: saldo maior que a soma → pedir revisão, sem assumir fraude", () => {
    const r = computeEarlyPayoff(input({ payoffBalanceCents: 1_600_000 }));
    expect(r.differenceCents).toBe(-70_000);
    expect(r.warnings).toContain("payoff-exceeds-future");
    const text = r.sentences.join(" ");
    expect(text).toContain("Confira se os campos foram preenchidos corretamente");
    expect(text).not.toMatch(/fraude|golpe/i);
  });

  it("caso D: parcelas variáveis sem soma informada → sem multiplicação simplista", () => {
    const r = computeEarlyPayoff(input({ installmentsEqual: "no" }));
    expect(r.futureTotalCents).toBeNull();
    expect(r.differenceCents).toBeNull();
    expect(r.warnings).toContain("variable-without-total");
    expect(r.sentences.join(" ")).toContain("não pode ser calculada multiplicando");
  });

  it("caso E: usuário informa a soma diretamente → usar o dado", () => {
    const r = computeEarlyPayoff(
      input({ installmentsEqual: "no", informedFutureTotalCents: 1_480_000 }),
    );
    expect(r.futureTotalCents).toBe(1_480_000);
    expect(r.futureTotalSource).toBe("informed");
    expect(r.differenceCents).toBe(270_000);
  });

  it("caso L: centavos exatos", () => {
    const r = computeEarlyPayoff(
      input({ installmentCents: 85_337, remainingInstallments: 7, payoffBalanceCents: 500_001 }),
    );
    expect(r.futureTotalCents).toBe(597_359);
    expect(r.differenceCents).toBe(97_358);
  });

  it("caso M: valores altos permanecem exatos", () => {
    const r = computeEarlyPayoff(
      input({
        installmentCents: 2_500_000_00,
        remainingInstallments: 120,
        payoffBalanceCents: 200_000_000_00,
      }),
    );
    expect(r.futureTotalCents).toBe(2_500_000_00 * 120);
    expect(r.differenceCents).toBe(2_500_000_00 * 120 - 200_000_000_00);
  });

  it("caso N: 1 parcela restante", () => {
    const r = computeEarlyPayoff(
      input({ remainingInstallments: 1, installmentCents: 85_000, payoffBalanceCents: 84_000 }),
    );
    expect(r.futureTotalCents).toBe(85_000);
    expect(r.differenceCents).toBe(1_000);
  });

  it("caso O: 120 parcelas restantes", () => {
    const r = computeEarlyPayoff(input({ remainingInstallments: 120 }));
    expect(r.futureTotalCents).toBe(85_000 * 120);
  });

  it("diferença extremamente grande pede conferência de digitação", () => {
    const r = computeEarlyPayoff(input({ payoffBalanceCents: 100_000 }));
    expect(r.differencePercent).toBeGreaterThan(60);
    expect(r.warnings).toContain("very-large-difference");
  });
});

describe("linguagem: nem 'juros economizados', nem 'desconto do banco', nem recomendação", () => {
  it("frases nunca prometem juros exatos, desconto promocional ou decisão", () => {
    const scenarios = [
      computeEarlyPayoff(input()),
      computeEarlyPayoff(input({ payoffBalanceCents: 1_530_000 })),
      computeEarlyPayoff(input({ installmentsEqual: "no" })),
    ];
    for (const r of scenarios) {
      const text = r.sentences.join(" ");
      expect(text).not.toMatch(/juros economizados|desconto do banco|desconto promocional garantido/i);
      expect(text).not.toMatch(/quite agora|use sua reserva|vale a pena quitar|recomendamos/i);
    }
  });

  it("a explicação da diferença é hedgeada (pode refletir juros e outros acréscimos)", () => {
    const r = computeEarlyPayoff(input());
    expect(r.sentences.join(" ")).toContain(
      "pode refletir principalmente juros e outros acréscimos",
    );
    expect(r.sentences.join(" ")).toContain("não é necessariamente um desconto promocional");
  });
});
