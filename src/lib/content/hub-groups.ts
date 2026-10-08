/**
 * BLOCOS DOS HUBS DE CATEGORIA
 *
 * A grade única de cartões, ordenada por data, deixava 30+ guias sem
 * nenhuma ordem de leitura: quem procurava "consignado" tinha de varrer a
 * página inteira. Aqui cada hub declara seus blocos, na ordem em que o
 * leitor costuma precisar deles.
 *
 * Regras:
 * - um guia aparece em UM bloco só (o teste confere);
 * - guia publicado que não estiver listado cai em "Outros guias", no fim.
 *   Nenhum guia novo some do hub por esquecimento — ele só aparece no
 *   bloco genérico até alguém escolher o lugar dele;
 * - slug listado que não existe (ou não está publicado) é ignorado na
 *   renderização e acusado no teste.
 */
import type { CategoryId } from "@/lib/content/categories";

export interface HubGroup {
  id: string;
  title: string;
  intro?: string;
  slugs: readonly string[];
}

export const HUB_GROUPS: Record<CategoryId, readonly HubGroup[]> = {
  emprestimos: [
    {
      id: "modalidades",
      title: "As modalidades, uma a uma",
      slugs: [
        "emprestimo-pessoal",
        "emprestimo-consignado",
        "emprestimo-com-garantia",
        "emprestimo-com-garantia-de-celular",
        "antecipacao-saque-aniversario-fgts",
        "antecipacao-do-13-salario",
        "cartao-de-credito-consignado",
        "financiamento-de-veiculo",
        "emprestimo-na-hora",
        "cooperativa-de-credito",
      ],
    },
    {
      id: "consignado",
      title: "Consignado: INSS, CLT e servidor",
      slugs: [
        "credito-do-trabalhador",
        "emprestimo-para-aposentado-inss",
        "consignado-para-quem-recebe-bpc",
        "consignado-servidor-publico",
        "margem-consignavel",
        "refinanciamento-de-consignado",
        "rmc-rcc-como-cancelar",
      ],
    },
    {
      id: "perfis",
      title: "Por perfil e programas públicos",
      slugs: [
        "emprestimo-para-negativado",
        "emprestimo-para-mei",
        "emprestimo-para-autonomo",
        "emprestimo-do-governo",
        "microcredito-produtivo-e-banco-do-povo",
        "antecipacao-de-recebiveis",
        "credito-rural-e-pronaf",
        "fies-financiamento-estudantil",
      ],
    },
    {
      id: "decidir",
      title: "Antes de contratar",
      slugs: [
        "guia-completo-de-emprestimo",
        "diferenca-entre-emprestimo-e-financiamento",
        "como-funciona-analise-de-credito",
        "documentos-para-emprestimo",
        "emprestimo-negado-o-que-fazer",
        "consorcio-ou-emprestimo",
        "portabilidade-de-credito",
        "saque-aniversario-vale-a-pena",
        "leilao-extrajudicial-imovel-em-garantia",
      ],
    },
  ],
  "credito-seguro": [
    {
      id: "golpes",
      title: "Golpes de empréstimo",
      slugs: [
        "como-identificar-golpes-de-emprestimo",
        "deposito-antecipado-e-golpe",
        "golpe-da-falsa-central",
        "emprestimo-caiu-na-conta-sem-pedir",
        "emprestimo-sem-consulta",
        "desconto-nao-autorizado-inss",
        "agiota-e-emprestimo-informal",
      ],
    },
    {
      id: "verificar",
      title: "Como verificar antes de contratar",
      slugs: [
        "como-consultar-se-instituicao-e-autorizada",
        "app-de-emprestimo-e-confiavel",
        "consultar-nome-nos-biros-de-credito",
        "como-consultar-dividas-no-registrato",
        "open-finance-e-credito",
      ],
    },
  ],
  "juros-e-cet": [
    {
      id: "custo",
      title: "Quanto o crédito custa de verdade",
      slugs: [
        "o-que-e-cet",
        "como-calcular-juros-de-emprestimo",
        "taxa-mensal-e-taxa-anual",
        "iof-no-emprestimo",
        "seguro-prestamista",
        "price-ou-sac-sistemas-de-amortizacao",
      ],
    },
    {
      id: "comparar",
      title: "Comparar e reduzir juros",
      slugs: [
        "como-consultar-taxa-media-do-bc",
        "juros-abusivos-como-saber",
        "quitacao-antecipada-de-emprestimo",
        "juros-do-cheque-especial",
        "pix-parcelado",
      ],
    },
  ],
  "organizacao-financeira": [
    {
      id: "decidir",
      title: "Decidir antes de pegar crédito",
      slugs: [
        "quando-vale-a-pena-fazer-emprestimo",
        "dinheiro-urgente",
        "como-comparar-propostas-de-credito",
        "renegociacao-ou-emprestimo",
        "quanto-da-renda-comprometer-financiamento-imovel",
        "emprestar-o-nome",
        "fiador-ou-avalista",
      ],
    },
    {
      id: "orcamento",
      title: "Orçamento, conta e cartão",
      slugs: [
        "como-fazer-orcamento-pessoal",
        "reserva-de-emergencia",
        "fatura-do-cartao-como-funciona",
        "carne-e-crediario-de-loja",
        "tarifas-bancarias-gratuitas",
        "portabilidade-de-salario",
        "score-de-credito",
        "titulo-de-capitalizacao",
        "perdeu-o-emprego-o-que-receber",
      ],
    },
    {
      id: "dividas",
      title: "Dívidas: sair, negociar e seus direitos",
      slugs: [
        "como-sair-das-dividas",
        "qual-divida-pagar-primeiro",
        "como-negociar-dividas",
        "como-sair-do-rotativo",
        "lei-do-superendividamento",
        "o-que-acontece-ao-atrasar-parcela",
        "cobranca-abusiva-o-que-o-credor-nao-pode-fazer",
        "protesto-em-cartorio",
        "divida-caducada-nome-limpo",
        "o-que-pode-ser-penhorado",
        "conta-de-luz-atrasada-corte",
        "divida-de-pessoa-falecida",
      ],
    },
  ],
};

export const OTHER_GROUP_TITLE = "Outros guias";

export interface ResolvedGroup<T> {
  id: string;
  title: string;
  intro?: string;
  items: T[];
}

/**
 * Distribui os guias publicados nos blocos do hub, na ordem declarada.
 * O que não foi listado vai para "Outros guias", na ordem recebida.
 */
export function groupForHub<T extends { frontmatter: { slug: string } }>(
  category: CategoryId,
  articles: readonly T[],
): ResolvedGroup<T>[] {
  const bySlug = new Map(articles.map((a) => [a.frontmatter.slug, a]));
  const used = new Set<string>();
  const groups: ResolvedGroup<T>[] = [];
  for (const g of HUB_GROUPS[category]) {
    const items = g.slugs.flatMap((s) => {
      const a = bySlug.get(s);
      if (!a || used.has(s)) return [];
      used.add(s);
      return [a];
    });
    if (items.length) groups.push({ id: g.id, title: g.title, intro: g.intro, items });
  }
  const rest = articles.filter((a) => !used.has(a.frontmatter.slug));
  if (rest.length) groups.push({ id: "outros-guias", title: OTHER_GROUP_TITLE, items: [...rest] });
  return groups;
}
