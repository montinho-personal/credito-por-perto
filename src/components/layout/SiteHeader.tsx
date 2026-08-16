import Link from "next/link";
import { MAIN_NAV } from "@/lib/site";
import { Logo } from "@/components/layout/Logo";
import { MobileNavigation } from "@/components/layout/MobileNavigation";
import { SearchTrigger } from "@/components/search/SearchTrigger";

export function SiteHeader() {
  return (
    <header className="relative sticky top-0 z-40 border-b border-brand-border bg-brand-surface/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Logo />
        <nav aria-label="Menu principal" className="hidden md:block">
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
        <div className="flex items-center gap-2 md:hidden">
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
