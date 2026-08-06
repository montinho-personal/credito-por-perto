# Análise de concorrentes

> **Status: primeira varredura ao vivo realizada em 06/08/2026** (10 consultas
> na SERP brasileira). Achados abaixo; pauta priorizada derivada em
> `docs/pauta-seo.md`. Repetir a coleta antes de cada novo lote de conteúdo.

## Achados da varredura de 06/08/2026

| Consulta | Quem domina | Lacuna identificada |
| --- | --- | --- |
| empréstimo pessoal como funciona | Bancos/fintechs (Serasa, Inter, BMG, PicPay, Mercado Pago) | Conteúdo raso e vendedor; nenhum resultado neutro com método de comparação. Head term difícil — atacar pela cauda |
| consignado CLT novas regras 2026 / crédito do trabalhador | Blogs B2B de RH (Senior, Forte, Convenia) e fintechs | **Grande lacuna**: quase nada escrito para o trabalhador (Lei nº 15.179, eConsignado via CTPS Digital, garantia FGTS/multa, o que acontece na demissão) |
| golpe do empréstimo consignado | Blogs de bancos (BV, BB, Pan, PagBank, Serasa) | Conteúdo genérico e com conflito de interesse; falta guia neutro com canais de denúncia e caso do desconto não autorizado |
| antecipação saque-aniversário vale a pena | Bancos + portais | Regras novas (limite de parcelas/valores, carência) mal explicadas; decisão de adesão tratada junto com antecipação — são intenções distintas |
| juros abusivos / revisão de contrato | Escritórios de advocacia (Jusbrasil, Migalhas, sites .adv.br) | **Lacuna forte**: explicador neutro do parâmetro do STJ (1,5× a média) + passo a passo de consulta às taxas médias do BC, sem captação de cliente |
| empréstimo negativado sem consulta | Lead-gen e fintechs dizendo "é confiável" | SERP empurra o leitor ao risco; resposta honesta ("não existe sem análise") diferencia e protege |
| cartão de crédito consignado | Conteúdo vendedor ("vale a pena sim") | Falta contraponto neutro: trava de margem, RMC, desconto mínimo automático, dificuldade de quitação |
| Pix parcelado | Portais de finanças e B3/Idec começando a cobrir | Modalidade nova; comparativos de custo com CET ainda rasos |
| margem consignável consultar | Simuladores de fintechs (Konsi, meutudo, RecargaPay) | Guia neutro de consulta (Meu INSS/CLT) + calculadora própria compete bem |
| dívida caduca 5 anos / nome limpo | Serasa, SPC, meutudo, CNN | Volume alto; nuance "negativação sai, dívida continua" mal explicada — encaixa no cluster negativado |
| taxa média de juros BC | Notícias mensais (InfoMoney, CNN, Procon-SP) | Consultas respondidas por matérias datadas — página viva com dados do BC ranqueia se houver rotina mensal |

## Padrões transversais observados

1. **Conflito de interesse é a regra**: quase toda a SERP financeira é de quem
   vende crédito ou capta causas judiciais. Neutralidade + fontes oficiais é o
   nosso espaço defensável;
2. **Frescor regulatório derruba incumbentes**: consignado CLT e FGTS mudaram;
   páginas antigas seguem ranqueando com informação defasada — janela aberta;
3. **Perguntas específicas rankeiam sites pequenos**: nas caudas
   (caduca/margem/golpe específico) aparecem blogs modestos — sinal de baixa
   dificuldade;
4. **Freshness recorrente vence em consultas de taxa**: quem atualiza
   mensalmente com dados do BC domina essas SERPs.

## Buscas a mapear

empréstimo · empréstimo pessoal · melhor empréstimo pessoal · como funciona
empréstimo · empréstimo para negativado · empréstimo consignado · empréstimos
em campinas · empréstimos em alphaville · simulador de empréstimo · taxa de
juros de empréstimo · como evitar golpe de empréstimo

## Concorrentes a analisar (quando houver acesso)

Serasa · iDinheiro · Mobills · Juros Baixos · FinanZero · Creditas ·
MelhorTaxa · bancos e cooperativas · portais jornalísticos · órgãos oficiais ·
quaisquer resultados bem posicionados no momento da análise.

## Grade de registro (preencher por concorrente)

- Estrutura de navegação e clusters;
- Tipos de página e profundidade dos conteúdos;
- Recursos interativos (simuladores, comparadores);
- Pontos fortes / fragilidades / lacunas de conteúdo;
- Padrões de títulos; uso e transparência de fontes;
- Transparência editorial (autoria, datas, metodologia);
- Estratégias locais (existem páginas locais? são rasas?);
- Monetização visível; experiência mobile; performance aparente.

## Hipóteses de diferenciação já embutidas no produto

(Independem da análise e foram implementadas; a análise ao vivo serve para
refiná-las, não para copiá-las de ninguém.)

1. **Educação antes de conversão**: nenhum CTA de "pedir empréstimo"; o portal
   não coleta lead — confiança como ativo de longo prazo;
2. **Transparência radical de fontes**: registro de fontes com data em todo
   artigo, verificação visível (`LastVerifiedBadge`);
3. **Segurança como cluster de primeira classe** (golpes, verificação de
   instituições) — área tipicamente rasa em sites comerciais;
4. **SEO local com critério**: guias locais só com valor verificado, contra o
   padrão de páginas de cidade gerados em massa;
5. **Métodos próprios acionáveis**: "cinco números", roteiros nomeados de
   golpe, quadros "o que pode mudar" — conteúdo que ferramenta nenhuma copia
   sem esforço.

## Processo

Repetir a análise por trimestre ou antes de cada novo lote de conteúdo;
registrar data de cada coleta; alimentar `data/query-ownership-map.json` com
intenções descobertas.
