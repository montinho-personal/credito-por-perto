# Política de atualização de conteúdo

## Regra central

`updatedAt` **nunca** muda automaticamente — não em build, não em deploy, não
em ajuste visual. A data de atualização significa "houve mudança editorial
relevante", e só isso. O sitemap usa `updatedAt ?? publishedAt` do
frontmatter, nunca timestamps de build.

## Justifica nova data

Correção factual; nova regra ou taxa; mudança regulatória; nova metodologia;
inclusão de seção relevante; revisão substancial; atualização de fontes
(reflete também em `sourceCheckedAt`).

## Não justifica

Correção de espaço/gramática pontual, ajuste de cor ou classe CSS, troca de
componente, troca de anúncio, build/deploy.

## Mecânica

- Datas em `content/articles/*.mdx` (frontmatter) são editadas manualmente
  junto com a mudança;
- `audit:metadata` bloqueia datas futuras e `updatedAt < publishedAt`;
- `audit:sources` aponta claims com consulta > 180 dias para re-verificação —
  esse relatório é a fila de manutenção editorial;
- Correções substanciais recebem nota no corpo do artigo (histórico de
  mudanças relevantes), conforme a política de correções pública.

## Ciclo sugerido

Trimestral: rodar `pnpm audit:sources`, re-verificar claims apontados,
atualizar `sourceCheckedAt`/`updatedAt` apenas onde houve mudança real, e
registrar no ledger a nova data de consulta.
