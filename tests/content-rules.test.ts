import { describe, expect, it } from "vitest";
import { getAllArticles, getPublishedArticles } from "@/lib/content/articles";
import {
  getAllLocalGuides,
  getLocalDossier,
  isLocalGuideIndexable,
} from "@/lib/content/local";
import { getAllAuthors, getAuthor } from "@/lib/content/authors";
import { getBriefing, getSourceLedger } from "@/lib/content/ledgers";
import { getSitemapEntries } from "@/lib/seo/sitemap-entries";
import { isValidCanonical } from "@/lib/seo/canonical";
import { SITE_URL } from "@/lib/site";

const today = new Date().toISOString().slice(0, 10);

describe("artigos", () => {
  it("todo frontmatter valida no schema (loader lança em caso de erro)", () => {
    expect(() => getAllArticles()).not.toThrow();
    expect(getAllArticles().length).toBeGreaterThan(0);
  });

  it("todo artigo publicado tem briefing de originalidade", () => {
    for (const article of getPublishedArticles()) {
      expect(
        getBriefing(article.frontmatter.slug),
        `briefing ausente: ${article.frontmatter.slug}`,
      ).toBeDefined();
    }
  });

  it("todo artigo publicado tem registro de fontes com claims", () => {
    for (const article of getPublishedArticles()) {
      const ledger = getSourceLedger(article.frontmatter.slug);
      expect(ledger, `ledger ausente: ${article.frontmatter.slug}`).toBeDefined();
      expect(ledger!.claims.length).toBeGreaterThan(0);
    }
  });

  it("autores existem e não há revisor especializado inventado", () => {
    for (const article of getAllArticles()) {
      expect(getAuthor(article.frontmatter.authorId)).toBeDefined();
      if (article.frontmatter.reviewerId) {
        expect(getAuthor(article.frontmatter.reviewerId)).toBeDefined();
      }
    }
    for (const author of getAllAuthors()) {
      // Identificação honesta: equipe coletiva declarada como isTeam
      if (author.id === "equipe-editorial") {
        expect(author.isTeam).toBe(true);
      }
    }
  });

  it("nenhuma data futura acidental", () => {
    for (const article of getAllArticles()) {
      const fm = article.frontmatter;
      for (const value of [fm.publishedAt, fm.updatedAt, fm.sourceCheckedAt]) {
        if (value) expect(value <= today).toBe(true);
      }
    }
  });

  it("títulos, slugs e descrições são únicos", () => {
    const articles = getAllArticles();
    const titles = new Set(articles.map((a) => a.frontmatter.title));
    const slugs = new Set(articles.map((a) => a.urlPath));
    const descriptions = new Set(articles.map((a) => a.frontmatter.description));
    expect(titles.size).toBe(articles.length);
    expect(slugs.size).toBe(articles.length);
    expect(descriptions.size).toBe(articles.length);
  });
});

describe("sitemap", () => {
  it("contém apenas URLs canônicas válidas", () => {
    for (const entry of getSitemapEntries()) {
      expect(isValidCanonical(entry.url), `inválida: ${entry.url}`).toBe(true);
    }
  });

  it("não contém rascunhos nem páginas noindex", () => {
    const urls = new Set(getSitemapEntries().map((e) => e.url));
    for (const article of getAllArticles()) {
      if (article.frontmatter.status !== "published" || article.frontmatter.noindex) {
        expect(urls.has(article.canonical)).toBe(false);
      }
    }
    for (const guide of getAllLocalGuides()) {
      if (!isLocalGuideIndexable(guide)) {
        expect(urls.has(guide.canonical)).toBe(false);
      }
    }
    expect(urls.has(`${SITE_URL}/busca/`)).toBe(false);
  });

  it("contém todos os artigos publicados", () => {
    const urls = new Set(getSitemapEntries().map((e) => e.url));
    for (const article of getPublishedArticles()) {
      if (!article.frontmatter.noindex) {
        expect(urls.has(article.canonical)).toBe(true);
      }
    }
  });
});

describe("páginas locais", () => {
  it("guia local não indexável nunca aparece como publicado sem dossiê e verificação", () => {
    for (const guide of getAllLocalGuides()) {
      const fm = guide.frontmatter;
      if (fm.status === "published") {
        expect(fm.dossierId).toBeDefined();
        expect(fm.lastVerifiedAt).toBeDefined();
        const dossier = getLocalDossier(fm.dossierId!);
        expect(dossier).toBeDefined();
        expect(dossier!.officialSources.length).toBeGreaterThan(0);
      } else {
        // Rascunhos locais sempre noindex
        expect(fm.noindex).toBe(true);
      }
    }
  });

  it("nenhuma página local tem canonical para a home ou página genérica", () => {
    for (const guide of getAllLocalGuides()) {
      expect(guide.canonical).not.toBe(`${SITE_URL}/`);
      expect(guide.canonical).not.toBe(`${SITE_URL}/emprestimos/`);
      expect(guide.canonical).toBe(`${SITE_URL}${guide.urlPath}`);
    }
  });

  it("região multi-município declara os municípios envolvidos", () => {
    for (const guide of getAllLocalGuides()) {
      if (guide.frontmatter.localityType === "region") {
        expect(guide.frontmatter.municipalitiesInvolved?.length).toBeGreaterThan(0);
      }
    }
  });
});
