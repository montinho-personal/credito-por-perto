import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import {
  InstitutionalShell,
  LegalTemplateNotice,
} from "@/components/layout/InstitutionalShell";
import { LEGAL_OWNER } from "@/lib/site";

export const metadata: Metadata = buildMetadata({
  title: "Aviso legal",
  description:
    "Aviso legal do Crédito Por Perto: portal educativo que não concede crédito, não solicita depósitos e não garante condições de empréstimo.",
  path: "/aviso-legal/",
});

// TEMPLATE LEGAL — pendente de revisão jurídica. Ver PENDENCIAS_CRITICAS.md.
export default function AvisoLegalPage() {
  return (
    <InstitutionalShell
      title="Aviso legal"
      description="Limites e responsabilidades do conteúdo do portal."
      path="/aviso-legal/"
    >
      <LegalTemplateNotice />
      <h2>Responsável pelo portal</h2>
      <p>
        O Crédito Por Perto é mantido por <strong>{LEGAL_OWNER.name}</strong>{" "}
        (CPF {LEGAL_OWNER.cpfMasked}), {LEGAL_OWNER.address}. Contato:{" "}
        <strong>{LEGAL_OWNER.email}</strong>.
      </p>
      <h2>Conteúdo educativo</h2>
      <p>
        Todo o conteúdo do Crédito Por Perto tem finalidade informativa e
        educacional. Ele não constitui consultoria financeira, jurídica ou
        contábil, nem recomendação individual de contratação de crédito.
      </p>
      <h2>O portal não concede crédito</h2>
      <p>
        O Crédito Por Perto não é instituição autorizada pelo Banco Central, não
        opera como correspondente bancário, não recebe propostas, não analisa
        crédito e não solicita qualquer pagamento, depósito ou dado bancário de
        leitores. Se alguém pedir dinheiro ou dados em nome do portal para
        “liberar um empréstimo”, trata-se de golpe —{" "}
        <Link href="/credito-seguro/como-identificar-golpes-de-emprestimo/">
          saiba como agir
        </Link>
        .
      </p>
      <h2>Taxas e condições</h2>
      <p>
        Taxas, limites, margens e regras citados em conteúdos refletem fontes
        consultadas nas datas indicadas e podem mudar sem aviso. Nenhum valor
        apresentado é promessa ou garantia de condição disponível para você.
      </p>
      <h2>Links externos</h2>
      <p>
        Links para sites de terceiros (inclusive órgãos oficiais) são oferecidos
        como conveniência; não controlamos e não nos responsabilizamos pelo
        conteúdo desses sites.
      </p>
      <h2>Marcas citadas</h2>
      <p>
        Nomes de instituições e marcas eventualmente citados pertencem aos seus
        titulares e são usados apenas em contexto informativo, sem implicar
        vínculo ou endosso.
      </p>
    </InstitutionalShell>
  );
}
