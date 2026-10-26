import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { webPageJsonLd } from "@/lib/schema/jsonld";
import { JsonLd } from "@/components/seo/JsonLd";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ToolNextSteps } from "@/components/journeys/ToolNextSteps";
import { FgtsHomeChecker } from "@/components/calculators/FgtsHomeChecker";
import { FaqAccordion, FaqItem } from "@/components/content/FaqAccordion";
import { FGTS_HOME_SOURCES } from "@/lib/calculators/fgts-home";

/**
 * Verificador "Posso usar meu FGTS na casa própria?".
 *
 * INTENÇÃO: "posso usar o fgts para comprar imóvel". O guia "Usar o FGTS
 * para comprar imóvel" explica as regras; aqui a pessoa confere o próprio
 * caso. O simulador de amortização faz a conta do efeito no contrato.
 *
 * Nunca diz "aprovado": mostra o que atende, o que não atende e o que falta
 * confirmar, e lembra que quem verifica o enquadramento é o agente financeiro.
 */

const PATH = "/calculadoras/fgts-casa-propria/";
const TITLE = "Posso usar meu FGTS para comprar imóvel? Verifique";
const DESCRIPTION =
  "Confira se você atende às regras para usar o FGTS na compra, na amortização ou em até 80% da prestação. Grátis, sem CPF e sem cadastro.";
const REVIEWED = "26/10/2026";

export const metadata: Metadata = buildMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

export default function FgtsCasaPropriaPage() {
  return (
    <div data-track-area="ferramenta" data-track="fgts-casa-propria" className="mx-auto max-w-3xl px-4 py-8">
      <JsonLd data={webPageJsonLd(TITLE, DESCRIPTION, PATH)} />
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: "Calculadoras", path: "/calculadoras/" },
          { name: "FGTS na casa própria", path: PATH },
        ]}
      />

      <h1 className="mt-6 font-serif text-3xl font-bold leading-tight text-brand-navy md:text-4xl">
        Posso usar meu FGTS na casa própria?
      </h1>
      <p className="mt-3 text-lg leading-relaxed text-brand-muted">
        Responda algumas perguntas e veja, para cada forma de uso, quais condições você atende, quais não atende e o que falta
        confirmar. Grátis, sem cadastro e sem CPF.
      </p>

      <div className="mt-6">
        <FgtsHomeChecker />
      </div>

      <ToolNextSteps toolId="fgts-casa-propria" />

      <section aria-labelledby="formas" className="article-body mt-12">
        <h2 id="formas">As formas de usar o FGTS na casa própria</h2>
        <p>
          Segundo a{" "}
          <a href={FGTS_HOME_SOURCES.caixa.url} target="_blank" rel="noopener noreferrer">
            página de uso do FGTS na casa própria da Caixa
          </a>
          , o saldo pode entrar na compra ou construção, como entrada ou parte do pagamento, inclusive à vista; amortizar ou
          quitar o saldo devedor; e pagar até 80% do valor das prestações por 12 meses seguidos. Os depósitos futuros também
          podem pagar parte da prestação, com adesão na contratação. As regras de cada forma estão explicadas em{" "}
          <Link href="/emprestimos/usar-fgts-para-comprar-imovel/">como usar o FGTS para comprar imóvel</Link>.
        </p>

        <h2 id="regras">As condições que o verificador confere</h2>
        <ul>
          <li>
            <strong>Para comprar:</strong> 3 anos de trabalho sob o FGTS, somando todos os períodos; nenhum financiamento ativo
            no SFH; nenhum imóvel residencial urbano onde você mora ou trabalha, nos municípios vizinhos ou na mesma região
            metropolitana; imóvel residencial urbano, para a sua moradia, com avaliação de até R$ 2.250.000; e imóvel que não
            tenha sido comprado com FGTS há menos de 3 anos.
          </li>
          <li>
            <strong>Para amortizar ou quitar:</strong> contrato do SFH, ou do SFI assinado a partir de 12/06/2021 dentro do
            limite do SFH, e intervalo mínimo de 2 anos entre cada uso (
            <a href={FGTS_HOME_SOURCES.lei.url} target="_blank" rel="noopener noreferrer">
              Lei nº 8.036/1990
            </a>
            , art. 20, VI).
          </li>
          <li>
            <strong>Para pagar parte das prestações:</strong> o mesmo tipo de contrato e 3 anos de trabalho sob o FGTS; o
            abatimento vai até 80% da prestação, por no mínimo 12 meses (art. 20, V).
          </li>
        </ul>
        <p>
          Reforma, terreno sem construção, material de construção, imóvel comercial ou rural e imóvel para outra pessoa estão
          entre os usos que a Caixa lista como não permitidos.
        </p>

        <h2 id="depois">Atende? O que fazer em seguida</h2>
        <p>
          O pedido é feito ao agente financeiro. Na Caixa, quem já tem contrato habitacional pode pedir pelo App Habitação
          CAIXA ou pelo telefone 0800 104 0104; quem ainda não usou o FGTS no contrato entrega a documentação numa agência ou
          num correspondente CAIXA Aqui. Quanto um aporte reduz no prazo ou na parcela, o{" "}
          <Link href="/simuladores/amortizacao-financiamento/">simulador de amortização</Link> calcula; para um contrato novo,
          use o <Link href="/calculadoras/financiamento-imobiliario/">simulador de financiamento imobiliário</Link>. Quem está
          no Minha Casa, Minha Vida encontra as regras do programa no{" "}
          <Link href="/emprestimos/minha-casa-minha-vida/">guia do programa</Link>.
        </p>

        <h2 id="perguntas-frequentes">Perguntas frequentes</h2>
        <FaqAccordion>
          <FaqItem question="Quando não posso usar o FGTS para comprar imóvel?" id="quando-nao-posso-usar-o-fgts-para-comprar-imovel">
            <p>
              Com menos de 3 anos de trabalho sob o FGTS, com financiamento ativo no SFH ou com imóvel residencial na região onde
              mora ou trabalha. Também não pode para reforma, terreno vazio, material de construção, imóvel comercial ou rural, ou
              imóvel para outra pessoa.
            </p>
          </FaqItem>
          <FaqItem question="O verificador diz que eu atendo. Está aprovado?" id="o-verificador-diz-que-eu-atendo-esta-aprovado">
            <p>
              Não. Ele confere as condições publicadas pela Caixa e pela lei. O enquadramento é verificado pelo agente financeiro
              a cada uso do FGTS, pelo Manual de Moradia Própria, com documentos, e pode envolver condições que a lista não cobre.
            </p>
          </FaqItem>
          <FaqItem question="Posso usar o FGTS todo ano para amortizar?" id="posso-usar-o-fgts-todo-ano-para-amortizar">
            <p>
              Não. A Lei nº 8.036/1990 exige intervalo mínimo de 2 anos entre cada uso do FGTS para amortizar ou quitar o saldo
              devedor (art. 20, VI).
            </p>
          </FaqItem>
          <FaqItem question="Quanto o FGTS paga da prestação?" id="quanto-o-fgts-paga-da-prestacao">
            <p>
              Até 80% do valor da prestação, por 12 meses seguidos. Numa prestação de R$ 2.000, o abatimento chega a R$ 1.600 por
              mês, ou R$ 19.200 em 12 meses, se o saldo for suficiente. O verificador faz essa conta com o seu valor.
            </p>
          </FaqItem>
          <FaqItem question="Tenho imóvel em outra cidade. Posso usar o FGTS?" id="tenho-imovel-em-outra-cidade-posso-usar-o-fgts">
            <p>
              A regra listada pela Caixa olha para a região onde você mora ou trabalha, incluindo vizinhos e região
              metropolitana. Imóvel fora dessa região não aparece entre os impedimentos. As condições sobre a localização do
              imóvel comprado estão no Manual de Moradia Própria; confirme com o agente financeiro antes de fechar negócio.
            </p>
          </FaqItem>
        </FaqAccordion>

        <h2 id="como-verificamos">Como verificamos</h2>
        <ul>
          <li>Cada resposta é comparada com a condição publicada pela Caixa ou pela Lei nº 8.036/1990.</li>
          <li>&ldquo;Não sei&rdquo; vira &ldquo;falta confirmar&rdquo;, nunca &ldquo;não atende&rdquo;.</li>
          <li>Uma condição não atendida já define o resumo; o resultado mostra qual é e por quê.</li>
          <li>Na prestação: até 80% do valor informado, por 12 meses, e quantos meses o saldo informado cobre.</li>
        </ul>
        <p>
          <strong>Privacidade:</strong> a verificação acontece no seu navegador. Respostas e valores não são enviados, gravados
          nem usados em medição de audiência.
        </p>

        <h2 id="fontes">Fontes e verificação</h2>
        <ul>
          <li>
            Caixa Econômica Federal —{" "}
            <a href={FGTS_HOME_SOURCES.caixa.url} target="_blank" rel="noopener noreferrer">
              Utilização do FGTS na Casa Própria
            </a>
            . Lida em {FGTS_HOME_SOURCES.verifiedAt}.
          </li>
          <li>
            Presidência da República —{" "}
            <a href={FGTS_HOME_SOURCES.lei.url} target="_blank" rel="noopener noreferrer">
              Lei nº 8.036/1990
            </a>
            , art. 20, V a VII.
          </li>
        </ul>
        <p>
          Conteúdo e ferramenta da Equipe Editorial do Crédito por Perto, que não concede crédito e não recebe por nenhuma
          contratação. Revisado em {REVIEWED}. Encontrou algo errado? Veja a{" "}
          <Link href="/politica-de-correcoes/">política de correções</Link>.
        </p>
      </section>
    </div>
  );
}
