import type { ReactNode } from "react";

/**
 * Caixas editoriais reutilizadas dentro dos artigos MDX.
 * Todas usam ícone + cor + texto para não depender apenas de cor (acessibilidade).
 */

export function QuickSummary({
  title = "Em poucas palavras",
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <aside
      aria-label={title}
      className="my-6 rounded-xl border border-brand-teal/30 bg-brand-teal-soft p-5"
    >
      <p className="text-sm font-bold uppercase tracking-wide text-brand-teal-dark">
        {title}
      </p>
      <div className="mt-2 text-[1rem] leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_li+li]:mt-1">
        {children}
      </div>
    </aside>
  );
}

export function KeyTakeaways({ children }: { children: ReactNode }) {
  return <QuickSummary title="Pontos principais">{children}</QuickSummary>;
}

export function WarningBox({
  title = "Atenção",
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <aside
      aria-label={title}
      className="my-6 rounded-xl border border-brand-warning/30 bg-brand-warning-soft p-5"
    >
      <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-brand-warning">
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M12 3 2.5 20h19L12 3Z" strokeLinejoin="round" />
          <path d="M12 10v4.5" />
          <circle cx="12" cy="17.2" r="0.4" fill="currentColor" />
        </svg>
        {title}
      </p>
      <div className="mt-2 leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_li+li]:mt-1">
        {children}
      </div>
    </aside>
  );
}

export function SafetyAlert({
  title = "Atenção a golpes",
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <aside
      aria-label={title}
      className="my-6 rounded-xl border border-brand-danger/30 bg-brand-danger-soft p-5"
    >
      <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-brand-danger">
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3c2.5 2 5.5 3 8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6c2.5 0 5.5-1 8-3Z" />
          <path d="M12 9v4" />
          <circle cx="12" cy="16" r="0.4" fill="currentColor" />
        </svg>
        {title}
      </p>
      <div className="mt-2 leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_li+li]:mt-1">
        {children}
      </div>
    </aside>
  );
}

export function DefinitionBox({
  term,
  children,
}: {
  term: string;
  children: ReactNode;
}) {
  return (
    <aside className="my-6 rounded-xl border border-brand-border bg-brand-surface-soft p-5">
      <p className="text-sm font-bold uppercase tracking-wide text-brand-muted">
        Definição
      </p>
      <p className="mt-1 font-serif text-lg font-bold text-brand-navy">{term}</p>
      <div className="mt-1 leading-relaxed">{children}</div>
    </aside>
  );
}

export function ExampleBox({
  title = "Exemplo prático",
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <aside
      aria-label={title}
      className="my-6 rounded-xl border-l-4 border-brand-navy bg-brand-surface-soft p-5"
    >
      <p className="text-sm font-bold uppercase tracking-wide text-brand-navy">
        {title}
      </p>
      <div className="mt-2 leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_table]:mt-3">
        {children}
      </div>
    </aside>
  );
}

export function ProsCons({
  pros,
  cons,
  prosTitle = "Vantagens",
  consTitle = "Riscos e desvantagens",
}: {
  pros: string[];
  cons: string[];
  prosTitle?: string;
  consTitle?: string;
}) {
  return (
    <div className="my-6 grid gap-4 sm:grid-cols-2">
      <div className="rounded-xl border border-brand-success/30 bg-brand-success-soft p-5">
        <p className="text-sm font-bold uppercase tracking-wide text-brand-success">
          {prosTitle}
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 leading-relaxed">
          {pros.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <div className="rounded-xl border border-brand-danger/30 bg-brand-danger-soft p-5">
        <p className="text-sm font-bold uppercase tracking-wide text-brand-danger">
          {consTitle}
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 leading-relaxed">
          {cons.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function ChecklistBox({
  title = "Antes de contratar",
  items,
}: {
  title?: string;
  items: string[];
}) {
  return (
    <aside
      aria-label={title}
      className="my-6 rounded-xl border border-brand-border bg-white p-5"
    >
      <p className="font-serif text-lg font-bold text-brand-navy">{title}</p>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2.5 leading-relaxed">
            <svg
              viewBox="0 0 24 24"
              className="mt-1 h-4 w-4 shrink-0 text-brand-teal"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m4 12.5 5 5L20 6.5" />
            </svg>
            {item}
          </li>
        ))}
      </ul>
    </aside>
  );
}

export function WhatCanChange({ items }: { items: string[] }) {
  return (
    <aside
      aria-label="O que pode mudar"
      className="my-6 rounded-xl border border-dashed border-brand-border bg-brand-surface-soft p-5"
    >
      <p className="text-sm font-bold uppercase tracking-wide text-brand-muted">
        O que pode mudar
      </p>
      <p className="mt-1 text-sm text-brand-muted">
        As condições abaixo variam conforme a instituição, o momento e o seu
        perfil — por isso não publicamos números como se fossem universais:
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 leading-relaxed">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </aside>
  );
}

export function MethodologyBox({ children }: { children: ReactNode }) {
  return (
    <aside
      aria-label="Metodologia"
      className="my-6 rounded-xl border border-brand-border bg-white p-5"
    >
      <p className="text-sm font-bold uppercase tracking-wide text-brand-muted">
        Como esta análise foi feita
      </p>
      <div className="mt-2 text-[0.97rem] leading-relaxed [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
    </aside>
  );
}
