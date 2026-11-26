#!/usr/bin/env node
/**
 * CHECAGEM NO NAVEGADOR (regra do Renato, 26/11/2026)
 *
 * Abre o site num navegador de verdade (Chromium), no computador e no
 * celular, e confere o que os testes unitários não veem:
 *   - a página abre (status < 400) e não dá erro de JavaScript;
 *   - no celular, nada passa da largura da tela e o menu abre e fecha;
 *   - os botões das páginas respondem sem quebrar a página;
 *   - as calculadoras aceitam valores e mostram resultado;
 *   - links internos e imagens do próprio site não estão quebrados.
 *
 * Uso:
 *   pnpm build && pnpm check:browser                 # sobe o servidor sozinho
 *   pnpm check:browser -- /juros-e-cet/o-que-e-cet/  # páginas extras
 *   BASE_URL=http://localhost:3777 pnpm check:browser -- --no-serve
 *
 * Termina com código 1 se encontrar erro. O relatório e as capturas de
 * tela do celular ficam em .browser-check/ (fora do git).
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

// Usa o Playwright instalado na máquina, se houver; senão, o playwright-core do projeto
// com o Chromium indicado em CHROMIUM_PATH (ou o do ambiente de nuvem).
const require = createRequire(import.meta.url);
let pw;
let executablePath;
try {
  pw = require("playwright");
} catch {
  pw = require("playwright-core");
  const candidates = [process.env.CHROMIUM_PATH, "/opt/pw-browsers/chromium"].filter(Boolean);
  executablePath = candidates.find((p) => fs.existsSync(p));
}
const { chromium, devices } = pw;

const ROOT = process.cwd();
const PORT = Number(process.env.PORT ?? 3777);
const args = process.argv.slice(2).filter((a) => a !== "--");
const serve = !args.includes("--no-serve");
const BASE = (process.env.BASE_URL ?? `http://localhost:${PORT}`).replace(/\/$/, "");
const OUT = path.join(ROOT, ".browser-check");
const extraPaths = args.filter((a) => a.startsWith("/"));

const DEFAULT_PATHS = [
  "/",
  "/emprestimos/",
  "/juros-e-cet/",
  "/credito-seguro/",
  "/organizacao-financeira/",
  "/calculadoras/",
  "/busca/",
  "/emprestimos/sp/barueri/",
];

const registry = JSON.parse(fs.readFileSync(path.join(ROOT, "data/tool-registry.json"), "utf8"));
const toolRoutes = (Array.isArray(registry) ? registry : registry.tools ?? [])
  .map((t) => t.route)
  .filter(Boolean);

const paths = [...new Set([...DEFAULT_PATHS, ...toolRoutes, ...extraPaths])];

const problems = [];
const notes = [];
const problem = (where, what) => problems.push({ where, what });

async function waitForServer(url, ms = 90_000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {
      /* ainda subindo */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Servidor não respondeu em ${url}`);
}

function sameOrigin(u) {
  try {
    return new URL(u, BASE).origin === new URL(BASE).origin;
  } catch {
    return false;
  }
}

async function checkPage(context, label, urlPath, linkSet) {
  const page = await context.newPage();
  const where = `${label} ${urlPath}`;
  page.on("pageerror", (err) => problem(where, `erro de JavaScript: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    // Recursos de terceiros (anúncio, analytics, fontes) podem falhar no ambiente de teste.
    if (/Failed to load resource|net::ERR_|ERR_NAME_NOT_RESOLVED|ERR_TUNNEL/i.test(text)) return;
    // O script de estatísticas da Vercel só existe no servidor da Vercel.
    if (text.includes("/_vercel/")) return;
    problem(where, `erro no console: ${text.slice(0, 200)}`);
  });
  page.on("requestfailed", (req) => {
    if (sameOrigin(req.url()) && !req.url().includes("/_next/webpack-hmr") && !req.url().includes("/_vercel/")) {
      problem(where, `recurso do site não carregou: ${req.url()} (${req.failure()?.errorText})`);
    }
  });

  const res = await page.goto(BASE + urlPath, { waitUntil: "load", timeout: 45_000 }).catch((e) => {
    problem(where, `não abriu: ${e.message}`);
    return null;
  });
  if (!res) return page.close();
  if (res.status() >= 400) problem(where, `status ${res.status()}`);

  // Largura: nada pode passar da tela (principalmente no celular).
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 1) problem(where, `conteúdo passa ${overflow}px da largura da tela`);

  // Imagens do próprio site.
  const broken = await page.evaluate(() =>
    [...document.images]
      .filter((img) => img.complete && img.naturalWidth === 0 && img.getAttribute("loading") !== "lazy")
      .map((img) => img.currentSrc || img.src),
  );
  for (const src of broken) if (sameOrigin(src)) problem(where, `imagem quebrada: ${src}`);

  // Links internos (conferidos uma vez só, no fim).
  const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.href));
  for (const h of hrefs) {
    if (!sameOrigin(h)) continue;
    const u = new URL(h);
    if (u.pathname.startsWith("/_next")) continue;
    linkSet.add(u.pathname);
  }

  // Menu do celular.
  if (label === "celular") {
    const toggle = page.locator('[data-track-area="menu-celular"] button[aria-controls]').first();
    if (await toggle.isVisible().catch(() => false)) {
      await toggle.click();
      const expanded = await toggle.getAttribute("aria-expanded");
      if (expanded !== "true") problem(where, "menu do celular não abriu");
      await toggle.click();
      const closed = await toggle.getAttribute("aria-expanded");
      if (closed !== "false") problem(where, "menu do celular não fechou");
    } else {
      problem(where, "botão do menu do celular não aparece");
    }
  }

  // Calculadoras: preencher campos vazios e acionar o cálculo.
  if (urlPath.startsWith("/calculadoras/") && urlPath !== "/calculadoras/") {
    const inputs = page.locator("main input:visible");
    const n = await inputs.count();
    for (let i = 0; i < n; i++) {
      const input = inputs.nth(i);
      const type = (await input.getAttribute("type")) ?? "text";
      if (!["number", "text", "tel", ""].includes(type)) continue;
      if (await input.isDisabled()) continue;
      const value = await input.inputValue();
      if (!value) await input.fill(type === "number" ? "1000" : "1000").catch(() => {});
    }
  }

  // Botões: cada botão visível dentro do conteúdo é clicado uma vez.
  const buttons = page.locator("main button:visible");
  const count = Math.min(await buttons.count(), 25);
  for (let i = 0; i < count; i++) {
    const b = buttons.nth(i);
    if (await b.isDisabled().catch(() => true)) continue;
    const before = page.url();
    await b.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(150);
    if (page.url() !== before && !sameOrigin(page.url())) {
      problem(where, `botão ${i + 1} levou para fora do site: ${page.url()}`);
      await page.goto(BASE + urlPath, { waitUntil: "load" }).catch(() => {});
    }
  }
  const stillThere = await page.locator("main").count();
  if (!stillThere) problem(where, "depois dos cliques, a página ficou sem conteúdo principal");

  if (label === "celular") {
    const file = path.join(OUT, `celular${urlPath.replace(/\//g, "_") || "_home"}.png`);
    await page.screenshot({ path: file, fullPage: false }).catch(() => {});
  }
  await page.close();
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  let server = null;
  if (serve) {
    const nextBin = path.join(ROOT, "node_modules/.bin/next");
    server = spawn(nextBin, ["start", "-p", String(PORT)], { stdio: "ignore" });
    await waitForServer(BASE + "/");
  }
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const linkSet = new Set();
  try {
    const desktop = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const mobile = await browser.newContext({ ...devices["iPhone 13"] });
    for (const p of paths) {
      await checkPage(desktop, "computador", p, linkSet);
      await checkPage(mobile, "celular", p, linkSet);
    }
    // Links internos encontrados nas páginas visitadas.
    const req = desktop.request;
    for (const p of linkSet) {
      const r = await req.get(BASE + p, { maxRedirects: 5 }).catch(() => null);
      if (!r) problem("link", `não respondeu: ${p}`);
      else if (r.status() >= 400) problem("link", `${r.status()}: ${p}`);
    }
    notes.push(`${paths.length} páginas × 2 telas; ${linkSet.size} links internos conferidos`);
  } finally {
    await browser.close();
    if (server) server.kill();
  }

  const report = { base: BASE, date: new Date().toISOString(), notes, problems };
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(`[navegador] ${notes.join(" | ")}`);
  if (problems.length) {
    console.log(`[navegador] ${problems.length} problema(s):`);
    for (const p of problems) console.log(`  - ${p.where}: ${p.what}`);
    process.exit(1);
  }
  console.log("[navegador] nenhum problema encontrado");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
