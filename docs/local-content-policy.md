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

## Publicação em lotes

Pauta → intenção → briefing → dossiê → redação → checagem → auditorias →
revisão → publicar → monitorar → aprender antes do próximo lote. Volume não é
critério de sucesso; nenhuma geração automática em massa.
