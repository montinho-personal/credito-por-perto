# Propriedade de intenção (anti-canibalização)

## Modelo

Cada intenção de busca principal tem **uma** URL proprietária, registrada em
`data/query-ownership-map.json`:

```json
{
  "como identificar golpe de empréstimo": {
    "canonicalOwner": "/credito-seguro/como-identificar-golpes-de-emprestimo/",
    "supportingPages": ["/credito-seguro/deposito-antecipado-e-golpe/"]
  }
}
```

`supportingPages` cobrem sub-intenções e apontam links para a proprietária.

## Antes de criar uma página

1. Verificar se outra URL já responde à intenção (mapa + briefings);
2. Se a pauta é subseção, atualizar/ampliar a página proprietária em vez de
   criar concorrente;
3. Páginas redundantes → consolidar; URLs removidas → redirect 308 para a
   equivalente real (**nunca** para a home sem equivalente).

Exemplo aplicado: não existe artigo "Empréstimos: guia completo" separado —
o hub `/emprestimos/` é o dono dessa intenção, decisão registrada para evitar
duas páginas disputando a mesma consulta.

## Auditoria (`scripts/audit-cannibalization.ts`)

- Donos e páginas de apoio precisam existir;
- Intenção duplicada no mapa = crítico;
- Cada artigo declara `primaryIntent` no briefing; dois artigos com a mesma
  intenção primária = crítico; artigo cuja intenção pertence a outra URL =
  crítico; intenção fora do mapa = aviso (registrar).

Relatório: `reports/cannibalization-report.json`.
