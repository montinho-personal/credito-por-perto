# Publicação no Vercel

## Pré-requisitos

- Conta no Vercel com acesso ao repositório GitHub `montinho-personal/credito-por-perto`;
- Domínio `creditoporperto.com.br` sob controle do proprietário.

## Passo a passo

1. **Importar o projeto**: no Vercel, "Add New → Project" → selecionar o
   repositório. Framework: Next.js (autodetectado). Package manager: pnpm
   (autodetectado pelo lockfile). Build command padrão (`next build`);
2. **Variáveis de ambiente**: copiar as chaves de `.env.example` e preencher
   somente as reais (Production). Deixar `NEXT_PUBLIC_ADSENSE_ENABLED=false`
   até a conta AdSense existir. Preview não precisa de nenhuma;
3. **Gerar índice de busca no build**: em "Build Command", usar
   `pnpm search:index && next build` (ou adicionar o script ao `build` do
   package.json — decisão do mantenedor; o arquivo também pode ser comitado);
4. **Domínios**: adicionar `www.creditoporperto.com.br` como domínio principal
   e `creditoporperto.com.br` com redirect para o `www` (o next.config também
   força esse redirect). Configurar DNS conforme instruções do Vercel
   (CNAME para `www`, A/ALIAS para o apex);
5. **Deploy de preview**: qualquer push em branch abre preview — já protegido
   por `X-Robots-Tag: noindex` e robots bloqueado (`VERCEL_ENV !== production`).
   Ativar "Deployment Protection" (senha/login) se desejar reforço;
6. **Deploy de produção**: merge/push na branch de produção configurada.
   Conferir: `https://www.creditoporperto.com.br/robots.txt`, `/sitemap.xml`,
   canonical na home e em um artigo, e a ausência de `X-Robots-Tag` noindex;
7. **Search Console**: adicionar a propriedade do domínio, verificar (meta tag
   via `NEXT_PUBLIC_GSC_VERIFICATION` ou DNS) e enviar `sitemap.xml`.
   **Nunca** enviar URLs de preview.

## Checklist pós-deploy

- [ ] `curl -I https://creditoporperto.com.br/` → 308 para `https://www.…`
- [ ] `curl -I https://www.creditoporperto.com.br/` → 200, sem X-Robots-Tag
- [ ] `curl -I <url-de-preview>` → contém `X-Robots-Tag: noindex, nofollow, noarchive`
- [ ] `/sitemap.xml` lista apenas URLs `https://www.…` com trailing slash
- [ ] `/ads.txt` → 404 (até haver Publisher ID)
- [ ] Lighthouse nas páginas principais (metas: Perf > 90, A11y > 95, BP > 95, SEO > 95)

## Comandos locais equivalentes

```bash
pnpm install
pnpm lint && pnpm typecheck && pnpm test && pnpm audit:all
pnpm search:index && pnpm build
pnpm start   # smoke test local de produção
```
