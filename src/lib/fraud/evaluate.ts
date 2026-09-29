/**
 * Motor determinístico da verificação de sinais de golpe.
 * Respostas estruturadas → sinais conhecidos, ordenados por severidade.
 * Sem score exibido, sem probabilidade, sem veredito.
 *
 * A severidade é EDITORIAL: ordena os sinais pela gravidade do que eles
 * permitem ao golpista (dinheiro ou acesso à conta primeiro, contexto por
 * último). Não é probabilidade de fraude e não foi calibrada com dados de
 * ocorrência; por isso nunca vira número na interface.
 */

import {
  FRAUD_QUESTIONS,
  type AnswerValue,
  type FraudQuestion,
  type Severity,
} from "./signal-registry";

export type AnswerMap = Partial<Record<string, AnswerValue>>;

export type HeadlineKind =
  | "upfront"
  | "credentials"
  | "critical"
  | "multiple_high"
  | "some_signals"
  | "no_main_signals";

export interface FraudEvaluation {
  /** Sinais acesos, do mais severo para o mais leve */
  signals: FraudQuestion[];
  counts: Record<Severity, number>;
  headline: HeadlineKind;
  /** Quantas perguntas foram respondidas (o resultado pode vir antes do fim). */
  answered: number;
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

  const lit = new Set(signals.map((s) => s.id));
  let headline: HeadlineKind;
  if (lit.has("upfront-payment")) headline = "upfront";
  else if (lit.has("credentials") || lit.has("remote-access")) headline = "credentials";
  else if (counts.critical > 0) headline = "critical";
  else if (counts.high >= 2) headline = "multiple_high";
  else if (signals.length > 0) headline = "some_signals";
  else headline = "no_main_signals";

  const answered = FRAUD_QUESTIONS.filter((q) => answers[q.id] !== undefined).length;
  return { signals, counts, headline, answered };
}

export const HEADLINE_COPY: Record<HeadlineKind, { title: string; body: string }> = {
  upfront: {
    title: "Não pague ainda. Verifique primeiro.",
    body: "Pedido de pagamento como condição para liberar um empréstimo é o sinal mais forte deste checklist. Antes de qualquer Pix, boleto ou depósito, confirme a instituição e o contato pelos canais oficiais.",
  },
  credentials: {
    title: "Não compartilhe códigos nem acesso ao seu aparelho",
    body: "Senha, token, código por SMS ou aplicativo de acesso remoto dão a um terceiro o controle da sua conta. Se você já compartilhou, proteja suas contas agora pelo canal oficial do seu banco.",
  },
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
  critical: "Sinal muito forte",
  high: "Sinal importante",
  medium: "Precisa verificar",
  low: "Contexto: sozinho não prova nada",
};
