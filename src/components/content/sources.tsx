import type { SourceLedger } from "@/lib/content/ledgers";

/** Link externo para fonte oficial, sempre com atributos seguros. */
export function OfficialSourceLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      rel="noopener noreferrer external"
      target="_blank"
      className="font-medium text-brand-teal-dark underline underline-offset-2 hover:text-brand-teal"
    >
      {children}
      <span className="sr-only"> (abre em nova aba)</span>
    </a>
  );
}

/** Lista de fontes exibida ao final dos artigos, alimentada pelo source ledger. */
export function SourceList({ ledger }: { ledger: SourceLedger }) {
  if (ledger.claims.length === 0) return null;
  const seen = new Set<string>();
  const uniqueSources = ledger.claims.filter((claim) => {
    const key = `${claim.sourceOrganization}|${claim.sourceTitle}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return (
    <section aria-labelledby="fontes" className="mt-12 border-t border-brand-border pt-6">
      <h2 id="fontes" className="font-serif text-xl font-bold text-brand-navy">
        Fontes consultadas
      </h2>
      <ul className="mt-3 space-y-2 text-sm leading-relaxed text-brand-muted">
        {uniqueSources.map((claim) => (
          <li key={claim.claimId}>
            <span className="font-medium text-brand-text">
              {claim.sourceOrganization}
            </span>
            {" — "}
            {claim.sourceLocation.startsWith("http") ? (
              <OfficialSourceLink href={claim.sourceLocation}>
                {claim.sourceTitle}
              </OfficialSourceLink>
            ) : (
              <span>
                {claim.sourceTitle} ({claim.sourceLocation})
              </span>
            )}
            {". "}
            Consulta em {formatDateBR(claim.accessedAt)}.
          </li>
        ))}
      </ul>
    </section>
  );
}

export function formatDateBR(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

export function LastVerifiedBadge({ date }: { date: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-teal/30 bg-brand-teal-soft px-3 py-1 text-xs font-medium text-brand-teal-dark">
      <svg
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m4 12.5 5 5L20 6.5" />
      </svg>
      Informações verificadas em {formatDateBR(date)}
    </span>
  );
}
