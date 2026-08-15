# Crédito por Perto

Portal editorial independente sobre empréstimos, crédito, juros e segurança
financeira. **Crédito explicado. Decisões mais seguras.**

- Domínio canônico: `https://www.creditoporperto.com`
- Stack: Next.js (App Router) · TypeScript estrito · Tailwind CSS v4 · MDX · Zod
- Hospedagem alvo: Vercel

O portal **não** concede, intermedeia ou aprova empréstimos — é um site de
educação financeira, com monetização futura via Google AdSense (desativado por
padrão).

## Como rodar

```bash
pnpm install
pnpm search:index   # gera public/search-index.json (a busca usa esse arquivo)
pnpm dev            # http://localhost:3000
```

## Comandos

| Comando | O que faz |
| --- | --- |
| `pnpm dev` | Servidor de desenvolvimento |
| `pnpm build` | Build de produção |
| `pnpm lint` | ESLint (config Next core-web-vitals, flat config) |
| `pnpm typecheck` | TypeScript sem emitir |
| `pnpm test` | Testes unitários (vitest) — fórmulas, canonical, regras de conteúdo |
| `pnpm audit:all` | Todas as auditorias (originalidade, canonical, canibalização, local, links, metadados, fontes) |
| `pnpm search:index` | Regenera o índice da busca interna |

As auditorias gravam relatórios em `reports/*.json` / `reports/*.html` e saem
com código 1 quando encontram falha crítica — o CI as executa em todo push.

## Estrutura

```
content/            Conteúdo editorial (fora do bundle)
  articles/         Artigos MDX (frontmatter validado por Zod)
  authors/          Autores/identificações editoriais (JSON)
  briefings/        Briefing de originalidade por artigo (obrigatório)
  sources/          Registro de fontes e afirmações por artigo (obrigatório)
  local-guides/     Guias locais MDX (draft + noindex até verificação)
  local-dossiers/   Dossiês locais (LocalEvidence) com pendências de checagem
data/               Estados, localidades e mapa de propriedade de intenção
docs/               Políticas e documentação (ver docs/arquitetura.md)
scripts/            Auditorias e geração de índice de busca (tsx)
src/app/            Rotas (App Router, trailing slash em tudo)
src/components/     Componentes (layout, artigo, conteúdo, calculadora, ads, seo)
src/lib/            Núcleo: content loaders, seo, schema, calculadoras, adsense
tests/              Vitest
```

## Regras que o código impõe (não são só convenção)

- **Estados editoriais:** só `status: published` entra em listagens, sitemap e
  indexação; rascunhos renderizam com `noindex` e aviso visível fora de produção.
- **Páginas locais:** o schema Zod bloqueia `published` sem `dossierId` +
  `lastVerifiedAt`; a auditoria exige fonte oficial e recurso local acionável
  no dossiê. Sem isso, o guia fica `draft` + `noindex` e fora do sitemap.
- **Canonical:** sempre absoluta, HTTPS, `www`, trailing slash — helper único
  em `src/lib/seo/canonical.ts`, auditada por `audit:canonical`.
- **AdSense:** desativado até `NEXT_PUBLIC_ADSENSE_ENABLED=true` **e** client
  ID real. Sem IDs: nenhum script, nenhuma caixa vazia. Nunca em previews.
- **Previews do Vercel:** `VERCEL_ENV !== production` adiciona
  `X-Robots-Tag: noindex, nofollow, noarchive` a todas as rotas e o robots.txt
  bloqueia tudo.
- **Datas:** `updatedAt` nunca é alterado por build/deploy — só por mudança
  editorial real (ver `docs/content-refresh-policy.md`).

## Documentação

Comece por `docs/arquitetura.md`. Políticas: originalidade, plágio, canonical,
conteúdo local, hierarquia de fontes, propriedade de intenção, atualização de
conteúdo, uso de IA e licenciamento de imagens — todas em `docs/`.

Pendências que dependem do proprietário: `PENDENCIAS_CRITICAS.md`.
Publicação: `docs/publicacao-vercel.md`.
