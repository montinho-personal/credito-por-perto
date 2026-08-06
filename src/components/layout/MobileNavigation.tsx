"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { MAIN_NAV } from "@/lib/site";

export function MobileNavigation() {
  const [open, setOpen] = useState(false);
  const menuId = useId();

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-11 items-center justify-center rounded-lg border border-brand-border text-brand-navy"
      >
        <span className="sr-only">{open ? "Fechar menu" : "Abrir menu"}</span>
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          {open ? (
            <path d="M6 6l12 12M18 6L6 18" />
          ) : (
            <path d="M4 7h16M4 12h16M4 17h16" />
          )}
        </svg>
      </button>
      {open ? (
        <nav
          id={menuId}
          aria-label="Menu principal"
          className="absolute inset-x-0 top-full z-50 border-b border-brand-border bg-brand-surface shadow-lg"
        >
          <ul className="mx-auto max-w-6xl px-4 py-3">
            {MAIN_NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-3 text-base font-medium text-brand-navy hover:bg-brand-surface-soft"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
