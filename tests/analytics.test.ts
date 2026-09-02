/**
 * TESTES DO RASTREAMENTO
 *
 * O que estes testes protegem não é o código: é a POSSIBILIDADE de confiar no
 * relatório. Rastreamento errado é pior que rastreamento ausente — quem não
 * mede sabe que não sabe; quem mede errado decide com convicção sobre número
 * falso.
 *
 * Por isso a parte que pensa (`click-model`, `redact`) é feita de funções
 * puras: entra objeto, sai objeto. Dá para travar o comportamento inteiro sem
 * navegador, e a regressão aparece no `pnpm test`, não seis meses depois num
 * relatório que ninguém consegue explicar.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  buildClickEvent,
  classifyLink,
  destinationFor,
  eventNameFor,
  pageTypeFor,
  type ClickDescriptor,
} from "../src/lib/analytics/click-model";
import {
  redactText,
  redactParams,
  isForbiddenParamKey,
  MAX_LABEL_LENGTH,
} from "../src/lib/analytics/redact";
import { EVENT_REGISTRY, findEvent } from "../src/lib/analytics/event-registry";

const ORIGIN = "https://www.creditoporperto.com";

function descriptor(over: Partial<ClickDescriptor> = {}): ClickDescriptor {
  return {
    tag: "a",
    href: "/calculadoras/emprestimo/",
    text: "Abrir a calculadora",
    area: "conteudo",
    component: null,
    labelOverride: null,
    eventOverride: null,
    position: null,
    pathname: "/emprestimos/sp/barueri/",
    origin: ORIGIN,
    ...over,
  };
}

/* ------------------------------------------------------------------ */

describe("redação de parâmetros", () => {
  it("apaga moeda em qualquer formato", () => {
    expect(redactText("Copiar resumo (R$ 1.240,00)")).toBe("Copiar resumo (#)");
    expect(redactText("R$1240")).toBe("#");
    expect(redactText("Economia de 3.500,00 reais")).toBe("Economia de #");
  });

  it("apaga percentual, CPF, CNPJ e telefone", () => {
    expect(redactText("Taxa de 12,5% ao mês")).toBe("Taxa de # ao mês");
    expect(redactText("CPF 397.123.456-97")).toBe("CPF #");
    expect(redactText("CNPJ 00.000.000/0001-91")).toBe("CNPJ #");
    /* Os parênteses do DDD entram na máscara — é o certo: sobrar "( )"
       ao redor do "#" só devolveria a forma do dado apagado. */
    expect(redactText("Ligue (11) 98765-4321")).toBe("Ligue #");
  });

  it("preserva número que faz parte do rótulo e não é dado da pessoa", () => {
    /* Se a redação fosse "todo dígito", o relatório perderia o sentido: são
       rótulos fixos do nosso próprio texto, não valor digitado. */
    expect(redactText("151 do Procon")).toBe("151 do Procon");
    expect(redactText("Lei 14.181")).toBe("Lei 14.181");
    expect(redactText("Antecipação do 13º")).toBe("Antecipação do 13º");
    expect(redactText("5 postos de atendimento")).toBe("5 postos de atendimento");
  });

  it("colapsa máscaras vizinhas e corta no limite", () => {
    expect(redactText("de R$ 1.000,00 a R$ 2.000,00")).toBe("de # a #");
    const long = redactText("a".repeat(200));
    expect(long.length).toBeLessThanOrEqual(MAX_LABEL_LENGTH);
    expect(long.endsWith("…")).toBe(true);
  });

  it("recusa chave proibida mesmo com valor inofensivo", () => {
    expect(isForbiddenParamKey("renda")).toBe(true);
    expect(isForbiddenParamKey("cpf")).toBe(true);
    expect(isForbiddenParamKey("instituicao")).toBe(true);
    expect(isForbiddenParamKey("area")).toBe(false);

    const { params, dropped } = redactParams({ renda: "faixa alta", area: "rodape" });
    expect(dropped).toEqual(["renda"]);
    expect(params).toEqual({ area: "rodape" });
  });

  it("recusa número grande, objeto e array; aceita contagem pequena", () => {
    const { params, dropped } = redactParams({
      position: 3,
      results: 1200,
      detalhe: { a: 1 },
      lista: [1, 2],
      ok: true,
    });
    expect(params).toEqual({ position: 3, ok: true });
    expect(dropped.sort()).toEqual(["detalhe", "lista", "results"]);
  });
});

/* ------------------------------------------------------------------ */

describe("tipo de página", () => {
  it.each([
    ["/", "home"],
    ["/emprestimos/sp/barueri/", "guia-local"],
    ["/emprestimos/sp/", "indice-estado"],
    ["/emprestimos/emprestimo-pessoal/", "artigo"],
    ["/emprestimos/", "hub-categoria"],
    ["/juros-e-cet/o-que-e-cet/", "artigo"],
    ["/calculadoras/", "hub-ferramentas"],
    ["/calculadoras/emprestimo/", "ferramenta"],
    ["/taxas/", "radar"],
    ["/decisoes-financeiras/", "central-decisoes"],
    ["/glossario/", "glossario"],
    ["/quem-somos/", "institucional"],
    ["/mapa-do-site/", "mapa-do-site"],
    ["/qualquer-coisa/", "outra"],
  ])("%s → %s", (pathname, expected) => {
    expect(pageTypeFor(pathname)).toBe(expected);
  });

  it("separa guia local de artigo pela sigla de estado", () => {
    /* As duas rotas começam com /emprestimos/. Confundi-las jogaria os 24
       guias no relatório de artigos e apagaria a pergunta que o SEO local
       precisa responder. */
    expect(pageTypeFor("/emprestimos/sp/campinas/")).toBe("guia-local");
    expect(pageTypeFor("/emprestimos/credito-do-trabalhador/")).toBe("artigo");
  });
});

/* ------------------------------------------------------------------ */

describe("classificação de link", () => {
  it("interno guarda só o caminho — nunca query nem hash", () => {
    const info = classifyLink(
      "https://www.creditoporperto.com/calculadoras/emprestimo/?valor=15000#resultado",
      ORIGIN,
      "a",
    );
    expect(info).toEqual({ kind: "interno", path: "/calculadoras/emprestimo/", domain: null });
  });

  it("externo guarda o domínio, sem caminho", () => {
    const info = classifyLink("https://www.bcb.gov.br/estabilidadefinanceira", ORIGIN, "a");
    expect(info.kind).toBe("externo");
    expect(info.domain).toBe("bcb.gov.br");
    expect(info.path).toBeNull();
  });

  it("WhatsApp não leva número, nem no caminho nem na query", () => {
    for (const href of [
      "https://wa.me/5511987654321",
      "https://api.whatsapp.com/send?phone=5511987654321&text=oi",
    ]) {
      const info = classifyLink(href, ORIGIN, "a");
      expect(info.kind).toBe("whatsapp");
      expect(info.path).toBeNull();
    }
  });

  it("âncora, e-mail, telefone e botão", () => {
    expect(classifyLink("#perguntas", ORIGIN, "a").kind).toBe("ancora");
    expect(classifyLink("mailto:alguem@exemplo.com", ORIGIN, "a").kind).toBe("email");
    expect(classifyLink("tel:+551133334444", ORIGIN, "a").kind).toBe("telefone");
    expect(classifyLink(null, ORIGIN, "button").kind).toBe("acao");
  });

  it("href inválido não quebra a medição", () => {
    expect(classifyLink("javascript:void(0)", ORIGIN, "a").kind).toBe("acao");
    expect(classifyLink("", ORIGIN, "a").kind).toBe("acao");
  });
});

describe("destino externo", () => {
  it.each([
    ["www.bcb.gov.br", "banco-central"],
    ["dadosabertos.bcb.gov.br", "banco-central"],
    ["www.planalto.gov.br", "legislacao"],
    ["www.consumidor.gov.br", "consumidor-gov"],
    ["procon.sp.gov.br", "procon"],
    ["www.stj.jus.br", "judiciario"],
    ["www.ibge.gov.br", "ibge"],
    ["braganca.sp.gov.br", "prefeitura"],
    ["www.gov.br", "governo"],
    ["exemplo.com.br", "outro"],
  ])("%s → %s", (host, expected) => {
    expect(destinationFor(host)).toBe(expected);
  });
});

/* ------------------------------------------------------------------ */

describe("nome do evento", () => {
  it("saída externa vence a área — de onde saiu importa menos que ter saído", () => {
    const externo = classifyLink("https://www.bcb.gov.br/", ORIGIN, "a");
    for (const area of ["cabecalho", "conteudo", "rodape", "ferramenta", null]) {
      expect(eventNameFor(area, externo)).toBe("outbound_click");
    }
  });

  it("separa navegação estrutural de oferta do site", () => {
    const interno = classifyLink("/calculadoras/", ORIGIN, "a");
    expect(eventNameFor("cabecalho", interno)).toBe("nav_click");
    expect(eventNameFor("rodape", interno)).toBe("nav_click");
    expect(eventNameFor("chamada-ferramenta", interno)).toBe("cta_click");
    expect(eventNameFor("ponte-local", interno)).toBe("cta_click");
    expect(eventNameFor("conteudo", interno)).toBe("content_link_click");
  });

  it("botão sem href não vira clique genérico", () => {
    /* Abrir acordeão, limpar campo, avançar etapa: cada um já tem evento
       próprio de ferramenta. Duplicar encheria o relatório de ruído. */
    expect(eventNameFor("ferramenta", classifyLink(null, ORIGIN, "button"))).toBeNull();
  });
});

/* ------------------------------------------------------------------ */

describe("montagem do evento de clique", () => {
  it("link para fonte oficial dentro de um guia local", () => {
    const built = buildClickEvent(
      descriptor({
        href: "https://www.bcb.gov.br/meubc/registrato",
        text: "consultar no Registrato",
      }),
    );
    expect(built).toEqual({
      name: "outbound_click",
      params: {
        area: "conteudo",
        page_type: "guia-local",
        label: "consultar no Registrato",
        domain: "bcb.gov.br",
        destination: "banco-central",
      },
    });
  });

  it("card de ferramenta no hub, com posição da lista", () => {
    const built = buildClickEvent(
      descriptor({
        pathname: "/calculadoras/",
        area: "cards-ferramentas",
        component: "comparador-de-propostas",
        href: "/calculadoras/comparador-de-propostas/",
        text: "Comparar propostas",
        position: 3,
      }),
    );
    expect(built?.name).toBe("cta_click");
    expect(built?.params).toMatchObject({
      area: "cards-ferramentas",
      page_type: "hub-ferramentas",
      component: "comparador-de-propostas",
      to_path: "/calculadoras/comparador-de-propostas/",
      position: 3,
    });
  });

  it("área não declarada não some do relatório — fica visível como falha", () => {
    const built = buildClickEvent(descriptor({ area: null }));
    expect(built?.params.area).toBe("nao_declarada");
  });

  it("WhatsApp vira contact_click com o canal, sem o número", () => {
    const built = buildClickEvent(
      descriptor({ href: "https://wa.me/5511987654321", text: "Falar no WhatsApp" }),
    );
    expect(built?.name).toBe("contact_click");
    expect(built?.params.channel).toBe("whatsapp");
    expect(JSON.stringify(built?.params)).not.toContain("5511987654321");
  });

  it("posição fora de faixa plausível é descartada", () => {
    const built = buildClickEvent(descriptor({ position: 99999 }));
    expect(built?.params.position).toBeUndefined();
  });

  it("data-track-event tem precedência sobre a regra de área", () => {
    const built = buildClickEvent(descriptor({ eventOverride: "cta_click" }));
    expect(built?.name).toBe("cta_click");
  });
});

/* ------------------------------------------------------------------ */

describe("integridade do dicionário", () => {
  it("nomes únicos e no formato aceito pelo GA4", () => {
    const names = EVENT_REGISTRY.map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) {
      expect(name).toMatch(/^[a-z][a-z0-9_]{0,39}$/);
    }
  });

  it("nenhum parâmetro declarado é chave proibida", () => {
    for (const spec of EVENT_REGISTRY) {
      for (const param of spec.params) {
        expect(
          isForbiddenParamKey(param),
          `${spec.name} declara o parâmetro proibido "${param}"`,
        ).toBe(false);
      }
    }
  });

  it("todo evento tem descrição em português e útil", () => {
    for (const spec of EVENT_REGISTRY) {
      expect(spec.description.length, spec.name).toBeGreaterThan(20);
    }
  });

  it("respeita o teto de 25 parâmetros por evento do GA4", () => {
    for (const spec of EVENT_REGISTRY) {
      expect(spec.params.length, spec.name).toBeLessThanOrEqual(25);
    }
  });

  it("todo evento que buildClickEvent pode produzir está declarado", () => {
    for (const name of [
      "nav_click",
      "cta_click",
      "content_link_click",
      "anchor_click",
      "outbound_click",
      "contact_click",
    ]) {
      expect(findEvent(name), name).toBeDefined();
    }
  });

  it("os parâmetros que a montagem emite cabem na especificação", () => {
    const casos: ClickDescriptor[] = [
      descriptor({ href: "https://www.bcb.gov.br/", position: 2, component: "x" }),
      descriptor({ href: "/calculadoras/", area: "cabecalho", position: 1 }),
      descriptor({ href: "#faq", area: "conteudo" }),
      descriptor({ href: "mailto:a@b.com", area: "rodape" }),
      descriptor({ href: "https://wa.me/551199999999", area: "conteudo" }),
      descriptor({ href: "/x/", area: "cards-ferramentas", component: "y", position: 4 }),
    ];
    for (const caso of casos) {
      const built = buildClickEvent(caso);
      if (!built) continue;
      const spec = findEvent(built.name);
      expect(spec, built.name).toBeDefined();
      for (const key of Object.keys(built.params)) {
        expect(
          spec!.params.includes(key),
          `${built.name} emitiu "${key}", fora da especificação`,
        ).toBe(true);
      }
    }
  });
});

/* ------------------------------------------------------------------ */

describe("disciplina da camada de rastreamento", () => {
  function sourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...sourceFiles(full));
      else if (/\.tsx?$/.test(entry.name)) out.push(full);
    }
    return out;
  }

  const files = sourceFiles(path.join(process.cwd(), "src")).map((f) => ({
    rel: path.relative(process.cwd(), f).split(path.sep).join("/"),
    body: fs.readFileSync(f, "utf8"),
  }));

  it("nenhum componente redefine o helper gtag", () => {
    /* Era o estado anterior: 14 cópias da mesma função, e qualquer regra nova
       teria de ser escrita 14 vezes para valer. */
    const copias = files.filter(
      (f) =>
        /function gtag\(\.\.\.args: unknown\[\]\)/.test(f.body) &&
        !f.rel.startsWith("src/lib/analytics/"),
    );
    expect(copias.map((f) => f.rel)).toEqual([]);
  });

  it("todo evento disparado no código está no dicionário", () => {
    const desconhecidos: string[] = [];
    for (const { rel, body } of files) {
      if (rel.startsWith("src/lib/analytics/")) continue;
      for (const m of body.matchAll(/\btrack\(\s*"([a-z0-9_]+)"/g)) {
        if (!findEvent(m[1]!)) desconhecidos.push(`${m[1]} (${rel})`);
      }
    }
    expect(desconhecidos).toEqual([]);
  });

  it("todo parâmetro enviado está declarado para aquele evento", () => {
    /* A primeira versão do dicionário errou dez eventos: declarava `results`
       onde a busca manda `results_count`. track() descarta o que não está na
       especificação, então o efeito seria silencioso — o evento chegando ao
       GA4 sem os parâmetros que tinha antes. Foi o QA no navegador que pegou;
       este teste é para não depender de QA na próxima. */
    function keysOf(block: string): string[] {
      const parts: string[] = [];
      let depth = 0;
      let buffer = "";
      for (const ch of block) {
        if ("([{".includes(ch)) depth++;
        if (")]}".includes(ch)) depth--;
        if (ch === "," && depth === 0) {
          parts.push(buffer);
          buffer = "";
        } else buffer += ch;
      }
      parts.push(buffer);
      return parts
        .map((part) => /^\s*([A-Za-z_$][\w$]*)\s*(:|$)/.exec(part.trim())?.[1])
        .filter((k): k is string => Boolean(k));
    }

    const foraDaEspecificacao: string[] = [];
    for (const { rel, body } of files) {
      if (rel.startsWith("src/lib/analytics/")) continue;
      for (const call of body.matchAll(
        /\btrack\(\s*"([a-z0-9_]+)"\s*(?:,\s*\{([\s\S]*?)\}\s*)?\)/g,
      )) {
        const spec = findEvent(call[1]!);
        if (!spec) continue;
        for (const key of keysOf(call[2] ?? "")) {
          if (!spec.params.includes(key)) {
            foraDaEspecificacao.push(`${spec.name}.${key} (${rel})`);
          }
        }
      }
    }
    expect(foraDaEspecificacao).toEqual([]);
  });

  it("nenhum nome de evento é montado em tempo de execução", () => {
    const montados = files
      .filter((f) => !f.rel.startsWith("src/lib/analytics/") && /\btrack\(\s*`/.test(f.body))
      .map((f) => f.rel);
    expect(montados).toEqual([]);
  });
});
