import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { InstitutionalShell } from "@/components/layout/InstitutionalShell";
import { getPublishedArticles } from "@/lib/content/articles";
import { getPublishedLocalGuides } from "@/lib/content/local";
import { CATEGORIES } from "@/lib/content/categories";
import { FOOTER_NAV } from "@/lib/site";

export const metadata: Metadata = buildMetadata({
  title: "Mapa do site",
  description:
    "Todas as seções e páginas publicadas do Crédito por Perto organizadas em um só lugar: guias, calculadoras, páginas locais e institucionais.",
  path: "/mapa-do-site/",
});

export default function MapaDoSitePage() {
  const articles = getPublishedArticles();
  const localGuides = getPublishedLocalGuides();
  return (
    <InstitutionalShell
      title="Mapa do site"
      description="Todas as páginas publicadas do portal."
      path="/mapa-do-site/"
    >
      <h2>Seções principais</h2>
      <ul>
        <li><Link href="/">Página inicial</Link></li>
        {Object.values(CATEGORIES).map((cat) => (
          <li key={cat.id}>
            <Link href={cat.basePath}>{cat.label}</Link>
          </li>
        ))}
        <li><Link href="/decisoes-financeiras/">Central de Decisões Financeiras</Link></li>
        <li><Link href="/taxas/">Radar de taxas de crédito</Link></li>
        <li><Link href="/calculadoras/">Calculadoras</Link></li>
        <li><Link href="/calculadoras/consultar-instituicao/">Essa instituição aparece no Banco Central?</Link></li>
        <li><Link href="/calculadoras/comparador-de-propostas/">Comparador de propostas de crédito</Link></li>
        <li><Link href="/calculadoras/trocar-divida/">Vale a pena trocar esta dívida?</Link></li>
        <li><Link href="/calculadoras/plano-para-sair-das-dividas/">Plano para sair das dívidas</Link></li>
        <li><Link href="/calculadoras/quitacao-antecipada/">Calculadora de quitação antecipada</Link></li>
        <li><Link href="/calculadoras/parcela-no-orcamento/">Quanto de parcela cabe no meu orçamento?</Link></li>
        <li><Link href="/calculadoras/conversor-de-taxas/">Conversor de taxas: mensal ↔ anual</Link></li>
        <li><Link href="/calculadoras/minha-taxa-esta-cara/">Minha taxa está cara?</Link></li>
        <li><Link href="/calculadoras/sinais-de-golpe/">Essa proposta tem sinais de golpe?</Link></li>
        <li><Link href="/calculadoras/emprestimo/">Calculadora de empréstimo</Link></li>
        <li><Link href="/emprestimos/guias-locais/">Guias locais</Link></li>
        <li><Link href="/artigos/">Blog</Link></li>
        <li><Link href="/glossario/">Glossário de crédito</Link></li>
        <li><Link href="/busca/">Busca</Link></li>
      </ul>
      <h2>Guias e artigos</h2>
      <ul>
        {articles.map((article) => (
          <li key={article.urlPath}>
            <Link href={article.urlPath}>{article.frontmatter.title}</Link>
          </li>
        ))}
      </ul>
      {localGuides.length > 0 ? (
        <>
          <h2>Guias locais publicados</h2>
          <ul>
            {localGuides.map((guide) => (
              <li key={guide.urlPath}>
                <Link href={guide.urlPath}>{guide.frontmatter.title}</Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <h2>Institucional</h2>
      <ul>
        {FOOTER_NAV.institucional.map((item) => (
          <li key={item.href}>
            <Link href={item.href}>{item.label}</Link>
          </li>
        ))}
      </ul>
      <h2>Legal</h2>
      <ul>
        {FOOTER_NAV.legal.map((item) => (
          <li key={item.href}>
            <Link href={item.href}>{item.label}</Link>
          </li>
        ))}
      </ul>
    </InstitutionalShell>
  );
}
