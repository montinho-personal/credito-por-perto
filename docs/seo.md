# SEO técnico

## Domínio canônico

`https://www.creditoporperto.com` — HTTPS, com `www`, trailing slash.

- HTTP→HTTPS: automático no Vercel;
- apex→www: redirect 308 em `next.config.ts` (host match) + configuração de
  domínio no Vercel (ver `docs/publicacao-vercel.md`);
- Canonical builder único: `src/lib/seo/canonical.ts` (rejeita query/fragment,
  força trailing slash). Validador `isValidCanonical` usado por testes e auditoria.

## Metadados

`buildMetadata` (`src/lib/metadata/build.ts`) gera título, descrição,
canonical absoluta, robots, Open Graph e Twitter Cards. Título raiz com
template `%s | Crédito por Perto`. Unicidade de título/descrição é testada
(`tests/content-rules.test.ts`) e auditada (`audit:metadata`).

## Dados estruturados (JSON-LD)

`src/lib/schema/jsonld.ts`: Organization, WebSite, Article, BreadcrumbList,
WebPage. **Proibidos por política**: AggregateRating/avaliações,
LocalBusiness e FinancialService (o portal não é instituição financeira),
qualquer marcação sem correspondência com o conteúdo visível.

## Sitemap e robots

- `src/app/sitemap.ts` ← `getSitemapEntries()`: somente URLs canônicas,
  publicadas e indexáveis. Rascunhos, noindex, busca e guias locais não
  aprovados ficam fora (testado).
- `src/app/robots.ts`: produção libera tudo exceto `/busca/` e `/api/`;
  qualquer ambiente não-produção bloqueia o site inteiro.

## Previews do Vercel

Quando `VERCEL_ENV !== "production"`:

- header `X-Robots-Tag: noindex, nofollow, noarchive` em todas as rotas;
- robots.txt bloqueia tudo;
- AdSense nunca carrega (checagem dupla no `AdsenseScript`);
- rascunhos ficam visíveis para revisão (com aviso), o que é seguro pois todo
  o ambiente é noindex.

## RSS e outros

- `/feed.xml`: RSS 2.0 com os 30 artigos mais recentes;
- Breadcrumbs visíveis + BreadcrumbList em todas as páginas de conteúdo;
- H1 único por página; headings extraídos para o índice do artigo;
- Página 404 útil com rotas de recuperação; `/busca/` com noindex;
- `/ads.txt` responde 404 até haver Publisher ID real (nunca inventado).

## Cabeçalhos de segurança

CSP compatível com Next + GA4/GTM/AdSense (domínios liberados explicitamente),
HSTS, nosniff, X-Frame-Options DENY, Permissions-Policy restritiva. Ajustes na
CSP devem ser testados em preview antes de produção — não adote diretivas que
quebrem silenciosamente scripts legítimos.

## Imagens: nome de arquivo e sitemap

Duas coisas costumam ser confundidas como se fossem a mesma.

**O nome do arquivo é sinal — fraco, mas real.** O Google diz que o nome "dá
pistas sobre o assunto da imagem" e pede nome curto e descritivo. O padrão do
portal é `<slug-da-página>-capa.webp`, e `pnpm audit:metadata` avisa quando uma
capa foge dele. É aviso, não crítico: quebrar o build por um sinal fraco seria
desproporcional — mas 26 das 39 capas já tinham nascido com nome abreviado à
mão, e ninguém percebeu por um mês porque nada olhava.

Guia local é a exceção prevista: o slug da URL é só a cidade
(`/emprestimos/sp/campinas/`) e o arquivo carrega cidade + intenção
(`emprestimo-em-campinas-sp.webp`), que é mais descritivo do que o slug. Basta
conter a cidade.

**O texto dentro da arte não é sinal de ranqueamento.** O Google usa o `alt`,
o conteúdo ao redor e visão computacional sobre a figura — não OCR do letreiro.
As capas trazem o título embutido por razão de **compartilhamento**: no
WhatsApp e no LinkedIn o card mostra a imagem, e capa com título legível
converte melhor. É decisão de social, não de SERP.

O erro correlato seria repetir o título no `alt`. O Google avisa contra `alt`
recheado de palavra-chave, e o leitor de tela ouviria a mesma frase duas vezes
logo depois do H1. Por isso os `alt` do portal descrevem a ILUSTRAÇÃO.

**O sitemap declara as capas.** Cada URL com `featuredImage` sai com
`<image:image>`; página sem capa não ganha entrada vazia. São 59 hoje (39
artigos + 20 guias). O JSON-LD do `Article` já mandava `image`, mas o sitemap
de imagens é o canal direto de descoberta — e estava fechado num site cujo
problema medido no Search Console é exatamente rastreamento.
