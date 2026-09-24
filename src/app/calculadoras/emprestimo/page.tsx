import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { webPageJsonLd } from "@/lib/schema/jsonld";
import { LoanCalculator } from "@/components/calculators/LoanCalculator";
import { ToolNextSteps } from "@/components/journeys/ToolNextSteps";
import { pricePayment } from "@/lib/calculators/loan";

/**
 * INTENÇÃO: calcular agora quanto custaria um empréstimo a partir de valor,
 * taxa e prazo (parcela, juros, total pago). "Simulador de empréstimo" entra
 * como variação no texto, sem prometer oferta. Donos vizinhos: o artigo
 * "como calcular juros de empréstimo" explica a conta; o comparador compara
 * propostas já recebidas; a calculadora de CET calcula o custo efetivo; a
 * margem consignável cuida do consignado. Ver data/query-ownership-map.json.
 */

const brl = (reais: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Math.round(reais * 100) / 100);

/**
 * Exemplos do texto: a mesma fórmula e o mesmo arredondamento da calculadora
 * (parcela exata × prazo, arredondado só na exibição), com taxas hipotéticas.
 */
function example(principal: number, monthlyRate: number, n: number) {
  const installment = pricePayment(principal, monthlyRate, n);
  return { installment, total: installment * n, interest: installment * n - principal };
}

const PATH = "/calculadoras/emprestimo/";
const TITLE = "Calculadora de empréstimo: parcelas, juros e total pago";
const DESCRIPTION =
  "Informe valor, taxa de juros e número de parcelas e simule o empréstimo: veja a parcela mensal, os juros e o total pago. Grátis e sem CPF.";

export const metadata: Metadata = buildMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

export default function CalculadoraEmprestimoPage() {
  const a = example(10_000, 0.02, 24);
  const b = example(10_000, 0.04, 24);
  const c = example(10_000, 0.02, 36);
  return (
    <div
      data-track-area="ferramenta"
      data-track="emprestimo"
      className="mx-auto max-w-3xl px-4 py-8">
      <JsonLd data={webPageJsonLd(TITLE, DESCRIPTION, PATH)} />
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
        Simule um empréstimo de qualquer valor: informe quanto quer pegar, a taxa
        de juros ao mês e o número de parcelas. A calculadora mostra quanto fica
        a parcela mensal, quanto você paga de juros e quanto devolve no total,
        além da taxa anual equivalente. Parcelas fixas, pela Tabela Price. Sem
        cadastro e sem CPF.
      </p>

      <div className="mt-8">
        <LoanCalculator />
      </div>

      <ToolNextSteps toolId="emprestimo" />


      <section aria-labelledby="como-funciona" className="article-body mt-12">
        <h2 id="como-funciona">Como é calculada a parcela do empréstimo</h2>
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
        <p>
          O valor sozinho não diz quanto fica a parcela: é preciso saber a taxa e
          o prazo. Com taxas hipotéticas, só para mostrar o efeito, R$ 10 mil em
          24 parcelas ficam em {brl(a.installment)} por mês a 2% ao mês e em{" "}
          {brl(b.installment)} a 4% ao mês. Aumentar o prazo reduz a parcela e
          aumenta os juros: os mesmos R$ 10 mil a 2% ao mês em 36 parcelas
          custam {brl(c.installment)} por mês, mas os juros totais sobem de{" "}
          {brl(a.interest)} para {brl(c.interest)}. Para testar o seu caso,
          informe a taxa da sua proposta na calculadora acima.
        </p>
        <p>
          Vai financiar um carro ou uma moto? O{" "}
          <Link href="/calculadoras/financiamento-veiculo/">simulador de financiamento de veículo</Link>{" "}
          usa a mesma conta, mas parte do preço do veículo e da entrada, e mostra o total que sai
          do seu bolso somando as duas coisas.
        </p>
        <h2 id="por-que-o-valor-real-difere">Por que a simulação do banco pode ser diferente</h2>
        <p>
          Esta calculadora é uma estimativa com a taxa de juros que você informa.
          A proposta de uma instituição inclui custos que ela não captura
          integralmente: IOF, tarifas, seguros e o efeito deles no{" "}
          <Link href="/juros-e-cet/o-que-e-cet/">Custo Efetivo Total (CET)</Link>
          , a taxa que resume o custo completo da operação. Por isso a parcela ou o
          total do contrato podem sair maiores que a simulação, e o valor que cai
          na conta pode ser menor que o valor pedido. Taxa de juros e CET não são a
          mesma coisa: numa proposta real, peça sempre o CET e o valor total a
          pagar. Já tem duas propostas em mãos? Coloque os números lado a lado no{" "}
          <Link href="/calculadoras/comparador-de-propostas/">comparador de propostas de empréstimo</Link>. Para
          entender a conta passo a passo, veja{" "}
          <Link href="/juros-e-cet/como-calcular-juros-de-emprestimo/">como calcular juros de empréstimo</Link>{" "}
          e <Link href="/organizacao-financeira/como-comparar-propostas-de-credito/">como comparar propostas de crédito</Link>.
        </p>
      </section>
    </div>
  );
}
