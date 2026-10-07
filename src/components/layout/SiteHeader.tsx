import Link from "next/link";
import { MAIN_NAV } from "@/lib/site";
import { Logo } from "@/components/layout/Logo";
import { MobileNavigation } from "@/components/layout/MobileNavigation";
import { SearchTrigger } from "@/components/search/SearchTrigger";

export function SiteHeader() {
  return (
    <header
      data-track-area="cabecalho"
      className="relative sticky top-0 z-40 border-b border-brand-border bg-brand-surface/95 backdrop-blur"
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Logo />
        {/* Sete itens + busca não cabem numa linha abaixo de 1024px: no tablet
            (768px) o menu quebrava em duas linhas dentro do cabeçalho fixo.
            Até lá vale o menu do celular. */}
        <nav aria-label="Menu principal" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {MAIN_NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-brand-text hover:bg-brand-surface-soft hover:text-brand-navy"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li className="ml-1">
              <SearchTrigger source="header" />
            </li>
          </ul>
        </nav>
        <div className="flex items-center gap-2 lg:hidden">
          <SearchTrigger
            source="header"
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-brand-border text-brand-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-navy"
          />
          <MobileNavigation />
        </div>
      </div>
    </header>
  );
}
