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
