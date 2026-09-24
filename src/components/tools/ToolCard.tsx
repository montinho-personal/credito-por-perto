import Link from "next/link";
import type { Tool } from "@/lib/tools/registry";
import { ToolIcon } from "./ToolIcon";

/**
 * O card da central: ícone do tipo, nome, o que a pessoa vai descobrir, uma
 * característica útil e um verbo específico. Nada de "saiba mais", nada de
 * recomendação. Quem lê o card sabe o que vai encontrar antes de clicar.
 *
 * O `<h3>` só entra dentro das seções de categoria (H2 acima); nos destaques
 * e nos caminhos o nome é um `<span>` para não criar hierarquia falsa.
 */
export function ToolCard({
  tool,
  heading = false,
  compact = false,
}: {
  tool: Tool;
  heading?: boolean;
  compact?: boolean;
}) {
  const Name = heading ? "h3" : "span";
  return (
    <Link
      href={tool.route}
      data-track={tool.id}
      className="flex h-full flex-col rounded-xl border border-brand-border bg-white p-4 transition hover:border-brand-teal hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy sm:p-5"
    >
      <span className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-teal-soft text-brand-navy">
          <ToolIcon type={tool.type} className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <Name className="block font-serif text-lg font-bold leading-snug text-brand-navy">{tool.name}</Name>
          <span className="mt-1 block text-sm leading-relaxed text-brand-muted">{compact ? tool.question : tool.whenItHelps}</span>
        </span>
      </span>
      <span className="mt-3 flex flex-1 flex-wrap items-end justify-between gap-x-3 gap-y-1">
        <span className="text-xs text-brand-muted">{tool.badge}</span>
        <span className="text-sm font-semibold text-brand-teal-dark">
          {tool.cta} <span aria-hidden="true">→</span>
        </span>
      </span>
    </Link>
  );
}
