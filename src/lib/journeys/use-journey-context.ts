"use client";

/**
 * Lê o contexto de jornada como o que ele é: estado de um sistema externo ao
 * React (`sessionStorage`), não estado do componente.
 *
 * A tentação era `useEffect` + `setState`: monta, lê o storage, guarda. Isso
 * funciona e é errado por dois motivos — dispara um render em cascata a cada
 * montagem e, principalmente, faz o React acreditar que o valor nasceu dele.
 * `useSyncExternalStore` resolve os dois: o render do servidor usa
 * `getServerSnapshot` (sempre `null`, porque no servidor não existe sessão),
 * a hidratação bate exatamente com o HTML entregue, e só então o React lê o
 * valor real e re-renderiza uma vez.
 *
 * O snapshot é a STRING crua do storage, não o objeto já parseado. Um objeto
 * novo a cada leitura teria identidade diferente toda vez e o React entraria
 * em loop de re-render; a string é estável enquanto o storage não muda.
 */
import { useSyncExternalStore } from "react";
import { parseJourneyContext, JOURNEY_STORAGE_KEY, type JourneyContext } from "@/lib/journeys/context";

type Listener = () => void;

const listeners = new Set<Listener>();

/** Avisa os componentes montados de uma escrita feita nesta mesma aba. */
export function notifyJourneyChange(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  /* `storage` cobre a mudança feita em OUTRA aba; a própria aba avisa por
     `notifyJourneyChange`, porque o evento nativo não dispara na origem. */
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === JOURNEY_STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): string | null {
  try {
    return window.sessionStorage.getItem(JOURNEY_STORAGE_KEY);
  } catch {
    return null;
  }
}

function getServerSnapshot(): string | null {
  return null;
}

export function useJourneyContext(): JourneyContext | null {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return parseJourneyContext(raw);
}
