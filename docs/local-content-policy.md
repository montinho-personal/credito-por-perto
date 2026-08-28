# Política de conteúdo local

Complementa `docs/seo-local.md` com os critérios editoriais.

## Regra de existência

Uma página local só existe com valor local real. **Não** tornam uma página
local original: nome da cidade/estado, população, gentílico, mapa, lista de
cidades próximas, CEP, DDD, distância da capital, nome do prefeito, dados
econômicos genéricos, substituição automática de nomes, ou lista nacional de
bancos apresentada como local. Dados demográficos só entram quando ajudam a
decisão de crédito do leitor — nunca para engordar texto.

Pergunta-filtro para cada informação local: *como este dado ajuda o leitor
desta localidade a entender, comparar ou contratar crédito com mais
segurança?* Sem resposta → o dado não entra.

## Dossiê obrigatório (`content/local-dossiers/`)

Tipo `LocalEvidence`: classificação administrativa oficial, fontes oficiais
com `checkedAt` e fato extraído, canais de proteção ao consumidor, programas
locais verificados, informações de atendimento verificáveis, perguntas únicas
da localidade, riscos/alertas locais e impacto na decisão. Rascunhos carregam
`pendingVerification` com tudo o que falta checar.

## Critérios de publicação (todos obrigatórios)

1. Classificação administrativa correta (validada contra `data/localities.json`);
2. Fontes oficiais verificadas com data;
3. Utilidade específica para o morador + ≥1 recurso local acionável;
4. Orientações próprias de proteção ao consumidor;
5. Texto que não depende da troca do nome da cidade (auditoria bloqueia);
6. Aprovado nas auditorias de similaridade e canonical;
7. Sem competição desnecessária com outra página (mapa de intenção);
8. Título, H1 e descrição únicos; canonical autorreferencial;
9. Links internos contextuais; sem promessa de aprovação; sem instituições ou
   ofertas inventadas; sem "as melhores" sem metodologia;
10. Data real de verificação (`lastVerifiedAt`).

Qualquer condição importante falhando →
`status: draft` + `noindex` + fora do sitemap + sem AdSense.
**Não se publica "para ver se o Google indexa".**

## Mapa Financeiro da Cidade

A página local não é um texto sobre a cidade: é um guia de utilidade que lista
**recursos públicos oficiais** úteis a quem tem dívida, cobrança ou contrato de
crédito para resolver. O código vive em `src/lib/local/`.

### Duas camadas, uma fonte para cada

| Camada | Alcance | Onde mora | Por quê |
| --- | --- | --- | --- |
| Local | `IN_CITY`, `SERVES_CITY` | dossiê da cidade | verificado município a município |
| Geral | `REGIONAL`, `STATEWIDE`, `NATIONAL` | `data/financial-map/registry.json` | definido **uma vez** e resolvido por escopo |

Recurso nacional copiado dentro de 23 dossiês produz exatamente o que esta
política proíbe: páginas que só trocam o nome da cidade. Por isso o registry
existe, e por isso item de dossiê cuja fonte já está no registry é descartado
da camada local (dedupe por host + primeiro segmento — nunca só por host, ou
`procon.sp.gov.br/caieiras/` seria confundido com a fundação estadual).

### O que nunca entra

Serviço comercial (banco, financeira, correspondente), ranking, nota, score,
"melhor opção da cidade", Google Maps ou qualquer agregador como fonte,
cobertura inferida por proximidade, GPS e distância. Fonte é sempre URL de
órgão público, com data real de verificação.

### Indexability Gate

**Existir no banco de dados não significa merecer uma URL indexável.**
`evaluateCityIndexability` decide, com data de referência explícita:

- `DO_NOT_GENERATE` — sem identidade oficial (município sem código IBGE), sem
  dossiê ou sem nenhum recurso exibível. Não é caso de `noindex`: é caso de não
  existir rota;
- `NOINDEX` — a página pode existir para quem chega por link, mas não entra no
  índice: não tem recurso próprio da cidade, ou sua camada local é idêntica à
  de outra cidade depois de remover o topônimo (teste anti-doorway);
- `REVIEW` — tem substância local, mas a verificação passou de
  `STALE_VERIFICATION_DAYS` ou uma fonte caiu. Segue indexável, entra na fila;
- `INDEX` — camada local real, verificada e distinta.

A decisão é a verdade única de indexação: `metadata`, sitemap e listagens usam
`isGuideIndexable` (`src/lib/local/guide-indexability.ts`). Publicar é decisão
editorial; indexar é consequência da evidência.

### Reverificação fail-safe

`src/lib/local/resource-health.ts` separa três coisas que costumam ser
confundidas:

- **fonte inacessível** (`source_unavailable`) — nada foi aprendido. O recurso
  continua visível, com aviso ao leitor, e `verifiedAt` **não** avança;
- **remoção confirmada** (`removed`) — some do mapa, mas só após
  `CONFIRMATIONS_TO_REMOVE` checagens seguidas. Um 404 isolado não basta;
- **confirmação** (`active`) — único caminho que avança `verifiedAt`.

Uma data de verificação inflada é pior que uma data velha: a velha avisa o
leitor, a inflada mente para ele.

### Área protegida de publicidade

Nenhum slot de AdSense entra na seção do mapa. Anúncio ao lado de uma lista de
órgãos públicos é lido como serviço oficial — é a confusão mais cara que uma
página de utilidade pode provocar. Há teste garantindo isso.

## Publicação em lotes

Pauta → intenção → briefing → dossiê → redação → checagem → auditorias →
revisão → publicar → monitorar → aprender antes do próximo lote. Volume não é
critério de sucesso; nenhuma geração automática em massa.
