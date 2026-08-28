/**
 * Configuração central do portal. Tudo que depende do domínio canônico,
 * nome da marca ou navegação principal sai daqui.
 */
export const SITE_URL = "https://www.creditoporperto.com";

export const SITE_NAME = "Crédito por Perto";

export const SITE_TAGLINE = "Crédito explicado. Decisões mais seguras.";

export const SITE_TAGLINE_LOCAL = "Informação sobre crédito perto de você.";

export const SITE_DESCRIPTION =
  "Portal editorial independente que explica empréstimos, juros, CET e segurança contra golpes para ajudar você a comparar crédito antes de assumir uma dívida.";

export const SITE_LOCALE = "pt-BR";

/** E-mail público de contato, definido pelo proprietário. */
export const CONTACT_EMAIL = "blink.renato@gmail.com";

/**
 * Responsável legal pelo portal (controlador dos dados).
 * Por decisão do responsável, o CPF é exibido publicamente de forma mascarada;
 * o número completo fica registrado apenas fora do repositório.
 */
export const LEGAL_OWNER = {
  name: "Renato de Camargo Nascimento",
  cpfMasked: "397.***.***-97",
  email: "blink.renato@gmail.com",
  address: "Avenida Cauaxi, 258 — Alphaville, Barueri/SP, CEP 06454-020",
} as const;

export const MAIN_NAV = [
  { label: "Empréstimos", href: "/emprestimos/" },
  { label: "Juros e CET", href: "/juros-e-cet/" },
  { label: "Calculadoras", href: "/calculadoras/" },
  { label: "Crédito seguro", href: "/credito-seguro/" },
  { label: "Guias locais", href: "/emprestimos/guias-locais/" },
  { label: "Blog", href: "/artigos/" },
] as const;

export const FOOTER_NAV = {
  institucional: [
    { label: "Sobre o Crédito por Perto", href: "/sobre/" },
    { label: "Quem somos", href: "/quem-somos/" },
    { label: "Política editorial", href: "/politica-editorial/" },
    { label: "Metodologia", href: "/metodologia/" },
    { label: "Como ganhamos dinheiro", href: "/como-ganhamos-dinheiro/" },
    { label: "Política de correções", href: "/politica-de-correcoes/" },
    { label: "Contato", href: "/contato/" },
  ],
  legal: [
    { label: "Política de privacidade", href: "/politica-de-privacidade/" },
    { label: "Política de cookies", href: "/politica-de-cookies/" },
    { label: "Política de publicidade", href: "/politica-de-publicidade/" },
    { label: "Termos de uso", href: "/termos-de-uso/" },
    { label: "Aviso legal", href: "/aviso-legal/" },
    { label: "Acessibilidade", href: "/acessibilidade/" },
  ],
  conteudo: [
    { label: "Guia completo do empréstimo", href: "/emprestimos/guia-completo-de-emprestimo/" },
    { label: "Empréstimo pessoal", href: "/emprestimos/emprestimo-pessoal/" },
    { label: "Empréstimo consignado", href: "/emprestimos/emprestimo-consignado/" },
    { label: "O que é CET", href: "/juros-e-cet/o-que-e-cet/" },
    { label: "Radar de taxas do BC", href: "/taxas/" },
    { label: "Consultar instituição no BC", href: "/calculadoras/consultar-instituicao/" },
    { label: "Comparador de propostas", href: "/calculadoras/comparador-de-propostas/" },
    { label: "Trocar dívida vale a pena?", href: "/calculadoras/trocar-divida/" },
    { label: "Plano para sair das dívidas", href: "/calculadoras/plano-para-sair-das-dividas/" },
    { label: "Quitação antecipada (calculadora)", href: "/calculadoras/quitacao-antecipada/" },
    { label: "Parcela no orçamento", href: "/calculadoras/parcela-no-orcamento/" },
    { label: "Conversor de taxas", href: "/calculadoras/conversor-de-taxas/" },
    { label: "Minha taxa está cara?", href: "/calculadoras/minha-taxa-esta-cara/" },
    { label: "Calculadora de empréstimo", href: "/calculadoras/emprestimo/" },
    { label: "Golpes de empréstimo", href: "/credito-seguro/como-identificar-golpes-de-emprestimo/" },
    { label: "Sinais de golpe (verificação)", href: "/calculadoras/sinais-de-golpe/" },
    { label: "Glossário de crédito", href: "/glossario/" },
    { label: "Mapa do site", href: "/mapa-do-site/" },
  ],
} as const;
