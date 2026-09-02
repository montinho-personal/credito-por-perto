import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MarginCalculator } from "@/components/calculators/MarginCalculator";
import { ToolNextSteps } from "@/components/journeys/ToolNextSteps";

export const metadata: Metadata = buildMetadata({
  title: "Calculadora de margem consignável: INSS e CLT",
  description:
    "Calcule quanto da sua margem consignável está livre: limite para empréstimo, fatias dos cartões e o disponível após as parcelas atuais — sem cadastro nem CPF.",
  path: "/calculadoras/margem-consignavel/",
});

export default function CalculadoraMargemPage() {
  return (
    <div
      data-track-area="ferramenta"
      data-track="margem-consignavel"
      className="mx-auto max-w-3xl px-4 py-8">
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: "Calculadoras", path: "/calculadoras/" },
          { name: "Margem consignável", path: "/calculadoras/margem-consignavel/" },
        ]}
      />
      <h1 className="mt-6 font-serif text-3xl font-bold text-brand-navy md:text-4xl">
        Calculadora de margem consignável
      </h1>
      <p className="mt-3 text-lg leading-relaxed text-brand-muted">
        Informe seu benefício ou salário líquido e as parcelas de consignado já
        ativas para estimar quanto da margem está comprometido e quanto resta —
        para aposentados e pensionistas do INSS e trabalhadores CLT.
      </p>

      <div className="mt-8">
        <MarginCalculator />
      </div>

      <ToolNextSteps toolId="margem-consignavel" />


      <section aria-labelledby="entenda" className="article-body mt-12">
        <h2 id="entenda">Como interpretar o resultado</h2>
        <p>
          A margem consignável divide sua renda em fatias com destinos próprios:
          uma para <strong>empréstimos consignados</strong> e fatias menores
          reservadas aos <strong>cartões consignados</strong>. A calculadora
          mostra cada fatia e desconta as parcelas que você já paga — o que
          sobra é o teto para uma nova contratação, não uma recomendação de
          usá-lo.
        </p>
        <p>
          Para entender de onde vêm os percentuais, como consultar sua margem
          oficial no Meu INSS ou na Carteira de Trabalho Digital e o que fazer
          quando a margem aparece &ldquo;presa&rdquo;, leia o guia completo de{" "}
          <Link href="/emprestimos/margem-consignavel/">margem consignável</Link>
          . Se a fatia do cartão está ocupada por uma sigla RMC que você não
          reconhece, veja{" "}
          <Link href="/emprestimos/cartao-de-credito-consignado/">
            cartão de crédito consignado
          </Link>
          . E antes de usar a margem livre, simule o custo na{" "}
          <Link href="/calculadoras/emprestimo/">calculadora de empréstimo</Link>.
        </p>
      </section>
    </div>
  );
}
