import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { webPageJsonLd } from "@/lib/schema/jsonld";
import { JsonLd } from "@/components/seo/JsonLd";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ToolNextSteps } from "@/components/journeys/ToolNextSteps";
import { FgtsAdvanceSimulator, MONTHS, SimulateFgtsButton } from "@/components/calculators/FgtsAdvanceSimulator";
import { ScenarioTable } from "@/components/calculators/HomeFinancingSimulator";
import {
  balanceForSaqueCents,
  bracketFor,
  daysBetween,
  discount,
  simulateAdvance,
  transferDate,
  waitingPeriod,
  type SimulationResult,
} from "@/lib/calculators/fgts-advance";
import {
  ADVANCE_RULES,
  SAQUE_TABLE,
  TERMINATION_RULES,
  advanceRulesAt,
  formatIsoDate,
  nextAdvanceChange,
  todayInBrazil,
} from "@/lib/calculators/fgts-rules";
import { EARLY_PAYOFF } from "@/lib/calculators/credit-card-rules";

/**
 * Página do simulador de antecipação do Saque-Aniversário.
 *
 * INTENÇÃO: "quanto consigo / quanto recebo" (simular). O artigo
 * "Antecipação do saque-aniversário" é dono de "como funciona / vale a pena";
 * os dois se apontam.
 *
 * DATA: a página inteira — limite de saques, exemplos, textos — sai do módulo
 * de regras para a data de hoje, no fuso de Brasília. `revalidate` de uma
 * hora faz a troca de 31/10 para 01/11/2026 aparecer sem ninguém editar nada;
 * o simulador ainda confere o relógio da pessoa ao montar.
 *
 * EXEMPLOS: sempre com premissas declaradas (data, mês de aniversário, taxa
 * HIPOTÉTICA). Nenhuma URL por saldo.
 */

export const revalidate = 3600;

const PATH = "/calculadoras/antecipacao-fgts/";
const TITLE = "Simulador de antecipação do FGTS: quanto você recebe";
const DESCRIPTION =
  "Informe saldo do FGTS, mês de aniversário e taxa para estimar os saques antecipáveis, quanto receberia hoje e o custo. Grátis e sem cadastro.";
const REVIEWED = "23/09/2026";

/** Premissas dos exemplos — hipotéticas, e a página diz isso. */
const EXAMPLE_RATE = 2;
const EXAMPLE_MONTH = 3;

export const metadata: Metadata = buildMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const pct = (v: number, digits = 2) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const reais = (cents: number) => brl(cents).replace(",00", "");

function example(balanceReais: number, date: string, count: number): SimulationResult | null {
  const o = simulateAdvance({ balanceCents: balanceReais * 100, birthMonth: EXAMPLE_MONTH, rate: EXAMPLE_RATE, rateUnit: "am", count, simDate: date });
  return o.kind === "ok" ? o.result : null;
}

export default function AntecipacaoFgtsPage() {
  const today = todayInBrazil();
  const period = advanceRulesAt(today);
  const max = period?.maxSaques ?? 3;
  const change = nextAdvanceChange(today);
  const monthName = MONTHS[EXAMPLE_MONTH - 1];

  const balances = [1_000, 5_000, 10_000, 20_000, 30_000];
  const examples = balances.flatMap((b) => {
    const r = example(b, today, max);
    return r ? [{ b, r }] : [];
  });
  const twenty = examples.find((e) => e.b === 20_000)?.r ?? null;
  const ten = examples.find((e) => e.b === 10_000)?.r ?? null;
  const base500 = balanceForSaqueCents(ADVANCE_RULES.maxPerSaqueCents);

  // Um saque de R$ 500 visto de distâncias diferentes, à taxa hipotética.
  const distances = [1, 2, 3].map((years) => {
    const y = Number(today.slice(0, 4)) + years;
    const date = transferDate(y, EXAMPLE_MONTH);
    return { y, date, today: Math.round(discount(ADVANCE_RULES.maxPerSaqueCents, daysBetween(today, date), EXAMPLE_RATE)) };
  });

  const official = SAQUE_TABLE.officialExample;
  const officialBracket = bracketFor(official.balanceCents);
  const waitingExample = waitingPeriod("2026-01-10", "2026-01-10");

  const premises = `data de ${formatIsoDate(today)}, aniversário em ${monthName}, taxa hipotética de ${pct(EXAMPLE_RATE)}% ao mês`;

  return (
    <div data-track-area="ferramenta" data-track="antecipacao-fgts" className="mx-auto max-w-3xl px-4 py-8">
      <JsonLd data={webPageJsonLd(TITLE, DESCRIPTION, PATH)} />
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: "Calculadoras", path: "/calculadoras/" },
          { name: "Antecipação do FGTS", path: PATH },
        ]}
      />

      <h1 className="mt-6 font-serif text-3xl font-bold leading-tight text-brand-navy md:text-4xl">
        Simulador de Antecipação do Saque-Aniversário FGTS
      </h1>
      <p className="mt-3 text-lg leading-relaxed text-brand-muted">
        Estime quantos saques podem ser antecipados, quanto você receberia hoje e quanto do seu FGTS fica comprometido.
      </p>

      <div className="mt-6">
        <FgtsAdvanceSimulator today={today} context="ferramenta" />
      </div>

      <ToolNextSteps toolId="antecipacao-fgts" />

      <section aria-labelledby="como-funciona" className="article-body mt-12">
        <h2 id="como-funciona">Como funciona a antecipação do FGTS?</h2>
        <p>
          Esta antecipação troca valores futuros do Saque-Aniversário por dinheiro disponível hoje. Você cede à instituição
          os próximos saques anuais; ela paga hoje um valor menor que a soma deles, porque desconta juros pelo tempo até cada
          repasse. No mês do seu aniversário, o FGTS repassa o saque cedido direto à instituição. {ADVANCE_RULES.summaries.transfer}{" "}
          Como funciona a modalidade, os riscos e quando ela pesa no orçamento estão no guia sobre{" "}
          <Link href="/emprestimos/antecipacao-saque-aniversario-fgts/">antecipação do Saque-Aniversário</Link>.
        </p>

        <h2 id="calculo-saque">Como é calculado o Saque-Aniversário?</h2>
        <p>
          O valor anual é o saldo total das contas do FGTS multiplicado pela alíquota da faixa, mais uma parcela adicional.
          Com {reais(official.balanceCents)} de saldo, por exemplo, o saque é {pct(officialBracket.rate * 100, 0)}% de{" "}
          {reais(official.balanceCents)} mais {reais(officialBracket.addCents)}: {brl(official.saqueCents)}.
        </p>
        <ScenarioTable
          caption="Tabela do Saque-Aniversário"
          head={["Saldo total", "Alíquota", "Parcela adicional"]}
          rows={SAQUE_TABLE.brackets.map((b, i) => {
            const prev = i === 0 ? null : SAQUE_TABLE.brackets[i - 1]!.upToCents;
            const range =
              b.upToCents === null
                ? `Acima de ${reais(prev!)}`
                : prev === null
                  ? `Até ${reais(b.upToCents)}`
                  : `De ${brl(prev + 1)} a ${reais(b.upToCents)}`;
            return { key: String(i), cells: [range, `${pct(b.rate * 100, 0)}%`, b.addCents === 0 ? "—" : reais(b.addCents)] };
          })}
        />
        <p>{SAQUE_TABLE.changeNote} Tabela verificada em {SAQUE_TABLE.verifiedAt}.</p>

        <h2 id="todo-o-saldo">Por que não posso antecipar todo o saldo?</h2>
        <p>Porque a antecipação não usa o saldo: usa alguns dos próximos Saques-Aniversário. São quatro filtros em sequência:</p>
        <ol>
          <li>o Saque-Aniversário libera só uma parte do saldo por ano, pela tabela acima;</li>
          <li>a antecipação só alcança os próximos saques, até {max} pelas regras de hoje;</li>
          <li>
            cada saque cedido vai de {reais(ADVANCE_RULES.minPerSaqueCents)} a {reais(ADVANCE_RULES.maxPerSaqueCents)}, mesmo que o
            saque do ano seja maior;
          </li>
          <li>os valores futuros são descontados pela taxa para chegar ao valor recebido hoje.</li>
        </ol>
        {twenty ? (
          <p>
            Com R$ 20.000 de saldo, o Saque-Aniversário calculado é de {brl(twenty.firstSaqueCents)}, mas cada saque cedido fica
            em {brl(twenty.firstCedibleCents)}. Com {max} saques, isso soma {brl(twenty.priced.nominalCents)} em direitos futuros
            — e, com as premissas deste exemplo ({premises}), cerca de {brl(twenty.priced.presentCents)} hoje.
          </p>
        ) : null}

        <h2 id="quantos-saques">Quantos saques posso antecipar?</h2>
        <p>
          Pelas regras vigentes em {formatIsoDate(today)}, até <strong>{max} Saques-Aniversário</strong>.{" "}
          {change && period?.to
            ? `Esse limite vale até ${formatIsoDate(period.to)}; a partir de ${formatIsoDate(change.from)}, o limite previsto passa a ${change.maxSaques}. `
            : ""}
          {ADVANCE_RULES.summaries.perCompetence}
          {period && !change ? ` ${ADVANCE_RULES.summaries.newContract}` : ""}
        </p>

        <h2 id="minimo-maximo">Qual o valor mínimo e máximo por saque?</h2>
        <p>
          Cada Saque-Aniversário cedido precisa ficar entre {reais(ADVANCE_RULES.minPerSaqueCents)} e{" "}
          {reais(ADVANCE_RULES.maxPerSaqueCents)}. Se o saque do ano passar de {reais(ADVANCE_RULES.maxPerSaqueCents)}, só{" "}
          {reais(ADVANCE_RULES.maxPerSaqueCents)} podem ser cedidos; se ficar abaixo de {reais(ADVANCE_RULES.minPerSaqueCents)},
          aquele ano não entra. Pela tabela, um saldo a partir de {base500 ? brl(base500) : "—"} já gera um saque de{" "}
          {reais(ADVANCE_RULES.maxPerSaqueCents)}.
        </p>

        <h2 id="taxa">Como a taxa reduz o valor recebido hoje?</h2>
        <p>
          Cada saque é trazido para hoje pela taxa, pelo tempo que falta até o repasse: quanto mais distante, menor o valor
          hoje. Um saque de {reais(ADVANCE_RULES.maxPerSaqueCents)}, com as premissas do exemplo ({premises}), vale hoje:
        </p>
        <ul>
          {distances.map((d) => (
            <li key={d.y}>
              repasse em {formatIsoDate(d.date)}: cerca de {brl(d.today)}
            </li>
          ))}
        </ul>

        {examples.length > 0 ? (
          <>
            <h2 id="exemplos">Quanto dá para antecipar com diferentes saldos?</h2>
            <p>
              Premissas de todos os exemplos: {premises}, {max} saques pedidos, sem depósitos futuros. A taxa não é de nenhuma
              instituição — use o botão para simular e troque pelos números da sua proposta.
            </p>
            <ScenarioTable
              caption={`Exemplos com taxa hipotética de ${pct(EXAMPLE_RATE)}% ao mês`}
              head={["Saldo", "Saque-Aniversário", "Saques cedidos", "Direitos cedidos", "Hoje, aproximado"]}
              rows={examples.map(({ b, r }) => ({
                key: String(b),
                cells: [reais(b * 100), brl(r.firstSaqueCents), String(r.priced.rows.length), brl(r.priced.nominalCents), brl(r.priced.presentCents)],
              }))}
            />
            {examples.some(({ r }) => r.priced.rows.length < max) ? (
              <p>
                Com saldo pequeno, os saques dos anos seguintes caem abaixo de {reais(ADVANCE_RULES.minPerSaqueCents)} e não podem
                ser cedidos — por isso a quantidade de saques é menor.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-x-2">
              {examples.map(({ b }) => (
                <SimulateFgtsButton
                  key={b}
                  label={`Simular ${b >= 1_000 ? `R$ ${b / 1_000} mil` : reais(b * 100)} de saldo`}
                  detail={{ exampleId: `saldo-${b}`, balanceCents: b * 100, birthMonth: EXAMPLE_MONTH, monthlyRatePercent: EXAMPLE_RATE, count: max }}
                />
              ))}
            </div>
          </>
        ) : null}

        <h2 id="bloqueio">Por que parte do FGTS fica bloqueada?</h2>
        <p>
          {ADVANCE_RULES.summaries.blocking} Por isso, alguém que recebe um valor antecipado pode ter um valor diferente
          bloqueado no saldo. O bloqueio é uma garantia, não o débito: o débito acontece a cada aniversário, quando o saque
          cedido é repassado. O simulador não calcula o valor bloqueado — ele é determinado pelo sistema do FGTS.
        </p>
        <p>{ADVANCE_RULES.summaries.blockingTransition}</p>

        <h2 id="carencia">Existe carência?</h2>
        <p>
          Existe. {ADVANCE_RULES.summaries.waiting} São {ADVANCE_RULES.waitingDays} dias corridos, não três meses
          {waitingExample ? `: quem aderiu em 10/01/2026, por exemplo, poderia autorizar a partir de ${formatIsoDate(waitingExample.eligibleFrom)}` : ""}.
          O simulador faz essa conta com a data que você informar.
        </p>

        <h2 id="demissao">O que acontece em caso de demissão?</h2>
        <p>{TERMINATION_RULES.dismissal}</p>

        <h2 id="saque-rescisao">Posso voltar ao Saque-Rescisão?</h2>
        <p>
          {TERMINATION_RULES.returnToRescisao} As diferenças entre as duas modalidades estão em{" "}
          <Link href="/emprestimos/saque-aniversario-vale-a-pena/">saque-aniversário vale a pena?</Link>
        </p>

        <h2 id="perguntas-frequentes">Perguntas frequentes</h2>

        <h3>Tenho R$ 10 mil no FGTS. Quanto consigo antecipar?</h3>
        {ten ? (
          <p>
            Depende do saque anual, dos limites vigentes, da quantidade cedida, da taxa e do mês de aniversário. Com R$ 10.000,
            o Saque-Aniversário calculado é de {brl(ten.firstSaqueCents)}, e cada saque cedido fica em{" "}
            {brl(ten.firstCedibleCents)}. Com {max} saques e as premissas do exemplo ({premises}), seriam{" "}
            {brl(ten.priced.nominalCents)} em direitos futuros e cerca de {brl(ten.priced.presentCents)} hoje.
          </p>
        ) : null}
        <SimulateFgtsButton
          label="Simular R$ 10 mil de saldo"
          detail={{ exampleId: "faq-10000", balanceCents: 10_000_00, birthMonth: EXAMPLE_MONTH, monthlyRatePercent: EXAMPLE_RATE, count: max }}
        />

        <h3>Posso antecipar de novo?</h3>
        <p>
          {ADVANCE_RULES.summaries.perCompetence} Saques já cedidos não entram numa nova operação.{" "}
          {ADVANCE_RULES.summaries.newContract}
        </p>

        <h3>Posso quitar a antecipação antes?</h3>
        <p>{EARLY_PAYOFF.summary}</p>

        <h3>Existe CET na antecipação?</h3>
        <p>
          Existe. O <Link href="/juros-e-cet/o-que-e-cet/">CET</Link> reúne juros, IOF e tarifas e é informado pela instituição.
          A taxa de juros sozinha não é o CET, e o simulador não calcula CET — no modo “Já tenho uma proposta”, ele mostra o que
          você informar e estima a taxa implícita pelas datas dos repasses.
        </p>

        <h3>Qual instituição oferece a menor taxa?</h3>
        <p>
          O Crédito por Perto não faz ranking de instituições. Com duas ou três propostas em mãos, o modo “Já tenho uma
          proposta” coloca lado a lado o valor recebido, os saques cedidos, a diferença, a taxa e o CET informados.
        </p>

        <h2 id="como-calculamos">Como calculamos</h2>
        <ul>
          <li>
            <strong>Saque-Aniversário:</strong> saldo × alíquota da faixa + parcela adicional, pela tabela acima.
          </li>
          <li>
            <strong>Valor cedível:</strong> o menor entre o saque do ano e {reais(ADVANCE_RULES.maxPerSaqueCents)}; abaixo de{" "}
            {reais(ADVANCE_RULES.minPerSaqueCents)}, o ano não entra.
          </li>
          <li>
            <strong>Saldo ano a ano:</strong> o saldo de hoje, sem depósitos e sem rendimento, cai pelo saque inteiro a cada
            aniversário; o saque seguinte é recalculado pela tabela. O simulador avisa quando deixar a parte não cedida na conta
            mudaria o resultado.
          </li>
          <li>
            <strong>Datas:</strong> primeiro saque no ano corrente se o mês de aniversário ainda não chegou; repasse no{" "}
            {ADVANCE_RULES.transferBusinessDay}º dia útil do mês, contando fins de semana e feriados nacionais fixos. Feriados
            móveis ou locais podem deslocar a data em um ou dois dias.
          </li>
          <li>
            <strong>Valor presente:</strong> cada saque ÷ (1 + taxa mensal)<sup>dias corridos ÷ 30</sup>, somados e
            arredondados ao centavo só no fim. Taxa anual convertida por equivalência: (1 + anual)<sup>1/12</sup> − 1.
          </li>
          <li>
            <strong>Taxa implícita (proposta):</strong> a taxa mensal que iguala o valor recebido aos repasses datados, pela
            mesma convenção, encontrada por bisseção. Não é o CET.
          </li>
          <li>
            <strong>Não incluído:</strong> IOF, tarifas, outras convenções de cálculo das instituições e o valor bloqueado no
            FGTS. Por isso o resultado é uma estimativa, e pode não coincidir com a proposta de uma instituição.
          </li>
        </ul>
        <p>
          <strong>Privacidade:</strong> o cálculo acontece no seu navegador. Saldo, datas, taxa e proposta não são enviados,
          gravados nem usados em medição de audiência.
        </p>

        <h2 id="fontes">Fontes e verificação</h2>
        <ul>
          <li>
            {SAQUE_TABLE.source.organization} —{" "}
            <a href={SAQUE_TABLE.source.url} target="_blank" rel="noopener noreferrer">{SAQUE_TABLE.source.title}</a>.
            Informações verificadas em {SAQUE_TABLE.verifiedAt}.
          </li>
          {Object.values(ADVANCE_RULES.sources).map((s) => (
            <li key={s.url}>
              {s.organization} —{" "}
              <a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a>. Informações verificadas em{" "}
              {ADVANCE_RULES.verifiedAt}.
            </li>
          ))}
          <li>
            {TERMINATION_RULES.source.organization} —{" "}
            <a href={TERMINATION_RULES.source.url} target="_blank" rel="noopener noreferrer">{TERMINATION_RULES.source.title}</a>.
            Informações verificadas em {TERMINATION_RULES.verifiedAt}.
          </li>
          <li>
            {EARLY_PAYOFF.source.organization} —{" "}
            <a href={EARLY_PAYOFF.source.url} target="_blank" rel="noopener noreferrer">{EARLY_PAYOFF.source.title}</a>.
            Informações verificadas em {EARLY_PAYOFF.verifiedAt}.
          </li>
        </ul>
        <p>
          Conteúdo e ferramenta da Equipe Editorial do Crédito por Perto, que não concede crédito, não acessa conta do FGTS, não
          representa a CAIXA e não recebe por nenhuma contratação. Encontrou algo errado? Veja a{" "}
          <Link href="/politica-de-correcoes/">política de correções</Link>. Metodologia revisada em {REVIEWED}.
        </p>
      </section>
    </div>
  );
}
