/**
 * EVENTOS DA CENTRAL DE DECISÕES
 * ============================================================================
 *
 * Medimos NAVEGAÇÃO, nunca SITUAÇÃO FINANCEIRA.
 *
 * A diferença é sutil e decide tudo. Enviar `decision_path_start` com
 * `journey: "varias-dividas"` mede que um caminho foi escolhido — é um dado
 * de produto, agregado, que responde "as pessoas encontram o caminho?".
 * Enviar `user_financial_state: "endividado"` como propriedade de usuário
 * seria outra coisa: um rótulo persistente, colado à pessoa, num relatório
 * que ninguém revisa. A segunda coisa não é feita aqui, e a distinção está
 * escrita para que não se perca numa refatoração futura:
 *
 * - NADA vai como `user_property`. Todos os eventos são de EVENTO, sem
 *   persistência entre sessões;
 * - NENHUM parâmetro carrega valor digitado. Não há renda, saldo, taxa,
 *   parcela, prazo, cidade ou nome de instituição em nenhum evento;
 * - o id da jornada é um id de conteúdo, do mesmo tipo que o caminho de uma
 *   página — e ele já apareceria no relatório de páginas se a jornada tivesse
 *   URL própria.
 *
 * As ferramentas mantêm os próprios eventos, com o mesmo contrato.
 */

import { track } from "@/lib/analytics/track";

/** Alguém abriu a Central. */
export function trackHubView() {
  track("decision_hub_view");
}

/** Um momento foi escolhido — começo de caminho. */
export function trackPathStart(journeyId: string) {
  track("decision_path_start", { journey: journeyId });
}

/** Um passo entrou em tela dentro da Central. */
export function trackStepView(journeyId: string, stepId: string) {
  track("decision_step_view", { journey: journeyId, step: stepId });
}

/** A pessoa saiu da Central em direção a uma ferramenta ou conteúdo. */
export function trackToolOpen(journeyId: string | null, targetId: string) {
  track("decision_tool_open", {
    journey: journeyId ?? "sem_jornada",
    target: targetId,
  });
}

/** Um passo foi explicitamente pulado. */
export function trackStepSkip(journeyId: string, stepId: string) {
  track("decision_step_skip", { journey: journeyId, step: stepId });
}

/** A pessoa encerrou por conta própria — desfecho legítimo, não abandono. */
export function trackPathComplete(journeyId: string, reason: "fim" | "encerrou") {
  track("decision_path_complete", { journey: journeyId, reason });
}

/** Progresso apagado pela própria pessoa. */
export function trackRestart(journeyId: string | null) {
  track("decision_restart", { journey: journeyId ?? "sem_jornada" });
}

/** Porta 2: quem já sabe o que procura foi ao catálogo. */
export function trackAllToolsOpen(source: "hub" | "home" | "menu") {
  track("all_tools_open", { source });
}

/** Clique num próximo passo sugerido no fim de uma ferramenta. */
export function trackNextStepClick(
  fromToolId: string,
  targetId: string,
  rank: "primary" | "secondary",
) {
  track("decision_next_step_click", {
    from_tool: fromToolId,
    target: targetId,
    rank,
  });
}
