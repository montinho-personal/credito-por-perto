"use client";

import { useCallback, useRef } from "react";

/**
 * Leva a pessoa até o resultado da ferramenta.
 *
 * Por que existe: em todas as calculadoras o resultado nasce ABAIXO do
 * botão. No celular, clicar em "calcular" não muda nada visível — parece
 * que a ferramenta travou. Foi exatamente o que aconteceu no Plano para
 * sair das dívidas.
 *
 * O que faz, nesta ordem:
 * 1. espera o React pintar o resultado;
 * 2. rola o contêiner até o topo da área visível (o CSS `scroll-mt-*` no
 *    contêiner cuida do header fixo);
 * 3. move o foco para o título do resultado quando ele é focalizável
 *    (`[data-result-heading]` com tabIndex -1), para que leitores de tela
 *    anunciem o resultado — com `preventScroll` para não brigar com o
 *    posicionamento do passo 2.
 *
 * Respeita `prefers-reduced-motion`: sem rolagem suave para quem pediu
 * menos animação.
 */
export function useRevealResult<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);

  const reveal = useCallback(() => {
    // Em várias ferramentas o contêiner do resultado é condicional: ele só
    // existe no DOM depois que o React confirma o novo estado. Por isso
    // tentamos por alguns quadros em vez de uma vez só — foi o que fez a
    // calculadora de margem falhar quando a rolagem era agendada uma vez.
    const attempt = (remaining: number) => {
      const current = ref.current;
      if (!current) {
        if (remaining > 0) window.requestAnimationFrame(() => attempt(remaining - 1));
        return;
      }
      // Salto instantâneo, de propósito: a distância chega a 2.600 px em
      // ferramentas longas. Rolagem suave nesse tamanho demora segundos,
      // qualquer toque a interrompe no meio e a pessoa fica perdida — além
      // de não servir a quem pediu menos animação no sistema.
      current.scrollIntoView({ behavior: "auto", block: "start" });
      const heading = current.querySelector<HTMLElement>("[data-result-heading]");
      heading?.focus({ preventScroll: true });
    };
    window.requestAnimationFrame(() => attempt(10));
  }, []);

  return { ref, reveal };
}
