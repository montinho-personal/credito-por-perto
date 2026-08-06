import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import { CategoryHub } from "@/components/content/CategoryHub";

export const metadata: Metadata = buildMetadata({
  title: "Crédito seguro: como se proteger de golpes de empréstimo",
  description:
    "Golpe do depósito antecipado, falsos correspondentes, sites clonados: aprenda a reconhecer fraudes, verificar instituições autorizadas e proteger seus dados.",
  path: "/credito-seguro/",
});

export default function CreditoSeguroPage() {
  return (
    <CategoryHub
      category="credito-seguro"
      intro="Golpes de empréstimo seguem roteiros conhecidos — e quase todos podem ser evitados com poucas verificações antes de assinar ou pagar qualquer coisa. Aqui você aprende a reconhecer os sinais e a checar se uma instituição é autorizada a operar."
    />
  );
}
