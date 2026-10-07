/**
 * REGRAS DO BANCO DO POVO PAULISTA — módulo único.
 *
 * Nenhum número do programa mora fora deste arquivo: o motor, o simulador e a
 * página leem daqui. Mudou a regra? Muda aqui, com fonte e data, e os testes
 * em `tests/bpp-simulator.test.ts` apontam o que quebrou.
 *
 * TRÊS NÍVEIS DE CONFIANÇA, SEMPRE DECLARADOS
 *
 * - "estadual": está na carta de serviços do Governo do Estado ou na página do
 *   programa na Secretaria de Desenvolvimento Econômico.
 * - "municipal": publicado em página oficial de prefeitura que opera o
 *   programa. Vale como indício forte, não como regra estadual: a página diz
 *   de qual prefeitura veio.
 * - "a-confirmar": visto só em fonte secundária (imprensa, resumo de busca,
 *   material de terceiros). NÃO entra em conta nenhuma; aparece só na lista de
 *   pendências da página, para a pessoa perguntar no balcão.
 *
 * VERIFICAÇÃO. Releitura direta das fontes em 07/10/2026. A carta de
 * serviços estadual (atualizada pelo Estado em 31/07/2026) confirmou valor,
 * juros, prazo e carência, e passou a trazer garantia, documentos,
 * capacitação e prazos de análise. Ela NÃO traz mais o requisito "sem
 * restrição no Serasa/ADIN" nem o de atividade no município, registrados na
 * leitura de 11/09/2026: os dois agora se apoiam em páginas de prefeituras.
 * Fonte que não abriu na releitura (Cloudflare, página fora do ar) mantém a
 * data da última leitura. `audit:sources` avisa quando `BPP_RULES.verifiedAt`
 * envelhece.
 *
 * MÉTODO DE CÁLCULO. Nenhuma fonte oficial consultada publica o sistema de
 * amortização do programa, o tratamento da carência nem a lista de custos. O
 * simulador por isso calcula uma ESTIMATIVA pelo sistema Price (prestações
 * fixas, a fórmula da Calculadora do Cidadão do Banco Central), com a
 * premissa de carência declarada, e nunca chama o resultado de "parcela do
 * Banco do Povo".
 */

export type RuleLevel = "estadual" | "municipal" | "a-confirmar";

export interface BppSource {
  organization: string;
  title: string;
  url: string;
  /** Data da leitura, DD/MM/AAAA. */
  checkedAt: string;
}

/* -------------------------------------------------------------------------- */
/* Fontes                                                                      */
/* -------------------------------------------------------------------------- */

export const SOURCES = {
  cartaEstadual: {
    organization: "Governo do Estado de São Paulo",
    title: "Carta de Serviços — Banco do Povo Paulista",
    url: "https://servicos.sp.gov.br/fcarta/7113B9A5-BF37-4CB9-A48F-4DD7CF4ED8F3",
    checkedAt: "07/10/2026",
  },
  secretaria: {
    organization: "Secretaria de Desenvolvimento Econômico do Estado de São Paulo",
    title: "Programa Banco do Povo",
    url: "https://www.desenvolvimentoeconomico.sp.gov.br/DesenvolvimentoEconomico/institucional/Programas/banco_do_povo",
    checkedAt: "07/10/2026",
  },
  varzeaPaulista: {
    organization: "Prefeitura de Várzea Paulista",
    title: "Banco do Povo incentiva pequenos negócios com microcrédito acessível",
    url: "https://portal.varzeapaulista.sp.gov.br/2026/02/19/banco-do-povo-incentiva-pequenos-negocios-com-microcredito-acessivel/",
    checkedAt: "07/10/2026",
  },
  cajamar: {
    organization: "Prefeitura de Cajamar",
    title: "Banco do Povo disponibiliza R$ 650.000 para empreendedores cajamarenses",
    url: "https://cajamar.sp.gov.br/noticias/2023/06/12/banco-do-povo-disponibiliza-r-650-000-para-empreendedores-cajamarenses/",
    checkedAt: "07/10/2026",
  },
  aracariguama: {
    organization: "Prefeitura de Araçariguama",
    title: "Banco do Povo Paulista",
    url: "https://www.aracariguama.sp.gov.br/banco-do-povo-paulista-",
    checkedAt: "07/10/2026",
  },
  aracariguamaNoticia: {
    organization: "Prefeitura de Araçariguama",
    title: "Unidade Araçariguama do Banco do Povo Paulista está com novo número de WhatsApp",
    url: "https://www.aracariguama.sp.gov.br/portal/noticias/0/3/4614/unidade-aracariguama-do-banco-do-povo-paulista-bpp-esta-com-novo-numero-de-whatsapp-para-atendimento-ao-publico/",
    checkedAt: "07/10/2026",
  },
  louveira: {
    organization: "Prefeitura de Louveira",
    title: "Banco do Povo",
    url: "https://www.louveira.sp.gov.br/servico/banco-do-povo",
    checkedAt: "02/09/2026",
  },
  vargemGrande: {
    organization: "Prefeitura de Vargem Grande Paulista",
    title: "Banco do Povo",
    url: "https://www.vargemgrandepaulista.sp.gov.br/site/banco-do-povo/",
    checkedAt: "08/09/2026",
  },
  itapecerica: {
    organization: "Prefeitura de Itapecerica da Serra",
    title: "Banco do Povo Paulista — Portal do Empreendedor",
    url: "https://www.itapecerica.sp.gov.br/portal-do-empreendedor/banco-do-povo-paulista",
    checkedAt: "07/10/2026",
  },
  arturNogueira: {
    organization: "Governo do Estado de São Paulo",
    title: "Carta de Serviços — Banco do Povo Paulista em Artur Nogueira",
    url: "https://servicos.sp.gov.br/fcarta/0EF72667-27D6-4B2A-8AE1-48F0B0558A24",
    checkedAt: "07/10/2026",
  },
} as const satisfies Record<string, BppSource>;

/* -------------------------------------------------------------------------- */
/* Regras                                                                      */
/* -------------------------------------------------------------------------- */

export type Profile = "mei" | "empresa" | "sem-cnpj" | "nao-sei";

export const PROFILE_LABEL: Record<Profile, string> = {
  mei: "Tenho MEI",
  empresa: "Tenho empresa com CNPJ (ME, EPP ou outra)",
  "sem-cnpj": "Trabalho por conta própria, sem CNPJ",
  "nao-sei": "Não sei",
};

export const BPP_RULES = {
  /** Data da leitura mais recente da fonte estadual. A auditoria usa esta. */
  verifiedAt: "07/10/2026",

  amount: {
    minCents: 200_00,
    maxCents: 21_000_00,
    level: "estadual" as RuleLevel,
    text: "A carta de serviços estadual informa crédito de R$ 200 a R$ 21.000.",
    sources: [SOURCES.cartaEstadual],
  },

  /**
   * Teto por perfil. O estadual é um só (R$ 21 mil); as prefeituras de
   * Cajamar e Araçariguama detalham R$ 15 mil para pessoa física e R$ 21 mil
   * para pessoa jurídica.
   * Vargem Grande Paulista publica R$ 20 mil para pessoa jurídica —
   * divergência declarada na página.
   */
  profileCap: {
    pessoaFisicaCents: 15_000_00,
    pessoaJuridicaCents: 21_000_00,
    level: "municipal" as RuleLevel,
    text:
      "Páginas oficiais das prefeituras de Cajamar e Araçariguama publicam até R$ 15 mil para pessoa física e até R$ 21 mil para pessoa jurídica.",
    divergence:
      "A Prefeitura de Vargem Grande Paulista publica R$ 20 mil como teto do primeiro crédito para pessoa jurídica.",
    sources: [SOURCES.cajamar, SOURCES.aracariguamaNoticia, SOURCES.vargemGrande],
  },

  rate: {
    /** "A partir de" — taxa mínima divulgada, não taxa universal. */
    fromMonthlyPercent: 0.35,
    fromLevel: "estadual" as RuleLevel,
    fromText: "A carta de serviços estadual informa juros a partir de 0,35% ao mês.",
    fromSources: [SOURCES.cartaEstadual],
    /** Maior taxa citada em página oficial de prefeitura ("conforme a categoria"). */
    highestCitedMonthlyPercent: 1,
    highestLevel: "municipal" as RuleLevel,
    highestText:
      "Páginas oficiais de prefeituras citam juros de 0,35% a 1% ao mês, conforme a categoria do empreendedor.",
    highestSources: [SOURCES.cajamar, SOURCES.louveira],
    divergence:
      "Notícia da Prefeitura de Várzea Paulista (fev/2026) fala em juros \"de até 0,35% ao mês\" nas três linhas; a carta estadual fala em \"a partir de 0,35%\".",
  },

  term: {
    maxMonths: 36,
    level: "estadual" as RuleLevel,
    text: "A carta de serviços estadual informa prazo de pagamento de até 36 meses.",
    sources: [SOURCES.cartaEstadual],
  },

  grace: {
    maxMonths: 3,
    level: "estadual" as RuleLevel,
    text: "A carta de serviços estadual informa carência de até 3 meses, conforme a análise.",
    sources: [SOURCES.cartaEstadual],
  },

  /** Requisitos, cada um com o nível de confiança. */
  requirements: [
    {
      id: "capacitacao",
      text: "Concluir a qualificação empreendedora obrigatória e gratuita, pelo Qualifica SP ou pelo Sebrae – Banco do Povo (carga de 12h30), antes do pedido.",
      level: "estadual" as RuleLevel,
      sources: [SOURCES.cartaEstadual, SOURCES.secretaria],
    },
    {
      id: "garantia",
      text: "Apresentar garantia: um avalista (empreendedor informal e produtor rural com CNPJ) ou a contratação do Fundo de Aval do Estado de São Paulo, o FDA (empreendedor formal).",
      level: "estadual" as RuleLevel,
      sources: [SOURCES.cartaEstadual],
    },
    {
      id: "atividade-no-municipio",
      text: "Pedir o crédito no município onde o negócio funciona.",
      level: "municipal" as RuleLevel,
      sources: [SOURCES.aracariguama, SOURCES.itapecerica],
    },
    {
      id: "sem-restricao",
      text: "Não ter restrição cadastral (Araçariguama cita SCPC, Serasa e Cadin).",
      level: "municipal" as RuleLevel,
      sources: [SOURCES.aracariguama, SOURCES.itapecerica],
    },
    {
      id: "tempo-de-atividade",
      text: "Algumas prefeituras exigem tempo mínimo de atividade, como mais de seis meses.",
      level: "municipal" as RuleLevel,
      sources: [SOURCES.itapecerica],
    },
  ],

  purposes: {
    text:
      "O crédito é produtivo: capital de giro (mercadorias, matéria-prima) e investimento fixo (máquinas, equipamentos, veículos de trabalho). Não serve para despesa pessoal nem para quitar dívida de consumo.",
    level: "estadual" as RuleLevel,
    sources: [SOURCES.cartaEstadual, SOURCES.arturNogueira],
  },

  lines: {
    names: ["Empreenda Rápido", "Empreenda Mulher", "Empreenda Afro"],
    level: "estadual" as RuleLevel,
    text:
      "A Secretaria de Desenvolvimento Econômico lista as linhas Empreenda Rápido, Empreenda Mulher e Empreenda Afro; prefeituras chamam a segunda também de Mulheres Empreendedoras. A tabela de limites e taxas de cada linha não aparece em texto nas fontes oficiais que conferimos.",
    sources: [SOURCES.secretaria, SOURCES.varzeaPaulista, SOURCES.cajamar],
  },

  /** Documentos listados pela carta estadual. A unidade pode pedir mais. */
  documents: {
    everyone: [
      "Documento oficial com foto (CIN, RG, CNH, RNE ou passaporte) e CPF",
      "Comprovante de endereço e comprovação de renda",
      "Certidão de casamento, separação ou viuvez, ou comprovante de união estável, quando for o caso",
      "Documento com foto dos sócios, do avalista e dos cônjuges, se houver",
      "Certificado da capacitação",
      "Plano de negócio e orçamento do que será financiado, com os dados do fornecedor",
      "Extrato de conta corrente",
    ],
    formal: [
      "Inscrição no CNPJ ou CCMEI",
      "Inscrição Estadual e Municipal, quando houver",
      "Certificado de regularidade do FGTS (CRF) e Certidão Negativa de Débitos (CND)",
      "Contrato social ou estatuto registrado, para sociedade empresária",
      "Declarações do Imposto de Renda dos 5 últimos exercícios, com os recibos",
    ],
    level: "estadual" as RuleLevel,
    sources: [SOURCES.cartaEstadual],
  },

  /** Custo e prazos do atendimento, pela carta estadual. */
  process: {
    free: "O serviço é gratuito: não há cobrança para pedir, participar das etapas ou acessar as linhas. Paga-se só o que o contrato prevê, como os juros.",
    timing:
      "Com a documentação completa, a análise e a liberação costumam ocorrer em até 30 dias, conforme o município; pela plataforma digital do programa, em até 10 dias.",
    digitalUrl: "https://www.bancodopovodigital.sp.gov.br",
    level: "estadual" as RuleLevel,
    sources: [SOURCES.cartaEstadual],
  },

  /**
   * Visto só em fonte secundária. Nada daqui entra em conta: a página mostra
   * a lista para a pessoa perguntar no atendimento.
   */
  toConfirm: [
    "Taxa da sua linha e do seu perfil (a tabela por linha não aparece em texto nas fontes oficiais).",
    "Se o contrato tem outros encargos além dos juros, como IOF ou seguro, e de quanto.",
    "Quanto custa a contratação do Fundo de Aval do Estado (FDA), exigido do empreendedor formal.",
    "Se os juros correm durante a carência e se ela conta dentro dos 36 meses.",
    "Sistema de amortização usado no contrato.",
  ],
} as const;

/* -------------------------------------------------------------------------- */
/* Cenários de taxa — só com base oficial                                      */
/* -------------------------------------------------------------------------- */

export type RateScenarioId = "minima" | "maior-citada" | "outra";

export const RATE_SCENARIOS: ReadonlyArray<{
  id: Exclude<RateScenarioId, "outra">;
  label: string;
  monthlyPercent: number;
  explanation: string;
}> = [
  {
    id: "minima",
    label: "0,35% ao mês",
    monthlyPercent: BPP_RULES.rate.fromMonthlyPercent,
    explanation: "Taxa mínima divulgada pelo Estado (“a partir de”). Não é a taxa de todo pedido.",
  },
  {
    id: "maior-citada",
    label: "1% ao mês",
    monthlyPercent: BPP_RULES.rate.highestCitedMonthlyPercent,
    explanation: "Maior taxa citada em páginas oficiais de prefeituras, conforme a categoria.",
  },
];

/** Teto do campo "outra taxa": proteção da ferramenta, não regra do programa. */
export const CUSTOM_RATE_MAX_PERCENT = 10;

/* -------------------------------------------------------------------------- */
/* Utilidades                                                                  */
/* -------------------------------------------------------------------------- */

/** Teto de valor para o perfil escolhido. */
export function capForProfile(profile: Profile): { capCents: number; basis: "pessoa-fisica" | "pessoa-juridica" | "estadual" } {
  if (profile === "sem-cnpj") return { capCents: BPP_RULES.profileCap.pessoaFisicaCents, basis: "pessoa-fisica" };
  if (profile === "mei" || profile === "empresa") return { capCents: BPP_RULES.profileCap.pessoaJuridicaCents, basis: "pessoa-juridica" };
  return { capCents: BPP_RULES.amount.maxCents, basis: "estadual" };
}

/** Idade, em dias, de uma data DD/MM/AAAA em relação a `today`. */
export function ageInDays(ddmmyyyy: string, today: Date): number {
  const [d, m, y] = ddmmyyyy.split("/").map(Number);
  const verified = Date.UTC(y!, m! - 1, d!);
  return Math.floor((today.getTime() - verified) / 86_400_000);
}
