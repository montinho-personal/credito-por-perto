import Link from "next/link";
import { MAIN_NAV } from "@/lib/site";
import { Logo } from "@/components/layout/Logo";
import { MobileNavigation } from "@/components/layout/MobileNavigation";

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
            <li>
              <Link
                href="/busca/"
                className="ml-1 flex h-10 w-10 items-center justify-center rounded-lg border border-brand-border text-brand-muted hover:text-brand-navy"
                aria-label="Buscar no site"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
              </Link>
            </li>
          </ul>
        </nav>
        <MobileNavigation />
      </div>
    </header>
  );
}
