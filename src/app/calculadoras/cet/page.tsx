import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { webPageJsonLd } from "@/lib/schema/jsonld";
import { JsonLd } from "@/components/seo/JsonLd";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ToolNextSteps } from "@/components/journeys/ToolNextSteps";
import { CetCalculator, SimulateCetButton, type CetPrefillDetail } from "@/components/calculators/CetCalculator";
import { ScenarioTable } from "@/components/calculators/HomeFinancingSimulator";
import { analyzeProposal, CET_RULES, type Cost, type ProposalResult } from "@/lib/calculators/cet";
import { monthlyToAnnual } from "@/lib/calculators/cash-flow";
import { pricePayment } from "@/lib/calculators/loan";
import { calculateIof } from "@/lib/calculators/iof-credit";
import { addDays, addMonths, formatIsoDate, todayInBrazil } from "@/lib/calculators/civil-date";

/**
 * Página da calculadora de CET.
 *
 * INTENÇÃO: "calcular / conferir o CET". O artigo "O que é CET" é dono de
 * "entender"; os dois se apontam.
 *
 * EXEMPLOS: calculados pelo motor único, com data de hoje, parcelas pela
 * Price e todas as premissas declaradas. O exemplo "taxa menor, CET maior"
 * só aparece se a conta realmente produzir isso.
 */

export const revalidate = 3600;

const PATH = "/calculadoras/cet/";
const TITLE = "Calculadora de CET: custo efetivo total do empréstimo";
const DESCRIPTION =
  "Informe quanto recebeu, parcelas, tarifas, IOF e seguros para estimar o CET anual e entender o custo completo da proposta. Grátis e sem cadastro.";
const REVIEWED = "23/09/2026";

export const metadata: Metadata = buildMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const pct = (v: number, digits = 2) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const annual = (f: number) => `${pct(f * 100)}% a.a.`;

export default function CetPage() {
  const today = todayInBrazil();
  const first = addMonths(today, 1);

  /** Proposta pela Price: custos financiados entram no principal das parcelas. */
  function proposal(receivedReais: number, n: number, monthlyPercent: number, costs: Cost[]): { r: ProposalResult; detail: CetPrefillDetail } | null {
    const financedCosts = costs.filter((c) => c.mode === "financiado").reduce((s, c) => s + c.amountCents, 0);
    const installmentCents = Math.round(pricePayment(receivedReais * 100 + financedCosts, monthlyPercent / 100, n));
    const o = analyzeProposal({
      receivedCents: receivedReais * 100,
      installments: n,
      installmentCents,
      releaseDate: today,
      firstDueDate: first,
      costs,
      allCostsInformed: true,
      announcedRate: { value: monthlyPercent, unit: "am" },
      indexer: "nenhum",
      operation: "definida",
    });
    if (o.kind !== "ok") return null;
    return { r: o.result, detail: { exampleId: `${receivedReais}-${n}x-${monthlyPercent}`, receivedCents: receivedReais * 100, installments: n, installmentCents, costs, announcedMonthlyPercent: monthlyPercent } };
  }

  const sameA = proposal(10_000, 24, 1.5, []);
  const sameB = proposal(10_000, 24, 1.5, [{ kind: "tarifa", label: "Tarifa de cadastro", amountCents: 700_00, mode: "antecipado" }]);
  const lowA = proposal(10_000, 24, 1.5, []);
  const lowB = proposal(10_000, 24, 1.3, [
    { kind: "tarifa", label: "Tarifa de cadastro", amountCents: 800_00, mode: "financiado" },
    { kind: "seguro", label: "Seguro prestamista", amountCents: 600_00, mode: "financiado" },
  ]);
  const lowerRateHigherCet = lowA && lowB && lowB.r.annualRate > lowA.r.annualRate ? { a: lowA, b: lowB } : null;

  // R$ 10 mil em 24x com o IOF da calculadora de IOF (financiado) e uma tarifa.
  const iof = calculateIof({ amountCents: 10_000_00, term: 24, termUnit: "meses", schedule: "parcelas", monthlyRatePercent: 1.8, releaseDate: today, borrower: "pf", operation: "comum", payment: "descontado" });
  const iofCents = iof.kind === "ok" ? iof.result.breakdown.totalCents : null;
  const full =
    iofCents !== null
      ? proposal(10_000, 24, 1.8, [
          { kind: "iof", amountCents: iofCents, mode: "financiado" },
          { kind: "tarifa", label: "Tarifa de cadastro", amountCents: 500_00, mode: "financiado" },
        ])
      : null;

  const shortOp = analyzeProposal({
    receivedCents: 1_000_00,
    installments: 1,
    installmentCents: 1_030_00,
    releaseDate: today,
    firstDueDate: addDays(today, 15),
    costs: [],
    allCostsInformed: true,
    indexer: "nenhum",
    operation: "definida",
  });
  const longOp = proposal(20_000, 60, 1.2, []);

  return (
    <div data-track-area="ferramenta" data-track="cet" className="mx-auto max-w-3xl px-4 py-8">
      <JsonLd data={webPageJsonLd(TITLE, DESCRIPTION, PATH)} />
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: "Calculadoras", path: "/calculadoras/" },
          { name: "CET", path: PATH },
        ]}
      />

      <h1 className="mt-6 font-serif text-3xl font-bold leading-tight text-brand-navy md:text-4xl">Calculadora de CET — Custo Efetivo Total</h1>
      <p className="mt-3 text-lg leading-relaxed text-brand-muted">
        Informe quanto você recebe e tudo o que paga para estimar o custo anual da proposta.
      </p>

      <div className="mt-6">
        <CetCalculator today={today} context="ferramenta" />
      </div>

      <ToolNextSteps toolId="cet" />

      <section aria-labelledby="o-que-e" className="article-body mt-12">
        <h2 id="o-que-e">O que é CET?</h2>
        <p>
          O CET é uma taxa anual que consolida os custos e encargos vinculados à operação de crédito nas condições informadas.
          Não é a soma das taxas: ele sai do fluxo de dinheiro — o que você recebe, o que paga e quando. O guia{" "}
          <Link href="/juros-e-cet/o-que-e-cet/">o que é CET</Link> explica o conceito com calma.
        </p>

        <h2 id="como-calcula">Como o CET é calculado?</h2>
        <p>
          Pela {CET_RULES.resolution.title}, o CET é a taxa que iguala o valor recebido aos pagamentos futuros, cada um trazido
          para a data da liberação pelos dias corridos até ele: {CET_RULES.formula}
        </p>
        <p>
          Pagar R$ 500 no mês que vem e R$ 500 daqui a dois anos não tem o mesmo efeito financeiro. Por isso o CET considera também
          as datas dos pagamentos — e por isso “(total pago − recebido) ÷ recebido” não é CET: é só o acréscimo nominal.
        </p>

        <h2 id="o-que-entra">O que entra no CET?</h2>
        <p>{CET_RULES.definition} Custos pessoais que não têm a ver com a operação, como o deslocamento até o banco, ficam de fora.</p>

        {sameA && sameB ? (
          <>
            <h2 id="juros-e-cet">Taxa de juros e CET são diferentes?</h2>
            <p>
              São. Duas propostas de R$ 10.000 em 24 parcelas, as duas com juros de 1,50% ao mês ({annual(monthlyToAnnual(0.015))}{" "}
              equivalentes), primeira parcela em {formatIsoDate(first)}:
            </p>
            <ScenarioTable
              caption="Mesma taxa de juros, CET diferente"
              head={["Proposta", "Parcela", "Custo à parte", "CET estimado"]}
              rows={[
                { key: "a", cells: ["A — sem tarifa", `24 × ${brl(sameA.detail.installmentCents)}`, "—", annual(sameA.r.annualRate)] },
                { key: "b", cells: ["B — tarifa de R$ 700 paga na contratação", `24 × ${brl(sameB.detail.installmentCents)}`, brl(700_00), annual(sameB.r.annualRate)] },
              ]}
            />
            <SimulateCetButton label="Simular a proposta B" detail={sameB.detail} />
          </>
        ) : null}

        {lowerRateHigherCet ? (
          <>
            <h3>Taxa menor, CET maior?</h3>
            <p>
              Pode acontecer. A proposta A cobra 1,50% ao mês sem custos extras; a B cobra 1,30% ao mês, mas financia R$ 800 de tarifa e
              R$ 600 de seguro. Com essas premissas, o CET da B ({annual(lowerRateHigherCet.b.r.annualRate)}) fica acima do da A (
              {annual(lowerRateHigherCet.a.r.annualRate)}) — apesar da taxa de juros menor.
            </p>
            <SimulateCetButton label="Simular a proposta B" detail={lowerRateHigherCet.b.detail} />
          </>
        ) : null}

        <h2 id="iof">IOF entra no CET?</h2>
        <p>
          Entra: é tributo da operação. Faz diferença se ele foi descontado do valor liberado, incluído no financiamento ou pago à
          parte — na calculadora, cada custo tem essa pergunta. Para estimar o valor, use a{" "}
          <Link href="/calculadoras/iof-emprestimo/">calculadora de IOF</Link>.
        </p>
        {full && iofCents !== null ? (
          <>
            <p>
              Exemplo: R$ 10.000 em 24 parcelas a 1,80% ao mês, com IOF de {brl(iofCents)} (pessoa física, pela calculadora de IOF) e
              tarifa de R$ 500, os dois incluídos no financiamento. O valor financiado vai a {brl(full.r.financedCents)}, as parcelas
              ficam em {brl(full.detail.installmentCents)} e o CET estimado é {annual(full.r.annualRate)}, contra{" "}
              {annual(monthlyToAnnual(0.018))} da taxa de juros.
            </p>
            <SimulateCetButton label="Simular R$ 10 mil em 24x" detail={full.detail} />
          </>
        ) : null}

        <h2 id="seguro">Seguro entra no CET?</h2>
        <p>
          O seguro entra quando é vinculado à operação e cobrado do tomador. Informe quanto foi e como foi pago: à vista, incluído
          no financiamento ou junto com cada parcela.
        </p>

        <h2 id="tarifa">Tarifa entra no CET?</h2>
        <p>
          Entra — inclusive quando não é financiada. Tarifa paga à parte na contratação reduz o dinheiro que sobra com você no
          início; tarifa financiada aumenta as parcelas. Os dois caminhos mudam o CET de formas diferentes.
        </p>

        <h2 id="conferir">Como conferir o CET de uma proposta?</h2>
        <p>{CET_RULES.disclosure} Procure estes itens na proposta:</p>
        <ul>
          <li>CET e taxa efetiva de juros;</li>
          <li>valor solicitado, valor financiado e valor liberado;</li>
          <li>tarifas, tributos (IOF) e seguros, com a forma de pagamento;</li>
          <li>número, valor e datas das parcelas, e o total delas.</li>
        </ul>
        <p>
          Com esses números, use “Sim, analisar minha proposta” e informe o CET da proposta em “Conferir com a proposta”. Se a
          diferença for grande, a calculadora lista o que pode estar faltando.
        </p>

        <h2 id="anual">Por que o CET é anual?</h2>
        <p>
          A norma pede o CET em taxa percentual anual, para que propostas de prazos diferentes fiquem na mesma unidade. A
          calculadora mostra também o equivalente mensal, (1 + CET)<sup>1/12</sup> − 1 — que não é um “CET mensal” oficial.
        </p>

        <h2 id="alto-em-reais">CET alto significa custo enorme em reais?</h2>
        {shortOp.kind === "ok" ? (
          <p>
            Não necessariamente. R$ 1.000 pagos com R$ 1.030 em 15 dias têm CET estimado de {annual(shortOp.result.annualRate)} — e custam
            R$ 30. Como o CET é anualizado, operações curtas podem apresentar percentuais anuais elevados mesmo com poucos pagamentos.
          </p>
        ) : null}
        {longOp ? (
          <p>
            O contrário também vale: R$ 20.000 em 60 parcelas a 1,20% ao mês têm CET estimado de {annual(longOp.r.annualRate)}, e somam{" "}
            {brl(longOp.r.totalPaidCents - longOp.r.receivedCents)} a mais que o recebido. Por isso o CET se lê junto com o prazo e o
            valor em reais.
          </p>
        ) : null}

        <h2 id="indexadores">O que acontece com indexadores variáveis?</h2>
        <p>
          {CET_RULES.indexers} Em financiamentos com TR, IPCA ou taxa flutuante, o CET informado não é uma previsão do quanto você
          vai pagar até o fim: se houver indexadores ou taxas variáveis, o custo efetivo ao longo do contrato poderá mudar.
        </p>

        <h2 id="perguntas-frequentes">Perguntas frequentes</h2>
        <h3>O banco é obrigado a informar o CET?</h3>
        <p>{CET_RULES.disclosure} {CET_RULES.scope}</p>
        <h3>Posso calcular o CET pelas parcelas?</h3>
        <p>
          Pode. Com o valor que chegou, as parcelas e as datas, a calculadora encontra a taxa do fluxo — sem precisar da taxa de
          juros nem do CET. Se houver custos pagos fora das parcelas, informe-os para chegar ao CET.
        </p>
        <h3>Qual CET é considerado bom?</h3>
        <p>
          Não há um número único: depende da modalidade, do prazo, da garantia e do momento do mercado. Para ter referência, compare
          a taxa com a média oficial da mesma modalidade em{" "}
          <Link href="/calculadoras/minha-taxa-esta-cara/">minha taxa está cara?</Link> e as propostas entre si, pelo CET e pelo total.
        </p>
        <h3>Cheque especial e rotativo têm CET?</h3>
        <p>{CET_RULES.revolving} Por isso a calculadora de parcelas não se aplica a eles.</p>
        <h3>Como transformar CET anual em mensal?</h3>
        <p>Por equivalência composta: (1 + CET anual)<sup>1/12</sup> − 1. Dividir por 12 dá um número errado.</p>

        <h2 id="como-calculamos">Como calculamos</h2>
        <ul>
          <li>Montamos o fluxo: + valor liberado na data da liberação, − custos pagos à parte nessa data, − parcelas e custos nas datas em que acontecem.</li>
          <li>Datas reais, em dias corridos, com calendário civil (31/01 + 1 mês = 28 ou 29/02), sem fuso horário.</li>
          <li>Resolvemos Σ FCj ÷ (1 + taxa)<sup>(dj − d0)/365</sup> = 0 por bisseção com intervalo que se expande — sem limite artificial de taxa e sem depender de chute inicial.</li>
          <li>Precisão interna alta; arredondamento só na tela, com duas casas.</li>
          <li>Fluxos com mais de uma troca de sinal são recusados, em vez de mostrar uma taxa arbitrária.</li>
          <li>“CET estimado” só quando você confirma que informou todos os custos; senão, “taxa efetiva estimada do fluxo informado”.</li>
          <li>Indexadores variáveis não entram no cálculo; cheque especial, rotativo e crédito rural ficam fora do cálculo padrão.</li>
        </ul>
        <p>
          <strong>Limitações:</strong> parcelas mensais a partir da primeira data (ou parcelas diferentes informadas uma a uma, ou o
          fluxo manual); a calculadora não lê contratos nem consulta instituições, e o resultado depende dos números informados.
        </p>
        <p>
          <strong>Privacidade:</strong> o cálculo acontece no seu navegador. Valores, datas, taxas e resultados não são enviados,
          gravados nem usados em medição de audiência.
        </p>

        <h2 id="fontes">Fontes e verificação</h2>
        <ul>
          <li>
            {CET_RULES.resolution.organization} — <a href={CET_RULES.resolution.url} target="_blank" rel="noopener noreferrer">{CET_RULES.resolution.title}</a>.
          </li>
          <li>
            {CET_RULES.instruction.organization} — <a href={CET_RULES.instruction.url} target="_blank" rel="noopener noreferrer">{CET_RULES.instruction.title}</a>.
          </li>
        </ul>
        <p>
          Normas verificadas em {CET_RULES.verifiedAt}. Conteúdo e ferramenta da Equipe Editorial do Crédito por Perto, que não
          concede crédito e não substitui o demonstrativo da instituição. Encontrou algo errado? Veja a{" "}
          <Link href="/politica-de-correcoes/">política de correções</Link>. Metodologia revisada em {REVIEWED}.
        </p>
      </section>
    </div>
  );
}

