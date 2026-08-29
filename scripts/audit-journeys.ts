/**
 * AUDITORIA DA CENTRAL DE DECISÕES
 * ============================================================================
 *
 * A Central acopla três coisas que evoluem em ritmos diferentes: o registry de
 * ferramentas, o registry de jornadas e as páginas que renderizam os dois.
 * Um acoplamento assim quebra em silêncio — a ferramenta nova entra no
 * catálogo e não aparece em jornada nenhuma, o passo aponta para uma rota
 * renomeada, a página perde o bloco de próximo passo numa refatoração. Nada
 * disso derruba o build.
 *
 * Esta auditoria transforma cada uma dessas falhas silenciosas em erro
 * visível, e cobre também o que não é técnico: a área protegida de anúncio,
 * o tamanho do fluxo de segurança e a ausência de ciclo entre sugestões.
 */
import fs from "node:fs";
import path from "node:path";
import {
  getJourneys,
  getHomeJourneys,
  getJourneyFamilies,
  resolveJourneySteps,
} from "../src/lib/journeys/registry";
import { walkPrimaryPath, toolsWithoutJourney } from "../src/lib/journeys/next-step";
import { computeNextStep } from "../src/lib/journeys/next-step";
import { getTools, getToolRoutes } from "../src/lib/tools/registry";
import {
  buildReport,
  finishAudit,
  writeJsonReport,
  type Finding,
} from "./lib/audit-helpers";

const findings: Finding[] = [];
const journeys = getJourneys();
const tools = getTools();
const HUB = "/decisoes-financeiras/";

/**
 * Ferramentas cuja página NÃO usa `<ToolNextSteps>` porque o componente
 * interativo já traz um bloco de próximo passo contextual ao resultado —
 * melhor que o genérico, já que cita o número que a pessoa acabou de ver.
 * A auditoria aceita as duas formas, mas exige que uma delas exista e que a
 * exceção esteja declarada aqui, e não descoberta por acaso.
 */
const INLINE_NEXT_STEPS: Record<string, string> = {
  "renegociacao-de-dividas": "src/components/calculators/RenegotiationCalculator.tsx",
  "a-vista-ou-parcelado": "src/components/calculators/CashVsInstallmentsCalculator.tsx",
};

/** Máximo de passos numa jornada antes de ela virar um menu. */
const MAX_STEPS = 6;
/** Fluxo de segurança precisa ser curto: quem vai pagar não pode ler um curso. */
const MAX_SAFETY_STEPS = 3;

function readFile(relative: string): string {
  const full = path.join(process.cwd(), relative);
  return fs.existsSync(full) ? fs.readFileSync(full, "utf8") : "";
}

function pageFileForRoute(route: string): string {
  return path.join("src/app", route.replace(/^\/|\/$/g, ""), "page.tsx");
}

/* ========================================================================== *
 * 1. Integridade do registry
 * ========================================================================== */

const familyIds = new Set(getJourneyFamilies().map((f) => f.id));
const routes = new Set(getToolRoutes());

for (const journey of journeys) {
  if (!familyIds.has(journey.family)) {
    findings.push({
      severity: "critical",
      rule: "familia-inexistente",
      pages: [HUB],
      detail: `Jornada "${journey.id}" declara família "${journey.family}", que não existe.`,
    });
  }

  let steps: ReturnType<typeof resolveJourneySteps> = [];
  try {
    steps = resolveJourneySteps(journey);
  } catch (error) {
    findings.push({
      severity: "critical",
      rule: "passo-nao-resolve",
      pages: [HUB],
      detail: `Jornada "${journey.id}": ${(error as Error).message}`,
    });
    continue;
  }

  if (steps.length > MAX_STEPS) {
    findings.push({
      severity: "warning",
      rule: "jornada-longa-demais",
      pages: [HUB],
      detail: `Jornada "${journey.id}" tem ${steps.length} passos (máximo ${MAX_STEPS}). Acima disso ela vira menu, e menu é o que a Central existe para evitar.`,
    });
  }

  if (journey.steps[0]?.optional) {
    findings.push({
      severity: "warning",
      rule: "jornada-abre-com-passo-opcional",
      pages: [HUB],
      detail: `Jornada "${journey.id}" começa com passo opcional — quem escolheu o momento fica sem um primeiro passo claro.`,
    });
  }

  for (const step of steps) {
    if (step.toolId && !routes.has(step.href)) {
      findings.push({
        severity: "critical",
        rule: "passo-com-rota-invalida",
        pages: [HUB],
        detail: `Passo "${step.id}" da jornada "${journey.id}" aponta para ${step.href}, que não é rota de ferramenta.`,
      });
    }
    if (!step.toolId && !step.href.startsWith("/")) {
      findings.push({
        severity: "critical",
        rule: "passo-com-link-externo",
        pages: [HUB],
        detail: `Passo "${step.id}" da jornada "${journey.id}" não aponta para uma página do portal.`,
      });
    }
  }

  const toolIds = journey.steps.map((s) => s.toolId).filter(Boolean);
  if (new Set(toolIds).size !== toolIds.length) {
    findings.push({
      severity: "critical",
      rule: "ferramenta-repetida-na-jornada",
      pages: [HUB],
      detail: `Jornada "${journey.id}" repete a mesma ferramenta em passos diferentes.`,
    });
  }
}

const safety = journeys.find((j) => j.family === "seguranca");
if (safety && safety.steps.length > MAX_SAFETY_STEPS) {
  findings.push({
    severity: "critical",
    rule: "fluxo-de-seguranca-longo",
    pages: [HUB],
    detail: `A jornada de suspeita de golpe tem ${safety.steps.length} passos. Quem está prestes a pagar precisa do alerta em no máximo ${MAX_SAFETY_STEPS}.`,
  });
}

/* ========================================================================== *
 * 2. Cobertura: nenhuma ferramenta fora do mapa
 * ========================================================================== */

const orphans = toolsWithoutJourney();
for (const id of orphans) {
  findings.push({
    severity: "warning",
    rule: "ferramenta-sem-jornada",
    pages: [HUB],
    detail: `Ferramenta "${id}" não aparece em nenhuma jornada — só é encontrável por quem já sabe o nome dela.`,
  });
}

/* ========================================================================== *
 * 3. Próximo passo: existe, e não anda em círculo
 * ========================================================================== */

for (const tool of tools) {
  const inline = INLINE_NEXT_STEPS[tool.id];
  const source = inline ? readFile(inline) : readFile(pageFileForRoute(tool.route));

  if (source.length === 0) {
    findings.push({
      severity: "critical",
      rule: "arquivo-da-ferramenta-nao-encontrado",
      pages: [tool.route],
      detail: `Não foi possível ler o arquivo da ferramenta "${tool.id}".`,
    });
    continue;
  }

  const hasBlock = inline
    ? source.includes("Próximo passo")
    : source.includes("<ToolNextSteps");
  if (!hasBlock) {
    findings.push({
      severity: "critical",
      rule: "ferramenta-sem-proximo-passo",
      pages: [tool.route],
      detail: inline
        ? `"${tool.id}" está declarada com bloco próprio em ${inline}, mas o bloco não foi encontrado lá.`
        : `Página de "${tool.id}" não renderiza <ToolNextSteps>. O leitor termina no resultado e não vê continuidade.`,
    });
  }

  /* A saída para a Central não pode faltar em ferramenta nenhuma: sem ela, a
     pessoa que chegou por busca orgânica nunca descobre que existe caminho. */
  const linksHub = source.includes(HUB) || source.includes("<ToolNextSteps");
  if (!linksHub) {
    findings.push({
      severity: "warning",
      rule: "ferramenta-sem-saida-para-a-central",
      pages: [tool.route],
      detail: `"${tool.id}" não oferece caminho de volta para a Central de Decisões.`,
    });
  }

  try {
    const walked = walkPrimaryPath(tool.id);
    if (new Set(walked).size !== walked.length) {
      findings.push({
        severity: "critical",
        rule: "ciclo-de-proximos-passos",
        pages: [tool.route],
        detail: `Caminho a partir de "${tool.id}" repete ferramenta: ${walked.join(" → ")}.`,
      });
    }
  } catch (error) {
    findings.push({
      severity: "critical",
      rule: "caminho-infinito",
      pages: [tool.route],
      detail: (error as Error).message,
    });
  }

  const result = computeNextStep(tool.id);
  if (result.primary && result.primary.trackingId === tool.id) {
    findings.push({
      severity: "critical",
      rule: "ferramenta-sugere-a-si-mesma",
      pages: [tool.route],
      detail: `"${tool.id}" aparece como próprio próximo passo.`,
    });
  }
}

/* ========================================================================== *
 * 4. Descoberta: a Central precisa ser alcançável
 * ========================================================================== */

/**
 * A porta pode ser um link direto ou um componente da Central montado ali —
 * a home usa o segundo caminho. Checar só a string do caminho acusaria falta
 * de porta numa página que tem sete cards para a Central.
 */
const entryPoints: Array<[string, string]> = [
  ["home", "src/app/page.tsx"],
  ["menu principal", "src/lib/site.ts"],
  ["rodapé", "src/components/layout/SiteFooter.tsx"],
];
for (const [label, file] of entryPoints) {
  const source = readFile(file);
  const hasDoor =
    source.includes(HUB) || source.includes('from "@/components/journeys/');
  if (!hasDoor) {
    findings.push({
      severity: "warning",
      rule: "central-sem-porta-de-entrada",
      pages: [HUB],
      detail: `A Central não é linkada a partir do ${label} (${file}).`,
    });
  }
}

const homeJourneys = getHomeJourneys();
if (homeJourneys.length === 0) {
  findings.push({
    severity: "warning",
    rule: "home-sem-situacoes",
    pages: ["/"],
    detail: "Nenhuma jornada marcada com homeOrder — a home volta a começar por listas.",
  });
} else if (homeJourneys.length >= journeys.length) {
  findings.push({
    severity: "warning",
    rule: "home-com-todas-as-situacoes",
    pages: ["/"],
    detail: `A home mostra ${homeJourneys.length} de ${journeys.length} situações. O bloco da home existe para reduzir a parede de opções, não para reproduzi-la.`,
  });
}

/* ========================================================================== *
 * 5. Área protegida de anúncio
 * ========================================================================== */

const PROTECTED: Array<[string, string]> = [
  ["src/app/decisoes-financeiras/page.tsx", "decision-hub"],
  ["src/components/journeys/HomeDecisionBlock.tsx", "decision-hub"],
  ["src/components/journeys/NextStepPanel.tsx", "next-step"],
  ["src/components/content/JourneyCallout.tsx", "journey-callout"],
];
for (const [file, marker] of PROTECTED) {
  const source = readFile(file);
  if (!source.includes(`data-no-ads="${marker}"`)) {
    findings.push({
      severity: "critical",
      rule: "area-de-decisao-sem-protecao-de-anuncio",
      pages: [HUB],
      detail: `${file} perdeu a marcação data-no-ads="${marker}". Um anúncio nessa área é lido como um dos caminhos sugeridos pelo site.`,
    });
  }
  if (/AdSlot|adsbygoogle/.test(source)) {
    findings.push({
      severity: "critical",
      rule: "anuncio-dentro-do-fluxo-de-decisao",
      pages: [HUB],
      detail: `${file} renderiza anúncio dentro do fluxo de decisão.`,
    });
  }
}

/* ========================================================================== *
 * 6. Privacidade: nada de dado financeiro no roteamento
 * ========================================================================== */

const JOURNEY_SOURCES = [
  "src/lib/journeys/registry.ts",
  "src/lib/journeys/next-step.ts",
  "src/lib/journeys/next-step-core.ts",
  "src/lib/journeys/context.ts",
  "src/lib/journeys/analytics.ts",
  "src/components/journeys/JourneyLink.tsx",
  "src/components/journeys/NextStepPanel.tsx",
];
for (const file of JOURNEY_SOURCES) {
  const source = readFile(file).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  if (/localStorage/.test(source)) {
    findings.push({
      severity: "critical",
      rule: "contexto-em-armazenamento-persistente",
      pages: [HUB],
      detail: `${file} usa localStorage. O contexto de jornada descreve uma situação e vive só na sessão.`,
    });
  }
  if (/user_propert|setUserProperties|user_id/.test(source)) {
    findings.push({
      severity: "critical",
      rule: "perfil-financeiro-no-analytics",
      pages: [HUB],
      detail: `${file} define propriedade de usuário. A situação escolhida é evento, nunca rótulo colado à pessoa.`,
    });
  }
  if (/searchParams|[?&](jornada|journey)=/.test(source)) {
    findings.push({
      severity: "warning",
      rule: "contexto-na-url",
      pages: [HUB],
      detail: `${file} parece transportar o contexto de jornada pela URL, que vaza para referrer, logs e relatórios.`,
    });
  }
}

const report = buildReport("central-de-decisoes", findings);
writeJsonReport("journeys-report.json", report);
finishAudit(report);
