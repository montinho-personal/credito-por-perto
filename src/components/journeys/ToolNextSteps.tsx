/**
 * Ponte entre a página da ferramenta (servidor) e o painel de próximo passo
 * (cliente).
 *
 * A página só escreve `<ToolNextSteps toolId="minha-taxa-esta-cara" />`. O
 * retrato dos registries e a primeira sugestão são calculados aqui, no build,
 * e viajam prontos — o navegador não precisa carregar registry nenhum para
 * mostrar o bloco, e um `toolId` errado quebra o build em vez de virar um
 * bloco vazio em produção.
 */
import { buildNextStepSnapshot } from "@/lib/journeys/next-step";
import { selectNextStep } from "@/lib/journeys/next-step-core";
import { NextStepPanel } from "@/components/journeys/NextStepPanel";

export function ToolNextSteps({ toolId }: { toolId: string }) {
  const snapshot = buildNextStepSnapshot(toolId);
  const initial = selectNextStep(snapshot, {});
  return <NextStepPanel snapshot={snapshot} initial={initial} />;
}
