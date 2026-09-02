"use client";

import { useEffect } from "react";
import { track, setTrackDebug } from "@/lib/analytics/track";
import { buildClickEvent, type ClickDescriptor } from "@/lib/analytics/click-model";
import { pageTypeFor } from "@/lib/analytics/click-model";

/**
 * OUVINTE ÚNICO DE CLIQUE
 * ==========================================================================
 *
 * Um `addEventListener` no documento cobre o site inteiro: os 90 botões e 189
 * links dos componentes, e — o que nenhuma outra abordagem alcança — os links
 * dentro do texto dos artigos e guias, que são MDX e não têm onde pendurar um
 * `onClick`.
 *
 * É exatamente ali que estão as saídas para Banco Central, Planalto,
 * consumidor.gov e prefeituras: o desfecho que mais importa num portal que
 * não vende nada. Sem delegação, essas saídas ficariam invisíveis para
 * sempre.
 *
 * FASE DE CAPTURA
 *
 * O ouvinte usa `capture: true` para ver o clique antes de qualquer
 * `stopPropagation` de um componente. Medição que depende do bom
 * comportamento do resto do código não é medição, é torcida.
 *
 * `auxclick` TAMBÉM
 *
 * Abrir em nova aba (clique do meio, ou Ctrl/Cmd+clique) é uso deliberado e
 * frequente em link de fonte oficial — a pessoa quer conferir sem perder o
 * lugar no texto. Contar só o clique esquerdo subestimaria justamente o
 * comportamento de quem mais confere.
 */

const ACTIONABLE = "a, button, summary, [role='button']";

/** Texto do elemento, com recuo para quando o botão é só um ícone. */
function labelOf(el: HTMLElement): string {
  const aria = el.getAttribute("aria-label");
  if (aria && aria.trim()) return aria.trim();
  const text = (el.innerText || el.textContent || "").trim();
  if (text) return text;
  const title = el.getAttribute("title");
  if (title && title.trim()) return title.trim();
  const img = el.querySelector("img[alt]");
  const alt = img?.getAttribute("alt");
  return alt?.trim() ?? "";
}

/** Posição na lista: declarada, ou o índice do `<li>` que envolve o clique. */
function positionOf(el: HTMLElement): number | null {
  const declared = el.closest<HTMLElement>("[data-track-position]");
  if (declared) {
    const n = Number(declared.dataset.trackPosition);
    if (Number.isInteger(n) && n > 0) return n;
  }
  const li = el.closest("li");
  if (li?.parentElement) {
    const index = Array.from(li.parentElement.children).indexOf(li);
    if (index >= 0) return index + 1;
  }
  return null;
}

function describe(el: HTMLElement): ClickDescriptor {
  const tagName = el.tagName.toLowerCase();
  const tag: ClickDescriptor["tag"] =
    tagName === "a" || tagName === "button" || tagName === "summary"
      ? tagName
      : "other";

  const areaEl = el.closest<HTMLElement>("[data-track-area]");
  const componentEl = el.closest<HTMLElement>("[data-track]");
  const labelEl = el.closest<HTMLElement>("[data-track-label]");
  const eventEl = el.closest<HTMLElement>("[data-track-event]");

  return {
    tag,
    href: el.getAttribute("href"),
    text: labelOf(el),
    area: areaEl?.dataset.trackArea ?? null,
    component: componentEl?.dataset.track ?? null,
    labelOverride: labelEl?.dataset.trackLabel ?? null,
    eventOverride: eventEl?.dataset.trackEvent ?? null,
    position: positionOf(el),
    pathname: window.location.pathname,
    origin: window.location.origin,
  };
}

export function ClickTracking() {
  useEffect(() => {
    /* `?cpp_debug=1` liga a conferência; `?cpp_debug=0` desliga. Permite
       auditar a medição em produção sem extensão e sem abrir o GA4. */
    const flag = new URLSearchParams(window.location.search).get("cpp_debug");
    if (flag === "1") setTrackDebug(true);
    if (flag === "0") setTrackDebug(false);

    function onClick(event: MouseEvent) {
      /* Botão direito não navega. Middle (1) e esquerdo (0) contam. */
      if (event.type === "auxclick" && event.button !== 1) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const el = target.closest<HTMLElement>(ACTIONABLE);
      if (!el) return;
      if (el.closest("[data-track-ignore]")) return;
      if (el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true") {
        return;
      }

      const built = buildClickEvent(describe(el));
      if (built) track(built.name, built.params);
    }

    /* `toggle` não borbulha; a captura alcança o alvo mesmo assim. */
    function onToggle(event: Event) {
      const el = event.target;
      if (!(el instanceof HTMLDetailsElement) || !el.open) return;
      if (el.closest("[data-track-ignore]")) return;
      const summary = el.querySelector("summary");
      if (!summary) return;
      if (el.dataset.trackKind !== "faq") return;

      track("faq_open", {
        question: labelOf(summary as HTMLElement),
        page_type: pageTypeFor(window.location.pathname),
        position: positionOf(el) ?? undefined,
      });
    }

    document.addEventListener("click", onClick, true);
    document.addEventListener("auxclick", onClick, true);
    document.addEventListener("toggle", onToggle, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("auxclick", onClick, true);
      document.removeEventListener("toggle", onToggle, true);
    };
  }, []);

  return null;
}
