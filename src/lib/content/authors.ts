import fs from "node:fs";
import path from "node:path";
import { authorSchema, type Author } from "@/lib/validation/frontmatter";
import { AUTHORS_DIR } from "@/lib/content/paths";

let cache: Author[] | null = null;

export function getAllAuthors(): Author[] {
  if (cache) return cache;
  if (!fs.existsSync(AUTHORS_DIR)) return [];
  cache = fs
    .readdirSync(AUTHORS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => {
      const data = JSON.parse(
        fs.readFileSync(path.join(AUTHORS_DIR, f), "utf8"),
      ) as unknown;
      const parsed = authorSchema.safeParse(data);
      if (!parsed.success) {
        throw new Error(`Autor inválido em ${f}: ${parsed.error.message}`);
      }
      return parsed.data;
    });
  return cache;
}

export function getAuthor(id: string): Author | undefined {
  return getAllAuthors().find((a) => a.id === id);
}
