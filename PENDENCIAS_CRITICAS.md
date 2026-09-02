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

## Link externo pendente — artigo de comprometimento de renda

- [x] **RESOLVIDO em 28/08/2026.** URL confirmada pelo proprietário e link
      inserido: https://www.alphadl.com.br/quanto-custa-comprar-uma-casa-de-3-milhoes-em-alphaville
      (artigo sobre custos de compra na região, encaixe melhor na seção do que o
      guia de financiamento originalmente previsto). Histórico: o artigo
      `/organizacao-financeira/quanto-da-renda-comprometer-financiamento-imovel/`
      (publicado em 28/08/2026) foi ao ar **sem** o link externo previsto para o
      artigo "Financiamento de imóvel em Alphaville: SFH, SFI, FGTS e custos".
      Motivo: não foi possível confirmar a URL canônica — o domínio
      `www.alphadl.com.br` está bloqueado pelo proxy de egress do ambiente de
      desenvolvimento e o artigo não aparece indexado nas buscas. Não se inventa
      URL.
- **Onde entra:** seção `## E se o imóvel estiver numa região de alto custo?`,
  último parágrafo, que hoje termina em "Vale procurar material especializado na
  região específica antes de fechar os números."
- **Como inserir:** uma única ocorrência, âncora natural do tipo "financiamento
  imobiliário em Alphaville" ou "custos do financiamento de imóvel em
  Alphaville". Proibido: "parceiro", "recomendamos", banner, logo, CTA
  comercial, link no rodapé, múltiplos links ou menção a estratégia de links.
  O link se justifica só por aprofundar custos regionais fora do escopo
  nacional do guia.
- **Depois de inserir:** bumpar `updatedAt`, rodar `pnpm audit:all`, `pnpm build`
  e publicar.

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
- [ ] **Dimensões personalizadas no GA4** (Administrador → Definições
      personalizadas → Criar, escopo de *evento*): `area`, `component`,
      `label`, `to_path`, `page_type`, `destination`, `domain`, `channel`,
      `position`, `journey`, `target`, `question`, `source`. Os parâmetros já
      chegam — **sem esse passo eles não aparecem em relatório nenhum**, que
      é a pegadinha clássica do GA4. Lista completa e passo a passo em
      `docs/analytics-eventos.md`
- [ ] **Eventos principais** (Administrador → Eventos → marcar): 
      `outbound_click`, `cta_click`, `contact_click`, `decision_tool_open`,
      `decision_next_step_click`, `search_result_click` e os `*_complete` das
      ferramentas
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

- [x] Barueri e região de Alphaville: verificados em fontes oficiais
      (16/08/2026) e publicados
- [ ] Campinas: guia segue `draft` + `noindex` até verificação (âncora do
      lote L3); pendências no dossiê (`pendingVerification`)
- [ ] Itens residuais dos dossiês publicados (horários/telefones, programas
      municipais, lista de agências via dados abertos do BC)

## 6. Ativos e licenças

- [x] Origem de todo ativo publicado declarada em `data/asset-origins.json` e
      verificada por `pnpm audit:ativos` — 90 arquivos: 7 SVG de identidade em
      vetor e 83 imagens geradas por IA sob direção do proprietário (02/09/2026)
- [ ] Se forem usadas fotos ou ilustrações de terceiros no futuro, abrir lote
      próprio com licença verificada, conforme `docs/image-licensing-policy.md`
