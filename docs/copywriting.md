# Playbook de copywriting — padrão "primeira posição"

## 0. A régua da leveza (regra do proprietário, 16/08/2026 — vale acima de tudo)

O leitor comum precisa entender **sem esforço**. Auditado por
`pnpm audit:readability` (média ≤ 22 palavras/frase; ≤ 15% de frases com
30+ palavras; ≤ 1,2 travessões/100 palavras).

- **Frases curtas.** Uma ideia por frase. Ponto final é seu melhor amigo.
  Se a frase pede vírgula dupla ou travessão para caber, quebre em duas;
- **Travessão é exceção**, não tempero. Nada de comentário dentro de
  comentário. Reescreva o aparte como frase própria;
- **Conversa, não palestra.** Escreva como quem explica por áudio de
  WhatsApp para um amigo: "você", verbos concretos, zero pompa;
- **Exemplo antes da regra.** Primeiro a cena ("você pega R$ 1.000..."),
  depois o conceito. Analogia do dia a dia para todo conceito difícil;
- **Parágrafos que respiram**: 2 a 3 frases. Assunto novo, parágrafo novo;
- **Teste do áudio**: leia em voz alta. Onde faltar fôlego, falta ponto
  final.

Vale para **todo** artigo do portal (nacional e local). O objetivo é sempre o
mesmo: ser o resultado que o Google escolhe como resposta e o texto que o
leitor termina de ler.

## 1. Título (SERP é a primeira dobra)

- A intenção exata do leitor nas primeiras palavras, do jeito que ele busca
  ("Empréstimo em Barueri (SP): …", não "Guia completo sobre crédito…");
- Uma especificidade que os concorrentes não têm: número, contraponto ou
  promessa verificável ("…e a armadilha da margem", "…o que muda de verdade");
- ≤ 60 caracteres para não truncar; sem clickbait — o título promete só o
  que o artigo entrega.

## 2. Primeiros 50 palavras: a resposta direta

O primeiro parágrafo responde a pergunta central em 40–55 palavras, no tom de
quem explica para um amigo. É o trecho que o Google recorta para o snippet em
destaque — escrever pensando nisso, sem enrolação de "no mundo de hoje…".

## 3. Estrutura que o Google lê

- H2s formulados como as perguntas reais do "As pessoas também perguntam";
- Um assunto por seção; parágrafos de 2–4 linhas; listas e tabelas quando o
  conteúdo é comparável;
- Tabela comparativa escaneável em todo artigo de decisão (modalidade A × B);
- **FAQ obrigatório** em todo artigo (regra do proprietário, 16/08/2026):
  seção final "Perguntas frequentes" com as dúvidas de cauda longa que não
  viraram H2 — respostas diretas de 2–4 frases, cada uma completa em si
  (o Google recorta FAQs individualmente);
- Completude: o leitor não deve precisar de outra busca para agir. Antes de
  fechar, perguntar: "que dúvida ainda faria o leitor voltar ao Google?"

## 4. A língua do leitor, os termos da autoridade

Falar "nome sujo", "dinheiro na conta", "desconto em folha" — e apresentar o
termo técnico uma vez, entre parênteses, para rankear pelos dois ("restrição
no CPF", "margem consignável"). Jargão nunca aparece sem tradução.

## 5. Prova em vez de adjetivo

- Todo número tem fonte primária linkada (BC, Planalto, gov.br, Caixa) e
  data de verificação;
- Nada de "taxas baixíssimas", "melhor opção" — o diferencial editorial é
  ser o único da SERP **sem** nada a vender;
- Exemplos com contas completas (o leitor confere no papel — e a calculadora
  do site fecha com o artigo).

## 6. Persuasão honesta (AIDA adaptado a conteúdo informacional)

- **Atenção**: título + resposta direta;
- **Interesse**: o custo escondido / o detalhe que ninguém explica;
- **Desejo**: "como fazer certo" com passo a passo acionável;
- **Ação**: CTA interno — calculadora, artigo do cluster, checklist. Nunca
  CTA de venda de produto financeiro.

## 7. Sinais de frescor

`updatedAt` visível, `sourceCheckedAt` real, revisão trimestral do que cita
regra volátil. Atualização de verdade (conteúdo), nunca só a data.

## 8. Regras específicas dos guias locais

- Hiperespecificidade verificável: o guia cita o que só existe naquela
  cidade (endereço do Procon municipal, cooperativas que atuam ali,
  particularidades do comércio local) — tudo com fonte no dossiê;
- Teste de fogo antes de publicar: **trocando o nome da cidade, o texto
  quebra?** Se não quebra, não publica;
- O leitor local percebe em 5 segundos que quem escreveu conhece a cidade —
  esse é o diferencial impossível de os agregadores copiarem.

## 9. Checklist de publicação (todo artigo)

- [ ] Título com intenção exata + especificidade (≤ 60 chars)
- [ ] Resposta direta nos primeiros 50 palavras
- [ ] H2s cobrindo as perguntas do "As pessoas também perguntam"
- [ ] ≥ 2 links internos estratégicos + ≥ 1 fonte oficial externa
- [ ] Números com fonte primária e data
- [ ] Tabela ou lista comparativa quando há decisão
- [ ] CTA interno (calculadora ou cluster)
- [ ] Auditorias verdes (`pnpm audit:all`)
