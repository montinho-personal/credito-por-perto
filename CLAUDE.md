# Crédito por Perto — instruções permanentes

## ⚠️ REGRA ATIVA: o site está em análise do AdSense

**Desde 03/09/2026, o domínio está sob revisão do Google AdSense.**

Enquanto essa análise não fechar, **nenhuma mudança brusca entra no site**. E,
antes de executar qualquer pedido que possa atrapalhar a revisão, a primeira
coisa a fazer é **perguntar ao proprietário se a aprovação já saiu**.

Não é uma formalidade: um revisor humano pode abrir o site a qualquer momento
da janela, e o que ele encontrar decide semanas de espera.

### Pare e pergunte antes de fazer

Se o pedido envolver qualquer um destes, **pergunte primeiro se já foi aprovado**:

- mudar, redirecionar ou remover URLs e slugs;
- alterar `canonical`, `robots.txt`, `sitemap.xml` ou meta robots;
- despublicar, esvaziar ou apagar páginas;
- mexer na arquitetura, nos hubs ou na navegação principal;
- tocar no script do AdSense, no `public/ads.txt` ou no Publisher ID;
- ativar unidades de anúncio, Auto Ads ou qualquer slot;
- alterar o banner de consentimento ou a camada de analytics;
- publicar conteúdo incompleto, rascunho ou placeholder;
- qualquer coisa que possa fazer o site parecer "em construção".

A resposta muda o que se faz:

- **Ainda em análise** → propor a alteração, explicar o risco e esperar. Se for
  urgente, executar apenas a versão mínima e reversível.
- **Já aprovado** → seguir normalmente, com o cuidado habitual.

### Continua liberado, sem precisar perguntar

O site não deve congelar. Estas frentes só melhoram o que o revisor vê:

- publicar conteúdo novo, completo e verificado em fonte oficial;
- corrigir erro factual ou dado vencido (isso é urgente, não arriscado);
- adicionar capas, chamadas de ferramenta e links internos dentro da
  estrutura que já existe;
- aprofundar página rasa;
- corrigir bug, acessibilidade ou performance.

### Quando esta regra acaba

Quando o proprietário confirmar a aprovação. Aí **esta seção sai deste arquivo**
— e a regra que fica no lugar é a de sempre: mudança de grande impacto se
apresenta antes de executar.

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
