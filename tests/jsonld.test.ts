import { describe, expect, it } from "vitest";
import { localGuideJsonLd } from "@/lib/schema/jsonld";
import { getAllLocalGuides } from "@/lib/content/local";
import { getAuthor } from "@/lib/content/authors";
import { getStateByCode } from "@/lib/local-seo/states";
import { SITE_URL } from "@/lib/site";

const publishedGuides = getAllLocalGuides().filter(
  (guide) => guide.frontmatter.status === "published",
);

function buildFor(guide: (typeof publishedGuides)[number]) {
  const state = getStateByCode(guide.frontmatter.stateCode);
  return localGuideJsonLd(
    guide,
    getAuthor(guide.frontmatter.authorId),
    state?.name,
  );
}

describe("localGuideJsonLd", () => {
  it("há guias publicados para testar", () => {
    expect(publishedGuides.length).toBeGreaterThan(0);
  });

  it("todo guia publicado declara datePublished e dateModified", () => {
    // A data é o diferencial editorial destas páginas: endereço e horário de
    // repartição pública envelhecem. Um guia publicado sem dateModified sai da
    // busca sem o sinal que o distingue das listas raspadas.
    const semData = publishedGuides
      .map((guide) => ({ guide, data: buildFor(guide) }))
      .filter(({ data }) => !data.datePublished || !data.dateModified)
      .map(({ guide }) => guide.fileName);

    expect(semData).toEqual([]);
  });

  it("usa a canônica da própria página como mainEntityOfPage", () => {
    for (const guide of publishedGuides) {
      expect(buildFor(guide).mainEntityOfPage).toBe(guide.canonical);
    }
  });

  it("declara a cidade em spatialCoverage, dentro da UF", () => {
    const guide = publishedGuides.find(
      (g) => g.frontmatter.localityType === "municipality",
    );
    expect(guide).toBeDefined();

    const data = buildFor(guide!);
    expect(data.spatialCoverage).toMatchObject({
      "@type": "Place",
      name: guide!.frontmatter.localityName,
      containedInPlace: { "@type": "AdministrativeArea" },
    });
  });

  it("credita autor e editor do portal", () => {
    const data = buildFor(publishedGuides[0]!);
    expect(data.author).toBeDefined();
    expect(data.publisher).toEqual({ "@id": `${SITE_URL}/#organization` });
  });

  it("nunca se declara estabelecimento nem atribui nota", () => {
    // O portal é editorial e não atende no balcão: LocalBusiness ou
    // FinancialService seria afirmar o que a página não é. AggregateRating
    // seria inventar avaliação que ninguém deu.
    const proibidos = ["LocalBusiness", "FinancialService", "AggregateRating"];
    for (const guide of publishedGuides) {
      const serializado = JSON.stringify(buildFor(guide));
      for (const tipo of proibidos) {
        expect(serializado).not.toContain(tipo);
      }
    }
  });
});
