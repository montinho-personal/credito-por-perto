/**
 * Normalização de texto para busca: minúsculas, sem acentos, sem pontuação,
 * espaços colapsados. "Empréstimo", "emprestimo" e "EMPRESTIMO" viram o
 * mesmo termo.
 */
export function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Tokeniza já normalizado. */
export function tokenize(text: string): string[] {
  const normalized = normalizeSearchText(text);
  return normalized.length > 0 ? normalized.split(" ") : [];
}
