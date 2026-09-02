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

/** Arquivo de página que corresponde a cada rota, para a auditoria conferir. */
export function pageFileForRoute(route: string): string {
  const clean = route.replace(/^\/|\/$/g, "");
  return clean === "" ? "src/app/page.tsx" : `src/app/${clean}/page.tsx`;
}
