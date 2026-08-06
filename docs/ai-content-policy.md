# Política de uso de IA na produção de conteúdo

## Posição pública

Declarada em /quem-somos/: ferramentas de IA são usadas como apoio
(estruturação, rascunho, revisão de clareza, organização de dados). Nenhum
conteúdo é publicado sem verificação e revisão editorial humana das
afirmações factuais. A responsabilidade editorial é sempre do portal.

## Regras internas

1. IA não inventa: taxas, órgãos, URLs, estudos, especialistas, depoimentos,
   dados locais. Afirmação factual só entra com fonte no `SourceLedger`;
2. IA não aprova: os estados `fact-check` → `published` exigem revisão humana;
   conteúdo de alto impacto financeiro nunca vai ao ar por automação;
3. Saída de IA passa pelas mesmas auditorias de originalidade — o problema de
   "texto-molde" é exatamente o que `audit:originality` detecta (estruturas
   repetidas, expressões genéricas recorrentes, introduções clonadas);
4. Reescrever concorrente com IA **não** é originalidade (ver
   `docs/originality-policy.md`) — pesquisa parte de fontes primárias;
5. Exemplos numéricos gerados são verificados por código (as fórmulas dos
   artigos têm testes em `tests/loan-calculator.test.ts` que validam os
   números citados no texto);
6. Vieses e promessas: a revisão humana confere tom (sem urgência artificial,
   sem "garantido"), conforme a política editorial.

## Transparência

Se a regulação ou as diretrizes de plataformas passarem a exigir rotulagem
específica de conteúdo assistido por IA, a página /quem-somos/ e este
documento serão atualizados — a posição padrão do portal já é declarar o uso.
