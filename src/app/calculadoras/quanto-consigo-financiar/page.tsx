import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { webPageJsonLd } from "@/lib/schema/jsonld";
import { JsonLd } from "@/components/seo/JsonLd";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ToolNextSteps } from "@/components/journeys/ToolNextSteps";
import {
  AffordabilityCalculator,
  SimulateAffordabilityButton,
  type AffordabilityPrefill,
} from "@/components/calculators/AffordabilityCalculator";
import { ScenarioTable } from "@/components/calculators/HomeFinancingSimulator";
import { calculateAffordability, type AffordabilityInput } from "@/lib/calculators/affordability";
import { FaqAccordion, FaqItem } from "@/components/content/FaqAccordion";

/**
 * Página "Quanto consigo financiar?".
 *
 * INTENÇÃO: começar pela parcela ("tenho R$ X por mês, quanto isso
 * financia?"). O simulador imobiliário responde a pergunta inversa (imóvel
 * → parcela) e também tem um modo de capacidade; os dois usam o MESMO núcleo
 * de cálculo (`lib/calculators/affordability.ts`) e se apontam. O guia
 * "quanto da renda comprometer" é dono da pergunta sobre renda.
 *
 * SEM RESPOSTA ÚNICA PARA "R$ 2.000": todo valor desta página declara taxa,
 * prazo e sistema. A taxa dos exemplos é HIPOTÉTICA (1% ao mês), escolhida
 * para ilustrar a conta; não é média de mercado nem oferta, e o texto diz
 * isso. Os números saem do motor na renderização: nenhum escrito à mão.
 *
 * SEM URL POR PARCELA: os exemplos preenchem a calculadora por botão.
 *
 * RENDA (SERP real, 05/10/2026): o autocomplete é dominado por "quanto
 * consigo financiar com renda de X mil". A tabela por renda usa 30% da renda
 * bruta como PREMISSA declarada: é o limite que a Caixa informa para
 * habitação, não lei nem regra de todo banco (o guia "quanto da renda
 * comprometer" é o dono dessa explicação). "Se eu financiar X, quanto vou
 * pagar" (valor → parcela) pertence ao simulador imobiliário; aqui só aponta.
 */

const PATH = "/calculadoras/quanto-consigo-financiar/";
const TITLE = "Quanto consigo financiar? Pela renda ou pela parcela";
const DESCRIPTION =
  "Com renda de R$ 5 mil, quanto consigo financiar? Veja a parcela de 30% da renda, a taxa e o prazo, em Price e SAC, e o que muda na aprovação.";
const REVIEWED = "05/10/2026";

export const metadata: Metadata = buildMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

/** Taxa hipotética dos exemplos, sempre rotulada como tal. */
const EXAMPLE_RATE = 1;
const EXAMPLE_MONTHS = 240;
/** Prazo dos exemplos por renda (30 anos), também hipotético. */
const INCOME_MONTHS = 360;
/** Percentual da renda bruta usado como premissa da tabela por renda. */
const INCOME_SHARE = 0.3;
const INCOMES = [3_000, 4_000, 5_000, 6_000, 8_000, 10_000, 12_000, 13_000, 20_000];

const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const brlRound = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(cents / 100);

function calc(input: AffordabilityInput) {
  const o = calculateAffordability(input);
  return o.kind === "ok" ? o.result : null;
}

const premise = (paymentReais: number, months: number, system: "Price" | "SAC") =>
  `Exemplo preenchido: parcela de R$ ${paymentReais.toLocaleString("pt-BR")}, taxa hipotética de 1% ao mês, ${months} meses, ${system}. Troque pelos números da sua proposta.`;

export default function QuantoConsigoFinanciarPage() {
  const example = (paymentReais: number, months = EXAMPLE_MONTHS, ratePercent = EXAMPLE_RATE) =>
    calc({ paymentCents: paymentReais * 100, ratePercent, rateUnit: "am", months });

  const byPayment = [1_000, 2_000, 3_000, 5_000].flatMap((reais) => {
    const r = example(reais);
    return r ? [{ reais, r }] : [];
  });
  const byTerm = [60, 120, 240, 360].flatMap((months) => {
    const r = example(2_000, months);
    return r ? [{ months, r }] : [];
  });
  const two = byPayment.find((x) => x.reais === 2_000)?.r;
  const three08 = example(3_000, 360, 0.8);
  const three12 = example(3_000, 360, 1.2);
  const t360 = byTerm.find((x) => x.months === 360)?.r;
  const t240 = byTerm.find((x) => x.months === 240)?.r;
  const bc = calc({ paymentCents: 935_00, ratePercent: 1.99, rateUnit: "am", months: 24 });
  const byIncome = INCOMES.flatMap((renda) => {
    const paymentReais = Math.round(renda * INCOME_SHARE);
    const r = example(paymentReais, INCOME_MONTHS);
    return r ? [{ renda, paymentReais, r }] : [];
  });
  const income5 = byIncome.find((x) => x.renda === 5_000);
  const income20 = byIncome.find((x) => x.renda === 20_000);
  const withEntry = calc({ paymentCents: 2_000_00, ratePercent: EXAMPLE_RATE, rateUnit: "am", months: EXAMPLE_MONTHS, entry: { kind: "reais", cents: 100_000_00 } });

  const prefill = (id: string, paymentReais: number, months: number, system: "price" | "sac" = "price"): AffordabilityPrefill => ({
    exampleId: id,
    paymentCents: paymentReais * 100,
    ratePercent: EXAMPLE_RATE,
    rateUnit: "am",
    months,
    system,
    premise: premise(paymentReais, months, system === "price" ? "Price" : "SAC"),
  });

  return (
    <div data-track-area="ferramenta" data-track="quanto-consigo-financiar" className="mx-auto max-w-3xl px-4 py-8">
      <JsonLd data={webPageJsonLd(TITLE, DESCRIPTION, PATH)} />
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: "Calculadoras", path: "/calculadoras/" },
          { name: "Quanto consigo financiar?", path: PATH },
        ]}
      />

      <h1 className="mt-6 font-serif text-3xl font-bold leading-tight text-brand-navy md:text-4xl">Quanto Consigo Financiar?</h1>
      <p className="mt-3 text-lg leading-relaxed text-brand-muted">
        Informe a parcela que cabe no seu mês, a taxa e o prazo para estimar o valor financiável. Partindo da renda, a parcela
        é uma fatia dela: a tabela por renda, logo abaixo, mostra a conta.
      </p>

      <div className="mt-6">
        <AffordabilityCalculator context="ferramenta" />
      </div>

      <ToolNextSteps toolId="quanto-consigo-financiar" />

      <section aria-labelledby="como-calcular" className="article-body mt-12">
        <h2 id="como-calcular">Como calcular quanto consigo financiar?</h2>
        <p>
          Para saber quanto uma parcela pode financiar, é necessário conhecer pelo menos o valor da prestação, a taxa de juros
          e o prazo. Com esses três dados, é possível calcular o valor presente das parcelas. Esse valor presente é o quanto a
          parcela financia.
        </p>
        <p>
          Na tabela Price, com parcelas iguais, a conta é: valor financiável = parcela × [1 − (1 + taxa)<sup>−prazo</sup>] ÷
          taxa. Com taxa zero, é parcela × prazo. É a mesma fórmula da Calculadora do Cidadão, do Banco Central, no modo de
          financiamento com prestações fixas.
        </p>

        <h2 id="renda">Quanto consigo financiar com a minha renda?</h2>
        <p>
          A renda entra na conta pela parcela. No financiamento habitacional, a Caixa informa em seus canais que a parcela pode
          comprometer até 30% da renda familiar bruta. Não é lei nem regra de todos os bancos: cada instituição tem a própria
          política, e o guia{" "}
          <Link href="/organizacao-financeira/quanto-da-renda-comprometer-financiamento-imovel/">quanto da renda comprometer com o financiamento</Link>{" "}
          explica de onde vem o número. Usando 30% como premissa, a parcela de quem ganha R$ 5.000 brutos é de R$ 1.500, e o
          valor que ela financia depende da taxa e do prazo.
        </p>
        <p>
          Premissas da tabela: parcela de 30% da renda bruta, taxa hipotética de 1% ao mês (não é média de mercado nem
          oferta), {INCOME_MONTHS} meses, sem entrada, sem seguros e sem TR. Na SAC, a parcela de 30% é a primeira, a maior.
        </p>
        {byIncome.length > 0 ? (
          <ScenarioTable
            caption={`Valor financiável por renda bruta, com parcela de 30% da renda, taxa hipotética de 1% ao mês e ${INCOME_MONTHS} meses`}
            head={["Renda bruta", "Parcela (30%)", "Price financia", "SAC financia"]}
            rows={byIncome.map(({ renda, paymentReais, r }) => ({
              key: String(renda),
              cells: [`R$ ${renda.toLocaleString("pt-BR")}`, `R$ ${paymentReais.toLocaleString("pt-BR")}`, brlRound(r.price.financedCents), brlRound(r.sac.financedCents)],
            }))}
          />
        ) : null}
        <SimulateAffordabilityButton label="Simular renda de R$ 5.000 (parcela de R$ 1.500)" detail={prefill("renda-5000", 1_500, INCOME_MONTHS)} />
        <p>
          Três cuidados antes de usar a tabela. Primeiro, 30% da renda bruta pesa mais na renda líquida, depois de INSS e
          imposto. Teste na <Link href="/calculadoras/parcela-no-orcamento/">Parcela no orçamento</Link> se a parcela cabe no mês
          real, com condomínio, IPTU e as dívidas que você já tem. Segundo, o banco não financia necessariamente todo o valor do
          imóvel: cada instituição e cada modalidade definem quanto do valor financiam, e o restante é entrada, que pode vir de
          recursos próprios ou do FGTS, conforme as regras do financiamento. Terceiro, no Minha Casa, Minha Vida, as faixas de
          renda, os subsídios e as taxas são definidos pelo programa e mudam com o tempo. Esta calculadora não os inclui:
          confira as condições vigentes nos canais oficiais do programa e, se houver subsídio, some-o à entrada.
        </p>

        <h2 id="valor-para-parcela">Se eu financiar R$ 170 mil, quanto vou pagar por mês?</h2>
        <p>
          É a pergunta inversa: parte do valor e chega à parcela. Quem responde é o{" "}
          <Link href="/calculadoras/financiamento-imobiliario/">simulador de financiamento imobiliário</Link>, que inclui entrada,
          seguros e a comparação entre Price e SAC. Para o carro ou para um valor como R$ 50 mil em 48 vezes, o{" "}
          <Link href="/calculadoras/financiamento-veiculo/">simulador de financiamento de veículo</Link> e a{" "}
          <Link href="/calculadoras/emprestimo/">calculadora de empréstimo</Link> fazem a mesma conta. Buscas como &ldquo;quanto
          fica um financiamento de R$ 300 mil pela Caixa&rdquo; dependem da taxa da proposta, dos seguros e da TR. O número do
          banco sai do simulador do próprio banco. Para comparar propostas, leve a taxa delas para estas calculadoras.
        </p>

        <h2 id="parcela-2000">Com parcela de R$ 2.000, quanto consigo financiar?</h2>
        <p>
          Não existe um único valor sem saber taxa e prazo. Depende principalmente dos dois.
          {two
            ? ` Num exemplo educativo, com taxa hipotética de 1% ao mês, ${EXAMPLE_MONTHS} meses e tabela Price, R$ 2.000 por mês financiam ${brl(two.price.financedCents)}. Ao longo do prazo, as parcelas somam ${brl(two.price.totalPaidCents)}.`
            : ""}{" "}
          É um exemplo matemático, não aprovação bancária.
        </p>
        <SimulateAffordabilityButton label="Simular parcela de R$ 2.000" detail={prefill("parcela-2000", 2_000, EXAMPLE_MONTHS)} />

        <h2 id="quanto-uma-parcela-financia">Quanto uma parcela pode financiar?</h2>
        <p>
          Premissas de todos os valores abaixo: taxa hipotética de 1% ao mês (não é média de mercado nem oferta), {EXAMPLE_MONTHS}{" "}
          meses, sem entrada e sem custos adicionais. Na SAC, a parcela da tabela é a primeira, que é a maior.
        </p>
        {byPayment.length > 0 ? (
          <ScenarioTable
            caption={`Valor financiável por parcela, com taxa hipotética de 1% ao mês e ${EXAMPLE_MONTHS} meses`}
            head={["Parcela", "Price financia", "SAC financia", "Total pago na Price"]}
            rows={byPayment.map(({ reais, r }) => ({
              key: String(reais),
              cells: [`R$ ${reais.toLocaleString("pt-BR")}`, brlRound(r.price.financedCents), brlRound(r.sac.financedCents), brlRound(r.price.totalPaidCents)],
            }))}
          />
        ) : null}
        <div className="flex flex-wrap gap-x-3">
          {[1_000, 3_000, 5_000].map((reais) => (
            <SimulateAffordabilityButton key={reais} label={`Simular parcela de R$ ${reais.toLocaleString("pt-BR")}`} detail={prefill(`parcela-${reais}`, reais, EXAMPLE_MONTHS)} />
          ))}
        </div>

        <h2 id="prazo">Como o prazo muda o valor?</h2>
        <p>
          Prazo maior aumenta o valor financiável, mas também aumenta muito o total de juros. Com a mesma parcela de R$ 2.000 e a
          mesma taxa hipotética de 1% ao mês, na Price:
        </p>
        {byTerm.length > 0 ? (
          <ScenarioTable
            caption="Valor financiável e total pago por prazo, parcela de R$ 2.000 e taxa hipotética de 1% ao mês"
            head={["Prazo", "Valor financiável", "Total pago", "Juros"]}
            rows={byTerm.map(({ months, r }) => ({
              key: String(months),
              cells: [`${months} meses`, brlRound(r.price.financedCents), brlRound(r.price.totalPaidCents), brlRound(r.price.totalInterestCents)],
            }))}
          />
        ) : null}
        {t240 && t360 ? (
          <p>
            De 240 para 360 meses, o valor financiável sobe {brl(t360.price.financedCents - t240.price.financedCents)}. O total pago
            sobe {brl(t360.price.totalPaidCents - t240.price.totalPaidCents)}. São 120 parcelas a mais, quase todas de juros.
          </p>
        ) : null}
        <SimulateAffordabilityButton label="Simular R$ 2.000 em 360 meses" detail={prefill("prazo-360", 2_000, 360)} />

        <h2 id="taxa">Por que a taxa muda tanto o valor financiável?</h2>
        <p>
          Cada parcela futura é trazida a valor de hoje pela taxa. Quanto maior a taxa, menos cada parcela vale hoje, e menor o
          valor que ela sustenta. Em prazos longos, o efeito se acumula.
          {three08 && three12
            ? ` Com parcela de R$ 3.000 e 360 meses na Price, a 0,8% ao mês a parcela financia ${brl(three08.price.financedCents)}; a 1,2% ao mês, ${brl(three12.price.financedCents)}. São ${brl(three08.price.financedCents - three12.price.financedCents)} de diferença pela taxa.`
            : ""}{" "}
          Por isso a calculadora mostra quanto meio ponto percentual muda o resultado: ajuda a entender o peso de uma negociação de
          taxa.
        </p>

        <h2 id="parcela-maior">Parcela maior significa que posso financiar quanto a mais?</h2>
        <p>
          Na Price, o valor financiável é proporcional à parcela. Com a mesma taxa e o mesmo prazo, parcela 10% maior financia
          cerca de 10% a mais, e o total pago cresce na mesma proporção. Nos cenários da calculadora, cada botão muda só a
          parcela e mostra os dois efeitos.
        </p>

        <h2 id="sac-price">SAC e Price mudam o resultado?</h2>
        <p>
          Mudam. Na SAC, a amortização é igual todo mês e a parcela cai com o tempo. A primeira parcela é a maior, e é ela que
          a calculadora limita ao valor informado. A fórmula inversa é: valor financiável = primeira parcela ÷ (1 ÷ prazo +
          taxa). Com taxa positiva, a mesma parcela máxima financia menos na SAC do que na Price, e os juros totais também são
          menores. A calculadora mostra os dois lado a lado, sem eleger um. A{" "}
          <Link href="/calculadoras/sac-x-price/">Calculadora SAC x Price</Link> compara os dois mês a mês.
        </p>

        <h2 id="entrada">Entrada aumenta o valor do bem que posso comprar?</h2>
        <p>
          A entrada não muda o valor financiável, que depende só de parcela, taxa e prazo. Ela soma ao valor do bem: valor
          do bem = valor financiável + entrada.
          {withEntry
            ? ` No exemplo de R$ 2.000 por mês, com R$ 100.000 de entrada, o bem poderia chegar a ${brl(withEntry.price.assetCents)} nessa simulação.`
            : ""}{" "}
          Com entrada em percentual, a conta é valor do bem = valor financiável ÷ (1 − percentual). Nenhuma entrada mínima é
          assumida: cada instituição e cada modalidade define a sua.
        </p>

        <h2 id="aprovacao">Quanto consigo financiar não é o mesmo que quanto o banco aprova</h2>
        <p>
          A calculadora responde uma pergunta de matemática: quanto esta parcela financia, com esta taxa e este prazo. A
          aprovação é outra pergunta. Ela pode considerar renda, histórico de crédito, outras dívidas, idade, garantias,
          entrada, características do bem, documentação, seguros e a política interna de cada instituição. O Crédito por Perto
          não concede crédito nem faz análise de crédito.
        </p>

        <h2 id="qual-taxa">Como escolher uma taxa para simular?</h2>
        <p>
          O melhor número é a taxa de uma proposta real, por escrito. Sem proposta, dá para testar uma faixa de taxas e ver o
          efeito. O <Link href="/taxas/">Radar de taxas</Link> mostra as médias publicadas pelo Banco Central por modalidade,
          com a data de cada dado. A calculadora nunca preenche uma taxa sozinha. Se a proposta informa a taxa ao ano, escolha
          “ao ano”: a conversão é por equivalência composta, nunca dividindo por 12.
        </p>

        <h2 id="perguntas-frequentes">Perguntas frequentes</h2>
        <FaqAccordion>
          <FaqItem question="Quanto consigo financiar com renda de 5 mil?" id="quanto-consigo-financiar-com-renda-de-5-mil">
            <p>
              Depende da parte da renda que vai para a parcela, da taxa e do prazo.
              {income5
                ? ` Com parcela de 30% da renda bruta (R$ 1.500), taxa hipotética de 1% ao mês e ${INCOME_MONTHS} meses, são ${brlRound(income5.r.price.financedCents)} na Price e ${brlRound(income5.r.sac.financedCents)} na SAC.`
                : ""}{" "}
              Com a taxa da sua proposta, o número muda: informe-a na calculadora.
            </p>
          </FaqItem>
          <FaqItem question="Com uma renda de R$ 20 mil, quanto posso financiar?" id="com-uma-renda-de-r-20-mil-quanto-posso-financiar">
            <p>
              {income20
                ? `Com as mesmas premissas (parcela de R$ 6.000, 1% ao mês hipotético, ${INCOME_MONTHS} meses), ${brlRound(income20.r.price.financedCents)} na Price e ${brlRound(income20.r.sac.financedCents)} na SAC.`
                : "Depende da taxa e do prazo."}{" "}
              A aprovação considera também histórico de crédito, outras dívidas, idade e a política da instituição.
            </p>
          </FaqItem>
          <FaqItem question="Quanto consigo financiar com R$ 3.000 por mês?" id="quanto-consigo-financiar-com-r-3000-por-mes">
            <p>
              Depende da taxa e do prazo.
              {three12 && three08
                ? ` Em 360 meses na Price, fica entre ${brlRound(three12.price.financedCents)} (a 1,2% ao mês) e ${brlRound(three08.price.financedCents)} (a 0,8% ao mês), com taxas hipotéticas.`
                : ""}{" "}
              Informe a sua taxa na calculadora para ver o seu número.
            </p>
          </FaqItem>
          <FaqItem question="Quanto consigo financiar em 30 anos?" id="quanto-consigo-financiar-em-30-anos">
            <p>
              Trinta anos são 360 meses.
              {t360 ? ` Com R$ 2.000 por mês e taxa hipotética de 1% ao mês, na Price, são ${brl(t360.price.financedCents)} financiados e ${brl(t360.price.totalPaidCents)} pagos no total.` : ""}{" "}
              Prazo longo aumenta o valor e, mais ainda, os juros.
            </p>
          </FaqItem>
          <FaqItem question="Como calcular valor financiado pela parcela?" id="como-calcular-valor-financiado-pela-parcela">
            <p>
              Some o valor presente de todas as parcelas, cada uma descontada pela taxa até o mês em que vence. A fórmula da Price
              faz essa soma de uma vez. Pela fórmula da metodologia do Banco Central,
              {bc ? ` 24 prestações de R$ 935 a 1,99% ao mês correspondem a ${brl(bc.price.financedCents)} financiados` : " o resultado sai ao centavo"}
              ; a calculadora reproduz esse número.
            </p>
          </FaqItem>
          <FaqItem question="Quanto consigo financiar com minha renda?" id="quanto-consigo-financiar-com-minha-renda">
            <p>
              Esta calculadora começa pela parcela, não pela renda. Informando a renda, ela mostra quanto da renda a parcela
              representa, como relação matemática. Cada instituição usa a própria política de comprometimento de renda. O guia{" "}
              <Link href="/organizacao-financeira/quanto-da-renda-comprometer-financiamento-imovel/">quanto da renda comprometer com o financiamento</Link>{" "}
              explica os critérios, e a ferramenta <Link href="/calculadoras/parcela-no-orcamento/">Parcela no orçamento</Link> testa se a
              parcela cabe no seu mês.
            </p>
          </FaqItem>
          <FaqItem question="A entrada conta no valor financiado?" id="a-entrada-conta-no-valor-financiado">
            <p>
              Não. O valor financiado é só o que as parcelas pagam. A entrada é paga à parte e soma ao valor do bem.
            </p>
          </FaqItem>
          <FaqItem question="O banco aprova exatamente esse valor?" id="o-banco-aprova-exatamente-esse-valor">
            <p>
              Não necessariamente. O resultado é uma estimativa matemática. O valor efetivamente aprovado depende da análise e das
              condições da instituição financeira, que também podem incluir IOF, seguros e tarifas.
            </p>
          </FaqItem>
          <FaqItem question="Prazo maior significa pagar mais juros?" id="prazo-maior-significa-pagar-mais-juros">
            <p>
              Com a mesma parcela e a mesma taxa, sim. Cada mês a mais é mais uma parcela, e o total pago sobe junto com o valor
              financiável.
            </p>
          </FaqItem>
        </FaqAccordion>

        <h2 id="como-calculamos">Como calculamos</h2>
        <ul>
          <li>
            <strong>Price:</strong> valor financiável = parcela × [1 − (1 + i)<sup>−n</sup>] ÷ i. Com i = 0, parcela × n.
          </li>
          <li>
            <strong>SAC:</strong> valor financiável = primeira parcela ÷ (1/n + i). A primeira parcela é a maior quando a taxa é
            positiva e não há indexador nem custo variável.
          </li>
          <li>
            <strong>Premissas:</strong> parcelas mensais, a primeira paga um mês depois da contratação (não no ato), juros
            compostos com capitalização mensal e taxa fixa informada por você.
          </li>
          <li>
            <strong>Conversão de taxa:</strong> anual = (1 + mensal)<sup>12</sup> − 1; mensal = (1 + anual)<sup>1/12</sup> − 1.
          </li>
          <li>
            <strong>Totais:</strong> o total das parcelas e os juros saem da tabela mês a mês, com arredondamento ao centavo, a
            mesma da Calculadora SAC x Price. Na SAC, somamos a tabela; nunca usamos a fórmula da Price.
          </li>
          <li>
            <strong>Objetivo:</strong> o prazo necessário na Price é n = −ln(1 − valor × i ÷ parcela) ÷ ln(1 + i). Quando a
            parcela não cobre os juros do primeiro mês, nenhum prazo resolve, e a calculadora diz isso. A taxa máxima é
            encontrada numericamente, por bisseção.
          </li>
        </ul>
        <p>
          <strong>Não incluídos:</strong> IOF, CET, seguros (no imóvel, MIP e DFI), tarifas, taxa de administração, TR ou outros
          indexadores, custos de registro e outros encargos. O total das parcelas não é o CET. Para incluir custos, use a{" "}
          <Link href="/calculadoras/cet/">calculadora de CET</Link>. Para um imóvel ou um carro específico, os simuladores de{" "}
          <Link href="/calculadoras/financiamento-imobiliario/">financiamento imobiliário</Link> e de{" "}
          <Link href="/calculadoras/financiamento-veiculo/">financiamento de veículo</Link>.
        </p>
        <p>
          <strong>Limites técnicos:</strong> prazo até 1.200 meses e parcela até R$ 1 milhão. São proteções da ferramenta, não
          regras de banco.
        </p>
        <p>
          <strong>Privacidade:</strong> o cálculo acontece no seu navegador. Parcela, taxa, entrada, renda e resultado não são
          enviados, gravados nem usados em medição de audiência.
        </p>

        <h2 id="fontes">Fonte e revisão</h2>
        <p>
          Metodologia de referência: Banco Central do Brasil,{" "}
          <a
            href="https://www3.bcb.gov.br/CALCIDADAO/publico/exibirMetodologiaFinanciamentoPrestacoesFixas.do?method=exibirMetodologiaFinanciamentoPrestacoesFixas"
            target="_blank"
            rel="noopener noreferrer"
          >
            Calculadora do Cidadão, financiamento com prestações fixas
          </a>
          . Conteúdo e ferramenta da Equipe Editorial do Crédito por Perto, que não concede crédito e não faz análise de
          crédito. Encontrou algo errado? Veja a <Link href="/politica-de-correcoes/">política de correções</Link>. Metodologia
          revisada em {REVIEWED}.
        </p>
      </section>
    </div>
  );
}
