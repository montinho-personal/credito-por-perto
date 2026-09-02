/**
 * DICIONÁRIO DE EVENTOS
 * ============================================================================
 *
 * Uma lista, um lugar. Todo evento que o site envia está aqui declarado, com
 * nome, grupo, o que significa e quais parâmetros pode carregar.
 *
 * POR QUE UM REGISTRO, E NÃO SÓ CHAMADAS ESPALHADAS
 *
 * Antes deste arquivo havia 84 eventos e 14 cópias do mesmo helper `gtag`,
 * cada uma em seu componente. Funcionava — e era impossível responder a três
 * perguntas que decidem se a medição serve para alguma coisa:
 *
 *   1. quais eventos existem? (a resposta era um `grep`, e o `grep` errava:
 *      `renegotiation_${target}_click` gerava cinco nomes que não apareciam
 *      em busca nenhuma);
 *   2. algum evento parou de disparar? (nada avisava);
 *   3. o que precisa ser configurado no GA4? (ninguém sabia sem ler o código).
 *
 * Com o registro, `pnpm audit:analytics` responde as três: compara o que o
 * código dispara com o que está declarado e reclama dos dois lados — evento
 * disparado sem declaração e evento declarado que ninguém dispara.
 *
 * LIMITE QUE JUSTIFICA A DISCIPLINA
 *
 * O GA4 aceita 500 nomes de evento por propriedade, e o nome, uma vez criado,
 * não se apaga. Por isso a modelagem aqui é "poucos nomes, parâmetros ricos":
 * um `nav_click` com `area=rodape` vale mais que `footer_link_click`, porque
 * permite comparar áreas no mesmo relatório em vez de somar nomes à mão.
 */

export type EventGroup =
  | "navegacao"
  | "saida"
  | "conteudo"
  | "busca"
  | "central"
  | "ferramenta"
  | "consentimento";

export interface EventSpec {
  /** Nome enviado ao GA4. Imutável depois de publicado. */
  name: string;
  group: EventGroup;
  /** O que o evento significa, em uma frase. Vai para a documentação. */
  description: string;
  /** Parâmetros aceitos. Qualquer outro é recusado pela auditoria. */
  params: readonly string[];
  /**
   * Candidato a "evento principal" no GA4. Num portal que não vende nada,
   * conversão é a pessoa chegar a uma ferramenta ou a um canal oficial.
   */
  keyEvent?: boolean;
}

/**
 * Parâmetros comuns a todo clique instrumentado por delegação. Declarados uma
 * vez para não divergirem entre eventos.
 */
export const CLICK_PARAMS = [
  "area",
  "component",
  "label",
  "to_path",
  "page_type",
  "position",
] as const;

const NAV_EVENTS: EventSpec[] = [
  {
    name: "nav_click",
    group: "navegacao",
    description:
      "Clique em navegação estrutural: cabeçalho, rodapé, menu do celular, trilha de migalhas e mapa do site.",
    params: CLICK_PARAMS,
  },
  {
    name: "cta_click",
    group: "navegacao",
    description:
      "Clique num destino oferecido pelo site: card de ferramenta, chamada de jornada, artigo relacionado, botão de calculadora dentro de conteúdo.",
    params: CLICK_PARAMS,
    keyEvent: true,
  },
  {
    name: "content_link_click",
    group: "conteudo",
    description:
      "Clique num link interno dentro do corpo do texto — o link que o próprio parágrafo ofereceu.",
    params: CLICK_PARAMS,
  },
  {
    name: "anchor_click",
    group: "conteudo",
    description:
      "Salto para uma âncora da mesma página (índice, sumário, referência de fonte).",
    params: CLICK_PARAMS,
  },
];

const EXIT_EVENTS: EventSpec[] = [
  {
    name: "outbound_click",
    group: "saida",
    description:
      "Saída para domínio externo. Num portal que não vende nada, é o desfecho que mais importa: a pessoa chegou à fonte oficial (Banco Central, gov.br, Procon, tribunal).",
    params: [...CLICK_PARAMS, "domain", "destination"],
    keyEvent: true,
  },
  {
    name: "contact_click",
    group: "saida",
    description:
      "Clique em canal de contato direto: e-mail, telefone ou WhatsApp. Registra o canal, nunca o número nem o endereço.",
    params: [...CLICK_PARAMS, "channel"],
    keyEvent: true,
  },
];

const CONTENT_EVENTS: EventSpec[] = [
  {
    name: "faq_open",
    group: "conteudo",
    description:
      "Uma pergunta do FAQ foi aberta. Mede qual dúvida a página realmente resolve, e não apenas quantas foram exibidas.",
    params: ["question", "page_type", "position"],
  },
  {
    name: "media_interact",
    group: "conteudo",
    description:
      "Interação com mídia do conteúdo: ampliar uma imagem ou dar play num vídeo incorporado.",
    params: ["action", "component", "label", "page_type"],
  },
];

const CONSENT_EVENTS: EventSpec[] = [
  {
    name: "consent_choice",
    group: "consentimento",
    description:
      "Resposta ao banner de cookies. Só o 'Aceitar' chega ao GA4 (sem consentimento não há script); serve para medir a taxa de aceite sobre sessões, não para perseguir quem recusou.",
    params: ["choice"],
  },
];

const SEARCH_EVENTS: EventSpec[] = [
  {
    name: "search_open",
    group: "busca",
    description:
      "A busca foi aberta, pelo cabeçalho ou pela página de busca. Mede a intenção de procurar, separada de ter procurado.",
    params: ["source"],
  },
  {
    name: "search_performed",
    group: "busca",
    description:
      "Uma consulta foi executada, com a contagem de resultados devolvidos. O termo digitado não é enviado.",
    params: ["source", "results_count", "query_length"],
  },
  {
    name: "search_no_results",
    group: "busca",
    description:
      "A consulta não devolveu nada. É pauta editorial em estado bruto: alguém procurou no site algo que o site não tem.",
    params: ["source"],
  },
  {
    name: "search_result_click",
    group: "busca",
    description:
      "Um resultado da busca foi escolhido, com a posição na lista. Posição alta e clique baixo indicam ordenação ruim, não conteúdo ruim.",
    params: ["source", "result_position", "result_type"],
    keyEvent: true,
  },
];

const DECISION_EVENTS: EventSpec[] = [
  {
    name: "decision_hub_view",
    group: "central",
    description:
      "A Central de Decisões foi aberta. É o denominador do funil: tudo o mais se mede sobre este número.",
    params: [],
  },
  {
    name: "decision_path_start",
    group: "central",
    description:
      "Um momento financeiro foi escolhido na Central — o começo de um caminho. O id da jornada é conteúdo, não rótulo de pessoa.",
    params: ["journey"],
  },
  {
    name: "decision_step_view",
    group: "central",
    description:
      "Um passo do caminho entrou em tela dentro da Central, sem que a pessoa tenha saído para uma ferramenta.",
    params: ["journey", "step"],
  },
  {
    name: "decision_tool_open",
    group: "central",
    description:
      "A pessoa saiu da Central em direção a uma ferramenta ou a um conteúdo. É o desfecho que a Central existe para produzir.",
    params: ["journey", "target"],
    keyEvent: true,
  },
  {
    name: "decision_step_skip",
    group: "central",
    description:
      "Um passo foi explicitamente pulado. Pular muito num mesmo ponto costuma dizer que o passo está no lugar errado do caminho.",
    params: ["journey", "step"],
  },
  {
    name: "decision_path_complete",
    group: "central",
    description:
      "O caminho foi encerrado pela própria pessoa. É desfecho legítimo, não abandono: resolver na primeira ferramenta é o melhor resultado possível.",
    params: ["journey", "reason"],
  },
  {
    name: "decision_next_step_click",
    group: "central",
    description:
      "Um próximo passo sugerido no fim de uma ferramenta foi clicado, com o posto que ele ocupava na sugestão.",
    params: ["from_tool", "target", "rank"],
    keyEvent: true,
  },
  {
    name: "decision_restart",
    group: "central",
    description:
      "A pessoa apagou o próprio progresso na Central. Registrado como escolha dela, e não como falha do caminho.",
    params: ["journey"],
  },
  {
    name: "all_tools_open",
    group: "central",
    description:
      "O catálogo completo de ferramentas foi aberto — a porta de quem já sabe o que procura e não quer o caminho guiado.",
    params: ["source"],
  },
];

/**
 * Eventos das 14 ferramentas. Os nomes vinham de antes deste registro e foram
 * mantidos: renomear apagaria o histórico já acumulado no GA4 sem ganho real.
 *
 * A única exceção está anotada em `renegotiation_tool_click`.
 */
const TOOL_EVENTS: EventSpec[] = [
  /* Comparador de propostas */
  { name: "credit_compare_start", group: "ferramenta", description: "Comparador de propostas: primeira interação.", params: [] },
  { name: "credit_compare_complete", group: "ferramenta", description: "Comparador de propostas: resultado calculado.", params: ["proposals", "cet_informed", "advanced_used", "example_used"], keyEvent: true },
  { name: "credit_compare_add_third", group: "ferramenta", description: "Comparador: terceira proposta adicionada.", params: [] },
  { name: "credit_compare_copy_summary", group: "ferramenta", description: "Comparador: resumo copiado.", params: [] },
  { name: "credit_compare_scam_warning_view", group: "ferramenta", description: "Comparador: aviso de golpe exibido.", params: [] },

  /* Minha taxa está cara? */
  { name: "rate_compare_start", group: "ferramenta", description: "Minha taxa está cara?: primeira interação.", params: [] },
  { name: "rate_compare_cet_informed", group: "ferramenta", description: "Minha taxa está cara?: CET informado em vez de juros.", params: [] },
  { name: "rate_compare_complete", group: "ferramenta", description: "Minha taxa está cara?: comparação concluída.", params: ["family", "unit", "outcome"], keyEvent: true },
  { name: "rate_compare_bcb_source_click", group: "ferramenta", description: "Minha taxa está cara?: ida à série do Banco Central.", params: [] },

  /* Conversor de taxa */
  { name: "rate_converter_start", group: "ferramenta", description: "Conversor de taxa: primeira interação.", params: [] },
  { name: "rate_converter_complete", group: "ferramenta", description: "Conversor de taxa: conversão feita.", params: [], keyEvent: true },
  { name: "rate_converter_direction_change", group: "ferramenta", description: "Conversor: sentido invertido (mensal ↔ anual).", params: [] },
  { name: "rate_converter_explanation_open", group: "ferramenta", description: "Conversor: explicação da fórmula aberta.", params: [] },
  { name: "rate_converter_comparator_click", group: "ferramenta", description: "Conversor: saída para o comparador.", params: [] },
  { name: "rate_converter_bcb_tool_click", group: "ferramenta", description: "Conversor: saída para a ferramenta de taxa.", params: [] },

  /* Sinais de golpe */
  { name: "fraud_check_start", group: "ferramenta", description: "Verificação de golpe: primeira resposta.", params: [] },
  { name: "fraud_check_complete", group: "ferramenta", description: "Verificação de golpe: veredito exibido.", params: ["level"], keyEvent: true },
  { name: "fraud_check_bcb_click", group: "ferramenta", description: "Verificação de golpe: ida à consulta do Banco Central.", params: [] },

  /* Consulta de instituição */
  { name: "institution_check_start", group: "ferramenta", description: "Consulta de instituição: busca iniciada.", params: [] },
  { name: "institution_check_result", group: "ferramenta", description: "Consulta de instituição: instituição encontrada.", params: [], keyEvent: true },
  { name: "institution_check_multiple_results", group: "ferramenta", description: "Consulta: mais de uma instituição para o termo.", params: ["results"] },
  { name: "institution_check_not_found", group: "ferramenta", description: "Consulta: nada encontrado — sinal de atenção para a pessoa.", params: [] },
  { name: "institution_check_unavailable", group: "ferramenta", description: "Consulta: base indisponível no momento.", params: [] },
  { name: "institution_check_bcb_click", group: "ferramenta", description: "Consulta: ida ao site do Banco Central.", params: [] },
  { name: "institution_check_comparator_click", group: "ferramenta", description: "Consulta: saída para o comparador.", params: [] },
  { name: "institution_check_fraud_click", group: "ferramenta", description: "Consulta: saída para a verificação de golpe.", params: [] },
  { name: "institution_check_rate_click", group: "ferramenta", description: "Consulta: saída para a ferramenta de taxa.", params: [] },

  /* Vale a pena trocar esta dívida? */
  { name: "debt_switch_start", group: "ferramenta", description: "Troca de dívida: primeira interação.", params: [] },
  { name: "debt_switch_complete", group: "ferramenta", description: "Troca de dívida: comparação concluída.", params: ["verdict"], keyEvent: true },
  { name: "debt_switch_partial_result", group: "ferramenta", description: "Troca de dívida: resultado parcial, faltando dado.", params: [] },
  { name: "debt_switch_fraud_warning", group: "ferramenta", description: "Troca de dívida: aviso de golpe exibido.", params: [] },
  { name: "debt_switch_fraud_click", group: "ferramenta", description: "Troca de dívida: saída para a verificação de golpe.", params: [] },
  { name: "debt_switch_comparator_click", group: "ferramenta", description: "Troca de dívida: saída para o comparador.", params: [] },
  { name: "debt_switch_institution_click", group: "ferramenta", description: "Troca de dívida: saída para a consulta de instituição.", params: [] },
  { name: "debt_switch_rate_tool_click", group: "ferramenta", description: "Troca de dívida: saída para a ferramenta de taxa.", params: [] },

  /* Quanto de parcela cabe no orçamento? */
  { name: "budget_tool_start", group: "ferramenta", description: "Parcela no orçamento: primeira interação.", params: [] },
  { name: "budget_tool_complete", group: "ferramenta", description: "Parcela no orçamento: impacto calculado.", params: ["band"], keyEvent: true },
  { name: "budget_tool_scenario_change", group: "ferramenta", description: "Parcela no orçamento: cenário alternado.", params: [] },
  { name: "budget_tool_comparator_click", group: "ferramenta", description: "Parcela no orçamento: saída para o comparador.", params: [] },
  { name: "budget_tool_rate_tool_click", group: "ferramenta", description: "Parcela no orçamento: saída para a ferramenta de taxa.", params: [] },
  { name: "budget_tool_debt_switch_click", group: "ferramenta", description: "Parcela no orçamento: saída para a troca de dívida.", params: [] },
  { name: "budget_tool_article_click", group: "ferramenta", description: "Parcela no orçamento: saída para conteúdo.", params: [] },

  /* Quitação antecipada */
  { name: "early_payoff_start", group: "ferramenta", description: "Quitação antecipada: primeira interação.", params: [] },
  { name: "early_payoff_complete", group: "ferramenta", description: "Quitação antecipada: economia calculada.", params: [], keyEvent: true },
  { name: "early_payoff_partial_mode", group: "ferramenta", description: "Quitação antecipada: modo de amortização parcial.", params: [] },
  { name: "early_payoff_scenario_compare", group: "ferramenta", description: "Quitação antecipada: cenários comparados.", params: [] },
  { name: "early_payoff_no_balance", group: "ferramenta", description: "Quitação antecipada: pessoa não sabe o saldo devedor.", params: [] },
  { name: "early_payoff_debt_plan_click", group: "ferramenta", description: "Quitação antecipada: saída para o plano de dívidas.", params: [] },
  { name: "early_payoff_debt_switch_click", group: "ferramenta", description: "Quitação antecipada: saída para a troca de dívida.", params: [] },
  { name: "early_payoff_rate_tool_click", group: "ferramenta", description: "Quitação antecipada: saída para a ferramenta de taxa.", params: [] },

  /* Plano de saída das dívidas */
  { name: "debt_plan_start", group: "ferramenta", description: "Plano de dívidas: primeira dívida lançada.", params: [] },
  { name: "debt_plan_complete", group: "ferramenta", description: "Plano de dívidas: plano montado.", params: ["method"], keyEvent: true },
  { name: "debt_plan_method_view", group: "ferramenta", description: "Plano de dívidas: comparação avalanche × bola de neve vista.", params: [] },
  { name: "debt_plan_budget_tool_click", group: "ferramenta", description: "Plano de dívidas: saída para o orçamento.", params: [] },
  { name: "debt_plan_debt_switch_click", group: "ferramenta", description: "Plano de dívidas: saída para a troca de dívida.", params: [] },
  { name: "debt_plan_early_payoff_click", group: "ferramenta", description: "Plano de dívidas: saída para a quitação antecipada.", params: [] },
  { name: "debt_plan_official_help_click", group: "ferramenta", description: "Plano de dívidas: ida a canal oficial de ajuda.", params: [], keyEvent: true },

  /* Renegociação */
  { name: "renegotiation_tool_start", group: "ferramenta", description: "Renegociação: primeira interação.", params: [] },
  { name: "renegotiation_tool_complete", group: "ferramenta", description: "Renegociação: propostas comparadas.", params: ["offers", "has_entry", "has_cash_offer", "has_reference_balance", "variable_installments"], keyEvent: true },
  { name: "renegotiation_offer_add", group: "ferramenta", description: "Renegociação: proposta adicionada.", params: ["offers"] },
  { name: "renegotiation_discount_check", group: "ferramenta", description: "Renegociação: desconto anunciado conferido.", params: ["matches"] },
  { name: "renegotiation_copy_summary", group: "ferramenta", description: "Renegociação: resumo copiado.", params: [] },
  { name: "renegotiation_clear", group: "ferramenta", description: "Renegociação: campos limpos.", params: [] },
  {
    name: "renegotiation_tool_click",
    group: "ferramenta",
    description:
      "Renegociação: saída para outra ferramenta. Substitui os cinco nomes montados por template (`renegotiation_${alvo}_click`), que geravam nomes invisíveis a qualquer busca no código e gastavam cinco das 500 vagas de nome do GA4 para medir uma única ação.",
    params: ["target"],
  },

  /* À vista ou parcelado? */
  { name: "cash_installment_start", group: "ferramenta", description: "À vista ou parcelado: primeira interação.", params: [] },
  { name: "cash_installment_complete", group: "ferramenta", description: "À vista ou parcelado: comparação concluída.", params: ["options", "relation", "has_entry", "has_cash_option", "has_reference_price", "variable_installments"], keyEvent: true },
  { name: "cash_installment_extra_option_add", group: "ferramenta", description: "À vista ou parcelado: forma de pagamento adicionada.", params: ["options"] },
  { name: "cash_installment_advanced_open", group: "ferramenta", description: "À vista ou parcelado: opções avançadas abertas.", params: [] },
  { name: "cash_installment_copy_summary", group: "ferramenta", description: "À vista ou parcelado: resumo copiado.", params: [] },
  { name: "cash_installment_clear", group: "ferramenta", description: "À vista ou parcelado: campos limpos.", params: [] },
  { name: "cash_installment_budget_click", group: "ferramenta", description: "À vista ou parcelado: saída para o orçamento.", params: [] },

  /* Radar de taxas */
  { name: "rates_radar_period_change", group: "ferramenta", description: "Radar de taxas: período do gráfico alterado.", params: ["period"] },
  { name: "rates_radar_compare_rate_click", group: "ferramenta", description: "Radar de taxas: saída para a ferramenta de taxa.", params: [] },
  { name: "rates_radar_converter_click", group: "ferramenta", description: "Radar de taxas: saída para o conversor.", params: [] },
];

export const EVENT_REGISTRY: readonly EventSpec[] = [
  ...NAV_EVENTS,
  ...EXIT_EVENTS,
  ...CONTENT_EVENTS,
  ...CONSENT_EVENTS,
  ...SEARCH_EVENTS,
  ...DECISION_EVENTS,
  ...TOOL_EVENTS,
];

const BY_NAME = new Map(EVENT_REGISTRY.map((spec) => [spec.name, spec]));

export function findEvent(name: string): EventSpec | undefined {
  return BY_NAME.get(name);
}

export function isRegisteredEvent(name: string): boolean {
  return BY_NAME.has(name);
}

export function keyEvents(): EventSpec[] {
  return EVENT_REGISTRY.filter((spec) => spec.keyEvent === true);
}
