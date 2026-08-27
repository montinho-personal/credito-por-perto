import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { webPageJsonLd } from "@/lib/schema/jsonld";
import { JsonLd } from "@/components/seo/JsonLd";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { DebtSwitchComparator } from "@/components/calculators/DebtSwitchComparator";

export const metadata: Metadata = buildMetadata({
  title: "Vale a pena trocar esta dívida? Compare antes de decidir",
  description:
    "Compare sua dívida atual com a nova proposta — portabilidade, renegociação ou novo empréstimo — e veja o que muda na parcela, no prazo e no total a pagar. Sem cadastro.",
  path: "/calculadoras/trocar-divida/",
});

export default function TrocarDividaPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <JsonLd
        data={webPageJsonLd(
          "Vale a pena trocar esta dívida?",
          "Compare a dívida atual com uma nova condição e veja o que muda na parcela, no prazo e no total a pagar — sem recomendação de contratação.",
          "/calculadoras/trocar-divida/",
        )}
      />
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: "Calculadoras", path: "/calculadoras/" },
          { name: "Trocar dívida", path: "/calculadoras/trocar-divida/" },
        ]}
      />

      <header className="mt-6">
        <h1 className="font-serif text-3xl font-bold leading-tight text-brand-navy md:text-4xl">
          Vale a pena trocar esta dívida?
        </h1>
        <p className="mt-3 text-lg leading-relaxed text-brand-muted">
          Veja o que muda na parcela, no prazo e no total a pagar. Porque{" "}
          <strong>parcela menor não é a mesma coisa que dívida mais barata</strong> — e a gente
          não decide por você: coloca as duas condições lado a lado para você enxergar o que
          realmente muda.
        </p>
      </header>

      <div className="mt-8">
        <DebtSwitchComparator />
      </div>

      <section aria-labelledby="perguntas-troca" className="article-body mt-12">
        <h2 id="perguntas-troca">Quando trocar uma dívida pode reduzir o custo?</h2>
        <p>
          Quando a nova operação cobra juros efetivamente menores <em>sem</em> esticar o prazo a
          ponto de anular a economia. Trocar uma dívida cara (rotativo, cheque especial) por uma
          modalidade estruturalmente mais barata costuma ser o cenário mais favorável. Mas a única
          forma de saber é comparar a dívida inteira: o que falta pagar hoje contra o que você
          passará a pagar.
        </p>

        <h2 id="parcela-menor">Parcela menor significa dívida mais barata?</h2>
        <p>
          Não necessariamente — e esse é o erro mais comum. A parcela pode cair simplesmente
          porque o prazo aumentou. Menos por mês pode significar mais meses pagando e um total
          maior no fim. Trocar uma dívida pode aliviar o mês e ainda assim aumentar o custo total.
          Por isso a ferramenta compara três eixos ao mesmo tempo: parcela, prazo e total.
        </p>

        <h2 id="saldo-quitacao">O que é saldo para quitação?</h2>
        <p>
          É quanto custa encerrar a dívida hoje, de uma vez. A instituição é obrigada a informar
          esse valor — peça o &ldquo;saldo para quitação antecipada&rdquo; no aplicativo ou
          atendimento, ou o documento descritivo do seu contrato, que reúne saldo devedor, taxa,
          prazo e parcelas. Com o saldo em mãos, a{" "}
          <Link href="/calculadoras/quitacao-antecipada/">
            calculadora de quitação antecipada
          </Link>{" "}
          mostra a diferença entre quitar hoje e continuar pagando as parcelas.
        </p>

        <h2 id="saldo-menor">Por que o saldo para quitar pode ser menor que a soma das parcelas?</h2>
        <p>
          Porque as parcelas futuras carregam juros que ainda não aconteceram. O{" "}
          <a href="https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm" rel="noopener noreferrer" target="_blank">
            art. 52, §2º, do Código de Defesa do Consumidor
          </a>{" "}
          garante a liquidação antecipada com <strong>redução proporcional dos juros</strong>, e a{" "}
          <a href="https://www.bcb.gov.br/pre/normativos/res/2007/pdf/res_3516_v2_l.pdf" rel="noopener noreferrer" target="_blank">
            Resolução CMN nº 3.516/2007
          </a>{" "}
          proíbe tarifa de quitação nos contratos a partir de dezembro de 2007. Por isso, nunca
          use &ldquo;parcela × parcelas restantes&rdquo; como se fosse o valor de quitar hoje: são
          números diferentes, e a ferramenta mostra os dois separados. O detalhe completo está em{" "}
          <Link href="/juros-e-cet/quitacao-antecipada-de-emprestimo/">quitação antecipada</Link>.
        </p>

        <h2 id="o-que-e-portabilidade">O que é portabilidade de crédito?</h2>
        <p>
          É a transferência de uma operação de crédito para outra instituição, mantendo a dívida —
          o que muda são as condições. É um direito{" "}
          <a href="https://www.bcb.gov.br" rel="noopener noreferrer" target="_blank">
            regulamentado pelo Banco Central
          </a>
          : a instituição original não pode impedir, a proponente deve apresentar taxa, CET, prazo
          e valor das prestações, e — nas regras vigentes — o valor e o prazo da nova operação não
          podem superar o saldo devedor e o prazo remanescente. O guia completo está em{" "}
          <Link href="/emprestimos/portabilidade-de-credito/">portabilidade de crédito</Link>.
        </p>

        <h2 id="portabilidade-ou-novo">Portabilidade e empréstimo para quitar dívida são a mesma coisa?</h2>
        <p>
          Não. Na portabilidade formal, as instituições trocam informações e a nova quita a
          antiga diretamente, sem dinheiro passando pela sua conta — e sem crédito extra. Num
          empréstimo novo, você contrata uma operação independente (que pode incluir troco) e usa
          o dinheiro para quitar a anterior. Renegociação e reparcelamento, por sua vez, alteram o
          contrato com a mesma instituição. As regras e as consequências são diferentes — por isso
          a ferramenta pergunta qual é o seu caso.
        </p>

        <h2 id="o-que-comparar">O que comparar antes de trocar uma dívida?</h2>
        <p>
          No mínimo: saldo para quitação, nova parcela, novo prazo, CET das duas operações, custos
          fora das parcelas, existência de troco e de garantia nova. E uma regra de ouro: não
          compare a parcela antiga com a nova — compare a dívida inteira.
        </p>

        <h2 id="cet-ou-taxa">CET ou taxa de juros: qual olhar?</h2>
        <p>
          O CET, sempre que disponível: ele inclui tarifas, seguros e demais custos, e é o único
          número comparável entre propostas. Mas nem o CET decide sozinho — um CET menor com prazo
          muito maior ainda pode custar mais no total. Entenda em{" "}
          <Link href="/juros-e-cet/o-que-e-cet/">o que é CET</Link>.
        </p>

        <h2 id="alongar-prazo">Vale alongar o prazo para reduzir a parcela?</h2>
        <p>
          Depende do que você precisa. Se o orçamento do mês não fecha, alongar pode ser a
          diferença entre pagar e atrasar — um alívio com preço conhecido. O problema é alongar
          <em> sem perceber</em> que o total aumentou. A ferramenta existe para esse número não
          passar despercebido: se a troca custa mais caro no total, você decide sabendo. E para
          ver o que a nova parcela faz com o seu mês, use{" "}
          <Link href="/calculadoras/parcela-no-orcamento/">
            quanto de parcela cabe no meu orçamento?
          </Link>

        </p>

        <h2 id="pagamento-antecipado">O que fazer se pedirem pagamento antecipado?</h2>
        <p>
          Pare antes de pagar. Cobrança para &ldquo;liberar&rdquo; um crédito não é custo normal —
          é o sinal mais comum de golpe, mesmo quando vem com contrato bonito. Rode a{" "}
          <Link href="/calculadoras/sinais-de-golpe/">verificação de sinais de golpe</Link> e leia{" "}
          <Link href="/credito-seguro/deposito-antecipado-e-golpe/">
            por que depósito antecipado é golpe
          </Link>
          .
        </p>

        <h2 id="metodologia-troca">Como fazemos a comparação?</h2>
        <p>
          Com aritmética transparente e sem projeções escondidas: parcela atual × parcelas
          restantes = soma nominal dos pagamentos futuros informados (rotulada assim mesmo — não a
          chamamos de &ldquo;juros&rdquo;); nova parcela × novo prazo + custos informados = total
          da nova condição; as diferenças aparecem em reais e em meses. O saldo para quitação é
          mostrado separado da soma das parcelas, porque são coisas diferentes. Taxas são
          convertidas por juros compostos — anual = (1 + mensal)^12 − 1, nunca ×12 — e diferenças
          de taxa e CET aparecem em pontos percentuais. Quando a modalidade tem parcela variável
          (cartão, cheque especial), a ferramenta <strong>não</strong> inventa um total futuro:
          diz que não é possível estimar com os dados disponíveis. Se os valores financiados
          diferem (troco), os totais não são comparados como equivalentes. Tudo roda no seu
          navegador — nenhum valor é enviado ou salvo. Fontes regulatórias: Banco Central
          (portabilidade de crédito), CDC art. 52, §2º e Resolução CMN nº 3.516/2007 (liquidação
          antecipada). Encontrou algo errado? Veja a{" "}
          <Link href="/politica-de-correcoes/">política de correções</Link>. Metodologia revisada
          em 27/08/2026.
        </p>
      </section>
    </div>
  );
}
