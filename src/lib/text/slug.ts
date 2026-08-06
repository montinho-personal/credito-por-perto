/** Gera slugs em português claro, sem acentos, minúsculos, com hífens. */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Extrai headings H2/H3 de um corpo markdown para montar o índice do artigo. */
export interface Heading {
  depth: 2 | 3;
  text: string;
  id: string;
}

export function extractHeadings(markdown: string): Heading[] {
  const headings: Heading[] = [];
  const lines = markdown.split("\n");
  let inCodeBlock = false;
  for (const line of lines) {
    if (line.trimStart().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;
    const match = /^(#{2,3})\s+(.+)$/.exec(line.trim());
    if (match) {
      const depth = match[1]!.length as 2 | 3;
      const text = match[2]!.replace(/\{#.*\}$/, "").trim();
      headings.push({ depth, text, id: slugify(text) });
    }
  }
  return headings;
}
