import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { InstitutionalShell } from "@/components/layout/InstitutionalShell";

export const metadata: Metadata = buildMetadata({
  title: "Política de correções",
  description:
    "Como o Crédito Por Perto trata erros: como reportar, prazos de análise, o que é corrigido com registro público e o que conta como atualização relevante.",
  path: "/politica-de-correcoes/",
});

export default function PoliticaDeCorrecoesPage() {
  return (
    <InstitutionalShell
      title="Política de correções"
      description="Como erros são reportados, corrigidos e documentados."
      path="/politica-de-correcoes/"
      intro="Conteúdo financeiro exige precisão. Quando erramos, corrigimos rápido e deixamos registro."
    >
      <h2>Como reportar um erro</h2>
      <p>
        Encontrou uma informação incorreta, desatualizada ou confusa? Envie a
        URL da página e a descrição do problema pela{" "}
        <Link href="/contato/">página de contato</Link>. Toda indicação é
        analisada pela equipe editorial.
      </p>
      <h2>O que corrigimos com registro</h2>
      <ul>
        <li>Erros factuais (regras, definições, funcionamento de modalidades);</li>
        <li>Informações desatualizadas por mudança regulatória;</li>
        <li>Erros de cálculo em exemplos ou ferramentas;</li>
        <li>Atribuições incorretas de fonte.</li>
      </ul>
      <p>
        Nesses casos, o conteúdo é corrigido e a data de atualização da página
        reflete a mudança. Correções substanciais recebem nota indicando o que
        mudou.
      </p>
      <h2>O que ajustamos sem nova data</h2>
      <p>
        Ajustes que não alteram o significado — ortografia, formatação, troca de
        componente visual — são feitos sem alterar a data de atualização, para
        que a data continue significando “revisão editorial real”, e não
        “mexemos em alguma vírgula”.
      </p>
      <h2>Compromisso</h2>
      <p>
        Não removemos silenciosamente afirmações erradas: corrigimos e, quando
        relevante para quem leu a versão anterior, explicamos a mudança.
      </p>
    </InstitutionalShell>
  );
}
