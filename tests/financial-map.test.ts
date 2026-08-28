import { readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { describe, expect, it } from "vitest";
import {
  evaluateCityIndexability,
  findDoorwayCollisions,
  groupByCategory,
  isRenderable,
  localSignature,
  resolveCityResources,
  scopeCoversCity,
  STALE_VERIFICATION_DAYS,
  type CityKey,
  type CoverageType,
  type FinancialResource,
  type RegistryResource,
} from "@/lib/local/financial-map";
import {
  applyCheckResult,
  CONFIRMATIONS_TO_REMOVE,
  stalenessNotice,
} from "@/lib/local/resource-health";
import {
  buildCityFinancialMap,
  getResourceRegistry,
  localResourcesFromDossier,
  sourceFingerprint,
} from "@/lib/local/city-map";
import { getAllLocalGuides, getLocalDossier } from "@/lib/content/local";

const TODAY = "2026-08-28";

function city(p: Partial<CityKey> = {}): CityKey {
  return {
    ibgeCode: "3505708",
    stateCode: "sp",
    citySlug: "barueri",
    localityId: "sp-barueri",
    localityName: "Barueri",
    localityType: "municipality",
    ...p,
  };
}

function resource(
  id: string,
  coverage: CoverageType,
  p: Partial<FinancialResource> = {},
): FinancialResource {
  return {
    id,
    name: id,
    operator: "Órgão público",
    category: "consumer-protection",
    coverage,
    whatItSolves: "Resolve alguma coisa",
    howToAccess: "Pelo canal oficial",
    accessMode: "online",
    officialSource: `https://exemplo.gov.br/${id}`,
    verifiedAt: TODAY,
    ...p,
  };
}

/* ------------------------------------------------------------------ *
 * Escopo: cobertura nunca é inferida
 * ------------------------------------------------------------------ */

describe("caso A — a cobertura só vale quando a fonte declara", () => {
  it("escopo por IBGE só alcança os municípios listados", () => {
    const scope = { ibgeCodes: ["3505708", "3547304"] };
    expect(scopeCoversCity(scope, city())).toBe(true);
    expect(scopeCoversCity(scope, city({ ibgeCode: "3513009" }))).toBe(false);
  });

  it("cidade sem código IBGE não é alcançada por escopo de IBGE", () => {
    expect(scopeCoversCity({ ibgeCodes: ["3505708"] }, city({ ibgeCode: null }))).toBe(false);
  });

  it("escopo estadual não vaza para outro estado", () => {
    const scope = { stateCodes: ["sp"] };
    expect(scopeCoversCity(scope, city())).toBe(true);
    expect(scopeCoversCity(scope, city({ stateCode: "mg" }))).toBe(false);
  });

  it("caso B — recurso sem escopo declarado não alcança ninguém", () => {
    expect(scopeCoversCity({}, city())).toBe(false);
  });

  it("IBGE tem precedência sobre UF: escopo municipal não vira estadual", () => {
    const scope = { ibgeCodes: ["3547304"], stateCodes: ["sp"] };
    expect(scopeCoversCity(scope, city())).toBe(false);
  });
});

/* ------------------------------------------------------------------ *
 * Resolução e ordenação
 * ------------------------------------------------------------------ */

describe("caso C — o que é da cidade vem antes do que é do país", () => {
  const registry: RegistryResource[] = [
    { ...resource("nacional", "NATIONAL"), scope: { national: true } },
    { ...resource("estadual", "STATEWIDE"), scope: { stateCodes: ["sp"] } },
    { ...resource("de-outro-estado", "STATEWIDE"), scope: { stateCodes: ["rj"] } },
  ];

  it("ordena IN_CITY → STATEWIDE → NATIONAL e exclui o que não cobre", () => {
    const out = resolveCityResources(city(), [resource("procon-local", "IN_CITY")], registry);
    expect(out.map((r) => r.id)).toEqual(["procon-local", "estadual", "nacional"]);
  });

  it("caso D — id repetido entre dossiê e registry não duplica o card", () => {
    const duplicado = resource("nacional", "IN_CITY");
    const out = resolveCityResources(city(), [duplicado], registry);
    expect(out.filter((r) => r.id === "nacional")).toHaveLength(1);
    // a camada local vence: foi ela que declarou primeiro
    expect(out[0]!.coverage).toBe("IN_CITY");
  });

  it("agrupa por categoria mantendo a ordem canônica e sem grupo vazio", () => {
    const groups = groupByCategory([
      resource("a", "IN_CITY", { category: "complaint-channel" }),
      resource("b", "IN_CITY", { category: "consumer-protection" }),
    ]);
    expect(groups.map((g) => g.category)).toEqual([
      "consumer-protection",
      "complaint-channel",
    ]);
  });
});

/* ------------------------------------------------------------------ *
 * Pipeline fail-safe
 * ------------------------------------------------------------------ */

describe("caso E — fonte fora do ar não é recurso extinto", () => {
  const base = resource("procon", "IN_CITY", { verifiedAt: "2026-06-01" });

  it("checagem confirmada é o único caminho que avança verifiedAt", () => {
    const r = applyCheckResult(base, { kind: "confirmed" }, { attemptedAt: TODAY });
    expect(r.resource.verifiedAt).toBe(TODAY);
    expect(r.verificationAdvanced).toBe(true);
    expect(r.state).toBe("active");
  });

  it("fonte inacessível preserva verifiedAt e mantém o recurso visível", () => {
    const r = applyCheckResult(base, { kind: "unreachable" }, { attemptedAt: TODAY });
    expect(r.resource.verifiedAt).toBe("2026-06-01");
    expect(r.verificationAdvanced).toBe(false);
    expect(r.state).toBe("source_unavailable");
    expect(isRenderable(r.resource)).toBe(true);
    expect(r.resource.health!.lastCheckAttemptAt).toBe(TODAY);
  });

  it("caso F — um único 404 não remove: exige confirmação", () => {
    const first = applyCheckResult(base, { kind: "gone" }, { attemptedAt: TODAY });
    expect(first.state).toBe("source_unavailable");
    expect(first.goneStreak).toBe(1);
    expect(isRenderable(first.resource)).toBe(true);

    const second = applyCheckResult(first.resource, { kind: "gone" }, {
      attemptedAt: "2026-09-04",
      previousGoneStreak: first.goneStreak,
    });
    expect(second.goneStreak).toBe(CONFIRMATIONS_TO_REMOVE);
    expect(second.state).toBe("removed");
    expect(isRenderable(second.resource)).toBe(false);
    // nem mesmo a remoção mexe na data de verificação
    expect(second.resource.verifiedAt).toBe("2026-06-01");
  });

  it("falha de rede entre dois 404 não zera nem confirma a suspeita", () => {
    const first = applyCheckResult(base, { kind: "gone" }, { attemptedAt: TODAY });
    const network = applyCheckResult(first.resource, { kind: "unreachable" }, {
      attemptedAt: "2026-08-29",
      previousGoneStreak: first.goneStreak,
    });
    expect(network.goneStreak).toBe(1);
    expect(network.state).toBe("source_unavailable");
  });

  it("recurso removido some da resolução para a cidade", () => {
    const removido = resource("morto", "IN_CITY", {
      health: { state: "removed", lastCheckAttemptAt: TODAY },
    });
    const out = resolveCityResources(city(), [removido], []);
    expect(out).toHaveLength(0);
  });

  it("o leitor é avisado quando não deu para reconferir", () => {
    const r = applyCheckResult(base, { kind: "unreachable" }, { attemptedAt: TODAY });
    expect(stalenessNotice(r.resource)).toContain("reconferir");
    expect(stalenessNotice(base)).toBeNull();
  });

  it("applyCheckResult não muta o recurso original", () => {
    const original = { ...base };
    applyCheckResult(base, { kind: "confirmed" }, { attemptedAt: TODAY });
    expect(base).toEqual(original);
  });
});

/* ------------------------------------------------------------------ *
 * Indexability Gate
 * ------------------------------------------------------------------ */

describe("caso P — existir no banco de dados não é merecer uma URL", () => {
  it("sem recurso próprio da cidade, a página existe mas não indexa", () => {
    const r = evaluateCityIndexability({
      city: city(),
      hasDossier: true,
      resources: [resource("nacional", "NATIONAL"), resource("estadual", "STATEWIDE")],
      today: TODAY,
    });
    expect(r.decision).toBe("NOINDEX");
    expect(r.localResourceCount).toBe(0);
    expect(r.reasons.join(" ")).toContain("país inteiro");
  });

  it("caso Q — município sem código IBGE não gera rota", () => {
    const r = evaluateCityIndexability({
      city: city({ ibgeCode: null }),
      hasDossier: true,
      resources: [resource("procon", "IN_CITY")],
      today: TODAY,
    });
    expect(r.decision).toBe("DO_NOT_GENERATE");
    expect(r.reasons.join(" ")).toContain("IBGE");
  });

  it("região sem IBGE não é bloqueada: só município precisa do código", () => {
    const r = evaluateCityIndexability({
      city: city({ ibgeCode: null, localityType: "region", localityId: "sp-x-alphaville" }),
      hasDossier: true,
      resources: [resource("procon", "IN_CITY")],
      today: TODAY,
    });
    expect(r.decision).toBe("INDEX");
  });

  it("sem dossiê não gera rota", () => {
    const r = evaluateCityIndexability({
      city: city(),
      hasDossier: false,
      resources: [resource("procon", "IN_CITY")],
      today: TODAY,
    });
    expect(r.decision).toBe("DO_NOT_GENERATE");
  });

  it("caso R — verificação vencida vira fila de revisão, não exclusão", () => {
    const velho = resource("procon", "IN_CITY", { verifiedAt: "2025-01-01" });
    const r = evaluateCityIndexability({
      city: city(),
      hasDossier: true,
      resources: [velho],
      today: TODAY,
    });
    expect(r.decision).toBe("REVIEW");
    expect(r.oldestLocalVerificationDays).toBeGreaterThan(STALE_VERIFICATION_DAYS);
  });

  it("fonte indisponível na camada local vira REVIEW, não NOINDEX", () => {
    const instavel = resource("procon", "IN_CITY", {
      health: { state: "source_unavailable", lastCheckAttemptAt: TODAY },
    });
    const r = evaluateCityIndexability({
      city: city(),
      hasDossier: true,
      resources: [instavel],
      today: TODAY,
    });
    expect(r.decision).toBe("REVIEW");
    expect(r.reasons.join(" ")).toContain("indisponível");
  });

  it("caso S — camada local real, recente e distinta indexa", () => {
    const r = evaluateCityIndexability({
      city: city(),
      hasDossier: true,
      resources: [resource("procon", "IN_CITY"), resource("nacional", "NATIONAL")],
      today: TODAY,
    });
    expect(r.decision).toBe("INDEX");
    expect(r.localResourceCount).toBe(1);
  });

  it("a decisão sempre vem com motivo, inclusive quando é INDEX", () => {
    const r = evaluateCityIndexability({
      city: city(),
      hasDossier: true,
      resources: [resource("procon", "IN_CITY")],
      today: TODAY,
    });
    expect(r.reasons.length).toBeGreaterThan(0);
  });

  it("recurso removido não conta para o gate", () => {
    const r = evaluateCityIndexability({
      city: city(),
      hasDossier: true,
      resources: [
        resource("morto", "IN_CITY", {
          health: { state: "removed", lastCheckAttemptAt: TODAY },
        }),
        resource("nacional", "NATIONAL"),
      ],
      today: TODAY,
    });
    expect(r.decision).toBe("NOINDEX");
    expect(r.localResourceCount).toBe(0);
  });
});

/* ------------------------------------------------------------------ *
 * Anti-doorway
 * ------------------------------------------------------------------ */

describe("teste anti-doorway: tirando o nome da cidade, sobra diferença?", () => {
  const cotia = city({ localityId: "sp-cotia", localityName: "Cotia", ibgeCode: "3513009" });
  const jandira = city({ localityId: "sp-jandira", localityName: "Jandira", ibgeCode: "3525003" });

  it("duas cidades com o mesmo texto genérico colidem", () => {
    const generico = (nome: string) =>
      resource("x", "IN_CITY", {
        operator: `Procon de ${nome}`,
        whatItSolves: "Atendimento de defesa do consumidor",
        howToAccess: "Atendimento presencial em dias úteis",
      });
    const colisoes = findDoorwayCollisions([
      { city: cotia, resources: [generico("Cotia")] },
      { city: jandira, resources: [generico("Jandira")] },
    ]);
    expect(colisoes).toHaveLength(1);
    expect(colisoes[0]!.localityIds).toEqual(["sp-cotia", "sp-jandira"]);
  });

  it("detalhe local verdadeiro (endereço, agendamento) desfaz a colisão", () => {
    const colisoes = findDoorwayCollisions([
      {
        city: cotia,
        resources: [
          resource("x", "IN_CITY", {
            howToAccess: "Atendimento na Avenida Professor Manoel José Pedroso, com agendamento on-line",
          }),
        ],
      },
      {
        city: jandira,
        resources: [
          resource("x", "IN_CITY", {
            howToAccess: "Atendimento no Paço Municipal por ordem de chegada, sem agendamento",
          }),
        ],
      },
    ]);
    expect(colisoes).toHaveLength(0);
  });

  it("recursos nacionais e estaduais são ignorados na assinatura", () => {
    const sig = localSignature(cotia, [
      resource("nacional", "NATIONAL", { howToAccess: "texto federal" }),
      resource("estadual", "STATEWIDE", { howToAccess: "texto estadual" }),
    ]);
    expect(sig).toBe("");
  });

  it("cidade sem camada local não entra na comparação de colisão", () => {
    const colisoes = findDoorwayCollisions([
      { city: cotia, resources: [resource("n", "NATIONAL")] },
      { city: jandira, resources: [resource("n", "NATIONAL")] },
    ]);
    expect(colisoes).toHaveLength(0);
  });

  it("o nome da localidade não conta como diferença", () => {
    const a = localSignature(cotia, [resource("x", "IN_CITY", { operator: "Procon de Cotia" })]);
    const b = localSignature(jandira, [
      resource("x", "IN_CITY", { operator: "Procon de Jandira" }),
    ]);
    expect(a).toBe(b);
  });
});

/* ------------------------------------------------------------------ *
 * Deduplicação contra o registry
 * ------------------------------------------------------------------ */

describe("caso G — link federal repetido no dossiê não vira recurso local", () => {
  it("fingerprint normaliza www e caminho", () => {
    expect(sourceFingerprint("https://www.consumidor.gov.br")).toBe("consumidor.gov.br/");
    expect(sourceFingerprint("https://consumidor.gov.br/pages/principal/")).toBe(
      "consumidor.gov.br/pages",
    );
  });

  it("consumidor.gov.br do dossiê é descartado da camada local", () => {
    const dossier = {
      localityId: "sp-teste",
      localityName: "Teste",
      consumerProtectionResources: [
        {
          organization: "Consumidor.gov.br (plataforma federal)",
          service: "Reclamação on-line",
          officialSource: "https://www.consumidor.gov.br",
          checkedAt: TODAY,
        },
        {
          organization: "Procon Teste",
          service: "Atendimento presencial na Rua Um, 10",
          officialSource: "https://portal.teste.sp.gov.br/procon",
          checkedAt: TODAY,
        },
      ],
      verifiedLocalPrograms: [],
    } as never;

    const out = localResourcesFromDossier(dossier, getResourceRegistry());
    expect(out).toHaveLength(1);
    expect(out[0]!.name).toBe("Procon Teste");
    expect(out[0]!.coverage).toBe("IN_CITY");
  });
});

/* ------------------------------------------------------------------ *
 * Área protegida de publicidade
 * ------------------------------------------------------------------ */

describe("o mapa financeiro é área protegida de anúncio", () => {
  const files = [
    "src/components/local/CityFinancialMap.tsx",
    "src/components/local/LocalGuideView.tsx",
  ];

  it("nenhum slot de AdSense é montado dentro da página local", () => {
    for (const file of files) {
      const source = readFileSync(resolvePath(process.cwd(), file), "utf8");
      expect(source, file).not.toMatch(/AdSlot|adsbygoogle|shouldRenderAd/);
    }
  });

  it("o mapa não usa vocabulário de recomendação ou ranking", () => {
    const source = readFileSync(
      resolvePath(process.cwd(), "src/components/local/CityFinancialMap.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/recomendamos|melhor op[çc][ãa]o|as melhores|ranking|indicamos/i);
  });
});

/* ------------------------------------------------------------------ *
 * Dados reais do projeto
 * ------------------------------------------------------------------ */

describe("o registry e os 23 dossiês reais", () => {
  const registry = getResourceRegistry();

  it("nenhum recurso do registry é IN_CITY — essa camada vem do dossiê", () => {
    for (const r of registry) {
      expect(["REGIONAL", "STATEWIDE", "NATIONAL"]).toContain(r.coverage);
    }
  });

  it("todo recurso do registry tem fonte oficial em domínio público", () => {
    for (const r of registry) {
      expect(r.officialSource).toMatch(/^https:\/\//);
      expect(r.officialSource).toMatch(/\.(gov\.br|jus\.br|def\.br|leg\.br)(\/|$)/);
    }
  });

  it("nenhum recurso do registry é comercial ou traz ranking", () => {
    const texto = JSON.stringify(registry).toLowerCase();
    for (const proibido of ["melhor banco", "ranking", "as melhores", "taxa a partir de", "contrate"]) {
      expect(texto).not.toContain(proibido);
    }
  });

  it("todo id do registry é único", () => {
    const ids = registry.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("toda localidade com guia produz um mapa, e nenhuma vira doorway", () => {
    const guias = getAllLocalGuides().filter((g) => g.frontmatter.dossierId);
    expect(guias.length).toBeGreaterThan(0);
    for (const guia of guias) {
      const map = buildCityFinancialMap(guia.frontmatter.dossierId!, TODAY);
      expect(map, guia.fileName).not.toBeNull();
      expect(map!.resources.length, guia.fileName).toBeGreaterThan(0);
      expect(map!.indexability.decision, guia.fileName).not.toBe("DO_NOT_GENERATE");
      expect(
        map!.indexability.reasons.join(" "),
        guia.fileName,
      ).not.toContain("idêntica à de outra cidade");
    }
  });

  it("todo dossiê usa o formato unificado de verifiedLocalPrograms", () => {
    for (const guia of getAllLocalGuides()) {
      const id = guia.frontmatter.dossierId;
      if (!id) continue;
      for (const p of getLocalDossier(id)?.verifiedLocalPrograms ?? []) {
        expect(typeof p.program, id).toBe("string");
        expect(typeof p.detail, id).toBe("string");
      }
    }
  });
});
