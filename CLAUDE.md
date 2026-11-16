# Crédito por Perto — instruções permanentes

## Estado do AdSense (atualizado em 24/09/2026)

A revisão do Google AdSense aberta em 03/09/2026 fechou com o resultado
**"requer atenção"** (não aprovado). Decisão do proprietário: trabalhar o site
normalmente por alguns meses e tentar de novo mais para a frente.

Enquanto isso:

- não há congelamento: hubs, navegação, arquitetura e ferramentas evoluem
  normalmente, sempre pela regra permanente de mudança de grande impacto
  (apresentar antes de executar, o que o próprio pedido do proprietário já
  cumpre);
- o site deve continuar pronto para um revisor a qualquer momento: nada de
  placeholder, rascunho ou página que pareça "em construção";
- o script do AdSense, o `public/ads.txt`, o Publisher ID, o banner de
  consentimento e a camada de analytics continuam exigindo pergunta antes de
  qualquer alteração;
- quando o proprietário decidir reaplicar, esta seção volta a ser a regra de
  "pare e pergunte" da janela de análise.

---

## Regras permanentes do projeto

**Verificação.** Nunca inventar dado legal, número, taxa, endereço ou fato
local. Tudo vem de fonte oficial e datada — BC, Planalto, gov.br, prefeitura,
IBGE, Procon. Nunca de blog e nunca de memória. Quando a fonte não fecha, a
lacuna é declarada; nunca preenchida por estimativa.

**Voz.** Sem veredito, sem recomendação individual, sem promessa de aprovação
ou de taxa. O portal explica e o leitor decide.

**Privacidade.** Cálculo no navegador. Nenhum valor digitado sai do aparelho,
vai para analytics ou é gravado. Nada de CPF nem de cadastro.

**Áreas protegidas de anúncio.** Nunca dentro de calculadora, entre campo e
botão, entre botão e resultado, junto de telefone ou endereço oficial, nem
acima do conteúdo principal. Ver `docs/adsense-protected-areas.md`.

**Antes de publicar, sempre:** `pnpm lint && pnpm tsc --noEmit && pnpm test &&
pnpm audit:all && pnpm build`. As 14 auditorias precisam terminar sem críticos
e sem avisos.

**Publicação automática (decisão do proprietário, 23/09/2026).** Trabalho
pronto e aprovado nas verificações acima vai direto para o `main`, sem
esperar "pode publicar". Depois de publicar, mandar o link de produção e o
relatório; o proprietário revisa no ar e pede ajustes. Continuam valendo a
regra do AdSense (itens de "Pare e pergunte" exigem pergunta antes) e a
regra de verificação: dado que não fecha com fonte oficial não entra, ou
entra com a lacuna declarada.

**Cadeia de publicação:**

```
git push -u origin claude/new-session-04856f
git checkout main && git merge --ff-only claude/new-session-04856f
git push origin main && git checkout claude/new-session-04856f
```

**Nunca `pkill` dentro de uma cadeia de comandos.** Para matar servidor de
teste: `fuser -k 3777/tcp`.

**Identidade de modelo** não entra em commit, PR, comentário de código nem em
nenhum artefato versionado.

## Pesquisa no Google pelo SerpApi (no lugar dos prints)

Desde 16/11/2026, os dados do Google que o Renato mandava em print vêm do
**SerpApi**, buscados pelo próprio Claude no começo da tarefa. Não pedir print
ao Renato; só se o SerpApi falhar (sem cota ou fora do ar).

**Pedido de "cria o próximo artigo" ou "revisa o próximo" (regra do Renato,
16/11/2026):** começar já pela pesquisa, sem perguntar nada antes. Pegar a próxima
peça da pauta (ou a que ele nomear), definir 2 ou 3 buscas (a principal e as
secundárias do doc ou da pauta), buscar no SerpApi e seguir o fluxo inteiro deste
arquivo: fontes, texto, checagens e publicação. Na resposta final, além do link,
mandar as intenções de busca separadas por tipo (autocompletar, "As pessoas também
perguntam", "Outras pessoas pesquisaram", visão de IA com o que diz e quem cita, e
quem ranqueia), marcando o que entrou no texto e o que ficou de fora, com o motivo.

**Depois de cada artigo ou revisão: as buscas que ficaram de fora viram pauta (regra do
Renato, 16/11/2026).** Sem esperar pedido, pegar tudo o que foi marcado como "ficou de
fora" nas intenções de busca, conferir no site (artigos, páginas e docs) o que já existe
e separar em três grupos: **vale um artigo** (assunto que o site ainda não cobre, com
fonte possível e busca real; entra na pauta com as buscas e o motivo), **não recomendo**
(com o motivo: nome de marca, fora do tema do site, sem fonte, canibaliza uma página que
já existe) e **cabe em página existente** (anotar no doc dessa página, para a próxima
revisão dela). Mandar ao Renato junto com a resposta final, em lista curta, na ordem em
que faria os artigos. Só entra na pauta; criar o artigo continua sendo um pedido dele.

**O que trazer de cada busca:** autocompletar, "As pessoas também perguntam",
"Outras pessoas pesquisaram", visão geral de IA (texto e fontes), resultados
orgânicos e, em busca local, o mapa (`local_results`). Google Brasil, pt-BR, sem
personalização, **como celular** e na **região do site** (abaixo).

**Aparelho e região (pedido do Renato, 16/11/2026):** sempre `"device":"mobile"`, porque
a maior parte do público chega pelo celular. Região padrão deste site: **São Paulo** (`Sao Paulo,State of Sao Paulo,Brazil`) para os artigos nacionais. Guia ou dossiê de uma cidade usa a cidade dele.
O nome exato da cidade sai da lista de locais do SerpApi, que é grátis e não gasta cota:
`curl -s "https://serpapi.com/locations.json?q=Barueri&limit=3"` (usar o `canonical_name`).
Bairro quase nunca existe na lista: use a cidade. O autocompletar não aceita cidade nem
aparelho; ele sai pelo Brasil (`gl=br`). Mesmo assim, o resultado não bate 100% com o
celular do Renato: muda com o dia, com testes do Google e com a digitação letra a letra.

**Como buscar** (bash; a chave está no cofre do ambiente e o proxy a envia sozinho,
não passe chave nenhuma):

```bash
serp() { curl -s -m 120 -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' -X POST https://mcp.serpapi.com/mcp \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"search\",\"arguments\":{\"params\":$1,\"mode\":\"compact\"}}}" \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["result"]["content"][0]["text"])'; }

# Página de resultados: related_questions, related_searches, ai_overview, organic_results, local_results
serp '{"engine":"google","q":"BUSCA","google_domain":"google.com.br","hl":"pt-br","gl":"br","device":"mobile","location":"CIDADE,State of ESTADO,Brazil"}'
# Autocompletar: suggestions[].value
serp '{"engine":"google_autocomplete","q":"BUSCA","hl":"pt-br","gl":"br"}'
# Visão de IA que veio só com "page_token" (sem text_blocks): um pedido a mais
serp '{"engine":"google_ai_overview","page_token":"TOKEN"}'
```

**Cota:** uma conta só para todos os sites do Renato, em plano pago desde 16/11/2026 (1.000 buscas por mês)
(o limite do mês aparece no painel do SerpApi; se a API disser que acabou, parar e
avisar). Cada busca gasta 2 (página + autocompletar), 3 com a visão de IA em duas
etapas. Buscar só o que a peça precisa (em geral 3 buscas), nunca em massa, e não
repetir busca já feita no mesmo dia.

**Orçamento do mês (1.000 pesquisas, todos os sites somados; conta de 16/11/2026):**
rotina diária do Direito de Verdade (2 revisões, 2 buscas cada) cerca de 300; rotinas
do Personal por Perto (artigos e cidades, 2 + 2 por dia) cerca de 360; rotina do Site do
Montinho cerca de 120 a 150; rotina do Crédito por Perto (1 revisão por dia) cerca de 60
a 90; rotinas mensais (com o alerta do Crédito) cerca de 35. Total: 875 a 935, com pouca sobra para pedidos
avulsos. Rotina nova, ou maior, só depois de refazer esta conta com o Renato; passou de
850 no mês, só pesquisar o que ele pedir.

**Evidência:** guardar no doc da peça, no lugar dos prints, um JSON enxuto de cada
busca (busca, data, autocompletar, perguntas, outras pesquisas, texto e fontes da
visão de IA, orgânicos com posição, título e endereço), sem `page_token` nem links
do serpapi.com, e preencher a tabela de prints dizendo o que cada dado mudou no texto.

**Continua valendo:** o que o Google mostra, inclusive a visão de IA, diz o que as
pessoas perguntam; não é fonte de fato.

**Se der erro de chave** ("Invalid API key", 401 ou host bloqueado): a chave não está
no ambiente desta sessão. Chamar a ferramenta `request_credential` para o host
`mcp.serpapi.com` (tipo bearer) e pedir ao Renato que cole a chave do SerpApi (menu
"API Key" em serpapi.com) no formulário. Nunca pedir a chave na conversa.

## Estratégias de SEO com o SerpApi (decisão do Renato, 16/11/2026)

Além da pesquisa de cada peça, o SerpApi serve para o seguinte. O Search Console continua
sendo a fonte da posição e dos cliques do próprio site; o SerpApi não substitui isso.

1. **Formato antes de escrever (sem busca extra).** Olhar os primeiros resultados da
   pesquisa da peça: se são calculadoras ou ferramentas, a peça é ferramenta; se são
   vídeos, registrar no doc que o texto sozinho dificilmente entra; se há mapa, é busca
   local. Anotar a decisão no doc da peça.
2. **Visão de IA.** Em toda pesquisa, registrar no doc quem a visão de IA cita e como é a
   resposta (tamanho, lista, tabela, exemplo com número). Escrever o lead e a primeira
   seção de modo que respondam do mesmo jeito direto, com fonte oficial. Uma vez por mês,
   a rotina mensal repete as buscas principais do site e anota em
   `docs/seo/visao-de-ia.md` se o site passou a ser citado.
3. **Concorrentes.** No doc da peça, anotar os domínios que ocupam os primeiros lugares e
   se são fracos (rede social, fórum, página antiga): essas buscas têm prioridade na pauta.
4. **Sazonalidade.** Antes de pautar tema sazonal, consultar o Google Trends pelo SerpApi
   (`{"engine":"google_trends","q":"TERMO","geo":"BR","date":"today 5-y"}`) e publicar
   algumas semanas antes do pico. Uma busca por tema, não por artigo.
5. **Alerta de mudança de regra.** Na rotina mensal, uma busca de notícias
   (`{"engine":"google_news","q":"TERMO","gl":"br","hl":"pt-br"}`) para os temas que mudam
   (Banco Central, CMN, consignado, Selic, Desenrola). Mudou: conferir na fonte oficial e
   revisar a página; a notícia não é fonte.
