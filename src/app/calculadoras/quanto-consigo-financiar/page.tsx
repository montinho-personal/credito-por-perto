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
 */

const PATH = "/calculadoras/quanto-consigo-financiar/";
const TITLE = "Quanto consigo financiar? Calcule pela parcela";
const DESCRIPTION =
  "Informe quanto pode pagar por mês, a taxa e o prazo para estimar quanto consegue financiar e como entrada, juros e prazo mudam o valor.";
const REVIEWED = "24/09/2026";

export const metadata: Metadata = buildMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

/** Taxa hipotética dos exemplos, sempre rotulada como tal. */
const EXAMPLE_RATE = 1;
const EXAMPLE_MONTHS = 240;

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
        Informe a parcela que cabe no seu mês, a taxa e o prazo para estimar o valor financiável.
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
        <h3>Quanto consigo financiar com R$ 3.000 por mês?</h3>
        <p>
          Depende da taxa e do prazo.
          {three12 && three08
            ? ` Em 360 meses na Price, fica entre ${brlRound(three12.price.financedCents)} (a 1,2% ao mês) e ${brlRound(three08.price.financedCents)} (a 0,8% ao mês), com taxas hipotéticas.`
            : ""}{" "}
          Informe a sua taxa na calculadora para ver o seu número.
        </p>
        <h3>Quanto consigo financiar em 30 anos?</h3>
        <p>
          Trinta anos são 360 meses.
          {t360 ? ` Com R$ 2.000 por mês e taxa hipotética de 1% ao mês, na Price, são ${brl(t360.price.financedCents)} financiados e ${brl(t360.price.totalPaidCents)} pagos no total.` : ""}{" "}
          Prazo longo aumenta o valor e, mais ainda, os juros.
        </p>
        <h3>Como calcular valor financiado pela parcela?</h3>
        <p>
          Some o valor presente de todas as parcelas, cada uma descontada pela taxa até o mês em que vence. A fórmula da Price
          faz essa soma de uma vez. Pela fórmula da metodologia do Banco Central,
          {bc ? ` 24 prestações de R$ 935 a 1,99% ao mês correspondem a ${brl(bc.price.financedCents)} financiados` : " o resultado sai ao centavo"}
          ; a calculadora reproduz esse número.
        </p>
        <h3>Quanto consigo financiar com minha renda?</h3>
        <p>
          Esta calculadora começa pela parcela, não pela renda. Informando a renda, ela mostra quanto da renda a parcela
          representa, como relação matemática. Cada instituição usa a própria política de comprometimento de renda. O guia{" "}
          <Link href="/organizacao-financeira/quanto-da-renda-comprometer-financiamento-imovel/">quanto da renda comprometer com o financiamento</Link>{" "}
          explica os critérios, e a ferramenta <Link href="/calculadoras/parcela-no-orcamento/">Parcela no orçamento</Link> testa se a
          parcela cabe no seu mês.
        </p>
        <h3>A entrada conta no valor financiado?</h3>
        <p>
          Não. O valor financiado é só o que as parcelas pagam. A entrada é paga à parte e soma ao valor do bem.
        </p>
        <h3>O banco aprova exatamente esse valor?</h3>
        <p>
          Não necessariamente. O resultado é uma estimativa matemática. O valor efetivamente aprovado depende da análise e das
          condições da instituição financeira, que também podem incluir IOF, seguros e tarifas.
        </p>
        <h3>Prazo maior significa pagar mais juros?</h3>
        <p>
          Com a mesma parcela e a mesma taxa, sim. Cada mês a mais é mais uma parcela, e o total pago sobe junto com o valor
          financiável.
        </p>

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
