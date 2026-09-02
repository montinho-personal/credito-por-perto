/**
 * O acordeão de perguntas frequentes.
 *
 * Construído sobre `<details>`/`<summary>` nativos, e não sobre estado em
 * React, por três razões que decidem o resultado:
 *
 * - FUNCIONA SEM JAVASCRIPT. As 87 páginas com FAQ são estáticas; abrir uma
 *   pergunta não deveria depender de um bundle carregar;
 * - JÁ VEM ACESSÍVEL. Foco, Enter/Espaço, papel de botão, estado
 *   expandido/recolhido anunciado por leitor de tela — tudo nativo. Um
 *   acordeão feito à mão precisaria reimplementar isso, e quase sempre
 *   reimplementa errado;
 * - NÃO ESCONDE O CONTEÚDO DO BUSCADOR. `<details>` fechado é conteúdo
 *   presente no HTML, apenas não pintado. A resposta continua no documento
 *   servido, encontrável inclusive pela busca do próprio navegador.
 *
 * A pergunta continua sendo um `<h3>` com o mesmo id que tinha antes do
 * acordeão — o HTML permite heading dentro de `<summary>`, e isso preserva a
 * hierarquia de títulos e as âncoras que já existiam.
 */
import type { ReactNode } from "react";
import { FaqHashOpener } from "@/components/content/FaqHashOpener";

export function FaqAccordion({ children }: { children: ReactNode }) {
  return (
    <div className="not-prose my-6 overflow-hidden rounded-2xl border border-brand-border bg-white">
      <FaqHashOpener />
      {children}
    </div>
  );
}

export function FaqItem({
  question,
  id,
  children,
}: {
  question: string;
  id: string;
  children: ReactNode;
}) {
  return (
    <details
      id={id}
      /* Lido pelo ouvinte de `toggle` em ClickTracking: só `<details>` com
         esta marca vira `faq_open`. Sem ela, qualquer bloco recolhível do
         site (explicação de fórmula, opções avançadas) entraria no mesmo
         relatório e o número deixaria de significar "dúvida aberta". */
      data-track-kind="faq"
      className="group border-b border-brand-border last:border-b-0 [&[open]]:bg-brand-surface-soft/40"
    >
      <summary
        /* list-none + ::-webkit-details-marker remove o triângulo padrão, que
           é pequeno demais para servir de alvo de toque e não indica bem o
           estado. O sinal fica por conta do ícone à direita. */
        className="flex cursor-pointer list-none items-start justify-between gap-4 px-4 py-4 transition-colors hover:bg-brand-surface-soft/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-navy md:px-5 [&::-webkit-details-marker]:hidden"
      >
        <h3 className="m-0 font-serif text-base font-bold leading-snug text-brand-navy md:text-lg">
          {question}
        </h3>
        <span
          aria-hidden="true"
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-brand-border text-brand-teal-dark transition-transform duration-200 group-open:rotate-45"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M8 3v10M3 8h10" />
          </svg>
        </span>
      </summary>
      <div className="article-body px-4 pb-5 pt-0 md:px-5">{children}</div>
    </details>
  );
}
