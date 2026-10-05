# Linha de base de SEO: revisão por intenção de busca (out/2026)

Registro para comparar, cerca de um mês depois, o efeito da revisão por intenção de busca
(SERP real) feita entre 24/09/2026 e 01/10/2026.
A série continua; cada nova página revisada entra nas duas tabelas com a sua data. Cada página revisada aparece abaixo com a data
em que foi ao ar, o commit, e o title e a description de antes e de depois.

## Como medir

**Fonte das métricas:** Google Search Console, propriedade `https://www.creditoporperto.com/`,
relatório Desempenho → Resultados da pesquisa, tipo "Web", filtrado por página (URL exata).

**Janelas de comparação (28 dias cada, mesmos dias da semana):**

| Janela | Período | Papel |
| --- | --- | --- |
| Antes | 03/09/2026 a 30/09/2026 | linha de base, antes da maioria das mudanças |
| Depois | 02/10/2026 a 29/10/2026 | o mês seguinte à última leva (01/10); leitura em 01/11/2026 |
| Depois (2ª leitura, opcional) | 02/11/2026 a 29/11/2026 | com mais tempo de reindexação; leitura em 01/12/2026 |

Páginas mudadas em 24 e 25/09 já têm alguns dias de "depois" dentro da janela "Antes". Para elas,
use também a janela 27/08 a 23/09 se houver dados.

**Métricas por página:** cliques, impressões, CTR e posição média. Por consulta, para as páginas
com mais impressões: as 10 principais consultas de cada janela.

**Cuidados na leitura:**
- o site é novo (primeiras páginas em 05/08/2026), então parte de qualquer alta vem só da
  maturação natural do domínio. Compare com as páginas **não** revisadas no mesmo período
  (grupo de controle: os outros 45 guias locais e os artigos);
- posição média de página com poucas impressões oscila muito; abaixo de cerca de 100 impressões
  na janela, trate a variação como ruído;
- os prints da SERP servem como registro qualitativo, não como posição (ver o registro no fim).

## Estado das métricas na data deste registro

Ainda não preenchido. Em 01/10/2026 não foi possível ler o Search Console por aqui: o conector
Supermetrics está com o teste gratuito expirado desde 25/09/2026 e o Vercel Web Analytics não está
ativo no projeto. Os números da janela "Antes" entram aqui assim que forem exportados do Search
Console (Desempenho → Exportar → CSV, aba Páginas e aba Consultas).

| URL | Cliques antes | Impr. antes | CTR antes | Posição antes | Cliques depois | Impr. depois | CTR depois | Posição depois |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/calculadoras/comparador-de-propostas/` | | | | | | | | |
| `/calculadoras/emprestimo/` | | | | | | | | |
| `/calculadoras/margem-consignavel/` | | | | | | | | |
| `/calculadoras/minha-taxa-esta-cara/` | | | | | | | | |
| `/simuladores/amortizacao-financiamento/` | | | | | | | | |
| `/calculadoras/consultar-instituicao/` | | | | | | | | |
| `/calculadoras/sinais-de-golpe/` | | | | | | | | |
| `/calculadoras/conversor-de-taxas/` | | | | | | | | |
| `/calculadoras/parcela-no-orcamento/` | | | | | | | | |
| `/calculadoras/plano-para-sair-das-dividas/` | | | | | | | | |
| `/calculadoras/quitacao-antecipada/` | | | | | | | | |
| `/calculadoras/renegociacao-de-dividas/` | | | | | | | | |
| `/calculadoras/trocar-divida/` | | | | | | | | |
| `/taxas/` | | | | | | | | |
| `/calculadoras/a-vista-ou-parcelado/` | | | | | | | | |
| `/calculadoras/quanto-consigo-financiar/` | | | | | | | | |
| `/emprestimos/sp/barueri/` | | | | | | | | |
| `/emprestimos/sp/barueri/alphaville/` | | | | | | | | |
| `/emprestimos/sp/campinas/` | | | | | | | | |
| `/emprestimos/sp/jundiai/` | | | | | | | | |
| `/emprestimos/sp/sumare/` | | | | | | | | |
| `/emprestimos/sp/americana/` | | | | | | | | |
| `/emprestimos/sp/hortolandia/` | | | | | | | | |
| `/emprestimos/sp/braganca-paulista/` | | | | | | | | |
| `/emprestimos/sp/atibaia/` | | | | | | | | |
| `/emprestimos/sp/itapecerica-da-serra/` | | | | | | | | |
| `/emprestimos/sp/carapicuiba/` | | | | | | | | |
| `/emprestimos/sp/itapevi/` | | | | | | | | |
| `/emprestimos/sp/taboao-da-serra/` | | | | | | | | |
| `/emprestimos/sp/cotia/` | | | | | | | | |
| `/emprestimos/sp/indaiatuba/` | | | | | | | | |
| `/emprestimos/sp/jandira/` | | | | | | | | |
| `/emprestimos/sp/santana-de-parnaiba/` | | | | | | | | |
| `/emprestimos/sp/valinhos/` | | | | | | | | |
| `/emprestimos/sp/embu-das-artes/` | | | | | | | | |
| `/emprestimos/sp/itu/` | | | | | | | | |
| `/emprestimos/sp/vinhedo/` | | | | | | | | |
| `/emprestimos/sp/paulinia/` | | | | | | | | |
| `/emprestimos/sp/itatiba/` | | | | | | | | |
| `/emprestimos/sp/votorantim/` | | | | | | | | |
| `/emprestimos/sp/varzea-paulista/` | | | | | | | | |
| `/emprestimos/sp/salto/` | | | | | | | | |
| `/emprestimos/sp/francisco-morato/` | | | | | | | | |

## O que mudou em cada página

### `/calculadoras/comparador-de-propostas/`

- **No ar em:** 24/09/2026 (commit `54aef33`)
- **Title antes:** Comparador de propostas de crédito: parcela, prazo, CET e total
- **Title depois:** Comparar propostas de empréstimo: CET e total pago
- **Description antes:** Compare gratuitamente até 3 propostas de crédito lado a lado: parcela, prazo, CET e total pago. Sem cadastro, sem informar banco e sem indicação de contratação.
- **Description depois:** Já recebeu duas ou três propostas? Compare lado a lado parcela, prazo, CET, valor liberado e total pago. Grátis, sem CPF e sem buscar ofertas.

### `/calculadoras/emprestimo/`

- **No ar em:** 24/09/2026 (commit `cc48bc6`)
- **Title antes:** Calculadora de empréstimo: parcelas, juros e total pago
- **Title depois:** Calculadora de empréstimo: parcelas, juros e total pago
- **Description antes:** Simule parcelas de empréstimo pelo sistema Price: valor da parcela, total pago, total de juros, taxa anual equivalente e tabela de amortização completa.
- **Description depois:** Informe valor, taxa de juros e número de parcelas e simule o empréstimo: veja a parcela mensal, os juros e o total pago. Grátis e sem CPF.

### `/calculadoras/margem-consignavel/`

- **No ar em:** 24/09/2026 (commit `b9d9899`)
- **Title antes:** Calculadora de margem consignável: INSS e CLT
- **Title depois:** Calculadora de margem consignável: INSS e CLT
- **Description antes:** Calcule quanto da sua margem consignável está livre: limite para empréstimo, fatias dos cartões e o disponível após as parcelas atuais — sem cadastro nem CPF.
- **Description depois:** Informe benefício ou salário e as parcelas de consignado que já paga e estime sua margem disponível. Para INSS e CLT, sem CPF e sem cadastro.

### `/calculadoras/minha-taxa-esta-cara/`

- **No ar em:** 25/09/2026 (commit `e38f9f1`)
- **Title antes:** Minha taxa está cara? Compare com a média do Banco Central
- **Title depois:** Minha taxa está cara? Compare à média do Banco Central
- **Description antes:** Informe a taxa do seu empréstimo e veja como ela se compara à média oficial do Banco Central para a mesma modalidade. Grátis, sem cadastro e sem indicar banco.
- **Description depois:** Recebeu uma proposta? Informe a taxa de juros e a modalidade e compare com a média oficial do Banco Central: abaixo, próxima ou acima. Sem cadastro.

### `/simuladores/amortizacao-financiamento/`

- **No ar em:** 28/09/2026 (commit `0db93bc`)
- **Title antes:** (página nova)
- **Title depois:** Simulador de amortização de financiamento
- **Description antes:** (página nova)
- **Description depois:** Veja quanto um pagamento extra reduz o prazo, a prestação e os juros do seu financiamento. SAC e Price, aporte único ou mensal. Sem cadastro.

### `/calculadoras/consultar-instituicao/`

- **No ar em:** 29/09/2026 (commit `7e4378d`)
- **Title antes:** Consultar instituição no Banco Central: pesquise por nome ou CNPJ
- **Title depois:** Financeira autorizada pelo Banco Central? Consulte aqui
- **Description antes:** Consulte gratuitamente uma instituição financeira por nome ou CNPJ usando dados oficiais do Banco Central. Sem cadastro — e com o aviso: registro não confirma o contato.
- **Description depois:** Veja se uma financeira, banco ou cooperativa aparece como autorizada no Banco Central. Pesquise por nome ou CNPJ, grátis e sem cadastro.

### `/calculadoras/sinais-de-golpe/`

- **No ar em:** 29/09/2026 (commit `6e5e86b`)
- **Title antes:** Golpe de empréstimo: verifique os sinais antes de pagar
- **Title depois:** Como saber se empréstimo é golpe: verifique os sinais
- **Description antes:** Recebeu uma oferta de empréstimo? Responda perguntas rápidas e veja sinais de alerta antes de enviar dinheiro ou dados. Gratuito, sem cadastro e sem coleta de respostas.
- **Description depois:** Pediram Pix, taxa, seguro ou depósito para liberar um empréstimo? Responda perguntas rápidas e veja o que verificar antes de pagar. Sem cadastro.

### `/calculadoras/conversor-de-taxas/`

- **No ar em:** 30/09/2026 (commit `2999354`)
- **Title antes:** Conversor de taxa mensal para anual (e anual para mensal)
- **Title depois:** Converter taxa mensal para anual (e anual para mensal)
- **Description:** sem mudança

### `/calculadoras/parcela-no-orcamento/`

- **No ar em:** 30/09/2026 (commit `36d6c91`)
- **Title antes:** Quanto de parcela cabe no meu orçamento? Faça a conta completa
- **Title depois:** Quanto de parcela cabe no meu orçamento? Além dos 30%
- **Description antes:** Veja como uma nova parcela afetaria seu orçamento mensal: informe renda, despesas e dívidas e descubra quanto sobra antes e depois dela. Grátis, sem cadastro.
- **Description depois:** A regra dos 30% da renda é só o começo. Informe renda, despesas e parcelas e veja quanto sobra no mês antes e depois da nova parcela. Sem cadastro.

### `/calculadoras/plano-para-sair-das-dividas/`

- **No ar em:** 30/09/2026 (commit `211834e`)
- **Title antes:** Plano para sair das dívidas: veja qual pagar primeiro
- **Title depois:** Plano para sair das dívidas: veja qual pagar primeiro
- **Description antes:** Organize suas dívidas, compare os métodos avalanche e bola de neve e monte um plano mensal de pagamento. Grátis, sem cadastro e sem enviar seus valores.
- **Description depois:** Monte um plano para sair das dívidas: liste o que deve, veja qual pagar primeiro (avalanche ou bola de neve) e quanto sobra por mês. Sem cadastro.

### `/calculadoras/quitacao-antecipada/`

- **No ar em:** 30/09/2026 (commit `be58c50`)
- **Title antes:** Calculadora de Quitação Antecipada — compare saldo e parcelas
- **Title depois:** Calculadora de quitação antecipada de empréstimo
- **Description antes:** Compare o saldo para quitação com a soma das parcelas que ainda faltam e veja a diferença em reais. Sem cadastro, sem CPF — nada sai do seu dispositivo.
- **Description depois:** Vai quitar empréstimo, consignado ou financiamento antes? Compare o saldo para quitação com as parcelas que faltam e veja a diferença. Sem cadastro.

### `/calculadoras/renegociacao-de-dividas/`

- **No ar em:** 30/09/2026 (commit `33b87d2`)
- **Title antes:** Calculadora de Renegociação de Dívidas — compare acordos
- **Title depois:** Calculadora de renegociação de dívidas: compare acordos
- **Description antes:** Compare propostas de acordo: entrada, parcelas, prazo e valor total. Veja a diferença entre pagar à vista e parcelado e confira o desconto anunciado. Sem cadastro.
- **Description depois:** Recebeu proposta de acordo? Some entrada, parcelas e custos, compare à vista e parcelado e confira o desconto anunciado. Sem cadastro.

### `/calculadoras/trocar-divida/`

- **No ar em:** 30/09/2026 (commit `ad0ad0d`)
- **Title antes:** Vale a pena trocar esta dívida? Compare antes de decidir
- **Title depois:** Vale a pena trocar dívida por outra? Compare o total
- **Description antes:** Compare sua dívida atual com a nova proposta — portabilidade, renegociação ou novo empréstimo — e veja o que muda na parcela, no prazo e no total a pagar. Sem cadastro.
- **Description depois:** Pensando em pegar empréstimo para quitar dívida ou fazer portabilidade? Compare a dívida atual com a nova proposta: parcela, prazo e total pago.

### `/taxas/`

- **No ar em:** 30/09/2026 (commit `8d30695`)
- **Title antes:** Radar de taxas de crédito: acompanhe os dados do Banco Central
- **Title depois:** Taxa média de juros do Banco Central por modalidade
- **Description antes:** Acompanhe as taxas médias de empréstimo pessoal, consignado, cartão, cheque especial e financiamento de veículos com dados oficiais e histórico do Banco Central.
- **Description depois:** Veja a taxa média de juros de empréstimo pessoal, consignado, cartão, cheque especial e veículos, com o último dado e o histórico do Banco Central.

### `/calculadoras/a-vista-ou-parcelado/`

- **No ar em:** 01/10/2026 (commit `9705eac`)
- **Title antes:** À vista ou parcelado? Compare o preço até o fim
- **Title depois:** À vista ou parcelado? Calculadora do desconto mínimo
- **Description antes:** Compare preço à vista, entrada, parcelas e total. Veja quanto custa parcelar, qual é a diferença em reais e qual desconto à vista está sendo oferecido. Sem cadastro.
- **Description depois:** Compare à vista e parcelado pelo total e veja, com a taxa que você escolher, o desconto à vista que empata as duas opções. Sem cadastro.

### `/calculadoras/quanto-consigo-financiar/`

- **No ar em:** 05/10/2026
- **Title antes:** Quanto consigo financiar? Calcule pela parcela
- **Title depois:** Quanto consigo financiar? Pela renda ou pela parcela
- **Description antes:** Informe quanto pode pagar por mês, a taxa e o prazo para estimar quanto consegue financiar e como entrada, juros e prazo mudam o valor.
- **Description depois:** Com renda de R$ 5 mil, quanto consigo financiar? Veja a parcela de 30% da renda, a taxa e o prazo, em Price e SAC, e o que muda na aprovação.

### `/emprestimos/sp/barueri/`

- **No ar em:** 01/10/2026 (commit `c137920`)
- **Title antes:** Empréstimos em Barueri (SP): guia de crédito e proteção ao consumidor
- **Title depois:** Empréstimo em Barueri: Banco do Povo, Procon e golpes
- **Description antes:** Guia de crédito para quem mora ou trabalha em Barueri: o consignado no polo de empregos, o Procon no Ganha Tempo com agendamento on-line e a comparação segura de propostas.
- **Description depois:** Banco do Povo e Procon no Ganha Tempo, consignado CLT e dinheiro urgente sem cair em agiota ou no golpe do liberado na hora. Guia de Barueri (SP).

### `/emprestimos/sp/barueri/alphaville/`

- **No ar em:** 01/10/2026 (commit `e013783`)
- **Title antes:** Empréstimos em Alphaville: a qual município (e Procon) você responde
- **Title depois:** Empréstimo em Alphaville: onde pedir e onde reclamar
- **Description antes:** Alphaville se divide entre Barueri e Santana de Parnaíba — e isso define a qual Procon recorrer num problema de crédito. O guia da região, com os canais dos dois lados.
- **Description depois:** Escritório de crédito em Alphaville? Veja quem de fato empresta, como pedir com urgência sem cair em golpe e qual Procon atende o seu endereço.

### `/emprestimos/sp/campinas/`

- **No ar em:** 01/10/2026 (commit `7256e72`)
- **Title antes:** Empréstimo em Campinas (SP): o 151 do Procon, os 5 postos e o Banco do Povo
- **Title depois:** Empréstimo em Campinas: pessoal, consignado e Procon
- **Description antes:** Guia de crédito para Campinas: o 151 do Procon com horário estendido, os cinco postos com agendamento, o Banco do Povo no CPAT e o filtro contra ofertas de rua.
- **Description depois:** Empréstimo em Campinas: pessoal, consignado ou com restrição? Veja o que conferir na loja, o Banco do Povo no CPAT e o Procon 151 até as 20h.

### `/emprestimos/sp/jundiai/`

- **No ar em:** 01/10/2026
- **Title antes:** Empréstimo em Jundiaí (SP): o Procon que começa pelo on-line e o Banco do Povo no shopping
- **Title depois:** Empréstimo em Jundiaí: consignado, nome sujo e Procon
- **Description antes:** Guia de crédito para Jundiaí: as três vias do Procon na ordem que o próprio órgão indica e o Banco do Povo no Maxi Shopping, com agendamento pelo portal.
- **Description depois:** Empréstimo em Jundiaí: consignado, nome sujo e lojas de crédito. Veja o que conferir antes de assinar e o Procon que começa pelo on-line.

### `/emprestimos/sp/sumare/`

- **No ar em:** 01/10/2026
- **Title antes:** Empréstimo em Sumaré (SP): resolver sem perder um dia de trabalho
- **Title depois:** Empréstimo em Sumaré: lojas, conta de luz e Procon
- **Description antes:** Guia de crédito para Sumaré: os cinco canais do Procon municipal, o balcão que junta Banco do Povo, MEI e PAT e a régua para comparar qualquer proposta.
- **Description depois:** Empréstimo em Sumaré: loja de crédito, conta de luz, consignado ou cooperativa? Veja o que conferir antes de assinar e onde reclamar.

### `/emprestimos/sp/americana/`

- **No ar em:** 01/10/2026
- **Title antes:** Empréstimo em Americana (SP): o Procon que mudou de sede e o carnê que é empréstimo
- **Title depois:** Empréstimo em Americana: lojas, FGTS e Banco do Povo
- **Description antes:** Guia de crédito para Americana: o endereço vigente do Procon na Sete de Setembro, o portal do consumidor com atendimento on-line e como comparar crediário de loja pelo custo total.
- **Description depois:** Empréstimo em Americana: lojas de consignado, resgate do FGTS, nome sujo e o Banco do Povo. O que conferir antes de assinar e onde reclamar.

### `/emprestimos/sp/hortolandia/`

- **No ar em:** 01/10/2026
- **Title antes:** Empréstimo em Hortolândia (SP): o Procon no Paço e o WhatsApp que evita a fila
- **Title depois:** Empréstimo em Hortolândia: lojas, FGTS e Procon
- **Description antes:** Guia de crédito para Hortolândia: o Procon no Palácio dos Migrantes com WhatsApp oficial, os guichês do Banco do Povo e o filtro que vale em qualquer balcão.
- **Description depois:** Empréstimo em Hortolândia: lojas de crédito, antecipação do FGTS e urgência. O que conferir antes de assinar e o Procon por WhatsApp.

### `/emprestimos/sp/braganca-paulista/`

- **No ar em:** 02/10/2026
- **Title antes:** Empréstimo em Bragança Paulista (SP): o polo bragantino e a sexta sem Procon
- **Title depois:** Empréstimo em Bragança Paulista: nome sujo e Procon
- **Description antes:** Guia de crédito para Bragança Paulista: os balcões do polo regional, o Procon da Teófilo Leme (que não atende ao público às sextas) e o posto do Banco do Povo.
- **Description depois:** Empréstimo em Bragança Paulista: consignado, nome sujo e o WhatsApp da loja. O que conferir antes de assinar e o Procon que não abre às sextas.

### `/emprestimos/sp/atibaia/`

- **No ar em:** 03/10/2026
- **Title antes:** Empréstimo em Atibaia (SP): renda sazonal, Procon e microcrédito no Facilita
- **Title depois:** Empréstimo em Atibaia: na hora, negativado e Procon
- **Description antes:** Guia de crédito para Atibaia: como dimensionar parcela com renda de turismo e eventos, o Procon da Rua Bruno Sargiani e o Banco do Povo dentro do Facilita, no Centro.
- **Description depois:** Empréstimo em Atibaia: o que é real no “liberado na hora”, crédito para negativado e autônomo, garantia de imóvel e o Banco do Povo no Facilita.

### `/emprestimos/sp/itapecerica-da-serra/`

- **No ar em:** 03/10/2026
- **Title antes:** Empréstimo em Itapecerica da Serra (SP): na sexta, o Procon só faz audiência
- **Title depois:** Empréstimo em Itapecerica: Banco do Povo, MEI e Procon
- **Description antes:** Guia de crédito para Itapecerica da Serra: as duas unidades do Procon, a sexta-feira reservada a audiências de conciliação, o WhatsApp atual e o Banco do Povo da Eduardo Daher.
- **Description depois:** Empréstimo em Itapecerica da Serra: Banco do Povo para MEI, como simular, quem não é atendido e o Procon, com a sexta reservada a audiências.

### `/emprestimos/sp/carapicuiba/`

- **No ar em:** 03/10/2026
- **Title antes:** Empréstimo em Carapicuíba (SP): opções, Procon e contratação segura
- **Title depois:** Empréstimo em Carapicuíba: lojas, negativado e Procon
- **Description antes:** Guia de crédito para quem mora em Carapicuíba: o consignado de quem trabalha fora da cidade, o Procon no Ganha Tempo e como comparar propostas com segurança.
- **Description depois:** Empréstimo em Carapicuíba: loja de crédito, WhatsApp, nome negativado e Bolsa Família. O que conferir antes de assinar e o Procon no Ganha Tempo.
- **Correção junto:** endereço do Ganha Tempo unificado como Estrada Ernestina Vieira, 149 (uma passagem dizia "Rua").

### `/emprestimos/sp/itapevi/`

- **No ar em:** 03/10/2026
- **Title antes:** Empréstimo em Itapevi (SP): guia do trabalhador e canais da cidade
- **Title depois:** Empréstimo em Itapevi: lojas, negativado e Procon
- **Description antes:** Guia de crédito para quem mora em Itapevi: consignado para os trabalhadores do polo industrial, o Procon no Resolve Fácil (com agendamento) e os filtros contra golpe.
- **Description depois:** Empréstimo em Itapevi: consignado de quem trabalha registrado, lojas e correspondentes, crédito para negativado e o Procon no Resolve Fácil.

### `/emprestimos/sp/taboao-da-serra/`

- **No ar em:** 05/10/2026
- **Title antes:** Empréstimo em Taboão da Serra (SP): o endereço que resolve quase tudo
- **Title depois:** Empréstimo em Taboão da Serra: lojas, Procon e golpes
- **Description antes:** Guia de crédito para Taboão da Serra: o complexo que reúne Procon, Banco do Povo e Sebrae num só endereço, o crédito de quem trabalha na capital e os filtros contra golpe.
- **Description depois:** Empréstimo em Taboão da Serra: corretor e loja de crédito, convênio de consignado, urgência e o endereço do Procon e do Banco do Povo.

### `/emprestimos/sp/cotia/`

- **No ar em:** 05/10/2026
- **Title antes:** Empréstimo em Cotia (SP): guia para toda a cidade — do centro a Caucaia
- **Title depois:** Empréstimo em Cotia: consignado, negativado e Procon
- **Description antes:** Guia de crédito para quem mora em Cotia: os dois postos do Procon (sede e Caucaia do Alto), como contratar bem morando longe do centro e os filtros contra golpe.
- **Description depois:** Empréstimo em Cotia: consignado (CLT, INSS e Cotiaprev), correspondentes, negativado, Banco do Povo e os dois postos do Procon, centro e Caucaia.
- **Correção junto:** o posto de Caucaia aparecia como "1º andar" num trecho e "térreo" no FAQ; unificado como térreo.

### `/emprestimos/sp/indaiatuba/`

- **No ar em:** 05/10/2026
- **Title antes:** Empréstimo em Indaiatuba (SP): use a concorrência da cidade a seu favor
- **Title depois:** Empréstimo em Indaiatuba: nome sujo, urgente e Procon
- **Description antes:** Guia de crédito para Indaiatuba: como transformar a forte concorrência bancária local em taxa menor, o consignado do polo industrial e o Procon no endereço novo, das 10h às 15h.
- **Description depois:** Empréstimo em Indaiatuba: nome sujo, urgente e o número do agiota que circula no WhatsApp. O que conferir na financeira e onde fica o Procon.

### `/emprestimos/sp/jandira/`

- **No ar em:** 05/10/2026
- **Title antes:** Empréstimo em Jandira (SP): onde comparar, contratar e reclamar
- **Title depois:** Empréstimo em Jandira: nome sujo, lojas e Procon
- **Description antes:** Guia de crédito para quem mora em Jandira: os dias certos do Procon municipal, como comparar o balcão do Centro com os canais digitais e os filtros contra golpe.
- **Description depois:** Empréstimo em Jandira: nome sujo, loja de crédito e urgência. O que conferir antes de assinar, o Banco do Povo e os dias do Procon.

### `/emprestimos/sp/santana-de-parnaiba/`

- **No ar em:** 05/10/2026
- **Title antes:** Empréstimo em Santana de Parnaíba (SP): onde buscar e como se proteger
- **Title depois:** Empréstimo Santana de Parnaíba: servidor e consignado
- **Description antes:** Guia de crédito para quem mora em Santana de Parnaíba: microcrédito do Banco do Povo Paulista, Procon da cidade, verificação de instituições e comparação segura.
- **Description depois:** Empréstimo em Santana de Parnaíba: consignado do servidor municipal (margem, holerite e convênios), negativado, WhatsApp e o Procon.

### `/emprestimos/sp/valinhos/`

- **No ar em:** 05/10/2026
- **Title antes:** Empréstimo em Valinhos (SP): o Procon do Largo e a casa que junta três portas
- **Title depois:** Empréstimo em Valinhos: urgente, negativado e Procon
- **Description antes:** Guia de crédito para Valinhos: o Procon no Largo São Sebastião, a Casa do Empreendedor que reúne Banco do Povo, Sebrae e PAT, e os cuidados de quem banca a vida em Campinas.
- **Description depois:** Empréstimo em Valinhos: urgente, negativado ou autônomo? O que conferir no “na hora via Pix”, o Banco do Povo e o Procon do Largo.

### `/emprestimos/sp/embu-das-artes/`

- **No ar em:** 05/10/2026
- **Title antes:** Empréstimo em Embu das Artes (SP): guia para quem vive da própria arte
- **Title depois:** Empréstimo em Embu das Artes: Banco do Povo e servidor
- **Description antes:** Guia de crédito para Embu das Artes: os dois endereços do Procon (Poupatempo e Centro), os caminhos de crédito de artesãos, MEIs e autônomos, e os filtros contra golpe.
- **Description depois:** Empréstimo em Embu das Artes: Banco do Povo, consignado do servidor municipal, negativado, “sem juros” e os dois endereços do Procon.

### `/emprestimos/sp/itu/`

- **No ar em:** 05/10/2026
- **Title antes:** Empréstimo em Itu (SP): guia do polo regional de comércio tradicional
- **Title depois:** Empréstimo em Itu: na hora, negativado e Banco do Povo
- **Description antes:** Guia de crédito para Itu: a janela 9h–15h do Procon na Cidade Nova, como conferir os balcões do comércio tradicional e o crédito de quem vive do turismo e do varejo.
- **Description depois:** Empréstimo em Itu: “na hora”, sem garantia, Pix no cartão e negativado. O que conferir antes de assinar, o Banco do Povo e o Procon.
- **Correção junto:** o Banco do Povo (duas unidades, já verificadas no dossiê) não aparecia no texto do guia; entrou como seção.

### `/emprestimos/sp/vinhedo/`

- **No ar em:** 05/10/2026
- **Title antes:** Empréstimo em Vinhedo (SP): agendamento no Procon e golpes de alta renda
- **Title depois:** Empréstimo em Vinhedo: nome sujo, sem FGTS e Procon
- **Description antes:** Guia de crédito para Vinhedo: o Procon da Humberto Pescarini (que só atende com agendamento), os golpes que miram renda alta na RMC e o posto do Banco do Povo.
- **Description depois:** Empréstimo em Vinhedo: nome sujo, sem FGTS, rápido e fácil? O que conferir antes de assinar, o Banco do Povo e o Procon com agendamento.

### `/emprestimos/sp/paulinia/`

- **No ar em:** 05/10/2026
- **Title antes:** Empréstimo em Paulínia (SP): salário de polo industrial pede filtro maior
- **Title depois:** Empréstimo em Paulínia: negativado, urgente e Procon
- **Description antes:** Guia de crédito para Paulínia: as janelas curtas do Procon, o assédio de consignado sobre os salários do polo petroquímico e a régua para comparar qualquer proposta.
- **Description depois:** Empréstimo em Paulínia: negativado, “sem juros”, autônomo e na hora via Pix. O que conferir antes de assinar, o Banco do Povo e o Procon.

### `/emprestimos/sp/itatiba/`

- **No ar em:** 05/10/2026
- **Title antes:** Empréstimo em Itatiba (SP): uma viagem, dois balcões públicos
- **Title depois:** Empréstimo em Itatiba: nome sujo, sem consulta e Procon
- **Description antes:** Guia de crédito para Itatiba: Procon e Banco do Povo no mesmo endereço ao lado da rodoviária, o consignado do CLT industrial e o cuidado com o crediário de móveis.
- **Description depois:** Empréstimo em Itatiba: “sem consulta ao SPC/Serasa”, nome sujo e consignado do INSS. O que conferir antes de assinar e o Banco do Povo.

### `/emprestimos/sp/votorantim/`

- **No ar em:** 05/10/2026
- **Title antes:** Empréstimo em Votorantim (SP): nenhuma das portas públicas abre de manhã
- **Title depois:** Empréstimo em Votorantim (SP): nome sujo e Procon
- **Description antes:** Guia de crédito para Votorantim: o Procon e o Banco do Povo que só atendem à tarde, o endereço novo ao lado do Poupatempo e as duas linhas de microcrédito.
- **Description depois:** Empréstimo em Votorantim, a cidade, não o banco: negativado, “é confiável?”, WhatsApp, o Banco do Povo e o Procon que só abre à tarde.

### `/emprestimos/sp/varzea-paulista/`

- **No ar em:** 05/10/2026
- **Title antes:** Empréstimo em Várzea Paulista (SP): o WhatsApp do Procon que só atende quem mora na cidade
- **Title depois:** Empréstimo em Várzea Paulista: MEI, negativado e Procon
- **Description antes:** Guia de crédito para Várzea Paulista: o Procon da Fernão Dias, com WhatsApp exclusivo para moradores, e as três linhas do Banco do Povo atendidas no Facilita.
- **Description depois:** Empréstimo em Várzea Paulista: Banco do Povo para MEI, negativado, urgente e golpe da taxa. O que conferir e o Procon com WhatsApp.

### `/emprestimos/sp/salto/`

- **No ar em:** 05/10/2026
- **Title antes:** Empréstimo em Salto (SP): guia para uma vida financeira entre cidades
- **Title depois:** Empréstimo em Salto (SP): lojas, Banco do Povo e Procon
- **Description antes:** Guia de crédito para quem mora em Salto: o Procon de horário amplo na Bela Vista, o consignado de quem trabalha na indústria da região e a comparação segura de propostas.
- **Description depois:** Empréstimo em Salto (SP): loja de crédito, conta de luz, cooperativa e urgente. O que conferir, o Banco do Povo e o Procon no Atende Fácil.

### `/emprestimos/sp/francisco-morato/`

- **No ar em:** 05/10/2026
- **Title antes:** Empréstimo em Francisco Morato (SP): o Procon no CIC, e o horário que vale é 15h30
- **Title depois:** Empréstimo em Francisco Morato: negativado e consignado
- **Description antes:** Guia de crédito para Francisco Morato: o Procon dentro do CIC, perto do trem, com atendimento presencial até as 15h30, e a Defensoria Pública no mesmo prédio.
- **Description depois:** Empréstimo em Francisco Morato: negativado na hora, consignado do INSS, FGTS e conta de luz. O que conferir, o Procon no CIC e o Banco do Povo.

## Registro qualitativo da SERP (prints de 01/10/2026)

Prints feitos pelo proprietário: os do computador (Campinas, Jundiaí, Sumaré, Americana e Hortolândia) em janela anônima, com
localização por IP em Barueri (SP); os do celular sem indicação de modo anônimo. Em
nenhum deles o Crédito por Perto aparece na parte capturada. Na comparação, refazer a mesma
busca, do mesmo jeito, e anotar se o site aparece e em que posição.

| Busca | O que dominava a página | Perguntas do "As pessoas também perguntam" |
| --- | --- | --- |
| à vista ou parcelado? | calculadora do "desconto mínimo" (1x, 3x, 6x, 10x), Investidor Sardinha, Mercado Pago; resumo por IA com regra genérica de 5% a 10% | o que é pagamento à vista; vale a pena com 5% de desconto; crédito à vista tem juros; desvantagens do pagamento à vista |
| quanto consigo financiar (celular, 05/10) | resumo por IA com 30% da renda familiar bruta (Caixa), prazo e entrada; Serasa, MySide (taxa média declarada pelo site), calculadorabrasil, estudo de imóveis por renda; autocomplete quase todo "com renda de X mil" (3 a 20 mil) e Minha Casa Minha Vida; buscas por parcela de R$ 150 a 300 mil pela Caixa, "se eu financiar 170/450 mil quanto vou pagar", tabela de renda da Caixa | quanto fica R$ 50 mil em 48 vezes; se eu financiar 180 mil quanto por mês; com renda de R$ 20 mil quanto posso financiar; R$ 300 mil pela Caixa |
| empréstimo em barueri sp | Banco do Povo (página da prefeitura, "Setor Laranja"), oHub (consignado), páginas de correspondentes | onde fazer empréstimo urgente; mais fácil de aprovar; R$ 2.000 e R$ 500 urgente |
| empréstimo em alphaville | Daycoval (agências e correspondentes), escritórios locais de "apoio ao crédito", FinanZero | onde pegar empréstimo urgente; R$ 2.000; mais fácil de aprovar; R$ 10.000 |
| Empréstimo em Campinas | mapa com lojas, Agibank (pessoal), Crefisa (negativado), Paraná Banco (consignado em loja física) | onde fazer empréstimo urgente; R$ 10.000; mais fácil de aprovar; R$ 2.000 |
| Empréstimo em Sumaré | mapa com lojas de crédito, Juros Baixos (simulador), Crefaz (loja), oHub, Ourocred e perfil de Instagram (consignado, FGTS, conta de energia, Bolsa Família); buscas por Sicoob e agiota | onde fazer empréstimo rápido; R$ 2.000; mais fácil de aprovar; R$ 500 |
| Empréstimo em Americana | mapa com agências de empréstimo (consignado, "resgate de FGTS"), Juros Baixos, Crefaz, página do Banco do Povo da Prefeitura, site de loja local avisando que não manda mensagem nem boleto | onde conseguir empréstimo urgente; R$ 2.000; mais fácil de aprovar; qual banco libera com nome sujo |
| empréstimo em Hortolândia | mapa com escritórios de crédito, Juros Baixos, página do Banco do Povo da Prefeitura, perfil de Instagram (antecipação do FGTS), notícia do Senado sobre financiamento do município; buscas por agiota, PAT, Sine e vagas | onde fazer empréstimo urgente; R$ 2.000; mais fácil de aprovar; R$ 500 |
| empréstimo em bragança paulista (celular, 02/10) | anúncios patrocinados, agência do Banco Mercantil, Crefisa (negativado); autocomplete com nome sujo, telefone, agiota, Banco do Povo, WhatsApp e fotos de rede de lojas de consignado, e "agiota em Bragança Pará" | onde pegar empréstimo rapidamente; R$ 2.000; mais fácil de aprovar; R$ 10.000 |
| empréstimo em atibaia (celular, 03/10) | mapa com escritórios de crédito, correspondente bancário com marca de banco público, anúncio de home equity para empresa; autocomplete com "banco que libera na hora", negativado, agiota, app de empréstimo; buscas por autônomo, R$ 500 e "liberado na hora WhatsApp" | (não capturado) |
| emprestimo itapecerica da serra (celular, 03/10) | páginas do Banco do Povo (Secretaria estadual e outra página do programa), Crefisa (negativado); autocomplete dominado por Banco do Povo (simulação, MEI, negativado); buscas por Banco do Povo de Embu das Artes, empréstimo para MEI, agiota e app de empréstimo | (não capturado) |
| empréstimo em carapicuíba (celular, 03/10) | agência do Banco Mercantil, rede de lojas de crédito ligada a banco (site e imagens), financeira com empréstimo pessoal; autocomplete com negativado, "liberado na hora", WhatsApp da loja e "WhatsApp Bolsa Família" | onde conseguir empréstimo urgente; mais fácil de aprovar; R$ 2 mil; R$ 500 |
| empréstimo em itapevi (celular, 03/10) | imagens de posts no Facebook de correspondentes com marca de grandes bancos ("a melhor taxa"), loja de financeira, anúncio de banco digital; autocomplete com negativado, nome de banco, "contratando" (vagas), loja de financeira no Centro e agiota | (não capturado) |
| emprestimo taboao da serra (celular, 05/10) | anúncio patrocinado, pontos de atendimento de financeira, página estadual do Banco do Povo, rede de lojas de crédito de banco, vídeos de "convênio novo" de consignado; autocomplete com agiota, plataforma de consignado, rede de lojas (WhatsApp, telefone, avaliações), "corretor de empréstimos" e "franquia de empréstimos" | onde conseguir empréstimo urgente; mais fácil de aprovar; R$ 2 mil; R$ 500 |
| empréstimo em cotia (celular, 05/10) | agente correspondente de financeira, página de convênios de consignado da Cotiaprev, financeira para negativado, anúncio de banco digital; autocomplete com consignado, negativado, nome de banco, "hoje"; buscas por agiota, Banco do Povo (Cotia, WhatsApp, MEI, Vargem Grande Paulista), PAT e emprego | onde fazer empréstimo urgente; mais fácil de aprovar; R$ 2.000; R$ 500 |
| empréstimo em indaiatuba (celular, 05/10) | mapa com lojas, rede de lojas de crédito de banco, página "empréstimo em Indaiatuba" de comparador; autocomplete com pessoal, negativado, nome sujo, hoje, urgente; buscas por "agiota Indaiatuba WhatsApp", "número de agiota", financeira de loja (simulação, WhatsApp, "é confiável", CLT) | (não capturado) |
| empréstimo em jandira (celular, 05/10) | página estadual do Banco do Povo, perfil de Instagram de loja de crédito local ("ficou sem grana?"); autocomplete com negativado, nome sujo, nome de banco, "Jandira e Itapevi" e vagas | onde fazer empréstimo urgente; mais fácil de aprovar; R$ 2.000; R$ 500 |
| emprestimo santana de parnaiba (celular, 05/10) | página sobre consignado de servidor ("qualquer banco ou cooperativa conveniado com a prefeitura"), rede de lojas de crédito de banco; autocomplete com consignado, WhatsApp, negativado e nomes de banco; buscas relacionadas quase todas de servidor (sistema de consignação, RH, holerite, portal do servidor, espelho de ponto) | (não capturado) |
| empréstimo em valinhos (celular, 05/10) | mapa com lojas de empréstimo, página do Banco do Povo da Prefeitura (faixa de valor por porte), loja de financeira, site de banco público (microcrédito, negocie sua dívida); autocomplete com negativado, urgente, hoje, "Valinhos e Vinhedo"; buscas de R$ 200 a R$ 5 mil "na hora via Pix" para negativado e autônomo | mais fácil de aprovar; dinheiro emprestado urgente; R$ 2.000; R$ 10.000 |
| empréstimo em embu das artes (celular, 05/10) | página do Banco do Povo da Prefeitura (faixas de valor), sistema digital de consignações da Prefeitura, plataforma de consignado para servidor, EmbuPrev; autocomplete com consignado, negativado, nome de banco, "sem juros", e-consig e portal do consignado | onde conseguir empréstimo urgente; mais fácil de aprovar; R$ 2 mil; onde achar pessoas que emprestam dinheiro |
| emprestimo em itu (celular, 05/10) | notícia da Prefeitura sobre o Banco do Povo (out/2024), banco com "cai na hora", site de "empréstimo Pix no cartão", lojas de financeiras; autocomplete com pessoal, consignado, negativado, sem garantia, telefone e vagas; buscas por "na hora via Pix", "fácil aprovação", "confiável" e "melhor banco" | qual banco libera rápido e fácil; R$ 2 mil; R$ 500; mais fácil de aprovar |
| emprestimo em vinhedo (celular, 05/10) | financeira com "empréstimo negativado em Vinhedo" pelo WhatsApp, banco com "rápido e sem burocracia", duas páginas do Banco do Povo da Prefeitura; autocomplete com negativado, "sem FGTS", nome sujo, vagas, telefone e Facebook | qual banco libera rápido e fácil; R$ 2 mil; onde achar pessoas que emprestam dinheiro; qual banco libera com nome sujo |
| emprestimo em paulinia (celular, 05/10) | agente correspondente de financeira, perfil de loja de crédito local com endereço e telefones, outra loja de crédito; autocomplete com negativado, "sem juros", nome sujo, vagas e telefone; buscas por autônomo, "na hora via Pix", WhatsApp e R$ 500 a R$ 5 mil para negativado | (não capturado) |
| empréstimo em itatiba (celular, 05/10) | loja de consignado do INSS, página do Banco do Povo da Prefeitura, diretório local com "empréstimo pessoal sem consulta ao SPC/Serasa" e WhatsApp; autocomplete com pessoal, negativado, nome sujo e nomes de banco; buscas por vagas, bicos, PAT e serviços da Prefeitura | (não capturado) |
| empréstimo em votorantim (celular, 05/10) | página de empréstimos da Funsejem (linha para participantes), página de empréstimos do banco BV, resultado patrocinado; autocomplete com negativado, nome sujo, "é confiável", finanças e Reclame Aqui; buscas relacionadas quase todas da marca do banco (consignado, CLT, garantia de veículo, WhatsApp, simulador, negativados) | (não capturado) |
| emprestimo varzea paulista (celular, 05/10) | página do Banco do Povo da Prefeitura (documentos e avalista), diretório local com Banco do Povo e outro telefone, financeira com empréstimo para negativado "até 45 dias para começar a pagar", relato de cobrança para liberar empréstimo, notícia da Prefeitura para empreendedor; autocomplete com negativado, contratando, empresa, emprego e vagas; buscas por Banco do Povo (MEI, negativado, simulação, Jundiaí, Sorocaba), MEI, Balcão do Empreendedor e Desenvolve SP | qual banco libera rápido e fácil; R$ 500; R$ 2 mil; mais fácil de aprovar |
| emprestimo em salto (celular, 05/10) | trecho do Banco do Povo (seg–sex 8h–16h, diverge da página da Prefeitura), agências do Sicoob, mapa com financeira 5,0 (9 avaliações) e WhatsApp, loja da Crefaz, perfil de loja de crédito com conta de luz, consignado, FGTS e CLT; autocomplete com "sp", pessoal e Salto de Pirapora; buscas por Atende Fácil, Rua Itapiru 983, PAT, Sine, bicos, SAAE e ITBI | onde conseguir empréstimo urgente; R$ 2 mil; mais fácil de aprovar; R$ 500 |
| empréstimo em francisco morato (celular, 05/10) | lojas de consignado (INSS, BPC/LOAS, servidores; uma com "sem precisar de agiota"), post antigo em rede social de antecipação do FGTS "sem consulta", página estadual do Banco do Povo; autocomplete com negativado, nomes de banco/financeira, empregos, endereço e hoje; buscas por negativado "liberado na hora" (online, WhatsApp, Pix), R$ 500 e R$ 1.500, Banco do Povo MEI/simulação, CNPJ, conta de luz | onde consigo empréstimo urgente; mais fácil de aprovar; R$ 2 mil; R$ 500 |
| Emprétimo em Jundiaí | Bom Pra Crédito (página "empréstimo em Jundiaí"), Vazoli e Finamax (lojas locais), agência Banco Mercantil | onde fazer empréstimo urgente; mais fácil de aprovar; R$ 2.000; qual banco libera com nome sujo |

As revisões das calculadoras 3 a 13 usaram prints anteriores, resumidos nas mensagens de
commit de cada página (`git log --grep "SERP real"`).
