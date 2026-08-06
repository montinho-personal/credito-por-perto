export type CategoryId =
  | "emprestimos"
  | "juros-e-cet"
  | "credito-seguro"
  | "organizacao-financeira";

export interface CategoryDef {
  id: CategoryId;
  label: string;
  basePath: `/${string}/`;
  description: string;
}

export const CATEGORIES: Record<CategoryId, CategoryDef> = {
  emprestimos: {
    id: "emprestimos",
    label: "Empréstimos",
    basePath: "/emprestimos/",
    description:
      "Guias sobre as principais modalidades de empréstimo: como funcionam, quanto custam e o que comparar antes de contratar.",
  },
  "juros-e-cet": {
    id: "juros-e-cet",
    label: "Juros e CET",
    basePath: "/juros-e-cet/",
    description:
      "Explicações sobre juros, Custo Efetivo Total, IOF, amortização e como comparar o custo real de um crédito.",
  },
  "credito-seguro": {
    id: "credito-seguro",
    label: "Crédito seguro",
    basePath: "/credito-seguro/",
    description:
      "Como identificar golpes de empréstimo, verificar instituições autorizadas e proteger seus dados ao contratar crédito.",
  },
  "organizacao-financeira": {
    id: "organizacao-financeira",
    label: "Organização financeira",
    basePath: "/organizacao-financeira/",
    description:
      "Quando um empréstimo pode fazer sentido, quando evitar e como planejar parcelas dentro do orçamento.",
  },
};

export function categoryById(id: string): CategoryDef | undefined {
  return (CATEGORIES as Record<string, CategoryDef>)[id];
}
