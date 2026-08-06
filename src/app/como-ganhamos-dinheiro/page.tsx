import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { InstitutionalShell } from "@/components/layout/InstitutionalShell";

export const metadata: Metadata = buildMetadata({
  title: "Como ganhamos dinheiro",
  description:
    "Transparência sobre a monetização do Crédito Por Perto: publicidade programática futura, o que ela influencia (nada no editorial) e como identificá-la.",
  path: "/como-ganhamos-dinheiro/",
});

export default function ComoGanhamosDinheiroPage() {
  return (
    <InstitutionalShell
      title="Como ganhamos dinheiro"
      description="Transparência sobre a monetização do portal."
      path="/como-ganhamos-dinheiro/"
      intro="Se o conteúdo é gratuito, é justo você saber como o portal se sustenta."
    >
      <h2>Situação atual</h2>
      <p>
        Neste momento, o Crédito Por Perto não exibe publicidade e não possui
        parcerias comerciais. O portal está em fase de construção do acervo
        editorial.
      </p>
      <h2>Publicidade programática (planejada)</h2>
      <p>
        O modelo previsto de monetização é a publicidade programática (como o
        Google AdSense): anúncios exibidos automaticamente, pagos por
        anunciantes, sem que o portal escolha produto a produto o que aparece.
        Quando ativada, a publicidade será:
      </p>
      <ul>
        <li>Identificada visualmente como “Publicidade”;</li>
        <li>Separada do conteúdo editorial, sem imitar botões ou menus;</li>
        <li>Ausente de páginas sem conteúdo, de erro e de documentos legais.</li>
      </ul>
      <h2>Links patrocinados e afiliados (possibilidade futura)</h2>
      <p>
        Se um dia houver links de afiliados ou conteúdo patrocinado, eles serão
        sinalizados de forma explícita no próprio conteúdo, usarão a marcação
        técnica adequada (<code>rel=&quot;sponsored&quot;</code>) e continuarão
        sujeitos à regra central da{" "}
        <Link href="/politica-editorial/">política editorial</Link>: parceiro
        comercial não determina conclusão editorial. Hoje, não temos nenhuma
        parceria desse tipo.
      </p>
      <h2>O que nunca fazemos</h2>
      <ul>
        <li>Cobrar do leitor para acessar conteúdo;</li>
        <li>Receber para recomendar uma instituição específica;</li>
        <li>Vender dados pessoais de visitantes;</li>
        <li>Intermediar propostas de empréstimo.</li>
      </ul>
      <p>
        Detalhes sobre posicionamento e regras dos anúncios estão na{" "}
        <Link href="/politica-de-publicidade/">política de publicidade</Link>.
      </p>
    </InstitutionalShell>
  );
}
