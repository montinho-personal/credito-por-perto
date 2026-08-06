"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-brand-danger">
        Erro inesperado
      </p>
      <h1 className="mt-3 font-serif text-3xl font-bold text-brand-navy">
        Algo deu errado ao carregar esta página
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-lg text-brand-muted">
        Você pode tentar novamente ou voltar para a página inicial.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-brand-teal-dark px-5 py-2.5 font-semibold text-white hover:bg-brand-teal"
        >
          Tentar novamente
        </button>
        <Link
          href="/"
          className="rounded-lg border border-brand-border px-5 py-2.5 font-semibold text-brand-navy hover:bg-brand-surface-soft"
        >
          Página inicial
        </Link>
      </div>
    </div>
  );
}
