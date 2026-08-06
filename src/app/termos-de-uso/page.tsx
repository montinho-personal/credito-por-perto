import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import {
  InstitutionalShell,
  LegalTemplateNotice,
} from "@/components/layout/InstitutionalShell";
import { LEGAL_OWNER } from "@/lib/site";

export const metadata: Metadata = buildMetadata({
  title: "Termos de uso",
  description:
    "Condições de uso do Crédito Por Perto: natureza educativa do conteúdo, propriedade intelectual, limitações de responsabilidade e regras de utilização.",
  path: "/termos-de-uso/",
});

// TEMPLATE LEGAL — pendente de revisão jurídica e preenchimento dos dados do
// responsável. Ver PENDENCIAS_CRITICAS.md.
export default function TermosDeUsoPage() {
  return (
    <InstitutionalShell
      title="Termos de uso"
      description="Condições para utilização do portal."
      path="/termos-de-uso/"
    >
      <LegalTemplateNotice />
      <h2>1. Natureza do serviço</h2>
      <p>
        O Crédito Por Perto é um portal de conteúdo educativo sobre crédito e
        finanças pessoais, mantido por {LEGAL_OWNER.name} (CPF{" "}
        {LEGAL_OWNER.cpfMasked}). O portal <strong>não é</strong> instituição
        financeira, correspondente bancário ou intermediador de crédito, e
        nenhuma informação publicada constitui oferta, recomendação individual
        ou garantia de condições de empréstimo.
      </p>
      <h2>2. Uso das informações</h2>
      <p>
        As informações refletem o entendimento editorial na data indicada em
        cada conteúdo e podem mudar. Antes de contratar qualquer produto
        financeiro, confirme as condições vigentes com a instituição e nas
        fontes oficiais. Decisões tomadas com base no conteúdo são de
        responsabilidade de quem as toma.
      </p>
      <h2>3. Calculadoras</h2>
      <p>
        As calculadoras produzem estimativas educativas, sem valor contratual. O
        custo real de uma operação depende do CET e das condições da
        instituição.
      </p>
      <h2>4. Propriedade intelectual</h2>
      <p>
        Textos, ilustrações, marca e demais elementos do portal são protegidos
        por direitos autorais. É permitido citar trechos com atribuição e link;
        não é permitida a reprodução integral sem autorização.
      </p>
      <h2>5. Conduta do usuário</h2>
      <p>
        É vedado utilizar o portal para atividades ilícitas, tentar comprometer
        sua segurança ou extrair conteúdo de forma automatizada e massiva.
      </p>
      <h2>6. Alterações</h2>
      <p>
        Estes termos podem ser atualizados. A versão vigente estará sempre nesta
        página. Dúvidas? Fale <Link href="/contato/">conosco</Link>.
      </p>
    </InstitutionalShell>
  );
}
