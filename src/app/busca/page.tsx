import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { SearchClient } from "@/components/search/SearchClient";

export const metadata: Metadata = buildMetadata({
  title: "Busca no Crédito Por Perto",
  description:
    "Encontre guias sobre empréstimos, juros, CET, segurança contra golpes e organização financeira no Crédito Por Perto.",
  path: "/busca/",
  noindex: true,
});

export default function BuscaPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: "Busca", path: "/busca/" },
        ]}
      />
      <h1 className="mt-6 font-serif text-3xl font-bold text-brand-navy">
        Buscar no site
      </h1>
      <p className="mt-2 text-brand-muted">
        A busca acontece no seu navegador, sobre o índice de conteúdos
        publicados — nada do que você digita é enviado ao servidor.
      </p>
      <div className="mt-6">
        <SearchClient />
      </div>
    </div>
  );
}
