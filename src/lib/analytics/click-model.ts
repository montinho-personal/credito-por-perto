/**
 * MODELO DE CLIQUE — A PARTE QUE PENSA, SEM TOCAR NO DOM
 * ============================================================================
 *
 * O rastreamento de cliques funciona por delegação: um único ouvinte na raiz
 * do documento vê todo clique da página. Quem lê o DOM é o componente; quem
 * DECIDE o que aquilo significa é este arquivo — funções puras, entra objeto,
 * sai objeto.
 *
 * A separação não é purismo. É o que permite testar "link para o Banco
 * Central no rodapé de um guia local vira `outbound_click` com
 * destination=banco-central" sem navegador, em milissegundos, e travar o
 * comportamento contra regressão.
 *
 * POR QUE DELEGAÇÃO, E NÃO onClick EM CADA BOTÃO
 *
 * O site tem 90 botões e 189 links em componentes — mais os links dentro do
 * texto dos 60 artigos e 24 guias, que são MDX e não têm onde pendurar
 * `onClick`. Instrumentar um a um seria: 280 edições hoje, cobertura
 * incompleta amanhã (todo botão novo nasce sem medição, e nada avisa) e zero
 * cobertura sobre o conteúdo, que é justamente onde estão as saídas para as
 * fontes oficiais.
 *
 * Com delegação, a atribuição vem de `data-track-area` posto UMA vez em cada
 * região do layout. Botão novo dentro da região já nasce medido.
 */

/** O que o componente extrai do DOM e entrega para cá. */
export interface ClickDescriptor {
  /** Nome da tag do elemento acionável mais próximo. */
  tag: "a" | "button" | "summary" | "other";
  /** Atributo href cru, quando houver. */
  href: string | null;
  /** Texto visível, ainda sem redação. */
  text: string;
  /** `data-track-area` do ancestral mais próximo. */
  area: string | null;
  /** `data-track` do ancestral mais próximo — identifica o componente. */
  component: string | null;
  /** `data-track-label`, quando o autor quis fixar o rótulo. */
  labelOverride: string | null;
  /** `data-track-event`, quando o autor quis forçar o nome do evento. */
  eventOverride: string | null;
  /** Posição na lista, quando existir (1-based). */
  position: number | null;
  /** Caminho da página onde o clique aconteceu. */
  pathname: string;
  /** Origem do documento, para separar interno de externo. */
  origin: string;
}

export type LinkKind =
  | "interno"
  | "externo"
  | "ancora"
  | "email"
  | "telefone"
  | "whatsapp"
  | "acao";

/** Como o clique será enviado. `null` = não medir. */
export interface ClickEvent {
  name: string;
  params: Record<string, string | number>;
}

/* ------------------------------------------------------------------ */
/* Tipo de página                                                      */
/* ------------------------------------------------------------------ */

const ARTICLE_CATEGORIES = new Set([
  "emprestimos",
  "juros-e-cet",
  "credito-seguro",
  "organizacao-financeira",
]);

const INSTITUTIONAL = new Set([
  "sobre",
  "quem-somos",
  "politica-editorial",
  "metodologia",
  "como-ganhamos-dinheiro",
  "politica-de-publicidade",
  "politica-de-correcoes",
  "contato",
  "politica-de-privacidade",
  "politica-de-cookies",
  "termos-de-uso",
  "aviso-legal",
  "acessibilidade",
]);

/**
 * Classifica a página pelo caminho. É o eixo que transforma "1.482 cliques em
 * cta_click" em "quanto o guia local converte para ferramenta, comparado ao
 * artigo" — a pergunta que de fato se quer responder.
 */
export function pageTypeFor(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  const first = parts[0];
  if (!first) return "home";
  const second = parts[1];
  const third = parts[2];

  if (first === "emprestimos" && second && /^[a-z]{2}$/.test(second)) {
    return third ? "guia-local" : "indice-estado";
  }
  if (ARTICLE_CATEGORIES.has(first)) {
    return second ? "artigo" : "hub-categoria";
  }
  if (first === "calculadoras") return second ? "ferramenta" : "hub-ferramentas";
  if (first === "taxas") return second ? "radar-serie" : "radar";
  if (first === "decisoes-financeiras") return "central-decisoes";
  if (first === "glossario") return second ? "verbete" : "glossario";
  if (first === "busca") return "busca";
  if (first === "mapa-do-site") return "mapa-do-site";
  if (first === "artigos") return "indice-artigos";
  if (INSTITUTIONAL.has(first)) return "institucional";
  return "outra";
}

/* ------------------------------------------------------------------ */
/* Destino externo                                                     */
/* ------------------------------------------------------------------ */

/**
 * Agrupa o domínio externo por AUTORIDADE, não por site. Saber que 300
 * pessoas foram "ao Banco Central" é acionável; saber que 180 foram a
 * `bcb.gov.br` e 120 a `dadosabertos.bcb.gov.br` é a mesma informação picada
 * em dois relatórios.
 */
export function destinationFor(hostname: string): string {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  if (host === "bcb.gov.br" || host.endsWith(".bcb.gov.br")) return "banco-central";
  if (host === "planalto.gov.br" || host.endsWith(".planalto.gov.br")) return "legislacao";
  if (host === "consumidor.gov.br" || host.endsWith(".consumidor.gov.br")) return "consumidor-gov";
  if (host.includes("procon")) return "procon";
  if (host === "jus.br" || host.endsWith(".jus.br")) return "judiciario";
  if (host === "ibge.gov.br" || host.endsWith(".ibge.gov.br")) return "ibge";
  /* Prefeitura: domínio municipal do padrão <cidade>.<uf>.gov.br. */
  if (/^[a-z0-9-]+\.[a-z]{2}\.gov\.br$/.test(host)) return "prefeitura";
  if (host === "gov.br" || host.endsWith(".gov.br")) return "governo";
  return "outro";
}

/* ------------------------------------------------------------------ */
/* Classificação do link                                               */
/* ------------------------------------------------------------------ */

export interface LinkInfo {
  kind: LinkKind;
  /** Caminho interno, sem query nem hash — nada digitado viaja em URL. */
  path: string | null;
  /** Domínio, só para saída externa. */
  domain: string | null;
}

export function classifyLink(
  href: string | null,
  origin: string,
  tag: ClickDescriptor["tag"],
): LinkInfo {
  if (tag !== "a" || !href) return { kind: "acao", path: null, domain: null };

  const raw = href.trim();
  if (raw.startsWith("#")) return { kind: "ancora", path: raw.slice(0, 60), domain: null };
  if (raw.toLowerCase().startsWith("mailto:")) return { kind: "email", path: null, domain: null };
  if (raw.toLowerCase().startsWith("tel:")) return { kind: "telefone", path: null, domain: null };

  let url: URL;
  try {
    url = new URL(raw, origin);
  } catch {
    return { kind: "acao", path: null, domain: null };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { kind: "acao", path: null, domain: null };
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (host === "wa.me" || host === "api.whatsapp.com" || host.endsWith(".whatsapp.com")) {
    /* O número fica no caminho ou na query. Nenhum dos dois viaja. */
    return { kind: "whatsapp", path: null, domain: host };
  }

  let originHost: string;
  try {
    originHost = new URL(origin).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    originHost = "";
  }

  if (host === originHost) {
    /* Só o caminho. Query e hash podem carregar estado de ferramenta. */
    return { kind: "interno", path: url.pathname || "/", domain: null };
  }
  return { kind: "externo", path: null, domain: host };
}

/* ------------------------------------------------------------------ */
/* Regra do nome do evento                                             */
/* ------------------------------------------------------------------ */

/**
 * Áreas em que um clique interno é OFERTA do site — um destino que a página
 * propôs — e não navegação estrutural. A distinção separa "a pessoa usou o
 * menu" de "a pessoa aceitou o caminho que sugerimos", que é o que decide se
 * a arquitetura de conteúdo funciona.
 *
 * DUAS CAMADAS SOBRE O MESMO CLIQUE, DE PROPÓSITO
 *
 * Dentro de ferramenta e da busca, um clique dispara DOIS eventos: o
 * específico que a ferramenta já mandava (`early_payoff_debt_plan_click`) e o
 * genérico daqui (`cta_click`). Não é bug e não corrompe métrica — no GA4
 * cada nome é contado à parte.
 *
 * É escolha: o específico responde "de qual ferramenta a pessoa saiu, para
 * onde"; o genérico responde "a taxa de aceite de CTA do guia local é maior
 * ou menor que a do artigo?", pergunta que precisa da MESMA régua no site
 * todo. Manter só o específico impediria a comparação; manter só o genérico
 * apagaria o detalhe já acumulado no GA4 desde agosto.
 */
const CTA_AREAS = new Set([
  "cards-ferramentas",
  "chamada-ferramenta",
  "chamada-jornada",
  "central-decisoes",
  "proximos-passos",
  "ponte-local",
  "relacionados",
  "home-blocos",
  "hub-categoria",
  "mapa-cidade",
  "ferramenta",
  "busca",
]);

/** Áreas de navegação estrutural. */
const NAV_AREAS = new Set([
  "cabecalho",
  "rodape",
  "menu-celular",
  "migalhas",
  "mapa-do-site",
  "paginacao",
]);

export function eventNameFor(area: string | null, link: LinkInfo): string | null {
  if (link.kind === "externo") return "outbound_click";
  if (link.kind === "whatsapp" || link.kind === "email" || link.kind === "telefone") {
    return "contact_click";
  }
  if (link.kind === "ancora") return "anchor_click";
  if (link.kind === "acao") {
    /* Botão sem href: só medimos os que o autor marcou explicitamente. O
       resto (abrir acordeão, limpar campo, avançar etapa) já tem evento
       próprio de ferramenta, e duplicar poluiria o relatório. */
    return null;
  }
  if (area && CTA_AREAS.has(area)) return "cta_click";
  if (area && NAV_AREAS.has(area)) return "nav_click";
  if (area === "conteudo") return "content_link_click";
  /* Interno fora de área declarada: conta como conteúdo, que é o padrão
     do site. Sem área, o relatório mostra `area=(nao_declarada)` e a
     auditoria reclama do landmark faltante. */
  return "content_link_click";
}

const CHANNEL_BY_KIND: Partial<Record<LinkKind, string>> = {
  whatsapp: "whatsapp",
  email: "email",
  telefone: "telefone",
};

/**
 * Monta o evento. Retorna `null` quando o clique não deve ser medido.
 *
 * O rótulo NÃO é redigido aqui: a redação acontece em `track()`, uma vez, no
 * ponto de saída. Duas redações seriam duas chances de divergir.
 */
export function buildClickEvent(d: ClickDescriptor): ClickEvent | null {
  const link = classifyLink(d.href, d.origin, d.tag);
  const name = d.eventOverride ?? eventNameFor(d.area, link);
  if (!name) return null;

  const params: Record<string, string | number> = {
    area: d.area ?? "nao_declarada",
    page_type: pageTypeFor(d.pathname),
  };

  const label = (d.labelOverride ?? d.text).trim();
  if (label) params.label = label;
  if (d.component) params.component = d.component;
  if (link.path) params.to_path = link.path;
  if (d.position && d.position > 0 && d.position <= 1000) params.position = d.position;

  if (link.kind === "externo" && link.domain) {
    params.domain = link.domain;
    params.destination = destinationFor(link.domain);
  }
  const channel = CHANNEL_BY_KIND[link.kind];
  if (channel) params.channel = channel;

  return { name, params };
}
