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
