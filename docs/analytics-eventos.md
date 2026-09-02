# Rastreamento de cliques — dicionário e operação

Este documento é a explicação. A **declaração autoritativa** fica em
`src/lib/analytics/event-registry.ts`, e `pnpm audit:analytics` compara os
dois lados: evento disparado sem declaração quebra o build, evento declarado
que ninguém dispara vira aviso.

## Como funciona, em uma passada

```
clique em qualquer lugar
   ↓
ClickTracking  (um ouvinte, na raiz do documento, fase de captura)
   ↓
click-model    (funções puras: que tipo de link é? que área? que página?)
   ↓
track()        (redige valores, confere o dicionário, mostra no modo debug)
   ↓
gtag           (só existe se a pessoa aceitou os cookies)
```

Não há `onClick` de analytics em botão nenhum. A atribuição vem de
`data-track-area`, posto **uma vez** em cada região do layout — botão novo
dentro de uma região já nasce medido.

### Por que delegação

O site tem 90 botões e 189 links em componentes. Mais os links dentro do texto
dos 60 artigos e 24 guias, que são **MDX** e não têm onde pendurar um
`onClick`. É exatamente ali que ficam as saídas para Banco Central, Planalto,
consumidor.gov e prefeituras — o desfecho que mais importa num portal que não
vende nada.

Instrumentar um a um custaria ~280 edições hoje e teria cobertura incompleta
amanhã: todo botão novo nasceria sem medição, e nada avisaria.

## O que marcar num componente novo

| Atributo | Onde vai | Para quê |
| --- | --- | --- |
| `data-track-area="…"` | na **região** (header, aside, section) | classifica o clique como navegação, oferta ou conteúdo |
| `data-track="…"` | no bloco | identifica o componente no relatório |
| `data-track-label="…"` | no elemento | fixa o rótulo quando o texto visível não serve |
| `data-track-event="…"` | no elemento | força o nome do evento, fugindo da regra da área |
| `data-track-position="3"` | no item | posição, quando não der para inferir do `<li>` |
| `data-track-ignore` | no bloco | região que já tem evento próprio (ex.: banner de cookies) |
| `data-track-kind="faq"` | no `<details>` | só estes viram `faq_open` |

Área nova precisa ser declarada em `click-model.ts` **e** em
`scripts/audit-analytics.ts`. Se não for, a auditoria quebra o build — de
propósito: área escrita com erro de digitação viraria `area=nao_declarada` em
silêncio.

## As áreas

**Navegação estrutural** (`nav_click`): `cabecalho`, `rodape`, `menu-celular`,
`migalhas`, `mapa-do-site`, `paginacao`.

**Oferta do site** (`cta_click`): `cards-ferramentas`, `chamada-ferramenta`,
`chamada-jornada`, `central-decisoes`, `proximos-passos`, `ponte-local`,
`relacionados`, `home-blocos`, `hub-categoria`, `mapa-cidade`, `ferramenta`,
`busca`.

**Corpo do texto** (`content_link_click`): `conteudo`.

A distinção entre as duas primeiras é a pergunta que o site precisa responder:
*a pessoa usou o menu* é uma coisa; *a pessoa aceitou o caminho que
sugerimos* é outra, e é essa que diz se a arquitetura de conteúdo funciona.

## Os eventos

### Cliques (camada genérica, por delegação)

| Evento | Quando | Parâmetros |
| --- | --- | --- |
| `nav_click` | navegação estrutural | `area`, `component`, `label`, `to_path`, `page_type`, `position` |
| `cta_click` ⭐ | destino oferecido pelo site | idem |
| `content_link_click` | link dentro do texto | idem |
| `anchor_click` | salto na mesma página | idem |
| `outbound_click` ⭐ | saída para domínio externo | + `domain`, `destination` |
| `contact_click` ⭐ | e-mail, telefone ou WhatsApp | + `channel` |

⭐ = candidato a evento principal (conversão) no GA4.

`destination` agrupa por autoridade, não por site: `banco-central`,
`legislacao`, `consumidor-gov`, `procon`, `judiciario`, `ibge`, `prefeitura`,
`governo`, `outro`. Saber que 300 pessoas foram "ao Banco Central" é
acionável; a mesma informação picada entre `bcb.gov.br` e
`dadosabertos.bcb.gov.br` não é.

### Conteúdo

| Evento | Quando | Parâmetros |
| --- | --- | --- |
| `faq_open` | pergunta do FAQ aberta | `question`, `page_type`, `position` |
| `media_interact` | imagem ampliada, vídeo iniciado | `action`, `component`, `label`, `page_type` |

### Consentimento

`consent_choice` com `choice`. Só o "Aceitar" chega ao GA4 — no "Recusar" o
script nunca carrega. É a ordem certa: **quem recusou não é medido nem para
dizer que recusou**. A taxa de aceite se calcula sobre sessões, não sobre
cliques no banner.

### Busca, Central de Decisões e as 14 ferramentas

84 eventos, todos declarados no registry com descrição. Consulte-o — a lista
aqui envelheceria; o arquivo não pode.

## Duas camadas sobre o mesmo clique

Dentro de ferramenta e da busca, um clique dispara **dois** eventos: o
específico que a ferramenta já mandava (`early_payoff_debt_plan_click`) e o
genérico (`cta_click`).

Não é bug, e não corrompe métrica — no GA4 cada nome é contado à parte. É
escolha:

- o **específico** responde *de qual ferramenta a pessoa saiu, para onde*;
- o **genérico** responde *a taxa de aceite de CTA do guia local é maior ou
  menor que a do artigo?* — pergunta que precisa da mesma régua no site todo.

Manter só o específico impediria a comparação. Manter só o genérico apagaria o
detalhe já acumulado no GA4 desde agosto.

## O que nunca sai do navegador

Duas defesas, em `src/lib/analytics/redact.ts`, no caminho de **todo** evento:

1. **Chave proibida é recusada** — `valor`, `renda`, `saldo`, `divida`,
   `parcela`, `taxa`, `juros`, `cet`, `cpf`, `cnpj`, `nome`, `email`,
   `telefone`, `instituicao`, `banco`, `prazo`, `score`, `limite` e afins.
   Não é filtro de valor: é recusa de intenção;
2. **Texto é redigido por FORMA** — moeda (`R$ 1.240,00`), percentual
   (`12,5%`), CPF, CNPJ, telefone e sequência longa de dígitos viram `#`.

A redação é por forma, e não "todo número", de propósito: apagar todo dígito
destruiria rótulo legítimo — *151 do Procon*, *13º salário*, *Lei 14.181* —
e deixaria o relatório ilegível sem ganho de privacidade.

Também nunca viajam: query string e hash de link interno (podem carregar
estado de ferramenta), o número no link de WhatsApp, e qualquer
`user_property` — **nada** é colado à pessoa entre sessões.

### Por que um redator, se a regra já era "não envie valor"

Porque a regra dependia de alguém lembrar dela em cada linha nova. Com
delegação, o rótulo passa a ser lido do DOM — e o DOM de uma ferramenta contém
resultado calculado. Um botão que hoje diz "Copiar resumo" pode amanhã dizer
"Copiar resumo (R$ 1.240,00)", e ninguém pensaria em analytics ao mudar essa
copy.

## Conferir a medição sem abrir o GA4

Abra qualquer página com **`?cpp_debug=1`**. Cada evento que sairia aparece no
console do navegador com o nome e os parâmetros já redigidos. Funciona em
produção, sem extensão, e sobrevive à navegação (fica em `localStorage`).
Desliga com `?cpp_debug=0`.

É a maneira de responder "este botão está sendo medido?" em cinco segundos, e
de conferir com os próprios olhos que nenhum valor está vazando.

## O que configurar no GA4 (pendente do proprietário)

Os eventos já chegam. Para virarem relatório, falta o painel:

1. **Dimensões personalizadas** — Administrador → Definições personalizadas →
   Criar. Escopo de **evento**, uma para cada parâmetro que se queira usar em
   relatório: `area`, `component`, `label`, `to_path`, `page_type`,
   `destination`, `domain`, `channel`, `position`, `journey`, `target`,
   `question`, `source`. *Sem esse passo o parâmetro chega e não aparece em
   lugar nenhum* — é a pegadinha clássica do GA4;
2. **Eventos principais** — Administrador → Eventos → marcar como evento
   principal: `outbound_click`, `cta_click`, `contact_click`,
   `decision_tool_open`, `decision_next_step_click`, `search_result_click` e
   os `*_complete` das ferramentas;
3. **Limites que valem lembrar**: 500 nomes de evento por propriedade (nome
   criado não se apaga), 25 parâmetros por evento, 50 dimensões
   personalizadas de escopo de evento, 100 caracteres por valor de parâmetro.

## O funil que interessa

Num portal que não vende nada, "conversão" tem dois desfechos legítimos:

```
página → ferramenta aberta → ferramenta concluída
página → fonte oficial (outbound_click, destination=banco-central|procon|…)
```

E a pergunta de qualidade não é *quantas ferramentas por sessão*. Se a pessoa
resolve na primeira, ótimo. É: **ela chegou rápido a uma porta apropriada?** —
medida por `cta_click` sobre visualizações, por tipo de página.

## O que ainda não existe

**Não há botão de WhatsApp no site.** WhatsApp aparece nos artigos e na
verificação de golpe como *assunto* — golpe por WhatsApp, como confirmar se o
número é mesmo da instituição —, nunca como canal de contato do portal. O
evento `contact_click` com `channel=whatsapp` já está pronto e testado: se um
canal for criado, ele é medido no primeiro clique, sem tocar em código de
analytics. O número não viaja em nenhuma hipótese.

**E `contact_click` hoje não dispara em lugar nenhum.** Não é falha da
medição: é que o site não tem link de contato clicável. O e-mail da página
`/contato/` é texto (`<strong>`), não `mailto:` — escolha antiga, contra
coleta automática de endereço. A auditoria não reclama disso porque
`contact_click` é evento delegado: ele existe para o dia em que um canal
existir, e nesse dia mede sozinho.

Se o e-mail virar link algum dia, o evento passa a contar no mesmo instante,
sem tocar em código de analytics.
