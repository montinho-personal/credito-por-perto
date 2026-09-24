import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { collectionPageJsonLd, itemListJsonLd } from "@/lib/schema/jsonld";
import { getTools } from "@/lib/tools/registry";
import { ToolCard } from "@/components/tools/ToolCard";

const PATH = "/simuladores/";
const TITLE = "Simuladores financeiros: o que acontece ao longo do tempo";
const DESCRIPTION =
  "Simule a trajetória das suas dívidas e financiamentos mês a mês: quando terminam, quanto custam e o que muda se você pagar mais. Grátis, sem cadastro.";

export const metadata: Metadata = buildMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

/**
 * Central de simuladores.
 *
 * Calculadora responde "quanto é?"; simulador responde "o que acontece ao
 * longo do tempo?": estado inicial, regras, meses passando, marcos e
 * cenários. Esta página nasce com a primeira ferramenta da família e cresce
 * pelo registro: ferramenta com rota em /simuladores/ aparece aqui.
 *
 * Os simuladores que já viviam em /calculadoras/ (financiamentos, FGTS,
 * parcelamento da fatura) não mudam de endereço: URL ranqueada não se move
 * sem necessidade. Eles são listados aqui como estão.
 */
export default function SimuladoresPage() {
  const tools = getTools();
  const family = tools.filter((t) => t.route.startsWith("/simuladores/"));
  const timeBased = tools.filter((t) => t.type === "simulador" && !t.route.startsWith("/simuladores/"));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <JsonLd data={collectionPageJsonLd(TITLE, DESCRIPTION, PATH)} />
      <JsonLd data={itemListJsonLd([...family, ...timeBased].map((t) => ({ name: t.name, path: t.route })))} />
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: "Simuladores", path: PATH },
        ]}
      />
      <header className="mt-6">
        <h1 className="font-serif text-3xl font-bold leading-tight text-brand-navy md:text-4xl">Simuladores financeiros</h1>
        <p className="mt-3 max-w-3xl text-lg leading-relaxed text-brand-muted">
          Uma calculadora responde “quanto é?”. Um simulador responde “o que acontece ao longo do tempo?”: você informa onde está hoje e
          vê como a situação tende a evoluir mês a mês, com marcos, datas e cenários para testar mudanças.
        </p>
        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-brand-muted" aria-label="Como os simuladores funcionam">
          <li>Sem cadastro</li>
          <li>Sem CPF</li>
          <li>Cálculo no seu aparelho</li>
          <li>Sem indicação de banco</li>
        </ul>
      </header>

      <section aria-labelledby="dividas" className="mt-10">
        <h2 id="dividas" className="font-serif text-2xl font-bold text-brand-navy">Dívidas</h2>
        <p className="mt-1.5 text-sm text-brand-muted">Onde você está hoje, quando cada dívida termina e o que muda se pagar um pouco mais.</p>
        <ul data-track-area="cards-ferramentas" data-track-event="calculator_card_click" className="mt-5 grid gap-4 md:grid-cols-2">
          {family.map((tool) => (
            <li key={tool.id}>
              <ToolCard tool={tool} heading />
            </li>
          ))}
        </ul>
      </section>

      {timeBased.length > 0 ? (
        <section aria-labelledby="mais" className="mt-12">
          <h2 id="mais" className="font-serif text-2xl font-bold text-brand-navy">Simuladores que vivem na central de calculadoras</h2>
          <p className="mt-1.5 text-sm text-brand-muted">Financiamentos, fatura parcelada e FGTS também projetam o tempo. Eles continuam no endereço de sempre.</p>
          <ul data-track-area="cards-ferramentas" data-track-event="calculator_card_click" className="mt-5 grid gap-4 md:grid-cols-2">
            {timeBased.map((tool) => (
              <li key={tool.id}>
                <ToolCard tool={tool} heading compact />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="proximos" data-track-area="chamada-jornada" className="mt-12 rounded-2xl border border-brand-border bg-brand-teal-soft p-6">
        <h2 id="proximos" className="font-serif text-2xl font-bold text-brand-navy">Precisa de uma conta rápida?</h2>
        <p className="mt-2 max-w-3xl leading-relaxed text-brand-text">
          A central de calculadoras reúne as ferramentas de “quanto é?”: parcela, juros, CET, IOF, conversão de taxa e comparação de
          propostas. E a Central de Decisões monta o caminho para quem tem uma situação e não sabe o próximo passo.
        </p>
        <p className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <Link href="/calculadoras/" className="inline-flex min-h-11 items-center rounded-lg bg-brand-navy px-4 font-semibold text-white transition hover:bg-brand-navy/90">
            Ver as calculadoras
          </Link>
          <Link href="/decisoes-financeiras/" className="inline-flex min-h-11 items-center font-semibold text-brand-teal-dark underline underline-offset-2">
            Mostrar meu próximo passo
          </Link>
        </p>
      </section>
    </div>
  );
}
