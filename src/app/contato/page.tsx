import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { InstitutionalShell } from "@/components/layout/InstitutionalShell";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = buildMetadata({
  title: "Contato",
  description:
    "Fale com a equipe do Crédito Por Perto: correções, sugestões de pauta, dúvidas sobre o portal e solicitações relacionadas a dados pessoais.",
  path: "/contato/",
});

export default function ContatoPage() {
  return (
    <InstitutionalShell
      title="Contato"
      description="Canais de contato com a equipe editorial."
      path="/contato/"
      intro="Não analisamos propostas de empréstimo nem intermediamos crédito — mas queremos ouvir você sobre o conteúdo."
    >
      <h2>Assuntos que atendemos</h2>
      <ul>
        <li>
          <strong>Correções:</strong> indicação de erro ou informação
          desatualizada (veja a{" "}
          <Link href="/politica-de-correcoes/">política de correções</Link>);
        </li>
        <li>
          <strong>Sugestões de pauta:</strong> dúvidas sobre crédito que você
          gostaria de ver explicadas;
        </li>
        <li>
          <strong>Privacidade e dados pessoais:</strong> solicitações previstas
          na LGPD (veja a{" "}
          <Link href="/politica-de-privacidade/">política de privacidade</Link>);
        </li>
        <li>
          <strong>Imprensa e parcerias editoriais.</strong>
        </li>
      </ul>
      <h2>E-mail</h2>
      <p>
        Escreva para <strong>{CONTACT_EMAIL}</strong>.
      </p>
      <h2>O que não conseguimos atender</h2>
      <p>
        Não temos como analisar sua proposta de empréstimo, consultar seu CPF,
        aprovar crédito ou interceder junto a bancos. Se você suspeita de golpe,
        veja o guia{" "}
        <Link href="/credito-seguro/como-identificar-golpes-de-emprestimo/">
          como identificar golpes de empréstimo
        </Link>{" "}
        e procure os canais oficiais indicados lá.
      </p>
    </InstitutionalShell>
  );
}
