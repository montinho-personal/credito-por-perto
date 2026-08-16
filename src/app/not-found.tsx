import Link from "next/link";
import { SearchBox } from "@/components/search/SearchTrigger";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-brand-teal-dark">
        Erro 404
      </p>
      <h1 className="mt-3 font-serif text-3xl font-bold text-brand-navy md:text-4xl">
        Esta página não existe (ou mudou de endereço)
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-brand-muted">
        O conteúdo pode ter sido movido ou o endereço digitado está incorreto.
        Busque o assunto que você procurava:
      </p>
      <div className="mx-auto mt-6 flex max-w-xl justify-center text-left">
        <SearchBox source="404" placeholder="Busque por assunto, cidade ou dúvida…" />
      </div>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="rounded-lg bg-brand-teal-dark px-5 py-2.5 font-semibold text-white hover:bg-brand-teal"
        >
          Página inicial
        </Link>
        <Link
          href="/emprestimos/"
          className="rounded-lg border border-brand-border px-5 py-2.5 font-semibold text-brand-navy hover:bg-brand-surface-soft"
        >
          Guias de empréstimos
        </Link>
      </div>
    </div>
  );
}
