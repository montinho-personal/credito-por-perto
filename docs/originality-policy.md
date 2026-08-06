# Política de originalidade

## Princípio central

Originalidade é **editorial e informacional**, não lexical. Não torna um
conteúdo original: trocar sinônimos, reordenar parágrafos ou subtítulos,
trocar o nome da cidade, nova introdução genérica, tabela reorganizada,
tradução/retradução, resumo de concorrente, reescrita por IA, nem "X% de
palavras diferentes". Cada página precisa de uma razão própria para existir.

Antes de criar qualquer artigo, o briefing (`content/briefings/`) responde:
qual dúvida específica resolve? por que separada das existentes? qual
contribuição própria oferece? qual intenção de busca? com quem compete?
criar, incorporar ou descartar? Sem resposta convincente → não produzir
(`publicationDecision: "discard"`).

## Variação editorial real

A estrutura nasce da intenção, não de um molde: um explainer de CET abre com
duas propostas aparentemente iguais; um guia de golpe abre pelo sinal mais
importante; um guia de decisão abre por quando evitar; suporte de calculadora
abre pelo resultado que o leitor obterá. Proibido reutilizar sistematicamente
a mesma sequência de H2, a mesma introdução, a mesma conclusão, as mesmas
FAQs, os mesmos exemplos ou o mesmo CTA. Consistência visual sim; uniformidade
textual artificial não. A variação vem da necessidade do leitor, não de
randomização.

## Auditoria automática (`scripts/audit-originality.ts`)

Compara somente conteúdo editorial (ignora header, footer, navegação,
breadcrumbs, publicidade, avisos padronizados, caixas de autoria e componentes
compartilhados). Métodos: normalização + shingles de 5 palavras + Jaccard,
TF-IDF/cosseno, comparação de parágrafos exatos, sequência de headings e teste
específico de páginas locais com o nome da localidade removido.

**Bloqueia (crítico, quebra o CI):** título/H1 ou description duplicados;
introdução ou conclusão idênticas; parágrafos exatos repetidos; corpo quase
idêntico (shingles > 0,6); página local que só troca o nome (sim. > 0,7).

**Alerta (warning, revisão humana):** títulos muito semelhantes, introduções
parecidas (>0,5), corpos com sobreposição relevante (shingles > 0,25 ou
cosseno > 0,85), sequência de headings idêntica, expressões genéricas de IA
recorrentes ("no cenário atual", "você já se perguntou", etc. — lista no
script). Limites numéricos são gatilhos de revisão, não veredictos.

Relatórios: `reports/originality-report.json` e `.html` (páginas comparadas,
tipo de semelhança, pontuação, trechos, recomendação).

## Valor além do texto

Todo conteúdo principal oferece ao menos uma contribuição própria: checklist,
exemplo numérico original, tabela própria de dados primários, método
("cinco números"), taxonomia ("cinco roteiros de golpe"), calculadora,
quadro "o que pode mudar". Nada de enfeite para simular profundidade.
