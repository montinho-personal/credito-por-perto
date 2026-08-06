# Hierarquia de fontes

Ordem de preferência para qualquer afirmação publicada:

## Nível A — Oficiais e primárias

Banco Central do Brasil; Planalto (legislação); Governo Federal / Gov.br;
IBGE; INSS; Receita Federal; Caixa Econômica Federal; Procons; Defensorias;
Tribunais; CVM (quando pertinente); diários oficiais; documentos regulatórios;
dados abertos governamentais.

## Nível B — Documentação primária de instituição

Contratos, regulamentos, páginas oficiais de produto, relatórios, tabelas de
tarifas, localizadores de atendimento, comunicados oficiais.

## Nível C — Secundárias reconhecidas

Instituições de pesquisa, publicações acadêmicas, veículos jornalísticos com
reputação, organizações independentes, estudos metodologicamente transparentes.

## Nível D — Concorrentes e conteúdo comercial

Somente para análise de mercado e descoberta de pautas. **Nunca** base única
de afirmação crítica.

## Registro obrigatório (`content/sources/<slug>.json`)

Tipo `SourceLedger`: cada afirmação sobre taxas, limites, regras, produtos ou
programas registra fonte, organização, localização, tipo (`official`,
`primary-institution`, `academic`, `journalistic`, `commercial`), data de
consulta e, quando existir, vigência. Regras absolutas:

- nunca citar fonte não consultada;
- nunca inventar URL, documento, estudo, órgão ou data;
- informações variáveis sempre com data de consulta e indicação de que mudam;
- artigos evitam números voláteis (percentual de margem, alíquotas, taxas de
  mercado) — orientam a confirmar o valor vigente em fonte oficial.

A auditoria `audit:sources` exige ledger em todo artigo publicado, valida
datas (sem futuro) e gera `reports/source-freshness-report.json` apontando
consultas com mais de 180 dias para re-verificação.
