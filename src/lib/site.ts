/**
 * Configuração central do portal. Tudo que depende do domínio canônico,
 * nome da marca ou navegação principal sai daqui.
 */
export const SITE_URL = "https://www.creditoporperto.com.br";

export const SITE_NAME = "Crédito Por Perto";

export const SITE_TAGLINE = "Crédito explicado. Decisões mais seguras.";

export const SITE_TAGLINE_LOCAL = "Informação sobre crédito perto de você.";

export const SITE_DESCRIPTION =
  "Portal editorial independente que explica empréstimos, juros, CET e segurança contra golpes para ajudar você a comparar crédito antes de assumir uma dívida.";

export const SITE_LOCALE = "pt-BR";

/** E-mail público de contato — placeholder até o proprietário definir (ver PENDENCIAS_CRITICAS.md). */
export const CONTACT_EMAIL_PLACEHOLDER = "contato@creditoporperto.com.br";

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
    { label: "Sobre o Crédito Por Perto", href: "/sobre/" },
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
    { label: "Empréstimo pessoal", href: "/emprestimos/emprestimo-pessoal/" },
    { label: "Empréstimo consignado", href: "/emprestimos/emprestimo-consignado/" },
    { label: "O que é CET", href: "/juros-e-cet/o-que-e-cet/" },
    { label: "Calculadora de empréstimo", href: "/calculadoras/emprestimo/" },
    { label: "Golpes de empréstimo", href: "/credito-seguro/como-identificar-golpes-de-emprestimo/" },
    { label: "Glossário de crédito", href: "/glossario/" },
    { label: "Mapa do site", href: "/mapa-do-site/" },
  ],
} as const;
