import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { webPageJsonLd } from "@/lib/schema/jsonld";
import { JsonLd } from "@/components/seo/JsonLd";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { RateConverterTool } from "@/components/calculators/RateConverterTool";
import {
  annualReferenceTable,
  formatRatePercent,
  monthlyReferenceTable,
} from "@/lib/calculators/rate-converter";

export const metadata: Metadata = buildMetadata({
  title: "Conversor de taxa mensal para anual (e anual para mensal)",
  description:
    "Converta uma taxa de juros mensal em anual ou anual em mensal usando equivalência composta. Veja por que 3% ao mês não são 36% ao ano. Grátis, sem cadastro.",
  path: "/calculadoras/conversor-de-taxas/",
});

export default function ConversorDeTaxasPage() {
  const monthlyTable = monthlyReferenceTable();
  const annualTable = annualReferenceTable();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <JsonLd
        data={webPageJsonLd(
          "Conversor de taxa mensal para anual",
          "Converta taxas de juros entre as bases mensal e anual usando equivalência efetiva com capitalização composta.",
          "/calculadoras/conversor-de-taxas/",
        )}
      />
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: "Calculadoras", path: "/calculadoras/" },
          { name: "Conversor de taxas", path: "/calculadoras/conversor-de-taxas/" },
        ]}
      />

      <header className="mt-6">
        <h1 className="font-serif text-3xl font-bold leading-tight text-brand-navy md:text-4xl">
          Conversor de taxa mensal para anual
        </h1>
        <p className="mt-3 text-lg leading-relaxed text-brand-muted">
          3% ao mês são 36% ao ano? Não exatamente. Informe uma taxa ao mês ou ao ano e veja a
          taxa efetiva equivalente — grátis, sem cadastro, em segundos.
        </p>
      </header>

      <div className="mt-6">
        <RateConverterTool />
      </div>

      <section className="mt-10">
        <h2 className="font-serif text-2xl font-bold text-brand-navy">
          Taxas mensais e equivalentes anuais
        </h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-brand-border bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-border text-left text-xs uppercase tracking-wide text-brand-muted">
                <th className="px-4 py-2">Taxa mensal</th>
                <th className="px-4 py-2">Multiplicação simples (×12)</th>
                <th className="px-4 py-2">Equivalente efetiva anual</th>
              </tr>
            </thead>
            <tbody>
              {monthlyTable.map((row) => (
                <tr key={row.monthly} className="border-t border-brand-border/60 text-brand-text">
                  <td className="px-4 py-1.5 font-semibold">{formatRatePercent(row.monthly)} a.m.</td>
                  <td className="px-4 py-1.5">{formatRatePercent(row.naive)}</td>
                  <td className="px-4 py-1.5 font-semibold text-brand-navy">
                    ≈ {formatRatePercent(row.annual)} a.a.
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-semibold text-brand-teal-dark">
            Ver o caminho inverso: taxa anual para mensal
          </summary>
          <div className="mt-3 overflow-x-auto rounded-xl border border-brand-border bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border text-left text-xs uppercase tracking-wide text-brand-muted">
                  <th className="px-4 py-2">Taxa anual</th>
                  <th className="px-4 py-2">Equivalente efetiva mensal</th>
                </tr>
              </thead>
              <tbody>
                {annualTable.map((row) => (
                  <tr key={row.annual} className="border-t border-brand-border/60 text-brand-text">
                    <td className="px-4 py-1.5 font-semibold">{formatRatePercent(row.annual)} a.a.</td>
                    <td className="px-4 py-1.5 font-semibold text-brand-navy">
                      ≈ {formatRatePercent(row.monthly)} a.m.
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <section aria-labelledby="perguntas-conversor" className="article-body mt-12">
        <h2 id="perguntas-conversor">Como transformar taxa mensal em anual?</h2>
        <p>
          Com a fórmula de equivalência composta: taxa anual = (1 + taxa mensal)¹² − 1, usando a
          taxa em formato decimal (3% = 0,03). Com 3% ao mês: (1,03)¹² − 1 = 0,4258, ou seja,
          aproximadamente 42,58% ao ano. O conversor acima faz essa conta nos dois sentidos.
        </p>

        <h2 id="por-que-nao-x12">Por que não basta multiplicar por 12?</h2>
        <p>
          Multiplicar por 12 produz a chamada <em>taxa nominal proporcional</em> — um conceito que
          existe e aparece em alguns contextos. Mas, para encontrar a <strong>taxa efetiva anual
          equivalente</strong>, a conta é composta: cada mês incide sobre o saldo já acrescido dos
          juros anteriores. Por isso 3% ao mês equivalem a 42,58% ao ano, e não a 36% — e a
          diferença cresce rápido com a taxa: 5% ao mês são 79,59% ao ano, não 60%.
        </p>

        <h2 id="anual-para-mensal">Como converter taxa anual para mensal?</h2>
        <p>
          Pelo caminho inverso: taxa mensal = (1 + taxa anual)^(1/12) − 1. Uma taxa de 40% ao ano
          equivale a aproximadamente 2,84% ao mês — e não a 40 ÷ 12 = 3,33%. O cuidado vale ao
          comparar um produto anunciado em base anual com outro em base mensal: converta os dois
          para a mesma base antes.
        </p>

        <h2 id="taxas-equivalentes">O que são taxas equivalentes?</h2>
        <p>
          Duas taxas são equivalentes quando, aplicadas ao mesmo valor pelo mesmo tempo total sob
          capitalização composta, produzem o mesmo resultado. 3% ao mês e 42,58% ao ano são
          equivalentes: doze meses a 3% chegam ao mesmo lugar que um ano a 42,58%.
        </p>

        <h2 id="nominal-efetiva">Taxa nominal e taxa efetiva são iguais?</h2>
        <p>
          Não. A taxa nominal é declarada em um período com capitalização em outro (ex.: &ldquo;36%
          ao ano com capitalização mensal&rdquo; significa 3% ao mês — que efetivamente rendem
          42,58% no ano). A taxa efetiva é a que de fato incide no período. Se a proposta do seu
          banco mostra um número anual diferente do conversor, isso não significa automaticamente
          erro: confira se a taxa é efetiva ou nominal, se é juros ou CET, e qual periodicidade
          foi usada.
        </p>

        <h2 id="taxa-e-cet">Taxa de juros e CET são a mesma coisa?</h2>
        <p>
          Não — e essa diferença custa dinheiro. O CET (Custo Efetivo Total) inclui, além dos
          juros, tarifas, seguros e demais encargos da operação. Taxa menor não garante menor
          CET. Para comparar propostas de crédito, o número certo é o CET:{" "}
          <Link href="/juros-e-cet/o-que-e-cet/">entenda o CET</Link> e use o{" "}
          <Link href="/calculadoras/comparador-de-propostas/">comparador de propostas</Link>.
        </p>

        <h2 id="taxa-alta">Como saber se a taxa do meu empréstimo está alta?</h2>
        <p>
          Convertida para a base certa, compare-a com a média oficial que o Banco Central publica
          para a mesma modalidade — é exatamente o que a ferramenta{" "}
          <Link href="/calculadoras/minha-taxa-esta-cara/">minha taxa está cara?</Link> faz, com
          as séries oficiais e a diferença em pontos percentuais.
        </p>

        <h2 id="metodologia-conversor">Como fazemos a conversão?</h2>
        <p>
          1) Transformamos o percentual em decimal (3% → 0,03); 2) aplicamos a fórmula de
          equivalência composta — (1 + iₘ)¹² − 1 ou (1 + iₐ)^(1/12) − 1; 3) transformamos de
          volta em percentual; 4) arredondamos apenas na apresentação (duas casas, ou quatro para
          taxas muito pequenas). A conta assume 12 períodos mensais por ano; contratos específicos
          podem usar convenções, indexadores ou metodologias próprias — e a conversão de taxa não
          é o custo total de um contrato. O regime composto é o padrão das operações de crédito,
          como explica o material educativo do{" "}
          <a href="https://www.bcb.gov.br" rel="noopener noreferrer" target="_blank">
            Banco Central
          </a>
          . A explicação completa, com a tabela do erro clássico, está no guia{" "}
          <Link href="/juros-e-cet/taxa-mensal-e-taxa-anual/">
            taxa mensal e taxa anual: por que 3% ao mês não é 36% ao ano
          </Link>
          . Encontrou algo errado? Veja a{" "}
          <Link href="/politica-de-correcoes/">política de correções</Link>. Metodologia revisada
          em 27/08/2026.
        </p>
      </section>
    </div>
  );
}
