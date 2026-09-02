import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { LoanCalculator } from "@/components/calculators/LoanCalculator";
import { ToolNextSteps } from "@/components/journeys/ToolNextSteps";

export const metadata: Metadata = buildMetadata({
  title: "Calculadora de empréstimo: parcelas, juros e total pago",
  description:
    "Simule parcelas de empréstimo pelo sistema Price: valor da parcela, total pago, total de juros, taxa anual equivalente e tabela de amortização completa.",
  path: "/calculadoras/emprestimo/",
});

export default function CalculadoraEmprestimoPage() {
  return (
    <div
      data-track-area="ferramenta"
      data-track="emprestimo"
      className="mx-auto max-w-3xl px-4 py-8">
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: "Calculadoras", path: "/calculadoras/" },
          { name: "Empréstimo", path: "/calculadoras/emprestimo/" },
        ]}
      />
      <h1 className="mt-6 font-serif text-3xl font-bold text-brand-navy md:text-4xl">
        Calculadora de empréstimo
      </h1>
      <p className="mt-3 text-lg leading-relaxed text-brand-muted">
        Informe o valor, a taxa mensal e o número de parcelas para estimar
        quanto o empréstimo custaria pelo sistema Price (parcelas fixas). O
        resultado mostra a parcela, o total pago, o total de juros e a taxa
        anual equivalente.
      </p>

      <div className="mt-8">
        <LoanCalculator />
      </div>

      <ToolNextSteps toolId="emprestimo" />


      <section aria-labelledby="como-funciona" className="article-body mt-12">
        <h2 id="como-funciona">Como o cálculo é feito</h2>
        <p>
          A calculadora usa o <strong>sistema Price</strong>, o mais comum em
          empréstimos pessoais no Brasil: todas as parcelas têm o mesmo valor, e
          a fórmula considera juros compostos sobre o saldo devedor. A parcela é
          calculada assim:
        </p>
        <p>
          <code>parcela = valor × i ÷ (1 − (1 + i)⁻ⁿ)</code>
        </p>
        <p>
          Onde <code>i</code> é a taxa mensal em forma decimal (3% = 0,03) e{" "}
          <code>n</code> é o número de parcelas. A cada mês, parte da parcela
          paga os juros do saldo devedor e o restante amortiza a dívida — a
          tabela de amortização mostra essa divisão mês a mês.
        </p>
        <p>
          A conversão da taxa mensal para anual usa juros compostos:{" "}
          <code>anual = (1 + mensal)¹² − 1</code>. É por isso que 3% ao mês
          equivale a bem mais que 36% ao ano.
        </p>
        <h2 id="por-que-o-valor-real-difere">Por que o valor real pode ser diferente</h2>
        <p>
          A proposta de uma instituição inclui custos que esta estimativa não
          captura integralmente: IOF, tarifas, seguros e o efeito deles no{" "}
          <Link href="/juros-e-cet/o-que-e-cet/">Custo Efetivo Total (CET)</Link>
          . Ao comparar propostas reais, peça sempre o CET e o valor total a
          pagar — a taxa de juros sozinha não conta a história completa. Tem
          duas propostas em mãos? Coloque os números lado a lado no{" "}
          <Link href="/calculadoras/comparador-de-propostas/">comparador de propostas</Link>. Veja
          também <Link href="/juros-e-cet/como-calcular-juros-de-emprestimo/">como calcular juros de empréstimo</Link>{" "}
          e <Link href="/organizacao-financeira/como-comparar-propostas-de-credito/">como comparar propostas de crédito</Link>.
        </p>
      </section>
    </div>
  );
}
