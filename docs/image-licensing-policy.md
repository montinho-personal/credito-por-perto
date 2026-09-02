# Política de origem de imagens e ativos

## Estado atual

Todos os ativos visuais do portal são **próprios**: nenhum vem de banco de
imagens, de concorrente ou de terceiro licenciado. Eles têm duas origens, e a
distinção importa:

| Lote | Arquivos | Origem |
| --- | ---: | --- |
| `public/brand/**/*.svg` | 7 | Identidade oficial fornecida pelo proprietário, desenhada em vetor |
| `public/images/articles/**/*.webp` | 66 | **Gerada por IA** sob direção do proprietário, a partir da identidade |
| `public/images/local/**/*.webp` | 17 | **Gerada por IA** sob direção do proprietário, a partir da identidade |

Não há fotografia de pessoa real nem ativo de terceiro. Por isso o que este
documento controla é **origem**, não licença comprada: a pergunta a responder
não é "temos direito de usar?", e sim "de onde veio esta imagem, quem responde
por ela e ela foi gerada por IA?".

A declaração autoritativa fica em **`data/asset-origins.json`** — este texto é
a explicação, aquele arquivo é o registro.

## Por que por lote, e não arquivo a arquivo

Este documento já terminava, antes, com a frase "a auditoria de aprovação
editorial exige que todo ativo tenha linha nesta tabela". A frase era
verdadeira como intenção e falsa como fato: não existia auditoria nenhuma, e
**60 dos 83 arquivos publicados haviam entrado sem registro**, ao longo de um
mês, sem que nada reclamasse.

A correção não foi escrever 83 linhas — elas estariam certas naquele dia e
erradas na capa seguinte, do mesmo jeito silencioso. Foi declarar por
diretório, que descreve o que de fato é verdade sobre a produção do portal, e
transferir a detecção para `pnpm audit:ativos`: arquivo publicado fora de
qualquer lote **quebra o build**, e a resposta é declarar de onde ele veio.

## Regras para novos ativos

1. **Prioridade**: ilustrações e diagramas próprios, capas padronizadas na
   identidade do portal;
2. **Proibido**: copiar imagem ou infográfico de concorrente; usar imagem sem
   origem verificada; remover marca d'água; screenshot sem necessidade e sem
   autorização; foto clichê de dinheiro espalhado ou promessa visual de
   enriquecimento; imitar identidade visual de instituição real;
3. **Imagem gerada por IA** — o caminho usado em todas as capas e
   infográficos. Permitida, com três limites que valem mais que a estética:
   - **não retratar pessoa que possa ser tomada por indivíduo real e
     identificável**. A arte ilustra dívida, cobrança e golpe; uma pessoa
     reconhecível nesse contexto é um problema de outra ordem;
   - **não imitar identidade visual de instituição financeira real** — nem
     logotipo, nem paleta, nem layout de aplicativo existente;
   - **não representar promessa de resultado**: aprovação garantida, dinheiro
     chovendo, crédito fácil;
   - número que apareça na arte é **exemplo**, e o dado com fonte fica no
     texto, nunca só na imagem;
4. **Ativo de terceiro** (nenhum hoje): só com licença verificada e
   comprovante guardado, ou domínio público/CC com URL da licença e a
   atribuição exigida. Entra como lote próprio em `asset-origins.json`;
5. **Registro**: lote novo → entrada em `data/asset-origins.json` com origem,
   direitos, evidência, `aiGenerated` e data.

## O que a auditoria verifica

`pnpm audit:ativos` (dentro de `pnpm audit:all`):

- **crítico** — arquivo em `public/` fora de todos os lotes declarados;
- **crítico** — lote sem origem, direitos, evidência ou data;
- **crítico** — existe ativo gerado por IA publicado e a página
  [Quem somos](/quem-somos/) não informa isso ao leitor;
- **aviso** — lote declarado que não corresponde a arquivo nenhum (resíduo de
  diretório movido ou apagado).

## Transparência com o leitor

A última checagem acima é a que menos parece técnica e mais importa. O portal
declara publicamente o uso de IA na produção de texto; desde 02/09/2026
declara também nas ilustrações, dizendo o que elas são e o que não são — não
são fotografias, não retratam pessoas reais, não representam telas, documentos
ou instituições existentes.

Enquanto houver imagem gerada por IA publicada, essa declaração não pode
desaparecer da página sem quebrar o build. É deliberado: a transparência aqui
não depende de alguém lembrar dela.
