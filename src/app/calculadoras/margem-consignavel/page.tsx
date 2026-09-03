import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MarginCalculator } from "@/components/calculators/MarginCalculator";
import { MARGIN_RULES } from "@/lib/calculators/margin";
import { ToolNextSteps } from "@/components/journeys/ToolNextSteps";

export const metadata: Metadata = buildMetadata({
  title: "Calculadora de margem consignável: INSS e CLT",
  description:
    "Calcule quanto da sua margem consignável está livre: limite para empréstimo, fatias dos cartões e o disponível após as parcelas atuais — sem cadastro nem CPF.",
  path: "/calculadoras/margem-consignavel/",
});

export default function CalculadoraMargemPage() {
  return (
    <div
      data-track-area="ferramenta"
      data-track="margem-consignavel"
      className="mx-auto max-w-3xl px-4 py-8">
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
        Informe seu benefício ou salário líquido e as parcelas de consignado já
        ativas para estimar quanto da margem está comprometido e quanto resta —
        para aposentados e pensionistas do INSS e trabalhadores CLT.
      </p>

      <div className="mt-8">
        <MarginCalculator />
      </div>

      <ToolNextSteps toolId="margem-consignavel" />


      <section aria-labelledby="como-calcula" className="article-body mt-12">
        <h2 id="como-calcula">Como o cálculo é feito</h2>
        <p>
          A calculadora usa <strong>dois números</strong>: a renda ou benefício
          líquido do mês e a soma das parcelas de consignado que já são
          descontadas. O perfil escolhido define os percentuais aplicados.
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
            <strong>Limite de empréstimo</strong> = renda líquida × percentual
            de empréstimo do perfil;
          </li>
          <li>
            <strong>Disponível</strong> = limite de empréstimo − parcelas de
            consignado já ativas (nunca abaixo de zero);
          </li>
          <li>
            <strong>Reservas de cartão</strong> = renda líquida × cada
            percentual de cartão, calculadas sobre a mesma renda.
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
        <h2 id="entenda">Como interpretar o resultado</h2>
        <p>
          A margem consignável divide sua renda em fatias com destinos próprios:
          uma para <strong>empréstimos consignados</strong> e fatias menores
          reservadas aos <strong>cartões consignados</strong>. A calculadora
          mostra cada fatia e desconta as parcelas que você já paga — o que
          sobra é o teto para uma nova contratação, não uma recomendação de
          usá-lo.
        </p>
        <p>
          Para entender de onde vêm os percentuais, como consultar sua margem
          oficial no Meu INSS ou na Carteira de Trabalho Digital e o que fazer
          quando a margem aparece &ldquo;presa&rdquo;, leia o guia completo de{" "}
          <Link href="/emprestimos/margem-consignavel/">margem consignável</Link>
          . Se a fatia do cartão está ocupada por uma sigla RMC que você não
          reconhece, veja{" "}
          <Link href="/emprestimos/cartao-de-credito-consignado/">
            cartão de crédito consignado
          </Link>
          . E antes de usar a margem livre, simule o custo na{" "}
          <Link href="/calculadoras/emprestimo/">calculadora de empréstimo</Link>.
        </p>
      </section>

      <section aria-labelledby="limites" className="article-body mt-12">
        <h2 id="limites">O que esta calculadora não faz</h2>
        <p>
          O resultado é uma <strong>estimativa educativa</strong>. Ele mostra
          como a regra se aplica aos números que você digitou — não é consulta
          oficial, não é análise de crédito e{" "}
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
            INSS ou do empregador.
          </li>
        </ul>
        <p>
          Para conferir a margem oficial: aposentados e pensionistas usam o{" "}
          <strong>Extrato de Empréstimo no Meu INSS</strong>; quem tem carteira
          assinada consulta a <strong>Carteira de Trabalho Digital</strong>.
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
            e as normas do INSS;
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
          {new Date(MARGIN_RULES.verifiedAt).toLocaleDateString("pt-BR")}.
          Regras de consignado mudam com frequência: confirme a vigente antes
          de assinar qualquer contrato.
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
