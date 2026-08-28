"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRevealResult } from "./use-reveal-result";
import {
  EMERGENCY_FLOW,
  FRAUD_QUESTIONS,
  type AnswerValue,
} from "@/lib/fraud/signal-registry";
import {
  evaluateAnswers,
  HEADLINE_COPY,
  SEVERITY_LABEL,
  type AnswerMap,
} from "@/lib/fraud/evaluate";

/* Eventos de uso — nunca respostas, nunca a situação da pessoa. */
interface GtagWindow extends Window {
  gtag?: (...args: unknown[]) => void;
}
function gtag(...args: unknown[]) {
  const w = window as GtagWindow;
  if (typeof w.gtag === "function") w.gtag(...args);
}

const ANSWER_LABEL: Record<AnswerValue, string> = {
  yes: "Sim",
  no: "Não",
  unsure: "Não sei",
};

type Stage =
  | { kind: "triage" }
  | { kind: "paid-method" }
  | { kind: "emergency"; method: "pix" | "other" }
  | { kind: "quiz"; index: number }
  | { kind: "result" };

function BigOption({
  label,
  hint,
  onClick,
}: {
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl border border-brand-border bg-white px-5 py-4 text-left transition-colors hover:border-brand-teal"
    >
      <span className="block font-semibold text-brand-navy">{label}</span>
      {hint ? <span className="mt-0.5 block text-sm text-brand-muted">{hint}</span> : null}
    </button>
  );
}

export function FraudSignalChecker() {
  const [stage, setStage] = useState<Stage>({ kind: "triage" });
  const [answers, setAnswers] = useState<AnswerMap>({});
  const startedRef = useRef(false);
  const { ref: liveRef, reveal } = useRevealResult();

  function start() {
    if (!startedRef.current) {
      startedRef.current = true;
      gtag("event", "fraud_check_start");
    }
  }

  function answer(questionId: string, value: AnswerValue, index: number) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    if (index + 1 < FRAUD_QUESTIONS.length) {
      setStage({ kind: "quiz", index: index + 1 });
    } else {
      setStage({ kind: "result" });
      gtag("event", "fraud_check_complete");
      reveal();
    }
  }

  function back() {
    if (stage.kind === "quiz") {
      if (stage.index === 0) setStage({ kind: "triage" });
      else setStage({ kind: "quiz", index: stage.index - 1 });
    } else if (stage.kind === "paid-method") {
      setStage({ kind: "triage" });
    } else if (stage.kind === "emergency") {
      setStage({ kind: "paid-method" });
    } else if (stage.kind === "result") {
      setStage({ kind: "quiz", index: FRAUD_QUESTIONS.length - 1 });
    }
  }

  function clearAll() {
    setAnswers({});
    setStage({ kind: "triage" });
  }

  const evaluation = stage.kind === "result" ? evaluateAnswers(answers) : null;
  const headline = evaluation ? HEADLINE_COPY[evaluation.headline] : null;
  const currentQuestion = stage.kind === "quiz" ? FRAUD_QUESTIONS[stage.index] : undefined;
  const currentIndex = stage.kind === "quiz" ? stage.index : 0;

  return (
    <section
      aria-label="Verificação de sinais de golpe em proposta de empréstimo"
      className="rounded-2xl border border-brand-border bg-brand-surface-soft/50 p-4 sm:p-6"
    >
      <p className="text-sm leading-relaxed text-brand-muted">
        Sem cadastro, sem CPF, sem colar conversa. Suas respostas não são enviadas nem salvas — a
        verificação acontece no seu navegador.
      </p>

      <div ref={liveRef} aria-live="polite" className="mt-4 scroll-mt-24">
        {stage.kind === "triage" ? (
          <fieldset>
            <legend className="font-serif text-xl font-bold text-brand-navy">
              Antes de tudo: você já enviou dinheiro?
            </legend>
            <div className="mt-3 space-y-3">
              <BigOption
                label="Não"
                hint="Ainda estou avaliando a proposta."
                onClick={() => {
                  start();
                  setStage({ kind: "quiz", index: 0 });
                }}
              />
              <BigOption
                label="Sim"
                hint="Já fiz Pix, transferência, depósito ou outro pagamento."
                onClick={() => {
                  start();
                  setStage({ kind: "paid-method" });
                }}
              />
            </div>
          </fieldset>
        ) : null}

        {stage.kind === "paid-method" ? (
          <fieldset>
            <legend className="font-serif text-xl font-bold text-brand-navy">
              O pagamento foi por Pix?
            </legend>
            <div className="mt-3 space-y-3">
              <BigOption label="Sim, foi Pix" onClick={() => setStage({ kind: "emergency", method: "pix" })} />
              <BigOption
                label="Não — transferência, boleto, cartão ou outro"
                onClick={() => setStage({ kind: "emergency", method: "other" })}
              />
            </div>
            <button type="button" onClick={back} className="mt-4 text-sm font-medium text-brand-muted underline">
              ← Voltar
            </button>
          </fieldset>
        ) : null}

        {stage.kind === "emergency" ? (
          <div>
            <h3 tabIndex={-1} className="font-serif text-xl font-bold text-brand-navy">
              Já enviou dinheiro? Aja o quanto antes.
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-brand-text">
              O momento de avaliar acabou — agora é hora de agir. Os passos, em ordem:
            </p>
            <ol className="mt-3 list-decimal space-y-2.5 pl-5 text-sm leading-relaxed text-brand-text">
              {(stage.method === "pix" ? EMERGENCY_FLOW.pixSteps : EMERGENCY_FLOW.otherSteps).map(
                (step) => (
                  <li key={step.slice(0, 40)}>{step}</li>
                ),
              )}
            </ol>
            <p className="mt-4 rounded-xl border border-brand-border bg-white p-4 text-sm leading-relaxed text-brand-text">
              <strong>Fale com o seu banco pelos canais que você já conhece</strong> — o aplicativo,
              o telefone no verso do cartão ou o site oficial digitado por você. Não use números ou
              links enviados por quem fez a proposta.
            </p>
            {stage.method === "pix" ? (
              <p className="mt-3 text-xs text-brand-muted">
                Fonte:{" "}
                <a
                  href={EMERGENCY_FLOW.medSource.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  {EMERGENCY_FLOW.medSource.label}
                </a>
                . Orientações revisadas em 27/08/2026.
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" onClick={back} className="text-sm font-medium text-brand-muted underline">
                ← Voltar
              </button>
              <button
                type="button"
                onClick={() => {
                  setStage({ kind: "quiz", index: 0 });
                }}
                className="text-sm font-medium text-brand-teal-dark underline"
              >
                Quero também verificar os sinais da proposta
              </button>
            </div>
          </div>
        ) : null}

        {currentQuestion ? (
          <fieldset>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">
              Pergunta {currentIndex + 1} de {FRAUD_QUESTIONS.length}
            </p>
            <legend className="mt-1 font-serif text-xl font-bold text-brand-navy">
              {currentQuestion.question}
            </legend>
            {currentQuestion.hint ? (
              <p className="mt-1 text-sm text-brand-muted">{currentQuestion.hint}</p>
            ) : null}
            <div className="mt-3 space-y-3">
              {currentQuestion.options.map((option) => (
                <BigOption
                  key={option}
                  label={ANSWER_LABEL[option]}
                  onClick={() => answer(currentQuestion.id, option, currentIndex)}
                />
              ))}
            </div>
            <button type="button" onClick={back} className="mt-4 text-sm font-medium text-brand-muted underline">
              ← Voltar
            </button>
          </fieldset>
        ) : null}

        {stage.kind === "result" && evaluation && headline ? (
          <div>
            <p className="sr-only">Verificação concluída.</p>
            <h2 id="resultado-sinais" tabIndex={-1} className="font-serif text-2xl font-bold text-brand-navy">
              {headline.title}
            </h2>
            <p className="mt-2 text-base leading-relaxed text-brand-text">{headline.body}</p>
            {evaluation.signals.length > 0 ? (
              <p className="mt-2 text-sm text-brand-muted">
                {evaluation.signals.length === 1
                  ? "Encontramos 1 ponto que merece atenção."
                  : `Encontramos ${evaluation.signals.length} pontos que merecem atenção.`}
              </p>
            ) : null}

            <div className="mt-5 space-y-4">
              {evaluation.signals.map((signal) => (
                <article
                  key={signal.id}
                  className={`rounded-xl border bg-white p-5 ${
                    signal.severity === "critical"
                      ? "border-brand-danger/50"
                      : "border-brand-border"
                  }`}
                >
                  <p
                    className={`text-xs font-bold uppercase tracking-wide ${
                      signal.severity === "critical"
                        ? "text-brand-danger"
                        : signal.severity === "high"
                          ? "text-brand-warning"
                          : "text-brand-teal-dark"
                    }`}
                  >
                    {SEVERITY_LABEL[signal.severity]}
                  </p>
                  <h3 className="mt-1 font-serif text-lg font-bold text-brand-navy">
                    {signal.signalTitle}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-brand-text">{signal.explanation}</p>
                  <p className="mt-2 text-sm leading-relaxed text-brand-text">
                    <strong>Antes de continuar:</strong> {signal.recommendedAction}
                  </p>
                  <p className="mt-2 text-sm">
                    {signal.links.map((link) =>
                      link.external ? (
                        <a
                          key={link.href}
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => gtag("event", "fraud_check_bcb_click")}
                          className="mr-4 font-semibold text-brand-teal-dark underline"
                        >
                          {link.label} →
                        </a>
                      ) : (
                        <Link
                          key={link.href}
                          href={link.href}
                          className="mr-4 font-semibold text-brand-teal-dark underline"
                        >
                          {link.label} →
                        </Link>
                      ),
                    )}
                  </p>
                  <p className="mt-2 text-xs text-brand-muted">
                    Base: {signal.source}. Revisado em {signal.reviewedAt}.
                  </p>
                </article>
              ))}
            </div>

            <div className="mt-6 rounded-xl border border-brand-border bg-white p-5">
              <h3 className="font-serif text-lg font-bold text-brand-navy">
                Antes de continuar qualquer conversa
              </h3>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-brand-text">
                <li>
                  <strong>Verifique a instituição no Banco Central</strong> —{" "}
                  <Link
                    href="/calculadoras/consultar-instituicao/"
                    className="font-semibold underline"
                  >
                    consulte agora por nome ou CNPJ
                  </Link>{" "}
                  ou vá direto ao{" "}
                  <a
                    href="https://www.bcb.gov.br/meubc/encontreinstituicao"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => gtag("event", "fraud_check_bcb_click")}
                    className="font-semibold underline"
                  >
                    Encontre uma instituição
                  </a>
                  . Lembre: encontrar a instituição no BC não confirma que quem falou com você a
                  representa;
                </li>
                <li>
                  Procure os canais oficiais por conta própria — nunca confirme a oferta pelo mesmo
                  número que a enviou;
                </li>
                <li>Não pague nada e não informe códigos antes dessas confirmações.</li>
              </ul>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-brand-surface-soft p-4 text-sm leading-relaxed">
                <p className="font-bold text-brand-navy">Instituição confirmada e sem sinais?</p>
                <p className="mt-1 text-brand-text">
                  Antes de contratar, compare os números:{" "}
                  <Link href="/calculadoras/comparador-de-propostas/" className="font-semibold underline">
                    Comparador de Propostas
                  </Link>{" "}
                  e{" "}
                  <Link href="/calculadoras/minha-taxa-esta-cara/" className="font-semibold underline">
                    Minha taxa está cara?
                  </Link>
                </p>
              </div>
              <div className="rounded-xl bg-brand-surface-soft p-4 text-sm leading-relaxed">
                <p className="font-bold text-brand-navy">Já enviou dinheiro?</p>
                <p className="mt-1 text-brand-text">
                  <button
                    type="button"
                    onClick={() => setStage({ kind: "paid-method" })}
                    className="font-semibold text-brand-teal-dark underline"
                  >
                    Abrir o passo a passo urgente
                  </button>{" "}
                  — banco primeiro, depois boletim de ocorrência e registros.
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" onClick={back} className="text-sm font-medium text-brand-muted underline">
                ← Revisar respostas
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="rounded-lg border border-brand-border bg-white px-4 py-2 text-sm font-medium text-brand-navy hover:bg-brand-surface-soft"
              >
                Limpar verificação
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <p className="mt-6 rounded-lg border border-brand-warning/30 bg-brand-warning-soft p-4 text-sm leading-relaxed text-brand-warning">
        Ferramenta educativa de prevenção. Ela identifica sinais descritos em orientações oficiais —
        não determina que uma proposta seja ou não fraude. Um único sinal não prova golpe. A
        ausência desses sinais não garante que a oferta seja segura.
      </p>
    </section>
  );
}
