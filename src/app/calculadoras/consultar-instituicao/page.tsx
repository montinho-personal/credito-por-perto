import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { webPageJsonLd } from "@/lib/schema/jsonld";
import { JsonLd } from "@/components/seo/JsonLd";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { InstitutionChecker } from "@/components/calculators/InstitutionChecker";
import { ToolNextSteps } from "@/components/journeys/ToolNextSteps";

export const metadata: Metadata = buildMetadata({
  title: "Financeira autorizada pelo Banco Central? Consulte aqui",
  description:
    "Veja se uma financeira, banco ou cooperativa aparece como autorizada no Banco Central. Pesquise por nome ou CNPJ, grátis e sem cadastro.",
  path: "/calculadoras/consultar-instituicao/",
});

export default function ConsultarInstituicaoPage() {
  return (
    <div
      data-track-area="ferramenta"
      data-track="consultar-instituicao"
      className="mx-auto max-w-4xl px-4 py-8">
      <JsonLd
        data={webPageJsonLd(
          "Financeira autorizada pelo Banco Central? Consulte aqui",
          "Veja se uma financeira, banco ou cooperativa aparece como autorizada no Banco Central. Pesquise por nome ou CNPJ, grátis e sem cadastro.",
          "/calculadoras/consultar-instituicao/",
        )}
      />
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: "Calculadoras", path: "/calculadoras/" },
          { name: "Consultar instituição", path: "/calculadoras/consultar-instituicao/" },
        ]}
      />

      <header className="mt-6">
        <h1 className="font-serif text-3xl font-bold leading-tight text-brand-navy md:text-4xl">
          Essa instituição aparece no Banco Central?
        </h1>
        <p className="mt-3 text-lg leading-relaxed text-brand-muted">
          Pesquise pelo nome ou CNPJ e veja se a financeira, o banco ou a cooperativa aparece como
          autorizada nos dados oficiais do Banco Central, antes de continuar uma negociação. Grátis
          e sem cadastro.
        </p>
      </header>

      <div className="mt-8">
        <InstitutionChecker />
      </div>

      <ToolNextSteps toolId="consultar-instituicao" />


      <section aria-labelledby="perguntas-instituicao" className="article-body mt-12">
        <h2 id="perguntas-instituicao">Como saber se uma financeira é autorizada pelo Banco Central?</h2>
        <p>
          Consultando a relação oficial de instituições em funcionamento, que o Banco Central publica.
          Só quem é autorizado pelo BC (ou atua como correspondente de uma instituição autorizada)
          pode operar crédito no Brasil. A pergunta &ldquo;essa financeira é confiável?&rdquo; não
          tem resposta automática, mas &ldquo;essa instituição aparece nos registros oficiais?&rdquo;
          tem: é o que esta consulta responde, pelo nome ou pelo CNPJ. O passo a passo manual está no
          guia{" "}
          <Link href="/credito-seguro/como-consultar-se-instituicao-e-autorizada/">
            como consultar se uma instituição é autorizada
          </Link>
          .
        </p>

        <h2 id="o-que-significa">O que significa aparecer no Banco Central?</h2>
        <p>
          Significa que a instituição consta na <strong>relação oficial de instituições em
          funcionamento</strong> publicada pelo BC — com razão social, CNPJ e tipo (banco,
          financeira, sociedade de crédito direto, cooperativa, administradora de consórcio).
          Cada tipo tem autorizações específicas: constar na base não significa poder realizar
          toda e qualquer operação financeira. O resultado mostra o tipo exatamente como está na
          base, sem interpretação nossa.
        </p>

        <h2 id="autorizada-confiavel">Financeira autorizada é o mesmo que confiável?</h2>
        <p>
          Não. A própria{" "}
          <a href="https://www.gov.br/pt-br/servicos/consultar-instituicoes-autorizadas-pelo-banco-central" rel="noopener noreferrer" target="_blank">
            página de consulta do governo
          </a>{" "}
          avisa que o sistema mostra se a instituição é autorizada, não se é confiável. Autorização
          quer dizer que ela pode operar e responde à supervisão do Banco Central. Não diz se a taxa
          é boa, se o contrato serve para você nem se quem falou com você trabalha lá. Para a oferta,
          compare os números no{" "}
          <Link href="/calculadoras/comparador-de-propostas/">comparador de propostas</Link> e veja se a
          taxa está acima da média no <Link href="/calculadoras/minha-taxa-esta-cara/">Minha taxa está cara?</Link>.
        </p>

        <h2 id="empresa-registrada-golpe">Uma empresa registrada pode ser usada em golpe?</h2>
        <p>
          Pode. Golpistas usam nome, logotipo, CNPJ e até endereço de empresas reais para dar
          aparência de legitimidade a uma proposta falsa. Por isso a consulta responde a uma
          pergunta, não a duas: ela confirma que a <strong>instituição existe nos registros</strong>,
          mas não que o <strong>contato que falou com você</strong> pertença a ela. As duas
          verificações são necessárias, e os outros sinais da abordagem (pedido de pagamento
          antecipado, senha, pressa) estão na{" "}
          <Link href="/calculadoras/sinais-de-golpe/">verificação de sinais de golpe</Link>.
        </p>

        <h2 id="confirmar-whatsapp">Como confirmar se o WhatsApp é mesmo da instituição?</h2>
        <p>
          Invertendo a direção do contato: em vez de responder ao número que chamou você, procure
          por conta própria o canal oficial (o site digitado por você, o aplicativo baixado da loja
          oficial, o telefone impresso no cartão) e confirme a proposta por lá. Proposta
          legítima sobrevive a essa checagem; golpe desiste ou pressiona. Nunca confirme uma
          oferta pelo mesmo número que a enviou.
        </p>

        <h2 id="nao-apareceu">E se a empresa não aparecer na consulta?</h2>
        <p>
          Não conclua sozinho que é fraude. O nome pesquisado pode ser a marca do aplicativo, e não a
          razão social que está na base; pode haver erro de digitação. E nem toda empresa aparece
          aqui: correspondentes bancários, que intermedeiam o crédito de uma instituição autorizada,
          têm{" "}
          <a href="https://dadosabertos.bcb.gov.br/dataset/correspondentes" rel="noopener noreferrer" target="_blank">
            base própria no Banco Central
          </a>
          , e instituições de pagamento (muitas contas digitais e carteiras) não fazem parte desta
          consulta. Confira o CNPJ do contrato, pesquise por ele, e consulte também diretamente o
          Banco Central. O que
          não muda: <strong>enquanto houver dúvida sobre quem oferece o crédito, nenhum pagamento
          deve ser feito</strong>.
        </p>

        <h2 id="cnpj-valido">CNPJ válido é o mesmo que instituição autorizada?</h2>
        <p>
          Não. A validação do CNPJ apenas confere a estrutura matemática do número, os dígitos
          verificadores. Qualquer empresa (e qualquer golpista com o CNPJ de uma empresa real) tem
          um número estruturalmente válido. Autorização é outra verificação: o registro na base do
          Banco Central, que é o que esta consulta pesquisa.
        </p>

        <h2 id="consultar-direto">Como consultar diretamente no Banco Central?</h2>
        <p>
          Pela consulta pública{" "}
          <a href="https://www.bcb.gov.br/meubc/encontreinstituicao" rel="noopener noreferrer" target="_blank">
            Encontre uma instituição
          </a>
          , do próprio BC. Você não precisa confiar só na nossa tela: vale conferir lá também, e o
          botão &ldquo;Ver no Banco Central&rdquo; aparece em todos os resultados.
        </p>

        <h2 id="liquidacao">O que são instituições em liquidação ou intervenção?</h2>
        <p>
          São instituições sob regimes especiais (liquidação extrajudicial, intervenção ou RAET)
          decretados pelo Banco Central. A base usada nesta consulta é a de instituições{" "}
          <em>em funcionamento</em>; a situação de regimes especiais tem consulta própria no site
          do BC e ainda não está integrada aqui. É mais um motivo para usar o botão de conferência
          direta no BC antes de qualquer contratação.
        </p>

        <h2 id="metodologia-consulta">Como funciona nossa consulta?</h2>
        <p>
          1) Você informa nome ou CNPJ; 2) pesquisamos nossa cópia atualizada da relação oficial
          de instituições em funcionamento, obtida dos{" "}
          <a href="https://dadosabertos.bcb.gov.br/dataset/relacao-de-instituicoes-em-funcionamento-no-pais" rel="noopener noreferrer" target="_blank">
            dados abertos do Banco Central
          </a>{" "}
          (bancos, sociedades como financeiras, SCDs e SEPs, cooperativas de crédito e
          administradoras de consórcio; instituições de pagamento e correspondentes ficam fora),
          com atualização automática diária; 3) exibimos as
          correspondências com os campos da base, a data de obtenção e a base exata usada; 4)
          fornecemos o link para conferir diretamente no BC. O que você digita não é salvo nem
          enviado a serviços de análise, e a ordem dos resultados nunca é vendida: o Crédito por
          Perto não recebe pagamento para colocar uma instituição acima de outra. Encontrou algo
          divergente? Nossa{" "}
          <Link href="/politica-de-correcoes/">política de correções</Link> explica como tratamos
          erros. Revisado em 29/09/2026.
        </p>
      </section>
    </div>
  );
}
