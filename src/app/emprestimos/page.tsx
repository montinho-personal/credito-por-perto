import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { CategoryHub } from "@/components/content/CategoryHub";
import { FaqAccordion, FaqItem } from "@/components/content/FaqAccordion";

/**
 * Hub de empréstimos, dono das buscas "tipos de empréstimo" e "modalidades de
 * empréstimo" (SERP de 08/10/2026). A tabela compara as modalidades pelo que
 * as diferencia de fato — como se paga, o que garante a dívida e quem pode
 * pedir — sem número de taxa: as médias oficiais ficam em /taxas/, com data.
 */
export const metadata: Metadata = buildMetadata({
  title: "Tipos de empréstimo: modalidades, custos e cuidados",
  description:
    "Pessoal, consignado, com garantia, FGTS, cheque especial e microcrédito: como cada tipo de empréstimo funciona, quem pode pedir e como comparar.",
  path: "/emprestimos/",
});

type Row = {
  name: string;
  href: string;
  pay: string;
  guarantee: string;
  who: string;
};

const ROWS: Row[] = [
  {
    name: "Empréstimo pessoal",
    href: "/emprestimos/emprestimo-pessoal/",
    pay: "Parcelas por boleto ou débito em conta",
    guarantee: "Nenhuma",
    who: "Quem passa na análise de crédito",
  },
  {
    name: "Consignado do INSS",
    href: "/emprestimos/emprestimo-para-aposentado-inss/",
    pay: "Desconto direto no benefício",
    guarantee: "O próprio desconto na fonte",
    who: "Aposentados e pensionistas; quem recebe BPC tem regras próprias",
  },
  {
    name: "Consignado CLT (Crédito do Trabalhador)",
    href: "/emprestimos/credito-do-trabalhador/",
    pay: "Desconto direto no salário",
    guarantee: "O desconto em folha; parte do FGTS e a multa rescisória, se você quiser",
    who: "Empregados com carteira assinada, domésticos e rurais",
  },
  {
    name: "Consignado do servidor",
    href: "/emprestimos/consignado-servidor-publico/",
    pay: "Desconto direto na folha",
    guarantee: "O desconto em folha",
    who: "Servidores públicos, pelas regras de cada ente (federal, estadual, municipal)",
  },
  {
    name: "Com garantia de imóvel ou veículo",
    href: "/emprestimos/emprestimo-com-garantia/",
    pay: "Parcelas mensais",
    guarantee: "O bem fica alienado ao credor até a quitação",
    who: "Quem tem o bem quitado ou aceito pelo credor",
  },
  {
    name: "Com garantia de celular",
    href: "/emprestimos/emprestimo-com-garantia-de-celular/",
    pay: "Parcelas; no atraso, um app pode restringir o aparelho",
    guarantee: "O próprio celular",
    who: "Quem tem um aparelho aceito pela empresa",
  },
  {
    name: "Antecipação do FGTS",
    href: "/emprestimos/antecipacao-saque-aniversario-fgts/",
    pay: "Os saques-aniversário futuros vão direto à instituição",
    guarantee: "Os próprios saques do FGTS",
    who: "Quem optou pelo saque-aniversário",
  },
  {
    name: "Antecipação do 13º",
    href: "/emprestimos/antecipacao-do-13-salario/",
    pay: "O 13º quita a dívida quando é pago",
    guarantee: "O próprio 13º",
    who: "Quem tem direito ao 13º",
  },
  {
    name: "Cheque especial e rotativo do cartão",
    href: "/juros-e-cet/juros-do-cheque-especial/",
    pay: "Juros correm enquanto o limite está em uso",
    guarantee: "Nenhuma",
    who: "Quem já tem o limite liberado",
  },
  {
    name: "Microcrédito e Banco do Povo",
    href: "/emprestimos/microcredito-produtivo-e-banco-do-povo/",
    pay: "Parcelas; o dinheiro vai para o negócio",
    guarantee: "Avalista ou fundo de aval, conforme o programa",
    who: "Quem tem ou quer abrir um pequeno negócio",
  },
  {
    name: "Financiamento",
    href: "/emprestimos/diferenca-entre-emprestimo-e-financiamento/",
    pay: "Parcelas; o dinheiro vai direto para o bem comprado",
    guarantee: "Em geral, o próprio bem",
    who: "Quem compra um imóvel, veículo ou outro bem",
  },
];

const PROFILES: Array<{ label: string; href: string }> = [
  { label: "Negativado", href: "/emprestimos/emprestimo-para-negativado/" },
  { label: "MEI e empresa", href: "/emprestimos/emprestimo-para-mei/" },
  { label: "Autônomo", href: "/emprestimos/emprestimo-para-autonomo/" },
  { label: "Aposentado do INSS", href: "/emprestimos/emprestimo-para-aposentado-inss/" },
  { label: "Recebe BPC", href: "/emprestimos/consignado-para-quem-recebe-bpc/" },
  { label: "Carteira assinada", href: "/emprestimos/credito-do-trabalhador/" },
  { label: "Produtor rural", href: "/emprestimos/credito-rural-e-pronaf/" },
  { label: "Programas do governo", href: "/emprestimos/emprestimo-do-governo/" },
];

function Comparison() {
  return (
    <section aria-labelledby="tabela-tipos" className="mt-10">
      <h2 id="tabela-tipos" className="font-serif text-2xl font-bold text-brand-navy">
        Os tipos de empréstimo, lado a lado
      </h2>
      <p className="mt-2 max-w-3xl leading-relaxed text-brand-text">
        O que separa uma modalidade da outra é <strong>como você paga</strong>, <strong>o que garante a dívida</strong> e{" "}
        <strong>quem pode pedir</strong>. Quanto menor o risco para quem empresta, como no desconto em folha ou com um bem
        em garantia, menor costuma ser a taxa. As médias de juros de cada modalidade, publicadas pelo Banco Central, estão
        em <Link href="/taxas/" className="font-semibold text-brand-teal-dark underline underline-offset-2">taxas médias por modalidade</Link>.
      </p>

      {/* Tabela no desktop; no celular, um cartão por modalidade. */}
      <div className="mt-5 hidden overflow-hidden rounded-xl border border-brand-border md:block">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">Comparação dos tipos de empréstimo</caption>
          <thead className="bg-brand-surface-soft text-brand-navy">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">Modalidade</th>
              <th scope="col" className="px-4 py-3 font-semibold">Como você paga</th>
              <th scope="col" className="px-4 py-3 font-semibold">O que garante a dívida</th>
              <th scope="col" className="px-4 py-3 font-semibold">Quem pode pedir</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.name} className="border-t border-brand-border align-top">
                <th scope="row" className="px-4 py-3 font-semibold">
                  <Link href={r.href} className="text-brand-teal-dark underline underline-offset-2 hover:text-brand-navy">
                    {r.name}
                  </Link>
                </th>
                <td className="px-4 py-3 text-brand-text">{r.pay}</td>
                <td className="px-4 py-3 text-brand-text">{r.guarantee}</td>
                <td className="px-4 py-3 text-brand-text">{r.who}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="mt-5 grid list-none gap-3 pl-0 md:hidden">
        {ROWS.map((r) => (
          <li key={r.name} className="mt-0 rounded-xl border border-brand-border bg-white p-4">
            <Link href={r.href} className="font-serif text-lg font-bold text-brand-teal-dark underline underline-offset-2">
              {r.name}
            </Link>
            <dl className="mt-2 space-y-1 text-sm text-brand-text">
              <div>
                <dt className="inline font-semibold">Como paga: </dt>
                <dd className="inline">{r.pay}</dd>
              </div>
              <div>
                <dt className="inline font-semibold">Garantia: </dt>
                <dd className="inline">{r.guarantee}</dd>
              </div>
              <div>
                <dt className="inline font-semibold">Quem pode pedir: </dt>
                <dd className="inline">{r.who}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>

      <h2 id="por-perfil" className="mt-12 font-serif text-2xl font-bold text-brand-navy">
        Qual tipo pode servir para o seu perfil
      </h2>
      <ul className="mt-4 flex list-none flex-wrap gap-2 pl-0">
        {PROFILES.map((p) => (
          <li key={p.href} className="mt-0">
            <Link
              href={p.href}
              className="inline-flex min-h-11 items-center rounded-full border border-brand-border bg-white px-4 text-sm font-semibold text-brand-navy hover:border-brand-teal"
            >
              {p.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Faq() {
  return (
    <section aria-labelledby="perguntas-frequentes" className="article-body mt-12 max-w-3xl">
      <h2 id="perguntas-frequentes">Perguntas frequentes</h2>
      <FaqAccordion>
        <FaqItem question="Quais são as modalidades de empréstimo?" id="quais-sao-as-modalidades-de-emprestimo">
          <p>
            As mais comuns são o empréstimo pessoal, o consignado (do INSS, do CLT pelo Crédito do Trabalhador e do servidor),
            o empréstimo com garantia de imóvel, veículo ou celular, as antecipações do FGTS e do 13º, o cheque especial e o
            rotativo do cartão, e o microcrédito para quem tem um pequeno negócio. A tabela acima mostra como cada uma funciona.
          </p>
        </FaqItem>
        <FaqItem question="Qual a melhor modalidade de empréstimo?" id="qual-a-melhor-modalidade-de-emprestimo">
          <p>
            Não existe uma melhor para todo mundo: depende de quais você pode contratar e de quanto cada proposta custa no seu
            caso. Para comparar, olhe o <Link href="/juros-e-cet/o-que-e-cet/">CET</Link> e o total pago, não só a parcela, e
            confira se a parcela cabe no orçamento dos próximos meses. O{" "}
            <Link href="/calculadoras/comparador-de-propostas/">comparador de propostas</Link> coloca duas ofertas lado a lado.
          </p>
        </FaqItem>
        <FaqItem question="Quais são os 3 tipos de crédito?" id="quais-sao-os-3-tipos-de-credito">
          <p>
            Não há uma divisão oficial em três. Uma forma útil de separar é pelo que garante o pagamento: crédito{" "}
            <strong>sem garantia</strong> (empréstimo pessoal, cheque especial, cartão), crédito com{" "}
            <strong>desconto na fonte</strong> (consignado) e crédito com <strong>garantia de um bem ou de um direito</strong>{" "}
            (imóvel, veículo, celular, saques do FGTS).
          </p>
        </FaqItem>
        <FaqItem
          question="Qual a diferença entre empréstimo e financiamento?"
          id="qual-a-diferenca-entre-emprestimo-e-financiamento"
        >
          <p>
            No empréstimo, o dinheiro vai para você usar como quiser. No financiamento, ele vai direto para a compra de um bem
            específico, que em geral fica como garantia. O guia de{" "}
            <Link href="/emprestimos/diferenca-entre-emprestimo-e-financiamento/">empréstimo ou financiamento</Link> explica
            quando cada um aparece.
          </p>
        </FaqItem>
        <FaqItem question="Quais são os tipos de empréstimo para empresas?" id="quais-sao-os-tipos-de-emprestimo-para-empresas">
          <p>
            Para MEI e pequenas empresas, há o crédito pela pessoa jurídica nos bancos e cooperativas, a{" "}
            <Link href="/emprestimos/antecipacao-de-recebiveis/">antecipação de recebíveis</Link>, o microcrédito e as linhas
            públicas, como Procred 360 e Pronampe. O <Link href="/emprestimos/emprestimo-para-mei/">guia do MEI</Link> e o de{" "}
            <Link href="/emprestimos/emprestimo-do-governo/">empréstimo do governo</Link> detalham cada caminho.
          </p>
        </FaqItem>
        <FaqItem question="Quanto fica R$ 10.000 financiado em 48 vezes?" id="quanto-fica-r-10000-financiado-em-48-vezes">
          <p>
            Depende da taxa de juros da proposta, que muda muito de uma modalidade para outra. Com a taxa em mãos, a{" "}
            <Link href="/calculadoras/emprestimo/">calculadora de empréstimo</Link> mostra a parcela e o total pago.
          </p>
        </FaqItem>
        <FaqItem question="Ofereceram empréstimo pelo WhatsApp. É seguro?" id="ofereceram-emprestimo-pelo-whatsapp-e-seguro">
          <p>
            Desconfie. O WhatsApp é o canal preferido do golpe do empréstimo, quase sempre com pedido de taxa antes de liberar,
            o que caracteriza fraude. O roteiro e o que conferir estão em{" "}
            <Link href="/emprestimos/emprestimo-na-hora/#oferta-pelo-whatsapp-o-roteiro-do-golpe">oferta pelo WhatsApp</Link>, e
            a <Link href="/calculadoras/sinais-de-golpe/">verificação de sinais de golpe</Link> confere a proposta em um minuto.
          </p>
        </FaqItem>
      </FaqAccordion>
    </section>
  );
}

export default function EmprestimosPage() {
  return (
    <CategoryHub
      category="emprestimos"
      heading="Tipos de empréstimo"
      intro="Pessoal, consignado, com garantia, antecipação do FGTS, cheque especial, microcrédito: cada tipo de empréstimo muda como você paga, o que garante a dívida e quem pode pedir. Abaixo, as modalidades lado a lado e um guia para cada uma. O Crédito por Perto não concede crédito: explica, e você decide."
      after={<Faq />}
    >
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/calculadoras/emprestimo/"
          className="rounded-lg bg-brand-teal-dark px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-teal"
        >
          Calcular parcelas
        </Link>
        <Link
          href="/emprestimos/guias-locais/"
          className="rounded-lg border border-brand-border px-5 py-2.5 text-sm font-semibold text-brand-navy hover:bg-brand-surface-soft"
        >
          Guias por localidade
        </Link>
      </div>
      <Comparison />
    </CategoryHub>
  );
}
