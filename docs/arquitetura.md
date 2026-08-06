# Arquitetura

## Visão geral

Next.js App Router com geração estática (SSG) para todo o conteúdo. O conteúdo
editorial vive em MDX no repositório (`content/`), validado por Zod na carga —
frontmatter inválido quebra o build, de propósito. A arquitetura separa três
camadas para permitir migração futura a um CMS sem reescrever o front-end:

1. **Fonte de conteúdo** (`content/` + loaders em `src/lib/content/`) — única
   camada que sabe que o conteúdo está em arquivos;
2. **Regras de negócio** (`src/lib/`) — canonical, sitemap, estados editoriais,
   regras locais, cálculo financeiro, AdSense;
3. **Apresentação** (`src/app/`, `src/components/`) — consome apenas as
   interfaces das camadas anteriores.

Para migrar a um CMS, basta reimplementar os loaders (`getAllArticles`,
`getAllLocalGuides`, `getBriefing`, `getSourceLedger`) mantendo os tipos.

## Rotas

| Rota | Conteúdo |
| --- | --- |
| `/` | Homepage editorial |
| `/emprestimos/` | Hub de modalidades + link para guias locais |
| `/emprestimos/[slug]/` | Artigo da categoria **ou** índice de estado (se o slug for UF com guias) |
| `/emprestimos/[uf]/[cidade]/` | Guia local municipal |
| `/emprestimos/[uf]/[cidade]/[bairro]/` | Guia local de bairro/região (ex.: Alphaville) |
| `/emprestimos/guias-locais/` | Índice de guias locais + critérios de publicação |
| `/juros-e-cet/`, `/credito-seguro/`, `/organizacao-financeira/` (+`/[slug]/`) | Demais categorias |
| `/calculadoras/emprestimo/` | Calculadora Price com amortização |
| `/artigos/` | Blog (todos os publicados) |
| `/glossario/`, `/busca/` (noindex), `/mapa-do-site/` | Utilitárias |
| `/sobre/`, `/quem-somos/`, `/politica-*`, `/termos-de-uso/`, etc. | Institucionais/legais |
| `/sitemap.xml`, `/robots.txt`, `/feed.xml`, `/ads.txt` | Técnicas |

A colisão `/emprestimos/[slug]` (artigo vs UF) é resolvida em runtime: se o
slug é um código de UF presente em `data/states.json` **e** há guias para o
estado, renderiza o índice estadual; caso contrário, artigo. `dynamicParams =
false` garante 404 para qualquer slug não gerado.

## Decisões principais

- **Trailing slash único** (`trailingSlash: true`) — refletido em canonical,
  sitemap e links internos; auditado.
- **next-mdx-remote com `blockJS: false`**: o conteúdo é de primeira parte
  (repositório), e os componentes editoriais recebem props de array
  (`items={[...]}`); o bloqueio de chamadas perigosas continua ativo.
- **Sem biblioteca de UI externa** — Tailwind v4 com tokens semânticos da marca
  em `src/styles/globals.css` (`--color-brand-*`). Nenhum hex solto em componente.
- **Fontes** via `next/font` (Inter + Source Serif 4), sem requisição de fonte
  no navegador do usuário.
- **Busca client-side** sobre `public/search-index.json` gerado por script —
  nada digitado é enviado ao servidor.
- **Segurança**: headers CSP/HSTS/nosniff/Permissions-Policy em
  `next.config.ts`; sem coleta de dados financeiros; calculadora 100% local.

## Fluxo de qualidade

`pnpm lint` → `pnpm typecheck` → `pnpm test` → `pnpm audit:all` → `pnpm build`
(tudo no CI, `.github/workflows/ci.yml`). Auditorias com falha crítica quebram
o pipeline — ver `docs/originality-policy.md` e `docs/canonical-policy.md`.
