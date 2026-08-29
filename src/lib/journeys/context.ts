/**
 * CONTEXTO DE JORNADA — O QUE PODE SER LEMBRADO
 * ============================================================================
 *
 * A Central precisa saber, na página da ferramenta, de onde a pessoa veio —
 * senão o "próximo passo" volta a ser genérico. O jeito fácil seria carregar
 * isso na URL (`?jornada=varias-dividas`). Não fazemos, por dois motivos:
 *
 * 1. A URL vaza. Ela entra em `document.referrer`, em logs de servidor, no
 *    relatório de páginas do GA4 e no histórico compartilhado do navegador.
 *    "Está com várias dívidas" viraria um dado registrado em quatro lugares
 *    que ninguém revisa;
 * 2. Ela duplica endereço. Cada variante de query é uma URL a mais para o
 *    buscador considerar numa página que já tem canônica.
 *
 * Então o contexto vive em `sessionStorage`, morre ao fechar a aba, e guarda
 * SOMENTE IDs de navegação:
 *
 *     { journeyId: "varias-dividas", completedIds: ["plano-para-sair-das-dividas"] }
 *
 * O que ele NUNCA guarda: renda, saldo, taxa, prazo, valor de parcela, nome
 * de instituição, cidade — nada que a pessoa tenha digitado. As ferramentas
 * calculam no navegador e não persistem nada; esta camada não muda isso.
 *
 * Um id de jornada ainda descreve uma situação ("estou com dívidas"), e por
 * isso ele fica no armazenamento de SESSÃO, não em `localStorage`: some
 * sozinho, sem depender de a pessoa lembrar de limpar. E `clearJourney()`
 * alimenta o botão de apagar progresso, que a interface sempre oferece.
 */

export const JOURNEY_STORAGE_KEY = "cpp.journey.v1";

export interface JourneyContext {
  journeyId: string;
  completedIds: string[];
}

/** Aceita apenas o formato esperado — storage antigo ou adulterado é descartado. */
export function parseJourneyContext(raw: string | null): JourneyContext | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    const journeyId = record.journeyId;
    if (typeof journeyId !== "string" || journeyId.length === 0) return null;
    const completed = Array.isArray(record.completedIds)
      ? record.completedIds.filter((v): v is string => typeof v === "string")
      : [];
    return { journeyId, completedIds: completed };
  } catch {
    return null;
  }
}

/**
 * `sessionStorage` não dispara `storage` na aba que escreveu — só nas outras.
 * Sem este aviso, um componente que já está montado continuaria mostrando o
 * estado anterior depois de a própria página gravar. A importação é dinâmica
 * para manter este módulo utilizável fora do React (testes incluídos).
 */
function notify(): void {
  if (typeof window === "undefined") return;
  void import("@/lib/journeys/use-journey-context").then((m) =>
    m.notifyJourneyChange(),
  );
}

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    /* Navegador com armazenamento bloqueado: a Central segue funcionando,
       apenas sem lembrar a jornada. Nenhum recurso depende disso. */
    return null;
  }
}

export function readJourneyContext(): JourneyContext | null {
  const store = storage();
  if (!store) return null;
  return parseJourneyContext(store.getItem(JOURNEY_STORAGE_KEY));
}

/**
 * Garante que a jornada em curso é esta.
 *
 * Só zera o progresso quando a pessoa TROCA de jornada. A versão ingênua
 * ("sempre grava um contexto novo") apagaria os passos já percorridos toda
 * vez que alguém voltasse à Central para pegar o passo seguinte — que é
 * exatamente o uso previsto.
 */
export function startJourney(journeyId: string): void {
  const store = storage();
  if (!store) return;
  const current = readJourneyContext();
  if (current?.journeyId === journeyId) return;
  const value: JourneyContext = { journeyId, completedIds: [] };
  store.setItem(JOURNEY_STORAGE_KEY, JSON.stringify(value));
  notify();
}

/** Marca um passo como percorrido. Idempotente e limitado — ver comentário. */
export function markStepDone(id: string): void {
  const store = storage();
  if (!store) return;
  const current = readJourneyContext();
  if (!current) return;
  if (current.completedIds.includes(id)) return;
  const next: JourneyContext = {
    journeyId: current.journeyId,
    /* Teto defensivo: uma jornada tem no máximo seis passos, então uma lista
       maior que isso significa dado corrompido, não uso intenso. */
    completedIds: [...current.completedIds, id].slice(-12),
  };
  store.setItem(JOURNEY_STORAGE_KEY, JSON.stringify(next));
  notify();
}

export function clearJourney(): void {
  const store = storage();
  if (!store) return;
  store.removeItem(JOURNEY_STORAGE_KEY);
  notify();
}
