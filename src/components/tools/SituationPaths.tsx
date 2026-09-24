"use client";

/**
 * "O QUE VOCÊ QUER RESOLVER?"
 * ============================================================================
 *
 * A segunda porta da central, para quem não sabe o nome da conta que
 * resolve a dúvida: reconhece a situação ("vou financiar um veículo") e vê
 * dois a quatro passos, na ordem, mais o caminho completo na Central de
 * Decisões.
 *
 * Todos os painéis estão no HTML do servidor (os fechados com `hidden`):
 * o buscador enxerga todos os links, e o JavaScript só troca qual painel
 * aparece. Sem JavaScript, o primeiro caminho fica aberto e o catálogo
 * completo continua logo abaixo.
 */

import Link from "next/link";
import { useId, useState } from "react";
import { track } from "@/lib/analytics/track";
import type { ToolType } from "@/lib/tools/registry";
import { ToolIcon } from "./ToolIcon";

export interface PathView {
  id: string;
  label: string;
  lead: string;
  journeyHref: string;
  tools: Array<{ id: string; name: string; route: string; question: string; cta: string; type: ToolType }>;
}

export function SituationPaths({ paths, headingId }: { paths: PathView[]; headingId: string }) {
  const uid = useId();
  const [active, setActive] = useState(paths[0]?.id ?? "");

  function choose(id: string) {
    setActive(id);
    track("decision_path_click", { path: id });
  }

  return (
    <div data-track-area="caminhos-ferramentas" data-track-event="calculator_card_click">
      <div role="tablist" aria-labelledby={headingId} className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {paths.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            id={`${uid}-aba-${p.id}`}
            aria-selected={active === p.id}
            aria-controls={`${uid}-painel-${p.id}`}
            onClick={() => choose(p.id)}
            data-track-ignore
            className="min-h-11 shrink-0 rounded-full border border-brand-border bg-white px-4 text-sm font-semibold text-brand-navy transition hover:border-brand-teal aria-selected:border-brand-navy aria-selected:bg-brand-navy aria-selected:text-white"
          >
            {p.label}
          </button>
        ))}
      </div>
      {paths.map((p) => (
        <div
          key={p.id}
          role="tabpanel"
          id={`${uid}-painel-${p.id}`}
          aria-labelledby={`${uid}-aba-${p.id}`}
          hidden={active !== p.id}
          className="mt-4 rounded-2xl border border-brand-border bg-brand-surface-soft p-4 sm:p-5"
        >
          <p className="text-sm leading-relaxed text-brand-muted">{p.lead}</p>
          <ol className="mt-3 grid gap-2 sm:grid-cols-2">
            {p.tools.map((t, i) => (
              <li key={t.id}>
                <Link
                  href={t.route}
                  data-track={t.id}
                  className="flex h-full items-start gap-3 rounded-xl border border-brand-border bg-white p-3 transition hover:border-brand-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy"
                >
                  <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-teal-soft text-sm font-bold text-brand-navy" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 font-semibold leading-snug text-brand-navy">
                      <ToolIcon type={t.type} className="h-4 w-4 shrink-0 text-brand-teal-dark" />
                      {t.name}
                    </span>
                    <span className="block text-sm text-brand-muted">{t.question}</span>
                    <span className="mt-1 block text-xs font-semibold text-brand-teal-dark">{t.cta} →</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-sm">
            <Link href={p.journeyHref} className="font-semibold text-brand-teal-dark underline underline-offset-2">
              Ver o caminho completo na Central de Decisões
            </Link>
            <span className="text-brand-muted"> · cada passo é opcional; nenhum é obrigatório.</span>
          </p>
        </div>
      ))}
    </div>
  );
}
