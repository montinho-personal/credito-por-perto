import Link from "next/link";
import { FOOTER_NAV, SITE_NAME, SITE_TAGLINE } from "@/lib/site";
import { Logo } from "@/components/layout/Logo";

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: readonly { label: string; href: string }[];
}) {
  return (
    <div>
      <h2 className="text-sm font-bold uppercase tracking-wide text-brand-gold">
        {title}
      </h2>
      <ul className="mt-3 space-y-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-sm text-brand-surface-soft/80 hover:text-white hover:underline"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 bg-brand-navy text-brand-surface">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo variant="dark" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-brand-surface-soft/80">
              {SITE_TAGLINE} Portal editorial independente: explicamos
              empréstimos e crédito, mas não concedemos, intermediamos nem
              aprovamos empréstimos.
            </p>
          </div>
          <FooterColumn title="Institucional" links={FOOTER_NAV.institucional} />
          <FooterColumn title="Conteúdo" links={FOOTER_NAV.conteudo} />
          <FooterColumn title="Legal" links={FOOTER_NAV.legal} />
        </div>
        <div className="mt-10 border-t border-white/15 pt-6 text-xs leading-relaxed text-brand-surface-soft/70">
          <p>
            O {SITE_NAME} é um portal de informação e educação financeira. O
            conteúdo tem caráter educativo, não constitui recomendação
            individual de crédito ou investimento e não substitui a análise das
            condições oferecidas pelas instituições. Taxas, regras e programas
            mudam com o tempo: confirme sempre as condições vigentes nas fontes
            oficiais antes de contratar.
          </p>
          <p className="mt-3">
            © {new Date().getFullYear()} {SITE_NAME}. Conteúdo protegido por
            direitos autorais.
          </p>
        </div>
      </div>
    </footer>
  );
}
