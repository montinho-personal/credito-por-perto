# Busca interna

## Arquitetura

- **Motor**: [MiniSearch](https://github.com/lucaong/minisearch) (~7 KB gzip,
  zero dependências), rodando 100% no navegador. Escolhido porque o site é
  estático: sem servidor de busca, sem mensalidade, sem latência de rede por
  tecla e sem enviar a consulta (tema financeiro, sensível) a terceiros.
- **Índice**: `public/search-index.json`, gerado no build por
  `scripts/generate-search-index.ts` a partir de `src/lib/search/build-docs.ts`.
  Novo artigo/guia publicado entra automaticamente (o script roda no
  `pnpm search:index`, parte do pipeline de build). Institucionais ficam fora.
- **Lazy**: nada da busca entra no bundle inicial. O modal é `dynamic()` e o
  motor + índice só são baixados quando o usuário abre a busca (uma vez por
  navegação; o JSON é cacheável pelo CDN/navegador).
- **Escala**: hoje o índice tem ~45 docs (±100 KB). O corpo é truncado
  (`CONTENT_MAX_CHARS`). Acima de ~2–3 mil páginas: serializar o índice
  pré-construído (`MiniSearch.loadJSON`) e/ou particionar por tipo, mantendo
  a mesma API de `loadSearchEngine()`.

## Onde a busca aparece

- **Header** (desktop e mobile): lupa → modal (componente `SearchTrigger`);
- **Home**: campo no hero + chips sugeridos (`SearchBox`);
- **404**: campo de recuperação;
- **/busca/**: página completa (`SearchClient`) com `?q=`, contagem,
  filtros por tipo e destaque — `noindex, follow` (nunca entra no sitemap).
- **Atalhos**: `/` e `Cmd/Ctrl+K` abrem; `↑/↓` navegam; `Enter` abre;
  `Esc` fecha; foco volta ao gatilho.

## Ranking

Pesos por campo em `src/lib/search/engine.ts` (`FIELD_BOOSTS`): título e
cidade (8) > keywords (6) > tags (5) > headings (3) > descrição (2) >
corpo (0,6). Reforços de documento: guia local cuja cidade aparece na
consulta (×2,5) e páginas `featured` (pilares, ×1,35). Pipeline: AND →
fallback OR → sinônimos com peso reduzido (35% + merge a 50%).

## Normalização, sinônimos e fuzzy

- `normalize.ts`: minúsculas, sem acento, sem pontuação ("Empréstimo" ≡
  "emprestimo");
- `synonyms.ts`: grupos estreitos e controlados (CET ↔ custo efetivo
  total, negativado ↔ nome sujo etc.). Regra: na dúvida, **não** adicionar
  — sinônimo genérico degrada o ranking;
- Fuzzy: só termos com 5+ letras, distância 20% ("consigando" →
  consignado). Prefixo ativo ("consig" já encontra).

## Privacidade e analytics

A consulta bruta **nunca** sai do navegador. Eventos GA4 (só após
consentimento, via `components/search/analytics.ts`): `search_open`
(source), `search_performed` (results_count, query_length),
`search_result_click` (position, type), `search_no_results` — sem o texto.
Buscas sem resultado podem ser acompanhadas futuramente pelo evento
`search_no_results` por origem.

## Como manter

- **Campo pesquisável novo**: adicionar em `build-docs.ts` (doc) +
  `engine.ts` (fields/boost) + regenerar índice;
- **Sinônimo novo**: `synonyms.ts` (grupo estreito);
- **Peso**: `FIELD_BOOSTS`/`boostDocument` em `engine.ts` — ajustar SEMPRE
  com os testes de ranking (`tests/search-engine.test.ts`), que rodam
  contra o conteúdo real e verificam "o resultado certo vem primeiro".
- **Testar**: `pnpm vitest run tests/search-engine.test.ts`.
