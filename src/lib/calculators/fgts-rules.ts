/**
 * REGRAS DO SAQUE-ANIVERSÁRIO E DA ANTECIPAÇÃO — módulo único.
 *
 * Nenhum número normativo do FGTS mora fora deste arquivo: o motor, o
 * componente e a página leem daqui. Mudou a regra? Muda aqui, com fonte e
 * data, e os testes em `tests/fgts-advance.test.ts` apontam o que quebrou.
 *
 * TRANSIÇÃO AUTOMÁTICA. O limite de saques antecipáveis depende da DATA da
 * contratação (5 até 31/10/2026; 3 a partir de 01/11/2026). `advanceRulesAt`
 * escolhe o período pela data — ninguém precisa editar a interface no dia da
 * troca, e a página (revalidada diariamente) acompanha sozinha.
 *
 * VERIFICAÇÃO. Os sites oficiais (fgts.gov.br, gov.br, caixa.gov.br) não
 * abrem no ambiente de desenvolvimento; a pesquisa de 23/09/2026 leu os
 * trechos oficiais por busca, e o proprietário conferiu a página do FGTS na
 * mesma data (briefing de 23/09/2026). `audit:sources` avisa quando
 * `verifiedAt` envelhece.
 */

export interface RuleSource {
  organization: string;
  title: string;
  url: string;
}

/* -------------------------------------------------------------------------- */
/* Tabela do Saque-Aniversário (Lei 8.036/1990, Anexo)                        */
/* -------------------------------------------------------------------------- */

export interface SaqueBracket {
  /** Limite superior da faixa, em centavos (inclusivo). null = sem limite. */
  upToCents: number | null;
  /** Alíquota em fração (0,5 = 50%). */
  rate: number;
  /** Parcela adicional, em centavos. */
  addCents: number;
}

export const SAQUE_TABLE = {
  id: "tabela-saque-aniversario",
  brackets: [
    { upToCents: 500_00, rate: 0.5, addCents: 0 },
    { upToCents: 1_000_00, rate: 0.4, addCents: 50_00 },
    { upToCents: 5_000_00, rate: 0.3, addCents: 150_00 },
    { upToCents: 10_000_00, rate: 0.2, addCents: 650_00 },
    { upToCents: 15_000_00, rate: 0.15, addCents: 1_150_00 },
    { upToCents: 20_000_00, rate: 0.1, addCents: 1_900_00 },
    { upToCents: null, rate: 0.05, addCents: 2_900_00 },
  ] as readonly SaqueBracket[],
  /** O Executivo pode alterar faixas até 30/06 de cada ano, para vigorar em 1º de janeiro seguinte. */
  changeNote:
    "O Poder Executivo pode alterar as faixas, alíquotas e parcelas adicionais até 30 de junho de cada ano, para valer a partir de 1º de janeiro do ano seguinte.",
  source: {
    organization: "Presidência da República / FGTS",
    title: "Lei nº 8.036/1990, Anexo (incluído pela Lei nº 13.932/2019)",
    url: "https://www.planalto.gov.br/ccivil_03/leis/l8036consol.htm",
  } satisfies RuleSource,
  /** Exemplo oficial do FGTS: saldo de R$ 1.000 → 40% + R$ 50 = R$ 450. */
  officialExample: { balanceCents: 1_000_00, saqueCents: 450_00 },
  verifiedAt: "23/09/2026",
} as const;

/* -------------------------------------------------------------------------- */
/* Antecipação (alienação ou cessão fiduciária)                               */
/* -------------------------------------------------------------------------- */

export interface AdvancePeriod {
  /** Primeiro dia (AAAA-MM-DD) em que a regra vale. */
  from: string;
  /** Último dia (AAAA-MM-DD), ou null se não houver fim previsto. */
  to: string | null;
  /** Máximo de saques anuais que podem ser cedidos numa contratação. */
  maxSaques: number;
}

export const ADVANCE_RULES = {
  id: "antecipacao-saque-aniversario",
  periods: [
    { from: "2025-11-01", to: "2026-10-31", maxSaques: 5 },
    { from: "2026-11-01", to: null, maxSaques: 3 },
  ] as readonly AdvancePeriod[],
  /** Valor mínimo e máximo cedido de cada Saque-Aniversário anual. */
  minPerSaqueCents: 100_00,
  maxPerSaqueCents: 500_00,
  /** Dias corridos após o início da vigência da opção antes de autorizar a consulta. */
  waitingDays: 90,
  /** Repasse à instituição: até o N-ésimo dia útil do mês de aniversário. */
  transferBusinessDay: 5,
  summaries: {
    perCompetence: "Cada Saque-Aniversário anual pode estar vinculado a apenas uma operação de crédito.",
    newContract:
      "A partir de 01/11/2026, uma nova contratação fica condicionada à quitação da antecipação vigente referente ao próximo Saque-Aniversário.",
    waiting:
      "A autorização para a instituição consultar o saldo só pode ser dada depois de 90 dias do início da vigência da opção pelo Saque-Aniversário.",
    transfer: "O repasse à instituição ocorre até o 5º dia útil do mês de aniversário.",
    blocking:
      "O FGTS bloqueia o saldo necessário para que, aplicada a alíquota e somada a parcela adicional, exista o valor dos saques dados em garantia — por isso o bloqueio costuma ser maior que o valor recebido.",
    blockingTransition:
      "Operações ativas até 04/05/2026 tiveram a garantia retida alterada para o valor nominal das parcelas antecipadas (MP nº 1.355/2026); contratações posteriores seguem a regra do Conselho Curador, pela base de saldo necessária.",
  },
  sources: {
    resolution: {
      organization: "FGTS",
      title: "Saque-Aniversário — regras da antecipação (Resolução CCFGTS nº 1.130/2025, que alterou a nº 958/2020)",
      url: "https://www.fgts.gov.br/Paginas/trabalhador/saque/saque-aniversario.aspx",
    },
    mte: {
      organization: "Ministério do Trabalho e Emprego",
      title: "FGTS terá novas regras para o saque-aniversário a partir de novembro",
      url: "https://www.gov.br/trabalho-e-emprego/pt-br/noticias-e-conteudo/2025/outubro/fgts-tera-novas-regras-para-o-saque-aniversario-a-partir-de-novembro",
    },
    caixa: {
      organization: "CAIXA, Agente Operador do FGTS",
      title: "Antecipação do Saque-Aniversário — perguntas frequentes",
      url: "https://www.caixa.gov.br/voce/credito-financiamento/emprestimo/antecipacao-saque-aniversario-FGTS/perguntas-frequentes/Paginas/default.aspx",
    },
    mp: {
      organization: "CAIXA, Agente Operador do FGTS",
      title: "Saque FGTS MP 1.331/2025 (alterada pela MP 1.355/2026)",
      url: "https://www.caixa.gov.br/beneficios-trabalhador/fgts/saque-mp-1331-25/Paginas/default.aspx",
    },
  } satisfies Record<string, RuleSource>,
  verifiedAt: "23/09/2026",
} as const;

/* -------------------------------------------------------------------------- */
/* Rescisão e retorno ao Saque-Rescisão                                       */
/* -------------------------------------------------------------------------- */

export const TERMINATION_RULES = {
  dismissal:
    "Quem está no Saque-Aniversário e é demitido sem justa causa saca a multa rescisória, quando devida; o restante do saldo continua na conta e pode ser sacado nos Saques-Aniversário seguintes ou nas outras hipóteses previstas em lei.",
  returnToRescisao:
    "O retorno ao Saque-Rescisão pode ser pedido quando não houver antecipação contratada, e só vale a partir do primeiro dia do 25º mês depois do pedido.",
  source: {
    organization: "Ministério do Trabalho e Emprego / FGTS",
    title: "Saiba como funciona o Saque-Aniversário (Lei nº 8.036/1990, art. 20-C)",
    url: "https://www.gov.br/trabalho-e-emprego/pt-br/noticias-e-conteudo/2025/dezembro/saiba-como-funciona-o-saque-aniversario",
  } satisfies RuleSource,
  verifiedAt: "23/09/2026",
} as const;

/* -------------------------------------------------------------------------- */
/* Consultas por data                                                         */
/* -------------------------------------------------------------------------- */

/** Data ISO (AAAA-MM-DD) válida? */
export function isIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Período da regra de antecipação vigente na data, ou null antes de 01/11/2025. */
export function advanceRulesAt(isoDate: string): AdvancePeriod | null {
  if (!isIsoDate(isoDate)) return null;
  for (const p of ADVANCE_RULES.periods) {
    if (isoDate >= p.from && (p.to === null || isoDate <= p.to)) return p;
  }
  return null;
}

/** Próxima troca de regra depois da data, se houver. */
export function nextAdvanceChange(isoDate: string): { from: string; maxSaques: number } | null {
  const next = ADVANCE_RULES.periods.find((p) => p.from > isoDate);
  return next ? { from: next.from, maxSaques: next.maxSaques } : null;
}

/** AAAA-MM-DD → DD/MM/AAAA. */
export function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Hoje, no fuso de Brasília, em AAAA-MM-DD. */
export function todayInBrazil(now: Date = new Date()): string {
  // en-CA formata como AAAA-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
