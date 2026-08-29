/**
 * TRANSFORMA A SEÇÃO DE PERGUNTAS FREQUENTES EM ACORDEÃO
 * ============================================================================
 *
 * As 87 páginas com FAQ (63 artigos + 24 guias locais) escrevem sempre o
 * mesmo padrão:
 *
 *     ## Perguntas frequentes
 *     ### A pergunta
 *     A resposta, em um ou mais parágrafos.
 *     ### Outra pergunta
 *     ...
 *
 * Renderizado como texto corrido, isso vira uma parede: em Barueri, seis
 * perguntas ocupam quase um terço da altura da página, e quem procura UMA
 * delas rola por todas as outras. O acordeão devolve o índice — só as
 * perguntas aparecem, e a resposta abre onde ela está.
 *
 * POR QUE UM PLUGIN, E NÃO REESCREVER OS ARQUIVOS
 *
 * A alternativa era trocar `###` por `<FaqItem>` em 87 arquivos. Isso
 * transformaria conteúdo em marcação: o autor passaria a escrever componente
 * em vez de texto, e a próxima FAQ nasceria com o formato errado se alguém
 * esquecesse. Aqui o autor continua escrevendo Markdown; a apresentação é
 * decidida na renderização, num lugar só, e vale automaticamente para toda
 * página futura.
 *
 * O QUE ESTE PLUGIN NÃO MUDA
 *
 * - O conteúdo continua no HTML servido. `<details>` fechado é conteúdo
 *   presente, não conteúdo removido — indexável e encontrável pela busca do
 *   navegador;
 * - a hierarquia de títulos permanece: cada pergunta continua sendo um `<h3>`
 *   com o mesmo id de antes, agora dentro do `<summary>` (o HTML permite
 *   heading dentro de summary). Âncora antiga continua funcionando;
 * - nada depende de JavaScript. `<details>` é elemento nativo, acessível por
 *   teclado e por leitor de tela sem uma linha de script.
 */
import { slugify } from "@/lib/text/slug";

/* Tipos mínimos do mdast — o suficiente para percorrer nós de bloco sem
   trazer dependência nova só para tipar um array. */
interface MdNode {
  type: string;
  depth?: number;
  value?: string;
  children?: MdNode[];
  name?: string;
  attributes?: Array<{ type: string; name: string; value: string }>;
  data?: unknown;
}

interface MdRoot {
  type: "root";
  children: MdNode[];
}

/** Título que abre a seção. Comparado sem acento e sem caixa. */
const FAQ_HEADING = "perguntas frequentes";

function plainText(node: MdNode): string {
  if (typeof node.value === "string") return node.value;
  if (!node.children) return "";
  return node.children.map(plainText).join("");
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

function jsxElement(
  name: string,
  attributes: Record<string, string>,
  children: MdNode[],
): MdNode {
  return {
    type: "mdxJsxFlowElement",
    name,
    attributes: Object.entries(attributes).map(([key, value]) => ({
      type: "mdxJsxAttribute",
      name: key,
      value,
    })),
    children,
  };
}

export function remarkFaqAccordion() {
  return (tree: MdRoot): void => {
    const nodes = tree.children;

    const start = nodes.findIndex(
      (node) =>
        node.type === "heading" &&
        node.depth === 2 &&
        normalize(plainText(node)) === FAQ_HEADING,
    );
    if (start === -1) return;

    /* A seção vai do H2 até o próximo título de mesmo nível ou acima. O que
       vier depois (outra seção, um componente de fechamento) fica intacto. */
    let end = nodes.length;
    for (let i = start + 1; i < nodes.length; i += 1) {
      const node = nodes[i]!;
      if (node.type === "heading" && (node.depth ?? 6) <= 2) {
        end = i;
        break;
      }
    }

    const body = nodes.slice(start + 1, end);

    /* Agrupa cada H3 com tudo que vem até o próximo H3. Conteúdo que apareça
       ANTES da primeira pergunta (uma frase de abertura, por exemplo) não é
       resposta de ninguém e é preservado fora do acordeão. */
    const intro: MdNode[] = [];
    const items: Array<{ question: string; answer: MdNode[] }> = [];

    for (const node of body) {
      if (node.type === "heading" && node.depth === 3) {
        items.push({ question: plainText(node).trim(), answer: [] });
        continue;
      }
      if (items.length === 0) intro.push(node);
      else items[items.length - 1]!.answer.push(node);
    }

    /* Sem perguntas no formato esperado, não há o que transformar — a seção
       fica exatamente como o autor escreveu. */
    if (items.length === 0) return;

    const accordion = jsxElement(
      "FaqAccordion",
      {},
      items.map((item) =>
        jsxElement(
          "FaqItem",
          { question: item.question, id: slugify(item.question) },
          item.answer,
        ),
      ),
    );

    tree.children = [
      ...nodes.slice(0, start + 1),
      ...intro,
      accordion,
      ...nodes.slice(end),
    ];
  };
}
