# Áreas protegidas de anúncio

Complementa `docs/adsense.md`, que trata da configuração. Este documento trata
de **onde um anúncio não pode aparecer**, e por quê.

Os anúncios seguem desativados até o proprietário fornecer IDs reais. Este
documento existe para que a ativação, quando vier, não desfaça por descuido
uma decisão de produto.

## O problema que estas áreas resolvem

Um anúncio de rede não é escolhido por nós, mas é lido pelo visitante como
parte da página. Numa página que **sugere um próximo passo**, um bloco
retangular com um botão, entre dois blocos retangulares com botões, é
indistinguível de uma das sugestões.

O caso extremo não é hipotético: alguém que acabou de clicar em *"estou com
várias dívidas"* é exatamente o perfil que a rede vai servir com
*"empréstimo para negativado, aprovação imediata"*. Se esse anúncio aparecer
entre os passos do caminho, o site estará dizendo, com sua própria voz, que
aquele é o próximo passo recomendado. Não é. E nenhuma etiqueta
"Publicidade" desfaz a leitura.

## As cinco áreas

Marcadas no HTML com `data-no-ads="<área>"` e verificadas pela auditoria
`pnpm audit:jornadas`.

| Área | Onde vive | Regra |
| --- | --- | --- |
| `decision-hub` | `/decisoes-financeiras/` e o bloco da home | Nenhum anúncio na página inteira |
| `journey-selector` | Cards de momento | Nada entre a pergunta e as opções |
| `journey-step` | Passos de uma jornada | Nada entre passos |
| `next-step` | Bloco "E agora?" das ferramentas | Nada entre a sugestão e o botão |
| `safety-flow` | Jornada de suspeita de golpe e a ferramenta de sinais | Nenhum anúncio, em nenhuma posição |

Na prática, `decision-hub` cobre o hub inteiro, e por isso `journey-selector`
e `journey-step` não precisam de marcação própria hoje — elas existem no
vocabulário para o caso de uma jornada ganhar página própria no futuro.

## O que a auditoria verifica

`scripts/audit-journeys.ts` falha como **crítico** quando:

- um arquivo da lista perde o atributo `data-no-ads`;
- qualquer arquivo do fluxo de decisão importa `AdSlot` ou `adsbygoogle`.

## Onde anúncio pode aparecer

Depois de blocos completos de conteúdo editorial, nas páginas de artigo, como
já ocorre hoje — os placements `article-top`, `article-inline`,
`article-bottom`, `sidebar` e `category` de `src/lib/adsense/config.ts`.

## Auto Ads

Quando o Auto Ads for ativado, as áreas acima precisam ser excluídas no painel
do AdSense, por URL (`/decisoes-financeiras/`) e por seletor. O atributo
`data-no-ads` não é lido pelo Google: ele é a marcação interna que permite à
auditoria detectar a regressão do nosso lado. A exclusão de fato é
configuração da conta, e é responsabilidade de quem ativar.

## A métrica certa

O objetivo da Central não é aumentar o número de anúncios exibidos, e sim a
**receita por jornada** — pessoas que resolvem o que vieram resolver, voltam
e leem mais. Criar etapa artificial, quebrar uma jornada em várias URLs ou
sugerir uma ferramenta que não ajuda, só para gerar impressão, são todas
formas de trocar essa métrica pela errada.
