import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { CategoryHub } from "@/components/content/CategoryHub";

export const metadata: Metadata = buildMetadata({
  title: "Juros e CET: entenda o custo real de um empréstimo",
  description:
    "Juros simples e compostos, Custo Efetivo Total, IOF, amortização e conversão de taxas: aprenda a enxergar o custo completo antes de contratar crédito.",
  path: "/juros-e-cet/",
});

export default function JurosECetPage() {
  return (
    <CategoryHub
      category="juros-e-cet"
      intro="A taxa de juros anunciada quase nunca é o custo final de um empréstimo. Esta seção explica como juros, IOF, tarifas e seguros se combinam no Custo Efetivo Total (CET) — o único número que permite comparar propostas de verdade."
    />
  );
}
