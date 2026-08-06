import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { InstitutionalShell } from "@/components/layout/InstitutionalShell";

export const metadata: Metadata = buildMetadata({
  title: "Política de publicidade",
  description:
    "Regras que a publicidade deve seguir no Crédito Por Perto: identificação clara, separação do conteúdo editorial e páginas onde anúncios nunca aparecem.",
  path: "/politica-de-publicidade/",
});

export default function PoliticaDePublicidadePage() {
  return (
    <InstitutionalShell
      title="Política de publicidade"
      description="Regras para anúncios no portal."
      path="/politica-de-publicidade/"
      intro="Publicidade sustenta o portal, mas nunca pode se confundir com o conteúdo nem prejudicar a leitura."
    >
      <h2>Identificação e separação</h2>
      <ul>
        <li>Anúncios são identificados com o rótulo “Publicidade”;</li>
        <li>
          Não podem imitar botões, menus, links de download ou elementos de
          navegação do portal;
        </li>
        <li>Não ficam colados a elementos clicáveis do conteúdo;</li>
        <li>Têm espaço reservado no layout para não “empurrar” o texto durante o carregamento.</li>
      </ul>
      <h2>Onde anúncios não aparecem</h2>
      <ul>
        <li>Páginas de erro (404 e afins);</li>
        <li>Resultados de busca vazios;</li>
        <li>Documentos legais e páginas institucionais de transparência;</li>
        <li>Rascunhos e páginas com conteúdo incompleto;</li>
        <li>Ambientes de teste e pré-visualização do portal.</li>
      </ul>
      <h2>Densidade e experiência</h2>
      <p>
        Limitamos a quantidade de anúncios por página para que a leitura
        continue fluida, especialmente no celular. Não usamos formatos que
        cobrem o conteúdo, disparam som automaticamente ou induzem cliques
        acidentais.
      </p>
      <h2>Anunciantes e conteúdo editorial</h2>
      <p>
        A veiculação programática significa que não escolhemos anúncio por
        anúncio. Independentemente de quem anuncia, vale a regra da{" "}
        <Link href="/politica-editorial/">política editorial</Link>: nenhum
        anunciante influencia análises, conclusões ou alertas publicados. Veja
        também <Link href="/como-ganhamos-dinheiro/">como ganhamos dinheiro</Link>.
      </p>
    </InstitutionalShell>
  );
}
