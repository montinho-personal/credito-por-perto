import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { CategoryHub } from "@/components/content/CategoryHub";
import { FaqAccordion, FaqItem } from "@/components/content/FaqAccordion";

/**
 * Hub de crédito seguro, dono de "golpes de empréstimo mais comuns" (SERP de
 * 08/10/2026). O guia /credito-seguro/como-identificar-golpes-de-emprestimo/
 * continua dono de "golpe de empréstimo / como identificar": aqui é o índice
 * — cada golpe em uma linha, apontando para o guia que o explica.
 *
 * Fatos legais usados, todos já com fonte oficial nos registros dos guias:
 * MED do Pix (BC), alerta de pagamento antecipado (BC), CDC art. 49 e a
 * Súmula 479 do STJ (Arquivo Cidadão do STJ, lida em 08/10/2026).
 */
export const metadata: Metadata = buildMetadata({
  title: "Golpes de empréstimo mais comuns e como se proteger",
  description:
    "Taxa antecipada, falsa central, falso consignado e empréstimo que cai sem pedir: como cada golpe chega, o sinal que o entrega e o que fazer se você caiu.",
  path: "/credito-seguro/",
});

type Scam = { name: string; href: string; arrives: string; sign: string };

const SCAMS: Scam[] = [
  {
    name: "Taxa antecipada",
    href: "/credito-seguro/deposito-antecipado-e-golpe/",
    arrives: "Anúncio, WhatsApp ou ligação com crédito “aprovado”",
    sign: "Pedem taxa, seguro, “IOF” ou depósito antes de liberar o dinheiro",
  },
  {
    name: "Falsa central do banco",
    href: "/credito-seguro/golpe-da-falsa-central/",
    arrives: "Ligação ou mensagem em nome do seu banco",
    sign: "Pedem senha, código, token ou transferência para uma “conta segura”",
  },
  {
    name: "Falso consignado e desconto no INSS",
    href: "/credito-seguro/desconto-nao-autorizado-inss/",
    arrives: "Contrato feito com seus dados, sem você pedir",
    sign: "Desconto no benefício que você não reconhece",
  },
  {
    name: "Falso Crédito do Trabalhador",
    href: "/emprestimos/credito-do-trabalhador/",
    arrives: "WhatsApp oferecendo o consignado da carteira de trabalho",
    sign: "Aprovação garantida e taxa antes; o canal oficial é a Carteira de Trabalho Digital ou o app do seu banco",
  },
  {
    name: "Empréstimo que cai sem pedir",
    href: "/credito-seguro/emprestimo-caiu-na-conta-sem-pedir/",
    arrives: "Dinheiro na conta e, logo depois, um contato",
    sign: "Pedem que você “devolva” por Pix para uma chave ditada por telefone",
  },
  {
    name: "App ou site falso",
    href: "/credito-seguro/app-de-emprestimo-e-confiavel/",
    arrives: "Anúncio, link ou loja de aplicativos",
    sign: "Empresa sem autorização do Banco Central ou que não se identifica",
  },
  {
    name: "“Sem consulta” e agiota",
    href: "/credito-seguro/emprestimo-sem-consulta/",
    arrives: "Promessa de crédito para negativado, sem análise",
    sign: "Sem contrato, sem CET, sem instituição autorizada por trás",
  },
];

function Content() {
  return (
    <section aria-labelledby="golpes-mais-comuns" className="mt-10">
      <h2 id="golpes-mais-comuns" className="font-serif text-2xl font-bold text-brand-navy">
        Os golpes de empréstimo mais comuns
      </h2>
      <p className="mt-2 max-w-3xl leading-relaxed text-brand-text">
        Quase todo golpe de empréstimo segue um destes roteiros. O nome do banco muda; o roteiro, não. Por isso vale reconhecer
        o roteiro, e não decorar marcas.
      </p>

      <div className="mt-5 hidden overflow-hidden rounded-xl border border-brand-border md:block">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">Golpes de empréstimo mais comuns</caption>
          <thead className="bg-brand-surface-soft text-brand-navy">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">Golpe</th>
              <th scope="col" className="px-4 py-3 font-semibold">Como chega</th>
              <th scope="col" className="px-4 py-3 font-semibold">O sinal que entrega</th>
            </tr>
          </thead>
          <tbody>
            {SCAMS.map((s) => (
              <tr key={s.name} className="border-t border-brand-border align-top">
                <th scope="row" className="px-4 py-3 font-semibold">
                  <Link href={s.href} className="text-brand-teal-dark underline underline-offset-2 hover:text-brand-navy">
                    {s.name}
                  </Link>
                </th>
                <td className="px-4 py-3 text-brand-text">{s.arrives}</td>
                <td className="px-4 py-3 text-brand-text">{s.sign}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="mt-5 grid list-none gap-3 pl-0 md:hidden">
        {SCAMS.map((s) => (
          <li key={s.name} className="mt-0 rounded-xl border border-brand-border bg-white p-4">
            <Link href={s.href} className="font-serif text-lg font-bold text-brand-teal-dark underline underline-offset-2">
              {s.name}
            </Link>
            <dl className="mt-2 space-y-1 text-sm text-brand-text">
              <div>
                <dt className="inline font-semibold">Como chega: </dt>
                <dd className="inline">{s.arrives}</dd>
              </div>
              <div>
                <dt className="inline font-semibold">O sinal: </dt>
                <dd className="inline">{s.sign}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>

      <div className="article-body mt-12 max-w-3xl">
        <h2 id="como-saber">Como saber se o empréstimo é golpe</h2>
        <p>Três checagens desmontam quase todos os roteiros acima:</p>
        <ol>
          <li>
            <strong>Pediram algum pagamento antes de liberar?</strong> Então é golpe. O Banco Central alerta que exigir pagamento
            antecipado para liberar empréstimo caracteriza fraude; custos legítimos entram no CET e são descontados do valor
            ou diluídos nas parcelas.
          </li>
          <li>
            <strong>Quem empresta é autorizado pelo Banco Central?</strong> Confira pelo nome ou CNPJ na{" "}
            <Link href="/calculadoras/consultar-instituicao/">consulta de instituição</Link>.
          </li>
          <li>
            <strong>O contato veio por um canal que você procurou?</strong> Na dúvida, desligue e procure o banco pelo número
            do cartão ou pelo app oficial. Os bancos orientam publicamente que não pedem senha, token nem transferência por telefone ou mensagem.
          </li>
        </ol>
        <p>
          Recebeu uma proposta agora? A <Link href="/calculadoras/sinais-de-golpe/">verificação de sinais de golpe</Link> confere em
          menos de um minuto. O passo a passo completo está em{" "}
          <Link href="/credito-seguro/como-identificar-golpes-de-emprestimo/">como identificar golpes de empréstimo</Link>.
        </p>

        <h2 id="cai-no-golpe">Caí no golpe: o que fazer agora</h2>
        <ol>
          <li>
            <strong>Fez Pix para o golpista?</strong> Procure o seu banco pelos canais oficiais e peça o Mecanismo Especial de
            Devolução (MED). A rapidez do pedido influencia a chance de devolução.
          </li>
          <li>
            <strong>Registre o boletim de ocorrência</strong>, com prints das conversas, números e comprovantes.
          </li>
          <li>
            <strong>Reclame formalmente</strong> na instituição envolvida e no <a href="https://www.consumidor.gov.br">consumidor.gov.br</a>.
          </li>
          <li>
            <strong>Confira o seu CPF no <a href="https://registrato.bcb.gov.br">Registrato</a></strong>, do Banco Central, que é
            gratuito: ele mostra os empréstimos abertos no seu nome, inclusive os que você não fez.
          </li>
        </ol>

        <h2 id="assinei-contrato">Fui enganado e assinei um contrato de empréstimo</h2>
        <p>
          Se a contratação foi pela internet ou por telefone, o art. 49 do Código de Defesa do Consumidor dá 7 dias de
          arrependimento para contratações feitas fora do estabelecimento comercial. Peça o cancelamento por escrito, pelos canais
          oficiais da instituição, e guarde o protocolo. Contrato feito com seus dados, sem a sua participação, segue outro
          caminho: o de <Link href="/credito-seguro/emprestimo-caiu-na-conta-sem-pedir/">empréstimo que caiu na conta sem pedir</Link>{" "}
          ou, no benefício do INSS, o de <Link href="/credito-seguro/desconto-nao-autorizado-inss/">desconto não autorizado</Link>.
        </p>

        <h2 id="banco-responde">O banco responde pelo golpe?</h2>
        <p>
          A Súmula 479 do Superior Tribunal de Justiça diz que &ldquo;as instituições financeiras respondem objetivamente pelos danos
          gerados por fortuito interno relativo a fraudes e delitos praticados por terceiros no âmbito de operações bancárias&rdquo;.
          Isso não significa ressarcimento automático: cada caso é analisado, e o que conta é se a fraude aconteceu dentro das
          operações do banco. Para buscar esse direito, os caminhos são a reclamação formal, o Procon e, se preciso, a Justiça.
        </p>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section aria-labelledby="perguntas-frequentes" className="article-body mt-12 max-w-3xl">
      <h2 id="perguntas-frequentes">Perguntas frequentes</h2>
      <FaqAccordion>
        <FaqItem question="Como saber se o empréstimo é golpe?" id="como-saber-se-o-emprestimo-e-golpe">
          <p>
            Pedido de pagamento antes de liberar o dinheiro já basta para saber. Confira também se quem empresta é autorizado pelo
            Banco Central e se o contato veio por um canal oficial que você procurou. A{" "}
            <Link href="/calculadoras/sinais-de-golpe/">verificação de sinais de golpe</Link> faz essas perguntas com você.
          </p>
        </FaqItem>
        <FaqItem question="Se eu cair em um golpe de empréstimo, o que devo fazer?" id="se-eu-cair-em-um-golpe-de-emprestimo-o-que-devo-fazer">
          <p>
            Se fez Pix, procure o seu banco na hora e peça o Mecanismo Especial de Devolução (MED). Depois, registre boletim de
            ocorrência, reclame na instituição e no consumidor.gov.br e confira no Registrato se abriram empréstimos no seu CPF.
          </p>
        </FaqItem>
        <FaqItem question="Como funciona o golpe do falso empréstimo consignado?" id="como-funciona-o-golpe-do-falso-emprestimo-consignado">
          <p>
            Com dados pessoais obtidos de vazamentos, criminosos contratam um consignado em nome da vítima, ou oferecem um
            consignado &ldquo;liberado&rdquo; e pedem taxa antes. No INSS, o primeiro sinal costuma ser um desconto que você não
            reconhece. O caminho de contestação e o bloqueio do benefício para empréstimos estão em{" "}
            <Link href="/credito-seguro/desconto-nao-autorizado-inss/">desconto de empréstimo no INSS que você não fez</Link>.
          </p>
        </FaqItem>
        <FaqItem question="Existe golpe com o consignado CLT pela carteira de trabalho?" id="existe-golpe-com-o-consignado-clt-pela-carteira-de-trabalho">
          <p>
            Sim. Criminosos oferecem o &ldquo;Crédito do Trabalhador&rdquo; por WhatsApp, com aprovação garantida e taxa antecipada.
            O canal legítimo é a Carteira de Trabalho Digital ou o app oficial do seu banco. Como funciona o programa está no guia do{" "}
            <Link href="/emprestimos/credito-do-trabalhador/">Crédito do Trabalhador</Link>.
          </p>
        </FaqItem>
        <FaqItem question="Quais são os golpes do momento?" id="quais-sao-os-golpes-do-momento">
          <p>
            Os roteiros da tabela acima são os que mais aparecem: taxa antecipada, falsa central, falso consignado, falso Crédito do
            Trabalhador, empréstimo que cai sem pedir e app falso. O que muda de um mês para o outro é a isca, como o nome de um
            programa novo ou de um banco conhecido. O roteiro, e o sinal que o entrega, continuam os mesmos.
          </p>
        </FaqItem>
        <FaqItem question="Golpista usou o nome de um banco conhecido. E agora?" id="golpista-usou-o-nome-de-um-banco-conhecido-e-agora">
          <p>
            Usar o nome de um banco grande é parte do roteiro. Não responda pelo mesmo canal: procure o banco pelo app oficial ou
            pelo número do cartão e conte o que aconteceu. Se houve pagamento, siga os passos de{" "}
            <a href="#cai-no-golpe">caí no golpe</a>.
          </p>
        </FaqItem>
      </FaqAccordion>
    </section>
  );
}

export default function CreditoSeguroPage() {
  return (
    <CategoryHub
      category="credito-seguro"
      heading="Golpes de empréstimo: os mais comuns e como se proteger"
      intro="Golpes de empréstimo seguem roteiros conhecidos: taxa antes de liberar, falsa central, falso consignado, dinheiro que cai sem pedir. Aqui você vê como cada um chega, o sinal que o entrega e o que fazer se já caiu. O Crédito por Perto não concede crédito: explica, e você decide."
      after={<Faq />}
    >
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/calculadoras/sinais-de-golpe/"
          className="rounded-lg bg-brand-teal-dark px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-teal"
        >
          Verificar uma proposta
        </Link>
        <Link
          href="/calculadoras/consultar-instituicao/"
          className="rounded-lg border border-brand-border px-5 py-2.5 text-sm font-semibold text-brand-navy hover:bg-brand-surface-soft"
        >
          Consultar instituição
        </Link>
      </div>
      <Content />
    </CategoryHub>
  );
}
