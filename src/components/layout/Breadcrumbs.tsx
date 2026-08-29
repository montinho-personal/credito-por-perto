import Link from "next/link";
import { breadcrumbJsonLd, type BreadcrumbItem } from "@/lib/schema/jsonld";
import { JsonLd } from "@/components/seo/JsonLd";

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Você está em" className="text-sm text-brand-muted">
      <JsonLd data={breadcrumbJsonLd(items)} />
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={item.path} className="flex items-center gap-1">
              {index > 0 ? (
                <span aria-hidden="true" className="text-brand-border">
                  /
                </span>
              ) : null}
              {isLast ? (
                <span aria-current="page" className="font-medium text-brand-navy">
                  {item.name}
                </span>
              ) : (
                /* py-1 leva o alvo de toque a 24px (WCAG 2.2, 2.5.8) sem
                   mudar a altura visual da trilha, que já tem gap próprio. */
                <Link
                  href={item.path}
                  className="inline-block py-1 hover:text-brand-teal-dark hover:underline"
                >
                  {item.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
