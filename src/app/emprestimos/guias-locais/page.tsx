import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { getPublishedLocalGuides, getAllLocalGuides } from "@/lib/content/local";
import { getStateByCode } from "@/lib/local-seo/states";
import { LocalGuideCard } from "@/components/ui/cards";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";

export const metadata: Metadata = buildMetadata({
  title: "Guias locais de empréstimos: informação verificada por cidade",
  description:
    "Guias de empréstimos por estado e cidade com canais de proteção ao consumidor, atendimento verificado e cuidados específicos de cada localidade.",
  path: "/emprestimos/guias-locais/",
});

export default function GuiasLocaisPage() {
  const published = getPublishedLocalGuides();
  const statesWithGuides = [
    ...new Set(getAllLocalGuides().map((g) => g.frontmatter.stateCode)),
  ]
    .map((code) => getStateByCode(code))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: "Empréstimos", path: "/emprestimos/" },
          { name: "Guias locais", path: "/emprestimos/guias-locais/" },
        ]}
      />
      <h1 className="mt-6 font-serif text-3xl font-bold text-brand-navy md:text-4xl">
        Guias de empréstimos por localidade
      </h1>
      <p className="mt-3 max-w-2xl text-lg leading-relaxed text-brand-muted">
        Um guia local só entra no ar quando traz valor real para quem mora na
        região: canais oficiais de proteção ao consumidor, formas de atendimento
        verificadas e cuidados específicos — nunca um texto genérico com o nome
        da cidade trocado.
      </p>

      <section aria-labelledby="publicados" className="mt-10">
        <h2 id="publicados" className="font-serif text-2xl font-bold text-brand-navy">
          Guias publicados
        </h2>
        {published.length > 0 ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {published.map((guide) => (
              <LocalGuideCard
                key={guide.urlPath}
                title={guide.frontmatter.localityName}
                description={guide.frontmatter.description}
                href={guide.urlPath}
              />
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-xl border border-brand-border bg-brand-surface-soft p-6 text-brand-muted">
            Os primeiros guias locais — Campinas (SP), Barueri (SP) e região de
            Alphaville — estão em fase final de verificação de fontes oficiais.
            Publicamos cada um somente após a checagem completa, seguindo nossa{" "}
            <Link href="/metodologia/" className="font-medium text-brand-teal-dark underline">
              metodologia
            </Link>
            .
          </p>
        )}
      </section>

      {statesWithGuides.length > 0 ? (
        <section aria-labelledby="estados" className="mt-10">
          <h2 id="estados" className="font-serif text-2xl font-bold text-brand-navy">
            Estados com guias em produção
          </h2>
          <ul className="mt-4 flex flex-wrap gap-3">
            {statesWithGuides.map((state) => (
              <li key={state.code}>
                <Link
                  href={`/emprestimos/${state.code}/`}
                  className="inline-block rounded-lg border border-brand-border px-4 py-2 font-medium text-brand-navy hover:bg-brand-surface-soft"
                >
                  {state.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section
        aria-labelledby="criterios"
        className="mt-10 rounded-2xl border border-brand-border bg-white p-6"
      >
        <h2 id="criterios" className="font-serif text-xl font-bold text-brand-navy">
          Como decidimos publicar um guia local
        </h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 leading-relaxed text-brand-text">
          <li>Classificação administrativa da localidade confirmada em fonte oficial;</li>
          <li>Canais de proteção ao consumidor (Procon e afins) verificados, com data;</li>
          <li>Pelo menos um recurso local acionável para quem mora na região;</li>
          <li>Conteúdo que não dependa da simples troca do nome da cidade;</li>
          <li>Aprovação nas auditorias internas de originalidade e canonical.</li>
        </ul>
        <p className="mt-3 text-sm text-brand-muted">
          Guias que não cumprem esses critérios permanecem como rascunho, fora
          do índice e fora dos mecanismos de busca.
        </p>
      </section>
    </div>
  );
}
