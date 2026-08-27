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
          title="Essa instituição aparece no Banco Central?"
          description="Pesquise por nome ou CNPJ nos dados oficiais do BC antes de continuar a conversa — registro é o primeiro passo, o contato é o segundo."
          href="/calculadoras/consultar-instituicao/"
          cta="Consultar instituição"
        />
        <CategoryCard
          title="Comparador de propostas de crédito"
          description="Coloque até 3 propostas lado a lado e veja parcela, prazo, CET e total pago — parcela menor nem sempre é crédito mais barato."
          href="/calculadoras/comparador-de-propostas/"
          cta="Comparar propostas"
        />
        <CategoryCard
          title="Essa proposta tem sinais de golpe?"
          description="Pediram Pix para liberar? Responda perguntas rápidas e veja os sinais de alerta antes de enviar dinheiro ou dados."
          href="/calculadoras/sinais-de-golpe/"
          cta="Verificar sinais"
        />
        <CategoryCard
          title="Vale a pena trocar esta dívida?"
          description="Compare a dívida atual com a nova proposta e veja o que muda na parcela, no prazo e no total — parcela menor não é dívida mais barata."
          href="/calculadoras/trocar-divida/"
          cta="Comparar dívidas"
        />
        <CategoryCard
          title="Minha taxa está cara?"
          description="Informe a taxa da sua proposta e veja como ela se compara à média oficial do Banco Central para a mesma modalidade."
          href="/calculadoras/minha-taxa-esta-cara/"
          cta="Comparar minha taxa"
        />
        <CategoryCard
          title="Quanto de parcela cabe no meu orçamento?"
          description="Informe renda, despesas e dívidas e veja quanto sobra antes e depois da nova parcela — a folga importa mais que o percentual da renda."
          href="/calculadoras/parcela-no-orcamento/"
          cta="Calcular impacto"
        />
        <CategoryCard
          title="Calculadora de empréstimo"
          description="Estime a parcela mensal, o total pago e o total de juros pelo sistema Price, com tabela de amortização mês a mês."
          href="/calculadoras/emprestimo/"
          cta="Calcular parcelas"
        />
        <CategoryCard
          title="Calculadora de margem consignável"
          description="Veja quanto da sua margem está comprometido e quanto resta para um novo consignado — INSS e CLT."
          href="/calculadoras/margem-consignavel/"
          cta="Calcular margem"
        />
      </div>
    </div>
  );
}
