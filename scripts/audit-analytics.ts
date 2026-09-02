/**
 * AUDITORIA DO RASTREAMENTO
 * ============================================================================
 *
 * Medição é a única parte do sistema que falha em silêncio.
 *
 * Um botão quebrado alguém reclama no mesmo dia. Um botão que parou de ser
 * medido não reclama nunca: o relatório continua abrindo, os números
 * continuam saindo, e só meses depois — quando alguém pergunta "por que a
 * conversão do guia local caiu?" — se descobre que não caiu, parou de ser
 * contada. E o dado daquele período não volta.
 *
 * Este script existe para que esse silêncio não seja possível. Ele lê o
 * código-fonte e confere oito coisas:
 *
 *   1. todo evento disparado está declarado em `event-registry.ts`;
 *   2. todo evento declarado é disparado por alguém;
 *   3. `gtag` não é chamado fora de `src/lib/analytics/`;
 *   4. nenhum nome de evento é montado com template — nome montado é nome que
 *      não aparece em busca e que ninguém consegue auditar;
 *   5. nenhum parâmetro carrega chave proibida (renda, valor, CPF, taxa…);
 *   6. todo parâmetro enviado está declarado para aquele evento — a regra que
 *      pegou dez divergências na primeira versão deste dicionário;
 *   7. os landmarks obrigatórios têm `data-track-area`;
 *   8. toda área declarada no JSX é conhecida pelo modelo de clique — área
 *      escrita com erro de digitação viraria `area=nao_declarada` no
 *      relatório, silenciosamente.
 */
import fs from "node:fs";
import path from "node:path";
import {
  buildReport,
  finishAudit,
  writeJsonReport,
  type Finding,
} from "./lib/audit-helpers";
import { EVENT_REGISTRY } from "../src/lib/analytics/event-registry";
import { isForbiddenParamKey } from "../src/lib/analytics/redact";

const findings: Finding[] = [];
const SRC = path.join(process.cwd(), "src");
const ANALYTICS_LIB = path.join("src", "lib", "analytics");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

const files = walk(SRC).map((f) => ({
  rel: path.relative(process.cwd(), f).split(path.sep).join("/"),
  body: fs.readFileSync(f, "utf8"),
}));

/* ------------------------------------------------------------------ */
/* 1 e 2 — eventos disparados × eventos declarados                     */
/* ------------------------------------------------------------------ */

const fired = new Map<string, string[]>();

for (const { rel, body } of files) {
  if (rel.startsWith(ANALYTICS_LIB)) continue;
  for (const match of body.matchAll(/\btrack\(\s*"([a-z0-9_]+)"/g)) {
    const name = match[1]!;
    fired.set(name, [...(fired.get(name) ?? []), rel]);
  }
}

/**
 * Eventos emitidos pelo ouvinte delegado. Eles nascem em `ClickTracking.tsx`
 * a partir de `buildClickEvent`, cujo nome vem de `eventNameFor` — não há
 * literal `track("nav_click")` em lugar nenhum, e não deveria haver.
 */
const DELEGATED = new Set([
  "nav_click",
  "cta_click",
  "content_link_click",
  "anchor_click",
  "outbound_click",
  "contact_click",
]);

const declared = new Set(EVENT_REGISTRY.map((e) => e.name));

for (const [name, where] of fired) {
  if (!declared.has(name)) {
    findings.push({
      severity: "critical",
      rule: "evento-nao-declarado",
      pages: where,
      detail: `O evento "${name}" é disparado mas não existe em src/lib/analytics/event-registry.ts. Sem declaração ele chega ao GA4 sem documentação, sem parâmetros previstos e sem quem responda pelo que ele significa.`,
    });
  }
}

for (const spec of EVENT_REGISTRY) {
  if (fired.has(spec.name) || DELEGATED.has(spec.name)) continue;
  findings.push({
    severity: "warning",
    rule: "evento-declarado-sem-disparo",
    pages: ["src/lib/analytics/event-registry.ts"],
    detail: `O evento "${spec.name}" está declarado e ninguém o dispara. Ou a instrumentação foi removida numa refatoração — e o relatório vai continuar mostrando zero como se fosse comportamento —, ou a declaração é resíduo e deve sair.`,
  });
}

/* ------------------------------------------------------------------ */
/* 3 — gtag fora da biblioteca                                         */
/* ------------------------------------------------------------------ */

for (const { rel, body } of files) {
  if (rel.startsWith(ANALYTICS_LIB)) continue;
  /* GoogleAnalytics.tsx define o gtag global dentro do script do GA4 — é a
     origem da função, não um atalho para ela. */
  if (rel.endsWith("components/analytics/GoogleAnalytics.tsx")) continue;
  if (/\bgtag\s*\(/.test(body)) {
    findings.push({
      severity: "critical",
      rule: "gtag-fora-da-biblioteca",
      pages: [rel],
      detail:
        "Chamada direta a gtag(). Todo evento passa por track() — é lá que mora a redação de valores, a validação contra o dicionário e o modo de conferência. Um atalho aqui reabre o problema das 14 cópias.",
    });
  }
}

/* ------------------------------------------------------------------ */
/* 4 — nome de evento montado em tempo de execução                     */
/* ------------------------------------------------------------------ */

for (const { rel, body } of files) {
  if (rel.startsWith(ANALYTICS_LIB)) continue;
  if (/\btrack\(\s*`/.test(body) || /\btrack\(\s*[A-Za-z_$][\w$]*\s*[,)]/.test(body)) {
    findings.push({
      severity: "critical",
      rule: "nome-de-evento-montado",
      pages: [rel],
      detail:
        "Nome de evento montado por template ou variável. O nome deixa de aparecer em qualquer busca no código, a auditoria não consegue conferi-lo e cada variação gasta uma das 500 vagas de nome do GA4. Use um nome fixo e mande a variação como parâmetro.",
    });
  }
}

/* ------------------------------------------------------------------ */
/* 5 — chave de parâmetro proibida                                     */
/* ------------------------------------------------------------------ */

for (const { rel, body } of files) {
  if (rel.startsWith(ANALYTICS_LIB)) continue;
  for (const call of body.matchAll(/\btrack\(\s*"([a-z0-9_]+)"\s*,\s*\{([^}]*)\}/g)) {
    const [, name, argsBlock] = call;
    /* Duas formas de escrever a mesma chave — `{ renda: x }` e o atalho
       `{ renda }`. A primeira versão desta auditoria só via a de dois pontos,
       e o atalho, que é a forma mais curta e por isso a mais provável, passava
       inteiro. Um teste negativo mostrou o buraco antes que ele importasse. */
    for (const key of argsBlock!.matchAll(
      /(?:^|[,{]|\s)\s*([A-Za-z_$][\w$]*)\s*(?::|,|\}|$)/g,
    )) {
      const param = key[1]!;
      if (isForbiddenParamKey(param)) {
        findings.push({
          severity: "critical",
          rule: "parametro-proibido",
          pages: [rel],
          detail: `O evento "${name}" tenta enviar o parâmetro "${param}". Valor digitado pela pessoa — renda, saldo, taxa, parcela, documento, instituição — não sai do navegador. O redator recusaria em tempo de execução; a auditoria recusa antes.`,
        });
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* 5b — parâmetro enviado × parâmetro declarado                        */
/* ------------------------------------------------------------------ */

/**
 * A checagem que salvou a primeira versão desta camada.
 *
 * O dicionário foi escrito olhando o código, e ainda assim errou dez eventos:
 * declarava `results` onde a busca manda `results_count`, `position` onde ela
 * manda `result_position`. `track()` faz o certo — descarta o que não está na
 * especificação —, então o efeito teria sido silencioso e perverso: os
 * eventos continuariam chegando ao GA4, agora SEM os parâmetros que tinham
 * antes. Uma regressão que só apareceria semanas depois, num relatório vazio
 * que ninguém saberia explicar.
 *
 * O QA no navegador pegou. Esta regra é para não depender de QA na próxima.
 */
function keysOfObjectLiteral(block: string): string[] {
  const keys: string[] = [];
  let depth = 0;
  let buffer = "";
  const parts: string[] = [];
  for (const ch of block) {
    if ("([{".includes(ch)) depth++;
    if (")]}".includes(ch)) depth--;
    if (ch === "," && depth === 0) {
      parts.push(buffer);
      buffer = "";
    } else buffer += ch;
  }
  parts.push(buffer);
  for (const part of parts) {
    const m = /^\s*([A-Za-z_$][\w$]*)\s*(:|$)/.exec(part.trim());
    if (m) keys.push(m[1]!);
  }
  return keys;
}

for (const { rel, body } of files) {
  if (rel.startsWith(ANALYTICS_LIB)) continue;
  for (const call of body.matchAll(
    /\btrack\(\s*"([a-z0-9_]+)"\s*(?:,\s*\{([\s\S]*?)\}\s*)?\)/g,
  )) {
    const name = call[1]!;
    const spec = EVENT_REGISTRY.find((e) => e.name === name);
    if (!spec) continue;
    for (const key of keysOfObjectLiteral(call[2] ?? "")) {
      if (!spec.params.includes(key)) {
        findings.push({
          severity: "critical",
          rule: "parametro-fora-da-especificacao",
          pages: [rel],
          detail: `O evento "${name}" envia o parâmetro "${key}", que não está declarado em event-registry.ts. track() vai descartá-lo em silêncio: o evento continua chegando ao GA4, sem o dado. Declare o parâmetro ou pare de enviá-lo.`,
        });
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* 6 e 7 — áreas declaradas no JSX                                     */
/* ------------------------------------------------------------------ */

/** Áreas que o modelo de clique conhece. Espelha click-model.ts. */
const KNOWN_AREAS = new Set([
  "cards-ferramentas",
  "chamada-ferramenta",
  "chamada-jornada",
  "central-decisoes",
  "proximos-passos",
  "ponte-local",
  "relacionados",
  "home-blocos",
  "hub-categoria",
  "mapa-cidade",
  "ferramenta",
  "busca",
  "cabecalho",
  "rodape",
  "menu-celular",
  "migalhas",
  "mapa-do-site",
  "paginacao",
  "conteudo",
]);

/** Sem estes, regiões inteiras do site cairiam em `area=nao_declarada`. */
const REQUIRED_AREAS = [
  "cabecalho",
  "rodape",
  "migalhas",
  "conteudo",
  "menu-celular",
  "ferramenta",
  "cards-ferramentas",
  "central-decisoes",
  "proximos-passos",
  "relacionados",
];

const seenAreas = new Map<string, string[]>();
for (const { rel, body } of files) {
  for (const m of body.matchAll(/data-track-area="([^"]+)"/g)) {
    const area = m[1]!;
    seenAreas.set(area, [...(seenAreas.get(area) ?? []), rel]);
  }
}

for (const [area, where] of seenAreas) {
  if (!KNOWN_AREAS.has(area)) {
    findings.push({
      severity: "critical",
      rule: "area-desconhecida",
      pages: where,
      detail: `A área "${area}" não existe em click-model.ts. Ela não seria classificada como navegação nem como oferta, e os cliques da região apareceriam no relatório sem o eixo que os torna comparáveis.`,
    });
  }
}

for (const area of REQUIRED_AREAS) {
  if (!seenAreas.has(area)) {
    findings.push({
      severity: "critical",
      rule: "landmark-sem-area",
      pages: ["src/components"],
      detail: `Nenhum elemento declara data-track-area="${area}". A região perde atribuição e os cliques dela viram "nao_declarada" — presentes no total, inúteis na análise.`,
    });
  }
}

/* ------------------------------------------------------------------ */
/* Panorama                                                            */
/* ------------------------------------------------------------------ */

const porGrupo = new Map<string, number>();
for (const spec of EVENT_REGISTRY) {
  porGrupo.set(spec.group, (porGrupo.get(spec.group) ?? 0) + 1);
}
findings.push({
  severity: "info",
  rule: "panorama",
  pages: ["/"],
  detail: `${EVENT_REGISTRY.length} eventos declarados (${[...porGrupo]
    .map(([g, n]) => `${g}: ${n}`)
    .join(", ")}); ${
    EVENT_REGISTRY.filter((e) => e.keyEvent).length
  } marcados como evento principal; ${seenAreas.size} áreas instrumentadas.`,
});

const report = buildReport("rastreamento", findings);
writeJsonReport("analytics-report.json", report);
finishAudit(report);
