/**
 * MOTOR DO SIMULADOR DO BANCO DO POVO PAULISTA
 * ============================================================================
 *
 * Funções puras, em centavos, sem nenhum número do programa digitado aqui:
 * limites, prazo, carência e taxas vêm de `bpp-rules.ts`.
 *
 * MÉTODO (declarado na página, porque não há fonte oficial do sistema):
 *
 * - Estimativa pelo sistema Price: parcelas fixas, juros compostos mensais, a
 *   mesma fórmula da Calculadora do Cidadão do Banco Central para prestações
 *   fixas. PMT = B × i ÷ [1 − (1 + i)^(−n)]; com i = 0, B ÷ n.
 * - Carência: PREMISSA PRUDENTE. Nos meses de carência não há parcela e os
 *   juros entram no saldo (B = valor × (1 + i)^c, mês a mês, arredondado ao
 *   centavo). É a hipótese que dá a parcela maior; se o contrato cobrar os
 *   juros durante a carência, a parcela fica menor que a estimada.
 * - O prazo informado é o número de PARCELAS; a carência vem antes delas.
 * - Arredondamento de contrato: parcela e juros de cada mês ao centavo; a
 *   última parcela acerta a diferença para o saldo terminar em zero.
 * - CET: só quando a pessoa informa os custos E confirma que são todos. Fluxo:
 *   recebe (valor − custos da liberação) no mês 0 e paga as parcelas da
 *   tabela; a taxa interna mensal sai por bisseção e vira anual por
 *   (1 + m)^12 − 1. Sem confirmação, não há CET — e a página diz por quê.
 *
 * Nada aqui vai para a medição de audiência: os valores ficam no navegador.
 */

import { BPP_RULES, CUSTOM_RATE_MAX_PERCENT, capForProfile, type Profile } from "./bpp-rules";

export type BppField = "amount" | "months" | "grace" | "rate" | "costs";

export interface BppIssue {
  field: BppField;
  message: string;
}

export type CostInput = { kind: "reais"; cents: number } | { kind: "percent"; percent: number };

export interface BppInput {
  profile: Profile;
  amountCents: number | null;
  /** Número de parcelas. */
  months: number | null;
  graceMonths: number;
  monthlyRatePercent: number | null;
  /** Custos cobrados na liberação, informados pelo atendimento. */
  costs?: CostInput | null;
  /** A pessoa confirma que informou TODOS os custos — só assim há CET. */
  costsComplete?: boolean;
}

export interface ScheduleRow {
  month: number;
  /** "carencia" não tem parcela; os juros entram no saldo. */
  phase: "carencia" | "parcela";
  paymentCents: number;
  interestCents: number;
  amortizationCents: number;
  balanceCents: number;
}

export interface BppResult {
  amountCents: number;
  months: number;
  graceMonths: number;
  monthlyRatePercent: number;
  annualRatePercent: number;
  /** Saldo no início das parcelas (valor + juros da carência). */
  balanceAfterGraceCents: number;
  graceInterestCents: number;
  /** Parcela fixa (a última pode diferir por centavos). */
  paymentCents: number;
  lastPaymentCents: number;
  totalPaidCents: number;
  totalInterestCents: number;
  costsCents: number;
  /** Mês da primeira parcela, contado da liberação. */
  firstPaymentMonth: number;
  schedule: ScheduleRow[];
  cet: { monthlyPercent: number; annualPercent: number } | null;
  /** Por que o CET não foi calculado, quando não foi. */
  cetUnavailableReason: string | null;
}

export type BppOutcome =
  | { kind: "ok"; result: BppResult; warnings: BppIssue[] }
  | { kind: "invalid"; errors: BppIssue[] };

const isFiniteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(cents / 100);
const pctBR = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}%`;

/**
 * Arredonda ao centavo sem herdar o erro do ponto flutuante: 0,35 ÷ 100 vale
 * 0,0034999… em binário, e um juro de meio centavo exato (73,5) virava 73,4999…
 * e arredondava para baixo. Doze dígitos significativos limpam o resíduo antes
 * do arredondamento comercial.
 */
export function roundCents(x: number): number {
  return Math.round(Number(x.toPrecision(12)));
}

/* -------------------------------------------------------------------------- */
/* Validação                                                                   */
/* -------------------------------------------------------------------------- */

export function costsInCents(costs: CostInput | null | undefined, amountCents: number): number {
  if (!costs) return 0;
  if (costs.kind === "reais") return roundCents(costs.cents);
  return roundCents((amountCents * costs.percent) / 100);
}

export function validateBpp(input: BppInput): { errors: BppIssue[]; warnings: BppIssue[] } {
  const errors: BppIssue[] = [];
  const warnings: BppIssue[] = [];
  const { minCents } = BPP_RULES.amount;
  const cap = capForProfile(input.profile);

  const amount = input.amountCents;
  if (typeof amount === "number" && Number.isNaN(amount)) {
    errors.push({ field: "amount", message: "Digite o valor só com números, por exemplo 5.000." });
  } else if (!isFiniteNumber(amount) || amount <= 0) {
    errors.push({ field: "amount", message: "Informe o valor que pretende pedir." });
  } else if (amount < minCents) {
    errors.push({ field: "amount", message: `O valor mínimo divulgado pelo Estado é ${brl(minCents)}.` });
  } else if (amount > cap.capCents) {
    errors.push({
      field: "amount",
      message:
        cap.basis === "pessoa-fisica"
          ? `Para quem trabalha sem CNPJ, prefeituras que operam o programa citam até ${brl(cap.capCents)}.`
          : `O valor máximo divulgado pelo Estado é ${brl(cap.capCents)}.`,
    });
  } else if (input.profile === "nao-sei" && amount > BPP_RULES.profileCap.pessoaFisicaCents) {
    warnings.push({
      field: "amount",
      message: `Acima de ${brl(BPP_RULES.profileCap.pessoaFisicaCents)}, prefeituras citam o teto de pessoa jurídica: sem CNPJ, o limite tende a ser menor.`,
    });
  }

  const months = input.months;
  if (!isFiniteNumber(months) || !Number.isInteger(months) || months < 1) {
    errors.push({ field: "months", message: "Informe o número de parcelas, em meses inteiros." });
  } else if (months > BPP_RULES.term.maxMonths) {
    errors.push({ field: "months", message: `O prazo máximo divulgado pelo Estado é de ${BPP_RULES.term.maxMonths} meses.` });
  }

  const grace = input.graceMonths;
  if (!isFiniteNumber(grace) || !Number.isInteger(grace) || grace < 0 || grace > BPP_RULES.grace.maxMonths) {
    errors.push({ field: "grace", message: `A carência simulada vai de 0 a ${BPP_RULES.grace.maxMonths} meses.` });
  } else if (grace > 0 && isFiniteNumber(months) && months + grace > BPP_RULES.term.maxMonths) {
    warnings.push({
      field: "grace",
      message: `Com a carência, o contrato passaria de ${BPP_RULES.term.maxMonths} meses. Não sabemos se a carência conta dentro do prazo máximo: pergunte no atendimento.`,
    });
  }

  const rate = input.monthlyRatePercent;
  if (typeof rate === "number" && Number.isNaN(rate)) {
    errors.push({ field: "rate", message: "Digite a taxa só com números, por exemplo 0,50." });
  } else if (!isFiniteNumber(rate) || rate <= 0) {
    errors.push({ field: "rate", message: "Informe uma taxa de juros maior que zero." });
  } else if (rate > CUSTOM_RATE_MAX_PERCENT) {
    errors.push({ field: "rate", message: `Use uma taxa de até ${CUSTOM_RATE_MAX_PERCENT}% ao mês. Taxas assim estão muito acima das divulgadas pelo programa.` });
  } else if (rate < BPP_RULES.rate.fromMonthlyPercent) {
    warnings.push({ field: "rate", message: `Taxa abaixo da mínima divulgada pelo Estado (${pctBR(BPP_RULES.rate.fromMonthlyPercent)} ao mês).` });
  } else if (rate > BPP_RULES.rate.highestCitedMonthlyPercent) {
    warnings.push({ field: "rate", message: `Taxa acima da maior citada em páginas oficiais de prefeituras (${pctBR(BPP_RULES.rate.highestCitedMonthlyPercent)} ao mês).` });
  }

  const costs = input.costs;
  if (costs) {
    const unreadable = costs.kind === "reais" ? Number.isNaN(costs.cents) : Number.isNaN(costs.percent);
    if (unreadable) {
      errors.push({ field: "costs", message: "Digite os custos só com números, por exemplo 150 ou 1,5." });
    } else if (costs.kind === "reais") {
      if (!isFiniteNumber(costs.cents) || costs.cents < 0) {
        errors.push({ field: "costs", message: "Os custos não podem ser negativos." });
      } else if (isFiniteNumber(amount) && amount > 0 && costs.cents >= amount) {
        errors.push({ field: "costs", message: "Os custos não podem ser iguais ou maiores que o valor pedido." });
      }
    } else if (!isFiniteNumber(costs.percent) || costs.percent < 0 || costs.percent >= 100) {
      errors.push({ field: "costs", message: "Informe um percentual de custos de 0% a menos de 100%." });
    } else if (isFiniteNumber(amount) && amount > 0 && costsInCents(costs, amount) >= amount) {
      errors.push({ field: "costs", message: "Os custos não podem ser iguais ou maiores que o valor pedido." });
    }
  }

  return { errors, warnings };
}

/* -------------------------------------------------------------------------- */
/* Cálculo                                                                     */
/* -------------------------------------------------------------------------- */

export function annualFromMonthly(monthlyPercent: number): number {
  return (Math.pow(1 + monthlyPercent / 100, 12) - 1) * 100;
}

/** Parcela Price ao centavo. */
export function pricePaymentCents(balanceCents: number, i: number, n: number): number {
  if (i === 0) return roundCents(balanceCents / n);
  return roundCents((balanceCents * i) / (1 - Math.pow(1 + i, -n)));
}

export function buildSchedule(amountCents: number, i: number, graceMonths: number, n: number): ScheduleRow[] {
  const rows: ScheduleRow[] = [];
  let balance = amountCents;
  for (let m = 1; m <= graceMonths; m++) {
    const interest = roundCents(balance * i);
    balance += interest;
    rows.push({ month: m, phase: "carencia", paymentCents: 0, interestCents: interest, amortizationCents: 0, balanceCents: balance });
  }
  const payment = pricePaymentCents(balance, i, n);
  for (let k = 1; k <= n; k++) {
    const interest = roundCents(balance * i);
    const last = k === n;
    const amortization = last ? balance : payment - interest;
    const pay = last ? balance + interest : payment;
    balance -= amortization;
    rows.push({ month: graceMonths + k, phase: "parcela", paymentCents: pay, interestCents: interest, amortizationCents: amortization, balanceCents: balance });
  }
  return rows;
}

/**
 * Taxa interna mensal (fração) do fluxo: recebe `netCents` no mês 0 e paga
 * `payments[t]` no mês t (1..N). O valor presente das parcelas cai com a
 * taxa, então a raiz é única quando existe. O limite superior começa em 100%
 * ao mês e dobra até cercar a raiz: custos altos com prazo curto podem levar o
 * CET acima de 100% ao mês, e o resultado continua verdadeiro.
 */
export function internalRate(netCents: number, payments: number[]): number | null {
  if (netCents <= 0) return null;
  const pv = (r: number) => payments.reduce((acc, p, t) => acc + p / Math.pow(1 + r, t + 1), 0);
  if (pv(0) < netCents) return null;
  let lo = 0;
  let hi = 1;
  while (pv(hi) > netCents) {
    hi *= 2;
    if (hi > 1e6) return null;
  }
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2;
    if (pv(mid) > netCents) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function simulateBpp(input: BppInput): BppOutcome {
  const { errors, warnings } = validateBpp(input);
  if (errors.length > 0) return { kind: "invalid", errors };

  const amountCents = input.amountCents as number;
  const months = input.months as number;
  const graceMonths = input.graceMonths;
  const ratePercent = input.monthlyRatePercent as number;
  const i = Number((ratePercent / 100).toPrecision(12));

  const schedule = buildSchedule(amountCents, i, graceMonths, months);
  const parcels = schedule.filter((r) => r.phase === "parcela");
  const graceRows = schedule.filter((r) => r.phase === "carencia");
  const graceInterestCents = graceRows.reduce((a, r) => a + r.interestCents, 0);
  const totalPaidCents = parcels.reduce((a, r) => a + r.paymentCents, 0);
  const costsCents = costsInCents(input.costs, amountCents);

  let cet: BppResult["cet"] = null;
  let cetUnavailableReason: string | null = null;
  if (!input.costsComplete) {
    cetUnavailableReason =
      "Não é possível estimar o CET com precisão sem conhecer todos os custos da operação. Informe os custos que o atendimento passar e confirme que são todos.";
  } else {
    const payments = schedule.map((r) => r.paymentCents);
    const m = internalRate(amountCents - costsCents, payments);
    if (m === null) {
      cetUnavailableReason = "Com esses números, o CET não pôde ser calculado.";
    } else {
      cet = { monthlyPercent: m * 100, annualPercent: (Math.pow(1 + m, 12) - 1) * 100 };
    }
  }

  return {
    kind: "ok",
    warnings,
    result: {
      amountCents,
      months,
      graceMonths,
      monthlyRatePercent: ratePercent,
      annualRatePercent: annualFromMonthly(ratePercent),
      balanceAfterGraceCents: amountCents + graceInterestCents,
      graceInterestCents,
      paymentCents: parcels[0]!.paymentCents,
      lastPaymentCents: parcels[parcels.length - 1]!.paymentCents,
      totalPaidCents,
      totalInterestCents: totalPaidCents - amountCents,
      costsCents,
      firstPaymentMonth: graceMonths + 1,
      schedule,
      cet,
      cetUnavailableReason,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Diagnóstico de requisitos — nunca "aprovado"                                */
/* -------------------------------------------------------------------------- */

export type Answer = "sim" | "nao" | "nao-sei" | "";
export type Purpose =
  | "capital-de-giro"
  | "mercadorias"
  | "equipamentos"
  | "reforma"
  | "divida-pessoal"
  | "consumo"
  | "outro"
  | "";

export const PURPOSE_LABEL: Record<Exclude<Purpose, "">, string> = {
  "capital-de-giro": "Capital de giro do negócio",
  mercadorias: "Mercadorias ou matéria-prima",
  equipamentos: "Máquinas, equipamentos ou veículo de trabalho",
  reforma: "Reforma do ponto",
  "divida-pessoal": "Pagar conta ou dívida pessoal",
  consumo: "Despesa pessoal ou da casa",
  outro: "Outro uso",
};

export interface DiagnosisInput {
  purpose: Purpose;
  hasActivity: Answer;
  activityInCity: Answer;
  /** "sim" = o nome está SEM restrição (pergunta afirmativa: "sim" é sempre o lado bom). */
  nameClear: Answer;
  training: Answer;
  sixMonths: Answer;
}

export type ItemStatus = "ok" | "verificar" | "impedimento";
export type Verdict = "aparentemente-compativel" | "precisa-verificar" | "possivel-impedimento";

export interface DiagnosisItem {
  id: string;
  status: ItemStatus;
  text: string;
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  "aparentemente-compativel": "Aparentemente compatível",
  "precisa-verificar": "Precisa verificar",
  "possivel-impedimento": "Possível impedimento",
};

export const VERDICT_TEXT: Record<Verdict, string> = {
  "aparentemente-compativel":
    "Pelos dados informados, você aparentemente atende aos requisitos básicos divulgados. Isso não é aprovação: a análise é feita pelo programa, no atendimento.",
  "precisa-verificar":
    "Encontramos pontos que precisam ser confirmados no atendimento antes do pedido.",
  "possivel-impedimento":
    "Encontramos um ponto que pode impedir o pedido. Veja abaixo o que ele significa e qual é o caminho.",
};

export function diagnose(input: DiagnosisInput): { verdict: Verdict; items: DiagnosisItem[] } {
  const items: DiagnosisItem[] = [];
  const unknown = (a: Answer) => a === "nao-sei" || a === "";

  // Finalidade
  if (input.purpose === "divida-pessoal" || input.purpose === "consumo") {
    items.push({ id: "finalidade", status: "impedimento", text: "O programa financia o negócio. Despesa pessoal e dívida de consumo não são a finalidade do crédito." });
  } else if (input.purpose === "reforma" || input.purpose === "outro" || input.purpose === "") {
    items.push({ id: "finalidade", status: "verificar", text: "Confirme no atendimento se esse uso é aceito. O que as fontes oficiais citam é capital de giro e investimento fixo, como máquinas e equipamentos." });
  } else {
    items.push({ id: "finalidade", status: "ok", text: "Uso compatível com o que o programa divulga: capital de giro ou investimento no negócio." });
  }

  // Atividade produtiva
  if (input.hasActivity === "nao") {
    items.push({ id: "atividade", status: "impedimento", text: "O programa pede atividade produtiva, formal ou informal. Sem negócio em funcionamento, o caminho costuma começar pela formalização e pela capacitação." });
  } else if (unknown(input.hasActivity)) {
    items.push({ id: "atividade", status: "verificar", text: "Confirme se a sua atividade é considerada produtiva pelo programa." });
  } else {
    items.push({ id: "atividade", status: "ok", text: "Atividade produtiva informada." });
  }

  // Atividade no município
  if (input.activityInCity === "nao") {
    items.push({ id: "municipio", status: "impedimento", text: "O pedido é feito no município onde a atividade é desenvolvida. Procure o atendimento da cidade do seu negócio." });
  } else if (unknown(input.activityInCity)) {
    items.push({ id: "municipio", status: "verificar", text: "O pedido é feito na cidade onde o negócio funciona. Confirme qual atendimento vale para você." });
  } else {
    items.push({ id: "municipio", status: "ok", text: "Atividade no município onde pretende pedir." });
  }

  // Restrição cadastral
  if (input.nameClear === "nao") {
    items.push({ id: "restricao", status: "impedimento", text: "A carta de serviços estadual exige não ter restrição cadastral no Serasa e/ou no ADIN Estadual, o cadastro estadual de inadimplentes. Com restrição, resolver vem antes do pedido." });
  } else if (unknown(input.nameClear)) {
    items.push({ id: "restricao", status: "verificar", text: "Consulte o seu nome antes de ir: a consulta é gratuita e restrição impede o pedido." });
  } else {
    items.push({ id: "restricao", status: "ok", text: "Sem restrição cadastral informada." });
  }

  // Capacitação
  if (input.training === "sim") {
    items.push({ id: "capacitacao", status: "ok", text: "Capacitação feita." });
  } else {
    items.push({ id: "capacitacao", status: "verificar", text: "O programa pede uma capacitação gratuita antes do pedido. Pergunte no atendimento qual curso vale." });
  }

  // Tempo de atividade (exigência municipal)
  if (input.sixMonths === "sim") {
    items.push({ id: "tempo", status: "ok", text: "Atividade há seis meses ou mais." });
  } else {
    items.push({ id: "tempo", status: "verificar", text: "Algumas prefeituras exigem tempo mínimo de atividade, como mais de seis meses. Confirme a regra da sua cidade." });
  }

  const verdict: Verdict = items.some((x) => x.status === "impedimento")
    ? "possivel-impedimento"
    : items.some((x) => x.status === "verificar")
      ? "precisa-verificar"
      : "aparentemente-compativel";
  return { verdict, items };
}
