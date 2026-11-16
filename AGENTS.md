# Crédito por Perto — instruções para agentes

Este arquivo complementa o `CLAUDE.md`, que continua valendo inteiro: verificação só com
fonte oficial e datada, voz sem veredito, privacidade, áreas protegidas de anúncio, as
checagens antes de publicar, a cadeia de publicação e a pesquisa no Google pelo SerpApi
(como celular e na região do site). Em caso de conflito, vale a regra mais estrita.

A lista única de sugestões fica em **`docs/seo/pauta.md`**. `docs/pauta-seo.md` é o
histórico das ondas de agosto e setembro de 2026.

## Regra do que fica de fora (16/11/2026)

Toda revisão ou artigo novo com pesquisa termina separando as buscas que ficaram de
fora em três grupos, com o motivo de cada uma:

1. **Vale um artigo:** o site não cobre e o assunto cabe no tema do site (crédito,
   dívidas, juros e custos, golpes, direitos do consumidor de crédito, guias locais).
   Entra em `docs/seo/pauta.md`, parte 1, com as buscas, o volume (quando houver) e o
   motivo.
2. **Vira seção de um artigo existente:** dizer qual. Entra na parte 2 da pauta e, se
   ajudar, numa nota no briefing desse artigo.
3. **Não cabe:** pessoa, marca (banco, financeira, aplicativo), promessa (aprovação,
   taxa, "melhor banco"), outro serviço ou assunto fora do tema. Fica só na resposta
   ao Renato, com o motivo.

Antes de sugerir, conferir o acervo (slug, título e texto dos artigos e guias, com
hífen e acento normalizados) para não sugerir o que já existe nem canibalizar uma
página.

Ao publicar ou revisar algo da pauta, **riscar a linha** (`~~...~~`) e anotar o slug e
a data. **Pauta é sugestão: nada é escrito sem o Renato escolher.** A rotina diária de
revisão (abaixo) é a exceção que ele mesmo autorizou, e só revisa páginas que já existem.

## Rotina diária de revisão (16/11/2026)

Tarefa agendada nesta sessão, todo dia às **18h17 de Brasília** (o montinhopersonal roda
às 15h41). **N = 1 revisão por dia**, pela cota do SerpApi (abaixo).

### 1. Escolher a página

1. Primeiro, a próxima linha não riscada de **"Revisões pendentes"** (parte 4 da pauta),
   na ordem da lista. Antes, olhar "Atualizações com data marcada" (parte 2): se a data
   chegou, ela passa na frente.
2. Esgotadas as pendentes: páginas com impressões no Search Console e CTR baixo ou
   posição média entre 5 e 20 nos últimos 28 dias. Em 16/11/2026 o Search Console deste
   site não estava entre as 2 contas priorizadas do plano Supermetrics; sem esse dado,
   seguir só pela pauta e avisar.

### 2. Pesquisar no SerpApi

- Como o `CLAUDE.md` descreve: Google Brasil, pt-BR, **como celular**, região **São
  Paulo** para artigo nacional e **a cidade da página** para guia de cidade (nome
  exato pela lista de locais do SerpApi).
- Orçamento por revisão: a busca principal (página + autocompletar = 2 créditos), mais
  1 se a visão de IA vier em duas etapas. **Busca secundária só se a principal vier
  fraca** (sem perguntas, sem visão de IA e com orgânicos fora do tema). Não repetir
  busca já feita (conferir o `serpEvidence` dos briefings).
- **Se o SerpApi responder sem cota, com erro de chave ou fora do ar: parar e avisar o
  Renato.** Não revisar às cegas e não pedir print sem ele concordar.

### 3. Reescrever

- Todas as regras do repositório: dono da intenção no `data/query-ownership-map.json`
  (sem canibalizar), originalidade, links internos, ferramenta quando couber, FAQ.
- **Fato só com fonte oficial e datada**, como manda o `CLAUDE.md` (mais estrito que
  "dois veículos"). Print, resultado do Google e visão de IA mostram o que as pessoas
  procuram; não são fonte. Quando a fonte não fecha, a lacuna é declarada.
- H2 e FAQ a partir do que as pessoas buscam (perguntas, autocompletar, outras
  pesquisas).
- `updatedAt` e `sourceCheckedAt` só mudam com mudança real de conteúdo ou de fonte.
- **Título, `seoTitle` e descrição não mudam sem aprovação.** Mandar como proposta:
  ATUAL / PROPOSTA / MOTIVO.
- Capa: manter a que existe. Página sem capa não ganha capa improvisada; se não houver
  crédito para fazer no padrão do site, fica em "Capas pendentes" na pauta.
- Evidência: no briefing da página, `serpEvidence` com um JSON enxuto de cada busca
  (busca, data, aparelho, local, autocompletar, perguntas, outras pesquisas, texto e
  fontes da visão de IA, orgânicos com posição, título e endereço, mapa), sem
  `page_token` nem links do serpapi.com, e `serpImpact` dizendo o que cada dado mudou.
- Registrar as sobras pela regra do que fica de fora e riscar a linha da pauta.

### 4. Publicar

- `pnpm lint && pnpm tsc --noEmit && pnpm test && pnpm audit:all && pnpm build`,
  comparando com o resultado anterior (hoje tudo verde: 995 testes e as 14 auditorias
  sem críticos nem avisos). Falha nova se corrige antes de publicar.
- Publicar pela cadeia do `CLAUDE.md` (push do branch e merge `--ff-only` no `main`),
  que é o "merge" deste repositório; não se abre PR aqui.
- Conferir no ar (deploy da Vercel READY, página com status 200 e o conteúdo novo).

### 5. Responder ao Renato (português, curto)

- Os links publicados.
- As intenções por tipo: autocompletar, "As pessoas também perguntam", "Outras pessoas
  pesquisaram", visão de IA (o que diz e quem cita) e quem ranqueia, com ✅ para o que
  entrou e ❌ para o que ficou de fora, com o motivo.
- A separação do que ficou de fora (vale um artigo / vira seção / não cabe).
- As propostas de título e descrição que esperam aprovação.
- Créditos do SerpApi gastos no dia.

## Cota do SerpApi

Uma conta para todos os sites do Renato: 250 buscas por mês no plano grátis. O
montinhopersonal usa cerca de 120 a 150 por mês.

| Revisões por dia | Por revisão | Por mês (30 dias) | Com o montinhopersonal |
| --- | --- | --- | --- |
| 2 | 2 a 3 (até 5 a 6 com secundária) | 120 a 180 (até ~360) | 240 a 330: **não cabe** |
| 1 | 2 a 3 (até 5 a 6 com secundária) | 60 a 90 (até ~180) | 180 a 240: cabe, apertado |

Por isso N = 1. Pedidos avulsos ("cria o próximo artigo", "revisa o próximo") gastam da
mesma conta: se a soma do mês passar de ~230, avisar antes de buscar.
