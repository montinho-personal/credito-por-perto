# Google AdSense

## Estado atual: preparado e desligado

Toda a infraestrutura existe; nenhum anúncio é servido. Ativação exige **duas**
condições simultâneas (`src/lib/adsense/config.ts`):

```
NEXT_PUBLIC_ADSENSE_ENABLED=true
NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-<ID REAL>
```

Sem elas: o script não é injetado, nenhuma requisição sai, nenhuma caixa vazia
aparece, o layout não muda. Em previews do Vercel o script nunca carrega,
mesmo com IDs (checagem de `VERCEL_ENV` no `AdsenseScript`).

## Componente

```tsx
<AdSlot placement="article-inline" pageHasSubstantialContent />
```

Placements: `article-top`, `article-inline`, `article-bottom`, `sidebar`,
`category` — cada um com slot próprio via env (`NEXT_PUBLIC_ADSENSE_SLOT_*`).
A configuração é central: mudar posições não exige editar artigos.

Regras aplicadas pelo componente:

- rótulo "Publicidade" visível;
- `min-height` reservado (previne CLS);
- não renderiza sem conteúdo substancial (`pageHasSubstantialContent`);
- ausente de: rascunhos, 404/erro, busca, páginas legais e institucionais
  (essas páginas simplesmente não incluem o componente).

## Posições ativas hoje

Artigos: `article-top` (após índice/resumo) e `article-bottom` (fim do corpo).
`article-inline` e `sidebar` ficam para ativação posterior, avaliando UX.
Densidade deliberadamente conservadora.

## ads.txt

`/ads.txt` responde 404 até existir Publisher ID real; com o ID configurado,
serve `google.com, pub-…, DIRECT, f08c47fec0942fa0`. **Nunca** inventar ID.

## Checklist de ativação (quando a conta for aprovada)

1. Preencher IDs no ambiente de produção do Vercel;
2. Conferir política de privacidade/cookies atualizadas (listar AdSense);
3. Ativar consentimento para publicidade conforme a CMP escolhida;
4. Deploy, testar CLS e sobreposição em mobile;
5. Verificar `/ads.txt` no domínio canônico.

Critérios editoriais pré-ativação (aditivo, seção 23): conteúdo substancial,
institucionais publicadas, sem locais rasas indexáveis, auditorias verdes.
