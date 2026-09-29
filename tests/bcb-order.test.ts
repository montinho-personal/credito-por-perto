import { describe, expect, it } from "vitest";
import { sortRatePoints, validateSeriesPayload } from "@/lib/bcb/rates-service";
import { validateRadarPayload } from "@/lib/bcb/radar-service";
import { parseHousingRows } from "@/lib/bcb/housing-rate";
import { getSeries } from "@/lib/bcb/series-registry";

/**
 * O SGS pode devolver as linhas do mês mais recente para o mais antigo
 * (aconteceu em setembro de 2026). A leitura precisa dar o mesmo resultado
 * nas duas ordens.
 */
const months = ["2025-06", "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07"];
const values = [6.31, 6.15, 6.12, 5.99, 6, 6.44, 6.65, 6.71, 6.47, 6.67, 6.99, 6.74, 7.07, 6.42];
const ascending = months.map((m, i) => ({ data: `01/${m.slice(5)}/${m.slice(0, 4)}`, valor: String(values[i]).replace(".", ",") }));
const descending = [...ascending].reverse();
const series = getSeries("pessoal-nao-consignado")!;

describe("ordem das linhas do SGS", () => {
  it("taxa média: o mais recente é julho de 2026 nas duas ordens", () => {
    for (const rows of [ascending, descending]) {
      const points = validateSeriesPayload(series, rows)!;
      expect(points[points.length - 1]).toEqual({ refMonth: "2026-07", value: 6.42 });
      expect(points[0]!.refMonth).toBe("2025-06");
      expect(points.map((p) => p.refMonth)).toEqual(months);
    }
  });

  it("radar: último e penúltimo corretos com linhas invertidas", () => {
    const points = validateRadarPayload(series, descending)!;
    expect(points.at(-1)!.refMonth).toBe("2026-07");
    expect(points.at(-2)!.refMonth).toBe("2026-06");
  });

  it("mês repetido fica uma vez só", () => {
    const sorted = sortRatePoints([
      { refMonth: "2026-07", value: 6.4 },
      { refMonth: "2026-06", value: 7.07 },
      { refMonth: "2026-07", value: 6.42 },
    ]);
    expect(sorted).toEqual([
      { refMonth: "2026-06", value: 7.07 },
      { refMonth: "2026-07", value: 6.42 },
    ]);
  });

  it("financiamento imobiliário: usa a linha de data mais recente", () => {
    const rows = [
      { data: "01/07/2026", valor: "11,5" },
      { data: "01/06/2026", valor: "11,4" },
      { data: "01/05/2026", valor: "11,3" },
    ];
    const now = new Date(Date.UTC(2026, 8, 29));
    expect(parseHousingRows(rows, now)!.refMonth).toBe("2026-07");
    expect(parseHousingRows([...rows].reverse(), now)!.refMonth).toBe("2026-07");
  });
});
