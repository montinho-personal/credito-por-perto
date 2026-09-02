/**
 * DATA DE ÚLTIMA ALTERAÇÃO DAS PÁGINAS QUE NÃO SÃO CONTEÚDO
 * ============================================================================
 *
 * O sitemap tinha 39 das 126 entradas sem `lastmod` — todas as páginas cujo
 * conteúdo mora em `.tsx`, não em MDX: hubs, ferramentas e institucionais.
 * Artigos e guias locais já traziam a data do frontmatter; estas não tinham
 * de onde tirar.
 *
 * `lastmod` não é enfeite: é um dos sinais que o buscador usa para decidir a
 * ordem da fila de rastreamento. Uma URL sem ele entra na fila sem
 * argumento — e num site novo, onde o orçamento de rastreamento é curto, o
 * argumento decide.
 *
 * POR QUE DECLARADO À MÃO, E NÃO DERIVADO DO BUILD
 *
 * A saída fácil seria `new Date()` no build. Seria pior que não ter nada: o
 * sitemap passaria a jurar que 126 páginas mudaram a cada deploy, inclusive
 * as que não mudaram. Buscador aprende a ignorar quem mente assim, e o sinal
 * morre justamente quando a página muda de verdade.
 *
 * Derivar do git seria correto, mas o build da Vercel usa clone raso e não
 * tem o histórico. Então a data é declarada aqui — e `pnpm audit:sitemap`
 * compara cada uma com o `git log` do arquivo correspondente e reclama
 * quando a declaração fica para trás. O acerto continua verificável sem
 * depender do git em produção.
 *
 * QUANDO ATUALIZAR: mudança real no que o leitor vê. Refatoração interna,
 * ajuste de classe CSS ou troca de import não movem esta data.
 */

/** Caminho → data ISO da última alteração de conteúdo visível. */
export const STATIC_PAGE_DATES: Record<string, string> = {
  "/": "2026-08-29",

  /* Hubs de categoria e índices: a data vem do conteúdo que eles listam e é
     calculada em sitemap-entries.ts. Só entram aqui os que não têm lista. */
  "/decisoes-financeiras/": "2026-08-29",
  "/calculadoras/": "2026-08-29",
  "/glossario/": "2026-08-16",
  "/mapa-do-site/": "2026-08-29",

  /* Institucionais e políticas. */
  "/sobre/": "2026-08-06",
  "/quem-somos/": "2026-09-02",
  "/politica-editorial/": "2026-08-06",
  "/metodologia/": "2026-08-06",
  "/como-ganhamos-dinheiro/": "2026-08-06",
  "/politica-de-publicidade/": "2026-08-06",
  "/politica-de-correcoes/": "2026-08-06",
  "/contato/": "2026-08-06",
  "/politica-de-privacidade/": "2026-08-29",
  "/politica-de-cookies/": "2026-08-06",
  "/termos-de-uso/": "2026-08-06",
  "/aviso-legal/": "2026-08-06",
  "/acessibilidade/": "2026-08-06",
};

/**
 * MUDANÇAS QUE O LEITOR NÃO VIU
 * ============================================================================
 *
 * `pnpm audit:sitemap` compara cada data declarada acima com o `git log` do
 * arquivo, e avisa quando a declaração fica para trás. É o que impede a
 * tabela de envelhecer em silêncio.
 *
 * Só que existe um caso legítimo em que o arquivo muda e a data NÃO deve
 * mudar: alteração puramente interna. Em 02/09/2026, 19 páginas ganharam o
 * atributo `data-track-area` da camada de rastreamento — atributo invisível,
 * zero diferença no que a pessoa lê. Bumpar as datas por causa disso faria o
 * sitemap jurar que 19 páginas mudaram para o leitor, que é exatamente a
 * mentira que o comentário no topo deste arquivo existe para evitar.
 *
 * Deixar os 19 avisos de pé também não serve: aviso permanente vira ruído, e
 * ruído esconde o aviso seguinte, que pode ser real.
 *
 * A saída é registrar a exceção com data exata. A auditoria silencia apenas
 * quando o último commit do arquivo é EXATAMENTE essa data — se qualquer
 * mudança nova entrar depois, o commit anda para frente e o aviso volta
 * sozinho. A exceção não vira licença permanente.
 */
export const INTERNAL_ONLY_CHANGES: Array<{
  /** Por que o leitor não viu diferença. Escrito para ser lido daqui a um ano. */
  reason: string;
  /** Data do commit interno (YYYY-MM-DD). Precisa bater exatamente. */
  at: string;
  routes: readonly string[];
}> = [
  {
    reason:
      "Instrumentação da camada de rastreamento de cliques: atributo data-track-area nos landmarks. Não muda texto, layout nem comportamento visível.",
    at: "2026-09-02",
    routes: [
      "/",
      "/calculadoras/",
      "/decisoes-financeiras/",
      "/glossario/",
      "/mapa-do-site/",
      "/taxas/",
      "/calculadoras/a-vista-ou-parcelado/",
      "/calculadoras/comparador-de-propostas/",
      "/calculadoras/consultar-instituicao/",
      "/calculadoras/conversor-de-taxas/",
      "/calculadoras/emprestimo/",
      "/calculadoras/margem-consignavel/",
      "/calculadoras/minha-taxa-esta-cara/",
      "/calculadoras/parcela-no-orcamento/",
      "/calculadoras/plano-para-sair-das-dividas/",
      "/calculadoras/quitacao-antecipada/",
      "/calculadoras/renegociacao-de-dividas/",
      "/calculadoras/sinais-de-golpe/",
      "/calculadoras/trocar-divida/",
    ],
  },
];

/** A rota teve mudança apenas interna nesta data exata? */
export function isInternalOnlyChange(route: string, commitDate: string): boolean {
  return INTERNAL_ONLY_CHANGES.some(
    (entry) => entry.at === commitDate && entry.routes.includes(route),
  );
}

/** Arquivo de página que corresponde a cada rota, para a auditoria conferir. */
export function pageFileForRoute(route: string): string {
  const clean = route.replace(/^\/|\/$/g, "");
  return clean === "" ? "src/app/page.tsx" : `src/app/${clean}/page.tsx`;
}
