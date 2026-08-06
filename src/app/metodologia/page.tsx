import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { InstitutionalShell } from "@/components/layout/InstitutionalShell";

export const metadata: Metadata = buildMetadata({
  title: "Metodologia de produção e revisão",
  description:
    "O passo a passo que cada conteúdo do Crédito por Perto percorre: pesquisa de fontes, briefing, redação, checagem factual, auditorias e revisão editorial.",
  path: "/metodologia/",
});

export default function MetodologiaPage() {
  return (
    <InstitutionalShell
      title="Metodologia de produção e revisão"
      description="Como cada conteúdo é produzido, verificado e mantido."
      path="/metodologia/"
      intro="Do briefing à atualização: o caminho que todo conteúdo percorre antes e depois de ser publicado."
    >
      <h2>1. Definição da intenção</h2>
      <p>
        Todo conteúdo começa com uma pergunta: qual dúvida específica esta
        página resolve, e por que ela deve existir separada das demais? Se já
        existe uma página respondendo à mesma intenção de busca, atualizamos a
        existente em vez de criar uma concorrente.
      </p>
      <h2>2. Pesquisa e briefing</h2>
      <p>
        Antes da redação, registramos um briefing com a intenção principal, o
        ângulo próprio do conteúdo, as fontes primárias a consultar e o que ele
        oferece que as outras páginas não oferecem. A pesquisa prioriza fontes
        na seguinte ordem: órgãos oficiais e legislação; documentação primária
        das instituições; fontes secundárias reconhecidas; e, por último,
        conteúdo comercial — usado apenas para entender o mercado, nunca como
        fonte final de uma afirmação.
      </p>
      <h2>3. Redação e checagem factual</h2>
      <p>
        A redação usa palavras próprias, exemplos próprios e estrutura definida
        pela necessidade do leitor. Cada afirmação sobre taxas, regras ou
        programas é registrada com fonte e data de consulta. Números que mudam
        com o tempo recebem a indicação de que podem mudar.
      </p>
      <h2>4. Auditorias antes da publicação</h2>
      <ul>
        <li>
          <strong>Originalidade:</strong> comparação automática com todo o
          conteúdo já publicado para impedir textos-molde, introduções repetidas
          e páginas quase idênticas;
        </li>
        <li>
          <strong>Canibalização:</strong> verificação de que a nova página não
          disputa a mesma busca com uma página existente;
        </li>
        <li>
          <strong>Metadados e canonical:</strong> título, descrição e URL únicos
          e coerentes;
        </li>
        <li>
          <strong>Revisão editorial humana:</strong> conteúdo financeiro não vai
          direto do rascunho para o ar.
        </li>
      </ul>
      <h2>5. Publicação e monitoramento</h2>
      <p>
        Publicamos em lotes controlados e acompanhamos se o conteúdo está
        cumprindo sua função. A data de atualização só muda quando há alteração
        editorial relevante — nunca por ajustes visuais ou de infraestrutura.
      </p>
      <h2>6. Atualização e correção</h2>
      <p>
        Conteúdos com informações que envelhecem recebem verificação periódica,
        com a data da última checagem visível na página. Correções relevantes
        são documentadas.
      </p>
      <h2>Guias locais</h2>
      <p>
        Páginas locais seguem um critério adicional: só são publicadas quando
        trazem valor local real e verificado — canais de proteção ao consumidor
        da região, atendimento confirmado, programas públicos vigentes. Um guia
        local nunca é um texto genérico com o nome da cidade trocado; quando não
        conseguimos verificar as informações locais, o guia simplesmente não é
        publicado.
      </p>
    </InstitutionalShell>
  );
}
