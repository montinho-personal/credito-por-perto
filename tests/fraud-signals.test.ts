import { describe, expect, it } from "vitest";
import {
  evaluateAnswers,
  HEADLINE_COPY,
  SEVERITY_LABEL,
} from "../src/lib/fraud/evaluate";
import {
  EMERGENCY_FLOW,
  FRAUD_QUESTIONS,
} from "../src/lib/fraud/signal-registry";

describe("registro de sinais", () => {
  it("tem entre 7 e 10 perguntas, todas com fonte, ação e revisão datada", () => {
    expect(FRAUD_QUESTIONS.length).toBeGreaterThanOrEqual(7);
    expect(FRAUD_QUESTIONS.length).toBeLessThanOrEqual(10);
    for (const q of FRAUD_QUESTIONS) {
      expect(q.source.length).toBeGreaterThan(10);
      expect(q.recommendedAction.length).toBeGreaterThan(10);
      expect(q.reviewedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(q.links.length).toBeGreaterThan(0);
      expect(q.trigger.every((t) => q.options.includes(t))).toBe(true);
    }
  });

  it("pagamento antecipado e credenciais são sinais críticos; WhatsApp e contato não solicitado são leves", () => {
    const byId = Object.fromEntries(FRAUD_QUESTIONS.map((q) => [q.id, q]));
    expect(byId["upfront-payment"]!.severity).toBe("critical");
    expect(byId["credentials"]!.severity).toBe("critical");
    expect(byId["whatsapp-only"]!.severity).toBe("low");
    expect(byId["unsolicited"]!.severity).toBe("low");
  });

  it("nenhum texto do registro produz veredito", () => {
    const all = JSON.stringify(FRAUD_QUESTIONS) + JSON.stringify(HEADLINE_COPY);
    expect(all).not.toMatch(/é golpe[.,"”]/i);
    expect(all).not.toMatch(/pode confiar/i);
    expect(all).not.toMatch(/oferta segura/i);
    expect(all).not.toMatch(/\d+%\s*de (chance|risco|probabilidade)/i);
  });
});

describe("casos A–J do escopo", () => {
  it("A: WhatsApp + instituição confirmada + sem pagamento → não conclui golpe", () => {
    const r = evaluateAnswers({
      "whatsapp-only": "yes",
      "institution-check": "yes",
      "upfront-payment": "no",
    });
    expect(r.headline).toBe("some_signals");
    expect(r.signals.map((s) => s.id)).toEqual(["whatsapp-only"]);
    expect(HEADLINE_COPY[r.headline].body).toMatch(/Nenhum sinal isolado prova/);
  });

  it("B: pediram Pix para liberar → sinal importante, manchete de parada", () => {
    const r = evaluateAnswers({ "upfront-payment": "yes" });
    expect(r.headline).toBe("critical");
    expect(r.signals[0]!.id).toBe("upfront-payment");
    expect(HEADLINE_COPY.critical.title).toMatch(/Pare antes/);
  });

  it("C: pediram código SMS → prioridade máxima na ordenação", () => {
    const r = evaluateAnswers({ credentials: "yes", "whatsapp-only": "yes" });
    expect(r.signals[0]!.id).toBe("credentials");
    expect(r.headline).toBe("critical");
  });

  it("F: instituição existe no BC mas contato não confirmado → explica a diferença", () => {
    const q = FRAUD_QUESTIONS.find((x) => x.id === "institution-check")!;
    expect(q.explanation).toMatch(/não confirma que o WhatsApp/);
    const r = evaluateAnswers({ "institution-check": "unsure" });
    expect(r.signals.map((s) => s.id)).toContain("institution-check");
  });

  it("G: nenhum sinal → sem selo verde, com a frase obrigatória", () => {
    const r = evaluateAnswers({
      "upfront-payment": "no",
      credentials: "no",
      "remote-access": "no",
      "guaranteed-approval": "no",
      pressure: "no",
      "personal-account": "no",
      "institution-check": "yes",
      unsolicited: "no",
      "whatsapp-only": "no",
      "too-good": "no",
    });
    expect(r.headline).toBe("no_main_signals");
    expect(r.signals).toHaveLength(0);
    expect(HEADLINE_COPY.no_main_signals.body).toMatch(/não prova que a oferta seja legítima/);
    expect(JSON.stringify(HEADLINE_COPY.no_main_signals)).not.toMatch(/segura|✅/);
  });

  it("H: muitos sinais → nunca vira percentual ou certeza", () => {
    const r = evaluateAnswers({
      "upfront-payment": "yes",
      credentials: "yes",
      "guaranteed-approval": "yes",
      pressure: "yes",
      "whatsapp-only": "yes",
    });
    expect(r.headline).toBe("critical");
    expect(r.signals).toHaveLength(5);
    const text = HEADLINE_COPY[r.headline].title + HEADLINE_COPY[r.headline].body;
    expect(text).not.toMatch(/%|100|certeza/);
  });

  it("I: apenas WhatsApp → tom informativo, rótulo leve", () => {
    const r = evaluateAnswers({ "whatsapp-only": "yes" });
    expect(r.headline).toBe("some_signals");
    expect(SEVERITY_LABEL[r.signals[0]!.severity]).toBe("Contexto");
    expect(r.signals[0]!.explanation).toMatch(/não significa fraude/);
  });

  it("J: oferta boa demais → sinal contextual apontando o Minha Taxa Está Cara", () => {
    const r = evaluateAnswers({ "too-good": "yes" });
    expect(r.signals[0]!.severity).toBe("low");
    expect(r.signals[0]!.links.some((l) => l.href.includes("minha-taxa-esta-cara"))).toBe(true);
  });

  it("dois sinais fortes sem crítico → manchete de múltiplos pontos", () => {
    const r = evaluateAnswers({ "guaranteed-approval": "yes", pressure: "yes" });
    expect(r.headline).toBe("multiple_high");
  });
});

describe("casos D/E — fluxo de quem já pagou", () => {
  it("D: fluxo Pix menciona banco primeiro, MED sem promessa e BO", () => {
    const text = EMERGENCY_FLOW.pixSteps.join(" ");
    expect(EMERGENCY_FLOW.pixSteps[0]).toMatch(/banco pelos canais oficiais/);
    expect(text).toMatch(/MED/);
    expect(text).toMatch(/não é garantida/);
    expect(text).toMatch(/boletim de ocorrência/i);
    expect(text).not.toMatch(/vai receber|recupera seu/i);
    expect(EMERGENCY_FLOW.medSource.href).toMatch(/^https:\/\/www\.bcb\.gov\.br\//);
  });

  it("E: fluxo de outros pagamentos NÃO apresenta o MED como se valesse fora do Pix", () => {
    const text = EMERGENCY_FLOW.otherSteps.join(" ");
    expect(text).not.toMatch(/MED/);
    expect(text).toMatch(/conteste o pagamento/);
    expect(text).toMatch(/consumidor\.gov\.br/);
  });
});
