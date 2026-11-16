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

**O que trazer de cada busca:** autocompletar, "As pessoas também perguntam",
"Outras pessoas pesquisaram", visão geral de IA (texto e fontes), resultados
orgânicos e, em busca local, o mapa (`local_results`). Google Brasil, São Paulo,
pt-BR, sem personalização.

**Como buscar** (bash; a chave está no cofre do ambiente e o proxy a envia sozinho,
não passe chave nenhuma):

```bash
serp() { curl -s -m 120 -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' -X POST https://mcp.serpapi.com/mcp \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"search\",\"arguments\":{\"params\":$1,\"mode\":\"compact\"}}}" \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["result"]["content"][0]["text"])'; }

# Página de resultados: related_questions, related_searches, ai_overview, organic_results, local_results
serp '{"engine":"google","q":"BUSCA","google_domain":"google.com.br","hl":"pt-br","gl":"br","location":"Sao Paulo,State of Sao Paulo,Brazil"}'
# Autocompletar: suggestions[].value
serp '{"engine":"google_autocomplete","q":"BUSCA","hl":"pt-br","gl":"br"}'
# Visão de IA que veio só com "page_token" (sem text_blocks): um pedido a mais
serp '{"engine":"google_ai_overview","page_token":"TOKEN"}'
```

**Cota:** uma conta só para todos os sites do Renato, 250 buscas por mês no plano
grátis. Cada busca gasta 2 (página + autocompletar), 3 com a visão de IA em duas
etapas. Buscar só o que a peça precisa (em geral 2 ou 3 buscas), nunca em massa, e
não repetir busca já feita no mesmo dia.

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
