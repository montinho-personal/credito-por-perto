import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { CategoryHub } from "@/components/content/CategoryHub";

export const metadata: Metadata = buildMetadata({
  title: "Empréstimos: guias por modalidade, custos e cuidados",
  description:
    "Guias independentes sobre empréstimo pessoal, consignado, FGTS, crédito com garantia e para negativados: como funciona, quanto custa e o que comparar.",
  path: "/emprestimos/",
});

export default function EmprestimosPage() {
  return (
    <CategoryHub
      category="emprestimos"
      intro="Antes de contratar qualquer empréstimo, vale entender como a modalidade funciona, o que encarece a parcela e quais cuidados evitar. Os guias abaixo explicam cada modalidade sem promessa de aprovação — porque o Crédito Por Perto não concede crédito, apenas explica."
    >
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/calculadoras/emprestimo/"
          className="rounded-lg bg-brand-teal-dark px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-teal"
        >
          Calcular parcelas
        </Link>
        <Link
          href="/emprestimos/guias-locais/"
          className="rounded-lg border border-brand-border px-5 py-2.5 text-sm font-semibold text-brand-navy hover:bg-brand-surface-soft"
        >
          Guias por localidade
        </Link>
      </div>
    </CategoryHub>
  );
}
