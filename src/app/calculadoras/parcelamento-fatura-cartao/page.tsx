import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { webPageJsonLd } from "@/lib/schema/jsonld";
import { JsonLd } from "@/components/seo/JsonLd";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ToolNextSteps } from "@/components/journeys/ToolNextSteps";
import {
  InvoiceInstallmentSimulator,
  SimulateInstallmentButton,
} from "@/components/calculators/InvoiceInstallmentSimulator";
import { ScenarioTable } from "@/components/calculators/HomeFinancingSimulator";
import { simulateInstallments, type ProposalAnalysis } from "@/lib/calculators/invoice-installment";
import {
  BC_RATES_PAGE,
  CAP_CONTINUITY,
  EARLY_PAYOFF,
  INSTALLMENT_IN_CONTRACT,
  INTEREST_CAP,
  LIMIT_CONSIDERS_FINANCING,
  PORTABILITY,
  RENEGOTIATION,
  ROTATIVO_DURATION,
} from "@/lib/calculators/credit-card-rules";
import { FaqAccordion, FaqItem } from "@/components/content/FaqAccordion";

/**
 * Página do simulador de parcelamento da fatura do cartão.
 *
 * INTENÇÃO: "parcelar a fatura vale a pena?" e "quanto custa dividir a dívida
 * em parcelas". A página não responde sim ou não: põe lado a lado as saídas
 * da fatura e o que cada uma custa, e o leitor decide com os próprios números. A calculadora de
 * juros do cartão é dona de "quanto custa não pagar a fatura"; o Comparador
 * de Propostas, de comparar créditos diferentes. As três se apontam.
 *
 * EXEMPLOS: calculados pelo motor com uma taxa HIPOTÉTICA, identificada. A
 * série do BC para "cartão parcelado" (SGS 25478) mistura compras parceladas
 * com juros e parcelamento de fatura — não serve de referência específica,
 * então a página não a usa.
 *
 * REGRAS: só as do módulo `credit-card-rules.ts`. A continuidade do teto do
 * rotativo para o parcelamento (CAP_CONTINUITY) só aparece quando tiver data
 * de verificação; sem ela, a seção sai da página.
 */

const PATH = "/calculadoras/parcelamento-fatura-cartao/";
const TITLE = "Parcelar fatura do cartão vale a pena? Simulador";
const DESCRIPTION =
  "Parcelar a fatura vale a pena? Veja o total pago e a taxa de cada proposta e compare até 3 opções. Limite, mínimo e rotativo. Grátis e sem CPF.";
const REVIEWED = "14/10/2026";
const CDC_URL = "https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm";

/**
 * Exemplo de como um emissor descreve o parcelamento na prática. A Caixa é
 * citada pelo nome, como exemplo dela — não como regra para todo cartão.
 * Página lida em 14/10/2026.
 */
const CAIXA_FAQ = {
  url: "https://www.caixa.gov.br/voce/cartoes/credito/rotativo/perguntas-frequentes/Paginas/default.aspx",
  verifiedAt: "14/10/2026",
};

/** Taxa dos exemplos — hipotética, e a página diz isso. */
const EXAMPLE_RATE = 9;

export const metadata: Metadata = buildMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const pct = (v: number, digits = 2) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

function sim(reais: number, installments: number): ProposalAnalysis | null {
  const o = simulateInstallments({ debtCents: reais * 100, ratePercent: EXAMPLE_RATE, rateUnit: "am", installments });
  return o.kind === "ok" ? o.analysis : null;
}

export default function ParcelamentoFaturaPage() {
  const byTerm = [6, 12, 18].flatMap((n) => {
    const a = sim(5_000, n);
    return a ? [{ n, a }] : [];
  });
  const byValue = [2_000, 5_000, 10_000].flatMap((reais) => {
    const a = sim(reais, 12);
    return a ? [{ reais, a }] : [];
  });
  const six = byTerm.find((r) => r.n === 6)?.a;
  const eighteen = byTerm.find((r) => r.n === 18)?.a;
  const brief = { a: { debt: 4_800_00, pmt: 529_90, n: 12 } };
  const briefTotal = brief.a.pmt * brief.a.n;

  return (
    <div data-track-area="ferramenta" data-track="parcelamento-fatura-cartao" className="mx-auto max-w-3xl px-4 py-8">
      <JsonLd data={webPageJsonLd(TITLE, DESCRIPTION, PATH)} />
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: "Calculadoras", path: "/calculadoras/" },
          { name: "Parcelamento da fatura", path: PATH },
        ]}
      />

      <h1 className="mt-6 font-serif text-3xl font-bold leading-tight text-brand-navy md:text-4xl">
        Simulador de parcelamento da fatura do cartão
      </h1>
      <p className="mt-3 text-lg leading-relaxed text-brand-muted">
        Veja quanto o parcelamento custa no total e compare as opções oferecidas na sua fatura. Grátis, sem
        cadastro e sem CPF: a conta é feita no seu navegador.
      </p>

      <div className="mt-6">
        <InvoiceInstallmentSimulator context="ferramenta" />
      </div>

      <ToolNextSteps toolId="parcelamento-fatura-cartao" />

      <section aria-labelledby="vale-a-pena" className="article-body mt-12">
        <h2 id="vale-a-pena">Parcelar a fatura do cartão vale a pena?</h2>
        <p>
          Não existe resposta que sirva para todo mundo. O que decide é quanto cada saída custa em reais, com os números
          da sua fatura, e se a parcela cabe no mês que vem. Quando a fatura não pode ser paga inteira, as saídas
          costumam ser estas:
        </p>
        <ScenarioTable
          caption="Saídas para uma fatura que não cabe no mês"
          head={["Saída", "O que acontece", "Onde ver o custo"]}
          rows={[
            {
              key: "total",
              cells: ["Pagar o total", "Não há juros de rotativo nem de parcelamento.", "Na própria fatura"],
            },
            {
              key: "parte",
              cells: [
                "Pagar entre o mínimo e o total",
                "O que falta entra no rotativo, que só dura até a próxima fatura.",
                "Calculadora de juros do cartão",
              ],
            },
            {
              key: "parcelar",
              cells: [
                "Parcelar a fatura",
                "Prazo, parcela e taxa definidos na proposta; o valor ocupa limite do cartão.",
                "Este simulador, pelo total e pelo CET",
              ],
            },
            {
              key: "outro-credito",
              cells: [
                "Quitar com outro crédito",
                "Troca a dívida do cartão por outra, com taxa e prazo próprios.",
                "Ferramenta trocar dívida, pelo CET",
              ],
            },
            {
              key: "atrasar",
              cells: [
                "Pagar menos que o mínimo ou atrasar",
                "Há atraso: entram multa e juros de mora do contrato, além dos juros.",
                "Contrato e fatura",
              ],
            },
          ]}
        />
        <p>
          Com essas contas lado a lado, a escolha é sua. As perguntas abaixo explicam o que a regra do Banco Central diz
          sobre cada caso.
        </p>

        <h2 id="minimo-ou-parcelar">É melhor parcelar a fatura ou pagar o mínimo?</h2>
        <p>
          Pagar o mínimo não encerra a dívida: o que falta vai para o rotativo. {ROTATIVO_DURATION.summary} Ou seja,
          pagar o mínimo adia a decisão por um mês, com os juros do rotativo nesse meio-tempo, que costumam ficar entre os
          mais altos do crédito à pessoa física nas{" "}
          <a href={BC_RATES_PAGE} target="_blank" rel="noopener noreferrer">
            taxas médias publicadas pelo Banco Central
          </a>
          . Quanto esse mês custa, com a taxa da sua fatura, a{" "}
          <Link href="/calculadoras/juros-cartao-credito/">calculadora de juros do cartão</Link> mostra; quanto custa o
          parcelamento, o simulador acima. Compare os dois totais.
        </p>

        <h2 id="limite-volta">Quando parcelo a fatura, o limite volta?</h2>
        <p>
          Não de uma vez. {LIMIT_CONSIDERS_FINANCING.summary} Na prática, o valor parcelado continua ocupando o limite e
          vai sendo liberado conforme as parcelas são pagas. A Caixa, por exemplo, informa nas{" "}
          <a href={CAIXA_FAQ.url} target="_blank" rel="noopener noreferrer">
            perguntas frequentes do cartão
          </a>{" "}
          que o valor financiado e os juros do parcelamento ocupam o limite, liberado à medida que as parcelas são pagas.
          Como funciona no seu cartão está no contrato e no aplicativo.
        </p>

        <h2 id="automatico">O banco parcelou minha fatura automaticamente. Pode?</h2>
        <p>
          {INSTALLMENT_IN_CONTRACT.summary} Por isso alguns contratos fazem o parcelamento automaticamente quando o
          pagamento não corresponde a nenhuma das opções da fatura. Na Caixa, por exemplo, um pagamento abaixo do mínimo e
          acima da parcela do parcelamento em 24 vezes vira entrada, e o restante é parcelado em 12 vezes. Se você não
          reconhece as condições aplicadas, peça o contrato e o demonstrativo à instituição; o caminho de reclamação está
          em <Link href="/juros-e-cet/juros-abusivos-como-saber/">juros abusivos: como saber</Link>.
        </p>

        <h2 id="parcelar-ou-acordo">É melhor parcelar a fatura ou fazer um acordo?</h2>
        <p>
          Os dois são formas de financiar a mesma dívida, e a comparação se faz pelo total a pagar e pelo CET. {RENEGOTIATION.summary}{" "}
          Se a proposta de acordo vier com parcelas e prazo, coloque-a no simulador ao lado do parcelamento da fatura. Como
          preparar a negociação está em{" "}
          <Link href="/organizacao-financeira/como-negociar-dividas/">como negociar dívidas</Link>.
        </p>
      </section>

      <section aria-labelledby="como-funciona" className="article-body mt-12">
        <h2 id="como-funciona">Como funciona o parcelamento da fatura?</h2>
        <p>
          A instituição divide o saldo da fatura em parcelas mensais, com os juros e os demais custos que a proposta
          informa. É uma forma de financiar a dívida diferente do rotativo: tem prazo, parcela e taxa definidos na
          proposta, enquanto o rotativo só vai até a próxima fatura.{" "}
          Quanto o rotativo custa até a próxima fatura está na{" "}
          <Link href="/calculadoras/juros-cartao-credito/">calculadora de juros do cartão</Link>.
        </p>

        <h2 id="total">Como saber quanto vou pagar no total?</h2>
        <p>
          Multiplique o valor da parcela pelo número de parcelas e some a entrada, se houver. A diferença entre esse
          total e o valor da dívida é o custo adicional do parcelamento — que pode incluir juros, IOF e tarifas, e por
          isso não é chamado aqui só de juros. Uma proposta de 12 vezes de {brl(brief.a.pmt)} sobre{" "}
          {brl(brief.a.debt)} soma {brl(briefTotal)}: {brl(briefTotal - brief.a.debt)} acima do valor parcelado.
        </p>
        <p>
          Com o valor, o número de parcelas e a parcela, o simulador também estima a <strong>taxa implícita
          aproximada nas parcelas</strong> — a taxa que, com parcelas iguais, leva do valor parcelado às parcelas
          informadas. Ela não é a taxa do contrato nem o CET: as parcelas podem embutir IOF e tarifas.
        </p>

        <h2 id="taxa-e-cet">Onde encontro a taxa e o CET?</h2>
        <p>
          Nas opções de parcelamento, na fatura ou no aplicativo, procure a taxa mensal e anual e o{" "}
          <Link href="/juros-e-cet/o-que-e-cet/">CET</Link>, o Custo Efetivo Total, que reúne os juros e os outros custos
          da operação. Para comparar ofertas, o CET diz mais que a parcela. Se não encontrar, o simulador funciona só com
          o valor, as parcelas e o valor de cada uma.
        </p>

        {byTerm.length > 1 && six && eighteen ? (
          <>
            <h2 id="parcela-menor">Parcela menor significa custo menor?</h2>
            <p>
              Não necessariamente. Com a mesma dívida e a mesma taxa, alongar o prazo baixa a parcela e aumenta o total.
              Exemplo educativo: R$ 5.000 a uma taxa hipotética de {pct(EXAMPLE_RATE)}% ao mês, parcelas iguais, sem IOF
              e sem tarifas.
            </p>
            <ScenarioTable
              caption="R$ 5.000 parcelados em prazos diferentes, taxa hipotética"
              head={["Parcelas", "Parcela", "Total", "Custo adicional"]}
              rows={byTerm.map(({ n, a }) => ({
                key: String(n),
                cells: [`${n}x (${n} meses)`, brl(a.installmentCents), brl(a.disbursedCents), brl(a.extraCostCents)],
              }))}
            />
            <p>
              Para reduzir a parcela de {brl(six.installmentCents)} para {brl(eighteen.installmentCents)}, a dívida
              fica 12 meses a mais e soma {brl(eighteen.disbursedCents - six.disbursedCents)} a mais no total. Qual pesa
              mais depende do seu orçamento — o simulador mostra os dois lados com os seus números.
            </p>
          </>
        ) : null}

        {byValue.length > 0 ? (
          <>
            <h2 id="exemplos">Exemplos: quanto fica parcelar R$ 2.000, R$ 5.000 e R$ 10.000?</h2>
            <p>
              Em 12 parcelas iguais, com a mesma taxa hipotética de {pct(EXAMPLE_RATE)}% ao mês. Não é oferta nem taxa de
              nenhuma instituição, e o CET não foi considerado: use o botão para simular e troque pelos números da sua
              fatura.
            </p>
            <ScenarioTable
              caption="Exemplos de parcelamento em 12 vezes, taxa hipotética"
              head={["Valor", "Parcela", "Total", "Custo adicional"]}
              rows={byValue.map(({ reais, a }) => ({
                key: String(reais),
                cells: [brl(reais * 100), `12x ${brl(a.installmentCents)}`, brl(a.disbursedCents), brl(a.extraCostCents)],
              }))}
            />
            <div className="flex flex-wrap gap-x-2">
              {byValue.map(({ reais }) => (
                <SimulateInstallmentButton
                  key={reais}
                  label={`Simular R$ ${reais.toLocaleString("pt-BR")}`}
                  detail={{ exampleId: `${reais}-12x`, debtCents: reais * 100, installments: 12, monthlyRatePercent: EXAMPLE_RATE }}
                />
              ))}
            </div>
          </>
        ) : null}

        <h2 id="rotativo-ou-parcelamento">Rotativo e parcelamento são diferentes?</h2>
        <p>
          São. O rotativo é o financiamento automático do saldo não pago, só até a próxima fatura; o parcelamento divide
          a dívida em parcelas, com prazo e taxa próprios. As condições de cada um estão na fatura. Compare o custo em
          reais das opções que você recebeu — nenhuma é automaticamente a mais barata para todo mundo.
        </p>

        <h2 id="limite">Existe limite de juros e encargos?</h2>
        <p>
          Existe. {INTEREST_CAP.summary} O limite vale para o que foi acumulado — não é uma taxa — e alcança tanto o
          rotativo quanto o parcelamento da fatura.
        </p>

        {CAP_CONTINUITY.verifiedAt ? (
          <>
            <h2 id="veio-do-rotativo">A dívida veio do rotativo: o limite começa de novo?</h2>
            <p>
              {CAP_CONTINUITY.summary} Por isso o simulador pergunta se a dívida veio do rotativo e, se veio, o valor
              original que entrou nele e os encargos já cobrados antes do parcelamento. Fonte:{" "}
              <a href={CAP_CONTINUITY.source.url} target="_blank" rel="noopener noreferrer">
                {CAP_CONTINUITY.source.organization}, {CAP_CONTINUITY.source.title.toLowerCase()}
              </a>
              . Informações verificadas em {CAP_CONTINUITY.verifiedAt}.
            </p>
          </>
        ) : null}

        <h2 id="portabilidade">É possível levar a dívida para outra instituição?</h2>
        <p>
          {PORTABILITY.summary} Se chegar uma proposta de outra instituição, a comparação se faz pelo custo total e
          pelo CET. O caminho completo está em{" "}
          <Link href="/organizacao-financeira/como-sair-do-rotativo/">como sair do rotativo do cartão</Link>, e o{" "}
          <Link href="/calculadoras/comparador-de-propostas/">comparador de propostas</Link> coloca a proposta atual e a
          nova lado a lado.
        </p>

        <h2 id="quitar-antes">Posso quitar o parcelamento antes?</h2>
        <p>
          {EARLY_PAYOFF.summary} Por isso quitar antes não é pagar as parcelas restantes pelo valor cheio. Quanto uma
          antecipação reduz, com os números do seu contrato, a{" "}
          <Link href="/calculadoras/quitacao-antecipada/">calculadora de quitação antecipada</Link> mostra.
        </p>

        <h2 id="comparar">Como comparar duas propostas?</h2>
        <p>
          Pelo total a pagar e pelo CET, no mesmo valor de dívida. Coloque as opções da fatura no simulador — até três —
          e ele mostra lado a lado parcela, prazo, total, custo adicional e as taxas informadas, sem eleger uma
          vencedora. Se a ideia é trocar o parcelamento por outro crédito, a ferramenta{" "}
          <Link href="/calculadoras/trocar-divida/">trocar dívida</Link> compara os dois custos.
        </p>

        <h2 id="perguntas-frequentes">Perguntas frequentes</h2>
        <FaqAccordion>
          <FaqItem question="Como calcular o parcelamento da fatura?" id="como-calcular-o-parcelamento-da-fatura">
            <p>
              Total = parcela × número de parcelas (+ entrada). Custo adicional = total − valor da dívida. Com parcelas
              iguais e uma taxa mensal i, a parcela é valor × i ÷ [1 − (1 + i)<sup>−n</sup>]; com taxa zero, valor ÷ n.
            </p>
          </FaqItem>
          <FaqItem question="Como descobrir os juros pelas parcelas?" id="como-descobrir-os-juros-pelas-parcelas">
            <p>
              Informe o valor parcelado, o número de parcelas e o valor de cada uma: o simulador calcula a taxa mensal
              implícita nas parcelas. Se a proposta tiver IOF ou tarifas embutidos, essa taxa sai maior que a taxa de juros
              do contrato — por isso ela é chamada de aproximada.
            </p>
          </FaqItem>
          <FaqItem question="Quantas vezes posso parcelar a fatura do cartão?" id="quantas-vezes-posso-parcelar-a-fatura-do-cartao">
            <p>
              A regra do Banco Central não fixa número de parcelas nem de parcelamentos: o prazo e as opções são os que a
              instituição oferece na fatura ou no aplicativo. Um novo parcelamento com outro ainda ativo depende da
              instituição; na Caixa, por exemplo, fica a critério do banco, e cada parcelamento tem a taxa da data da
              proposta. O valor já parcelado não pode voltar ao rotativo.
            </p>
          </FaqItem>
          <FaqItem question="É melhor parcelar a fatura ou pegar um empréstimo?" id="e-melhor-parcelar-a-fatura-ou-pegar-um-emprestimo">
            <p>
              Depende do custo das duas ofertas para o mesmo valor. Compare o total a pagar e o CET de cada uma: a ferramenta{" "}
              <Link href="/calculadoras/trocar-divida/">trocar dívida</Link> coloca a dívida do cartão e o novo crédito lado
              a lado, e o <Link href="/calculadoras/comparador-de-propostas/">comparador de propostas</Link> faz o mesmo com
              ofertas diferentes. Um empréstimo que quita a fatura só reduz o custo se o novo total for menor.
            </p>
          </FaqItem>
          <FaqItem question="O que acontece se eu não pagar a fatura no dia?" id="o-que-acontece-se-eu-nao-pagar-a-fatura-no-dia">
            <p>
              Aí há atraso, e não só rotativo: entram os encargos de atraso do contrato, como juros de mora e multa. A
              multa, pelo{" "}
              <a href={CDC_URL} target="_blank" rel="noopener noreferrer">
                Código de Defesa do Consumidor
              </a>{" "}
              (art. 52, § 1º), não pode passar de 2% do valor da prestação. O que vem depois está em{" "}
              <Link href="/organizacao-financeira/o-que-acontece-ao-atrasar-parcela/">o que acontece ao atrasar uma parcela</Link>.
            </p>
          </FaqItem>
          <FaqItem question="Parcelar a fatura diminui o score?" id="parcelar-a-fatura-diminui-o-score">
            <p>
              Não há fórmula pública: cada birô de crédito calcula o score com metodologia própria, a partir do histórico
              registrado. Por isso ninguém de fora consegue dizer quanto um parcelamento muda a pontuação. Como o score
              funciona e como consultar o seu de graça está em{" "}
              <Link href="/organizacao-financeira/score-de-credito/">score de crédito</Link>.
            </p>
          </FaqItem>
          <FaqItem question="Parcelar a fatura do Nubank ou de outro banco vale a pena?" id="parcelar-a-fatura-do-nubank-ou-de-outro-banco-vale-a-pena">
            <p>
              A conta é a mesma em qualquer instituição: as opções aparecem no aplicativo ou na fatura, com parcela, prazo,
              taxa e CET. Leve esses números ao simulador e compare o total com as outras saídas da fatura. O portal não
              avalia nem recomenda bancos.
            </p>
          </FaqItem>
          <FaqItem question="A taxa implícita é o CET?" id="a-taxa-implicita-e-o-cet">
            <p>
              Não. O CET é informado pela instituição e considera todos os fluxos da operação. O simulador nunca calcula nem
              estima CET: mostra o que você informar.
            </p>
          </FaqItem>
        </FaqAccordion>

        <h2 id="como-calculamos">Como calculamos</h2>
        <ul>
          <li><strong>Total pago:</strong> soma dos desembolsos informados — entrada mais parcelas.</li>
          <li><strong>Custo adicional:</strong> total pago menos a dívida; a entrada entra uma vez só.</li>
          <li>
            <strong>Taxa implícita aproximada:</strong> a taxa mensal que, com parcelas iguais, iguala o valor parcelado
            às parcelas informadas, encontrada por bisseção numérica; a anual é a equivalente composta, (1 + mensal)
            <sup>12</sup> − 1.
          </li>
          <li>
            <strong>Simulação:</strong> parcelas constantes pela fórmula acima, arredondadas ao centavo; taxa anual
            convertida para a mensal equivalente, (1 + anual)<sup>1/12</sup> − 1, nunca dividida por 12.
          </li>
          <li><strong>CET:</strong> só o informado pela instituição.</li>
          <li>
            <strong>Comparação:</strong> o mesmo motor do comparador de propostas — menor parcela, menor prazo, menor
            total e menor CET informado, como fatos, sem vencedora.
          </li>
          <li>
            <strong>Limite de encargos:</strong> aplicado só quando você informa a origem da dívida e a data indica que a
            regra é pertinente.
          </li>
        </ul>
        <p>
          <strong>Privacidade:</strong> o cálculo acontece no seu navegador. Nenhum valor digitado é enviado, gravado ou
          usado em medição de audiência.
        </p>

        <h2 id="fontes">Fontes e verificação</h2>
        <ul>
          <li>
            {INTEREST_CAP.source.organization} —{" "}
            <a href={INTEREST_CAP.source.url} target="_blank" rel="noopener noreferrer">{INTEREST_CAP.source.title}</a>{" "}
            (limite de juros e encargos e portabilidade). Informações verificadas em {INTEREST_CAP.verifiedAt}.
          </li>
          <li>
            {ROTATIVO_DURATION.source.organization} —{" "}
            <a href={ROTATIVO_DURATION.source.url} target="_blank" rel="noopener noreferrer">{ROTATIVO_DURATION.source.title}</a>{" "}
            (permanência no rotativo, parcelamento previsto no contrato, limite do cartão e renegociação). Informações
            verificadas em {ROTATIVO_DURATION.verifiedAt}.
          </li>
          <li>
            Presidência da República —{" "}
            <a href={CDC_URL} target="_blank" rel="noopener noreferrer">Código de Defesa do Consumidor (Lei nº 8.078/1990)</a>,
            art. 52, § 1º (multa de atraso).
          </li>
          <li>
            Caixa Econômica Federal —{" "}
            <a href={CAIXA_FAQ.url} target="_blank" rel="noopener noreferrer">perguntas frequentes do crédito rotativo</a>{" "}
            (exemplo de como um emissor aplica o parcelamento e o limite). Página lida em {CAIXA_FAQ.verifiedAt}.
          </li>
          <li>
            {EARLY_PAYOFF.source.organization} —{" "}
            <a href={EARLY_PAYOFF.source.url} target="_blank" rel="noopener noreferrer">{EARLY_PAYOFF.source.title}</a>.
            Informações verificadas em {EARLY_PAYOFF.verifiedAt}.
          </li>
          {CAP_CONTINUITY.verifiedAt ? (
            <li>
              {CAP_CONTINUITY.source.organization} —{" "}
              <a href={CAP_CONTINUITY.source.url} target="_blank" rel="noopener noreferrer">{CAP_CONTINUITY.source.title}</a>.
              Informações verificadas em {CAP_CONTINUITY.verifiedAt}.
            </li>
          ) : null}
        </ul>
        <p>
          Conteúdo e ferramenta da Equipe Editorial do Crédito por Perto, que não concede crédito, não emite cartão, não
          negocia dívidas e não recebe por nenhuma contratação. Encontrou algo errado? Veja a{" "}
          <Link href="/politica-de-correcoes/">política de correções</Link>. Metodologia revisada em {REVIEWED}.
        </p>
      </section>
    </div>
  );
}
