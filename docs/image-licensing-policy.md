# Política de licenciamento de imagens e ativos

## Estado atual

Todos os ativos visuais do portal são **originais e próprios**, criados para o
projeto: logotipos e favicon (SVG em `public/brand/` e `src/app/icon.svg`) e
ícones inline desenhados à mão nos componentes. Não há fotografias nem ativos
de terceiros. Nenhum registro de licença externa é necessário hoje.

## Regras para novos ativos

1. **Prioridade**: ilustrações SVG próprias, gráficos e diagramas gerados no
   projeto, capas padronizadas;
2. **Proibido**: copiar imagens/infográficos de concorrentes; usar imagem sem
   licença verificada; remover marca d'água; screenshot sem necessidade e sem
   verificação de autorização; fotos clichê de dinheiro espalhado ou promessas
   visuais de enriquecimento; imitar identidade visual de instituições reais;
3. **Permitido com registro**: imagens licenciadas (guardar comprovante) e
   domínio público/CC (guardar URL da licença e atribuição exigida);
4. **Registro**: novo ativo de terceiro → adicionar entrada neste arquivo:

```
| arquivo | origem | licença | comprovante/URL | data |
```

| arquivo | origem | licença | comprovante/URL | data |
| --- | --- | --- | --- | --- |
| public/brand/credito-por-perto-*.svg | identidade oficial fornecida pelo proprietário | © Crédito por Perto | docs/brand/INSTRUCOES-PARA-O-CLAUDE.md | 2026-08-06 |
| src/app/icon.svg | favicon da identidade oficial | © Crédito por Perto | docs/brand/ | 2026-08-06 |
| docs/brand/* | manual e pré-visualizações da marca (não publicados) | © Crédito por Perto | — | 2026-08-06 |
| public/images/articles/emprestimo-aposentado-inss-capa.webp | arte fornecida pelo proprietário | © Crédito por Perto | enviada em 01/09/2026 | 2026-09-01 |
| public/images/articles/como-comparar-propostas-capa.webp | arte fornecida pelo proprietário | © Crédito por Perto | enviada em 01/09/2026 | 2026-09-01 |
| public/images/articles/lei-superendividamento-capa.webp | arte fornecida pelo proprietário | © Crédito por Perto | enviada em 01/09/2026 | 2026-09-01 |
| public/images/articles/guia-completo-emprestimo-capa.webp | arte fornecida pelo proprietário | © Crédito por Perto | enviada em 01/09/2026 | 2026-09-01 |
| public/images/articles/qual-divida-pagar-primeiro-capa.webp | arte fornecida pelo proprietário | © Crédito por Perto | enviada em 01/09/2026 | 2026-09-01 |
| public/images/articles/app-emprestimo-confiavel-capa.webp | arte fornecida pelo proprietário; **contém fotografia de pessoa real** | licença da foto PENDENTE de informação do proprietário | — | 2026-09-01 |

A auditoria de aprovação editorial exige que todo ativo tenha linha nesta
tabela ("nenhum ativo sem registro de licença ou origem").

## Pendência aberta (01/09/2026)

`app-emprestimo-confiavel-capa.webp` é a única das seis capas enviadas em
01/09 que **contém fotografia de uma pessoa real**, e não apenas ilustração
vetorial. As demais são composições gráficas da identidade, sem imagem de
pessoa identificável.

Falta registrar de onde vem essa foto: banco de imagens (com o comprovante da
licença), produção própria (com autorização de uso de imagem da pessoa
retratada) ou geração por IA. Enquanto o registro não existir, esta tabela
guarda a pendência em vez de afirmar uma licença que não foi verificada.
