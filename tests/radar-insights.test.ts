import { describe, expect, it } from "vitest";
import {
  buildMovementSentence,
  buildYearSentence,
  computeRadarStats,
  formatPP,
  formatRate,
  monthsBack,
} from "@/lib/bcb/radar-insights";
import { validateRadarPayload } from "@/lib/bcb/radar-service";
import type { RatePoint } from "@/lib/bcb/rates-service";
import { BCB_SERIES_REGISTRY, getSeries } from "@/lib/bcb/series-registry";

function series(months: Array<[string, number]>): RatePoint[] {
  return months.map(([refMonth, value]) => ({ refMonth, value }));
}

/** 25 meses terminando em 2026-07, com valores controlados. */
function longSeries(): RatePoint[] {
  const points: RatePoint[] = [];
  for (let i = 24; i >= 0; i -= 1) {
    const ref = monthsBack("2026-07", i);
    points.push({ refMonth: ref, value: 3 + i * 0.01 });
  }
  return points.map((p, idx, arr) =>
    idx === arr.length - 1 ? { ...p, value: 3.21 } : idx === arr.length - 2 ? { ...p, value: 3.08 } : p,
  );
}

describe("estatísticas do Radar", () => {
  it("último dado, mês anterior e diferença em p.p. calculada do valor bruto", () => {
    const stats = computeRadarStats(longSeries())!;
    expect(stats.latest.refMonth).toBe("2026-07");
    expect(stats.latest.value).toBe(3.21);
    expect(stats.previous!.value).toBe(3.08);
    expect(stats.diffPrevPP).toBeCloseTo(0.13, 10);
    expect(stats.movement).toBe("up");
  });

  it("12 meses atrás usa o mês EXATO da série", () => {
    const stats = computeRadarStats(longSeries())!;
    expect(stats.ago12!.refMonth).toBe("2025-07");
    expect(stats.diff12PP).toBeCloseTo(3.21 - (3 + 12 * 0.01), 10);
  });

  it("buraco na série: sem o mês exato, comparação de 12 meses não aparece (sem interpolação)", () => {
    const points = longSeries().filter((p) => p.refMonth !== "2025-07");
    const stats = computeRadarStats(points)!;
    expect(stats.ago12).toBeNull();
    expect(stats.diff12PP).toBeNull();
    expect(buildYearSentence(stats)).toBeNull();
  });

  it("movimento: caiu e não mudou", () => {
    const down = computeRadarStats(series([["2026-06", 3.2], ["2026-07", 3.1]]))!;
    expect(down.movement).toBe("down");
    const same = computeRadarStats(series([["2026-06", 3.2], ["2026-07", 3.2]]))!;
    expect(same.movement).toBe("same");
  });

  it("série de um ponto: sem anterior, sem movimento — sem quebrar", () => {
    const stats = computeRadarStats(series([["2026-07", 3.21]]))!;
    expect(stats.previous).toBeNull();
    expect(stats.movement).toBeNull();
    expect(buildMovementSentence(stats)).toContain("Último dado disponível: 3,21%");
  });

  it("monthsBack cruza o ano corretamente", () => {
    expect(monthsBack("2026-07", 12)).toBe("2025-07");
    expect(monthsBack("2026-01", 1)).toBe("2025-12");
    expect(monthsBack("2026-03", 24)).toBe("2024-03");
  });
});

describe("frases determinísticas", () => {
  it("alta com número exato, sem causa e sem 'tendência'", () => {
    const stats = computeRadarStats(longSeries())!;
    const sentence = buildMovementSentence(stats);
    expect(sentence).toBe(
      "A taxa média passou de 3,08% para 3,21% ao mês no dado de julho de 2026 — alta de 0,13 ponto percentual.",
    );
    expect(sentence).not.toMatch(/tendência|Copom|governo|porque/i);
  });

  it("frase de 12 meses", () => {
    const stats = computeRadarStats(
      series([["2025-07", 3.55], ["2026-06", 3.08], ["2026-07", 3.21]]),
    )!;
    expect(buildYearSentence(stats)).toBe(
      "Há 12 meses (julho de 2025), a taxa era de 3,55% ao mês — diferença de −0,34 p.p.",
    );
  });

  it("formatação: p.p. com sinal e taxa pt-BR", () => {
    expect(formatPP(0.13)).toBe("+0,13");
    expect(formatPP(-0.34)).toBe("−0,34");
    expect(formatPP(0)).toBe("0,00");
    expect(formatRate(3.2)).toBe("3,20%");
  });
});

describe("validação do payload do Radar", () => {
  const pessoal = getSeries("pessoal-nao-consignado")!;

  function rows(values: Array<[string, string]>) {
    return values.map(([data, valor]) => ({ data, valor }));
  }

  it("payload saudável passa (datas dd/MM/yyyy, vírgula decimal)", () => {
    const points = validateRadarPayload(pessoal, rows([
      ["01/06/2026", "3,08"],
      ["01/07/2026", "3,21"],
    ]))!;
    expect(points).toHaveLength(2);
    expect(points[1]!.refMonth).toBe("2026-07");
    expect(points[1]!.value).toBe(3.21);
  });

  it("payload vazio, não numérico ou com data inválida é rejeitado", () => {
    expect(validateRadarPayload(pessoal, [])).toBeNull();
    expect(validateRadarPayload(pessoal, rows([["01/07/2026", "abc"]]))).toBeNull();
    expect(validateRadarPayload(pessoal, rows([["2026-07-01", "3,2"]]))).toBeNull();
  });

  it("último valor fora da faixa de sanidade é rejeitado", () => {
    expect(validateRadarPayload(pessoal, rows([["01/07/2026", "99"]]))).toBeNull();
    expect(validateRadarPayload(pessoal, rows([["01/07/2026", "0"]]))).toBeNull();
  });

  it("anomalia extrema dentro da faixa de sanidade é retida para revisão, não publicada", () => {
    const rotativo = getSeries("cartao-rotativo")!; // sanidade 5–40% a.m.
    // 6% → 35%: dentro da sanidade, mas fator ~5,8x → anomalia extrema retida
    expect(
      validateRadarPayload(rotativo, rows([["01/06/2026", "6,0"], ["01/07/2026", "35,0"]])),
    ).toBeNull();
    // queda extrema também: 35% → 6% (fator < 1/5)
    expect(
      validateRadarPayload(rotativo, rows([["01/06/2026", "35,0"], ["01/07/2026", "6,0"]])),
    ).toBeNull();
    // variação normal passa
    expect(
      validateRadarPayload(rotativo, rows([["01/06/2026", "15,8"], ["01/07/2026", "16,1"]])),
    ).not.toBeNull();
  });
});

describe("registro de séries do Radar", () => {
  it("todas as séries são % a.m., mensais e da mesma família metodológica", () => {
    for (const s of BCB_SERIES_REGISTRY) {
      expect(s.unit).toBe("% a.m.");
      expect(s.periodicity).toBe("mensal");
      expect(s.methodology).toContain("ponderada pelo valor das concessões");
      expect(s.sourceUrl).toContain("dadosabertos.bcb.gov.br");
      expect(s.monthlySeries).toBeGreaterThan(0);
    }
  });

  it("rotativo (SGS 25477) está no registro após confirmação na fonte", () => {
    const rotativo = getSeries("cartao-rotativo")!;
    expect(rotativo.monthlySeries).toBe(25477);
    expect(rotativo.officialName).toContain("Cartão de crédito rotativo");
  });

  it("9 modalidades ativas, sem códigos duplicados", () => {
    expect(BCB_SERIES_REGISTRY).toHaveLength(9);
    const codes = BCB_SERIES_REGISTRY.map((s) => s.monthlySeries);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
