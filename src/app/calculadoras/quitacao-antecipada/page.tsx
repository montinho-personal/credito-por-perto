import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { webPageJsonLd } from "@/lib/schema/jsonld";
import { JsonLd } from "@/components/seo/JsonLd";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { EarlyPayoffCalculator } from "@/components/calculators/EarlyPayoffCalculator";
import { ToolNextSteps } from "@/components/journeys/ToolNextSteps";

export const metadata: Metadata = buildMetadata({
  title: "Calculadora de Quitação Antecipada — compare saldo e parcelas",
  description:
    "Compare o saldo para quitação com a soma das parcelas que ainda faltam e veja a diferença em reais. Sem cadastro, sem CPF — nada sai do seu dispositivo.",
  path: "/calculadoras/quitacao-antecipada/",
});

export default function QuitacaoAntecipadaPage() {
  return (
    <div
      data-track-area="ferramenta"
      data-track="quitacao-antecipada"
      className="mx-auto max-w-5xl px-4 py-8">
      <JsonLd
        data={webPageJsonLd(
          "Calculadora de Quitação Antecipada",
          "Compare o saldo para quitação informado pela instituição com a soma das parcelas restantes e veja a diferença — sem recomendação de decisão.",
          "/calculadoras/quitacao-antecipada/",
        )}
      />
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: "Calculadoras", path: "/calculadoras/" },
          { name: "Quitação antecipada", path: "/calculadoras/quitacao-antecipada/" },
        ]}
      />

      <header className="mt-6">
        <h1 className="font-serif text-3xl font-bold leading-tight text-brand-navy md:text-4xl">
          Calculadora de quitação antecipada
        </h1>
        <p className="mt-3 text-lg leading-relaxed text-brand-muted">
          Compare as parcelas que faltam com o valor para quitar hoje — ou simule o efeito de antecipar uma parte.{" "}
          <strong>
            Somar as parcelas mostra o que ainda sairia do seu bolso; o saldo de quitação mostra
            quanto custa encerrar a dívida hoje
          </strong>{" "}
          — são números diferentes, e a diferença entre eles é o que esta calculadora coloca na
          sua frente. Quitar antes não é pagar todas as parcelas de uma vez.
        </p>
      </header>

      <div className="mt-8">
        <EarlyPayoffCalculator />
      </div>

      <ToolNextSteps toolId="quitacao-antecipada" />


      <section aria-labelledby="perguntas-quitacao" className="article-body mt-12">
        <h2 id="perguntas-quitacao">O que é quitação antecipada?</h2>
        <p>
          É encerrar a dívida antes do fim do prazo, pagando de uma vez o{" "}
          <strong>saldo devedor atualizado para quitação</strong> — não a soma das parcelas que
          faltam. É um direito do consumidor: o{" "}
          <a href="https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm" rel="noopener noreferrer" target="_blank">
            art. 52, §2º, do Código de Defesa do Consumidor
          </a>{" "}
          assegura a liquidação antecipada, total ou parcial, com{" "}
          <strong>redução proporcional dos juros e demais acréscimos</strong>.
        </p>

        <h2 id="reduz-juros">Quitar antes reduz os juros?</h2>
        <p>
          Reduz os juros <em>que ainda não aconteceram</em>: as parcelas futuras embutem juros do
          tempo que falta, e quem quita hoje deixa de percorrer esse tempo. Por isso o saldo de
          quitação tende a ser menor que a soma das parcelas restantes. Mas a diferença entre os
          dois números não é toda composta de juros — pode haver outros acréscimos e condições no
          contrato — e não é um desconto promocional: é a matemática da antecipação prevista em
          lei.
        </p>

        <h2 id="como-saber-saldo">Como saber o saldo para quitação da minha dívida?</h2>
        <p>
          Peça à instituição — só ela pode calcular o valor oficial. No aplicativo ou internet
          banking, procure &ldquo;antecipar parcelas&rdquo; ou &ldquo;quitar contrato&rdquo;; pelo
          atendimento, peça o <strong>saldo devedor atualizado para quitação antecipada</strong>,
          por escrito e com a data de validade do valor (o saldo muda com o tempo). O roteiro
          completo do pedido, com o que conferir na resposta, está em{" "}
          <Link href="/juros-e-cet/quitacao-antecipada-de-emprestimo/">
            quitação antecipada de empréstimo
          </Link>
          .
        </p>

        <h2 id="por-que-menor">Por que o saldo de quitação é menor que a soma das parcelas?</h2>
        <p>
          Porque cada parcela futura carrega uma fatia de juros proporcional ao tempo até o seu
          vencimento — e quitar hoje elimina esse tempo. Na prática, a instituição traz as
          parcelas futuras a valor presente. A{" "}
          <a href="https://www.bcb.gov.br/pre/normativos/res/2007/pdf/res_3516_v2_l.pdf" rel="noopener noreferrer" target="_blank">
            Resolução CMN nº 3.516/2007
          </a>{" "}
          <strong>proíbe tarifa pela quitação antecipada</strong> em contratos firmados a partir
          de 10/12/2007, e essa vedação segue vigente. Os artigos daquela resolução que traziam a
          fórmula do valor presente, porém, foram revogados em 02/05/2022 pela Resolução CMN nº
          5.004/2022 — não existe hoje uma fórmula única imposta por norma, e o cálculo segue as
          condições do contrato. Por isso o número oficial é o da instituição. Se o saldo vier{" "}
          <em>igual</em> à soma das parcelas, a redução proporcional pode não ter sido aplicada —
          vale pedir o demonstrativo e contestar.
        </p>

        <h2 id="banco-obrigado">A instituição é obrigada a informar o saldo?</h2>
        <p>
          Sim. O fornecimento das informações da dívida é obrigação da instituição, e a
          liquidação antecipada com redução proporcional dos juros é direito garantido pelo CDC.
          Se houver recusa ou demora injustificada, registre reclamação nos canais oficiais da
          instituição e, se não resolver, nos canais do Banco Central e do consumidor — o
          caminho está descrito no{" "}
          <Link href="/juros-e-cet/quitacao-antecipada-de-emprestimo/">guia de quitação</Link>.
        </p>

        <h2 id="quitar-parte">Posso quitar só uma parte da dívida?</h2>
        <p>
          Pode — a liquidação antecipada <em>parcial</em> também é prevista, com a mesma redução
          proporcional. Nesse caso você normalmente escolhe entre <strong>reduzir o prazo</strong>{" "}
          (mantém a parcela e termina antes) ou <strong>reduzir a parcela</strong> (mantém o prazo
          e paga menos por mês), e a escolha muda o resultado. Esta calculadora compara apenas a
          quitação total; para amortização parcial, peça a simulação à instituição.
        </p>

        <h2 id="antecipar-financiamento">E antecipar parcelas de financiamento (veículo, imóvel)?</h2>
        <p>
          O direito é o mesmo, mas a conta depende do sistema de amortização do contrato (Price,
          SAC) e, no financiamento imobiliário, pode envolver atualização do saldo e seguros — o
          demonstrativo da instituição é indispensável. Use o saldo oficial de quitação que ela
          informar; não estime por fora.
        </p>

        <h2 id="quitacao-ou-portabilidade">Quitação antecipada e portabilidade são a mesma coisa?</h2>
        <p>
          Não. Na quitação, você encerra a dívida com dinheiro seu. Na portabilidade, a dívida
          continua existindo, mas é transferida para outra instituição com novas condições — sem
          dinheiro passando pela sua conta. Se a sua dúvida é trocar de credor em vez de
          encerrar, veja{" "}
          <Link href="/emprestimos/portabilidade-de-credito/">portabilidade de crédito</Link>.
        </p>

        <h2 id="outro-emprestimo">Vale pegar outro empréstimo para quitar esta dívida?</h2>
        <p>
          Essa é outra conta — e tem armadilhas próprias: a nova operação tem juros, prazo e
          custos que precisam ser comparados com a dívida inteira, não só com a parcela. Antes de
          contratar, coloque as duas condições lado a lado em{" "}
          <Link href="/calculadoras/trocar-divida/">vale a pena trocar esta dívida?</Link>
        </p>

        <h2 id="consorcio">Esta calculadora serve para consórcio?</h2>
        <p>
          Não. Consórcio não é empréstimo: não há juros a antecipar, e as regras de saída,
          contemplação e devolução de valores são próprias do sistema de consórcios. Entenda as
          diferenças em{" "}
          <Link href="/emprestimos/consorcio-ou-emprestimo/">consórcio ou empréstimo</Link>.
        </p>

        <h2 id="metodologia-quitacao">Como fazemos a conta?</h2>
        <p>
          Com aritmética transparente, sem projeções escondidas: TOTAL FUTURO = parcela ×
          parcelas restantes (só quando as parcelas são fixas; se variam, usamos a soma que você
          informar — nunca uma multiplicação simplista) e DIFERENÇA = total futuro − saldo para
          quitação. A diferença aparece em reais e em percentual sobre a soma informada. A
          calculadora <strong>não calcula o saldo de quitação</strong> — esse valor é da
          instituição, calculado pela taxa do contrato — e não o estima quando você não o tem:
          sem o saldo oficial, qualquer número seria falsa precisão. Também não chamamos a
          diferença de &ldquo;juros economizados&rdquo; nem de &ldquo;desconto&rdquo;, e a
          ferramenta não recomenda quitar nem usar reserva — ela mostra os números para você
          decidir. Tudo roda no seu navegador: nenhum valor é enviado ou salvo. Fontes: CDC, art.
          52, §2º (liquidação antecipada com redução proporcional) e Resolução CMN nº 3.516/2007
          (cálculo pela taxa do contrato; vedação de tarifa). Encontrou algo errado? Veja a{" "}
          <Link href="/politica-de-correcoes/">política de correções</Link>. Metodologia revisada
          em 28/08/2026.
        </p>
        <p>
          Na <strong>amortização parcial</strong>, a comparação de simulações oficiais usa apenas
          aritmética verificável: total = parcela × prazo, em cada opção informada. A simulação
          com os seus dados roda o cronograma mês a mês — Price com parcela constante, SAC com
          amortização constante — e só é feita quando o sistema é declarado. Uma observação
          importante sobre normas: os artigos da Resolução CMN nº 3.516/2007 que traziam a fórmula
          de cálculo do valor presente foram <strong>revogados em 02/05/2022</strong> pela
          Resolução CMN nº 5.004/2022. Não existe hoje uma fórmula normativa única a reproduzir, e
          por isso não apresentamos nenhum cálculo como sendo &ldquo;a fórmula do Banco
          Central&rdquo;.
        </p>
      </section>
    </div>
  );
}
