/**
 * PIPELINE DE REVERIFICAÇÃO DOS RECURSOS DO MAPA FINANCEIRO
 * ============================================================================
 *
 * O problema que este módulo resolve é de confiança, não de engenharia.
 *
 * Um Procon municipal não deixa de existir porque o portal da prefeitura ficou
 * fora do ar numa terça-feira. Se a checagem automática tratasse "não consegui
 * acessar a fonte" como "o recurso acabou", o mapa apagaria serviços reais e
 * mandaria o leitor para o lugar errado — que é exatamente o dano que uma
 * página de utilidade pública não pode causar.
 *
 * Por isso o pipeline separa três coisas que costumam ser confundidas:
 *
 *   1. FALHA DA FONTE (`source_unavailable`)
 *      A URL não respondeu, deu 5xx, timeout ou bloqueio. Nada foi aprendido
 *      sobre o recurso. Ele continua no ar para o leitor, com a data de
 *      verificação ANTIGA — nunca com data nova.
 *
 *   2. REMOÇÃO CONFIRMADA (`removed`)
 *      A fonte respondeu e disse que o serviço não existe mais (404 estável em
 *      duas rodadas, ou confirmação editorial). Aí sim o recurso sai do mapa.
 *      Um único 404 não basta: exige confirmação em `CONFIRMATIONS_TO_REMOVE`
 *      checagens seguidas.
 *
 *   3. CONFIRMAÇÃO (`active`)
 *      A fonte respondeu e o recurso continua lá. Só neste caso `verifiedAt`
 *      avança.
 *
 * REGRA INEGOCIÁVEL: `verifiedAt` representa uma verificação humana ou
 * automática BEM-SUCEDIDA. Nenhum caminho deste módulo avança essa data sem
 * sucesso real. Uma data de verificação inflada é pior que uma data velha:
 * a velha avisa o leitor, a inflada mente para ele.
 */

import type { FinancialResource, ResourceHealthState } from "@/lib/local/financial-map";

/** Resultado bruto de uma tentativa de checagem de fonte. */
export type CheckOutcome =
  /** Fonte respondeu e o recurso continua descrito lá. */
  | { kind: "confirmed" }
  /** Fonte respondeu e o recurso não está mais lá (404, página removida). */
  | { kind: "gone"; detail?: string }
  /** Não foi possível falar com a fonte (rede, 5xx, timeout, bloqueio). */
  | { kind: "unreachable"; detail?: string };

/** Quantos "gone" seguidos são necessários para remover um recurso do mapa. */
export const CONFIRMATIONS_TO_REMOVE = 2;

export interface CheckContext {
  /** Data da tentativa, ISO (YYYY-MM-DD). */
  attemptedAt: string;
  /**
   * Quantas checagens anteriores consecutivas já retornaram "gone" para este
   * recurso. O chamador mantém o contador; o módulo só decide.
   */
  previousGoneStreak?: number;
}

export interface CheckResult {
  resource: FinancialResource;
  state: ResourceHealthState;
  /** Streak atualizada de "gone" — o chamador persiste para a próxima rodada. */
  goneStreak: number;
  /** True apenas quando `verifiedAt` avançou de fato. */
  verificationAdvanced: boolean;
}

/**
 * Aplica o resultado de uma checagem a um recurso, devolvendo uma cópia.
 * Nunca muta a entrada e nunca avança `verifiedAt` sem sucesso.
 */
export function applyCheckResult(
  resource: FinancialResource,
  outcome: CheckOutcome,
  context: CheckContext,
): CheckResult {
  const previousStreak = context.previousGoneStreak ?? 0;

  if (outcome.kind === "confirmed") {
    return {
      resource: {
        ...resource,
        verifiedAt: context.attemptedAt,
        health: { state: "active", lastCheckAttemptAt: context.attemptedAt },
      },
      state: "active",
      goneStreak: 0,
      verificationAdvanced: true,
    };
  }

  if (outcome.kind === "unreachable") {
    /*
     * Nada foi aprendido sobre o recurso. Preserva verifiedAt e preserva a
     * streak de "gone" — uma falha de rede não zera nem confirma suspeita.
     */
    return {
      resource: {
        ...resource,
        health: {
          state: "source_unavailable",
          lastCheckAttemptAt: context.attemptedAt,
          note: outcome.detail ?? "Fonte oficial não respondeu na última checagem.",
        },
      },
      state: "source_unavailable",
      goneStreak: previousStreak,
      verificationAdvanced: false,
    };
  }

  /* outcome.kind === "gone" */
  const goneStreak = previousStreak + 1;
  const confirmed = goneStreak >= CONFIRMATIONS_TO_REMOVE;
  return {
    resource: {
      ...resource,
      health: {
        state: confirmed ? "removed" : "source_unavailable",
        lastCheckAttemptAt: context.attemptedAt,
        note: confirmed
          ? (outcome.detail ??
            `Recurso ausente da fonte oficial em ${goneStreak} checagens consecutivas.`)
          : `Recurso não localizado na fonte oficial (${goneStreak}ª ocorrência) — aguardando confirmação antes de remover.`,
      },
    },
    state: confirmed ? "removed" : "source_unavailable",
    goneStreak,
    verificationAdvanced: false,
  };
}

/**
 * Aviso mostrado ao leitor quando a fonte não pôde ser reconferida.
 * Não esconde o recurso nem finge que a data é de hoje: diz o que se sabe.
 */
export function stalenessNotice(resource: FinancialResource): string | null {
  if (resource.health?.state !== "source_unavailable") return null;
  return "Não conseguimos reconferir a fonte oficial na última checagem — confirme o horário e o canal antes de se deslocar.";
}
