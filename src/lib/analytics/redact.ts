/**
 * REDAÇÃO DE PARÂMETROS ANTES DE SAIR DO NAVEGADOR
 * ============================================================================
 *
 * Este arquivo é a fronteira. Tudo que vira evento passa por aqui, e o que
 * passa por aqui não pode carregar dinheiro, taxa, documento nem texto
 * digitado pela pessoa.
 *
 * POR QUE UM REDATOR, SE A REGRA JÁ ERA "NÃO ENVIE VALOR"
 *
 * Porque a regra dependia de alguém lembrar dela em cada linha nova. Com
 * rastreamento por delegação, o rótulo do clique passa a ser lido do DOM — e
 * o DOM de uma ferramenta contém resultado calculado. Um botão que hoje diz
 * "Copiar resumo" pode amanhã dizer "Copiar resumo (R$ 1.240,00)", e ninguém
 * pensaria em analytics ao fazer essa mudança de copy.
 *
 * Então a proteção não é a intenção do próximo desenvolvedor: é este arquivo,
 * com teste, no caminho de todo evento.
 *
 * O QUE É REMOVIDO, E POR QUÊ NÃO É "TODO NÚMERO"
 *
 * Apagar todo dígito destruiria rótulo legítimo e útil: "151 do Procon",
 * "13º salário", "Lei 14.181". O corte é por FORMA, não por presença de
 * número — moeda, percentual, CPF/CNPJ, telefone e sequência longa. Assim o
 * relatório continua legível e o vazamento continua impossível.
 */

/** Marca que substitui trecho redigido. Curta, para não estourar o limite. */
const MASK = "#";

/**
 * Padrões que nunca podem sair. A ordem importa: o mais específico primeiro,
 * senão o genérico come parte do específico e deixa resto reconhecível.
 */
const PATTERNS: Array<[RegExp, string]> = [
  /* CPF (000.000.000-00) e CNPJ (00.000.000/0000-00), com ou sem máscara. */
  [/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, MASK],
  [/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, MASK],
  /* Telefone brasileiro com DDD, com ou sem separadores. */
  [/\(?\b\d{2}\)?[\s-]?9?\d{4}[\s-]?\d{4}\b/g, MASK],
  /* Moeda: "R$ 1.240,00", "R$1240", "1.240,00 reais". */
  [/R\$\s*[\d.,]+/gi, MASK],
  [/\b[\d.]+,\d{2}\s*(reais|real)\b/gi, MASK],
  /* Percentual: "12,5%", "2.9 %", "12% a.m.". */
  [/\b\d+([.,]\d+)?\s*%/g, MASK],
  /* Sequência longa de dígitos (conta, contrato, proposta). */
  [/\b\d{5,}\b/g, MASK],
  /* Decimal solto com vírgula — no Brasil quase sempre é dinheiro ou taxa. */
  [/\b\d+,\d+\b/g, MASK],
];

/** Limite do GA4 para valor de parâmetro é 100; 60 mantém o relatório legível. */
export const MAX_LABEL_LENGTH = 60;

/**
 * Limpa um texto que virará valor de parâmetro.
 *
 * Determinística e sem efeito colateral: mesma entrada, mesma saída. É o que
 * permite testá-la sem navegador.
 */
export function redactText(input: string): string {
  let out = input.replace(/\s+/g, " ").trim();
  for (const [pattern, mask] of PATTERNS) out = out.replace(pattern, mask);
  /* Máscaras vizinhas viram uma só: "# #" não diz mais que "#". */
  out = out.replace(/(?:#[\s\-–—/]*)+#/g, MASK).replace(/\s+/g, " ").trim();
  if (out.length > MAX_LABEL_LENGTH) {
    out = `${out.slice(0, MAX_LABEL_LENGTH - 1).trimEnd()}…`;
  }
  return out;
}

/**
 * Nomes de parâmetro proibidos. Não é filtro de valor: é recusa de INTENÇÃO.
 * Quem escreve `{ renda: ... }` está tentando enviar renda, e o redator de
 * texto não salvaria porque o valor pode chegar já formatado sem símbolo.
 */
const FORBIDDEN_KEYS =
  /^(valor|value|renda|salario|salário|saldo|divida|dívida|parcela|taxa|juros|cet|montante|preco|preço|cpf|cnpj|nome|email|e_mail|telefone|celular|instituicao|instituição|banco|prazo|score|limite)$/i;

export function isForbiddenParamKey(key: string): boolean {
  return FORBIDDEN_KEYS.test(key);
}

/** Só estes tipos viajam. Objeto aninhado esconde carga; array idem. */
export type ParamValue = string | number | boolean;

export interface RedactResult {
  params: Record<string, ParamValue>;
  /** Chaves recusadas — a auditoria e o modo de depuração mostram ao autor. */
  dropped: string[];
}

/**
 * Aplica as duas defesas a um conjunto de parâmetros: recusa a chave proibida
 * e redige o texto do que passa.
 */
export function redactParams(
  input: Record<string, unknown> | undefined,
): RedactResult {
  const params: Record<string, ParamValue> = {};
  const dropped: string[] = [];
  if (!input) return { params, dropped };

  for (const [key, raw] of Object.entries(input)) {
    if (raw === undefined || raw === null) continue;
    if (isForbiddenParamKey(key)) {
      dropped.push(key);
      continue;
    }
    if (typeof raw === "number") {
      /* Número puro só passa se for contagem pequena — posição, quantidade,
         índice. Qualquer coisa maior é candidata a ser dinheiro disfarçado. */
      if (Number.isFinite(raw) && Number.isInteger(raw) && raw >= 0 && raw <= 1000) {
        params[key] = raw;
      } else {
        dropped.push(key);
      }
      continue;
    }
    if (typeof raw === "boolean") {
      params[key] = raw;
      continue;
    }
    if (typeof raw === "string") {
      const clean = redactText(raw);
      if (clean.length > 0) params[key] = clean;
      continue;
    }
    /* Objeto, array, função: fora. */
    dropped.push(key);
  }

  return { params, dropped };
}
