import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { InstitutionalShell } from "@/components/layout/InstitutionalShell";
import { getAllAuthors } from "@/lib/content/authors";

export const metadata: Metadata = buildMetadata({
  title: "Quem somos: equipe, autoria e responsabilidade editorial",
  description:
    "Quem produz o Crédito Por Perto, como a equipe editorial trabalha, quando usamos IA e qual é a responsabilidade por trás de cada conteúdo publicado.",
  path: "/quem-somos/",
});

export default function QuemSomosPage() {
  const authors = getAllAuthors();
  return (
    <InstitutionalShell
      title="Quem somos"
      description="Equipe, autoria e responsabilidade editorial do Crédito Por Perto."
      path="/quem-somos/"
      intro="Transparência sobre quem escreve, como revisamos e onde estão os limites do nosso conteúdo."
    >
      <h2>Autoria e revisores</h2>
      {authors.map((author) => (
        <div key={author.id}>
          <h3>{author.name}</h3>
          <p>
            <strong>{author.role}.</strong> {author.bio}
          </p>
          {author.expertiseNote ? <p>{author.expertiseNote}</p> : null}
        </div>
      ))}
      <p>
        Ainda não contamos com um revisor financeiro certificado. Por isso,
        nenhum conteúdo do portal é apresentado como “revisado por
        especialista”: a revisão atual é editorial, e essa pendência está
        registrada publicamente. Quando houver revisão técnica especializada,
        ela será identificada com nome e credencial reais.
      </p>
      <h2>Como os conteúdos são pesquisados</h2>
      <p>
        Cada artigo parte de uma dúvida real de quem busca crédito. A pesquisa
        prioriza fontes oficiais e primárias — Banco Central do Brasil,
        legislação, gov.br, documentação das próprias instituições — antes de
        qualquer fonte comercial. Afirmações sobre taxas, limites e regras
        registram fonte e data da consulta.
      </p>
      <h2>Como ocorre a revisão</h2>
      <p>
        Antes de publicar, o conteúdo passa por checagem factual, verificação de
        originalidade e revisão editorial. Conteúdo que não cumpre os critérios
        permanece como rascunho. O fluxo completo está descrito na{" "}
        <Link href="/metodologia/">metodologia</Link>.
      </p>
      <h2>Quando usamos inteligência artificial</h2>
      <p>
        Utilizamos ferramentas de IA como apoio à produção — organização de
        rascunhos, revisão de clareza e estruturação de dados. Nenhum conteúdo é
        publicado sem verificação e revisão editorial humana das afirmações
        factuais, e a responsabilidade editorial é sempre nossa, nunca da
        ferramenta.
      </p>
      <h2>Responsabilidade editorial</h2>
      <p>
        O conteúdo do portal é educativo e não substitui orientação financeira
        individual. Não conhecemos a sua situação: antes de contratar qualquer
        crédito, confirme as condições com a instituição e, se possível, busque
        orientação personalizada. Encontrou um erro? Veja como reportar na{" "}
        <Link href="/politica-de-correcoes/">política de correções</Link>.
      </p>
    </InstitutionalShell>
  );
}
