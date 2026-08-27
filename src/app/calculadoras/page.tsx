import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { CategoryCard } from "@/components/ui/cards";

export const metadata: Metadata = buildMetadata({
  title: "Calculadoras financeiras educativas",
  description:
    "Calculadoras gratuitas para estimar parcelas, juros totais e taxa anual equivalente de um empréstimo — sem cadastro e sem coleta de dados pessoais.",
  path: "/calculadoras/",
});

export default function CalculadorasPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: "Calculadoras", path: "/calculadoras/" },
        ]}
      />
      <h1 className="mt-6 font-serif text-3xl font-bold text-brand-navy md:text-4xl">
        Calculadoras
      </h1>
      <p className="mt-3 max-w-2xl text-lg leading-relaxed text-brand-muted">
        Ferramentas educativas para você estimar custos antes de conversar com
        qualquer instituição. Nenhum dado digitado é enviado ou armazenado — e
        nenhuma calculadora aqui promete ou avalia aprovação de crédito.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <CategoryCard
          title="Comparador de propostas de crédito"
          description="Coloque até 3 propostas lado a lado e veja parcela, prazo, CET e total pago — parcela menor nem sempre é crédito mais barato."
          href="/calculadoras/comparador-de-propostas/"
        />
        <CategoryCard
          title="Calculadora de empréstimo"
          description="Estime a parcela mensal, o total pago e o total de juros pelo sistema Price, com tabela de amortização mês a mês."
          href="/calculadoras/emprestimo/"
        />
        <CategoryCard
          title="Calculadora de margem consignável"
          description="Veja quanto da sua margem está comprometido e quanto resta para um novo consignado — INSS e CLT."
          href="/calculadoras/margem-consignavel/"
        />
      </div>
    </div>
  );
}
