import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { InstitutionalShell } from "@/components/layout/InstitutionalShell";

export const metadata: Metadata = buildMetadata({
  title: "Acessibilidade",
  description:
    "Compromissos de acessibilidade do Crédito Por Perto: navegação por teclado, contraste, leitores de tela e como reportar barreiras de acesso.",
  path: "/acessibilidade/",
});

export default function AcessibilidadePage() {
  return (
    <InstitutionalShell
      title="Acessibilidade"
      description="Compromissos e recursos de acessibilidade do portal."
      path="/acessibilidade/"
      intro="Informação sobre crédito precisa estar ao alcance de todo mundo — inclusive de quem navega com teclado, leitor de tela ou baixa visão."
    >
      <h2>O que implementamos</h2>
      <ul>
        <li>HTML semântico, com hierarquia correta de títulos;</li>
        <li>Navegação completa por teclado, com foco visível;</li>
        <li>Link “Pular para o conteúdo” no início de cada página;</li>
        <li>Contraste de cores compatível com o nível AA das WCAG;</li>
        <li>Formulários com rótulos e mensagens de erro anunciadas;</li>
        <li>Tabelas com cabeçalhos adequados e rolagem em telas pequenas;</li>
        <li>Avisos que não dependem apenas de cor para serem compreendidos;</li>
        <li>Respeito à preferência de movimento reduzido do sistema.</li>
      </ul>
      <h2>Em evolução</h2>
      <p>
        Acessibilidade é processo contínuo. Testamos com ferramentas
        automatizadas e revisão manual, mas sabemos que barreiras podem escapar.
      </p>
      <h2>Encontrou uma barreira?</h2>
      <p>
        Se algo no portal dificultou seu acesso, por favor conte para a gente
        pela <Link href="/contato/">página de contato</Link>, descrevendo a
        página e a dificuldade. Tratamos esses relatos com prioridade.
      </p>
    </InstitutionalShell>
  );
}
