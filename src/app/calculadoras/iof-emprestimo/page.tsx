import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { webPageJsonLd } from "@/lib/schema/jsonld";
import { JsonLd } from "@/components/seo/JsonLd";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ToolNextSteps } from "@/components/journeys/ToolNextSteps";
import { IofCalculator, SimulateIofButton } from "@/components/calculators/IofCalculator";
import { ScenarioTable } from "@/components/calculators/HomeFinancingSimulator";
import { calculateIof, type IofInput } from "@/lib/calculators/iof-credit";
import {
  CAP_RULE,
  COVERAGE_FROM,
  IOF_REGIMES,
  IOF_RULES_VERIFIED_AT,
  JUDICIAL_RECORD,
  OPERATION_RULES,
  formatRate,
} from "@/lib/calculators/iof-credit-rules";
import { formatIsoDate, todayInBrazil } from "@/lib/calculators/civil-date";

/**
 * Página da calculadora de IOF de empréstimo.
 *
 * INTENÇÃO: "calcular" o IOF. O artigo "IOF no empréstimo" é dono de
 * "explicar"; os dois se apontam.
 *
 * REGRAS: só as do módulo `iof-credit-rules.ts`, com vigência e fonte. Os
 * exemplos são calculados pelo motor para a data de hoje e declaram tomador,
 * operação, prazo e forma de amortização.
 */

export const revalidate = 3600;

const PATH = "/calculadoras/iof-emprestimo/";
const TITLE = "Calculadora de IOF de empréstimo: quanto você paga";
const DESCRIPTION =
  "Informe valor, prazo e tipo da operação para estimar o IOF do empréstimo e ver quanto vem da alíquota diária e da adicional. Grátis e sem cadastro.";
const REVIEWED = "23/09/2026";

export const metadata: Metadata = buildMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

const pf = IOF_REGIMES.find((r) => r.borrower === "pf")!;
const pj = IOF_REGIMES.find((r) => r.borrower === "pj")!;
const simples = IOF_REGIMES.find((r) => r.borrower === "simples")!;

export default function IofEmprestimoPage() {
  const today = todayInBrazil();
  const base: IofInput = {
    amountCents: 10_000_00,
    term: 12,
    termUnit: "meses",
    schedule: "parcelas",
    releaseDate: today,
    borrower: "pf",
    operation: "comum",
    payment: "descontado",
  };
  const iof = (patch: Partial<IofInput>) => {
    const o = calculateIof({ ...base, ...patch });
    return o.kind === "ok" ? o.result : null;
  };

  const byAmount = [1_000, 5_000, 10_000, 20_000].flatMap((reais) => {
    const r = iof({ amountCents: reais * 100 });
    return r ? [{ reais, r }] : [];
  });
  const byInstallments = [6, 12, 24, 48].flatMap((n) => {
    const r = iof({ term: n });
    return r ? [{ n, r }] : [];
  });
  const byDays = [30, 90, 180, 365, 730].flatMap((d) => {
    const r = iof({ term: d, termUnit: "dias", schedule: "unico" });
    return r ? [{ d, r }] : [];
  });
  const d365 = byDays.find((x) => x.d === 365)?.r;
  const d730 = byDays.find((x) => x.d === 730)?.r;
  const ten12 = byInstallments.find((x) => x.n === 12)?.r;
  const financed12 = iof({ payment: "financiado" });
  const premises = `pessoa física, empréstimo comum, operação em ${formatIsoDate(today)}, parcelas mensais com amortização igual e IOF descontado do valor`;

  return (
    <div data-track-area="ferramenta" data-track="iof-emprestimo" className="mx-auto max-w-3xl px-4 py-8">
      <JsonLd data={webPageJsonLd(TITLE, DESCRIPTION, PATH)} />
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: "Calculadoras", path: "/calculadoras/" },
          { name: "IOF de empréstimo", path: PATH },
        ]}
      />

      <h1 className="mt-6 font-serif text-3xl font-bold leading-tight text-brand-navy md:text-4xl">Calculadora de IOF de Empréstimo</h1>
      <p className="mt-3 text-lg leading-relaxed text-brand-muted">
        Informe o valor e o prazo para estimar o IOF e entender como o imposto é calculado.
      </p>

      <div className="mt-6">
        <IofCalculator today={today} context="ferramenta" />
      </div>

      <ToolNextSteps toolId="iof-emprestimo" />

      <section aria-labelledby="como-calcular" className="article-body mt-12">
        <h2 id="como-calcular">Como calcular o IOF de um empréstimo?</h2>
        <p>O IOF do crédito tem duas partes, e as duas aparecem separadas no resultado:</p>
        <ol>
          <li>
            <strong>IOF adicional:</strong> uma alíquota única sobre o valor da operação, que não depende do prazo;
          </li>
          <li>
            <strong>IOF diário:</strong> uma alíquota por dia sobre o principal de cada parcela, contada da liberação até o
            vencimento daquela parcela, com limite de {pf.capDays} dias por principal.
          </li>
        </ol>
        <p>
          O IOF total é a soma das duas. Num empréstimo parcelado, cada parcela de principal tem o seu prazo: a primeira vence
          em cerca de 30 dias, a última no fim do contrato. Por isso a conta é feita parcela a parcela — e não pelo valor total
          multiplicado pelos dias do contrato.
        </p>

        <h2 id="pessoa-fisica">Qual é o IOF para pessoa física?</h2>
        <p>
          Pelas regras vigentes em {formatIsoDate(today)}, para empréstimo com valor definido: <strong>{formatRate(pf.dailyRate)} ao dia</strong> e{" "}
          <strong>{formatRate(pf.additionalRate)} de adicional</strong>. A parte diária para em {pf.capDays} dias por principal.
        </p>
        <ScenarioTable
          caption="Alíquotas do IOF-crédito com valor definido, por tomador"
          head={["Tomador", "Diária", "Adicional", "Desde"]}
          rows={[pf, pj, simples].map((r) => ({
            key: r.id,
            cells: [r.label, formatRate(r.dailyRate), formatRate(r.additionalRate), formatIsoDate(r.from)],
          }))}
        />
        <p>
          Para empresas, as alíquotas vêm do Decreto nº 12.499/2025, restabelecido por decisão cautelar do STF em{" "}
          {formatIsoDate(JUDICIAL_RECORD.decidedAt)}. {JUDICIAL_RECORD.effect}
        </p>

        <h2 id="diario-adicional">O que são IOF diário e adicional?</h2>
        <p>
          O adicional é cobrado uma vez, sobre o valor, qualquer que seja o prazo. O diário cresce com o tempo que cada parte do
          principal fica com você. Juntar os dois numa “taxa de IOF” esconde essa diferença: um empréstimo de 30 dias e um de
          dois anos pagam o mesmo adicional, mas diários muito diferentes.
        </p>

        <h2 id="limite-365">Existe limite de 365 dias?</h2>
        <p>
          Existe. {CAP_RULE.summary} ({CAP_RULE.reference}.)
          {d365 && d730
            ? ` Com R$ 10.000 pagos de uma vez, o IOF é de ${brl(d365.breakdown.totalCents)} em 365 dias — e continua ${brl(d730.breakdown.totalCents)} em 730 dias.`
            : ""}
        </p>
        {byDays.length > 0 ? (
          <ScenarioTable
            caption="R$ 10.000 pagos de uma vez: prazo × IOF (pessoa física)"
            head={["Prazo", "IOF diário", "IOF adicional", "IOF total"]}
            rows={byDays.map(({ d, r }) => ({
              key: String(d),
              cells: [`${d} dias`, brl(r.breakdown.dailyCents), brl(r.breakdown.additionalCents), brl(r.breakdown.totalCents)],
            }))}
          />
        ) : null}

        <h2 id="prazo-longo">Empréstimos longos pagam mais IOF indefinidamente?</h2>
        <p>
          Não. Cada parcela de principal conta no máximo {pf.capDays} dias. Num contrato de 48 parcelas, as parcelas que vencem
          depois de um ano entram com {pf.capDays} dias, e o IOF para de crescer por esse lado — o que continua crescendo com o
          prazo são os juros.
        </p>

        {byAmount.length > 0 && byInstallments.length > 0 ? (
          <>
            <h2 id="exemplos">Exemplos de IOF em empréstimos</h2>
            <p>
              O IOF não depende só do valor: prazo e modalidade também alteram o cálculo. Premissas de todos os exemplos:{" "}
              {premises}. Com juros em parcelas fixas (Price), o IOF fica um pouco maior, porque o principal se concentra no fim.
            </p>
            <h3>Quanto é o IOF de R$ 5 mil, R$ 10 mil e R$ 20 mil em 12 parcelas?</h3>
            <ScenarioTable
              caption="IOF em 12 parcelas mensais, por valor"
              head={["Valor", "IOF diário", "IOF adicional", "IOF total"]}
              rows={byAmount.map(({ reais, r }) => ({
                key: String(reais),
                cells: [brl(reais * 100), brl(r.breakdown.dailyCents), brl(r.breakdown.additionalCents), brl(r.breakdown.totalCents)],
              }))}
            />
            <h3>E R$ 10 mil em prazos diferentes?</h3>
            <ScenarioTable
              caption="IOF de R$ 10.000 por número de parcelas"
              head={["Parcelas", "IOF total", "% do valor"]}
              rows={byInstallments.map(({ n, r }) => ({
                key: String(n),
                cells: [`${n} parcelas`, brl(r.breakdown.totalCents), `${r.sharePercent.toLocaleString("pt-BR", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}%`],
              }))}
            />
            <div className="flex flex-wrap gap-x-2">
              <SimulateIofButton label="Simular R$ 5 mil" detail={{ exampleId: "5000-12x", amountCents: 5_000_00, term: 12, termUnit: "meses", schedule: "parcelas" }} />
              <SimulateIofButton label="Simular R$ 10 mil" detail={{ exampleId: "10000-12x", amountCents: 10_000_00, term: 12, termUnit: "meses", schedule: "parcelas" }} />
              <SimulateIofButton label="Simular R$ 20 mil" detail={{ exampleId: "20000-12x", amountCents: 20_000_00, term: 12, termUnit: "meses", schedule: "parcelas" }} />
            </div>
          </>
        ) : null}

        <h2 id="todo-emprestimo">Todo empréstimo paga IOF?</h2>
        <p>Não. Há isenções e alíquotas zero com condições próprias; a calculadora reconhece duas, e trata outras como casos específicos:</p>
        <ul>
          {OPERATION_RULES.filter((o) => o.kind !== "comum").map((o) => (
            <li key={o.kind}>
              <strong>{o.label}:</strong> {o.explanation}
              {o.reference ? ` (${o.reference}.)` : ""}
            </li>
          ))}
        </ul>

        <h2 id="cet">O IOF entra no CET?</h2>
        <p>
          Entra. O <Link href="/juros-e-cet/o-que-e-cet/">CET</Link> reúne juros, tarifas, seguros e tributos, entre eles o IOF.
          Para comparar propostas, o CET e o custo total dizem mais que a taxa de juros sozinha — o{" "}
          <Link href="/calculadoras/comparador-de-propostas/">comparador de propostas</Link> coloca duas ou três lado a lado.
        </p>

        <h2 id="financiado">O IOF pode ser financiado?</h2>
        <p>
          Pode, quando o contrato prevê. Aí o valor financiado precisa cobrir o que você recebe mais o próprio IOF, e os juros
          correm sobre o total. Como o IOF é proporcional ao principal para um mesmo cronograma, o valor financiado sai de uma
          conta direta: valor recebido ÷ (1 − IOF ÷ valor).
          {ten12 && financed12
            ? ` Em 12 parcelas, com o IOF descontado você contrata R$ 10.000 e recebe ${brl(ten12.receivedCents)}; com o IOF incluído, recebe R$ 10.000 e financia ${brl(financed12.contractedCents)}.`
            : ""}{" "}
          Na
          calculadora, escolha “Incluído no financiamento” nas opções avançadas.
        </p>

        <h2 id="perguntas-frequentes">Perguntas frequentes</h2>
        <h3>Quanto é o IOF de R$ 10 mil?</h3>
        <p>
          Depende do prazo e da forma de pagar.
          {ten12 && d365
            ? ` Com as premissas dos exemplos, R$ 10.000 em 12 parcelas pagam cerca de ${brl(ten12.breakdown.totalCents)}; pagos de uma vez em 365 dias, ${brl(d365.breakdown.totalCents)}.`
            : ""}
        </p>
        <h3>O IOF é devolvido se eu quitar antes?</h3>
        <p>
          O que acontece com o IOF já recolhido depende do contrato e da regra aplicável; a quitação antecipada reduz os juros
          ainda não incorridos. Peça o cálculo por escrito à instituição — e veja a{" "}
          <Link href="/calculadoras/quitacao-antecipada/">calculadora de quitação antecipada</Link>.
        </p>
        <h3>Alguém pediu que eu pague o IOF antes de liberar o empréstimo. É normal?</h3>
        <p>
          O IOF é recolhido pela própria instituição, descontado do valor liberado ou incluído no financiamento. Pedido de
          depósito antecipado para “liberar” crédito é um sinal clássico de golpe — veja os{" "}
          <Link href="/calculadoras/sinais-de-golpe/">sinais de golpe</Link> antes de pagar qualquer coisa.
        </p>

        <h2 id="como-calculamos">Como calculamos</h2>
        <ol>
          <li>Identificamos o tipo de operação e o tomador.</li>
          <li>Selecionamos a regra vigente na data da operação.</li>
          <li>Montamos o cronograma de principal: um vencimento, ou parcelas mensais no mesmo dia da liberação (amortização igual, ou Price se a taxa for informada).</li>
          <li>Calculamos a parte diária de cada principal pelos dias reais até o vencimento, no máximo {pf.capDays}.</li>
          <li>Aplicamos a alíquota adicional sobre o valor.</li>
          <li>Reconhecemos isenção e alíquota zero nas hipóteses modeladas.</li>
          <li>Somamos os componentes e arredondamos ao centavo só no fim.</li>
        </ol>
        <p>
          <strong>Cobertura:</strong> pessoa física a partir de {formatIsoDate(COVERAGE_FROM.pf)}; pessoa jurídica e Simples/MEI a
          partir de {formatIsoDate(COVERAGE_FROM.pj)}. Datas anteriores tiveram alíquotas diferentes e não são simuladas.
        </p>
        <p>
          <strong>Não cobertos:</strong> cheque especial, rotativo e limites sem principal definido; portabilidade; renegociação;
          operações de câmbio, seguro e investimento; Simples/MEI acima de R$ 30.000; cronogramas fora do padrão mensal.
        </p>
        <p>
          <strong>Privacidade:</strong> o cálculo acontece no seu navegador. Valor, prazo e resultado não são enviados, gravados
          nem usados em medição de audiência.
        </p>

        <h2 id="fontes">Fontes e verificação</h2>
        <ul>
          <li>
            {pf.source.organization} — <a href={pf.source.url} target="_blank" rel="noopener noreferrer">{pf.source.title}</a>.
          </li>
          <li>
            {pj.source.organization} — <a href={pj.source.url} target="_blank" rel="noopener noreferrer">{pj.source.title}</a>.
          </li>
          <li>
            {JUDICIAL_RECORD.source.organization} —{" "}
            <a href={JUDICIAL_RECORD.source.url} target="_blank" rel="noopener noreferrer">{JUDICIAL_RECORD.source.title}</a> ({JUDICIAL_RECORD.process}).
          </li>
        </ul>
        <p>
          Informações verificadas em {IOF_RULES_VERIFIED_AT}. Conteúdo e ferramenta da Equipe Editorial do Crédito por Perto,
          que não concede crédito, não recolhe IOF e não substitui a orientação da Receita Federal. Encontrou algo errado? Veja
          a <Link href="/politica-de-correcoes/">política de correções</Link>. Metodologia revisada em {REVIEWED}. Para
          entender o imposto em detalhe, leia o guia <Link href="/juros-e-cet/iof-no-emprestimo/">IOF no empréstimo</Link>.
        </p>
      </section>
    </div>
  );
}
