import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { webPageJsonLd } from "@/lib/schema/jsonld";
import { JsonLd } from "@/components/seo/JsonLd";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ToolNextSteps } from "@/components/journeys/ToolNextSteps";
import {
  VehicleFinancingSimulator,
  type VehicleRateReference,
} from "@/components/calculators/VehicleFinancingSimulator";
import { getBcbRates, formatRefMonth } from "@/lib/bcb/rates-service";
import { formatBRL } from "@/lib/calculators/loan";
import {
  compareTerms,
  simulateVehicleFinancing,
  type VehicleFinancingInput,
  type VehicleFinancingResult,
} from "@/lib/calculators/vehicle-financing";

/**
 * Página do simulador de financiamento de veículo.
 *
 * INTENÇÃO: simular. O artigo /emprestimos/financiamento-de-veiculo/ é dono
 * de "como funciona" (alienação fiduciária, atraso, busca e apreensão). Os
 * dois se apontam e não repetem conteúdo — ver data/query-ownership-map.json.
 *
 * DADOS DO BANCO CENTRAL: a mesma busca do Radar de taxas e do "Minha taxa
 * está cara?" (série SGS 25471, aquisição de veículos, PF), no servidor, com
 * revalidação diária. Sem dado válido, a página não inventa referência: o
 * simulador omite a comparação e aponta para o Radar.
 *
 * EXEMPLOS: todo número do texto sai do mesmo motor que a ferramenta usa,
 * no momento da renderização. Nenhum valor foi digitado à mão.
 */

/** Revalidação diária: a série do BC é mensal. */
export const revalidate = 86400;

const PATH = "/calculadoras/financiamento-veiculo/";
const TITLE = "Simulador de financiamento de veículo: parcela e juros";
const DESCRIPTION =
  "Valor, entrada, taxa e prazo: veja parcela, juros e o total que sai do bolso, e compare com a média do Banco Central. Carro ou moto, sem cadastro.";
const REVIEWED = "23/09/2026";

export const metadata: Metadata = buildMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
});

const CALC_CIDADAO_METODOLOGIA =
  "https://www3.bcb.gov.br/CALCIDADAO/publico/exibirMetodologiaFinanciamentoPrestacoesFixas.do?method=exibirMetodologiaFinanciamentoPrestacoesFixas";
const RES_CMN_4881 =
  "https://www.bcb.gov.br/content/estabilidadefinanceira/especialnor/Resolu%C3%A7%C3%A3o4881.pdf";

function simulate(input: VehicleFinancingInput): VehicleFinancingResult | null {
  const outcome = simulateVehicleFinancing(input);
  return outcome.kind === "ok" ? outcome.result : null;
}

const pct = (v: number, digits = 2) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/**
 * Tabela de comparação que continua legível a 320px. No celular vira um
 * cartão por linha; a partir de 640px, tabela. A coluna que carrega a
 * conclusão (os juros) é a última — numa tabela com rolagem lateral, era
 * justamente a que ficava escondida.
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
                <th scope="row" className="px-3 py-2 text-left font-medium">{row.cells[0]}</th>
                {row.cells.slice(1).map((c, i) => (
                  <td key={i} className="px-3 py-2 text-right">{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default async function FinanciamentoVeiculoPage() {
  const rates = await getBcbRates();
  const series = rates.series.find((s) => s.internalId === "veiculos");
  const reference: VehicleRateReference | null = series
    ? {
        monthlyRatePercent: series.latest.value,
        refMonthLabel: formatRefMonth(series.latest.refMonth),
        sourceUrl: series.sourceUrl,
        seriesCode: series.monthlySeries,
      }
    : null;

  /* Taxa dos exemplos: a média oficial mais recente, quando existe. Sem ela,
     uma taxa ILUSTRATIVA — e o texto diz qual das duas está em uso. */
  const exampleRate = reference ? Math.round(reference.monthlyRatePercent * 100) / 100 : 1.8;
  const rateLabel = reference
    ? `${pct(exampleRate)}% ao mês, a taxa média do Banco Central para aquisição de veículos em ${reference.refMonthLabel}`
    : `${pct(exampleRate)}% ao mês, uma taxa apenas ilustrativa`;

  const car = { vehiclePrice: 80_000, ratePercent: exampleRate, rateUnit: "am" as const, months: 48 };
  const downRows = [0, 20_000, 40_000].map((downPayment) => ({
    downPayment,
    result: simulate({ ...car, downPayment }),
  }));
  const termRows = compareTerms({
    vehiclePrice: 60_000,
    downPayment: 0,
    ratePercent: exampleRate,
    rateUnit: "am",
    months: 48,
  });
  const main = simulate({ ...car, downPayment: 20_000 });
  const annualOf18 = (Math.pow(1.018, 12) - 1) * 100;

  return (
    <div
      data-track-area="ferramenta"
      data-track="financiamento-veiculo"
      className="mx-auto max-w-3xl px-4 py-8"
    >
      <JsonLd data={webPageJsonLd(TITLE, DESCRIPTION, PATH)} />
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: "Calculadoras", path: "/calculadoras/" },
          { name: "Financiamento de veículo", path: PATH },
        ]}
      />

      <h1 className="mt-6 font-serif text-3xl font-bold leading-tight text-brand-navy md:text-4xl">
        Simulador de financiamento de veículo
      </h1>
      <p className="mt-3 text-lg leading-relaxed text-brand-muted">
        Informe o valor do veículo, a entrada, a taxa e o prazo para estimar a parcela, os juros e
        quanto você pagará no total.
      </p>

      <div className="mt-6">
        <VehicleFinancingSimulator reference={reference} context="ferramenta" />
      </div>

      <ToolNextSteps toolId="financiamento-veiculo" />

      <section aria-labelledby="como-funciona" className="article-body mt-12">
        <h2 id="como-funciona">Como funciona o simulador de financiamento de veículo</h2>
        <p>
          Você informa quatro números — valor do veículo, entrada, taxa de juros e prazo — e o
          simulador calcula a parcela fixa, quanto dela é juro e quanto sai do seu bolso no total,
          somando a entrada. Serve para carro, moto ou qualquer veículo financiado com prestações
          fixas. Para entender o contrato em si — a alienação fiduciária, o que acontece se atrasar
          e por que o veículo fica em garantia —, veja o guia de{" "}
          <Link href="/emprestimos/financiamento-de-veiculo/">financiamento de veículo</Link>.
        </p>

        <h2 id="como-a-parcela-e-calculada">Como a parcela é calculada</h2>
        <p>
          O simulador usa <strong>prestações fixas</strong>, o chamado sistema Price: todas as
          parcelas têm o mesmo valor, e os juros de cada mês incidem sobre o que ainda falta pagar.
          No começo, a dívida é grande, então a maior parte da parcela é juro; perto do fim, quase
          tudo reduz a dívida. A tabela &ldquo;Ver evolução do financiamento&rdquo; mostra essa
          virada mês a mês.
        </p>
        <p>
          Nem todo contrato é feito assim — há financiamentos com amortização constante (SAC), com
          parcelas decrescentes. A diferença entre os dois está em{" "}
          <Link href="/juros-e-cet/price-ou-sac-sistemas-de-amortizacao/">Price ou SAC</Link>, e a{" "}
          <Link href="/calculadoras/sac-x-price/">calculadora SAC x Price</Link> compara os dois com
          os mesmos números. Se o seu contrato não tiver parcelas fixas, esta simulação não o
          representa.
        </p>

        <h2 id="entrada">Como a entrada muda o financiamento</h2>
        <p>
          Cada real de entrada é um real que não fica devendo — e que, portanto, não paga juros
          pelo prazo inteiro. Veja um carro de R$ 80 mil em 48 meses, a {rateLabel}:
        </p>
        <ComparisonTable
          caption="Efeito da entrada num carro de R$ 80 mil em 48 meses"
          head={["Entrada", "Financiado", "Parcela", "Juros"]}
          rows={downRows.flatMap(({ downPayment, result }) =>
            result
              ? [
                  {
                    key: String(downPayment),
                    cells: [
                      downPayment === 0 ? "Sem entrada" : formatBRL(downPayment),
                      formatBRL(result.financedAmount),
                      formatBRL(result.payment),
                      formatBRL(result.totalInterest),
                    ],
                  },
                ]
              : [],
          )}
        />
        {downRows[0]?.result && downRows[2]?.result ? (
          <p>
            Entre financiar tudo e dar R$ 40 mil de entrada, os juros caem de{" "}
            {formatBRL(downRows[0].result.totalInterest)} para{" "}
            {formatBRL(downRows[2].result.totalInterest)}. Dar mais entrada, porém, tira dinheiro
            de outro lugar: vale olhar antes para a sua{" "}
            <Link href="/organizacao-financeira/reserva-de-emergencia/">reserva de emergência</Link>
            , porque um imprevisto sem reserva costuma virar dívida mais cara que o financiamento.
          </p>
        ) : null}

        <h2 id="prazo">Prazo maior diminui a parcela. E os juros?</h2>
        <p>
          Aumentam. Com R$ 60 mil financiados, na mesma taxa, só o prazo muda:
        </p>
        <ComparisonTable
          caption="Parcela e juros de R$ 60 mil financiados em prazos diferentes"
          head={["Prazo", "Parcela", "Juros", "Total das parcelas"]}
          rows={termRows.map((row) => ({
            key: String(row.months),
            cells: [
              `${row.months} meses`,
              formatBRL(row.result.payment),
              formatBRL(row.result.totalInterest),
              formatBRL(row.result.totalInstallments),
            ],
          }))}
        />
        {termRows.length >= 2 ? (
          <p>
            De {termRows[0]!.months} para {termRows[termRows.length - 1]!.months} meses, a parcela
            cai de {formatBRL(termRows[0]!.result.payment)} para{" "}
            {formatBRL(termRows[termRows.length - 1]!.result.payment)} — e os juros vão de{" "}
            {formatBRL(termRows[0]!.result.totalInterest)} para{" "}
            {formatBRL(termRows[termRows.length - 1]!.result.totalInterest)}. A parcela menor é
            paga por mais tempo, sobre uma dívida que demora mais a diminuir. Os números acima usam{" "}
            {rateLabel}.
          </p>
        ) : null}

        <h2 id="taxa-mensal-anual">Taxa ao mês e taxa ao ano são a mesma coisa?</h2>
        <p>
          Não, e a conversão não é multiplicar por 12. Juros compostos incidem sobre juros: 1,80% ao
          mês equivale a {pct(annualOf18)}% ao ano, não a 21,60%. O simulador aceita as duas
          formas e faz a conversão pela taxa equivalente — basta marcar &ldquo;ao mês&rdquo; ou
          &ldquo;ao ano&rdquo; conforme estiver na proposta. Para converter qualquer taxa, use o{" "}
          <Link href="/calculadoras/conversor-de-taxas/">conversor de taxas</Link>.
        </p>

        <h2 id="parcela-e-cet">Parcela e CET: qual a diferença?</h2>
        <p>
          A parcela é quanto você paga por mês. O <strong>CET (Custo Efetivo Total)</strong> é o
          custo da operação inteira, em taxa anual: soma os juros e os outros encargos cobrados do
          cliente — tributos, tarifas, seguros e demais despesas. A{" "}
          <a href={RES_CMN_4881} target="_blank" rel="noopener noreferrer">
            Resolução CMN nº 4.881/2020
          </a>{" "}
          obriga a instituição a informá-lo antes da contratação. Este simulador trabalha só com a
          taxa e os custos que você informar; o CET oficial é o da proposta. Entenda o número em{" "}
          <Link href="/juros-e-cet/o-que-e-cet/">o que é CET</Link>.
        </p>

        <h2 id="diferente-do-banco">Por que a simulação pode ser diferente da proposta</h2>
        <p>Porque a proposta real inclui o que nenhum simulador genérico conhece:</p>
        <ul>
          <li>o <strong>CET</strong>, com tributos, tarifas e seguros que entram na conta;</li>
          <li>tarifas de cadastro ou de avaliação do veículo, quando cobradas;</li>
          <li>seguros vinculados à operação;</li>
          <li>a taxa oferecida ao <strong>seu perfil</strong>, que sai da análise de crédito;</li>
          <li>o valor da entrada e o prazo que a instituição aceita;</li>
          <li>as condições do veículo — novo ou usado, ano, modelo;</li>
          <li>a política de cada instituição.</li>
        </ul>
        <p>
          Se você já conhece algum desses custos, inclua em &ldquo;Incluir custos que você já
          conhece&rdquo;. O simulador não acrescenta nada por conta própria.
        </p>

        <h2 id="comparar-propostas">Como comparar duas propostas de financiamento</h2>
        <p>
          Pelo CET e pelo total a pagar, no mesmo prazo — nunca pela parcela. Duas propostas com a
          mesma parcela podem ter prazos e custos totais diferentes. O{" "}
          <Link href="/calculadoras/comparador-de-propostas/">comparador de propostas</Link> coloca
          as duas lado a lado. Para saber se a taxa está longe da média do mercado, o{" "}
          <Link href="/calculadoras/minha-taxa-esta-cara/">Minha taxa está cara?</Link> compara com
          a referência do Banco Central, e o <Link href="/taxas/">Radar de taxas</Link> mostra como
          ela vem se movendo. O método completo está em{" "}
          <Link href="/organizacao-financeira/como-comparar-propostas-de-credito/">
            como comparar propostas de crédito
          </Link>
          .
        </p>

        <h2 id="perguntas-frequentes">Perguntas frequentes</h2>

        <h3>Como calcular o financiamento de um veículo?</h3>
        <p>
          Subtraia a entrada do valor do veículo para chegar ao valor financiado. A parcela fixa é
          valor financiado × i ÷ [1 − (1 + i)<sup>−n</sup>], em que i é a taxa mensal em decimal e n
          o número de parcelas. O total das parcelas menos o valor financiado dá os juros. O
          simulador faz essa conta e mostra também a tabela mês a mês.
        </p>

        {main ? (
          <>
            <h3>Quanto fica a parcela de um carro de R$ 80 mil?</h3>
            <p>
              Depende da entrada, da taxa e do prazo. Com R$ 20 mil de entrada, em 48 meses, a{" "}
              {rateLabel}, a parcela estimada fica em {formatBRL(main.payment)}, com{" "}
              {formatBRL(main.totalInterest)} de juros e {formatBRL(main.totalOutlay)} desembolsados
              no total, somando a entrada. Com a sua proposta, a conta muda — use o simulador acima.
            </p>
          </>
        ) : null}

        <h3>Vale a pena dar uma entrada maior?</h3>
        <p>
          Matematicamente, mais entrada significa menos juros, como mostra a tabela acima. Se vale a
          pena depende do que esse dinheiro faria no seu caso — sobretudo se ele é a sua reserva
          para imprevistos. O simulador mostra a consequência em reais; a decisão é sua.
        </p>

        <h3>É melhor financiar em 48 ou 60 meses?</h3>
        <p>
          Em 60 meses a parcela é menor e os juros totais são maiores; em 48, o contrário. Não
          existe resposta única: a parcela precisa caber no mês com folga, e a diferença de juros
          precisa valer o alívio mensal. A tabela &ldquo;Mesmo veículo, prazos diferentes&rdquo;,
          no resultado, mostra os dois lados com os seus números. Para testar a parcela no seu
          orçamento, use{" "}
          <Link href="/calculadoras/parcela-no-orcamento/">parcela no orçamento</Link>.
        </p>

        <h3>Financiamento sem entrada existe?</h3>
        <p>
          O simulador aceita entrada zero: basta deixar o campo vazio. Se a instituição financia
          100% do valor, e em que condições, depende da política dela e da análise de crédito.
          Financiar tudo significa pagar juros sobre o valor inteiro do veículo.
        </p>

        <h3>O simulador funciona para moto?</h3>
        <p>
          Sim. A conta de prestações fixas é a mesma para carro, moto ou outro veículo. O que muda
          de um para outro são a taxa e os prazos que cada instituição oferece — informe os da sua
          proposta.
        </p>

        <h3>O resultado é igual ao do banco?</h3>
        <p>
          Não necessariamente. A simulação usa a taxa e os custos que você informar; a proposta
          inclui encargos que só a instituição conhece e que aparecem no CET. Use o resultado para
          entender a conta e fazer perguntas — o número que vale é o do contrato.
        </p>

        <h3>Qual taxa usar no simulador?</h3>
        <p>
          A da sua proposta, na unidade em que ela aparece (ao mês ou ao ano). Sem proposta ainda,
          dá para partir da taxa média do Banco Central para aquisição de veículos — o simulador
          oferece esse atalho quando o dado está disponível —, sabendo que a média não é a taxa
          que você vai receber.
        </p>

        <h3>Como saber se a taxa está alta?</h3>
        <p>
          Comparando com a referência certa: a média do Banco Central para a mesma modalidade, no
          mesmo período. Depois de calcular, o simulador mostra essa comparação; o{" "}
          <Link href="/calculadoras/minha-taxa-esta-cara/">Minha taxa está cara?</Link> faz a
          análise completa. A média é referência para perguntar, não veredito: a taxa de cada
          pessoa depende de perfil, entrada, prazo, veículo e instituição.
        </p>

        <h2 id="como-calculamos">Como calculamos</h2>
        <p>
          <strong>Sistema:</strong> prestações fixas (Price), com juros compostos e capitalização
          mensal — a mesma formulação da Calculadora do Cidadão do Banco Central para financiamento
          com prestações fixas. Com taxa zero, a parcela é o valor financiado dividido pelo prazo.
        </p>
        <p>
          <strong>Valor financiado:</strong> valor do veículo menos a entrada, mais os custos que você
          informar como incluídos no financiamento. Custos pagos à parte não pagam juros e entram
          apenas no total desembolsado.
        </p>
        <p>
          <strong>Taxa:</strong> quando informada ao ano, é convertida para a mensal equivalente,
          (1 + anual)<sup>1/12</sup> − 1. Nunca dividimos por 12.
        </p>
        <p>
          <strong>Arredondamento:</strong> a parcela é arredondada ao centavo, e cada linha da
          tabela é calculada em centavos. A última parcela absorve a diferença, para o saldo
          terminar exatamente em zero e os totais baterem com a soma da tabela.
        </p>
        <p>
          <strong>O que não está incluído:</strong> tarifas, seguros e IOF que você não informar.
          Por isso o resultado é uma estimativa com os valores informados — não é o CET.
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
            Conselho Monetário Nacional —{" "}
            <a href={RES_CMN_4881} target="_blank" rel="noopener noreferrer">
              Resolução nº 4.881/2020
            </a>
            , sobre o cálculo e a informação do Custo Efetivo Total.
          </li>
          <li>
            Banco Central do Brasil — taxa média mensal de juros, pessoas físicas, aquisição de
            veículos (
            {reference ? (
              <a href={reference.sourceUrl} target="_blank" rel="noopener noreferrer">
                série SGS {reference.seriesCode}
              </a>
            ) : (
              "série SGS 25471"
            )}
            ){reference ? `, referência de ${reference.refMonthLabel}` : ""}.
          </li>
        </ul>
        <p>
          Conteúdo e ferramenta da Equipe Editorial do Crédito por Perto, que não concede crédito,
          não indica instituição e não recebe por nenhuma contratação. Encontrou algo errado? Veja a{" "}
          <Link href="/politica-de-correcoes/">política de correções</Link>. Metodologia revisada em{" "}
          {REVIEWED}.
        </p>
      </section>
    </div>
  );
}
