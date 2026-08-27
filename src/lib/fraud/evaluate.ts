/**
 * Motor determinístico da verificação de sinais de golpe.
 * Respostas estruturadas → sinais conhecidos, ordenados por severidade.
 * Sem score exibido, sem probabilidade, sem veredito.
 */

import {
  FRAUD_QUESTIONS,
  type AnswerValue,
  type FraudQuestion,
  type Severity,
} from "./signal-registry";

export type AnswerMap = Partial<Record<string, AnswerValue>>;

export type HeadlineKind =
  | "critical"
  | "multiple_high"
  | "some_signals"
  | "no_main_signals";

export interface FraudEvaluation {
  /** Sinais acesos, do mais severo para o mais leve */
  signals: FraudQuestion[];
  counts: Record<Severity, number>;
  headline: HeadlineKind;
}

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];

export function evaluateAnswers(answers: AnswerMap): FraudEvaluation {
  const signals = FRAUD_QUESTIONS.filter((q) => {
    const answer = answers[q.id];
    return answer !== undefined && q.trigger.includes(answer);
  }).sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );

  const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const s of signals) counts[s.severity] += 1;

  let headline: HeadlineKind;
  if (counts.critical > 0) headline = "critical";
  else if (counts.high >= 2) headline = "multiple_high";
  else if (signals.length > 0) headline = "some_signals";
  else headline = "no_main_signals";

  return { signals, counts, headline };
}

export const HEADLINE_COPY: Record<HeadlineKind, { title: string; body: string }> = {
  critical: {
    title: "Pare antes de enviar dinheiro ou códigos",
    body: "Suas respostas incluem pelo menos um sinal que aparece nos golpes mais comuns de empréstimo. Verifique a situação com calma antes de qualquer pagamento ou envio de dados.",
  },
  multiple_high: {
    title: "Há vários pontos que merecem verificação",
    body: "Mais de um sinal relevante apareceu nas suas respostas. Vale conferir cada ponto abaixo antes de continuar a conversa.",
  },
  some_signals: {
    title: "Alguns pontos merecem atenção",
    body: "Nenhum sinal isolado prova um golpe — mas os pontos abaixo valem verificação antes de você seguir.",
  },
  no_main_signals: {
    title: "Não encontramos os principais sinais avaliados",
    body: "Isso não prova que a oferta seja legítima. Ainda assim, confirme a instituição e os canais oficiais antes de enviar dinheiro ou dados.",
  },
};

/** Rótulos de interface por severidade — sem termos alarmistas. */
export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Importante",
  high: "Atenção",
  medium: "Verifique",
  low: "Contexto",
};
