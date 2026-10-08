import { describe, expect, it } from "vitest";
import { CATEGORIES, type CategoryId } from "@/lib/content/categories";
import { getPublishedByCategory } from "@/lib/content/articles";
import { HUB_GROUPS, groupForHub } from "@/lib/content/hub-groups";

describe("blocos dos hubs", () => {
  for (const id of Object.keys(CATEGORIES) as CategoryId[]) {
    const articles = getPublishedByCategory(id);
    const published = new Set(articles.map((a) => a.frontmatter.slug));

    it(`${id}: todo guia publicado aparece uma vez só`, () => {
      const shown = groupForHub(id, articles).flatMap((g) => g.items.map((a) => a.frontmatter.slug));
      expect(shown.sort()).toEqual([...published].sort());
    });

    it(`${id}: nenhum slug listado fica sem guia publicado, nem repetido`, () => {
      const listed = HUB_GROUPS[id].flatMap((g) => g.slugs);
      expect(listed.filter((s) => !published.has(s))).toEqual([]);
      expect(new Set(listed).size).toBe(listed.length);
    });

    it(`${id}: hoje nenhum guia cai em "Outros guias"`, () => {
      expect(groupForHub(id, articles).some((g) => g.id === "outros-guias")).toBe(false);
    });
  }
});
