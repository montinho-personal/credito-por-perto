# SEO local — sem páginas rasas

## Princípio

Uma página local só existe se apresenta **valor local real e verificado**.
"Empréstimos + nome de cidade" não é justificativa para uma URL. Página que
se diferencia só por nome de cidade, população, gentílico, DDD, CEP ou lista
nacional de bancos "vestida" de local **não é publicada**.

## Arquitetura de URLs

```
/emprestimos/                       hub nacional
/emprestimos/sp/                    índice do estado (só com guias publicados)
/emprestimos/sp/campinas/           município
/emprestimos/sp/barueri/alphaville/ bairro/região abaixo do município
```

Uma única URL canônica por localidade; variações
(`/emprestimo-campinas`, `/credito-em-campinas`…) não existem como páginas.
A divisão administrativa é validada contra `data/localities.json` (códigos
IBGE) — bairro, região ou condomínio **nunca** é tratado como município.

### Decisão de arquitetura: hierárquica, não plana (16/08/2026)

Avaliada a alternativa plana (`/emprestimo-em-cidade-uf/`), a decisão é
**manter a hierarquia `/emprestimos/[uf]/[cidade]/`**, por quatro razões:

1. Palavra-chave na URL é fator de ranking marginal no Google atual; a
   arquitetura de hubs, não — o índice `/emprestimos/sp/` acumula
   autoridade do cluster e escala a linkagem interna por estado;
2. Nomes de cidade se repetem entre estados (a versão plana precisaria de
   sufixo `-uf` de qualquer forma, perdendo a suposta limpeza);
3. A hierarquia suporta subdivisões reais (caso Alphaville:
   `/sp/barueri/alphaville/`), impossíveis no formato plano;
4. As páginas já estão publicadas e indexáveis — migrar agora custaria
   redirects e reprocessamento sem ganho mensurável.

## Seção de instituições e características locais (padrão desde 16/08/2026)

Cada guia municipal traz a seção **"O perfil financeiro da cidade"**, com:

- **Características reais e decisão-relevantes** (onde ficam os serviços,
  como a oferta de crédito chega na cidade) — nunca enfeite demográfico
  (população, gentílico, DDD), que é o padrão das doorway pages;
- **Presença bancária**: lista nominal de agências somente com fonte
  oficial datada — preferencialmente os dados abertos do BC
  (`Informes_Agencias`) — registrada no dossiê e revalidada no ciclo
  trimestral. Sem dado verificado, a seção publica o **método** de
  consulta (localizador do banco + Encontre uma instituição do BC) e a
  lista fica em `pendingVerification`;
- **Nunca**: ranking de bancos, recomendação, taxa por instituição —
  fato datado, não avaliação.

### Caso Alphaville

Alphaville **não é município**: é uma região planejada que abrange áreas de
Barueri e Santana de Parnaíba. O guia da região (`…/barueri/alphaville/`)
declara `localityType: region` + `municipalitiesInvolved`, tem intenção
própria (a qual município/Procon o endereço responde) e não duplica o guia de
Barueri. Se a verificação mostrar que a intenção não é distinta, a decisão
registrada no dossiê é consolidar/redirecionar — não manter páginas gêmeas.

## Pipeline de publicação

1. Localidade cadastrada em `data/localities.json` (com código IBGE);
2. Dossiê `content/local-dossiers/<id>.json` (tipo `LocalEvidence`): fontes
   oficiais com data, canais de proteção ao consumidor, programas verificados,
   perguntas específicas da localidade e lista `pendingVerification`;
3. Guia MDX em `content/local-guides/` com `status: draft` + `noindex: true`;
4. Verificação das informações → preencher dossiê com `checkedAt` reais;
5. Só então `status: published` + `lastVerifiedAt` + remoção do `noindex` —
   o schema Zod **bloqueia** publicação sem dossiê e data de verificação, e a
   auditoria `audit:local` exige fonte oficial + recurso acionável.

Enquanto draft: fora do sitemap, fora dos índices, noindex, sem anúncios, com
aviso visível de "guia em elaboração".

## Automação em escala

É permitido importar a lista de municípios do IBGE para `data/`, mas a geração
de páginas continua manual por lotes: nenhuma página é criada "só porque a
cidade existe". O índice estadual lista apenas guias publicados. A auditoria
`audit:originality` bloqueia pares de páginas locais cuja única diferença é o
nome da localidade (similaridade > 0,7 após remover o nome).

## Canonical local

Guia local único → canonical autorreferencial. Nunca canonical automática para
estado, home ou outra cidade. Duas locais parecidas demais → consolidar ou
redirecionar (decisão editorial), nunca "resolver" com canonical.
