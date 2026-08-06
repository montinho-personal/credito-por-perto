import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { CategoryHub } from "@/components/content/CategoryHub";

export const metadata: Metadata = buildMetadata({
  title: "Organização financeira: decidir sobre crédito com o orçamento real",
  description:
    "Quando um empréstimo faz sentido, quando evitar, como planejar parcelas e como avaliar renegociação ou troca de dívida cara por dívida mais barata.",
  path: "/organizacao-financeira/",
});

export default function OrganizacaoFinanceiraPage() {
  return (
    <CategoryHub
      category="organizacao-financeira"
      intro="Crédito é ferramenta, não solução mágica. Esta seção ajuda você a decidir se um empréstimo cabe no orçamento, comparar alternativas como renegociação e planejar parcelas sem comprometer o essencial."
    />
  );
}
