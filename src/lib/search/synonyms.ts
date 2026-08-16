import { normalizeSearchText } from "./normalize";

/**
 * Grupos de sinônimos controlados. Cada grupo relaciona termos que o leitor
 * usa de forma intercambiável. Manter os grupos ESTREITOS: sinônimo amplo
 * demais degrada o ranking (regra: na dúvida, não adicionar).
 *
 * Termos compostos são permitidos — a expansão adiciona cada palavra do
 * sinônimo à consulta com peso reduzido.
 */
const SYNONYM_GROUPS: string[][] = [
  ["emprestimo", "credito"],
  ["negativado", "nome sujo", "nome restrito", "restricao", "restricao no cpf", "score baixo"],
  ["cet", "custo efetivo total"],
  // "emprestimo consignado" já casa por token; sinônimo com palavra genérica
  // ("emprestimo"/"credito") puxaria o site inteiro — manter estreito.
  ["consignado", "desconto em folha"],
  ["inss", "aposentado", "pensionista", "beneficio"],
  ["fgts", "saque aniversario", "antecipacao fgts", "fundo de garantia"],
  ["golpe", "golpes", "fraude", "emprestimo falso", "deposito antecipado"],
  ["mei", "microempreendedor individual", "cnpj"],
  ["juros", "taxa", "taxa de juros"],
  ["clt", "carteira assinada", "trabalhador", "credito do trabalhador"],
  ["rotativo", "fatura minima", "minimo do cartao"],
  ["rmc", "reserva de margem"],
  ["margem", "margem consignavel"],
  ["portabilidade", "transferir divida", "portar contrato"],
  ["servidor", "servidor publico", "funcionario publico"],
  ["renegociacao", "renegociar", "acordo", "divida"],
  ["parcela", "prestacao"],
  ["calculadora", "simulador", "simular", "calcular"],
];

/** Índice termo normalizado → demais termos do grupo. */
const SYNONYM_INDEX = new Map<string, string[]>();
for (const group of SYNONYM_GROUPS) {
  for (const term of group) {
    const key = normalizeSearchText(term);
    const others = group
      .map((t) => normalizeSearchText(t))
      .filter((t) => t !== key);
    SYNONYM_INDEX.set(key, [...(SYNONYM_INDEX.get(key) ?? []), ...others]);
  }
}

/**
 * Expande a consulta com sinônimos diretos. Retorna termos extras (planos,
 * já normalizados) para somar à busca com peso menor que o texto digitado.
 * Olha tokens individuais e bigramas ("custo efetivo total" → "cet").
 */
export function expandQuery(normalizedQuery: string): string[] {
  const tokens = normalizedQuery.split(" ").filter(Boolean);
  const extras = new Set<string>();

  const addGroup = (key: string) => {
    for (const synonym of SYNONYM_INDEX.get(key) ?? []) {
      for (const word of synonym.split(" ")) extras.add(word);
    }
  };

  for (const token of tokens) addGroup(token);
  for (let i = 0; i < tokens.length - 1; i++) {
    addGroup(`${tokens[i]} ${tokens[i + 1]}`);
    if (i < tokens.length - 2) {
      addGroup(`${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`);
    }
  }

  for (const token of tokens) extras.delete(token);
  return [...extras];
}
