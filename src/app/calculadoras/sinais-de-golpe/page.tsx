import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { webPageJsonLd } from "@/lib/schema/jsonld";
import { JsonLd } from "@/components/seo/JsonLd";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { FraudSignalChecker } from "@/components/calculators/FraudSignalChecker";

export const metadata: Metadata = buildMetadata({
  title: "Golpe de empréstimo: verifique os sinais antes de pagar",
  description:
    "Recebeu uma oferta de empréstimo? Responda perguntas rápidas e veja sinais de alerta antes de enviar dinheiro ou dados. Gratuito, sem cadastro e sem coleta de respostas.",
  path: "/calculadoras/sinais-de-golpe/",
});

export default function SinaisDeGolpePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <JsonLd
        data={webPageJsonLd(
          "Essa proposta tem sinais de golpe?",
          "Responda algumas perguntas e veja quais pontos merecem atenção antes de enviar dinheiro ou dados.",
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
          perguntas e veja quais pontos merecem atenção <strong>antes de enviar dinheiro ou
          dados</strong>. Grátis, sem cadastro — e sem veredito: a ferramenta mostra os sinais, a
          decisão continua sua.
        </p>
      </header>

      <div className="mt-8">
        <FraudSignalChecker />
      </div>

      <section aria-labelledby="perguntas-golpe" className="article-body mt-12">
        <h2 id="perguntas-golpe">Como funciona a verificação?</h2>
        <p>
          Você responde perguntas objetivas sobre a abordagem que recebeu. Cada resposta é conferida
          contra sinais descritos em orientações oficiais e nos guias verificados deste portal — do
          pedido de pagamento antecipado ao código por SMS. O resultado lista o que chamou atenção,
          por que chamou e o que verificar, ordenado do sinal mais sério para o mais leve. O detector
          não calcula probabilidade de fraude e não usa inteligência artificial: é uma checagem
          determinística, explicável e revisável.
        </p>

        <h2 id="pix-liberar">Pedir Pix para liberar empréstimo é normal?</h2>
        <p>
          Não. Instituições autorizadas descontam custos do valor liberado ou os incluem nas
          parcelas. Pedido de depósito, &ldquo;taxa de liberação&rdquo;, &ldquo;seguro&rdquo; ou
          &ldquo;imposto&rdquo; antes de o dinheiro cair é o golpe mais comum do crédito brasileiro —
          o roteiro completo está em{" "}
          <Link href="/credito-seguro/deposito-antecipado-e-golpe/">
            depósito antecipado é golpe
          </Link>
          .
        </p>

        <h2 id="verificar-bc">Como verificar uma instituição no Banco Central?</h2>
        <p>
          Pela consulta pública e gratuita{" "}
          <a
            href="https://www.bcb.gov.br/meubc/encontreinstituicao"
            target="_blank"
            rel="noopener noreferrer"
          >
            Encontre uma instituição
          </a>
          , que lista quem pode operar crédito no país. O{" "}
          <Link href="/credito-seguro/como-consultar-se-instituicao-e-autorizada/">
            passo a passo com imagens está aqui
          </Link>
          .
        </p>

        <h2 id="empresa-real">Uma instituição verdadeira pode ser usada em um golpe?</h2>
        <p>
          Pode — e é um dos truques mais eficazes. Golpistas usam nome, logotipo e CNPJ de empresas
          reais. Encontrar a instituição no Banco Central confirma que <em>ela</em> existe; não
          confirma que o WhatsApp, o site ou a pessoa que falou com você pertença a ela. Por isso a
          regra de ouro: confirme a oferta pelos canais oficiais que <strong>você</strong> encontrou,
          nunca pelo número que enviou a proposta.
        </p>

        <h2 id="whatsapp">Golpe de empréstimo por WhatsApp: quais sinais observar?</h2>
        <p>
          O WhatsApp em si não é o problema — instituições reais também atendem por lá. O padrão
          perigoso é a combinação: conversa que só existe no aplicativo, aprovação garantida sem
          análise, pressa artificial e, no fim, um pedido de pagamento ou de código. A verificação
          acima pesa cada um desses pontos separadamente.
        </p>

        <h2 id="ja-paguei">O que fazer se já fiz um Pix?</h2>
        <p>
          Agir rápido, na ordem: contatar o seu banco pelos canais oficiais, relatar o golpe, pedir o
          procedimento de contestação (incluindo o MED — Mecanismo Especial de Devolução — quando
          cabível), registrar boletim de ocorrência e guardar todas as evidências. O MED permite a
          tentativa de devolução conforme análise das instituições; a devolução não é garantida, e
          quanto antes o pedido, maiores as chances. A ferramenta acima abre esse passo a passo
          direto na primeira pergunta.
        </p>

        <h2 id="comprovantes">O que fazer com mensagens e comprovantes?</h2>
        <p>
          Guardar tudo: prints das conversas, números de telefone, links, comprovantes de pagamento e
          nomes usados. São a base do boletim de ocorrência, da contestação no banco e da reclamação
          no <a href="https://www.consumidor.gov.br" target="_blank" rel="noopener noreferrer">consumidor.gov.br</a>.
        </p>

        <h2 id="metodologia-golpe">Como classificamos os sinais?</h2>
        <p>
          O detector não calcula uma probabilidade matemática de fraude. Ele identifica
          comportamentos e situações descritas em orientações oficiais como pontos que merecem
          atenção, e os ordena por relevância editorial: pedidos de pagamento antecipado, senha ou
          acesso remoto pesam muito mais do que a oferta ter chegado pelo WhatsApp. Cada sinal do
          resultado mostra sua base e a data da última revisão.{" "}
          <strong>Um único sinal não prova fraude. E a ausência de sinais não prova
          legitimidade.</strong>{" "}
          Metodologia revisada em 27/08/2026; as regras são reatualizadas junto com os guias de
          segurança do portal, seguindo a{" "}
          <Link href="/politica-de-correcoes/">política de correções</Link>.
        </p>
      </section>
    </div>
  );
}
