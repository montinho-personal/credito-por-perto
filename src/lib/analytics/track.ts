/**
 * O ÚNICO PONTO DE SAÍDA DE EVENTO
 * ============================================================================
 *
 * Antes deste arquivo existiam 14 cópias do mesmo helper:
 *
 *     function gtag(...args: unknown[]) {
 *       if (typeof window === "undefined") return;
 *       const w = window as GtagWindow;
 *       if (typeof w.gtag === "function") w.gtag(...args);
 *     }
 *
 * Catorze cópias não é um problema de estética. É que qualquer regra nova —
 * redigir valor, validar nome, ligar depuração — teria de ser escrita catorze
 * vezes, e bastaria esquecer uma para que a regra deixasse de valer sem que
 * nada avisasse. A décima quinta cópia nasceria no próximo componente.
 *
 * Aqui a regra é escrita uma vez e vale para tudo:
 *
 *   1. sem `window` (SSR), não faz nada;
 *   2. sem consentimento não existe `window.gtag`, então nada sai — a LGPD é
 *      respeitada pela ausência do script, não por um `if` que alguém pode
 *      remover;
 *   3. parâmetro passa pelo redator antes de sair;
 *   4. nome fora do dicionário e parâmetro fora da especificação viram aviso
 *      no console durante o desenvolvimento, e `pnpm audit:analytics` quebra
 *      o build antes de chegar em produção;
 *   5. modo de depuração mostra na tela, para conferência, o que sairia.
 *
 * FALHA ABERTA, DE PROPÓSITO
 *
 * Um evento não declarado ainda é enviado em produção, com aviso. A auditoria
 * já impede que ele exista lá; se algo escapar, perder o dado seria pior que
 * recebê-lo fora do dicionário — dado perdido não se recupera depois.
 */
import { findEvent, isRegisteredEvent } from "./event-registry";
import { redactParams, type ParamValue } from "./redact";

interface GtagWindow extends Window {
  gtag?: (...args: unknown[]) => void;
  /** Ligado pela pessoa que está conferindo a medição. */
  __cppTrackDebug?: boolean;
}

const DEBUG_KEY = "cpp-track-debug";

function isDev(): boolean {
  return process.env.NODE_ENV !== "production";
}

function debugEnabled(w: GtagWindow): boolean {
  if (w.__cppTrackDebug) return true;
  try {
    return w.localStorage.getItem(DEBUG_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Liga ou desliga o modo de conferência. Chamado pelo `TrackDebugToggle`,
 * que lê `?cpp_debug=1` da URL — o jeito de auditar a medição em produção
 * sem instalar extensão nem abrir o GA4.
 */
export function setTrackDebug(on: boolean): void {
  if (typeof window === "undefined") return;
  const w = window as GtagWindow;
  w.__cppTrackDebug = on;
  try {
    if (on) w.localStorage.setItem(DEBUG_KEY, "1");
    else w.localStorage.removeItem(DEBUG_KEY);
  } catch {
    /* Sem armazenamento: vale só para esta página. */
  }
}

function warn(message: string, detail?: unknown): void {
  if (!isDev()) return;
  console.warn(`[analytics] ${message}`, detail ?? "");
}

/**
 * Envia um evento.
 *
 * @param name  Nome declarado em `event-registry.ts`.
 * @param params Parâmetros. Chave proibida é recusada; texto é redigido.
 */
export function track(name: string, params?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  const w = window as GtagWindow;

  const spec = findEvent(name);
  if (!spec) warn(`evento "${name}" não está em event-registry.ts`);

  const { params: clean, dropped } = redactParams(params);
  if (dropped.length > 0) {
    warn(`parâmetros recusados em "${name}": ${dropped.join(", ")}`);
  }

  /* Parâmetro fora da especificação é removido: o GA4 limita as dimensões
     personalizadas por propriedade, e parâmetro que ninguém registrou lá não
     aparece em relatório nenhum — só ocupa vaga. */
  const final: Record<string, ParamValue> = {};
  for (const [key, value] of Object.entries(clean)) {
    if (spec && !spec.params.includes(key)) {
      warn(`parâmetro "${key}" não previsto para "${name}"`);
      continue;
    }
    final[key] = value;
  }

  if (debugEnabled(w)) {
    console.info(
      `%c[track]%c ${name}`,
      "background:#0D3B66;color:#fff;padding:1px 4px;border-radius:3px",
      "font-weight:600",
      final,
    );
  }

  if (typeof w.gtag === "function") {
    w.gtag("event", name, final);
  }
}

/** Só para teste e auditoria: o dicionário conhece este nome? */
export const isKnownEvent = isRegisteredEvent;
