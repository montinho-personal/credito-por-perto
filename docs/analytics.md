# Analytics

Três camadas, independentes entre si:

## 1. Vercel Web Analytics (ativo primeiro)

- Sem cookies e sem dados pessoais → não exige banner de consentimento.
- Código: `<Analytics />` no `src/app/layout.tsx` (pacote `@vercel/analytics`).
- Ativação: painel do Vercel → projeto → aba **Analytics** → **Enable**.
  Sem esse passo o componente não envia nada.
- Métricas: visitantes, páginas mais vistas, origem, dispositivo.

## 2. Google Analytics 4 (opcional, com consentimento)

- Desativado por padrão: sem `NEXT_PUBLIC_GA4_MEASUREMENT_ID` real
  (formato `G-…`), nem o banner de consentimento aparece.
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
