import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { webPageJsonLd } from "@/lib/schema/jsonld";
import { JsonLd } from "@/components/seo/JsonLd";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ToolNextSteps } from "@/components/journeys/ToolNextSteps";
import { BancoDoPovoSimulator } from "@/components/calculators/BancoDoPovoSimulator";
import { ScenarioTable } from "@/components/calculators/HomeFinancingSimulator";
import { BPP_RULES, SOURCES, type BppSource } from "@/lib/calculators/bpp-rules";
import { simulateBpp, type BppResult } from "@/lib/calculators/bpp-simulator";
import { getBppCityOptions } from "@/lib/local/bpp-cities";
import { FaqAccordion, FaqItem } from "@/components/content/FaqAccordion";

/**
 * Simulador do Banco do Povo Paulista — independente e não oficial.
 *
 * PAPEL NA ARQUITETURA (ver data/query-ownership-map.json):
 * - esta página: simular / calcular / parcela / quanto fica;
 * - o artigo /emprestimos/microcredito-produtivo-e-banco-do-povo/: o que é,
 *   como funciona, quem tem direito;
 * - os guias locais: onde pedir, endereço e atendimento da cidade.
 *
 * NÚMEROS: todos saem de `bpp-rules.ts` (com fonte e data) ou do motor, na
 * renderização. Nenhum valor digitado à mão no texto.
 *
 * SCHEMA: WebPage e BreadcrumbList, como o resto do site. Sem FAQPage (o
 * Google restringiu esse resultado a sites de governo e saúde) e sem
 * SoftwareApplication (o resultado enriquecido depende de avaliações, que não
 * existem e não serão inventadas).
 */

const PATH = "/calculadoras/simulador-banco-do-povo/";

/** "R$ 200" / "R$ 21 mil", a partir das regras: nenhum número digitado à mão na description. */
function reaisCurtos(cents: number): string {
  const reais = cents / 100;
  return reais >= 1000 && reais % 1000 === 0 ? `R$ ${reais / 1000} mil` : `R$ ${reais.toLocaleString("pt-BR")}`;
}
const TITLE = "Simulador Banco do Povo Paulista: parcela e juros";
const DESCRIPTION = `Simulador independente para o Banco do Povo Paulista: estime parcela, juros e total de ${reaisCurtos(BPP_RULES.amount.minCents)} a ${reaisCurtos(BPP_RULES.amount.maxCents)}, com carência, e veja requisitos e onde pedir.`;
const REVIEWED = "06/10/2026";

export const metadata: Metadata = buildMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const brl0 = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(cents / 100);
const pct = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function sim(amountReais: number, months: number, rate: number, grace = 0): BppResult | null {
  const o = simulateBpp({ profile: "mei", amountCents: amountReais * 100, months, graceMonths: grace, monthlyRatePercent: rate });
  return o.kind === "ok" ? o.result : null;
}

function SourceLinks({ sources }: { sources: readonly BppSource[] }) {
  return (
    <>
      {sources.map((s, i) => (
        <span key={s.url}>
          {i > 0 ? "; " : ""}
          <a href={s.url} target="_blank" rel="noopener noreferrer">
            {s.organization}
          </a>
        </span>
      ))}
    </>
  );
}

export default function SimuladorBancoDoPovoPage() {
  const cities = getBppCityOptions();
  const withUnit = cities.filter((c) => c.hasVerifiedUnit);
  const low = BPP_RULES.rate.fromMonthlyPercent;
  const high = BPP_RULES.rate.highestCitedMonthlyPercent;
  const maxMonths = BPP_RULES.term.maxMonths;

  const amounts = [1_000, 5_000, 10_000, 15_000, 21_000];
  const table = amounts.flatMap((a) => {
    const l = sim(a, maxMonths, low);
    const h = sim(a, maxMonths, high);
    return l && h ? [{ a, l, h }] : [];
  });
  const ten24 = sim(10_000, 24, high);
  const tenGrace = sim(10_000, 24, high, 3);
  const allSources = Object.values(SOURCES) as BppSource[];

  return (
    <div data-track-area="ferramenta" data-track="simulador-banco-do-povo" className="mx-auto max-w-3xl px-4 py-8">
      <JsonLd data={webPageJsonLd(TITLE, DESCRIPTION, PATH)} />
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: "Calculadoras", path: "/calculadoras/" },
          { name: "Simulador Banco do Povo", path: PATH },
        ]}
      />

      <p className="mt-6 inline-flex rounded-full border border-brand-border px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-muted">
        Ferramenta independente · não oficial
      </p>
      <h1 className="mt-3 font-serif text-3xl font-bold leading-tight text-brand-navy md:text-4xl">Simulador Banco do Povo Paulista</h1>
      <p className="mt-3 text-lg leading-relaxed text-brand-muted">
        Estime parcela, juros e total a pagar e entenda quais condições do Banco do Povo podem se aplicar ao seu perfil.
      </p>
      <p className="mt-4 rounded-lg border border-brand-warning/40 bg-brand-warning-soft px-4 py-3 text-sm leading-relaxed text-brand-text">
        <strong>Simulador independente e não oficial.</strong> O Crédito por Perto não representa o Banco do Povo Paulista nem o
        Governo do Estado de São Paulo.
      </p>

      <div className="mt-6">
        <BancoDoPovoSimulator cities={cities} context="ferramenta" showNotice={false} />
      </div>

      <p className="mt-4 text-sm leading-relaxed text-brand-muted">
        <strong className="text-brand-text">Simulador independente e não oficial.</strong> O Crédito por Perto não representa o
        Banco do Povo Paulista nem o Governo do Estado de São Paulo. Os resultados apresentados são estimativas baseadas nas
        condições públicas consultadas. Taxas, limites, prazos, tarifas, aprovação e demais condições podem variar conforme perfil,
        linha, município e análise realizada pelo programa. Condições consultadas até {BPP_RULES.verifiedAt}.
      </p>

      <ToolNextSteps toolId="simulador-banco-do-povo" />

      <section aria-labelledby="como-funciona" className="article-body mt-12">
        <h2 id="como-funciona">Como funciona o simulador do Banco do Povo?</h2>
        <p>
          Você responde o que já sabe (perfil, uso do dinheiro, valor e prazo) e escolhe um cenário de taxa. O simulador estima a
          parcela pelo sistema Price, com parcelas fixas, e mostra o total, os juros e a faixa entre as taxas divulgadas. Ele não
          substitui a simulação do atendimento: o Banco do Povo Paulista não publica, nas fontes oficiais que conferimos, o
          sistema de amortização nem a lista de custos do contrato. Por isso o resultado se chama <strong>estimativa</strong>.
        </p>

        <h2 id="quanto-libera">Quanto o Banco do Povo pode liberar?</h2>
        <p>
          A carta de serviços do Governo do Estado informa crédito de <strong>{brl0(BPP_RULES.amount.minCents)}</strong> a{" "}
          <strong>{brl0(BPP_RULES.amount.maxCents)}</strong>. {BPP_RULES.profileCap.text} {BPP_RULES.profileCap.divergence} O valor de
          cada pedido depende da análise.
        </p>

        <h2 id="taxa">Qual é a taxa de juros do Banco do Povo?</h2>
        <p>
          A carta de serviços estadual informa juros <strong>a partir de {pct(low)}% ao mês</strong>. “A partir de” não é a taxa de
          todo pedido: páginas oficiais de prefeituras citam de {pct(low)}% a {pct(high)}% ao mês, conforme a categoria do
          empreendedor. {BPP_RULES.rate.divergence} Por isso o simulador trabalha com os dois cenários e deixa você testar outra
          taxa.
        </p>
        {table.length > 0 ? (
          <ScenarioTable
            caption={`Estimativa de parcela em ${maxMonths} meses, sem carência, pelo sistema Price`}
            head={["Valor", `Parcela a ${pct(low)}%`, `Parcela a ${pct(high)}%`, `Total a ${pct(high)}%`]}
            rows={table.map(({ a, l, h }) => ({
              key: String(a),
              cells: [brl0(a * 100), brl(l.paymentCents), brl(h.paymentCents), brl(h.totalPaidCents)],
            }))}
          />
        ) : null}
        <p>
          Estimativas em {maxMonths} parcelas, sem carência e sem outros custos. {ten24 ? `Em 24 meses, R$ 10 mil a ${pct(high)}% ao mês dão parcelas de ${brl(ten24.paymentCents)}.` : ""}
        </p>

        <h2 id="quem-pode">Quem pode solicitar?</h2>
        <ul>
          {BPP_RULES.requirements.map((r) => (
            <li key={r.id}>
              {r.text}{" "}
              <span className="text-brand-muted">
                ({r.level === "estadual" ? "regra estadual" : "exigência de algumas prefeituras"}: <SourceLinks sources={r.sources} />)
              </span>
            </li>
          ))}
        </ul>
        <p>
          Com restrição cadastral, o pedido esbarra na exigência publicada pelas prefeituras. O caminho, nesse caso, começa
          em{" "}
          <Link href="/credito-seguro/consultar-nome-nos-biros-de-credito/">consultar e resolver a restrição</Link>.
        </p>

        <h2 id="mei">Banco do Povo para MEI</h2>
        <p>
          MEI entra no grupo de quem tem CNPJ, com o teto de {brl0(BPP_RULES.profileCap.pessoaJuridicaCents)} citado pelas
          prefeituras. Como empreendedor formal, a garantia pedida pela carta estadual é o Fundo de Aval do Estado. A documentação que o pequeno negócio costuma reunir está no{" "}
          <Link href="/emprestimos/emprestimo-para-mei/">guia do empréstimo para MEI</Link>, que também compara o Banco do Povo
          com o crédito de bancos e cooperativas.
        </p>

        <h2 id="autonomo">Banco do Povo para autônomo</h2>
        <p>
          O programa atende também quem trabalha por conta própria sem CNPJ, desde que a atividade seja produtiva. Para esse
          perfil, prefeituras citam até {brl0(BPP_RULES.profileCap.pessoaFisicaCents)}, e a garantia pedida pela carta
          estadual é um avalista. Como comprovar a renda sem holerite está no{" "}
          <Link href="/emprestimos/emprestimo-para-autonomo/">guia do autônomo</Link>.
        </p>

        <h2 id="carencia">Como funciona a carência?</h2>
        <p>
          {BPP_RULES.grace.text} Carência não significa meses de graça: dependendo da operação, os juros continuam correndo. O
          simulador usa a premissa mais prudente, somando os juros da carência ao saldo antes da primeira parcela.
          {ten24 && tenGrace
            ? ` Exemplo: R$ 10 mil em 24 parcelas a ${pct(high)}% ao mês dão ${brl(ten24.paymentCents)} sem carência e ${brl(tenGrace.paymentCents)} com três meses de carência.`
            : ""}{" "}
          Se o contrato cobrar os juros durante a carência, a parcela fica menor que a estimada. Não sabemos se a carência conta
          dentro do prazo máximo de {maxMonths} meses: pergunte no atendimento.
        </p>

        <h2 id="custos">Quais custos podem existir?</h2>
        <p>
          {BPP_RULES.process.free} A carta exige garantia (avalista ou Fundo de Aval do Estado), mas não publica o custo do fundo
          nem a lista de encargos do contrato. O simulador por isso não acrescenta custo nenhum por conta própria e só calcula
          o{" "}
          <Link href="/juros-e-cet/o-que-e-cet/">CET</Link> quando você informa todos os custos que o atendimento passar. Pergunte
          por escrito, antes de assinar:
        </p>
        <ul>
          {BPP_RULES.toConfirm.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>

        <h2 id="documentos">Quais documentos podem ser necessários?</h2>
        <p>
          A carta de serviços estadual (<SourceLinks sources={BPP_RULES.documents.sources} />) lista, para todo pedido:
        </p>
        <ul>
          {BPP_RULES.documents.everyone.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
        <p>Para empreendedor formal, também:</p>
        <ul>
          {BPP_RULES.documents.formal.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
        <p>
          A unidade do seu município pode pedir mais, e algumas prefeituras citam outras exigências, como tempo mínimo de
          atividade: confirme antes de ir. O <Link href="/emprestimos/emprestimo-para-mei/">guia do MEI</Link> ajuda a montar a
          pasta.
        </p>

        <h2 id="como-solicitar">Como solicitar o Banco do Povo?</h2>
        <ol>
          <li>Confira se o seu nome está sem restrição.</li>
          <li>Faça a qualificação empreendedora gratuita, pelo Qualifica SP ou pelo Sebrae – Banco do Povo.</li>
          <li>Separe a garantia: avalista, para quem é informal, ou o Fundo de Aval do Estado, para quem tem CNPJ.</li>
          <li>
            Procure o atendimento do município onde o negócio funciona, com os documentos. O passo a passo está em{" "}
            <Link href="/emprestimos/microcredito-produtivo-e-banco-do-povo/">Banco do Povo Paulista: como funciona</Link>.
          </li>
          <li>Peça a simulação oficial, com a taxa e os custos por escrito, e compare com a estimativa daqui.</li>
        </ol>
        <p>
          {BPP_RULES.process.timing} O pedido também pode ser feito pela{" "}
          <a href={BPP_RULES.process.digitalUrl} target="_blank" rel="noopener noreferrer">
            plataforma digital do programa
          </a>
          .
        </p>
        <p>
          Ninguém de fora do atendimento oficial pode cobrar para aprovar o seu pedido. Perfil de &ldquo;Banco do Povo&rdquo; no
          WhatsApp que pede depósito antecipado ou pagamento a intermediário aplica o{" "}
          <Link href="/credito-seguro/deposito-antecipado-e-golpe/">golpe do depósito antecipado</Link>.
        </p>

        <h2 id="na-sua-cidade">Banco do Povo na sua cidade</h2>
        <p>
          Estes guias trazem o que encontramos sobre o Banco do Povo da cidade em fonte oficial, com a data da verificação. Quando
          a prefeitura publica endereço e horário, eles estão no guia; quando não publica, o guia diz isso:
        </p>
        <ul className="columns-2 sm:columns-3">
          {withUnit.map((c) => (
            <li key={c.path}>
              <Link href={c.path}>{c.name}</Link>
            </li>
          ))}
        </ul>
        <p>Cidade fora da lista? O site da prefeitura publica o endereço e o telefone do atendimento, quando o município opera o programa.</p>

        <h2 id="perguntas-frequentes">Perguntas frequentes</h2>
        <FaqAccordion>
          <FaqItem question="Este simulador é do Banco do Povo?" id="este-simulador-e-do-banco-do-povo">
            <p>
              Não. É uma ferramenta independente do Crédito por Perto, que não representa o programa nem o Governo do Estado. A
              simulação que vale é a do atendimento.
            </p>
          </FaqItem>
          <FaqItem question="Qual o valor máximo do Banco do Povo Paulista?" id="qual-o-valor-maximo-do-banco-do-povo-paulista">
            <p>
              {brl0(BPP_RULES.amount.maxCents)}, pela carta de serviços estadual. Para quem não tem CNPJ, prefeituras citam até{" "}
              {brl0(BPP_RULES.profileCap.pessoaFisicaCents)}.
            </p>
          </FaqItem>
          <FaqItem question="Quanto fica a parcela de R$ 10 mil no Banco do Povo?" id="quanto-fica-a-parcela-de-r-10-mil-no-banco-do-povo">
            <p>
              {table.find((x) => x.a === 10_000)
                ? `Em ${maxMonths} parcelas, sem carência, a estimativa vai de ${brl(table.find((x) => x.a === 10_000)!.l.paymentCents)} a ${pct(low)}% ao mês até ${brl(table.find((x) => x.a === 10_000)!.h.paymentCents)} a ${pct(high)}% ao mês.`
                : "Depende da taxa e do prazo."}{" "}
              A taxa do seu pedido só sai na análise.
            </p>
          </FaqItem>
          <FaqItem question="Dá para pagar em 48 vezes?" id="da-para-pagar-em-48-vezes">
            <p>O prazo divulgado pelo Estado é de até {maxMonths} meses. Simulações de 48 parcelas não se aplicam ao programa.</p>
          </FaqItem>
          <FaqItem question="Negativado consegue Banco do Povo?" id="negativado-consegue-banco-do-povo">
            <p>
              Páginas oficiais de prefeituras que operam o programa exigem não ter restrição cadastral; Araçariguama cita SCPC,
              Serasa e Cadin. Com o nome negativado, o pedido esbarra nessa exigência: consulte o seu nome antes de ir.
            </p>
          </FaqItem>
          <FaqItem question="O resultado inclui todos os custos?" id="o-resultado-inclui-todos-os-custos">
            <p>
              Não, a menos que você informe os custos que o atendimento passar. Sem eles, o simulador mostra parcela, total e juros, e
              avisa que não é possível estimar o CET com precisão.
            </p>
          </FaqItem>
        </FaqAccordion>

        <h2 id="como-calculamos">Fontes e metodologia</h2>
        <ul>
          <li>
            <strong>Método:</strong> sistema Price, parcela = saldo × i ÷ [1 − (1 + i)<sup>−n</sup>], com juros compostos mensais,
            a fórmula da Calculadora do Cidadão do Banco Central para prestações fixas. Escolhido porque nenhuma fonte oficial
            consultada publica o sistema do programa.
          </li>
          <li>
            <strong>Carência:</strong> juros de cada mês de carência somados ao saldo, ao centavo; as parcelas começam depois.
          </li>
          <li>
            <strong>Arredondamento:</strong> parcela e juros de cada mês ao centavo; a última parcela acerta a diferença.
          </li>
          <li>
            <strong>CET:</strong> taxa interna do fluxo (valor recebido menos custos informados, contra as parcelas), anualizada
            por juros compostos. Só aparece quando você confirma que informou todos os custos.
          </li>
          <li>
            <strong>Privacidade:</strong> o cálculo acontece no seu navegador. Valor, taxa digitada, custos, respostas do
            diagnóstico e o nome da cidade não são enviados nem gravados. A medição de audiência, quando você aceita os cookies,
            recebe só categorias: o perfil escolhido (MEI, empresa, sem CNPJ), o cenário de taxa, os meses de carência, se houve
            custos informados e se a cidade escolhida tem atendimento verificado.
          </li>
        </ul>
        <p>
          <strong>Fontes consultadas</strong> (data da leitura entre parênteses). Fontes municipais valem para o município que as
          publicou e aparecem aqui como indício das condições do programa:
        </p>
        <ul>
          {allSources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noopener noreferrer">
                {s.organization} — {s.title}
              </a>{" "}
              ({s.checkedAt})
            </li>
          ))}
        </ul>
        <p>
          Conteúdo e ferramenta da Equipe Editorial do Crédito por Perto, que não concede crédito e não faz análise de crédito.
          Encontrou algo errado ou desatualizado? Veja a <Link href="/politica-de-correcoes/">política de correções</Link>.
          Metodologia revisada em {REVIEWED}.
        </p>
      </section>
    </div>
  );
}
