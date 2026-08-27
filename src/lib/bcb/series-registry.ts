/**
 * Registro central das séries do SGS (Sistema Gerenciador de Séries
 * Temporais) do Banco Central usadas pela ferramenta "Minha taxa está cara?".
 *
 * REGRAS DESTE REGISTRO
 * - Só entra modalidade cujo código foi CONFIRMADO no Portal de Dados
 *   Abertos do BC (dadosabertos.bcb.gov.br), com verificação em 27/08/2026.
 * - Todas as séries listadas são "taxa média MENSAL de juros das operações
 *   de crédito com recursos livres — pessoas físicas" (% a.m.), da mesma
 *   família metodológica: taxa média das NOVAS operações contratadas no
 *   período, PONDERADA pelo valor das concessões. Nunca misturar com séries
 *   de outra metodologia ou unidade.
 * - A comparação da ferramenta acontece sempre em % a.m. (a unidade das
 *   séries); taxa anual do usuário é convertida para a equivalente mensal
 *   composta antes de comparar, com a fórmula documentada na metodologia.
 *
 * EXCLUÍDAS (e por quê):
 * - Cartão de crédito TOTAL (SGS 25479): mistura rotativo e parcelado;
 *   menos útil para a pergunta do usuário do que o parcelado isolado.
 * - Financiamento imobiliário: recursos DIRECIONADOS, outra família
 *   metodológica.
 * - Crédito p/ composição de dívidas (SGS 25465): nicho; avaliar na V2.
 */

export interface BcbSeries {
  /** id interno estável (usado em analytics de forma genérica) */
  internalId: string;
  /** Nome amigável mostrado ao usuário */
  displayName: string;
  /** Nome oficial da série no SGS/Dados Abertos */
  officialName: string;
  /** Código SGS da série mensal (% a.m.) */
  monthlySeries: number;
  unit: "% a.m.";
  periodicity: "mensal";
  methodology: string;
  /** Página oficial do conjunto de dados, para o botão "ver no BC" */
  sourceUrl: string;
  /** Guia interno relacionado à modalidade */
  relatedGuidePath?: string;
  /** Faixa de sanidade para validar o dado recebido (em % a.m.) */
  sanity: { min: number; max: number };
}

const METHODOLOGY =
  "Taxa média das novas operações de crédito com recursos livres contratadas no mês de referência, ponderada pelo valor das concessões (pessoas físicas).";

export const BCB_SERIES_REGISTRY: readonly BcbSeries[] = [
  {
    internalId: "pessoal-nao-consignado",
    displayName: "Empréstimo pessoal (não consignado)",
    officialName:
      "Taxa média mensal de juros — Pessoas físicas — Crédito pessoal não consignado",
    monthlySeries: 25464,
    unit: "% a.m.",
    periodicity: "mensal",
    methodology: METHODOLOGY,
    sourceUrl:
      "https://dadosabertos.bcb.gov.br/dataset/25464-taxa-media-mensal-de-juros-das-operacoes-de-credito-com-recursos-livres---pessoas-fisicas---c",
    relatedGuidePath: "/emprestimos/emprestimo-pessoal/",
    sanity: { min: 1, max: 25 },
  },
  {
    internalId: "consignado-total",
    displayName: "Consignado (não sei qual tipo)",
    officialName:
      "Taxa média mensal de juros — Pessoas físicas — Crédito pessoal consignado total",
    monthlySeries: 25469,
    unit: "% a.m.",
    periodicity: "mensal",
    methodology: METHODOLOGY,
    sourceUrl:
      "https://dadosabertos.bcb.gov.br/dataset/25469-taxa-media-mensal-de-juros-das-operacoes-de-credito-com-recursos-livres---pessoas-fisicas---c",
    relatedGuidePath: "/emprestimos/emprestimo-consignado/",
    sanity: { min: 0.5, max: 6 },
  },
  {
    internalId: "consignado-inss",
    displayName: "Consignado INSS (aposentados e pensionistas)",
    officialName:
      "Taxa média mensal de juros — Pessoas físicas — Crédito pessoal consignado para aposentados e pensionistas do INSS",
    monthlySeries: 25468,
    unit: "% a.m.",
    periodicity: "mensal",
    methodology: METHODOLOGY,
    sourceUrl:
      "https://dadosabertos.bcb.gov.br/dataset/25468-taxa-media-mensal-de-juros-das-operacoes-de-credito-com-recursos-livres---pessoas-fisicas---c",
    relatedGuidePath: "/emprestimos/emprestimo-para-aposentado-inss/",
    sanity: { min: 0.5, max: 4 },
  },
  {
    internalId: "consignado-privado",
    displayName: "Consignado CLT (setor privado)",
    officialName:
      "Taxa média mensal de juros — Pessoas físicas — Crédito pessoal consignado para trabalhadores do setor privado",
    monthlySeries: 25466,
    unit: "% a.m.",
    periodicity: "mensal",
    methodology: METHODOLOGY,
    sourceUrl:
      "https://dadosabertos.bcb.gov.br/dataset/25466-taxa-media-mensal-de-juros-das-operacoes-de-credito-com-recursos-livres---pessoas-fisicas---c",
    relatedGuidePath: "/emprestimos/credito-do-trabalhador/",
    sanity: { min: 0.5, max: 8 },
  },
  {
    internalId: "consignado-publico",
    displayName: "Consignado servidor público",
    officialName:
      "Taxa média mensal de juros — Pessoas físicas — Crédito pessoal consignado para trabalhadores do setor público",
    monthlySeries: 25467,
    unit: "% a.m.",
    periodicity: "mensal",
    methodology: METHODOLOGY,
    sourceUrl:
      "https://dadosabertos.bcb.gov.br/dataset/25467-taxa-media-mensal-de-juros-das-operacoes-de-credito-com-recursos-livres---pessoas-fisicas---c",
    relatedGuidePath: "/emprestimos/consignado-servidor-publico/",
    sanity: { min: 0.5, max: 5 },
  },
  {
    internalId: "cheque-especial",
    displayName: "Cheque especial",
    officialName:
      "Taxa média mensal de juros — Pessoas físicas — Cheque especial",
    monthlySeries: 25463,
    unit: "% a.m.",
    periodicity: "mensal",
    methodology: METHODOLOGY,
    sourceUrl:
      "https://dadosabertos.bcb.gov.br/dataset/25463-taxa-media-mensal-de-juros-das-operacoes-de-credito-com-recursos-livres---pessoas-fisicas---c",
    relatedGuidePath: "/juros-e-cet/juros-do-cheque-especial/",
    sanity: { min: 2, max: 15 },
  },
  {
    internalId: "cartao-parcelado",
    displayName: "Cartão de crédito parcelado (com juros)",
    officialName:
      "Taxa média mensal de juros — Pessoas físicas — Cartão de crédito parcelado",
    monthlySeries: 25478,
    unit: "% a.m.",
    periodicity: "mensal",
    methodology: METHODOLOGY,
    sourceUrl:
      "https://dadosabertos.bcb.gov.br/dataset/25478-taxa-media-mensal-de-juros-das-operacoes-de-credito-com-recursos-livres---pessoas-fisicas---c",
    relatedGuidePath: "/organizacao-financeira/como-sair-do-rotativo/",
    sanity: { min: 2, max: 25 },
  },
  {
    internalId: "cartao-rotativo",
    displayName: "Cartão de crédito rotativo",
    officialName:
      "Taxa média mensal de juros — Pessoas físicas — Cartão de crédito rotativo",
    monthlySeries: 25477,
    unit: "% a.m.",
    periodicity: "mensal",
    methodology: METHODOLOGY,
    sourceUrl:
      "https://dadosabertos.bcb.gov.br/dataset/25477-taxa-media-mensal-de-juros-das-operacoes-de-credito-com-recursos-livres---pessoas-fisicas---c",
    relatedGuidePath: "/organizacao-financeira/como-sair-do-rotativo/",
    sanity: { min: 5, max: 40 },
  },
  {
    internalId: "veiculos",
    displayName: "Financiamento de veículo",
    officialName:
      "Taxa média mensal de juros — Pessoas físicas — Aquisição de veículos",
    monthlySeries: 25471,
    unit: "% a.m.",
    periodicity: "mensal",
    methodology: METHODOLOGY,
    sourceUrl:
      "https://dadosabertos.bcb.gov.br/dataset/25471-taxa-media-mensal-de-juros-das-operacoes-de-credito-com-recursos-livres---pessoas-fisicas---a",
    relatedGuidePath: "/emprestimos/diferenca-entre-emprestimo-e-financiamento/",
    sanity: { min: 0.5, max: 8 },
  },
] as const;

export function getSeries(internalId: string): BcbSeries | undefined {
  return BCB_SERIES_REGISTRY.find((s) => s.internalId === internalId);
}
