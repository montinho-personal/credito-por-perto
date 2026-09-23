import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { webPageJsonLd } from "@/lib/schema/jsonld";
import { JsonLd } from "@/components/seo/JsonLd";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ToolNextSteps } from "@/components/journeys/ToolNextSteps";
import { SacPriceCalculator } from "@/components/calculators/SacPriceCalculator";
import {
  milestoneAt,
  simulateSacPrice,
  type SacPriceInput,
  type SacPriceResult,
} from "@/lib/calculators/sac-price";

/**
 * Página da calculadora SAC x Price.
 *
 * INTENÇÃO: calcular e comparar com os próprios números. O artigo
 * /juros-e-cet/price-ou-sac-sistemas-de-amortizacao/ é dono de "qual
 * escolher" (renda exigida, seguros MIP e DFI, troca de sistema). Os dois
 * se apontam e não repetem conteúdo — ver data/query-ownership-map.json.
 *
 * EXEMPLOS: todo número do texto sai do mesmo motor que a ferramenta usa,
 * no momento do build. Nenhum valor foi digitado à mão. A taxa dos exemplos
 * é ILUSTRATIVA, e o texto diz isso: o registro de séries do Banco Central
 * do portal não tem hoje a série de financiamento imobiliário.
 */

const PATH = "/calculadoras/sac-x-price/";
const TITLE = "Calculadora SAC x Price: compare parcelas e juros";
const DESCRIPTION =
  "Informe valor, taxa e prazo e compare SAC e Price: parcela mês a mês, juros totais, saldo devedor e tabela de amortização. Grátis e sem cadastro.";
const REVIEWED = "23/09/2026";

export const metadata: Metadata = buildMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
});

const CALC_CIDADAO_METODOLOGIA =
  "https://www3.bcb.gov.br/CALCIDADAO/publico/exibirMetodologiaFinanciamentoPrestacoesFixas.do?method=exibirMetodologiaFinanciamentoPrestacoesFixas";
const CAIXA_FAQ_HABITACAO =
  "https://www.caixa.gov.br/voce/habitacao/financiamento/perguntas-frequentes/Paginas/default.aspx";
const TCM_SP_AMORTIZACAO =
  "https://egcportalantigo.tcm.sp.gov.br/artigos/1705-sistemas-de-amortizacao-de-financiamentos-sac-price";
const RES_CMN_4881 =
  "https://www.bcb.gov.br/content/estabilidadefinanceira/especialnor/Resolu%C3%A7%C3%A3o4881.pdf";

function simulate(input: SacPriceInput): SacPriceResult | null {
  const outcome = simulateSacPrice(input);
  return outcome.kind === "ok" ? outcome.result : null;
}

const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const pct = (v: number, digits = 2) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/**
 * Tabela que continua legível a 320px: no celular, um cartão por linha; a
 * partir de 640px, tabela.
 */
function ComparisonTable({
  caption,
  head,
  rows,
}: {
  caption: string;
  head: string[];
  rows: Array<{ key: string; cells: string[] }>;
}) {
  return (
    <>
      <ul
        aria-label={caption}
        className="not-prose divide-y divide-brand-border rounded-xl border border-brand-border sm:hidden"
      >
        {rows.map((row) => (
          <li key={row.key} className="px-3 py-2.5">
            <p className="text-sm font-semibold text-brand-navy">{row.cells[0]}</p>
            <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-sm tabular-nums">
              {head.slice(1).map((h, i) => (
                <div key={h}>
                  <dt className="text-xs text-brand-muted">{h}</dt>
                  <dd className="font-semibold text-brand-text">{row.cells[i + 1]}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
      <div className="not-prose hidden overflow-x-auto rounded-xl border border-brand-border sm:block">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-brand-surface-soft text-left">
            <tr>
              {head.map((h, i) => (
                <th
                  key={h}
                  scope="col"
                  className={`px-3 py-2 font-semibold text-brand-navy ${i > 0 ? "text-right" : ""}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-brand-border">
                <th scope="row" className="px-3 py-2 text-left font-medium">
                  {row.cells[0]}
                </th>
                {row.cells.slice(1).map((c, i) => (
                  <td key={i} className="px-3 py-2 text-right">
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function SacPricePage() {
  /* Exemplo da página: o mesmo do botão "Preencher com um exemplo". */
  const RATE = 1;
  const base: SacPriceInput = { principalCents: 300_000_00, ratePercent: RATE, rateUnit: "am", months: 360 };
  const main = simulate(base);
  const fiveYears = main ? milestoneAt(main, 60, "") : null;
  const half = main ? milestoneAt(main, main.middleMonth, "") : null;
  const termRows = [120, 240, 360, 420].flatMap((months) => {
    const result = simulate({ ...base, months });
    return result ? [{ months, result }] : [];
  });
  const annualOf1 = (Math.pow(1.01, 12) - 1) * 100;
  const rateLabel = `${pct(RATE)}% ao mês (${pct(annualOf1)}% ao ano), uma taxa apenas ilustrativa`;

  return (
    <div data-track-area="ferramenta" data-track="sac-x-price" className="mx-auto max-w-3xl px-4 py-8">
      <JsonLd data={webPageJsonLd(TITLE, DESCRIPTION, PATH)} />
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: "Calculadoras", path: "/calculadoras/" },
          { name: "SAC x Price", path: PATH },
        ]}
      />

      <h1 className="mt-6 font-serif text-3xl font-bold leading-tight text-brand-navy md:text-4xl">
        Calculadora SAC x Price
      </h1>
      <p className="mt-3 text-lg leading-relaxed text-brand-muted">
        Informe valor, taxa e prazo para comparar parcelas, juros e saldo devedor nos dois sistemas.
      </p>

      <div className="mt-6">
        <SacPriceCalculator context="ferramenta" />
      </div>

      <ToolNextSteps toolId="sac-x-price" />

      <section aria-labelledby="como-funciona" className="article-body mt-12">
        <h2 id="como-funciona">Como funciona a calculadora SAC x Price</h2>
        <p>
          Você informa o valor financiado — ou o valor do bem e a entrada —, a taxa de juros e o prazo.
          A calculadora monta as duas tabelas de amortização mês a mês e as coloca lado a lado: a
          primeira e a última parcela, os juros do contrato inteiro, o saldo devedor em cada momento
          e o mês em que a parcela da SAC passa a ficar abaixo da Price. Ela não diz qual sistema
          assinar. Para as perguntas que decidem isso — renda exigida, seguros, troca de sistema —,
          veja{" "}
          <Link href="/juros-e-cet/price-ou-sac-sistemas-de-amortizacao/">
            Price ou SAC: o que muda na sua dívida
          </Link>
          .
        </p>

        <h2 id="diferenca">A diferença entre SAC e Price</h2>
        <p>
          Toda parcela tem duas partes: a <strong>amortização</strong>, que reduz a dívida, e os{" "}
          <strong>juros</strong>, calculados sobre o saldo que falta pagar. Na <strong>SAC</strong> a
          amortização é a mesma todo mês; como o saldo cai, os juros caem, e a parcela diminui ao
          longo do contrato. Na <strong>Price</strong> a parcela é a mesma do começo ao fim; no início
          ela é quase toda juros, e a amortização cresce mês a mês. As duas definições são as usadas
          pela{" "}
          <a href={CAIXA_FAQ_HABITACAO} target="_blank" rel="noopener noreferrer">
            Caixa no crédito habitacional
          </a>
          .
        </p>

        {main && fiveYears && half ? (
          <>
            <h2 id="exemplo">Um exemplo com números</h2>
            <p>
              {brl(main.principalCents)} financiados em 360 meses, a {rateLabel}:
            </p>
            <ComparisonTable
              caption={`SAC e Price para ${brl(main.principalCents)} em 360 meses`}
              head={["Item", "Price", "SAC"]}
              rows={[
                { key: "primeira", cells: ["1ª parcela", brl(main.price.firstPaymentCents), brl(main.sac.firstPaymentCents)] },
                { key: "ultima", cells: ["Última parcela", brl(main.price.lastPaymentCents), brl(main.sac.lastPaymentCents)] },
                { key: "juros", cells: ["Juros no total", brl(main.price.totalInterestCents), brl(main.sac.totalInterestCents)] },
                { key: "total", cells: ["Total das parcelas", brl(main.price.totalPaidCents), brl(main.sac.totalPaidCents)] },
                { key: "cinco", cells: ["Saldo após 5 anos", brl(fiveYears.price.balanceCents), brl(fiveYears.sac.balanceCents)] },
              ]}
            />
            <p>
              A SAC começa {brl(main.sac.firstPaymentCents - main.price.firstPaymentCents)} mais cara por
              mês e soma {brl(main.price.totalInterestCents - main.sac.totalInterestCents)} a menos de
              juros no contrato inteiro.
              {main.crossoverMonth !== null
                ? ` A virada acontece na parcela nº ${main.crossoverMonth}: dali em diante, a parcela da SAC é menor que a da Price.`
                : ""}{" "}
              Na metade do prazo, a SAC já amortizou {pct(half.sac.amortizedShare * 100, 0)}% da dívida, e a
              Price, {pct(half.price.amortizedShare * 100, 0)}% — o SAC{" "}
              <a href={TCM_SP_AMORTIZACAO} target="_blank" rel="noopener noreferrer">
                amortiza de forma proporcional ao tempo
              </a>
              , e a Price concentra a amortização no fim.
            </p>
          </>
        ) : null}

        <h2 id="por-que-juros">Por que a SAC soma menos juros</h2>
        <p>
          Porque juros incidem sobre o saldo devedor, e na SAC o saldo cai mais rápido desde o
          primeiro mês. Com o mesmo valor, a mesma taxa e o mesmo prazo, ela paga juros sobre uma
          dívida menor em quase todos os meses — e a soma fica menor. O preço disso é a parcela
          inicial mais alta. Na Price, a parcela menor no começo significa amortizar pouco nos
          primeiros anos, e os juros continuam incidindo sobre um saldo que demora a cair.
        </p>
        <p>
          Menos juros no total e parcela menor no começo são respostas a perguntas diferentes. Qual
          pesa mais depende do orçamento de cada pessoa — a calculadora mostra os dois lados em reais.
        </p>

        {termRows.length > 1 ? (
          <>
            <h2 id="prazo">O prazo muda o tamanho da diferença</h2>
            <p>Mesmo valor e mesma taxa ilustrativa; só o prazo muda:</p>
            <ComparisonTable
              caption="Primeira parcela e juros totais de SAC e Price em prazos diferentes"
              head={["Prazo", "1ª parcela Price", "1ª parcela SAC", "Juros Price", "Juros SAC"]}
              rows={termRows.map(({ months, result }) => ({
                key: String(months),
                cells: [
                  `${months} meses (${months / 12} anos)`,
                  brl(result.price.firstPaymentCents),
                  brl(result.sac.firstPaymentCents),
                  brl(result.price.totalInterestCents),
                  brl(result.sac.totalInterestCents),
                ],
              }))}
            />
            <p>
              Quanto mais longo o prazo, maior a distância entre os juros dos dois sistemas: a Price
              passa mais anos amortizando pouco. Prazo longo também faz a parcela da Price cair menos
              do que parece, porque a maior parte dela continua sendo juro.
            </p>
          </>
        ) : null}

        <h2 id="taxa">Taxa ao mês, ao ano, nominal e efetiva</h2>
        <p>
          A calculadora aceita a taxa ao mês ou ao ano e converte uma na outra por equivalência de
          juros compostos: 1% ao mês equivale a {pct(annualOf1)}% ao ano, não a 12%. Contratos de
          imóvel costumam mostrar duas taxas anuais: a <strong>efetiva</strong>, que é a que se
          informa com a opção &ldquo;ao ano&rdquo;, e a <strong>nominal</strong>, que é a taxa do mês
          multiplicada por 12 — para usar a nominal, divida por 12 e informe como taxa ao mês. Para
          converter qualquer taxa, use o{" "}
          <Link href="/calculadoras/conversor-de-taxas/">conversor de taxas</Link>.
        </p>

        <h2 id="nao-incluido">O que a calculadora não inclui</h2>
        <p>
          A conta usa taxa fixa e saldo sem correção. Um contrato real pode ter mais coisa dentro da
          parcela. No crédito habitacional da Caixa, por exemplo, o encargo mensal reúne amortização,
          juros, tarifa de administração (quando devida) e os seguros MIP (morte e invalidez
          permanente) e DFI (danos físicos no imóvel), e o MIP é apurado sobre o saldo devedor,{" "}
          <a href={CAIXA_FAQ_HABITACAO} target="_blank" rel="noopener noreferrer">
            segundo a própria Caixa
          </a>
          . Contratos com índice de atualização do saldo devedor, como a TR ou o IPCA, também mudam
          as parcelas ao longo do tempo. Nada disso está na simulação.
        </p>
        <p>
          O campo opcional de custos aceita um valor mensal fixo e um valor pago à parte, que entram
          iguais nos dois sistemas. O resultado com eles é uma estimativa com os valores informados,
          não o <strong>CET</strong> — o Custo Efetivo Total, que a{" "}
          <a href={RES_CMN_4881} target="_blank" rel="noopener noreferrer">
            Resolução CMN nº 4.881/2020
          </a>{" "}
          obriga a instituição a informar antes da contratação. Entenda o número em{" "}
          <Link href="/juros-e-cet/o-que-e-cet/">o que é CET</Link>.
        </p>

        <h2 id="veiculo-e-emprestimo">E para veículo ou empréstimo?</h2>
        <p>
          A conta vale para qualquer financiamento nos dois sistemas. Na prática, financiamento de
          veículo, empréstimo pessoal e consignado costumam ter parcela fixa — o desenho da Price.
          Para simular um veículo com entrada, prazo e custos da proposta, use o{" "}
          <Link href="/calculadoras/financiamento-veiculo/">simulador de financiamento de veículo</Link>
          ; para um empréstimo, a{" "}
          <Link href="/calculadoras/emprestimo/">calculadora de empréstimo</Link>.
        </p>

        <h2 id="perguntas-frequentes">Perguntas frequentes</h2>

        <h3>Como calcular a parcela na Price e na SAC?</h3>
        <p>
          Na Price, a parcela é valor financiado × i ÷ [1 − (1 + i)<sup>−n</sup>], em que i é a taxa
          mensal em decimal e n o número de parcelas. Na SAC, a amortização é o valor financiado
          dividido por n, e a parcela de cada mês é essa amortização mais os juros do mês — o saldo
          devedor anterior × i. Com taxa zero, os dois dão parcelas iguais: o valor dividido pelo
          prazo.
        </p>

        <h3>A SAC sempre paga menos juros?</h3>
        <p>
          Com o mesmo valor, a mesma taxa e o mesmo prazo, sim: o saldo cai mais rápido e os juros
          incidem sobre um saldo menor. Se as propostas tiverem taxas, prazos ou custos diferentes, a
          comparação precisa ser feita com os números de cada uma — de preferência pelo CET.
        </p>

        <h3>Por que a primeira parcela da SAC é maior?</h3>
        <p>
          Porque ela já amortiza a mesma fatia da dívida que vai amortizar no último mês, e soma os
          juros sobre o saldo inteiro. Na Price, a primeira parcela amortiza pouco — a maior parte
          dela é juro — e por isso fica menor.
        </p>

        <h3>Em que momento a parcela da SAC fica menor que a da Price?</h3>
        <p>
          Depende da taxa e do prazo. A calculadora mostra o número exato da parcela da virada e a
          marca no gráfico.
          {main?.crossoverMonth
            ? ` No exemplo desta página, é a parcela nº ${main.crossoverMonth}.`
            : ""}
        </p>

        <h3>Qual é melhor para quem vai quitar antes?</h3>
        <p>
          A calculadora não responde &ldquo;qual é melhor&rdquo;, mas mostra o dado que pesa nessa
          conta: o saldo devedor em cada momento, que na SAC é menor. Para ver quanto de juros uma
          antecipação corta, use a{" "}
          <Link href="/calculadoras/quitacao-antecipada/">calculadora de quitação antecipada</Link>.
        </p>

        <h3>O resultado é igual ao do banco?</h3>
        <p>
          Não necessariamente. A simulação usa só a taxa, o prazo e os custos que você informar; o
          contrato pode ter seguros, tarifas e correção do saldo. Use o resultado para entender a conta
          e comparar com as simulações que a instituição fornecer — o número que vale é o do contrato.
        </p>

        <h2 id="como-calculamos">Como calculamos</h2>
        <p>
          <strong>Price:</strong> prestações fixas, com juros compostos e capitalização mensal — a
          mesma formulação da Calculadora do Cidadão do Banco Central para financiamento com
          prestações fixas. <strong>SAC:</strong> amortização constante igual ao valor financiado
          dividido pelo prazo, com juros do mês sobre o saldo anterior.
        </p>
        <p>
          <strong>Taxa:</strong> quando informada ao ano, é convertida para a mensal equivalente,
          (1 + anual)<sup>1/12</sup> − 1. Nunca dividimos por 12.
        </p>
        <p>
          <strong>Arredondamento:</strong> a parcela da Price e a amortização da SAC são arredondadas
          ao centavo, e os juros de cada mês também. A última parcela, nos dois sistemas, acerta a
          diferença para o saldo terminar exatamente em zero e os totais baterem com a soma da tabela.
          Em prazo muito longo, os centavos arredondados rendem juros até o fim, e esse ajuste pode
          chegar a alguns reais — a tabela mostra o valor exato.
        </p>
        <p>
          <strong>Conferência:</strong> os cálculos são testados contra referências calculadas à
          parte, com precisão de 60 dígitos, e contra simulações publicadas — entre elas, uma SAC de
          R$ 110.500 em 360 meses a 0,72% ao mês, com 1ª parcela de R$ 1.102,54.
        </p>
        <p>
          <strong>Privacidade:</strong> o cálculo acontece no seu navegador. Nenhum valor digitado é
          enviado, gravado ou usado em medição de audiência.
        </p>

        <h2 id="fontes">Fontes e metodologia</h2>
        <ul>
          <li>
            Banco Central do Brasil —{" "}
            <a href={CALC_CIDADAO_METODOLOGIA} target="_blank" rel="noopener noreferrer">
              Calculadora do Cidadão: metodologia do financiamento com prestações fixas
            </a>
            .
          </li>
          <li>
            Caixa Econômica Federal —{" "}
            <a href={CAIXA_FAQ_HABITACAO} target="_blank" rel="noopener noreferrer">
              perguntas frequentes do financiamento habitacional
            </a>{" "}
            (definições de SAC e Price e composição do encargo mensal).
          </li>
          <li>
            Tribunal de Contas do Município de São Paulo —{" "}
            <a href={TCM_SP_AMORTIZACAO} target="_blank" rel="noopener noreferrer">
              Sistemas de amortização de financiamentos: SAC e Price
            </a>
            .
          </li>
          <li>
            Conselho Monetário Nacional —{" "}
            <a href={RES_CMN_4881} target="_blank" rel="noopener noreferrer">
              Resolução nº 4.881/2020
            </a>
            , sobre o cálculo e a informação do Custo Efetivo Total.
          </li>
        </ul>
        <p>
          Conteúdo e ferramenta da Equipe Editorial do Crédito por Perto, que não concede crédito, não
          indica instituição e não recebe por nenhuma contratação. Encontrou algo errado? Veja a{" "}
          <Link href="/politica-de-correcoes/">política de correções</Link>. Metodologia revisada em{" "}
          {REVIEWED}.
        </p>
      </section>
    </div>
  );
}
