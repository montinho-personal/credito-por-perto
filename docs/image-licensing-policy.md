# Política de licenciamento de imagens e ativos

## Estado atual

Todos os ativos visuais do portal são **próprios**: nenhum vem de banco de
imagens, de concorrente ou de terceiro licenciado. Eles têm duas origens:

- **desenho vetorial** — logotipos e favicon (`public/brand/`, `src/app/icon.svg`)
  e os ícones inline dos componentes;
- **geração por IA sob direção do proprietário** — as capas e infográficos de
  artigo em `public/images/articles/`, produzidas a partir da identidade visual
  do portal.

Não há fotografia de pessoa real nem ativo de terceiro. Nenhum registro de
licença externa é necessário — o que a tabela abaixo registra é a ORIGEM de
cada ativo, não uma licença comprada.

## Regras para novos ativos

1. **Prioridade**: ilustrações SVG próprias, gráficos e diagramas gerados no
   projeto, capas padronizadas;
2. **Proibido**: copiar imagens/infográficos de concorrentes; usar imagem sem
   licença verificada; remover marca d'água; screenshot sem necessidade e sem
   verificação de autorização; fotos clichê de dinheiro espalhado ou promessas
   visuais de enriquecimento; imitar identidade visual de instituições reais;
3. **Imagem gerada por IA** (o caminho usado nas capas): permitida, com três
   limites que valem mais que a estética — não retratar pessoa que possa ser
   tomada por indivíduo real e identificável, já que a arte ilustra situações
   de dívida e golpe; não imitar identidade visual de instituição financeira
   real; e não representar promessa de resultado (dinheiro chovendo, aprovação
   garantida). Registrar a origem na tabela;
4. **Permitido com registro**: imagens licenciadas (guardar comprovante) e
   domínio público/CC (guardar URL da licença e atribuição exigida);
5. **Registro**: novo ativo de terceiro → adicionar entrada neste arquivo:

```
| arquivo | origem | licença | comprovante/URL | data |
```

| arquivo | origem | licença | comprovante/URL | data |
| --- | --- | --- | --- | --- |
| public/brand/credito-por-perto-*.svg | identidade oficial fornecida pelo proprietário | © Crédito por Perto | docs/brand/INSTRUCOES-PARA-O-CLAUDE.md | 2026-08-06 |
| src/app/icon.svg | favicon da identidade oficial | © Crédito por Perto | docs/brand/ | 2026-08-06 |
| docs/brand/* | manual e pré-visualizações da marca (não publicados) | © Crédito por Perto | — | 2026-08-06 |
| public/images/articles/emprestimo-aposentado-inss-capa.webp | gerada por IA (ChatGPT) sob direção do proprietário | © Crédito por Perto | enviada em 01/09/2026 | 2026-09-01 |
| public/images/articles/como-comparar-propostas-capa.webp | gerada por IA (ChatGPT) sob direção do proprietário | © Crédito por Perto | enviada em 01/09/2026 | 2026-09-01 |
| public/images/articles/lei-superendividamento-capa.webp | gerada por IA (ChatGPT) sob direção do proprietário | © Crédito por Perto | enviada em 01/09/2026 | 2026-09-01 |
| public/images/articles/guia-completo-emprestimo-capa.webp | gerada por IA (ChatGPT) sob direção do proprietário | © Crédito por Perto | enviada em 01/09/2026 | 2026-09-01 |
| public/images/articles/qual-divida-pagar-primeiro-capa.webp | gerada por IA (ChatGPT) sob direção do proprietário | © Crédito por Perto | enviada em 01/09/2026 | 2026-09-01 |
| public/images/articles/app-emprestimo-confiavel-capa.webp | gerada por IA (ChatGPT) sob direção do proprietário | © Crédito por Perto | enviada em 01/09/2026 | 2026-09-01 |

A auditoria de aprovação editorial exige que todo ativo tenha linha nesta
tabela ("nenhum ativo sem registro de licença ou origem").

## Pendência aberta

`public/images/articles/` tem 66 arquivos e a tabela acima cobre 6 — as capas
enviadas em 01/09/2026. As 60 anteriores (capas e infográficos publicados entre
agosto e setembro) entraram sem linha de origem, numa época em que a política
ainda afirmava que todo ativo era desenho vetorial próprio.

Elas seguiram o mesmo caminho das seis novas — PNG grande produzido fora do
repositório e convertido para WebP —, o que sugere a mesma origem, mas isso é
inferência e não registro. Confirmar com o proprietário e completar a tabela,
de uma vez, com a origem real de cada lote.
