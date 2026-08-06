import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { SITE_NAME, SITE_DESCRIPTION } from "@/lib/site";
import { getRecentArticles, getFeaturedArticles } from "@/lib/content/articles";
import { getPublishedLocalGuides } from "@/lib/content/local";
import { ArticleCard, CategoryCard, LocalGuideCard } from "@/components/ui/cards";
import { SafetyAlert } from "@/components/content/boxes";

export const metadata: Metadata = buildMetadata({
  title: `${SITE_NAME} | Guia de Empréstimos e Crédito`,
  description: SITE_DESCRIPTION,
  path: "/",
});

const MODALIDADES = [
  {
    title: "Empréstimo pessoal",
    description:
      "Como funciona a modalidade mais comum de crédito, o que encarece a parcela e o que comparar entre propostas.",
    href: "/emprestimos/emprestimo-pessoal/",
  },
  {
    title: "Empréstimo consignado",
    description:
      "Desconto em folha para aposentados, pensionistas e servidores: margem, portabilidade e os golpes mais comuns.",
    href: "/emprestimos/emprestimo-consignado/",
  },
  {
    title: "Antecipação do FGTS",
    description:
      "O que significa antecipar o saque-aniversário, o que fica bloqueado e quando essa operação pode ou não fazer sentido.",
    href: "/emprestimos/antecipacao-saque-aniversario-fgts/",
  },
  {
    title: "Empréstimo com garantia",
    description:
      "Imóvel ou veículo como garantia: por que os juros tendem a ser menores e qual é o risco real de perder o bem.",
    href: "/emprestimos/emprestimo-com-garantia/",
  },
  {
    title: "Crédito para negativado",
    description:
      "O que realmente existe para quem está com o nome restrito, como fugir de promessas falsas e quais alternativas avaliar.",
    href: "/emprestimos/emprestimo-para-negativado/",
  },
  {
    title: "Juros e CET",
    description:
      "Entenda a diferença entre taxa de juros e Custo Efetivo Total — e por que só o CET permite comparar propostas.",
    href: "/juros-e-cet/o-que-e-cet/",
  },
];

export default function HomePage() {
  const recentes = getRecentArticles(6);
  const destaques = getFeaturedArticles(3);
  const guiasLocais = getPublishedLocalGuides();

  return (
    <>
      {/* Hero */}
      <section className="border-b border-brand-border bg-brand-navy">
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-teal-soft">
            Portal editorial independente
          </p>
          <h1 className="mt-3 max-w-2xl font-serif text-4xl font-bold leading-tight text-white md:text-5xl">
            Entenda o crédito antes de assumir uma dívida.
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-brand-surface-soft/85">
            Guias independentes, calculadoras e informações locais para ajudar
            você a comparar empréstimos com mais clareza e segurança.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/emprestimos/"
              className="rounded-lg bg-brand-teal px-6 py-3 font-semibold text-white hover:bg-brand-teal-dark"
            >
              Explorar os guias
            </Link>
            <Link
              href="/calculadoras/emprestimo/"
              className="rounded-lg border border-white/30 px-6 py-3 font-semibold text-white hover:bg-white/10"
            >
              Calcular parcelas
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4">
        {/* Modalidades */}
        <section aria-labelledby="modalidades" className="mt-14">
          <h2 id="modalidades" className="font-serif text-2xl font-bold text-brand-navy">
            Principais modalidades de empréstimo
          </h2>
          <p className="mt-2 max-w-2xl text-brand-muted">
            Cada modalidade tem custos, exigências e riscos diferentes. Comece
            pelo guia da modalidade que você está avaliando.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MODALIDADES.map((m) => (
              <CategoryCard key={m.href} {...m} />
            ))}
          </div>
        </section>

        {/* Comece por aqui */}
        <section aria-labelledby="comece" className="mt-14">
          <h2 id="comece" className="font-serif text-2xl font-bold text-brand-navy">
            Comece por aqui
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <CategoryCard
              title="Quando vale a pena um empréstimo?"
              description="Perguntas para responder antes de contratar qualquer crédito — e as situações em que o empréstimo costuma piorar o problema."
              href="/organizacao-financeira/quando-vale-a-pena-fazer-emprestimo/"
            />
            <CategoryCard
              title="Como comparar propostas"
              description="Um método prático para colocar duas ou mais ofertas lado a lado usando o CET, o valor total e as condições de atraso."
              href="/organizacao-financeira/como-comparar-propostas-de-credito/"
            />
            <CategoryCard
              title="Como identificar golpes"
              description="Os sinais que aparecem antes de você perder dinheiro: depósito antecipado, falso funcionário, site clonado e pressa artificial."
              href="/credito-seguro/como-identificar-golpes-de-emprestimo/"
            />
          </div>
        </section>

        {/* Destaques */}
        {destaques.length > 0 ? (
          <section aria-labelledby="destaques" className="mt-14">
            <h2 id="destaques" className="font-serif text-2xl font-bold text-brand-navy">
              Guias mais importantes
            </h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {destaques.map((article) => (
                <ArticleCard key={article.urlPath} article={article} />
              ))}
            </div>
          </section>
        ) : null}

        {/* Calculadora */}
        <section
          aria-labelledby="calculadoras"
          className="mt-14 rounded-2xl border border-brand-border bg-brand-surface-soft p-8"
        >
          <div className="md:flex md:items-center md:justify-between md:gap-8">
            <div>
              <h2 id="calculadoras" className="font-serif text-2xl font-bold text-brand-navy">
                Calculadora de empréstimo
              </h2>
              <p className="mt-2 max-w-xl text-brand-muted">
                Simule o valor aproximado da parcela, o total pago e o total de
                juros antes de conversar com qualquer instituição. Sem cadastro,
                sem CPF: os cálculos acontecem no seu navegador.
              </p>
            </div>
            <Link
              href="/calculadoras/emprestimo/"
              className="mt-4 inline-block shrink-0 rounded-lg bg-brand-teal-dark px-6 py-3 font-semibold text-white hover:bg-brand-teal md:mt-0"
            >
              Usar a calculadora
            </Link>
          </div>
        </section>

        {/* Segurança */}
        <section aria-labelledby="seguranca" className="mt-14">
          <h2 id="seguranca" className="sr-only">
            Alerta contra golpes
          </h2>
          <SafetyAlert>
            <p>
              Instituições sérias não exigem depósito antecipado para liberar
              empréstimos. Antes de compartilhar documentos ou contratar
              crédito, confirme se a empresa é autorizada pelo Banco Central e
              consulte as condições completas da proposta.{" "}
              <Link
                href="/credito-seguro/como-identificar-golpes-de-emprestimo/"
                className="font-semibold underline"
              >
                Veja como se proteger
              </Link>
              .
            </p>
          </SafetyAlert>
        </section>

        {/* Guias locais */}
        <section aria-labelledby="locais" className="mt-14">
          <h2 id="locais" className="font-serif text-2xl font-bold text-brand-navy">
            Guias de empréstimos por localidade
          </h2>
          <p className="mt-2 max-w-2xl text-brand-muted">
            Estamos construindo guias locais com informações verificadas:
            canais de proteção ao consumidor da sua região, atendimento
            disponível e cuidados específicos. Cada guia só é publicado depois
            de checagem de fontes oficiais.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {guiasLocais.length > 0 ? (
              guiasLocais.map((guide) => (
                <LocalGuideCard
                  key={guide.urlPath}
                  title={guide.frontmatter.localityName}
                  description={guide.frontmatter.description}
                  href={guide.urlPath}
                />
              ))
            ) : (
              <p className="text-brand-muted sm:col-span-2 lg:col-span-3">
                Os primeiros guias locais estão em fase de verificação de fontes
                e serão publicados em breve. Enquanto isso, veja o{" "}
                <Link
                  href="/emprestimos/guias-locais/"
                  className="font-medium text-brand-teal-dark underline"
                >
                  índice de guias locais
                </Link>
                .
              </p>
            )}
          </div>
        </section>

        {/* Recentes */}
        {recentes.length > 0 ? (
          <section aria-labelledby="recentes" className="mt-14">
            <div className="flex items-center justify-between">
              <h2 id="recentes" className="font-serif text-2xl font-bold text-brand-navy">
                Conteúdos atualizados recentemente
              </h2>
              <Link
                href="/artigos/"
                className="text-sm font-semibold text-brand-teal-dark hover:underline"
              >
                Ver todos
              </Link>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recentes.map((article) => (
                <ArticleCard key={article.urlPath} article={article} />
              ))}
            </div>
          </section>
        ) : null}

        {/* Transparência */}
        <section
          aria-labelledby="transparencia"
          className="mt-14 rounded-2xl border border-brand-border bg-white p-8"
        >
          <h2 id="transparencia" className="font-serif text-2xl font-bold text-brand-navy">
            Como produzimos nosso conteúdo
          </h2>
          <div className="mt-4 grid gap-6 md:grid-cols-3">
            <div>
              <h3 className="font-bold text-brand-navy">Fontes oficiais primeiro</h3>
              <p className="mt-1 text-sm leading-relaxed text-brand-muted">
                Priorizamos Banco Central, gov.br, legislação e documentação
                oficial das instituições. Cada afirmação importante tem fonte e
                data de consulta registradas.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-brand-navy">Revisão editorial</h3>
              <p className="mt-1 text-sm leading-relaxed text-brand-muted">
                Todo conteúdo passa por checagem factual e revisão antes de
                publicar. Erros são corrigidos de forma documentada, seguindo a
                política de correções.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-brand-navy">Independência</h3>
              <p className="mt-1 text-sm leading-relaxed text-brand-muted">
                Não concedemos crédito nem recebemos para recomendar
                instituições. Publicidade, quando houver, é identificada e
                separada do conteúdo editorial.
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-4 text-sm font-semibold text-brand-teal-dark">
            <Link href="/politica-editorial/" className="hover:underline">
              Política editorial
            </Link>
            <Link href="/metodologia/" className="hover:underline">
              Metodologia
            </Link>
            <Link href="/quem-somos/" className="hover:underline">
              Quem somos
            </Link>
            <Link href="/como-ganhamos-dinheiro/" className="hover:underline">
              Como ganhamos dinheiro
            </Link>
          </div>
        </section>

        {/* Glossário */}
        <section aria-labelledby="glossario" className="mt-14 mb-4">
          <h2 id="glossario" className="font-serif text-2xl font-bold text-brand-navy">
            Glossário de crédito
          </h2>
          <p className="mt-2 max-w-2xl text-brand-muted">
            CET, IOF, amortização, margem consignável, portabilidade… O
            vocabulário do crédito explicado em linguagem simples, termo por
            termo.
          </p>
          <Link
            href="/glossario/"
            className="mt-4 inline-block rounded-lg border border-brand-border px-5 py-2.5 font-semibold text-brand-navy hover:bg-brand-surface-soft"
          >
            Abrir o glossário
          </Link>
        </section>
      </div>
    </>
  );
}
