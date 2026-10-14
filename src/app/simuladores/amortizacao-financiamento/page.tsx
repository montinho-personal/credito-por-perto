import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { webPageJsonLd } from "@/lib/schema/jsonld";
import { JsonLd } from "@/components/seo/JsonLd";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ToolNextSteps } from "@/components/journeys/ToolNextSteps";
import { AmortizationSimulator, SimulateAmortizationButton, type AmortizationPrefill } from "@/components/simulators/AmortizationSimulator";
import { ScenarioTable } from "@/components/calculators/HomeFinancingSimulator";
import { formatMonths } from "@/lib/calculators/debt-plan";
import { addMonths, todayInBrazil } from "@/lib/calculators/civil-date";
import {
  compareRuns,
  lumpLadder,
  monthlyForMonthsEarlier,
  NO_EXTRAS,
  runContract,
  sensitivity,
  type ContractInput,
} from "@/lib/simulators/amortization";
import { FaqAccordion, FaqItem } from "@/components/content/FaqAccordion";

/**
 * Página do Simulador de amortização de financiamento.
 *
 * INTENÇÃO: o contrato JÁ EXISTE; o que muda se eu pagar mais agora?
 * - SAC × Price explica como o contrato funciona;
 * - os simuladores de financiamento respondem "quanto fica se contratar";
 * - a quitação antecipada responde "quanto para quitar tudo hoje";
 * - aqui: aporte extra → prazo, prestação, juros e data de quitação.
 *
 * Busca de 14/10: "simulador amortização financiamento" (720/mês) e "... caixa"
 * (590/mês). A página explica como a Caixa descreve a amortização no próprio
 * site (app, boleto, prazo de processamento), citando a fonte, sem simular
 * "o resultado da Caixa": o número oficial é sempre o da instituição.
 *
 * Buscas por valor ("amortizar 10 mil", "amortizar 50 mil") são atendidas
 * pelos exemplos calculados na renderização, com premissas declaradas, sem
 * URL por valor. A taxa dos exemplos é hipotética e dita como tal.
 */

export const revalidate = 3600;

const PATH = "/simuladores/amortizacao-financiamento/";
const TITLE = "Simulador de amortização de financiamento: SAC e Price";
const DESCRIPTION =
  "Simule a amortização do financiamento imobiliário ou de veículo: quanto um extra reduz prazo, parcela e juros, no SAC ou Price. Grátis, sem CPF.";
const REVIEWED = "14/10/2026";
const CAIXA_CONTRATO_FAQ = "https://www.caixa.gov.br/voce/habitacao/perguntas-frequentes-contrato/Paginas/default.aspx";

export const metadata: Metadata = buildMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const brl = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const brlRound = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(cents / 100);
const mil = (cents: number) => `R$ ${(cents / 1_000_00).toLocaleString("pt-BR")} mil`;

/** Premissas dos exemplos: saldo R$ 300 mil, 300 parcelas, taxa HIPOTÉTICA de 10% ao ano efetiva. */
const EXAMPLE_RATE = 10;

export default function AmortizacaoFinanciamentoPage() {
  const today = todayInBrazil();
  const example = (system: "sac" | "price"): ContractInput => ({
    balanceCents: 300_000_00,
    ratePercent: EXAMPLE_RATE,
    rateUnit: "aa",
    remainingMonths: 300,
    system,
    firstDueIso: addMonths(today, 1),
  });
  const price = example("price");
  const sac = example("sac");
  const amounts = lumpLadder(price.balanceCents);
  const rowsFor = (input: ContractInput) => {
    const base = runContract(input, NO_EXTRAS, "prazo");
    const byTerm = sensitivity(input, amounts, "prazo");
    return amounts.map((lump, i) => {
      const pay = runContract(input, { ...NO_EXTRAS, lumpCents: lump }, "prestacao");
      const drop = compareRuns(base, pay);
      return {
        key: String(lump),
        cells: [
          mil(lump),
          byTerm[i]!.monthsSaved > 0 ? formatMonths(byTerm[i]!.monthsSaved) : "—",
          brlRound(byTerm[i]!.interestAvoidedCents),
          `${brl(pay.firstPaymentCents)} (−${brl(drop.firstPaymentDropCents)})`,
        ],
      };
    });
  };
  const priceBase = runContract(price, NO_EXTRAS, "prazo");
  const sacBase = runContract(sac, NO_EXTRAS, "prazo");
  const price500 = runContract(price, { ...NO_EXTRAS, monthlyCents: 500_00 }, "prazo");
  const c500 = compareRuns(priceBase, price500);
  const price20 = runContract(price, { ...NO_EXTRAS, lumpCents: 20_000_00 }, "prazo");
  const sac20 = runContract(sac, { ...NO_EXTRAS, lumpCents: 20_000_00 }, "prazo");
  const cPrice20 = compareRuns(priceBase, price20);
  const cSac20 = compareRuns(sacBase, sac20);
  // "30 anos em 5": contrato de 360 meses, mesma taxa hipotética, Price.
  const thirty: ContractInput = { ...price, remainingMonths: 360 };
  const thirtyBase = runContract(thirty, NO_EXTRAS, "prazo");
  const fiveYears = monthlyForMonthsEarlier(thirty, 360 - 60);
  const head = ["Aporte hoje", "Reduzir prazo: tempo a menos", "Reduzir prazo: juros evitados", "Reduzir prestação: nova prestação"];

  const prefill = (exampleId: string, system: "sac" | "price", lumpCents: number): AmortizationPrefill => ({
    exampleId,
    balanceCents: 300_000_00,
    ratePercent: EXAMPLE_RATE,
    rateUnit: "aa",
    remainingMonths: 300,
    system,
    lumpCents,
  });

  return (
    <div data-track-area="ferramenta" data-track="amortizacao-financiamento" className="mx-auto max-w-3xl px-4 py-8">
      <JsonLd data={webPageJsonLd(TITLE, DESCRIPTION, PATH)} />
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: "Simuladores", path: "/simuladores/" },
          { name: "Amortização de financiamento", path: PATH },
        ]}
      />

      <p className="mt-6 text-sm font-semibold uppercase tracking-widest text-brand-teal-dark">Tenho um financiamento</p>
      <h1 className="mt-2 font-serif text-3xl font-bold leading-tight text-brand-navy md:text-4xl">Simulador de amortização de financiamento</h1>
      <p className="mt-3 text-lg leading-relaxed text-brand-muted">
        Veja quanto um pagamento extra pode reduzir o prazo, a prestação e os juros restantes do seu financiamento, imobiliário ou de
        veículo. Grátis, sem cadastro e sem CPF: a conta roda no seu navegador.
      </p>
      <p className="mt-3 leading-relaxed text-brand-text">
        Amortizar um financiamento significa reduzir antecipadamente parte do saldo devedor. Com saldo menor, os juros futuros tendem a diminuir.
        Dependendo do contrato, a amortização pode ser usada para reduzir o prazo restante ou o valor das prestações.
      </p>

      <div className="mt-6">
        <AmortizationSimulator today={today} context="ferramenta" />
      </div>

      <ToolNextSteps toolId="amortizacao-financiamento" />

      <section aria-labelledby="o-que-e" className="article-body mt-12">
        <h2 id="o-que-e">O que é amortização extraordinária?</h2>
        <p>
          É um pagamento fora do cronograma que vai direto para o saldo devedor. A prestação do mês continua existindo; o extra abate a dívida além
          dela. O valor amortizado não é economia: é dívida paga antes. A economia está nos juros que deixam de ser cobrados sobre esse saldo
          nos meses seguintes.
        </p>

        <h2 id="juros">O que acontece com os juros quando amortizo?</h2>
        <p>
          Os juros de cada mês são calculados sobre o saldo devedor. Se o saldo cai hoje, os juros da próxima parcela já são menores, e a diferença
          se repete em todos os meses que restam. Por isso o efeito é maior no começo do contrato, quando o saldo e o número de meses pela frente
          são maiores. O simulador mostra essa sequência: o saldo muda no dia, os juros mudam na próxima parcela e o total muda ao longo do
          contrato.
        </p>

        <h2 id="prazo-ou-prestacao">Reduzir prazo ou reduzir prestação?</h2>
        <p>
          São objetivos diferentes, não um certo e um errado. <strong>Reduzir o prazo</strong> mantém a prestação e termina o contrato antes.
          Como a dívida fica menos tempo aberta, costuma evitar mais juros. <strong>Reduzir a prestação</strong> mantém o prazo e diminui o valor
          pago todo mês: libera espaço no orçamento, com menos juros evitados. No exemplo de {mil(20_000_00)} abaixo, no Price, reduzir o prazo
          antecipa {formatMonths(cPrice20.monthsSaved)} e evita cerca de {brlRound(cPrice20.interestAvoidedCents)} de juros. O simulador mostra os
          dois caminhos lado a lado, com a data de quitação de cada um; a escolha depende do que pesa mais para você.
        </p>

        <h2 id="como-calcular">Como calcular a economia de juros da amortização?</h2>
        <p>
          Some os juros de todas as prestações futuras sem amortizar e faça o mesmo com a amortização. A diferença é a economia de juros. Comparar
          só as prestações futuras, sem somar o valor amortizado, exagera o resultado. Por isso o simulador mostra também o desembolso total a
          partir de hoje: aporte mais prestações. A diferença de desembolso entre os cenários é exatamente a dos juros evitados.
        </p>

        <h2 id="exemplos">Quanto reduz amortizar 5, 10, 20 ou 50 mil?</h2>
        <p>
          Exemplo educativo, não regra: saldo de R$ 300 mil, 300 parcelas restantes e <strong>taxa hipotética de {EXAMPLE_RATE}% ao ano</strong>,
          efetiva e constante, sem seguros, tarifas nem TR. Não é taxa de mercado. No seu contrato, os números mudam com saldo, taxa, prazo e
          sistema.
        </p>
        <h3>Tabela Price (prestação sem amortizar: {brl(priceBase.firstPaymentCents)})</h3>
        <ScenarioTable caption="Efeito de cada valor de amortização no Price" head={head} rows={rowsFor(price)} />
        <SimulateAmortizationButton label="Abrir este cenário (Price, R$ 20 mil)" detail={prefill("price-20-mil", "price", 20_000_00)} />
        <h3>SAC (primeira prestação sem amortizar: {brl(sacBase.firstPaymentCents)})</h3>
        <ScenarioTable caption="Efeito de cada valor de amortização no SAC" head={head} rows={rowsFor(sac)} />
        <SimulateAmortizationButton label="Abrir este cenário (SAC, R$ 20 mil)" detail={prefill("sac-20-mil", "sac", 20_000_00)} />
        <p>
          Repare no retorno de cada degrau: dobrar o aporte não dobra exatamente os meses eliminados, e o simulador mostra quanto cada valor a mais
          acrescenta.
        </p>

        <h2 id="todo-mes">Posso amortizar todos os meses?</h2>
        <p>
          A conta funciona: no mesmo exemplo em Price, pagar R$ 500 a mais todo mês, reduzindo o prazo, antecipa a quitação em{" "}
          {formatMonths(c500.monthsSaved)} e evita cerca de {brlRound(c500.interestAvoidedCents)} de juros. O desembolso do mês passa a ser a
          prestação mais o extra. Se o seu contrato aceita amortizações frequentes, com que valor mínimo e por qual canal, quem diz é a
          instituição. No simulador, dá para testar extra mensal, extra anual (em um mês escolhido) e aportes em datas específicas.
        </p>

        <h2 id="sac-price">SAC e Price respondem diferente à amortização?</h2>
        <p>
          Sim. No <strong>Price</strong>, reduzir o prazo mantém a prestação fixa, e reduzir a prestação recalcula uma nova parcela fixa para o prazo
          que falta. No <strong>SAC</strong>, a prestação é a amortização mensal mais os juros: reduzir o prazo mantém a quota de amortização, e
          reduzir a prestação recalcula a quota sobre o saldo menor, com as prestações seguindo em queda. Com os mesmos {mil(20_000_00)} do
          exemplo, reduzindo o prazo, o Price antecipa {formatMonths(cPrice20.monthsSaved)} e o SAC, {formatMonths(cSac20.monthsSaved)}. A
          mecânica de cada sistema está em <Link href="/juros-e-cet/price-ou-sac-sistemas-de-amortizacao/">Price ou SAC</Link>, e a comparação
          do contrato inteiro, na <Link href="/calculadoras/sac-x-price/">calculadora SAC x Price</Link>.
        </p>

        <h2 id="fgts">Posso usar o FGTS para amortizar?</h2>
        <p>
          Pode, em financiamento habitacional, se o trabalhador, o contrato e o imóvel cumprirem as condições do FGTS. A Lei 8.036/1990 (art. 20,
          VI) prevê o uso para liquidação ou amortização extraordinária do saldo devedor, com intervalo mínimo de dois anos entre cada
          movimentação. Os requisitos atuais estão na{" "}
          <a href="https://www.caixa.gov.br/voce/habitacao/paginas/utilizacao-fgts.aspx" target="_blank" rel="noopener noreferrer">
            página da Caixa sobre o uso do FGTS
          </a>
          . Usar o FGTS para pagar parte das prestações é outra modalidade: não abate o saldo do mesmo jeito e não é simulado aqui. Na conta da
          amortização, o que importa é o valor que efetivamente abate o saldo, venha de onde vier.
        </p>

        <h2 id="antecipar">Amortizar é igual a antecipar parcelas?</h2>
        <p>
          Nem sempre. O Código de Defesa do Consumidor (art. 52, § 2º) garante a liquidação antecipada, total ou parcial, com redução
          proporcional dos juros. Na prática, a instituição pode oferecer amortizar o saldo (e recalcular prazo ou prestação) ou antecipar
          parcelas do fim do contrato. O efeito depende de como a operação é registrada: confirme que o valor vai reduzir o saldo devedor e
          qual recálculo será feito. Para quitar tudo de uma vez, a conta é outra: use a{" "}
          <Link href="/calculadoras/quitacao-antecipada/">calculadora de quitação antecipada</Link>.
        </p>

        <h2 id="banco-diferente">Por que meu banco mostra outro resultado?</h2>
        <p>
          O simulador usa taxa constante, prestação financeira pura e meses regulares. O contrato real pode ter correção do saldo por TR ou outro
          indexador, seguros obrigatórios, taxa de administração, contagem exata de dias, arredondamentos próprios e regras específicas de
          recálculo. Se você informar a prestação que paga, o simulador compara com a calculada e avisa quando a diferença sugere seguros ou
          tarifas. O número oficial é sempre o da instituição.
        </p>

        <h2 id="caixa">Como amortizar o financiamento da Caixa?</h2>
        <p>
          Segundo as{" "}
          <a href={CAIXA_CONTRATO_FAQ} target="_blank" rel="noopener noreferrer">
            perguntas frequentes de contratos habitacionais da Caixa
          </a>
          , a simulação oficial é feita no App Habitação CAIXA, com a escolha entre reduzir o prazo ou reduzir a prestação, sem limite de
          simulações. Contratos com prestações vencidas não podem ser amortizados. O boleto de amortização vale só para o dia em que foi
          gerado, um novo boleto só pode ser emitido depois de 3 dias úteis, e o saldo devedor pode levar até 3 dias úteis para ser
          atualizado depois do pagamento. Este simulador serve para fazer as contas antes, com qualquer contrato SAC ou Price; o valor que
          vale é o do aplicativo do banco.
        </p>

        <h2 id="perguntas-frequentes">Perguntas frequentes</h2>
        <FaqAccordion>
          <FaqItem question="Como se faz o cálculo de amortização?" id="como-se-faz-o-calculo-de-amortizacao">
            <p>
              Cada prestação tem duas partes: juros (taxa do mês × saldo devedor) e amortização (o que abate o saldo). No{" "}
              <strong>SAC</strong>, a amortização é fixa, saldo ÷ número de parcelas, e a prestação cai porque os juros caem. No{" "}
              <strong>Price</strong>, a prestação é fixa, PMT = saldo × i ÷ [1 − (1 + i)<sup>−n</sup>], e a amortização é a prestação menos os
              juros do mês. Uma amortização extra entra direto no saldo, e os juros do mês seguinte já são calculados sobre o saldo menor.
            </p>
          </FaqItem>
          <FaqItem question="Qual é a tabela de amortização: SAC ou Price?" id="qual-e-a-tabela-de-amortizacao-sac-ou-price">
            <p>
              A tabela é a do sistema que está no seu contrato. As duas mais conhecidas são a SAC (prestações decrescentes) e a Price
              (prestações fixas); existem outras, como o SAM, que mistura as duas. O simulador gera a tabela mês a mês de SAC e Price, e a{" "}
              <Link href="/calculadoras/sac-x-price/">calculadora SAC x Price</Link> compara as duas para um contrato novo.
            </p>
          </FaqItem>
          <FaqItem question="Quando amortizo, a parcela diminui?" id="quando-amortizo-a-parcela-diminui">
            <p>
              Depende da opção. Reduzindo a prestação, sim: o prazo fica e a parcela é recalculada sobre o saldo menor. Reduzindo o prazo, no
              Price a parcela continua a mesma e o contrato acaba antes; no SAC a quota de amortização continua, mas os juros caem com o saldo,
              então a prestação também fica um pouco menor.
            </p>
          </FaqItem>
          <FaqItem question="Quantas vezes posso amortizar por mês?" id="quantas-vezes-posso-amortizar-por-mes">
            <p>
              Não encontramos regra geral que limite: quem define é o contrato. Na Caixa, um novo boleto de amortização só pode ser gerado depois
              de 3 dias úteis do anterior. Com o FGTS, a lei exige intervalo mínimo de dois anos entre as movimentações para amortizar.
            </p>
          </FaqItem>
          {fiveYears.kind === "valor" ? (
            <FaqItem question="Como pagar um financiamento de 30 anos em 5?" id="como-pagar-um-financiamento-de-30-anos-em-5">
              <p>
                Pagando a mais todo mês, reduzindo o prazo. Exemplo educativo: R$ 300 mil em 360 parcelas Price, com a taxa hipotética de{" "}
                {EXAMPLE_RATE}% ao ano, dão prestação de {brl(thirtyBase.firstPaymentCents)}. Para terminar em 60 meses, seria preciso pagar
                cerca de {brl(fiveYears.cents)} a mais por mês, e os juros evitados chegam a cerca de{" "}
                {brlRound(compareRuns(thirtyBase, fiveYears.run).interestAvoidedCents)}. Com os números do seu contrato, use &ldquo;Quanto
                preciso amortizar para…?&rdquo; depois de simular.
              </p>
            </FaqItem>
          ) : null}
          <FaqItem question="Quanto fica R$ 300 mil financiados?" id="quanto-fica-r-300-mil-financiados">
            <p>
              Depende da taxa, do prazo e do sistema. Na taxa hipotética dos exemplos ({EXAMPLE_RATE}% ao ano) e 300 parcelas, a prestação Price
              fica em {brl(priceBase.firstPaymentCents)} e a primeira do SAC em {brl(sacBase.firstPaymentCents)}, sem seguros e tarifas. A
              taxa da Caixa ou de outro banco está na proposta; com ela, o{" "}
              <Link href="/calculadoras/financiamento-imobiliario/">simulador de financiamento imobiliário</Link> calcula o contrato novo.
            </p>
          </FaqItem>
          <FaqItem question="Qual a desvantagem de amortizar?" id="qual-a-desvantagem-de-amortizar">
            <p>
              O dinheiro usado deixa de estar disponível: se faltar para uma emergência ou ficar uma dívida mais cara em aberto, a conta pode não
              compensar. E reduzir a prestação evita menos juros que reduzir o prazo. O simulador mostra quanto cada caminho economiza; o resto da
              decisão está no seu orçamento.
            </p>
          </FaqItem>
          <FaqItem question="Meu banco é obrigado a reduzir o prazo?" id="meu-banco-e-obrigado-a-reduzir-o-prazo">
            <p>
              Não encontramos norma geral que obrigue toda instituição a oferecer as duas opções. Na Caixa, o cliente escolhe entre reduzir prazo ou
              prestação, segundo as{" "}
              <a href="https://www.caixa.gov.br/voce/habitacao/perguntas-frequentes-contrato/Paginas/default.aspx" target="_blank" rel="noopener noreferrer">
                perguntas frequentes da Caixa
              </a>
              . Em outros contratos, confira as cláusulas de amortização.
            </p>
          </FaqItem>
          <FaqItem question="É melhor amortizar no começo ou no fim do contrato?" id="e-melhor-amortizar-no-comeco-ou-no-fim-do-contrato">
            <p>
              O mesmo valor evita mais juros quanto mais cedo entra, porque há mais saldo e mais meses pela frente. Isso não quer dizer que amortizar
              seja sempre a melhor escolha: reserva de emergência, outras dívidas mais caras e outras necessidades ficam fora desta conta.
            </p>
          </FaqItem>
          <FaqItem question="Qual a diferença entre amortizar e quitar?" id="qual-a-diferenca-entre-amortizar-e-quitar">
            <p>
              Amortizar abate parte do saldo e o contrato continua. Quitar zera o saldo e encerra o contrato. Se o valor informado cobrir todo o saldo,
              o simulador mostra a quitação nesta modelagem, mas o valor exato de liquidação vem da instituição.
            </p>
          </FaqItem>
          <FaqItem question="Quanto preciso amortizar para terminar X anos antes?" id="quanto-preciso-amortizar-para-terminar-x-anos-antes">
            <p>
              Depois de simular, use &ldquo;Quanto preciso amortizar para…?&rdquo;: o simulador calcula o aporte único (ou o extra mensal) para
              quitar alguns anos antes, terminar até uma data ou baixar a prestação a um valor.
            </p>
          </FaqItem>
        </FaqAccordion>

        <h2 id="como-simulamos">Como simulamos</h2>
        <ul>
          <li>
            <strong>Taxa:</strong> ao mês, ao ano efetiva, convertida por <code>(1 + anual)^(1/12) − 1</code>, nunca dividida por 12, ou ao ano
            nominal, dividida por 12 porque a capitalização é mensal.
          </li>
          <li>
            <strong>Price:</strong> prestação <code>PMT = saldo × i ÷ [1 − (1 + i)^−n]</code>. Reduzindo o prazo, a prestação continua e o número
            de parcelas é o que zera o saldo (a teoria dá <code>n = −ln(1 − saldo × i ÷ PMT) ÷ ln(1 + i)</code>). O cronograma é simulado mês a
            mês, e a última parcela é só o resíduo. Reduzindo a prestação, a nova PMT é calculada sobre o saldo menor e o prazo que falta.
          </li>
          <li>
            <strong>SAC:</strong> quota de amortização <code>saldo ÷ n</code> mais os juros do mês. Reduzindo o prazo, a quota continua; reduzindo a
            prestação, ela é recalculada sobre o saldo menor e o prazo que falta.
          </li>
          <li>
            <strong>Ordem de cada mês:</strong> juros sobre o saldo de abertura, prestação contratual, extras do mês e, no caminho de reduzir a
            prestação, recálculo. O aporte de hoje entra antes da próxima parcela.
          </li>
          <li>
            <strong>Centavos:</strong> contas em centavos inteiros, juros arredondados a cada mês, sem saldo negativo; a última parcela fecha o
            saldo em zero.
          </li>
          <li>
            <strong>Não incluído:</strong> TR, IPCA ou outro indexador, seguros, tarifas, taxa de administração, dias corridos entre vencimentos e
            regras próprias de cada instituição.
          </li>
          <li>
            <strong>Conferência:</strong> o cenário base bate centavo a centavo com a calculadora SAC x Price, e o aporte único, com o motor da
            calculadora de quitação antecipada. Os testes também conferem as fórmulas fechadas do Price e do SAC.
          </li>
          <li>
            <strong>Privacidade:</strong> a conta roda no seu navegador. Nenhum valor é enviado, gravado ou medido.
          </li>
        </ul>

        <h2 id="fontes">Fontes e revisão</h2>
        <ul>
          <li>
            <a href="https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm" target="_blank" rel="noopener noreferrer">
              Código de Defesa do Consumidor (Lei 8.078/1990), art. 52, § 2º
            </a>
            : liquidação antecipada com redução proporcional dos juros.
          </li>
          <li>
            <a href="https://www.planalto.gov.br/ccivil_03/leis/l8036consol.htm" target="_blank" rel="noopener noreferrer">
              Lei 8.036/1990 (FGTS), art. 20, VI
            </a>
            : uso do FGTS na liquidação ou amortização extraordinária do saldo devedor.
          </li>
          <li>
            <a href="https://www.caixa.gov.br/voce/habitacao/paginas/utilizacao-fgts.aspx" target="_blank" rel="noopener noreferrer">
              Caixa: utilização do FGTS na habitação
            </a>
            .
          </li>
          <li>
            <a href="https://www.caixa.gov.br/voce/habitacao/perguntas-frequentes-contrato/Paginas/default.aspx" target="_blank" rel="noopener noreferrer">
              Caixa: perguntas frequentes sobre contratos habitacionais
            </a>
            : amortização pelo App Habitação CAIXA, boleto e prazo de processamento. Lida em 14/10/2026.
          </li>
        </ul>
        <p>
          Os exemplos usam taxa hipotética e são recalculados pelo mesmo motor do simulador. Veja a{" "}
          <Link href="/politica-de-correcoes/">política de correções</Link>. Metodologia revisada em {REVIEWED}.
        </p>
      </section>
    </div>
  );
}
