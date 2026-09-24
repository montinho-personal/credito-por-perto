import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { webPageJsonLd } from "@/lib/schema/jsonld";
import { JsonLd } from "@/components/seo/JsonLd";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ToolNextSteps } from "@/components/journeys/ToolNextSteps";
import {
  HomeFinancingSimulator,
  ScenarioTable,
  SimulateExampleButton,
  type RateOffer,
} from "@/components/calculators/HomeFinancingSimulator";
import { getHousingRate, HOUSING_SERIES, HOUSING_SERIES_URL } from "@/lib/bcb/housing-rate";
import {
  downScenarios,
  incomeForPayment,
  maxFinanceable,
  monthsInWords,
  termScenarios,
} from "@/lib/calculators/home-financing";
import { simulateSacPrice } from "@/lib/calculators/sac-price";

/**
 * Página do simulador de financiamento imobiliário.
 *
 * LONG TAIL SEM PÁGINA FINA
 *
 * "Financiamento de 300 mil", "quanto fica financiar 500 mil", "financiamento
 * 500 mil com 100 mil de entrada", "quanto consigo financiar com parcela de
 * 3000": a SERP responde a cada uma com uma página por valor, taxa fixa e
 * sem fonte. Aqui é uma página só. Os valores com demanda identificada na
 * pesquisa de SERP de 23/09/2026 viram exemplos calculados pelo MESMO motor
 * da ferramenta — R$ 300 mil e R$ 500 mil com seção própria; R$ 250 mil,
 * 400 mil, 600 mil, 800 mil e 1 milhão numa tabela — e cada exemplo tem um
 * botão que leva os números ao simulador, sem abrir outra URL.
 *
 * NENHUM NÚMERO À MÃO
 *
 * Todo valor do texto sai do motor no momento da renderização. A taxa é a
 * média do Banco Central para financiamento imobiliário com taxas de
 * mercado (SGS 20772), com mês de referência, quando o dado chega válido;
 * sem ele, uma taxa ILUSTRATIVA — e o texto diz qual das duas está em uso.
 *
 * INTENÇÕES VIZINHAS
 *
 * "SAC ou Price" é do artigo e da Calculadora SAC x Price; "quanto da renda
 * comprometer", do guia de renda. Esta página responde "quanto fica" e
 * "quanto consigo" e aponta para eles — ver data/query-ownership-map.json.
 */

export const revalidate = 86400;

const PATH = "/calculadoras/financiamento-imobiliario/";
const TITLE = "Simulador de financiamento imobiliário: parcela e renda";
const DESCRIPTION =
  "Quanto fica financiar R$ 300 mil, R$ 500 mil ou o valor do seu imóvel: parcela na SAC e na Price, juros, entrada e renda. Grátis e sem cadastro.";
const REVIEWED = "23/09/2026";

/** Sem dado oficial válido, os exemplos usam esta taxa — sempre rotulada. */
const ILLUSTRATIVE_ANNUAL_RATE = 11.5;

export const metadata: Metadata = buildMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const CAIXA_FINANCIAMENTO =
  "https://www.caixa.gov.br/voce/habitacao/financiamento-de-imoveis/Paginas/default.aspx";
const CAIXA_FAQ_HABITACAO =
  "https://www.caixa.gov.br/voce/habitacao/financiamento/perguntas-frequentes/Paginas/default.aspx";
const CALC_CIDADAO_METODOLOGIA =
  "https://www3.bcb.gov.br/CALCIDADAO/publico/exibirMetodologiaFinanciamentoPrestacoesFixas.do?method=exibirMetodologiaFinanciamentoPrestacoesFixas";
const RES_CMN_4881 =
  "https://www.bcb.gov.br/content/estabilidadefinanceira/especialnor/Resolu%C3%A7%C3%A3o4881.pdf";

const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const brlRound = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(cents / 100);
/** "Até R$ X": para baixo, para não prometer um real a mais. */
const brlFloor = (cents: number) => brlRound(Math.floor(cents / 100) * 100);
/** "Pelo menos R$ X": para cima, para não prometer um real a menos. */
const brlCeil = (cents: number) => brlRound(Math.ceil(cents / 100) * 100);
const pct = (v: number, digits = 2) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const mil = (reais: number) => (reais >= 1_000_000 ? `R$ ${reais / 1_000_000} milhão` : `R$ ${reais / 1000} mil`);

const MONTHS = 360;

function simulate(principalCents: number, rate: number) {
  const o = simulateSacPrice({ principalCents, ratePercent: rate, rateUnit: "aa", months: MONTHS });
  return o.kind === "ok" ? o.result : null;
}

export default async function FinanciamentoImobiliarioPage() {
  const reference = await getHousingRate();
  const rate = reference ? Math.round(reference.annualRatePercent * 100) / 100 : ILLUSTRATIVE_ANNUAL_RATE;
  const rateOffer: RateOffer = reference
    ? { annualRatePercent: rate, label: `média do Banco Central em ${reference.refMonthLabel}`, official: true }
    : { annualRatePercent: rate, label: "ilustrativa", official: false };
  const rateSentence = reference
    ? `${pct(rate)}% ao ano, a taxa média do Banco Central para financiamento imobiliário com taxas de mercado em ${reference.refMonthLabel}`
    : `${pct(rate)}% ao ano, uma taxa apenas ilustrativa — não é a de nenhuma instituição`;

  /* Exemplos — todos do motor. */
  const terms300 = termScenarios(300_000_00, rate, "aa");
  const main300 = simulate(300_000_00, rate);
  const home300 = simulate(240_000_00, rate); // imóvel de 300 mil com 20% de entrada
  const terms500 = termScenarios(500_000_00, rate, "aa");
  const main500 = simulate(500_000_00, rate);
  const t30_500 = terms500.find((t) => t.months === 360);
  const t35_500 = terms500.find((t) => t.months === 420);
  const downs500 = downScenarios(500_000_00, rate, "aa", MONTHS);
  const with100 = downs500.find((r) => r.downCents === 100_000_00);
  const otherValues = [250_000, 400_000, 600_000, 800_000, 1_000_000].flatMap((reais) => {
    const r = simulate(reais * 100, rate);
    return r ? [{ reais, r }] : [];
  });
  const capacityRows = [2_000, 3_000, 4_000, 5_000].flatMap((reais) => {
    const o = maxFinanceable({ paymentCents: reais * 100, ratePercent: rate, rateUnit: "aa", months: MONTHS });
    return o.kind === "ok" ? [{ reais, r: o.result }] : [];
  });
  const cap3000 = capacityRows.find((c) => c.reais === 3_000);

  const termHead = ["Prazo", "SAC — 1ª parcela", "Price — parcela", "Juros SAC", "Juros Price"];
  const termRows = (rows: typeof terms300) =>
    rows.map((row) => ({
      key: String(row.months),
      cells: [
        monthsInWords(row.months),
        brl(row.result.sac.firstPaymentCents),
        brl(row.result.price.firstPaymentCents),
        brl(row.result.sac.totalInterestCents),
        brl(row.result.price.totalInterestCents),
      ],
    }));

  return (
    <div data-track-area="ferramenta" data-track="financiamento-imobiliario" className="mx-auto max-w-3xl px-4 py-8">
      <JsonLd data={webPageJsonLd(TITLE, DESCRIPTION, PATH)} />
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: "Calculadoras", path: "/calculadoras/" },
          { name: "Financiamento imobiliário", path: PATH },
        ]}
      />

      <h1 className="mt-6 font-serif text-3xl font-bold leading-tight text-brand-navy md:text-4xl">
        Simulador de financiamento imobiliário
      </h1>
      <p className="mt-3 text-lg leading-relaxed text-brand-muted">
        Informe o valor do imóvel, a entrada, a taxa e o prazo para ver a parcela na SAC e na Price — ou
        comece pela parcela que cabe no seu mês.
      </p>

      <div className="mt-6">
        <HomeFinancingSimulator rateOffer={rateOffer} context="ferramenta" />
      </div>

      <ToolNextSteps toolId="financiamento-imobiliario" />

      <section aria-labelledby="como-funciona" className="article-body mt-12">
        <h2 id="como-funciona">Como funciona o simulador de financiamento imobiliário</h2>
        <p>
          No modo <strong>Quanto fica a parcela</strong>, você informa o valor do imóvel, a entrada, a taxa e
          o prazo, e vê a parcela nos dois sistemas usados no crédito habitacional: a SAC, em que a parcela
          começa mais alta e cai, e a Price, em que ela é fixa. No modo{" "}
          <strong>Quanto consigo financiar</strong>, o caminho é o inverso: você informa a parcela que cabe no
          seu mês e vê até quanto ela financia. A diferença entre os dois sistemas, com gráficos e tabela
          completa, está na <Link href="/calculadoras/sac-x-price/">Calculadora SAC x Price</Link>.
        </p>

        <h2 id="premissas">As premissas dos exemplos desta página</h2>
        <p>
          Todos os números abaixo são calculados pelo mesmo motor do simulador, com estas premissas:
        </p>
        <ul>
          <li>
            <strong>Taxa:</strong> {rateSentence}.
          </li>
          <li>
            <strong>Prazo:</strong> 360 meses (30 anos), salvo quando a tabela compara prazos.
          </li>
          <li>
            <strong>Sistema:</strong> SAC e Price, lado a lado. Na SAC aparece a 1ª parcela, que é a maior.
          </li>
          <li>
            <strong>Indexador:</strong> nenhum. O saldo não é corrigido por TR, IPCA ou outro índice.
          </li>
          <li>
            <strong>Custos:</strong> não incluídos — sem seguros, tarifas, ITBI ou escritura.
          </li>
        </ul>
        <p>
          A sua proposta vai ter outra taxa e, provavelmente, seguros e correção do saldo. Os exemplos
          servem para ter a ordem de grandeza; o botão de cada um leva os números ao simulador, onde dá para
          trocar tudo.
        </p>

        {main300 && home300 && terms300.length > 0 ? (
          <>
            <h2 id="financiar-300-mil">Quanto fica financiar R$ 300 mil?</h2>
            <p>
              Depende da taxa, do prazo e do sistema. Com R$ 300 mil financiados em 30 anos, a 1ª parcela
              na SAC fica em {brl(main300.sac.firstPaymentCents)} e cai todo mês; na Price, a parcela é de{" "}
              {brl(main300.price.firstPaymentCents)}, fixa (a última acerta os centavos). Os juros do contrato inteiro somam{" "}
              {brl(main300.sac.totalInterestCents)} na SAC e {brl(main300.price.totalInterestCents)} na
              Price. Em outros prazos:
            </p>
            <ScenarioTable caption="R$ 300 mil financiados em prazos diferentes" head={termHead} rows={termRows(terms300)} />
            <p>
              &ldquo;Imóvel de R$ 300 mil&rdquo; e &ldquo;financiar R$ 300 mil&rdquo; são contas diferentes.
              Com 20% de entrada (R$ 60 mil), o valor financiado cai para R$ 240 mil, e a parcela em 30 anos
              fica em {brl(home300.sac.firstPaymentCents)} na SAC (1ª) e {brl(home300.price.firstPaymentCents)}{" "}
              na Price. Se a instituição limitar a parcela a 30% da renda bruta — critério que a Caixa
              informa —, financiar R$ 300 mil em 30 anos pede renda familiar bruta de pelo menos{" "}
              {brlCeil(incomeForPayment(main300.sac.firstPaymentCents, 0.3))} na SAC e{" "}
              {brlCeil(incomeForPayment(main300.price.firstPaymentCents, 0.3))} na Price.
            </p>
            <SimulateExampleButton
              label="Simular financiamento de R$ 300 mil"
              detail={{ mode: "parcela", exampleId: "300-mil", propertyCents: 300_000_00, months: MONTHS }}
            />{" "}
            <SimulateExampleButton
              label="Simular imóvel de R$ 300 mil com 20% de entrada"
              detail={{ mode: "parcela", exampleId: "imovel-300-mil-20", propertyCents: 300_000_00, downCents: 60_000_00, months: MONTHS }}
            />
          </>
        ) : null}

        {main500 && terms500.length > 0 ? (
          <>
            <h2 id="financiar-500-mil">Quanto fica financiar R$ 500 mil?</h2>
            <p>
              Com R$ 500 mil financiados em 30 anos, a 1ª parcela na SAC fica em{" "}
              {brl(main500.sac.firstPaymentCents)}, e a parcela da Price, em {brl(main500.price.firstPaymentCents)}.
              Os juros somam {brl(main500.sac.totalInterestCents)} na SAC e{" "}
              {brl(main500.price.totalInterestCents)} na Price.
              {t30_500 && t35_500
                ? ` De 30 para 35 anos, a parcela da Price cai ${brl(t30_500.result.price.firstPaymentCents - t35_500.result.price.firstPaymentCents)} por mês, e os juros da Price sobem ${brl(t35_500.result.price.totalInterestCents - t30_500.result.price.totalInterestCents)} no contrato inteiro.`
                : ""}{" "}
              Nos outros prazos:
            </p>
            <ScenarioTable caption="R$ 500 mil financiados em prazos diferentes" head={termHead} rows={termRows(terms500)} />
            {with100 ? (
              <p>
                Num apartamento de R$ 500 mil com R$ 100 mil de entrada, o financiamento é de R$ 400 mil: 1ª
                parcela de {brl(with100.result.sac.firstPaymentCents)} na SAC e{" "}
                {brl(with100.result.price.firstPaymentCents)} na Price, em 30 anos.
              </p>
            ) : null}
            <SimulateExampleButton
              label="Simular financiamento de R$ 500 mil"
              detail={{ mode: "parcela", exampleId: "500-mil", propertyCents: 500_000_00, months: MONTHS }}
            />{" "}
            <SimulateExampleButton
              label="Simular imóvel de R$ 500 mil com R$ 100 mil de entrada"
              detail={{ mode: "parcela", exampleId: "imovel-500-mil-100", propertyCents: 500_000_00, downCents: 100_000_00, months: MONTHS }}
            />
          </>
        ) : null}

        {otherValues.length > 0 ? (
          <>
            <h2 id="outros-valores">Outros valores: de R$ 250 mil a R$ 1 milhão</h2>
            <p>Valor financiado em 30 anos, com a mesma taxa e as mesmas premissas:</p>
            <ScenarioTable
              caption="Parcela e renda para valores financiados diferentes, em 30 anos"
              head={["Financiado", "SAC — 1ª parcela", "Price — parcela", "Renda a 30% (SAC)", "Renda a 30% (Price)"]}
              rows={otherValues.map(({ reais, r }) => ({
                key: String(reais),
                cells: [
                  mil(reais),
                  brl(r.sac.firstPaymentCents),
                  brl(r.price.firstPaymentCents),
                  brlCeil(incomeForPayment(r.sac.firstPaymentCents, 0.3)),
                  brlCeil(incomeForPayment(r.price.firstPaymentCents, 0.3)),
                ],
              }))}
            />
            <div className="not-prose mt-1 flex flex-wrap gap-x-2">
              {otherValues.map(({ reais }) => (
                <SimulateExampleButton
                  key={reais}
                  label={`Simular ${mil(reais)}`}
                  detail={{ mode: "parcela", exampleId: `${reais / 1000}-mil`, propertyCents: reais * 100, months: MONTHS }}
                />
              ))}
            </div>
          </>
        ) : null}

        {downs500.length > 1 ? (
          <>
            <h2 id="entrada">Como a entrada muda um financiamento imobiliário?</h2>
            <p>
              Cada real de entrada é um real que não paga juros por 30 anos. Num imóvel de R$ 500 mil, com a
              mesma taxa e o mesmo prazo:
            </p>
            <ScenarioTable
              caption="Imóvel de R$ 500 mil com entradas diferentes, em 30 anos"
              head={["Entrada", "Financiado", "SAC — 1ª parcela", "Price — parcela", "Juros Price"]}
              rows={downs500.map((row) => ({
                key: String(row.downCents),
                cells: [
                  `${brl(row.downCents ?? 0)} (${pct(((row.downCents ?? 0) / 500_000_00) * 100, 0)}%)`,
                  brl(row.principalCents),
                  brl(row.result.sac.firstPaymentCents),
                  brl(row.result.price.firstPaymentCents),
                  brl(row.result.price.totalInterestCents),
                ],
              }))}
            />
            <p>
              Quanto do imóvel a instituição aceita financiar — a chamada cota de financiamento — varia por
              instituição, linha de crédito e sistema de amortização, e muda com o tempo. Confira a cota na
              simulação oficial da instituição antes de contar com um percentual. Dar mais entrada também
              tira dinheiro de outro lugar: vale olhar antes a sua{" "}
              <Link href="/organizacao-financeira/reserva-de-emergencia/">reserva de emergência</Link>.
            </p>
          </>
        ) : null}

        <h2 id="prazo">Como o prazo muda a parcela?</h2>
        <p>
          Prazo maior baixa a parcela e aumenta os juros, nos dois sistemas — as tabelas de R$ 300 mil e R$
          500 mil acima mostram as duas coisas lado a lado. 240 meses são 20 anos; 300 meses, 25 anos; 360
          meses, 30 anos; e 420 meses, 35 anos. Quanto mais longo o prazo, menos a parcela cai a cada ano a
          mais, porque a maior parte dela já é juro.
        </p>

        {capacityRows.length > 0 ? (
          <>
            <h2 id="quanto-consigo-financiar">Tenho R$ 3.000 por mês. Quanto consigo financiar?</h2>
            <p>
              É o modo <strong>Quanto consigo financiar</strong> do simulador. Com a mesma taxa, em 30 anos,
              cada parcela alcança:
            </p>
            <ScenarioTable
              caption="Valor financiável por parcela mensal, em 30 anos"
              head={["Parcela", "Na Price, até", "Na SAC (1ª parcela), até", "Renda a 30%"]}
              rows={capacityRows.map(({ reais, r }) => ({
                key: String(reais),
                cells: [
                  brl(reais * 100),
                  brlFloor(r.priceMaxCents),
                  brlFloor(r.sacMaxCents),
                  brlCeil(incomeForPayment(reais * 100, 0.3)),
                ],
              }))}
            />
            <p>
              A mesma parcela financia mais na Price porque ela fica igual até o fim; na SAC, a 1ª parcela é
              a maior do contrato. Some a entrada que você tem ao valor financiável para chegar ao valor do
              imóvel. Aprovação e valor máximo dependem da análise de crédito e das regras de cada
              instituição.
            </p>
            <p>
              Quer ver também o total pago, a entrada em percentual e o que muda com taxa, prazo ou parcela? A
              calculadora <Link href="/calculadoras/quanto-consigo-financiar/">Quanto consigo financiar?</Link> faz
              a mesma conta para imóvel, veículo ou outro bem.
            </p>
            {cap3000 ? (
              <SimulateExampleButton
                label="Simular com parcela de R$ 3.000"
                detail={{ mode: "capacidade", exampleId: "parcela-3000", paymentCents: 3_000_00, months: MONTHS }}
              />
            ) : null}
          </>
        ) : null}

        <h2 id="nao-incluido">O que a simulação não inclui</h2>
        <p>
          A conta usa taxa fixa e saldo sem correção. No crédito habitacional da Caixa, por exemplo, o
          encargo mensal reúne amortização, juros, tarifa de administração (quando devida) e os seguros MIP
          (morte e invalidez permanente) e DFI (danos físicos no imóvel),{" "}
          <a href={CAIXA_FAQ_HABITACAO} target="_blank" rel="noopener noreferrer">
            segundo a Caixa
          </a>
          . Contratos com índice de atualização do saldo, como a TR ou o IPCA, também mudam as parcelas ao
          longo do tempo. E a compra tem custos fora do financiamento, como o ITBI e a escritura.
        </p>
        <p>
          Por isso o resultado não é o <strong>CET</strong>, o Custo Efetivo Total que a{" "}
          <a href={RES_CMN_4881} target="_blank" rel="noopener noreferrer">
            Resolução CMN nº 4.881/2020
          </a>{" "}
          obriga a instituição a informar antes da contratação. É por ele que duas propostas se comparam —
          o <Link href="/calculadoras/comparador-de-propostas/">comparador de propostas</Link> coloca as
          duas lado a lado.
        </p>

        <h2 id="perguntas-frequentes">Perguntas frequentes</h2>

        <h3>Qual renda é preciso para financiar um imóvel?</h3>
        <p>
          Não existe uma renda única: ela depende da parcela, e a parcela depende do valor financiado, da
          taxa, do prazo e do sistema. A Caixa informa que a parcela pode comprometer até 30% da renda
          familiar bruta; outras instituições têm critérios próprios. O simulador mostra a renda que cada
          parcela representa nesse critério. Se ela cabe no seu mês é outra conta, explicada em{" "}
          <Link href="/organizacao-financeira/quanto-da-renda-comprometer-financiamento-imovel/">
            quanto da renda comprometer com o financiamento
          </Link>
          .
        </p>

        <h3>Quanto preciso dar de entrada?</h3>
        <p>
          A entrada é a diferença entre o valor do imóvel e o que a instituição aceita financiar, e esse
          limite varia por instituição, linha e sistema. A tabela de entradas acima mostra o efeito na
          parcela e nos juros; o percentual mínimo vale o da simulação oficial da instituição.
        </p>

        <h3>420 meses são quantos anos?</h3>
        <p>35 anos. 360 meses são 30 anos; 300 meses, 25 anos; 240 meses, 20 anos.</p>

        <h3>SAC ou Price no financiamento de imóvel?</h3>
        <p>
          Com o mesmo valor, a mesma taxa e o mesmo prazo, a SAC começa com parcela mais alta e soma menos
          juros; a Price começa mais baixa e soma mais. O que pesa em cada caso — renda exigida, seguros,
          intenção de quitar antes — está em{" "}
          <Link href="/juros-e-cet/price-ou-sac-sistemas-de-amortizacao/">Price ou SAC</Link>.
        </p>

        <h3>A taxa do simulador inclui a TR?</h3>
        <p>
          Não. O simulador usa a taxa informada, sem correção do saldo. Em contrato com TR ou IPCA, o saldo
          e as parcelas podem subir ou descer conforme o índice.
        </p>

        <h3>O resultado é igual ao do banco?</h3>
        <p>
          Não necessariamente. A proposta inclui seguros, tarifas e, quando houver, a correção do saldo, e
          a taxa sai da análise de crédito. Use o simulador para entender a conta e comparar com a
          simulação oficial — o número que vale é o do contrato.
        </p>

        <h2 id="como-calculamos">Como calculamos</h2>
        <p>
          <strong>Price:</strong> prestações fixas, juros compostos com capitalização mensal — a mesma
          formulação da Calculadora do Cidadão do Banco Central. <strong>SAC:</strong> amortização
          constante igual ao valor financiado dividido pelo prazo, com juros do mês sobre o saldo anterior.
          A tabela é a mesma da <Link href="/calculadoras/sac-x-price/">Calculadora SAC x Price</Link>:
          parcela e juros arredondados ao centavo, e a última parcela acerta a diferença.
        </p>
        <p>
          <strong>Quanto consigo financiar:</strong> a fórmula é invertida — na Price, valor = parcela × [1 −
          (1 + i)<sup>−n</sup>] ÷ i; na SAC, valor = 1ª parcela ÷ (1/n + i) — e o resultado é conferido com
          o arredondamento ao centavo: é o maior valor cuja parcela fixa (Price) ou 1ª parcela (SAC) não passa
          da informada. Na Price, a última parcela acerta o arredondamento e pode ficar alguns reais acima ou
          abaixo das outras, como num contrato.
        </p>
        <p>
          <strong>Taxa:</strong> ao ano convertida para a mensal equivalente, (1 + anual)<sup>1/12</sup> − 1.
          Nunca dividimos por 12. <strong>Renda:</strong> parcela ÷ 0,30, quando citamos o critério de 30%
          informado pela Caixa.
        </p>
        <p>
          <strong>Privacidade:</strong> o cálculo acontece no seu navegador. Nenhum valor digitado é enviado,
          gravado ou usado em medição de audiência.
        </p>

        <h2 id="fontes">Fontes e metodologia</h2>
        <ul>
          <li>
            Banco Central do Brasil — taxa média de juros, recursos direcionados, pessoas físicas,
            financiamento imobiliário com taxas de mercado (
            <a href={HOUSING_SERIES_URL} target="_blank" rel="noopener noreferrer">
              série SGS {HOUSING_SERIES}
            </a>
            ){reference ? `, referência de ${reference.refMonthLabel}` : ""}.
          </li>
          <li>
            Banco Central do Brasil —{" "}
            <a href={CALC_CIDADAO_METODOLOGIA} target="_blank" rel="noopener noreferrer">
              Calculadora do Cidadão: metodologia do financiamento com prestações fixas
            </a>
            .
          </li>
          <li>
            Caixa Econômica Federal —{" "}
            <a href={CAIXA_FINANCIAMENTO} target="_blank" rel="noopener noreferrer">
              financiamento de imóveis
            </a>{" "}
            (critério de até 30% da renda familiar bruta) e{" "}
            <a href={CAIXA_FAQ_HABITACAO} target="_blank" rel="noopener noreferrer">
              perguntas frequentes da habitação
            </a>{" "}
            (composição do encargo mensal).
          </li>
          <li>
            Conselho Monetário Nacional —{" "}
            <a href={RES_CMN_4881} target="_blank" rel="noopener noreferrer">
              Resolução nº 4.881/2020
            </a>
            , sobre o Custo Efetivo Total.
          </li>
        </ul>
        <p>
          Conteúdo e ferramenta da Equipe Editorial do Crédito por Perto, que não concede crédito, não indica
          instituição e não recebe por nenhuma contratação. Encontrou algo errado? Veja a{" "}
          <Link href="/politica-de-correcoes/">política de correções</Link>. Metodologia revisada em {REVIEWED}.
        </p>
      </section>
    </div>
  );
}
