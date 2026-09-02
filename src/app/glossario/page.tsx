import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";

export const metadata: Metadata = buildMetadata({
  title: "Glossário de crédito: termos de empréstimo explicados",
  description:
    "CET, IOF, amortização, margem consignável, portabilidade, score: os principais termos do mundo do crédito explicados em linguagem simples.",
  path: "/glossario/",
});

const TERMOS: Array<{ termo: string; definicao: string }> = [
  {
    termo: "Amortização",
    definicao:
      "Parte da parcela que efetivamente reduz a dívida. A parcela de um empréstimo se divide entre juros (custo do dinheiro no período) e amortização (abatimento do saldo devedor).",
  },
  {
    termo: "Análise de crédito",
    definicao:
      "Avaliação que a instituição faz antes de aprovar um empréstimo, considerando renda, histórico de pagamento, dívidas existentes e relacionamento com o banco. Cada instituição tem critérios próprios.",
  },
  {
    termo: "Carência",
    definicao:
      "Prazo entre a contratação e o vencimento da primeira parcela. Carência maior significa mais tempo para começar a pagar — e juros acumulando por mais tempo.",
  },
  {
    termo: "CET (Custo Efetivo Total)",
    definicao:
      "O custo completo do empréstimo, expresso em taxa anual: inclui juros, IOF, tarifas e seguros. É o número certo para comparar propostas — duas ofertas com a mesma taxa de juros podem ter CET bem diferente.",
  },
  {
    termo: "Consignado",
    definicao:
      "Empréstimo cujas parcelas são descontadas diretamente do benefício ou salário, dentro de um limite chamado margem consignável. Comum entre aposentados, pensionistas e servidores.",
  },
  {
    termo: "Correspondente bancário",
    definicao:
      "Empresa autorizada a intermediar produtos de uma instituição financeira, sem ser ela mesma um banco. Verifique sempre em nome de qual instituição o correspondente atua.",
  },
  {
    termo: "Empréstimo com garantia",
    definicao:
      "Modalidade em que um bem (imóvel, veículo) fica como garantia do pagamento. Os juros tendem a ser menores, mas o atraso prolongado pode levar à perda do bem.",
  },
  {
    termo: "IOF",
    definicao:
      "Imposto sobre Operações Financeiras, cobrado em operações de crédito. Entra no cálculo do CET e por isso encarece o custo final do empréstimo.",
  },
  {
    termo: "Juros compostos",
    definicao:
      "Regime em que os juros de cada período incidem sobre o saldo já acrescido dos juros anteriores — os chamados “juros sobre juros”. É o regime usado nos empréstimos.",
  },
  {
    termo: "Juros simples",
    definicao:
      "Regime em que os juros incidem sempre sobre o valor original. Raramente usado em empréstimos reais; aparece mais em cálculos didáticos e em algumas multas.",
  },
  {
    termo: "Margem consignável",
    definicao:
      "Percentual máximo do salário ou benefício que pode ser comprometido com parcelas de consignado. O limite é definido por lei e pode mudar — confirme o valor vigente em fonte oficial.",
  },
  {
    termo: "Portabilidade de crédito",
    definicao:
      "Direito de transferir uma dívida para outra instituição que ofereça condições melhores, mantendo o saldo devedor. A instituição de destino quita a dívida original.",
  },
  {
    termo: "Refinanciamento",
    definicao:
      "Contratação de nova operação sobre um contrato existente, geralmente liberando um valor adicional e recomeçando o prazo. Costuma aumentar o custo total da dívida.",
  },
  {
    termo: "Renegociação",
    definicao:
      "Acordo com o credor para alterar condições de uma dívida existente — prazo, taxa ou desconto sobre o valor. Alternativa que vale avaliar antes de contratar um novo empréstimo para cobrir dívidas.",
  },
  {
    termo: "Saldo devedor",
    definicao:
      "Quanto ainda falta pagar da dívida em determinado momento. Diminui a cada amortização e serve de base para o cálculo dos juros da parcela seguinte.",
  },
  {
    termo: "Score de crédito",
    definicao:
      "Pontuação calculada por birôs de crédito para estimar o risco de inadimplência. Influencia a análise, mas não é o único critério — e ninguém consegue “aumentar o score” de forma paga e instantânea.",
  },
  {
    termo: "Sistema Price",
    definicao:
      "Sistema de amortização com parcelas fixas. No início do contrato, a maior parte da parcela paga juros; com o tempo, a amortização cresce.",
  },
  {
    termo: "Superendividamento",
    definicao:
      "Situação em que a pessoa não consegue pagar o conjunto das dívidas sem comprometer o mínimo existencial. A legislação brasileira prevê processos de repactuação para esses casos.",
  },
  {
    termo: "Tabela SAC",
    definicao:
      "Sistema de Amortização Constante: a amortização é igual todos os meses e a parcela começa maior e diminui com o tempo. Mais comum em financiamentos imobiliários que em empréstimos pessoais.",
  },
  {
    termo: "Taxa nominal e taxa efetiva",
    definicao:
      "A taxa nominal é declarada sem considerar a capitalização; a efetiva reflete o custo real no período. Ao comparar, use sempre taxas efetivas no mesmo prazo — ou, melhor, o CET.",
  },
];

export default function GlossarioPage() {
  return (
    <div data-track-area="hub-categoria" className="mx-auto max-w-3xl px-4 py-8">
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: "Glossário", path: "/glossario/" },
        ]}
      />
      <h1 className="mt-6 font-serif text-3xl font-bold text-brand-navy md:text-4xl">
        Glossário de crédito
      </h1>
      <p className="mt-3 text-lg leading-relaxed text-brand-muted">
        Os termos que aparecem em propostas de empréstimo, explicados sem
        juridiquês. Use este glossário como apoio ao ler contratos e comparar
        ofertas.
      </p>
      <dl className="mt-8 space-y-6">
        {TERMOS.map((item) => (
          <div
            key={item.termo}
            className="rounded-xl border border-brand-border bg-white p-5"
          >
            <dt className="font-serif text-lg font-bold text-brand-navy">
              {item.termo}
            </dt>
            <dd className="mt-1.5 leading-relaxed text-brand-text">
              {item.definicao}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
