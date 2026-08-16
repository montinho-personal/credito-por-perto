import { normalizeSearchText } from "./normalize";

export interface HighlightSegment {
  text: string;
  match: boolean;
}

/**
 * Divide `text` em segmentos, marcando ocorrências dos tokens da consulta
 * de forma insensível a acentos e caixa (o texto original é preservado).
 */
export function highlightSegments(
  text: string,
  rawQuery: string,
): HighlightSegment[] {
  const tokens = normalizeSearchText(rawQuery)
    .split(" ")
    .filter((t) => t.length >= 2);
  if (tokens.length === 0) return [{ text, match: false }];

  // Normalização posicional: mapeia cada caractere normalizado à posição original.
  const chars = [...text];
  const normalizedChars: string[] = [];
  const positions: number[] = [];
  chars.forEach((char, i) => {
    const normalized = normalizeSearchText(char);
    const piece = normalized.length > 0 ? normalized : " ";
    for (const c of piece) {
      normalizedChars.push(c);
      positions.push(i);
    }
  });
  const normalizedText = normalizedChars.join("");

  const matched = new Array<boolean>(chars.length).fill(false);
  for (const token of tokens) {
    let from = 0;
    while (from <= normalizedText.length - token.length) {
      const at = normalizedText.indexOf(token, from);
      if (at === -1) break;
      for (let i = at; i < at + token.length; i++) {
        const original = positions[i];
        if (original !== undefined) matched[original] = true;
      }
      from = at + token.length;
    }
  }

  const segments: HighlightSegment[] = [];
  for (let i = 0; i < chars.length; i++) {
    const match = matched[i] ?? false;
    const last = segments[segments.length - 1];
    if (last && last.match === match) {
      last.text += chars[i];
    } else {
      segments.push({ text: chars[i] ?? "", match });
    }
  }
  return segments;
}
