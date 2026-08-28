/**
 * Chamada de ferramenta dentro de um artigo.
 *
 * O autor escreve apenas `<ToolCallout id="margem-consignavel" />`. Nome,
 * rota, pergunta e CTA vêm do registry — três consequências práticas:
 *
 * - a mesma ferramenta é apresentada com a mesma promessa em todo lugar;
 * - renomear ou mover uma ferramenta não deixa link quebrado para trás;
 * - a auditoria de cobertura consegue enxergar a chamada pelo id, sem
 *   depender de casar o texto do link.
 *
 * O bloco é deliberadamente sóbrio e nunca promete resultado: ele diz que
 * pergunta a ferramenta responde, não que decisão o leitor deve tomar.
 */
import Link from "next/link";
import { getTool } from "@/lib/tools/registry";

export function ToolCallout({ id, note }: { id: string; note?: string }) {
  const tool = getTool(id);
  if (!tool) {
    throw new Error(
      `ToolCallout: ferramenta "${id}" não existe em data/tool-registry.json.`,
    );
  }

  return (
    <aside
      className="not-prose my-6 rounded-xl border border-brand-teal/30 bg-brand-teal-soft/40 p-4"
      aria-label={`Ferramenta: ${tool.name}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-teal-dark">
        Ferramenta que ajuda aqui
      </p>
      <p className="mt-2 font-serif text-base font-bold leading-snug text-brand-navy">
        {tool.question}
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-brand-text">
        {note ?? tool.calloutLead}
      </p>
      <Link
        href={tool.route}
        /* !no-underline e !text-white derrubam o estilo de link em prosa de
           `.article-body a`, que transformava o botão em texto sublinhado. */
        className="mt-3 inline-flex items-center gap-1 rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold !text-white !no-underline transition hover:bg-brand-navy/90 hover:!text-white"
      >
        {tool.cta}
        <span aria-hidden="true">→</span>
      </Link>
      <p className="mt-2 text-xs text-brand-muted">
        Sem cadastro e sem CPF — nada do que você digitar sai do seu aparelho.
      </p>
    </aside>
  );
}
