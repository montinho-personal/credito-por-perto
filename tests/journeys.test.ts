import { describe, expect, it } from "vitest";
import {
  getJourneys,
  getHomeJourneys,
  getJourneyFamilies,
  getLocalBridgeJourneys,
  journeyAnchor,
  journeyPath,
  resolveJourneySteps,
  toolsCoveredByJourneys,
} from "../src/lib/journeys/registry";
import {
  buildNextStepSnapshot,
  computeNextStep,
  toolsWithoutJourney,
  walkPrimaryPath,
} from "../src/lib/journeys/next-step";
import { selectNextStep } from "../src/lib/journeys/next-step-core";
import { parseJourneyContext } from "../src/lib/journeys/context";
import { getTools, getToolRoutes } from "../src/lib/tools/registry";

const journeys = getJourneys();
const tools = getTools();

/* ========================================================================== *
 * Integridade do registry
 * ========================================================================== */

describe("registry de jornadas", () => {
  it("tem ids únicos", () => {
    const ids = journeys.map((j) => j.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("declara família existente em toda jornada", () => {
    const families = new Set(getJourneyFamilies().map((f) => f.id));
    for (const journey of journeys) {
      expect(families.has(journey.family)).toBe(true);
    }
  });

  it("resolve todos os passos sem rota escrita à mão", () => {
    const routes = new Set(getToolRoutes());
    for (const journey of journeys) {
      const steps = resolveJourneySteps(journey);
      expect(steps.length).toBeGreaterThan(0);
      for (const step of steps) {
        expect(step.href.startsWith("/")).toBe(true);
        if (step.toolId) expect(routes.has(step.href)).toBe(true);
      }
    }
  });

  it("abre cada jornada com um passo não opcional", () => {
    for (const journey of journeys) {
      expect(journey.steps[0]?.optional).toBe(false);
    }
  });

  it("não repete a mesma ferramenta dentro de uma jornada", () => {
    for (const journey of journeys) {
      const toolIds = journey.steps.map((s) => s.toolId).filter(Boolean);
      expect(new Set(toolIds).size).toBe(toolIds.length);
    }
  });

  it("mantém a promessa de 1 a 3 escolhas até a ferramenta", () => {
    /* Card do momento (1) → botão do passo (2). Nunca mais que isso. */
    for (const journey of journeys) {
      expect(journeyPath(journey.id)).toBe(
        `/decisoes-financeiras/#${journeyAnchor(journey.id)}`,
      );
      expect(journey.steps.length).toBeLessThanOrEqual(6);
    }
  });

  it("destaca na home menos jornadas do que existem", () => {
    const home = getHomeJourneys();
    expect(home.length).toBeGreaterThan(0);
    expect(home.length).toBeLessThan(journeys.length);
    const orders = home.map((j) => j.homeOrder);
    expect(orders).toEqual([...orders].sort((a, b) => (a ?? 0) - (b ?? 0)));
  });

  it("oferece nas páginas locais só o que a página local não resolve", () => {
    const bridge = getLocalBridgeJourneys();
    expect(bridge.length).toBeGreaterThan(0);
    /* Quatro é o teto: o bloco se repete em toda cidade e a política local
       proíbe página que só troca o nome do município. */
    expect(bridge.length).toBeLessThanOrEqual(4);
    /* "Preciso de ajuda na minha cidade" é a página em que a pessoa está. */
    expect(bridge.map((j) => j.id)).not.toContain("ajuda-local");
    expect(bridge.some((j) => j.family === "ajuda")).toBe(false);
    const orders = bridge.map((j) => j.localBridgeOrder);
    expect(orders).toEqual([...orders].sort((a, b) => (a ?? 0) - (b ?? 0)));
  });

  it("cobre todas as ferramentas do portal em alguma jornada", () => {
    expect(toolsWithoutJourney()).toEqual([]);
    expect(toolsCoveredByJourneys().size).toBe(tools.length);
  });
});

/* ========================================================================== *
 * NextStepEngine — invariantes
 * ========================================================================== */

describe("FinancialNextStepEngine", () => {
  it("nunca sugere mais de dois passos", () => {
    for (const tool of tools) {
      const result = computeNextStep(tool.id);
      if (!result.hasNext) continue;
      expect(result.primary).toBeDefined();
      /* secondary é opcional; o que não pode existir é um terceiro. */
      const suggestions = [result.primary, result.secondary].filter(Boolean);
      expect(suggestions.length).toBeLessThanOrEqual(2);
    }
  });

  it("nunca sugere a própria ferramenta", () => {
    for (const tool of tools) {
      const result = computeNextStep(tool.id);
      expect(result.primary?.trackingId).not.toBe(tool.id);
      expect(result.secondary?.trackingId).not.toBe(tool.id);
    }
  });

  it("nunca sugere algo já percorrido", () => {
    for (const tool of tools) {
      const first = computeNextStep(tool.id);
      if (!first.primary) continue;
      const second = computeNextStep(tool.id, {
        completedIds: [first.primary.trackingId],
      });
      expect(second.primary?.trackingId).not.toBe(first.primary.trackingId);
      expect(second.secondary?.trackingId).not.toBe(first.primary.trackingId);
    }
  });

  it("sempre oferece encerrar, inclusive sem próximo passo", () => {
    for (const tool of tools) {
      const result = computeNextStep(tool.id);
      expect(result.completion.href).toBe("/decisoes-financeiras/");
      expect(result.completion.message.length).toBeGreaterThan(20);
    }
  });

  it("termina o caminho principal a partir de qualquer ferramenta (anti-loop)", () => {
    for (const tool of tools) {
      const path = walkPrimaryPath(tool.id);
      expect(new Set(path).size).toBe(path.length);
    }
  });

  it("termina o caminho principal dentro de cada jornada (anti-loop)", () => {
    for (const journey of journeys) {
      for (const step of journey.steps) {
        if (!step.toolId) continue;
        const path = walkPrimaryPath(step.toolId, journey.id);
        expect(new Set(path).size).toBe(path.length);
      }
    }
  });

  it("segue a ordem da jornada quando há contexto", () => {
    const result = computeNextStep("plano-para-sair-das-dividas", {
      journeyId: "varias-dividas",
    });
    expect(result.journeyId).toBe("varias-dividas");
    expect(result.primary?.trackingId).toBe("minha-taxa-esta-cara");
  });

  it("esgota a jornada e devolve encerramento", () => {
    const journey = journeys.find((j) => j.id === "vou-comprar");
    const allIds = journey!.steps.map((s) => s.toolId ?? s.id);
    const result = computeNextStep("a-vista-ou-parcelado", {
      journeyId: "vou-comprar",
      completedIds: allIds,
    });
    expect(result.hasNext).toBe(false);
    expect(result.completion.message).toBe(journey!.completionMessage);
  });

  it("degrada para o caminho sem jornada quando o contexto é inválido", () => {
    const semContexto = computeNextStep("conversor-de-taxas");
    const contextoLixo = computeNextStep("conversor-de-taxas", {
      journeyId: "jornada-que-nao-existe",
    });
    expect(contextoLixo.primary?.trackingId).toBe(semContexto.primary?.trackingId);
  });

  it("assume a jornada quando a ferramenta só pertence a uma", () => {
    const snapshot = buildNextStepSnapshot("a-vista-ou-parcelado");
    expect(snapshot.impliedJourneyId).toBe("vou-comprar");
  });

  it("não assume jornada quando a ferramenta pertence a várias", () => {
    const snapshot = buildNextStepSnapshot("parcela-no-orcamento");
    expect(Object.keys(snapshot.journeys).length).toBeGreaterThan(1);
    expect(snapshot.impliedJourneyId).toBeUndefined();
  });

  it("dá o mesmo resultado no servidor e no cliente", () => {
    /* O núcleo é a mesma função dos dois lados: o retrato serializado tem de
       bastar. Se este teste quebrar, é porque alguma regra migrou para o lado
       que lê os registries e o navegador passou a ver outra sugestão. */
    for (const tool of tools) {
      const snapshot = buildNextStepSnapshot(tool.id);
      const viaSnapshot = selectNextStep(JSON.parse(JSON.stringify(snapshot)), {});
      expect(viaSnapshot).toEqual(computeNextStep(tool.id));
    }
  });
});

/* ========================================================================== *
 * Roteamento — os casos de uso escritos como o leitor os diria
 * ========================================================================== */

describe("roteamento por situação", () => {
  function firstToolOf(journeyId: string): string | undefined {
    const journey = journeys.find((j) => j.id === journeyId);
    return journey?.steps[0]?.toolId;
  }

  const CASES: Array<[string, string, string]> = [
    ["Tenho três dívidas e não sei qual pagar primeiro", "varias-dividas", "plano-para-sair-das-dividas"],
    ["Recebi uma proposta de empréstimo", "recebi-proposta", "consultar-instituicao"],
    ["Tenho R$ 5 mil e quero quitar o financiamento", "quero-quitar", "quitacao-antecipada"],
    ["Tenho acordo à vista de 4 mil ou 24x de 220", "recebi-acordo", "renegociacao-de-dividas"],
    ["Celular custa 4 mil no Pix ou 12x de 380", "vou-comprar", "a-vista-ou-parcelado"],
    ["Quero saber quanto estão os juros do consignado", "entender-juros", "radar-de-taxas"],
    ["Não sei quanto de parcela posso assumir", "quero-credito", "parcela-no-orcamento"],
  ];

  for (const [situacao, journeyId, expectedTool] of CASES) {
    it(`"${situacao}" chega em ${expectedTool}`, () => {
      expect(firstToolOf(journeyId)).toBe(expectedTool);
    });
  }

  it("pediram Pix antes de liberar: vai direto ao detector, sem passar pelo orçamento", () => {
    const journey = journeys.find((j) => j.id === "suspeita-de-golpe")!;
    expect(journey.steps[0]?.toolId).toBe("sinais-de-golpe");
    expect(journey.steps[1]?.toolId).toBe("consultar-instituicao");
    const toolIds = journey.steps.map((s) => s.toolId);
    expect(toolIds).not.toContain("parcela-no-orcamento");
    /* Fluxo de segurança é curto por decisão: quem está prestes a pagar não
       deve atravessar uma sequência de análises antes do alerta. */
    expect(journey.steps.length).toBeLessThanOrEqual(3);
  });

  it("quero saber se uma financeira existe: a consulta ao BC é passo de duas jornadas", () => {
    const withBc = journeys.filter((j) =>
      j.steps.some((s) => s.toolId === "consultar-instituicao"),
    );
    expect(withBc.map((j) => j.id)).toContain("suspeita-de-golpe");
    expect(withBc.map((j) => j.id)).toContain("recebi-proposta");
  });
});

/* ========================================================================== *
 * Privacidade — o que o contexto pode carregar
 * ========================================================================== */

describe("contexto de jornada", () => {
  it("aceita apenas ids", () => {
    const parsed = parseJourneyContext(
      JSON.stringify({ journeyId: "varias-dividas", completedIds: ["plano-para-sair-das-dividas"] }),
    );
    expect(parsed).toEqual({
      journeyId: "varias-dividas",
      completedIds: ["plano-para-sair-das-dividas"],
    });
  });

  it("descarta conteúdo malformado, antigo ou adulterado", () => {
    expect(parseJourneyContext(null)).toBeNull();
    expect(parseJourneyContext("não é json")).toBeNull();
    expect(parseJourneyContext("[]")).toBeNull();
    expect(parseJourneyContext(JSON.stringify({ completedIds: ["x"] }))).toBeNull();
  });

  it("filtra valores não textuais que tenham sido injetados na lista", () => {
    const parsed = parseJourneyContext(
      JSON.stringify({ journeyId: "quero-quitar", completedIds: ["ok", 4200, { renda: 3000 }] }),
    );
    expect(parsed?.completedIds).toEqual(["ok"]);
  });

  it("nenhum campo do retrato serializado carrega valor financeiro", () => {
    /* O retrato viaja para o navegador junto com o HTML. Ele é o mesmo para
       todo mundo — se um dia passar a depender do que a pessoa digitou, este
       teste deixa de fazer sentido e o modelo precisa ser revisto. */
    for (const tool of tools) {
      const json = JSON.stringify(buildNextStepSnapshot(tool.id));
      expect(json).not.toMatch(/"(renda|salario|saldo|valor|taxa|parcela)"\s*:/i);
    }
  });
});
