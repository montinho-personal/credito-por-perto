# Pendências críticas — decisões que dependem do proprietário

Este arquivo lista **somente** o que não pode ser resolvido pela equipe
técnica/editorial sem informação ou autorização do responsável pelo portal.
Tudo o mais já está implementado ou automatizado.

## 1. Identidade legal (bloqueia lançamento público dos documentos legais)

- [x] Nome do responsável pelo portal: Renato de Camargo Nascimento
- [x] CPF: exibido publicamente mascarado (397.***.***-97), por decisão do
      responsável; o número completo fica com o proprietário, fora do repositório
- [x] E-mail oficial de contato: blink.renato@gmail.com
- [x] Endereço comercial: Avenida Cauaxi, 258 — Alphaville, Barueri/SP, CEP 06454-020
- [x] Controlador de dados: o próprio responsável (sem encarregado/DPO por ora)
- [ ] **Revisão jurídica** dos templates: política de privacidade, cookies,
      termos de uso e aviso legal (todos exibem aviso público de "documento em
      elaboração" até isso acontecer — remover o `LegalTemplateNotice` após a revisão)

## 2. Autoria e revisão editorial

- [ ] Decidir se haverá autores/revisores identificados por nome real
      (hoje a autoria é honesta e coletiva: "Equipe Editorial do Crédito por Perto")
- [ ] Se houver revisor financeiro certificado, cadastrar com credencial real
      em `content/authors/` — **nunca** inventar especialista
- [ ] Aprovação editorial final do proprietário sobre os 15 artigos publicados
      (estão marcados `published` para o site funcionar; a decisão final de
      lançamento em produção é do proprietário)

## 3. Integrações Google (bloqueiam ativação, não o desenvolvimento)

- [ ] ID do Google AdSense (`NEXT_PUBLIC_ADSENSE_CLIENT`) + IDs de slots — só
      após conta aprovada; enquanto isso `NEXT_PUBLIC_ADSENSE_ENABLED=false`
- [x] ID do Google Analytics 4 — propriedade criada pelo proprietário
      (16/08/2026), ID configurado no código com banner de consentimento;
      ver `docs/analytics.md`
- [ ] Ativar Vercel Web Analytics no painel (projeto → Analytics → Enable)
- [ ] ID do Google Tag Manager (`NEXT_PUBLIC_GTM_ID`) — opcional
- [ ] Código de verificação do Search Console (`NEXT_PUBLIC_GSC_VERIFICATION`)
- [x] Decisão sobre uso do Vercel Analytics — adotado (sem cookies), código
      no layout; falta só o Enable no painel

## 4. Infraestrutura

- [x] Conta/projeto no Vercel e autorização para deploy de produção
- [x] Domínio `creditoporperto.com` comprado via Vercel (15/08/2026) — DNS
      gerenciado pelo próprio Vercel
- [ ] Conectar `www.creditoporperto.com` (principal) e `creditoporperto.com`
      (redirect) ao projeto em Settings → Domains, conforme
      `docs/publicacao-vercel.md`

## 5. Guias locais (bloqueiam publicação dos guias, não do site)

- [ ] Verificação de campo das informações locais de Campinas, Barueri e
      região de Alphaville (listas de pendência em `content/local-dossiers/*.json`,
      campo `pendingVerification`). Os três guias permanecem `draft` + `noindex`
      até a checagem — o pipeline bloqueia a publicação sem dossiê completo.

## 6. Ativos e licenças

- [ ] Se forem usadas fotos/ilustrações de terceiros no futuro, registrar
      licenças conforme `docs/image-licensing-policy.md` (hoje só há SVGs próprios)
