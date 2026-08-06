# Processo editorial

## Estados de conteúdo

`idea → briefing → research → draft → fact-check → originality-review →
technical-review → legal-review → approved → scheduled → published →
needs-update → archived`

Definidos em `src/lib/validation/frontmatter.ts` (`EDITORIAL_STATES`). Regras:

- Só `published` entra em listagens, sitemap, feed e busca;
- Qualquer outro estado renderiza com noindex + aviso, e apenas fora de produção;
- Conteúdo financeiro **não** pula de `draft` para `published` sem revisão
  editorial humana — a automação prepara e audita, não aprova;
- Local: schema bloqueia `published` sem dossiê + `lastVerifiedAt`.

## Fluxo por artigo

1. **Intenção**: qual dúvida esta página resolve e por que separada das outras?
   Registrar em `data/query-ownership-map.json` (dono da intenção);
2. **Briefing** (`content/briefings/<slug>.json`, tipo `OriginalityBrief`):
   ângulo próprio, contribuição original, estrutura proposta, páginas que podem
   competir, o que não repetir. Obrigatório antes da redação;
3. **Pesquisa**: hierarquia de fontes (`docs/source-hierarchy.md`);
4. **Redação** em MDX, com estrutura ditada pela intenção — não por molde;
5. **Registro de fontes** (`content/sources/<slug>.json`, tipo `SourceLedger`):
   cada afirmação importante com fonte, tipo e data de consulta;
6. **Auditorias**: `pnpm audit:all` (originalidade, canibalização, metadados,
   fontes, links) — críticos bloqueiam;
7. **Revisão editorial humana** → `published` com `sourceCheckedAt`;
8. **Monitoramento e atualização** (`docs/content-refresh-policy.md`).

## Autoria

Identificação honesta: enquanto não houver especialistas cadastrados, a
autoria é "Equipe Editorial do Crédito Por Perto" (`isTeam: true`), com a
limitação declarada publicamente em /quem-somos/. **Nunca**: inventar nome,
credencial ou "revisado por especialista" sem especialista real.

## Linguagem

Jornalismo financeiro claro: riscos antes de vantagens, exemplos hipotéticos
sempre marcados, nada de "aprovação garantida"/"dinheiro fácil"/urgência
artificial, termos técnicos sempre explicados. Taxas e regras variáveis nunca
apresentadas como universais — usar o componente `WhatCanChange` e registrar
fonte + data.

## Correções

Ver /politica-de-correcoes/ (pública). Erros factuais são corrigidos com
atualização de `updatedAt` e, quando substanciais, nota de correção. Ajustes
cosméticos não alteram datas.
