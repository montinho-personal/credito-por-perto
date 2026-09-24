import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { webPageJsonLd } from "@/lib/schema/jsonld";
import { MarginCalculator } from "@/components/calculators/MarginCalculator";
import { MARGIN_RULES } from "@/lib/calculators/margin";
import { ToolNextSteps } from "@/components/journeys/ToolNextSteps";

/**
 * INTENÇÃO: CALCULAR (estimar) a margem consignável disponível de aposentado
 * ou pensionista do INSS e de trabalhador CLT (Crédito do Trabalhador), a
 * partir do benefício/remuneração e das parcelas já ativas. Não é consulta
 * oficial (Meu INSS, Carteira de Trabalho Digital), não é simulador de
 * consignado e não calcula "quanto posso pegar": margem é teto de parcela.
 * O guia /emprestimos/margem-consignavel/ é dono de "como consultar" e das
 * regras em detalhe. Servidor, BPC e militar não são atendidos pela
 * ferramenta e não entram no title. Ver data/query-ownership-map.json.
 */
const PATH = "/calculadoras/margem-consignavel/";
const TITLE = "Calculadora de margem consignável: INSS e CLT";
const DESCRIPTION =
  "Informe benefício ou salário e as parcelas de consignado que já paga e estime sua margem disponível. Para INSS e CLT, sem CPF e sem cadastro.";

export const metadata: Metadata = buildMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

export default function CalculadoraMargemPage() {
  return (
    <div
      data-track-area="ferramenta"
      data-track="margem-consignavel"
      className="mx-auto max-w-3xl px-4 py-8">
      <JsonLd data={webPageJsonLd(TITLE, DESCRIPTION, PATH)} />
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: "Calculadoras", path: "/calculadoras/" },
          { name: "Margem consignável", path: "/calculadoras/margem-consignavel/" },
        ]}
      />
      <h1 className="mt-6 font-serif text-3xl font-bold text-brand-navy md:text-4xl">
        Calculadora de margem consignável
      </h1>
      <p className="mt-3 text-lg leading-relaxed text-brand-muted">
        Informe seu benefício ou remuneração e as parcelas de consignado que já
        paga para estimar sua margem total, quanto dela está comprometido e
        quanto ainda resta disponível. Para aposentados e pensionistas do INSS e
        trabalhadores CLT do Crédito do Trabalhador, sem CPF e sem cadastro.
      </p>

      <div className="mt-8">
        <MarginCalculator />
      </div>

      <ToolNextSteps toolId="margem-consignavel" />


      <section aria-labelledby="como-calcula" className="article-body mt-12">
        <h2 id="como-calcula">Como calcular a margem consignável</h2>
        <p>
          A calculadora usa <strong>dois números</strong>: o benefício ou a
          remuneração do mês e a soma das parcelas de consignado que já são
          descontadas. O perfil escolhido define os percentuais aplicados.
        </p>
        <p>
          <strong>Qual valor digitar?</strong> O valor <strong>antes</strong> do
          desconto dos consignados. Não use o que cai na conta se você já tem
          consignado: ali as parcelas já foram tiradas, e a conta ficaria menor do
          que é. No INSS, a lei fala no valor do benefício. No Crédito do
          Trabalhador, a base é a remuneração disponível: o salário menos os
          descontos obrigatórios, como a contribuição ao INSS e o Imposto de Renda.
          Por isso a margem não é calculada sobre o salário bruto.
        </p>
        <table>
          <thead>
            <tr>
              <th>Fatia</th>
              <th>INSS</th>
              <th>CLT</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Empréstimo consignado</td>
              <td>{MARGIN_RULES.inss.loanPercent}%</td>
              <td>{MARGIN_RULES.clt.loanPercent}%</td>
            </tr>
            <tr>
              <td>Cartão de crédito consignado</td>
              <td>{MARGIN_RULES.inss.cardPercent}%</td>
              <td>{MARGIN_RULES.clt.cardPercent}%</td>
            </tr>
            <tr>
              <td>Cartão consignado de benefício</td>
              <td>{MARGIN_RULES.inss.benefitCardPercent}%</td>
              <td>não se aplica</td>
            </tr>
          </tbody>
        </table>
        <p>São três contas, nesta ordem:</p>
        <ol>
          <li>
            <strong>Margem total para empréstimo</strong> = benefício ou
            remuneração × percentual de empréstimo do perfil;
          </li>
          <li>
            <strong>Margem disponível</strong> = margem total − parcelas de
            consignado já ativas, que são a margem comprometida (nunca abaixo de
            zero);
          </li>
          <li>
            <strong>Reservas de cartão</strong> = benefício ou remuneração × cada
            percentual de cartão, calculadas sobre a mesma base.
          </li>
        </ol>
        <p>
          O ponto que mais confunde: as fatias de cartão{" "}
          <strong>não disputam espaço com a fatia de empréstimo</strong>. São
          reservas separadas, previstas na norma. Por isso o total
          comprometível aparece maior que o limite de empréstimo sozinho.
        </p>
      </section>

      <section aria-labelledby="entenda" className="article-body mt-12">
        <h2 id="entenda">Como interpretar o resultado: margem total, comprometida e disponível</h2>
        <p>
          A margem consignável divide sua renda em fatias com destinos próprios:
          uma para <strong>empréstimos consignados</strong> e fatias menores
          reservadas aos <strong>cartões consignados</strong> (RMC e RCC). A
          calculadora mostra a margem total de cada fatia, desconta as parcelas
          que você já paga e mostra quanto ainda sobra. Se as parcelas atuais já
          ocupam toda a fatia de empréstimo, a margem disponível aparece zerada.
          O que sobra é o teto para uma nova parcela, não uma recomendação de
          usá-lo: caber na margem não significa caber no orçamento.
        </p>
        <p>
          <strong>Margem de R$ 200 significa pegar R$ 200 emprestados?</strong>{" "}
          Não. A margem disponível é o valor máximo da <strong>parcela</strong>{" "}
          mensal. Quanto essa parcela representa em empréstimo depende da taxa de
          juros e do prazo da proposta: a mesma parcela de R$ 200 financia valores
          bem diferentes em 24 ou em 84 meses. Para fazer essa conta, use{" "}
          <Link href="/calculadoras/quanto-consigo-financiar/">quanto consigo financiar pela parcela</Link>
          . Pela mesma razão, 35% de margem não quer dizer pegar 35% do salário
          emprestado: é o limite do desconto de cada mês.
        </p>
        <p>
          Para entender de onde vêm os percentuais, como consultar sua margem
          oficial no Meu INSS ou na Carteira de Trabalho Digital e o que fazer
          quando a margem aparece &ldquo;presa&rdquo;, leia o guia completo de{" "}
          <Link href="/emprestimos/margem-consignavel/">margem consignável: regras e como consultar</Link>
          . Se a fatia do cartão está ocupada por uma sigla RMC que você não
          reconhece, veja{" "}
          <Link href="/emprestimos/cartao-de-credito-consignado/">
            cartão de crédito consignado (RMC)
          </Link>
          . E antes de usar a margem livre, simule parcela, juros e total na{" "}
          <Link href="/calculadoras/emprestimo/">calculadora de empréstimo</Link>.
        </p>
      </section>

      <section aria-labelledby="limites" className="article-body mt-12">
        <h2 id="limites">O que esta calculadora não faz</h2>
        <p>
          O resultado é uma <strong>estimativa educativa</strong>. Ele mostra
          como a regra se aplica aos números que você digitou. Calcular a margem
          não é consultar a margem: a ferramenta não acessa o INSS nem a Carteira
          de Trabalho Digital, não é análise de crédito e{" "}
          <strong>não representa aprovação</strong> de nada.
        </p>
        <ul>
          <li>
            <strong>A base de cálculo pode ser diferente da que você
            informou.</strong> A norma fala em renda ou remuneração
            &ldquo;disponível&rdquo;, e o que entra nessa base — adicionais,
            descontos obrigatórios, pensão alimentícia — segue a regra do órgão
            ou do empregador. Uma base diferente muda todo o resultado;
          </li>
          <li>
            <strong>A conta desconta apenas parcelas de empréstimo.</strong> Se
            parte da sua fatia de cartão consignado já está ocupada, isso não é
            abatido aqui — as reservas de cartão aparecem cheias;
          </li>
          <li>
            <strong>Os percentuais mudam por lei e por norma.</strong> Os
            valores desta página foram verificados em{" "}
            {new Date(MARGIN_RULES.verifiedAt).toLocaleDateString("pt-BR")} e
            podem ter sido alterados depois;
          </li>
          <li>
            <strong>A margem que vale é a oficial.</strong> Quem decide o
            número real é a instituição, a partir do que consta nos sistemas do
            INSS ou do empregador. Se o extrato oficial mostra margem zerada ou
            negativa, é porque os descontos já contratados ocupam ou passam do
            limite, o que pode acontecer quando o benefício ou o salário diminui
            depois da contratação. A calculadora não identifica a causa: nesses
            casos, ela mostra disponível zero.
          </li>
        </ul>
        <p>
          Onde consultar a margem oficial: aposentados e pensionistas usam o{" "}
          <strong>Extrato de Empréstimo Consignado no Meu INSS</strong>; quem tem
          carteira assinada consulta o menu de empréstimos da{" "}
          <strong>Carteira de Trabalho Digital</strong>.
          Divergência entre o que aparece lá e o que um vendedor promete é
          motivo para parar a conversa.
        </p>
      </section>

      <section aria-labelledby="fontes" className="article-body mt-12">
        <h2 id="fontes">De onde vêm os percentuais</h2>
        <ul>
          <li>
            <strong>INSS</strong> — {MARGIN_RULES.inss.loanPercent}% para
            empréstimo, {MARGIN_RULES.inss.cardPercent}% para cartão de crédito
            consignado e {MARGIN_RULES.inss.benefitCardPercent}% para cartão
            consignado de benefício, conforme a{" "}
            <a
              href="https://www.planalto.gov.br/ccivil_03/leis/2003/l10.820.htm"
              target="_blank"
              rel="noopener noreferrer"
            >
              Lei nº 10.820/2003
            </a>{" "}
            e as normas do INSS. A Medida Provisória nº 1.355/2026 reduziu esse
            limite a partir de 19/05/2026, mas perdeu a vigência em 31/08/2026 (
            <a
              href="https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/congresso/adc-89-mpv1.355.htm"
              target="_blank"
              rel="noopener noreferrer"
            >
              Ato Declaratório do Congresso Nacional nº 89/2026
            </a>
            ), e os percentuais da Lei nº 10.820/2003 voltaram a valer;
          </li>
          <li>
            <strong>CLT</strong> — {MARGIN_RULES.clt.loanPercent}% de
            comprometimento da remuneração disponível no Crédito do
            Trabalhador, conforme a Lei nº 10.820/2003 com a redação dada pela{" "}
            <a
              href="https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/lei/l15179.htm"
              target="_blank"
              rel="noopener noreferrer"
            >
              Lei nº 15.179/2025
            </a>
            .
          </li>
        </ul>
        <p>
          Percentuais verificados em{" "}
          {new Date(MARGIN_RULES.verifiedAt).toLocaleDateString("pt-BR")} e
          revistos em 24/09/2026, depois do fim da MP nº 1.355/2026. Regras de
          consignado mudam com frequência: confirme a margem oficial antes de
          assinar qualquer contrato.
        </p>
        <p>
          <strong>Privacidade:</strong> a conta roda inteiramente no seu
          navegador. Nenhum valor digitado aqui é enviado para o portal, gravado
          em qualquer servidor ou incluído nas estatísticas de uso — e a
          ferramenta não pede CPF, cadastro nem dados de contato.
        </p>
      </section>
    </div>
  );
}
