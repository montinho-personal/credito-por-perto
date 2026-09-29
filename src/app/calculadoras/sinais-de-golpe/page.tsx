import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { webPageJsonLd } from "@/lib/schema/jsonld";
import { JsonLd } from "@/components/seo/JsonLd";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { FraudSignalChecker } from "@/components/calculators/FraudSignalChecker";
import { ToolNextSteps } from "@/components/journeys/ToolNextSteps";

export const metadata: Metadata = buildMetadata({
  title: "Como saber se empréstimo é golpe: verifique os sinais",
  description:
    "Pediram Pix, taxa, seguro ou depósito para liberar um empréstimo? Responda perguntas rápidas e veja o que verificar antes de pagar. Sem cadastro.",
  path: "/calculadoras/sinais-de-golpe/",
});

export default function SinaisDeGolpePage() {
  return (
    <div
      data-track-area="ferramenta"
      data-track="sinais-de-golpe"
      className="mx-auto max-w-4xl px-4 py-8">
      <JsonLd
        data={webPageJsonLd(
          "Como saber se empréstimo é golpe: verifique os sinais",
          "Pediram Pix, taxa, seguro ou depósito para liberar um empréstimo? Responda perguntas rápidas e veja o que verificar antes de pagar. Sem cadastro.",
          "/calculadoras/sinais-de-golpe/",
        )}
      />
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: "Calculadoras", path: "/calculadoras/" },
          { name: "Sinais de golpe", path: "/calculadoras/sinais-de-golpe/" },
        ]}
      />

      <header className="mt-6">
        <h1 className="font-serif text-3xl font-bold leading-tight text-brand-navy md:text-4xl">
          Essa proposta de empréstimo tem sinais de golpe?
        </h1>
        <p className="mt-3 text-lg leading-relaxed text-brand-muted">
          Pediram Pix para liberar o crédito? A oferta chegou pelo WhatsApp? Responda algumas
          perguntas e veja o que merece atenção <strong>antes de enviar dinheiro ou dados</strong>.
          Grátis, sem cadastro e sem veredito: a ferramenta mostra os sinais, e a decisão continua
          sua.
        </p>
      </header>

      <div className="mt-8">
        <FraudSignalChecker />
      </div>

      <ToolNextSteps toolId="sinais-de-golpe" />


      <section aria-labelledby="pix-liberar" className="article-body mt-12">
        <h2 id="pix-liberar">Pediram Pix ou taxa para liberar o empréstimo. É golpe?</h2>
        <p>
          É o roteiro clássico do golpe do empréstimo. O{" "}
          <a href="https://www.gov.br/pt-br/noticias/financas-impostos-e-gestao-publica/2022/04/banco-central-auxilia-cidadao-a-nao-cair-em-golpes-de-falsos-emprestimos-e-a-verificar-se-seu-nome-foi-utilizado-indevidamente-para-contratacao-de-credito-por-um-golpista" target="_blank" rel="noopener noreferrer">
            Banco Central alerta
          </a>{" "}
          que instituição financeira não pede pagamento antecipado para liberar crédito. O nome
          muda, a lógica não: taxa de liberação, de cadastro ou de desbloqueio, IOF
          &ldquo;antecipado&rdquo;, seguro, caução, taxa de cartório ou &ldquo;depósito de
          garantia&rdquo;, por Pix, boleto ou transferência. Custos legítimos entram na própria
          operação: são descontados do valor liberado ou incluídos nas parcelas e aparecem no{" "}
          <Link href="/juros-e-cet/o-que-e-cet/">CET</Link>. O roteiro completo está em{" "}
          <Link href="/credito-seguro/deposito-antecipado-e-golpe/">
            depósito antecipado para liberar empréstimo é golpe?
          </Link>
          .
        </p>

        <h2 id="whatsapp">Empréstimo pelo WhatsApp é golpe?</h2>
        <p>
          O WhatsApp, por si só, não prova fraude: instituições reais também atendem por lá. O risco
          está na combinação com outros sinais, como pagamento antecipado, promessa de aprovação
          garantida, pedido de senha ou código, pressa artificial ou um contato que não pode ser
          confirmado nos canais oficiais da instituição. O mesmo vale para SMS, ligação, e-mail,
          anúncio ou perfil em rede social: o canal sozinho não decide nada.
        </p>

        <h2 id="dois-testes">A empresa existe no Banco Central. Então a proposta é verdadeira?</h2>
        <p>
          Não necessariamente. Golpistas usam nome, logotipo, CNPJ, endereço e até contrato em PDF
          de empresas reais. Por isso a verificação tem dois testes, e a proposta só passa se passar
          nos dois:
        </p>
        <ol>
          <li>
            <strong>A empresa existe e é autorizada?</strong> Consulte o nome ou o CNPJ na{" "}
            <Link href="/calculadoras/consultar-instituicao/">consulta de instituições do Banco Central</Link>.
            CNPJ válido confirma que a empresa existe, não que ela pode emprestar dinheiro.
          </li>
          <li>
            <strong>Esse contato é mesmo dela?</strong> Procure o aplicativo, o site ou o telefone
            oficial por conta própria e pergunte se a proposta existe. Não ligue para outro número
            passado pelo mesmo atendente. Site com cadeado (HTTPS), perfil verificado e logotipo
            bonito não provam quem está do outro lado.
          </li>
        </ol>

        <h2 id="dados">Eles sabem meu CPF e meus dados. Isso prova alguma coisa?</h2>
        <p>
          Não. Nome, CPF, endereço, dados de uma dívida ou de uma compra podem ter vazado e são
          usados justamente para dar aparência de legitimidade. Dados corretos não confirmam o
          contato. Para saber se alguém contratou crédito no seu nome, consulte o{" "}
          <Link href="/credito-seguro/como-consultar-dividas-no-registrato/">Registrato do Banco Central</Link>.
        </p>

        <h2 id="codigos">Pediram senha, código ou para instalar um aplicativo?</h2>
        <p>
          Não informe nem instale. Contratar crédito não exige senha bancária, token, código recebido
          por SMS ou aplicativo de acesso remoto. Se você já informou ou instalou, a prioridade muda:
          avise seu banco pelo canal oficial e proteja suas contas. A ferramenta abre esse passo a
          passo direto na primeira pergunta. O roteiro mais comum está em{" "}
          <Link href="/credito-seguro/golpe-da-falsa-central/">golpe da falsa central do banco</Link>.
        </p>

        <h2 id="ja-paguei">Já fiz o Pix. O que faço?</h2>
        <p>
          Aja rápido, nesta ordem: fale com o seu banco pelos canais oficiais, conteste o Pix como
          golpe (o aplicativo deve ter essa opção sem precisar de atendente), registre boletim de
          ocorrência e guarde as evidências. A contestação aciona o MED, o Mecanismo Especial de
          Devolução do Pix, que permite pedir a tentativa de devolução em casos de fraude, em até 80
          dias da transação, segundo o{" "}
          <a href="https://www.bcb.gov.br/content/estabilidadefinanceira/pix/Guia_MED.pdf" target="_blank" rel="noopener noreferrer">
            guia do MED do Banco Central
          </a>
          . A devolução não é garantida, e quanto antes o pedido, maiores as chances. Pix enviado por
          engano ou desacordo comercial não entram no MED. Não envie novos valores e desconfie de quem
          oferecer recuperar o dinheiro mediante pagamento.
        </p>
        <p>
          Para reclamar da instituição (por exemplo, se o banco não registrar a contestação), use o{" "}
          <a href="https://www.gov.br/pt-br/servicos/registrar-reclamacao-contra-instituicao-supervisionada-pelo-banco-central" target="_blank" rel="noopener noreferrer">
            canal de reclamações do Banco Central
          </a>{" "}
          ou o <a href="https://www.consumidor.gov.br" target="_blank" rel="noopener noreferrer">consumidor.gov.br</a>.
          O passo a passo completo está em{" "}
          <Link href="/credito-seguro/como-identificar-golpes-de-emprestimo/">como identificar golpes de empréstimo</Link>.
        </p>

        <h2 id="mais-contextos">Outras situações comuns</h2>
        <ul>
          <li>
            <strong>Renegociação de dívida ou programa do governo:</strong> confira no site oficial,
            digitando você mesmo o endereço gov.br, se o programa e o canal existem.
          </li>
          <li>
            <strong>&ldquo;Aprovado sem consulta&rdquo; ou para negativado:</strong> instituição autorizada
            faz análise. Veja o que essa promessa esconde em{" "}
            <Link href="/credito-seguro/emprestimo-sem-consulta/">empréstimo sem consulta</Link>.
          </li>
          <li>
            <strong>Aplicativo de empréstimo:</strong> o teste antes de instalar está em{" "}
            <Link href="/credito-seguro/app-de-emprestimo-e-confiavel/">app de empréstimo é confiável?</Link>
          </li>
          <li>
            <strong>Juros muito abaixo do mercado:</strong> taxa fora da média não prova fraude, mas vale
            comparar no <Link href="/calculadoras/minha-taxa-esta-cara/">Minha taxa está cara?</Link>
          </li>
          <li>
            <strong>Dinheiro caiu na conta sem você pedir:</strong> veja{" "}
            <Link href="/credito-seguro/emprestimo-caiu-na-conta-sem-pedir/">o que fazer (e o que não fazer)</Link>.
          </li>
        </ul>

        <h2 id="metodologia-golpe">Como funciona esta verificação</h2>
        <p>
          Você responde perguntas objetivas sobre a abordagem que recebeu. Cada resposta é conferida
          contra sinais descritos em orientações oficiais e nos guias verificados deste portal. O
          resultado lista o que chamou atenção, por que chama atenção e o que fazer agora, do sinal
          mais sério para o mais leve. Dá para ver o resultado a qualquer momento, sem responder
          tudo.
        </p>
        <ul>
          <li>
            <strong>Sinal muito forte:</strong> pagamento antecipado para liberar o crédito, pedido de
            senha ou código e acesso remoto ao aparelho;
          </li>
          <li>
            <strong>Sinal importante:</strong> aprovação garantida, pressão para decidir na hora e
            recebedor diferente da instituição;
          </li>
          <li>
            <strong>Precisa verificar:</strong> instituição ou contato ainda não confirmados e uso do
            nome de órgão público;
          </li>
          <li>
            <strong>Contexto:</strong> contato não solicitado, conversa só pelo WhatsApp e condição
            muito fora do padrão. Sozinhos, não provam nada.
          </li>
        </ul>
        <p>
          Essa ordem é editorial: ela reflete a gravidade do que cada situação permite ao golpista
          (dinheiro ou acesso à conta primeiro). Não é probabilidade de fraude, não vira nota nem
          porcentagem e não usa inteligência artificial. As respostas ficam no seu navegador: nada é
          enviado, salvo ou medido.{" "}
          <strong>
            Um único sinal não prova fraude, e a ausência dos sinais deste checklist não garante
            legitimidade.
          </strong>
        </p>
        <p>
          Fontes: alerta do Banco Central sobre falsos empréstimos (gov.br), guia do MED e consulta
          pública &ldquo;Encontre uma instituição&rdquo; do Banco Central, e os guias de segurança
          do portal. Regras e textos revisados em 29/09/2026, seguindo a{" "}
          <Link href="/politica-de-correcoes/">política de correções</Link>.
        </p>
      </section>
    </div>
  );
}
