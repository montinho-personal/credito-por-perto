import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { webPageJsonLd } from "@/lib/schema/jsonld";
import { JsonLd } from "@/components/seo/JsonLd";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ToolNextSteps } from "@/components/journeys/ToolNextSteps";
import { DebtExpiryCalculator } from "@/components/calculators/DebtExpiryCalculator";
import { FaqAccordion, FaqItem } from "@/components/content/FaqAccordion";

/**
 * Calculadora "Quando a dívida sai do meu nome?".
 *
 * INTENÇÃO: "quando minha dívida caduca". O guia "Dívida caduca em 5 anos?"
 * explica o que muda; o "Como limpar o nome", os caminhos. Aqui, a data.
 *
 * FONTES (lidas em 26/10/2026): CDC art. 43, § 1º; Súmula 323 do STJ
 * (Arquivo Cidadão do STJ); notícia oficial do STJ sobre o Informativo 817
 * (REsp 2.095.414, Quarta Turma, 2024, por maioria: 5 anos do dia seguinte
 * ao vencimento); Código Civil, arts. 132, 189, 202 e 206, § 5º, I.
 */

const PATH = "/calculadoras/quando-a-divida-sai-do-nome/";
const TITLE = "Quando minha dívida caduca? Calcule a data";
const DESCRIPTION =
  "Informe o vencimento e veja a data em que a dívida sai do cadastro de inadimplentes e o prazo da cobrança na Justiça. Grátis, sem CPF e sem cadastro.";
const REVIEWED = "26/10/2026";

const CDC = "https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm";
const CC = "https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm";
const SUMULA_323 = "https://arquivocidadao.stj.jus.br/index.php/sumula-323";
const STJ_817 =
  "https://www.stj.jus.br/sites/portalp/Paginas/Comunicacao/Noticias/2024/08072024-Informativo-destaca-prazo-de-manutencao-de-dados-de-devedor-em-cadastro-de-inadimplentes.aspx";

export const metadata: Metadata = buildMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

export default function QuandoADividaSaiDoNomePage() {
  return (
    <div data-track-area="ferramenta" data-track="quando-a-divida-sai-do-nome" className="mx-auto max-w-3xl px-4 py-8">
      <JsonLd data={webPageJsonLd(TITLE, DESCRIPTION, PATH)} />
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: "Calculadoras", path: "/calculadoras/" },
          { name: "Quando a dívida sai do nome", path: PATH },
        ]}
      />

      <h1 className="mt-6 font-serif text-3xl font-bold leading-tight text-brand-navy md:text-4xl">
        Quando a dívida sai do meu nome?
      </h1>
      <p className="mt-3 text-lg leading-relaxed text-brand-muted">
        Informe a data de vencimento e veja quando se completam os 5 anos de permanência no cadastro de inadimplentes e o
        prazo de referência para a cobrança na Justiça. Grátis, sem cadastro e sem CPF.
      </p>

      <div className="mt-6">
        <DebtExpiryCalculator />
      </div>

      <ToolNextSteps toolId="quando-a-divida-sai-do-nome" />

      <section aria-labelledby="cinco-anos" className="article-body mt-12">
        <h2 id="cinco-anos">Por que 5 anos?</h2>
        <p>
          O{" "}
          <a href={CDC} target="_blank" rel="noopener noreferrer">
            Código de Defesa do Consumidor
          </a>{" "}
          proíbe que os cadastros guardem informações negativas referentes a período superior a 5 anos (art. 43, § 1º). O
          Superior Tribunal de Justiça confirmou o limite na{" "}
          <a href={SUMULA_323} target="_blank" rel="noopener noreferrer">
            Súmula 323
          </a>
          : a inscrição pode ser mantida até o prazo máximo de cinco anos, independentemente da prescrição da execução.
        </p>

        <h2 id="quando-comeca">A partir de quando os 5 anos começam a contar?</h2>
        <p>
          Do dia seguinte ao vencimento da dívida. Foi o que a Quarta Turma do STJ definiu em 2024, por maioria, no REsp
          2.095.414, segundo a{" "}
          <a href={STJ_817} target="_blank" rel="noopener noreferrer">
            notícia oficial do tribunal sobre o Informativo 817
          </a>
          . A mesma decisão diz que a data de vencimento precisa constar no banco de dados do birô. Por isso a calculadora pede
          o vencimento, e não a data em que o registro apareceu. Para descobrir o vencimento registrado, consulte o seu nome
          nos birôs: veja{" "}
          <Link href="/credito-seguro/consultar-nome-nos-biros-de-credito/">como consultar o Serasa, o SPC e a Boa Vista</Link>.
        </p>
        <p>
          A contagem segue o Código Civil: prazos em anos terminam no dia de mesmo número do início, ou no dia seguinte se essa
          data não existir, como 29 de fevereiro (art. 132, § 3º).
        </p>

        <h2 id="caducar">Sair do cadastro é o mesmo que a dívida caducar?</h2>
        <p>
          Não. São três coisas diferentes: o registro sai do cadastro, a cobrança na Justiça prescreve e a dívida continua
          existindo. A diferença entre elas, e os riscos de esperar o prazo de propósito, estão em{" "}
          <Link href="/organizacao-financeira/divida-caducada-nome-limpo/">dívida caduca em 5 anos?</Link>. Os outros caminhos
          para sair do cadastro, como pagar, negociar ou contestar um registro errado, estão em{" "}
          <Link href="/organizacao-financeira/como-limpar-o-nome/">como limpar o nome</Link>.
        </p>

        <h2 id="prescricao">E a prescrição da cobrança?</h2>
        <p>
          Para dívida líquida que conste de documento, como um contrato, a cobrança na Justiça prescreve em 5 anos (
          <a href={CC} target="_blank" rel="noopener noreferrer">
            Código Civil
          </a>
          , art. 206, § 5º, I). O prazo nasce com o vencimento, quando o direito do credor é violado (art. 189). A prescrição
          pode ser interrompida uma vez, e recomeça a contar do zero, por ato que reconheça a dívida, como um acordo, por
          protesto ou por ação na Justiça (art. 202). Por isso a calculadora mostra uma data de referência, e não uma conclusão.
        </p>

        <h2 id="perguntas-frequentes">Perguntas frequentes</h2>
        <FaqAccordion>
          <FaqItem question="Dívida caduca em quanto tempo?" id="divida-caduca-em-quanto-tempo">
            <p>
              O registro no cadastro de inadimplentes pode durar no máximo 5 anos, contados do dia seguinte ao vencimento. A
              cobrança na Justiça de dívida líquida em documento prescreve em 5 anos, em regra, contados do vencimento. A
              dívida, em si, não desaparece.
            </p>
          </FaqItem>
          <FaqItem question="Se eu fizer um acordo, o prazo recomeça?" id="se-eu-fizer-um-acordo-o-prazo-recomeca">
            <p>
              Na prescrição, sim: reconhecer a dívida interrompe o prazo, que recomeça daquela data (Código Civil, art. 202, VI).
              Um acordo novo também cria novas parcelas, com novos vencimentos. Antes de assinar, peça por escrito o que acontece
              com o registro; o que exigir está em{" "}
              <Link href="/organizacao-financeira/como-negociar-dividas/">como negociar dívidas</Link>.
            </p>
          </FaqItem>
          <FaqItem question="Passaram 5 anos e meu nome continua sujo. O que fazer?" id="passaram-5-anos-e-meu-nome-continua-sujo">
            <p>
              Confira no birô a data de vencimento registrada e se a restrição é dessa dívida ou de outra. Se o prazo já passou,
              peça a exclusão ao birô e guarde o protocolo. Registro que permanece além do limite pode ser contestado; o caminho
              está no guia de <Link href="/credito-seguro/consultar-nome-nos-biros-de-credito/">consulta aos birôs</Link>.
            </p>
          </FaqItem>
          <FaqItem question="Protesto em cartório também sai em 5 anos?" id="protesto-em-cartorio-tambem-sai-em-5-anos">
            <p>
              Não pelo mesmo caminho. O protesto é um registro no cartório e sai com o cancelamento, que depende do documento do
              credor e das custas. Veja <Link href="/organizacao-financeira/protesto-em-cartorio/">protesto em cartório</Link>.
            </p>
          </FaqItem>
          <FaqItem question="Dívida parcelada: qual vencimento eu uso?" id="divida-parcelada-qual-vencimento-eu-uso">
            <p>
              O da parcela que foi registrada no cadastro. Cada parcela tem o seu vencimento, e o birô deve guardar essa data. A
              consulta ao seu nome mostra qual é.
            </p>
          </FaqItem>
        </FaqAccordion>

        <h2 id="como-calculamos">Como calculamos</h2>
        <ul>
          <li>
            <strong>Cadastro:</strong> o dia seguinte ao vencimento mais 5 anos, pelo art. 132, § 3º, do Código Civil.
          </li>
          <li>
            <strong>Cobrança na Justiça:</strong> o vencimento mais 5 anos, como prazo de referência, sem considerar
            interrupções.
          </li>
          <li>
            <strong>Hoje:</strong> a data do seu aparelho no fuso de Brasília, usada só para dizer quanto falta ou quanto já
            passou.
          </li>
          <li>
            <strong>Fora da conta:</strong> feriados, interrupções da prescrição, protesto e dívidas com prazos próprios.
          </li>
        </ul>
        <p>
          <strong>Privacidade:</strong> a conta acontece no seu navegador. A data digitada não é enviada, gravada nem usada em
          medição de audiência.
        </p>

        <h2 id="fontes">Fontes e verificação</h2>
        <ul>
          <li>
            Presidência da República —{" "}
            <a href={CDC} target="_blank" rel="noopener noreferrer">Código de Defesa do Consumidor</a>, art. 43, § 1º.
          </li>
          <li>
            Superior Tribunal de Justiça —{" "}
            <a href={SUMULA_323} target="_blank" rel="noopener noreferrer">Súmula 323</a> e{" "}
            <a href={STJ_817} target="_blank" rel="noopener noreferrer">notícia sobre o Informativo 817 (REsp 2.095.414)</a>.
          </li>
          <li>
            Presidência da República —{" "}
            <a href={CC} target="_blank" rel="noopener noreferrer">Código Civil</a>, arts. 132, 189, 202 e 206, § 5º, I.
          </li>
        </ul>
        <p>
          Conteúdo e ferramenta da Equipe Editorial do Crédito por Perto, que não concede crédito, não negocia dívidas e não
          recebe por nenhuma contratação. Informações verificadas em {REVIEWED}. Encontrou algo errado? Veja a{" "}
          <Link href="/politica-de-correcoes/">política de correções</Link>.
        </p>
      </section>
    </div>
  );
}
