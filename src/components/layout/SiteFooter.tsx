import Link from "next/link";
import { FOOTER_NAV, SITE_NAME, SITE_TAGLINE } from "@/lib/site";
import { Logo } from "@/components/layout/Logo";
import { getFooterTools } from "@/lib/tools/registry";

/**
 * Rodapé do site.
 *
 * Duas faixas, com funções distintas:
 *
 *   1. NAVEGAÇÃO — marca + quatro colunas de até sete itens cada. O limite não
 *      é estético: coluna com vinte links deixa de ser navegação e vira
 *      parede de texto, que ninguém varre com o olho;
 *   2. RODAPÉ LEGAL — aviso YMYL, utilidades e copyright, em corpo menor e
 *      separados por uma linha, porque cumprem obrigação e não convidam ao
 *      clique.
 *
 * O bloco de independência editorial ("não concedemos, não intermediamos,
 * não vendemos") sai da lista Institucional e ganha destaque ao lado da
 * marca. É a informação que mais importa para quem chega aqui pela primeira
 * vez e precisa saber de que lado o site está.
 */

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: readonly { label: string; href: string }[];
}) {
  return (
    <nav aria-label={title}>
      <h2 className="text-xs font-bold uppercase tracking-wider text-brand-gold">
        {title}
      </h2>
      <ul className="mt-4 space-y-2.5">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-sm leading-snug text-brand-surface-soft/75 transition-colors hover:text-white"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function SiteFooter() {
  const tools = getFooterTools();
  const year = new Date().getFullYear();

  return (
    <footer data-track-area="rodape" className="mt-16 bg-brand-navy text-brand-surface">
      <div className="mx-auto max-w-6xl px-4 py-12 md:py-14">
        {/*
          No celular as quatro listas ficam em duas colunas, não empilhadas:
          empilhadas, o rodapé passava de 1600px — mais alto que a tela — e
          rolar tudo aquilo para chegar ao aviso legal é o oposto de navegar.
        */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1fr] lg:gap-x-8">
          <div className="col-span-2 md:col-span-4 lg:col-span-1 lg:pr-4">
            <Logo variant="dark" />
            <p className="mt-4 text-sm leading-relaxed text-brand-surface-soft/75">
              {SITE_TAGLINE}
            </p>
            <p className="mt-4 rounded-lg border border-white/15 bg-white/5 p-3 text-xs leading-relaxed text-brand-surface-soft/90">
              Portal editorial independente.{" "}
              <strong className="font-semibold text-white">
                Não concedemos, não intermediamos e não vendemos crédito
              </strong>{" "}
              — e nenhuma instituição paga para aparecer aqui.{" "}
              <Link
                href="/como-ganhamos-dinheiro/"
                className="whitespace-nowrap font-medium text-brand-gold underline-offset-2 hover:underline"
              >
                Como nos sustentamos
              </Link>
            </p>
          </div>

          <FooterColumn title="Conteúdo" links={FOOTER_NAV.conteudo} />

          <nav aria-label="Ferramentas">
            <h2 className="text-xs font-bold uppercase tracking-wider text-brand-gold">
              Ferramentas
            </h2>
            <ul className="mt-4 space-y-2.5">
              {/* A Central encabeça a coluna, e não a de conteúdo: quem chega
                  ao rodapé sem saber o nome da conta que procura precisa da
                  porta pela situação antes da lista de nomes técnicos. Ela
                  entra aqui em vez de virar o oitavo item de "Conteúdo" —
                  sete por coluna é o limite que mantém o rodapé varrível. */}
              <li>
                <Link
                  href="/decisoes-financeiras/"
                  className="text-sm font-medium leading-snug text-brand-gold transition-colors hover:text-white"
                >
                  Central de decisões
                </Link>
              </li>
              {tools.map((tool) => (
                <li key={tool.id}>
                  <Link
                    href={tool.route}
                    className="text-sm leading-snug text-brand-surface-soft/75 transition-colors hover:text-white"
                  >
                    {tool.shortName}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/calculadoras/"
                  className="text-sm font-medium leading-snug text-brand-gold transition-colors hover:text-white"
                >
                  Ver todas <span aria-hidden="true">→</span>
                </Link>
              </li>
            </ul>
          </nav>

          <FooterColumn title="Institucional" links={FOOTER_NAV.institucional} />
          <FooterColumn title="Legal" links={FOOTER_NAV.legal} />
        </div>

        <div className="mt-12 border-t border-white/15 pt-6">
          <p className="text-xs leading-relaxed text-brand-surface-soft/60">
            Conteúdo educativo. Não constitui recomendação individual de crédito
            ou investimento e não substitui a análise das condições oferecidas
            pelas instituições. Taxas, regras e programas mudam: confirme sempre
            nas fontes oficiais antes de contratar.
          </p>
          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-brand-surface-soft/60">
              © {year} {SITE_NAME}
            </p>
            <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {FOOTER_NAV.utilidades.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-xs text-brand-surface-soft/60 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
