import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { InstitutionalShell } from "@/components/layout/InstitutionalShell";

export const metadata: Metadata = buildMetadata({
  title: "Sobre o Crédito por Perto",
  description:
    "O que é o Crédito por Perto, por que ele existe e o que você encontra (e não encontra) aqui: educação sobre crédito, sem concessão de empréstimos.",
  path: "/sobre/",
});

export default function SobrePage() {
  return (
    <InstitutionalShell
      title="Sobre o Crédito por Perto"
      description="O que é o Crédito por Perto e por que ele existe."
      path="/sobre/"
      intro="Ajudamos o consumidor a entender o crédito antes de assumir uma dívida."
    >
      <p>
        O Crédito por Perto é um portal editorial independente sobre
        empréstimos, juros e uso consciente do crédito no Brasil. Nascemos de
        uma constatação simples: a maioria das pessoas só descobre quanto um
        empréstimo realmente custa depois de assinar o contrato.
      </p>
      <h2>O que fazemos</h2>
      <ul>
        <li>
          Explicamos como cada modalidade de empréstimo funciona, com os custos
          e riscos colocados antes das vantagens;
        </li>
        <li>
          Mantemos <Link href="/calculadoras/">calculadoras educativas</Link>{" "}
          que mostram o efeito dos juros no valor total pago;
        </li>
        <li>
          Publicamos alertas sobre <Link href="/credito-seguro/">golpes de empréstimo</Link>{" "}
          e ensinamos a verificar se uma instituição é autorizada;
        </li>
        <li>
          Construímos guias locais com informação verificada sobre proteção ao
          consumidor em cada região.
        </li>
      </ul>
      <h2>O que não fazemos</h2>
      <ul>
        <li>Não concedemos, intermediamos nem aprovamos empréstimos;</li>
        <li>Não pedimos CPF, renda, documentos ou dados bancários;</li>
        <li>Não prometemos “crédito garantido” nem “dinheiro na hora”;</li>
        <li>
          Não recomendamos instituições em troca de pagamento — leia{" "}
          <Link href="/como-ganhamos-dinheiro/">como ganhamos dinheiro</Link>.
        </li>
      </ul>
      <h2>Como trabalhamos</h2>
      <p>
        Nosso processo editorial prioriza fontes oficiais — Banco Central,
        gov.br, legislação — e registra a data em que cada informação foi
        verificada. Os detalhes estão na{" "}
        <Link href="/politica-editorial/">política editorial</Link> e na{" "}
        <Link href="/metodologia/">metodologia</Link>. Erros são corrigidos de
        forma transparente, conforme a{" "}
        <Link href="/politica-de-correcoes/">política de correções</Link>.
      </p>
    </InstitutionalShell>
  );
}
