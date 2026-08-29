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

/**
 * Menu principal.
 *
 * "Comece aqui" abre a Central de Decisões e vem primeiro porque é a porta
 * de quem não sabe o que procurar — a maioria. "Calculadoras" continua no
 * menu, e continua apontando para o catálogo: quem já sabe o nome da conta
 * que quer não deveria ter de passar por uma triagem para chegar nela. As
 * duas portas convivem de propósito; trocar uma pela outra atenderia bem
 * metade das pessoas e mal a outra metade.
 */
export const MAIN_NAV = [
  { label: "Comece aqui", href: "/decisoes-financeiras/" },
  { label: "Empréstimos", href: "/emprestimos/" },
  { label: "Juros e CET", href: "/juros-e-cet/" },
  { label: "Calculadoras", href: "/calculadoras/" },
  { label: "Crédito seguro", href: "/credito-seguro/" },
  { label: "Guias locais", href: "/emprestimos/guias-locais/" },
  { label: "Blog", href: "/artigos/" },
] as const;

/**
 * Navegação do rodapé.
 *
 * A coluna "conteúdo" já teve vinte itens: os pilares editoriais, as doze
 * ferramentas, o glossário e o mapa do site, tudo junto. Ela ficava três
 * vezes mais alta que as vizinhas e o rodapé passava de 900px no desktop e de
 * 1700px no celular — a poluição vinha daí, não do número de colunas.
 *
 * Agora cada coluna tem uma natureza só e cabe em seis itens: dá para varrer
 * com o olho sem ler. As ferramentas ganharam coluna própria, montada a
 * partir do registry (`inFooter`), com link para o hub que tem todas. Rótulos
 * são substantivos curtos e consistentes — sem perguntas misturadas com
 * nomes, e sem parênteses desambiguadores, que só eram necessários enquanto
 * ferramenta e artigo dividiam a mesma lista.
 */
export const FOOTER_NAV = {
  conteudo: [
    { label: "Guia do empréstimo", href: "/emprestimos/guia-completo-de-emprestimo/" },
    { label: "Empréstimo pessoal", href: "/emprestimos/emprestimo-pessoal/" },
    { label: "Empréstimo consignado", href: "/emprestimos/emprestimo-consignado/" },
    { label: "O que é CET", href: "/juros-e-cet/o-que-e-cet/" },
    { label: "Golpes de empréstimo", href: "/credito-seguro/como-identificar-golpes-de-emprestimo/" },
    { label: "Guias por cidade", href: "/emprestimos/guias-locais/" },
    { label: "Todos os artigos", href: "/artigos/" },
  ],
  institucional: [
    { label: "Sobre o portal", href: "/sobre/" },
    { label: "Quem somos", href: "/quem-somos/" },
    { label: "Política editorial", href: "/politica-editorial/" },
    { label: "Metodologia", href: "/metodologia/" },
    { label: "Política de correções", href: "/politica-de-correcoes/" },
    { label: "Contato", href: "/contato/" },
  ],
  legal: [
    { label: "Privacidade", href: "/politica-de-privacidade/" },
    { label: "Cookies", href: "/politica-de-cookies/" },
    { label: "Publicidade", href: "/politica-de-publicidade/" },
    { label: "Termos de uso", href: "/termos-de-uso/" },
    { label: "Aviso legal", href: "/aviso-legal/" },
    { label: "Acessibilidade", href: "/acessibilidade/" },
  ],
  /** Barra inferior: utilidades de navegação, não seções de conteúdo. */
  utilidades: [
    { label: "Mapa do site", href: "/mapa-do-site/" },
    { label: "Glossário", href: "/glossario/" },
    { label: "Busca", href: "/busca/" },
  ],
} as const;
