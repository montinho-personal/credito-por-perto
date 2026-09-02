# Analytics

Quatro camadas, independentes entre si:

## 1. Vercel Web Analytics (ativo primeiro)

- Sem cookies e sem dados pessoais → não exige banner de consentimento.
- Código: `<Analytics />` no `src/app/layout.tsx` (pacote `@vercel/analytics`).
- Ativação: painel do Vercel → projeto → aba **Analytics** → **Enable**.
  Sem esse passo o componente não envia nada.
- Métricas: visitantes, páginas mais vistas, origem, dispositivo.

## 2. Google Analytics 4 (opcional, com consentimento)

- Propriedade criada em 16/08/2026; o ID real está como padrão em
  `src/components/analytics/AnalyticsGate.tsx` (IDs de métrica são públicos
  por natureza). `NEXT_PUBLIC_GA4_MEASUREMENT_ID`, se definida, tem
  precedência.
- Com o ID configurado, o visitante vê o banner (LGPD); o script do GA4 só
  carrega após o "Aceitar". A escolha fica em `localStorage`
  (`cpp-consent-analytics`) e vale para as próximas visitas.
- Nunca carrega em previews (`VERCEL_ENV !== production`).
- Criação da propriedade: analytics.google.com → Administrador → Criar
  propriedade → fluxo de dados Web com `https://www.creditoporperto.com` →
  copiar o "ID da métrica" (G-…) → colar em
  Vercel → Settings → Environment Variables (Production) → redeploy.

## 3. Google Search Console (dados de busca — o mais importante para SEO)

- Não é script no site: é a propriedade verificada no Google.
- Verificação preferida: DNS (o domínio foi comprado no Vercel; o próprio
  fluxo do GSC mostra o TXT a criar) ou meta tag via
  `NEXT_PUBLIC_GSC_VERIFICATION`.
- Após verificar, enviar `https://www.creditoporperto.com/sitemap.xml`.
- Métricas: consultas, impressões, cliques, posição média por página.

## 4. Eventos de clique (rastreamento do site inteiro)

Desde 02/09/2026 todo clique do site é medido por um ouvinte único, com
dicionário declarado, redação de valores e auditoria. A explicação completa —
o que marcar num componente novo, como conferir com `?cpp_debug=1`, e o que
configurar no painel do GA4 — está em **`docs/analytics-eventos.md`**.

Regra curta para quem for mexer no código: **nunca chame `gtag` direto**. Todo
evento passa por `track()` de `src/lib/analytics/track.ts`, e todo nome de
evento existe em `src/lib/analytics/event-registry.ts`. `pnpm audit:analytics`
quebra o build se qualquer uma das duas coisas for desrespeitada.

## 5. Eventos da Central de Decisões

Definidos em `src/lib/journeys/analytics.ts`. Medem **navegação**, nunca
situação financeira — a distinção está escrita no topo daquele arquivo e é
verificada por `pnpm audit:jornadas`.

| Evento | Quando | Parâmetros |
| --- | --- | --- |
| `decision_hub_view` | Central aberta | — |
| `decision_path_start` | Momento escolhido | `journey` |
| `decision_step_view` | Passo visto na Central | `journey`, `step` |
| `decision_tool_open` | Saída para ferramenta/conteúdo | `journey`, `target` |
| `decision_step_skip` | Passo pulado explicitamente | `journey`, `step` |
| `decision_path_complete` | Caminho encerrado | `journey`, `reason` |
| `decision_next_step_click` | Clique no "E agora?" | `from_tool`, `target`, `rank` |
| `decision_restart` | Progresso apagado pela pessoa | `journey` |
| `all_tools_open` | Porta 2 (catálogo) | `source` |

### O que nunca é enviado

- **Nenhum valor digitado**: renda, saldo, taxa, parcela, prazo, instituição.
  As ferramentas já seguiam essa regra; a Central não abre exceção.
- **Nenhuma propriedade de usuário.** Tudo é evento. Não existe, e não pode
  passar a existir, algo como `user_financial_state = "endividado"`: isso
  seria um rótulo persistente colado à pessoa, num relatório que ninguém
  revisa. O `journey` é um id de conteúdo — o mesmo tipo de dado que o
  caminho de uma página, que já apareceria no relatório de páginas se a
  jornada tivesse URL própria.

### O funil que interessa

Central vista → caminho iniciado → ferramenta aberta → próximo passo clicado
→ segunda ferramenta → encerramento.

E a métrica que decide se a Central funciona **não é ferramentas por sessão**.
Se a pessoa resolve o problema numa só, ótimo. A pergunta é: *ela encontrou
rapidamente uma ferramenta apropriada?* — medida por caminho iniciado sobre
Central vista, e por tempo até a primeira ferramenta aberta.
