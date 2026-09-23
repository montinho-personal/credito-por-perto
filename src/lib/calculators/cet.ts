/**
 * CET DE UMA PROPOSTA — organiza os números da proposta num fluxo de caixa e
 * pede a taxa ao motor único (`cash-flow.ts`). Nenhuma conta de taxa aqui.
 *
 * O PONTO DE PARTIDA É O VALOR QUE CHEGA: "quanto chega para você (ou para o
 * vendedor)". A partir dele:
 *
 * - custo "incluído no financiamento": já está dentro das parcelas informadas;
 *   não muda o fluxo, só explica o valor financiado (e nunca é somado duas
 *   vezes);
 * - custo "descontado do valor liberado": já saiu antes de o dinheiro chegar;
 *   também não muda o fluxo, e explica a diferença entre solicitado e recebido;
 * - custo "pago à parte na contratação": sai do bolso na data da liberação —
 *   reduz o fluxo inicial (FC0);
 * - custo "junto com cada parcela" (ex.: seguro mensal cobrado à parte): um
 *   pagamento a mais em cada vencimento;
 * - custo "em outra data": um pagamento naquela data.
 *
 * NOMENCLATURA (regra do projeto): só é "CET estimado com os valores
 * informados" quando a pessoa confirma que informou todos os custos. Sem
 * isso, é "taxa efetiva estimada do fluxo informado". Nunca "CET oficial".
 */

import { addMonths, daysBetween, isIsoDate } from "./civil-date";
import { annualToMonthly, monthlyToAnnual, netDisbursementCents, solveAnnualRate, totalPaidCents, type Flow, type FlowValidation } from "./cash-flow";

/* -------------------------------------------------------------------------- */
/* Norma                                                                      */
/* -------------------------------------------------------------------------- */

export const CET_RULES = {
  resolution: {
    organization: "Conselho Monetário Nacional / Banco Central do Brasil",
    title: "Resolução CMN nº 4.881, de 23 de dezembro de 2020 (vigente desde 01/02/2021)",
    url: "https://www.bcb.gov.br/content/estabilidadefinanceira/especialnor/Resolu%C3%A7%C3%A3o4881.pdf",
  },
  instruction: {
    organization: "Banco Central do Brasil",
    title: "Instrução Normativa BCB nº 83, de 3 de março de 2021",
    url: "https://www.bcb.gov.br/estabilidadefinanceira/buscanormas",
  },
  scope:
    "A Resolução vale para operações de crédito e arrendamento mercantil financeiro de instituições financeiras e sociedades de arrendamento com pessoas naturais, empresários individuais, microempresas e empresas de pequeno porte. Não se aplica a repasses de recursos externos nem a crédito rural.",
  definition:
    "O CET é uma taxa anual que consolida os encargos e as despesas da operação: amortizações, juros, tarifas, tributos, seguros e outras despesas vinculadas, inclusive as que não entram no valor financiado.",
  formula: "Σ (j = 1 a N) FCj ÷ (1 + CET)^((dj − d0) ÷ 365) − FC0 = 0, com FC0 recebido na liberação, FCj pagos depois e datas em dias corridos.",
  indexers:
    "Taxas flutuantes, índices de preços e outros referenciais que variam durante o contrato não entram no cálculo do CET; a instituição informa esses parâmetros junto com ele.",
  revolving:
    "Adiantamento a depositantes, desconto, cheque especial e operações com característica de crédito rotativo seguem metodologia própria: prazo de 30 dias e o valor do limite pactuado.",
  disclosure:
    "A instituição informa o CET antes da contratação e apresenta o demonstrativo, com o valor de cada componente do fluxo e o percentual em relação ao total devido.",
  verifiedAt: "23/09/2026",
} as const;

/* -------------------------------------------------------------------------- */
/* Proposta                                                                   */
/* -------------------------------------------------------------------------- */

export type CostKind = "iof" | "tarifa" | "seguro" | "registro" | "avaliacao" | "terceiros" | "outro";
export type CostMode = "financiado" | "descontado" | "antecipado" | "por-parcela" | "data";

export const COST_KIND_LABEL: Record<CostKind, string> = {
  iof: "IOF",
  tarifa: "Tarifa",
  seguro: "Seguro",
  registro: "Registro",
  avaliacao: "Avaliação",
  terceiros: "Serviço de terceiros",
  outro: "Outro custo",
};

export const COST_MODE_LABEL: Record<CostMode, string> = {
  financiado: "incluído no financiamento",
  descontado: "descontado do valor liberado",
  antecipado: "pago à parte na contratação",
  "por-parcela": "cobrado junto com cada parcela",
  data: "pago em outra data",
};

export interface Cost {
  kind: CostKind;
  label?: string;
  /** Centavos. Em "por-parcela", o valor de cada cobrança. */
  amountCents: number;
  mode: CostMode;
  /** Só em "data". */
  date?: string;
}

export type Indexer = "nenhum" | "tr" | "ipca" | "outro";
export type OperationKind = "definida" | "rotativo" | "rural";

export interface ProposalInput {
  /** Quanto chega para o cliente ou para o vendedor. */
  receivedCents: number;
  installments: number;
  installmentCents: number;
  /** Parcelas diferentes, em ordem (substitui n × parcela). */
  irregularInstallmentsCents?: number[];
  releaseDate: string;
  firstDueDate: string;
  costs: Cost[];
  /** A pessoa confirmou que não há outros custos. */
  allCostsInformed: boolean;
  announcedRate?: { value: number; unit: "am" | "aa" };
  cetInformedPercent?: number;
  /** Valor financiado mostrado na proposta (opcional), para conferir. */
  financedInformedCents?: number;
  indexer: Indexer;
  operation: OperationKind;
}

export type ProposalField =
  | "receivedCents"
  | "installments"
  | "installmentCents"
  | "releaseDate"
  | "firstDueDate"
  | "costs"
  | "announcedRate"
  | "cetInformedPercent"
  | "financedInformedCents";

export interface ProposalIssue {
  field: ProposalField;
  message: string;
}

export interface ProposalResult {
  flows: Flow[];
  annualRate: number;
  monthlyEquivalent: number;
  /** "cet" só quando todos os custos foram confirmados. */
  label: "cet" | "taxa-do-fluxo";
  receivedCents: number;
  /** Recebido − custos antecipados: o FC0. */
  netInitialCents: number;
  /** Recebido + descontados. */
  requestedCents: number;
  /** Recebido + descontados + financiados. */
  financedCents: number;
  installmentsTotalCents: number;
  totalPaidCents: number;
  costsByMode: Record<CostMode, number>;
  costsByKind: Record<CostKind, number>;
  /** Parcelas − valor financiado: juros e outros encargos dentro das parcelas. */
  interestInInstallmentsCents: number;
  /** Pagamentos depois da liberação para cada R$ 1.000 do FC0 — não é o CET. null se o FC0 não for positivo. */
  paidPer1000Cents: number | null;
  /** Total pago − valor recebido: o custo em reais. */
  costInReaisCents: number;
  announcedAnnual: number | null;
  announcedMonthly: number | null;
  cetInformed: number | null;
  /** CET estimado − informado, em pontos percentuais. */
  cetDiffPp: number | null;
  /** Valor financiado informado − valor explicado pelos custos. */
  unexplainedFinancedCents: number | null;
  indexer: Indexer;
  lastDueDate: string;
  termDays: number;
}

export type ProposalOutcome =
  | { kind: "ok"; result: ProposalResult }
  | { kind: "invalid"; errors: ProposalIssue[] }
  | { kind: "fluxo-invalido"; validation: FlowValidation }
  | { kind: "rotativo" }
  | { kind: "fora-do-escopo" };

const MAX_INSTALLMENTS = 600;
const MAX_CENTS = 100_000_000_00;

function sumBy<T extends string>(costs: Cost[], key: (c: Cost) => T, keys: readonly T[], each: (c: Cost) => number): Record<T, number> {
  const out = Object.fromEntries(keys.map((k) => [k, 0])) as Record<T, number>;
  for (const c of costs) out[key(c)] += each(c);
  return out;
}

export function validateProposal(p: ProposalInput): ProposalIssue[] {
  const e: ProposalIssue[] = [];
  const irregular = p.irregularInstallmentsCents;
  if (!Number.isFinite(p.receivedCents) || p.receivedCents <= 0) e.push({ field: "receivedCents", message: "Informe quanto chega para você." });
  else if (p.receivedCents > MAX_CENTS) e.push({ field: "receivedCents", message: "Confira o valor: está alto demais." });
  if (irregular && irregular.length > 0) {
    if (irregular.length > MAX_INSTALLMENTS || irregular.some((v) => !Number.isFinite(v) || v <= 0)) e.push({ field: "installmentCents", message: "Confira os valores das parcelas." });
  } else {
    if (!Number.isInteger(p.installments) || p.installments < 1 || p.installments > MAX_INSTALLMENTS) e.push({ field: "installments", message: "Informe o número de parcelas." });
    if (!Number.isFinite(p.installmentCents) || p.installmentCents <= 0) e.push({ field: "installmentCents", message: "Informe o valor da parcela." });
  }
  if (!isIsoDate(p.releaseDate)) e.push({ field: "releaseDate", message: "Informe a data em que recebeu o crédito." });
  if (!isIsoDate(p.firstDueDate)) e.push({ field: "firstDueDate", message: "Informe o vencimento da primeira parcela." });
  else if (isIsoDate(p.releaseDate) && p.firstDueDate <= p.releaseDate) e.push({ field: "firstDueDate", message: "A primeira parcela vence depois da liberação." });
  for (const c of p.costs) {
    if (!Number.isFinite(c.amountCents) || c.amountCents < 0) e.push({ field: "costs", message: "Confira o valor dos custos." });
    if (c.mode === "data" && (!c.date || !isIsoDate(c.date) || (isIsoDate(p.releaseDate) && c.date < p.releaseDate))) {
      e.push({ field: "costs", message: "Informe a data do custo, igual ou depois da liberação." });
    }
  }
  if (p.announcedRate && (!Number.isFinite(p.announcedRate.value) || p.announcedRate.value < 0)) e.push({ field: "announcedRate", message: "Confira a taxa anunciada." });
  if (p.cetInformedPercent !== undefined && (!Number.isFinite(p.cetInformedPercent) || p.cetInformedPercent < 0)) e.push({ field: "cetInformedPercent", message: "Confira o CET informado." });
  if (p.financedInformedCents !== undefined && (!Number.isFinite(p.financedInformedCents) || p.financedInformedCents <= 0)) e.push({ field: "financedInformedCents", message: "Confira o valor financiado." });
  return e;
}

/** Monta o fluxo: + recebido e − antecipados na liberação; − parcelas e custos depois. */
export function buildFlows(p: ProposalInput): Flow[] {
  const amounts = p.irregularInstallmentsCents && p.irregularInstallmentsCents.length > 0 ? p.irregularInstallmentsCents : Array.from({ length: p.installments }, () => p.installmentCents);
  const flows: Flow[] = [{ date: p.releaseDate, amountCents: p.receivedCents, description: "Valor recebido", kind: "recebimento" }];
  for (const c of p.costs) {
    const name = c.label?.trim() || COST_KIND_LABEL[c.kind];
    if (c.mode === "antecipado") flows.push({ date: p.releaseDate, amountCents: -c.amountCents, description: `${name} pago na contratação`, kind: "custo" });
    if (c.mode === "data" && c.date) flows.push({ date: c.date, amountCents: -c.amountCents, description: name, kind: "custo" });
  }
  amounts.forEach((amount, k) => {
    const date = addMonths(p.firstDueDate, k);
    flows.push({ date, amountCents: -amount, description: `Parcela ${k + 1}`, kind: "parcela" });
    for (const c of p.costs) {
      if (c.mode === "por-parcela") flows.push({ date, amountCents: -c.amountCents, description: `${c.label?.trim() || COST_KIND_LABEL[c.kind]} (parcela ${k + 1})`, kind: "custo" });
    }
  });
  return flows;
}

export function analyzeProposal(p: ProposalInput): ProposalOutcome {
  if (p.operation === "rotativo") return { kind: "rotativo" };
  if (p.operation === "rural") return { kind: "fora-do-escopo" };
  const errors = validateProposal(p);
  if (errors.length > 0) return { kind: "invalid", errors };

  const flows = buildFlows(p);
  const solved = solveAnnualRate(flows, p.releaseDate);
  if (solved.kind === "invalid") return { kind: "fluxo-invalido", validation: solved.validation };
  if (solved.kind === "sem-raiz") return { kind: "fluxo-invalido", validation: { ok: false, problems: ["fluxo-nao-convencional"], signChanges: 0 } };

  const modes = ["financiado", "descontado", "antecipado", "por-parcela", "data"] as const;
  const kinds = ["iof", "tarifa", "seguro", "registro", "avaliacao", "terceiros", "outro"] as const;
  const n = p.irregularInstallmentsCents?.length || p.installments;
  const perCostTotal = (c: Cost) => (c.mode === "por-parcela" ? c.amountCents * n : c.amountCents);
  const costsByMode = sumBy(p.costs, (c) => c.mode, modes, perCostTotal);
  const costsByKind = sumBy(p.costs, (c) => c.kind, kinds, perCostTotal);
  const installmentsTotal = p.irregularInstallmentsCents?.length ? p.irregularInstallmentsCents.reduce((s, v) => s + v, 0) : p.installments * p.installmentCents;
  const requested = p.receivedCents + costsByMode.descontado;
  const financed = requested + costsByMode.financiado;
  const totalPaid = totalPaidCents(flows);
  // FC0: saldo do fluxo na data da liberação (inclui custo "em outra data" marcado no mesmo dia).
  const netInitial = netDisbursementCents(flows, p.releaseDate);
  const paidAfter = flows.filter((f) => f.date > p.releaseDate && f.amountCents < 0).reduce((s, f) => s - f.amountCents, 0);
  const lastFlowDate = flows.reduce((m, f) => (f.date > m ? f.date : m), p.releaseDate);

  const announcedMonthly = p.announcedRate ? (p.announcedRate.unit === "am" ? p.announcedRate.value / 100 : annualToMonthly(p.announcedRate.value / 100)) : null;
  const announcedAnnual = p.announcedRate ? (p.announcedRate.unit === "aa" ? p.announcedRate.value / 100 : monthlyToAnnual(p.announcedRate.value / 100)) : null;
  const cetInformed = p.cetInformedPercent !== undefined ? p.cetInformedPercent / 100 : null;
  const last = addMonths(p.firstDueDate, n - 1);

  return {
    kind: "ok",
    result: {
      flows,
      annualRate: solved.annualRate,
      monthlyEquivalent: annualToMonthly(solved.annualRate),
      label: p.allCostsInformed ? "cet" : "taxa-do-fluxo",
      receivedCents: p.receivedCents,
      netInitialCents: netInitial,
      requestedCents: requested,
      financedCents: financed,
      installmentsTotalCents: installmentsTotal,
      totalPaidCents: totalPaid,
      costsByMode,
      costsByKind,
      interestInInstallmentsCents: installmentsTotal - financed,
      paidPer1000Cents: netInitial > 0 ? Math.round((paidAfter / netInitial) * 1_000_00) : null,
      costInReaisCents: totalPaid - p.receivedCents,
      announcedAnnual,
      announcedMonthly,
      cetInformed,
      cetDiffPp: cetInformed !== null ? (solved.annualRate - cetInformed) * 100 : null,
      unexplainedFinancedCents: p.financedInformedCents !== undefined ? p.financedInformedCents - financed : null,
      indexer: p.indexer,
      lastDueDate: last,
      termDays: daysBetween(p.releaseDate, lastFlowDate > last ? lastFlowDate : last),
    },
  };
}

/** Diferença entre CET estimado e informado que já não se explica por arredondamento. */
export const CET_DIFF_TOLERANCE_PP = 0.1;

/* -------------------------------------------------------------------------- */
/* Comparação — fatos, sem vencedora                                          */
/* -------------------------------------------------------------------------- */

export type CetCriterion = "menorCetCalculado" | "menorCetInformado" | "menorTotal" | "menorParcela" | "menorPrazo" | "maiorRecebido";

export function compareCet(results: ProposalResult[]): Array<{ key: CetCriterion; label: string; holders: number[]; available: boolean }> {
  const pick = (key: CetCriterion, label: string, v: (r: ProposalResult) => number | null, higher = false) => {
    const vals = results.map(v);
    if (results.length < 2 || vals.some((x) => x === null)) return { key, label, holders: [], available: false };
    const nums = vals as number[];
    const best = higher ? Math.max(...nums) : Math.min(...nums);
    const holders = nums.flatMap((x, i) => (Math.abs(x - best) < 1e-9 ? [i] : []));
    return { key, label, holders: holders.length === results.length ? [] : holders, available: true };
  };
  return [
    pick("menorCetCalculado", results.every((r) => r.label === "cet") ? "Menor CET estimado" : "Menor taxa efetiva estimada", (r) => r.annualRate),
    pick("menorCetInformado", "Menor CET informado", (r) => r.cetInformed),
    pick("menorTotal", "Menor total desembolsado", (r) => r.totalPaidCents),
    pick("menorParcela", "Menor primeira parcela", (r) => {
      const first = r.flows.find((f) => f.kind === "parcela");
      return first ? -first.amountCents : null;
    }),
    pick("menorPrazo", "Menor prazo", (r) => r.termDays),
    pick("maiorRecebido", "Maior valor recebido", (r) => r.receivedCents, true),
  ];
}

/** Primeira parcela e número de parcelas, pelo papel do fluxo (nunca pelo nome). */
export function installmentsOf(r: ProposalResult): { count: number; firstCents: number } {
  const parcels = r.flows.filter((f) => f.kind === "parcela");
  return { count: parcels.length, firstCents: parcels[0] ? -parcels[0].amountCents : 0 };
}

/** Limiares de exibição, num lugar só. */
export const DISPLAY = {
  /** Diferença (centavos) a partir da qual o valor financiado informado não se explica. */
  unexplainedMinCents: 100,
  /** Diferença (fração anual) abaixo da qual taxa e CET são "próximos". */
  closeRate: 0.0005,
  /** Nota de anualização: taxa acima de 100% a.a. em menos de 180 dias. */
  shortTermRate: 1,
  shortTermDays: 180,
} as const;
