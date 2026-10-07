import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { webPageJsonLd } from "@/lib/schema/jsonld";
import { JsonLd } from "@/components/seo/JsonLd";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ToolNextSteps } from "@/components/journeys/ToolNextSteps";
import { DebtJourneySimulator, SimulateJourneyButton, type DebtJourneyPrefill } from "@/components/simulators/DebtJourneySimulator";
import { ScenarioTable } from "@/components/calculators/HomeFinancingSimulator";
import { formatMonths } from "@/lib/calculators/debt-plan";
import { todayInBrazil } from "@/lib/calculators/civil-date";
import { EARLY_PAYOFF, ROTATIVO_DURATION } from "@/lib/calculators/credit-card-rules";
import { compareJourneys, monthLabel, simulateJourney, withMonthlyExtra, type JourneyDebt, type JourneyInput } from "@/lib/simulators/debt-journey";
import { FaqAccordion, FaqItem } from "@/components/content/FaqAccordion";

/**
 * Página do simulador "Quando fico livre das dívidas?".
 *
 * INTENÇÃO: tempo + trajetória + efeito de pagar mais. Os artigos respondem
 * estratégia ("qual pagar primeiro", "como sair das dívidas"); a comparação
 * completa bola de neve x avalanche será ferramenta própria. Aqui a pergunta
 * é "quando termino?".
 *
 * A SERP de "quando fico livre das dívidas" mistura prescrição de dívida
 * (Portugal, "limpar o nome"); título e descrição ancoram "simulador de
 * quitação" e "quanto tempo" para não disputar essa intenção.
 *
 * Todo número dos exemplos sai do motor na renderização, com premissas
 * declaradas (taxa hipotética, pagamento, sem novas compras). Nenhuma URL
 * por valor de dívida.
 */

export const revalidate = 3600;

const PATH = "/simuladores/quando-fico-livre-das-dividas/";
const TITLE = "Quando fico livre das dívidas? Simulador de quitação";
const DESCRIPTION =
  "Adicione saldo, taxa e pagamento das suas dívidas para estimar quando termina de pagar, quanto desembolsa e como pagar mais muda o caminho. Grátis.";
const REVIEWED = "24/09/2026";

export const metadata: Metadata = buildMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const brl = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const brlRound = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(cents / 100);

const debt = (id: string, label: string, balance: number, rate: number, payment: number): JourneyDebt => ({
  id,
  label,
  type: "emprestimo",
  balanceCents: balance,
  ratePercent: rate,
  rateUnit: "am",
  paymentCents: payment,
  remainingPayments: null,
  system: "nao-sei",
  recurringFeesCents: 0,
});

export default function QuandoFicoLivreDasDividasPage() {
  const today = todayInBrazil();
  const base = (debts: JourneyDebt[]): JourneyInput => ({ debts, keepBudget: true, strategy: "maior-taxa", monthlyExtraCents: 0, lumpSum: null, startIso: today });
  const run = (input: JourneyInput) => {
    const o = simulateJourney(input);
    return o.kind === "ok" ? o.result : null;
  };

  const ex10 = base([debt("a", "Dívida", 10_000_00, 3, 500_00)]);
  const ex20 = base([debt("a", "Dívida", 20_000_00, 3, 1_000_00)]);
  const ex2 = base([debt("cartao", "Cartão parcelado", 6_000_00, 8, 600_00), debt("emprestimo", "Empréstimo", 15_000_00, 2.5, 700_00)]);
  const r10 = run(ex10);
  const r10x = run(withMonthlyExtra(ex10, 300_00));
  const r20 = run(ex20);
  const r20x = run(withMonthlyExtra(ex20, 300_00));
  const r2 = run(ex2);
  const r2x = run(withMonthlyExtra(ex2, 300_00));
  const c10 = r10 && r10x ? compareJourneys(r10, r10x) : null;
  const c20 = r20 && r20x ? compareJourneys(r20, r20x) : null;
  const c2 = r2 && r2x ? compareJourneys(r2, r2x) : null;
  const byPayment = [500_00, 750_00, 1_000_00, 1_500_00].flatMap((p) => {
    const r = run(base([debt("a", "Dívida", 10_000_00, 3, p)]));
    return r ? [{ p, r }] : [];
  });

  const prefill = (exampleId: string, input: JourneyInput, premise: string): DebtJourneyPrefill => ({
    exampleId,
    debts: input.debts.map((d) => ({ label: d.label, type: d.type, balanceCents: d.balanceCents, ratePercent: d.ratePercent, rateUnit: d.rateUnit, paymentCents: d.paymentCents, remainingPayments: d.remainingPayments })),
    keepBudget: input.keepBudget,
    premise,
  });

  return (
    <div data-track-area="ferramenta" data-track="quando-fico-livre-das-dividas" className="mx-auto max-w-3xl px-4 py-8">
      <JsonLd data={webPageJsonLd(TITLE, DESCRIPTION, PATH)} />
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: "Simuladores", path: "/simuladores/" },
          { name: "Quando fico livre das dívidas?", path: PATH },
        ]}
      />

      <p className="mt-6 text-sm font-semibold uppercase tracking-widest text-brand-teal-dark">Simulador de quitação de dívidas</p>
      <h1 className="mt-2 font-serif text-3xl font-bold leading-tight text-brand-navy md:text-4xl">Quando fico livre das dívidas?</h1>
      <p className="mt-3 text-lg leading-relaxed text-brand-muted">
        Adicione suas dívidas e veja como elas tendem a cair mês a mês, quando cada uma termina e o que muda se você pagar um pouco mais.
      </p>

      <div className="mt-6">
        <DebtJourneySimulator today={today} context="ferramenta" />
      </div>

      <ToolNextSteps toolId="quando-fico-livre-das-dividas" />

      <section aria-labelledby="como-saber" className="article-body mt-12">
        <h2 id="como-saber">Como saber quando termino de pagar minhas dívidas?</h2>
        <p>
          O tempo para quitar uma dívida depende principalmente do saldo, da taxa de juros e do valor pago por mês. Se o pagamento for
          maior que os juros e encargos do período, o saldo tende a cair; pagamentos extras podem reduzir prazo e custo. Dividir o
          saldo pelo pagamento não funciona, porque ignora os juros que entram todo mês. O simulador roda a trajetória mês a mês,
          dívida por dívida, e mostra em que mês cada uma termina.
        </p>

        <h2 id="exemplos">Exemplos de trajetória</h2>
        <p>
          Exemplos matemáticos, não promessas. Premissas: taxa hipotética constante, sem novas compras, sem atraso, sem renegociação, e
          o pagamento de uma dívida que termina passa para as outras.
        </p>
        <h3>Dívida de R$ 10 mil</h3>
        {r10 && r10x && c10 && r10.months && r10x.months ? (
          <p>
            Com taxa de 3% ao mês e pagamento de R$ 500 por mês, a simulação chega a saldo zero em {formatMonths(r10.months)} ({monthLabel(r10.endDateIso!)}), com{" "}
            {brl(r10.totalPaidCents)} desembolsados, dos quais {brl(r10.costKnownCents)} são juros. Com R$ 300 a mais por mês, termina em{" "}
            {formatMonths(r10x.months)}: {formatMonths(c10.monthsSaved!)} a menos e {brl(c10.costSavedCents)} de juros evitados.
          </p>
        ) : null}
        <SimulateJourneyButton label="Abrir este cenário no simulador" detail={prefill("divida-10-mil", ex10, "Exemplo preenchido: dívida de R$ 10.000 a 3% ao mês (taxa hipotética), pagando R$ 500 por mês. Troque pelos seus números.")} />
        {byPayment.length > 0 ? (
          <>
            <p>A mesma dívida de R$ 10 mil a 3% ao mês, com pagamentos diferentes:</p>
            <ScenarioTable
              caption="Dívida de R$ 10 mil a 3% ao mês, por pagamento mensal"
              head={["Pagamento", "Termina em", "Total pago", "Juros"]}
              rows={byPayment.map(({ p, r }) => ({
                key: String(p),
                cells: [`${brlRound(p)}/mês`, r.months ? formatMonths(r.months) : "não zera", brlRound(r.totalPaidCents), brlRound(r.costKnownCents)],
              }))}
            />
          </>
        ) : null}
        <h3>Dívida de R$ 20 mil</h3>
        {r20 && r20x && c20 && r20.months && r20x.months ? (
          <p>
            A 3% ao mês pagando R$ 1.000, a simulação termina em {formatMonths(r20.months)}, com {brl(r20.costKnownCents)} de juros. Pagando R$ 1.300, em{" "}
            {formatMonths(r20x.months)}, com {brl(c20.costSavedCents)} a menos de juros.
          </p>
        ) : null}
        <SimulateJourneyButton label="Abrir este cenário no simulador" detail={prefill("divida-20-mil", ex20, "Exemplo preenchido: dívida de R$ 20.000 a 3% ao mês (taxa hipotética), pagando R$ 1.000 por mês. Troque pelos seus números.")} />
        <h3>Duas dívidas ao mesmo tempo</h3>
        {r2 && r2x && c2 && r2.months && r2x.months ? (
          <p>
            Cartão parcelado de R$ 6.000 a 8% ao mês (R$ 600/mês) e empréstimo de R$ 15.000 a 2,5% ao mês (R$ 700/mês), pagamento
            da primeira que termina redirecionado para a outra: a primeira dívida acaba em {formatMonths(r2.milestones[0]!.month)} e a
            rota inteira em {formatMonths(r2.months)}. Com R$ 300 a mais por mês, {formatMonths(c2.monthsSaved!)} a menos.
          </p>
        ) : null}
        <SimulateJourneyButton label="Abrir este cenário no simulador" detail={prefill("duas-dividas", ex2, "Exemplo preenchido: cartão parcelado de R$ 6.000 a 8% a.m. e empréstimo de R$ 15.000 a 2,5% a.m. (taxas hipotéticas). Troque pelos seus números.")} />

        <h2 id="nao-diminui">Por que algumas dívidas parecem não diminuir?</h2>
        <p>
          Todo mês entram juros sobre o saldo. Se o pagamento só cobre esses juros, nada sobra para amortizar e o saldo fica igual;
          se cobre menos, o saldo cresce. O simulador detecta isso e avisa em vez de mostrar uma quitação em centenas de anos. Nesses
          casos, o que muda a rota é o pagamento, a taxa ou o contrato: renegociação, portabilidade ou troca da dívida.
        </p>

        <h2 id="pagar-mais">O que acontece quando pago um pouco mais?</h2>
        <p>
          O valor extra vai direto ao saldo, porque os juros do mês já foram pagos pela parcela. Isso reduz a base sobre a qual os
          juros do mês seguinte são calculados, e o efeito se acumula. Por isso R$ 100 a mais por mês costumam valer mais do que
          parecem, e o simulador mostra quanto, em meses e em reais.
        </p>

        <h2 id="divida-termina">O que acontece quando uma dívida termina?</h2>
        <p>
          O pagamento dela deixa de ser obrigatório. Você escolhe o que a simulação faz com esse valor: se continua indo para as
          outras dívidas (o que acelera a rota) ou se volta para o seu orçamento (o que libera renda aos poucos). Os dois caminhos
          aparecem com data.
        </p>

        <h2 id="varias">Como várias dívidas são simuladas juntas?</h2>
        <p>
          Cada dívida recebe pelo menos o pagamento informado. O dinheiro extra, e o pagamento das dívidas que já terminaram quando
          você mantém o orçamento, vai para a dívida prioritária da estratégia escolhida e, quando ela zera, para a seguinte.
        </p>

        <h2 id="estrategia">Maior taxa ou menor saldo primeiro?</h2>
        <p>
          Maior taxa primeiro tende a pagar menos juros no total. Menor saldo primeiro zera a primeira dívida mais cedo. O simulador
          aceita as duas e uma ordem manual; não elege uma como certa. A comparação em detalhe está no guia{" "}
          <Link href="/organizacao-financeira/qual-divida-pagar-primeiro/">qual dívida pagar primeiro</Link>.
        </p>

        <h2 id="nao-cobre">E se o pagamento não cobre os juros?</h2>
        <p>
          A dívida não amortiza e a simulação diz isso. Se o pagamento das dívidas compromete recursos necessários às despesas
          básicas, existem mecanismos de prevenção e tratamento do superendividamento previstos na legislação brasileira (Lei nº
          14.181/2021). O guia da <Link href="/organizacao-financeira/lei-do-superendividamento/">Lei do Superendividamento</Link>{" "}
          explica o caminho, sem pagar nada a ninguém.
        </p>

        <h2 id="linha-do-tempo">Como interpretar a linha do tempo?</h2>
        <p>
          Cada marco é calculado da própria simulação: a primeira dívida que termina, o mês em que metade do saldo inicial já foi
          eliminada, a última dívida e o saldo zero. As datas são aproximadas: o mês 1 é o mês seguinte a hoje, e cada mês recebe um
          pagamento.
        </p>

        <h2 id="perguntas-frequentes">Perguntas frequentes</h2>
        <FaqAccordion>
          <FaqItem question="Quanto tempo demora para quitar uma dívida?" id="quanto-tempo-demora-para-quitar-uma-divida">
            <p>Depende do saldo, da taxa e do pagamento. Com os três, o simulador mostra o mês. Sem a taxa, mostra só o cronograma das parcelas.</p>
          </FaqItem>
          <FaqItem question="Quanto preciso pagar por mês?" id="quanto-preciso-pagar-por-mes">
            <p>Pelo menos mais que os juros do mês, senão o saldo não cai. Teste valores no simulador: cada um mostra a data e o custo.</p>
          </FaqItem>
          <FaqItem question="Pagar mais reduz os juros?" id="pagar-mais-reduz-os-juros">
            <p>Sim, porque reduz o saldo sobre o qual os juros dos meses seguintes incidem. O Código de Defesa do Consumidor assegura a liquidação antecipada, total ou parcial, com redução proporcional dos juros (art. 52, §2º).</p>
          </FaqItem>
          <FaqItem question="Qual dívida deve ser paga primeiro?" id="qual-divida-deve-ser-paga-primeiro">
            <p>O simulador mostra o efeito de cada ordem; a decisão é sua. O guia <Link href="/organizacao-financeira/qual-divida-pagar-primeiro/">qual dívida pagar primeiro</Link> compara os métodos.</p>
          </FaqItem>
          <FaqItem question="Posso usar com cartão de crédito?" id="posso-usar-com-cartao-de-credito">
            <p>Com a fatura já parcelada, sim. No rotativo, não: {ROTATIVO_DURATION.summary} Use a <Link href="/calculadoras/juros-cartao-credito/">Calculadora de Juros do Cartão</Link> para a próxima fatura.</p>
          </FaqItem>
          <FaqItem question="Posso usar com financiamento?" id="posso-usar-com-financiamento">
            <p>Sim, na Price ou na SAC. O simulador não inclui seguros e tarifas do financiamento a menos que você informe o valor mensal em “mais detalhes”.</p>
          </FaqItem>
          <FaqItem question="O resultado é exato?" id="o-resultado-e-exato">
            <p>Não. É uma simulação com taxa constante, pagamentos em dia e sem novas compras. O saldo oficial é sempre o da instituição.</p>
          </FaqItem>
          <FaqItem question="E se a taxa mudar ou eu renegociar?" id="e-se-a-taxa-mudar-ou-eu-renegociar">
            <p>A rota muda. Refaça a simulação com os novos números; para uma proposta de acordo, a <Link href="/calculadoras/renegociacao-de-dividas/">calculadora de renegociação</Link> soma o que ela custa.</p>
          </FaqItem>
        </FaqAccordion>

        <h2 id="como-simulamos">Como simulamos</h2>
        <ul>
          <li><strong>Mês a mês.</strong> Em cada mês: 1) encargos sobre o saldo de cada dívida; 2) pagamento obrigatório de cada uma, nunca além do saldo mais os encargos; 3) o valor extra, o aporte único e os pagamentos das dívidas já quitadas (se você mantém o orçamento) vão à dívida prioritária da estratégia e depois à seguinte; 4) dívidas que zeram têm o pagamento liberado; 5) registro do mês.</li>
          <li><strong>Empréstimo, consignado, cheque especial, cartão parcelado e “outro”:</strong> juros do mês = saldo × taxa mensal; o que passa dos juros amortiza. Com parcela fixa, é a tabela Price.</li>
          <li><strong>Financiamento na SAC:</strong> amortização constante = saldo ÷ parcelas restantes; a parcela cai a cada mês. Valor extra reduz o prazo e mantém a amortização.</li>
          <li><strong>Acordo ou parcelamento sem taxa:</strong> desembolso = parcela × parcelas restantes, com data final. Juros não calculados, e o valor extra não é aplicado nessa dívida, porque sem taxa não dá para saber o que a antecipação abate.</li>
          <li><strong>Cartão no rotativo:</strong> fora da rota. {ROTATIVO_DURATION.summary}</li>
          <li><strong>Seguro ou tarifa dentro da parcela:</strong> sai do bolso, entra no custo, não amortiza.</li>
          <li><strong>Taxa:</strong> anual vira mensal por equivalência composta, (1 + i)^(1/12) − 1, nunca ÷ 12. Taxa acima de 35% ao mês pede confirmação da unidade.</li>
          <li><strong>Desempate:</strong> maior taxa → menor saldo → ordem de cadastro; menor saldo → maior taxa → ordem de cadastro.</li>
          <li><strong>Última parcela:</strong> absorve o resíduo de centavos, como num contrato.</li>
          <li><strong>Marcos:</strong> primeira dívida quitada, metade do saldo inicial eliminada, 75% eliminados, última dívida e saldo zero, todos lidos da série simulada.</li>
          <li><strong>Datas:</strong> hoje no fuso de Brasília; o mês 1 é o mês seguinte.</li>
          <li><strong>Limite técnico:</strong> 1.200 meses. Se o saldo não zera, a simulação para e diz isso.</li>
        </ul>
        <p>
          <strong>Premissas:</strong> taxa constante; pagamentos em dia e no valor informado; nenhuma compra nova, novo uso de limite,
          atraso, multa, renegociação ou mudança de contrato no período. <strong>Não incluídos:</strong> IOF, encargos de atraso, custos
          de renegociação, correção por indexador e efeitos do teto de juros do cartão, que valem só para a fatura.
        </p>
        <p>
          <strong>Privacidade:</strong> o cálculo acontece no seu navegador. Saldos, taxas, pagamentos, apelidos e resultados não são
          enviados, gravados nem usados em medição de audiência.
        </p>

        <h2 id="fontes">Fontes e revisão</h2>
        <ul>
          <li>
            {EARLY_PAYOFF.source.organization} — <a href={EARLY_PAYOFF.source.url} target="_blank" rel="noopener noreferrer">{EARLY_PAYOFF.source.title}</a> (verificado em {EARLY_PAYOFF.verifiedAt}).
          </li>
          <li>
            {ROTATIVO_DURATION.source.organization} — {ROTATIVO_DURATION.source.title} (verificado em {ROTATIVO_DURATION.verifiedAt}).
          </li>
          <li>
            Presidência da República — <a href="https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14181.htm" target="_blank" rel="noopener noreferrer">Lei nº 14.181/2021 (prevenção e tratamento do superendividamento)</a>.
          </li>
          <li>
            Banco Central do Brasil — o <a href="https://www.bcb.gov.br/cidadaniafinanceira/registrato" target="_blank" rel="noopener noreferrer">Registrato</a> traz o Relatório de Empréstimos e Financiamentos, que pode ajudar a identificar operações registradas em seu nome. Este simulador não importa dados de lá.
          </li>
        </ul>
        <p>
          Conteúdo e ferramenta da Equipe Editorial do Crédito por Perto, que não concede crédito, não faz análise de crédito e não
          diagnostica superendividamento. Este é um simulador educativo, não um plano financeiro personalizado. Encontrou algo errado?
          Veja a <Link href="/politica-de-correcoes/">política de correções</Link>. Metodologia revisada em {REVIEWED}.
        </p>
      </section>
    </div>
  );
}
