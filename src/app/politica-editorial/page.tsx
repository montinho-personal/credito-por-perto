import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { InstitutionalShell } from "@/components/layout/InstitutionalShell";

export const metadata: Metadata = buildMetadata({
  title: "Política editorial",
  description:
    "Os princípios que orientam o conteúdo do Crédito Por Perto: independência, precisão, fontes oficiais, linguagem responsável e correção transparente de erros.",
  path: "/politica-editorial/",
});

export default function PoliticaEditorialPage() {
  return (
    <InstitutionalShell
      title="Política editorial"
      description="Princípios editoriais do Crédito Por Perto."
      path="/politica-editorial/"
      intro="Estes princípios valem para todo conteúdo publicado no portal — e você pode nos cobrar por eles."
    >
      <h2>Independência</h2>
      <p>
        Nenhum parceiro comercial determina conclusões editoriais. Não aceitamos
        pagamento para recomendar instituições, ocultar riscos ou alterar
        análises. Quando houver publicidade ou conteúdo patrocinado, ele será
        identificado como tal — veja a{" "}
        <Link href="/politica-de-publicidade/">política de publicidade</Link>.
      </p>
      <h2>Precisão e fontes</h2>
      <ul>
        <li>Afirmações importantes têm fonte identificada e data de consulta;</li>
        <li>
          Priorizamos fontes oficiais (Banco Central, gov.br, legislação) e
          documentação primária das instituições;
        </li>
        <li>
          Taxas e condições nunca são apresentadas como universais: elas variam
          por instituição, perfil e momento;
        </li>
        <li>Não inventamos dados, estatísticas, especialistas ou depoimentos.</li>
      </ul>
      <h2>Linguagem responsável</h2>
      <p>
        Crédito envolve pessoas em situação de vulnerabilidade financeira. Por
        isso não usamos urgência artificial, promessas de aprovação, “dinheiro
        fácil” ou qualquer formulação que empurre o leitor para uma dívida. Os
        riscos aparecem antes das vantagens.
      </p>
      <h2>O que o portal não é</h2>
      <p>
        O Crédito Por Perto não é banco, financeira ou correspondente bancário.
        Não concedemos crédito, não recebemos propostas e não temos acesso a
        análises de crédito. Conteúdo educativo não substitui orientação
        financeira individual.
      </p>
      <h2>Correções</h2>
      <p>
        Erros acontecem — e são corrigidos de forma documentada, com registro da
        alteração. O processo está na{" "}
        <Link href="/politica-de-correcoes/">política de correções</Link>.
      </p>
      <h2>Originalidade</h2>
      <p>
        Cada página precisa ter uma razão própria para existir. Não publicamos
        variações do mesmo texto com palavras trocadas, nem conteúdo local que
        se resume a inserir o nome de uma cidade em um texto genérico. Nossa{" "}
        <Link href="/metodologia/">metodologia</Link> descreve as auditorias de
        originalidade que todo conteúdo atravessa antes de ir ao ar.
      </p>
    </InstitutionalShell>
  );
}
