import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { webPageJsonLd } from "@/lib/schema/jsonld";

export function InstitutionalShell({
  title,
  description,
  path,
  intro,
  children,
}: {
  title: string;
  description: string;
  path: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <JsonLd data={webPageJsonLd(title, description, path)} />
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: title, path },
        ]}
      />
      <h1 className="mt-6 font-serif text-3xl font-bold text-brand-navy md:text-4xl">
        {title}
      </h1>
      {intro ? (
        <p className="mt-3 text-lg leading-relaxed text-brand-muted">{intro}</p>
      ) : null}
      <div className="article-body mt-8">{children}</div>
    </div>
  );
}

/** Aviso público de que um documento legal ainda é um template em revisão. */
export function LegalTemplateNotice() {
  return (
    <div className="my-6 rounded-xl border border-brand-warning/40 bg-brand-warning-soft p-5 text-sm leading-relaxed text-brand-warning">
      <p>
        <strong>Documento em elaboração:</strong> este texto é uma versão
        preliminar, pendente de revisão jurídica e do preenchimento dos dados do
        responsável pelo portal. Ele será atualizado antes do lançamento oficial.
      </p>
    </div>
  );
}
