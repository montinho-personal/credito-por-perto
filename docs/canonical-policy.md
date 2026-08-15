# Política de canonicalização

## Regras obrigatórias

Toda página indexável e independente tem canonical **autorreferencial**,
presente no HTML inicial (Metadata API, nunca alterada por JS), com:

- URL absoluta em `https://www.creditoporperto.com`;
- HTTPS, `www`, trailing slash (padrão único do projeto);
- destino 200, indexável, nunca redirect/404/soft-404/noindex/bloqueada;
- coerência total com sitemap, links internos e redirects.

Implementação central: `src/lib/seo/canonical.ts` (`canonicalUrl` +
`isValidCanonical`). Nenhuma página monta canonical manualmente.

## Duplicadas legítimas

Definir a versão oficial; usar redirect 308 quando a alternativa não precisa
existir; `rel=canonical` quando precisa continuar acessível; links internos e
sitemap apontam só para a canônica; **nunca** usar robots.txt para
canonicalizar nem enviar sinais conflitantes.

## Páginas locais

Guia local único → canonical para si mesmo. Proibido apontar cidade
automaticamente para estado, página nacional, home, outra cidade ou página
genérica. Locais parecidas demais não se resolvem com canonical: decidir qual
deve existir, consolidar, redirecionar ou manter como rascunho.

## Paginação e parâmetros

- Páginas 2+ de paginação não apontam automaticamente para a página 1 —
  avaliação caso a caso (hoje não há paginação indexável);
- Parâmetros (UTM, ads, busca `?q=`, ordenação, filtros, preview, session id,
  desconhecidos) **não criam páginas indexáveis**: o canonical builder remove
  query/fragment, e `/busca/` é noindex. Parâmetros de rastreamento chegam a
  URLs cujo canonical continua limpo.

## Auditoria (`scripts/audit-canonical.ts`)

Verifica: canonical ausente/inválida/não autorreferencial, duplicada entre
páginas, sitemap com URL fora da política, sitemap incluindo rascunho ou
noindex, sitemap omitindo publicada, links internos fora do padrão de trailing
slash, canonical customizada para URL desconhecida, e presença do
X-Robots-Tag de preview na configuração. **Falha crítica = exit 1 = build de
produção interrompido no CI.** Relatórios em `reports/canonical-report.{json,html}`.
