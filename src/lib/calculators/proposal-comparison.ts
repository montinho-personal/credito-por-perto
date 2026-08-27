/**
 * Motor do Comparador de Propostas de Crédito.
 *
 * Princípios (ver metodologia na página da ferramenta):
 * - Determinístico e client-side: nada é enviado ou armazenado.
 * - Dinheiro em CENTAVOS (inteiros) para evitar erros de ponto flutuante;
 *   arredondamento só na apresentação.
 * - O CET é sempre o INFORMADO pela instituição — este motor não calcula
 *   nem estima CET (uma parcela pode embutir IOF, seguros, tarifas e fluxos
 *   que uma estimativa simplificada não captura).
 * - Nenhuma saída recomenda contratação. O motor descreve: menor parcela,
 *   menor prazo, menor CET informado, menor total pago e os trade-offs.
 */

export interface ProposalInput {
  /** Rótulo exibido ("Proposta A"). Nunca armazenado fora do estado local. */
  label: string;
  /** Valor líquido recebido, em centavos */
  netAmountCents: number;
  /** Número de parcelas (inteiro ≥ 1) */
  installments: number;
  /** Valor de cada parcela, em centavos */
  installmentCents: number;
  /** CET anual informado na proposta, em % a.a. (opcional — "não sei") */
  cetAnnualPercent?: number;
  /** Taxa de juros informada (opcional) */
  interestRate?: { value: number; period: "monthly" | "annual" };
  /** Custos pagos FORA das parcelas, em centavos (opcional) */
  externalCostsCents?: number;
  /** Usuário marcou que pediram pagamento ANTES da liberação */
  upfrontPaymentRequested?: boolean;
}

export interface ProposalComputed {
  label: string;
  netAmountCents: number;
  installments: number;
  installmentCents: number;
  cetAnnualPercent?: number;
  interestRate?: { value: number; period: "monthly" | "annual" };
  /** Taxa efetiva anual equivalente da taxa informada (≠ CET), quando mensal */
  equivalentAnnualPercent?: number;
  externalCostsCents: number;
  upfrontPaymentRequested: boolean;
  /** parcelas × valor da parcela + custos externos */
  totalPaidCents: number;
  /** total pago − valor líquido recebido */
  nominalCostCents: number;
}

export type CriterionKey =
  | "lowestInstallment"
  | "shortestTerm"
  | "lowestCet"
  | "lowestTotalPaid";

export interface CriterionResult {
  key: CriterionKey;
  /** Índices das propostas empatadas no melhor valor (0-based) */
  winners: number[];
  /** null quando o critério não pode ser avaliado (ex.: CET ausente) */
  available: boolean;
}

export interface PairDifference {
  aIndex: number;
  bIndex: number;
  installmentDiffCents: number;
  termDiffMonths: number;
  totalPaidDiffCents: number;
  /** Diferença de CET em PONTOS PERCENTUAIS (não %); null se algum CET faltar */
  cetDiffPoints: number | null;
}

export interface ComparisonWarnings {
  /** Valores líquidos diferentes — total pago não decide sozinho */
  differentNetAmounts: boolean;
  /** Diferença relativa entre o maior e o menor valor líquido (0–1) */
  netAmountSpread: number;
  /** Alguma proposta sem CET informado */
  missingCet: boolean;
  /** Todas sem CET */
  allMissingCet: boolean;
  /** Alguma proposta com pedido de pagamento antecipado */
  upfrontPaymentFlag: boolean;
  /** Total pago menor que o valor recebido em alguma proposta (revisar dados) */
  totalBelowNet: number[];
}

export interface ComparisonResult {
  proposals: ProposalComputed[];
  criteria: CriterionResult[];
  /** Diferenças par a par (A×B, A×C, B×C) */
  pairs: PairDifference[];
  warnings: ComparisonWarnings;
  /** Índice da proposta que vence TODOS os critérios avaliáveis, se houver */
  dominantIndex: number | null;
}

/** Limiar acima do qual valores líquidos são tratados como "diferentes". */
const NET_AMOUNT_TOLERANCE = 0.02; // 2%

const MAX_CENTS = 1_000_000_000_00; // R$ 1 bilhão — limite técnico, não editorial
const MAX_INSTALLMENTS = 600;

export function validateProposal(p: ProposalInput): string[] {
  const errors: string[] = [];
  const name = p.label || "a proposta";
  if (!Number.isInteger(p.netAmountCents) || p.netAmountCents <= 0) {
    errors.push(`Informe quanto você recebe na ${name}.`);
  } else if (p.netAmountCents > MAX_CENTS) {
    errors.push(`O valor recebido da ${name} passou do limite técnico da ferramenta.`);
  }
  if (!Number.isInteger(p.installments) || p.installments < 1) {
    errors.push(`Informe o número de parcelas da ${name} (mínimo 1).`);
  } else if (p.installments > MAX_INSTALLMENTS) {
    errors.push(`Número de parcelas da ${name} acima do limite de ${MAX_INSTALLMENTS}.`);
  }
  if (!Number.isInteger(p.installmentCents) || p.installmentCents <= 0) {
    errors.push(`Informe o valor da parcela da ${name}.`);
  } else if (p.installmentCents > MAX_CENTS) {
    errors.push(`O valor da parcela da ${name} passou do limite técnico da ferramenta.`);
  }
  if (p.cetAnnualPercent !== undefined) {
    if (!Number.isFinite(p.cetAnnualPercent) || p.cetAnnualPercent < 0) {
      errors.push(`O CET da ${name} não pode ser negativo.`);
    } else if (p.cetAnnualPercent > 10_000) {
      errors.push(`O CET da ${name} parece fora de escala — confira se está em % ao ano.`);
    }
  }
  if (p.interestRate !== undefined) {
    if (!Number.isFinite(p.interestRate.value) || p.interestRate.value < 0) {
      errors.push(`A taxa de juros da ${name} não pode ser negativa.`);
    } else if (p.interestRate.value > 10_000) {
      errors.push(`A taxa de juros da ${name} parece fora de escala.`);
    }
  }
  if (p.externalCostsCents !== undefined) {
    if (!Number.isInteger(p.externalCostsCents) || p.externalCostsCents < 0) {
      errors.push(`Custos fora das parcelas da ${name} não podem ser negativos.`);
    }
  }
  return errors;
}

/** (1 + i_mensal)^12 − 1, em %. Equivalência efetiva composta — NÃO é CET. */
export function monthlyToEquivalentAnnual(monthlyPercent: number): number {
  return (Math.pow(1 + monthlyPercent / 100, 12) - 1) * 100;
}

function computeProposal(p: ProposalInput): ProposalComputed {
  const externalCostsCents = p.externalCostsCents ?? 0;
  // Inteiros: multiplicação exata dentro do limite (600 × 10^11 < 2^53).
  const totalPaidCents = p.installments * p.installmentCents + externalCostsCents;
  return {
    label: p.label,
    netAmountCents: p.netAmountCents,
    installments: p.installments,
    installmentCents: p.installmentCents,
    cetAnnualPercent: p.cetAnnualPercent,
    interestRate: p.interestRate,
    equivalentAnnualPercent:
      p.interestRate?.period === "monthly"
        ? monthlyToEquivalentAnnual(p.interestRate.value)
        : p.interestRate?.period === "annual"
          ? p.interestRate.value
          : undefined,
    externalCostsCents,
    upfrontPaymentRequested: p.upfrontPaymentRequested ?? false,
    totalPaidCents,
    nominalCostCents: totalPaidCents - p.netAmountCents,
  };
}

function winnersBy<T>(
  items: T[],
  value: (item: T) => number | undefined,
): { winners: number[]; available: boolean } {
  const values = items.map(value);
  if (values.some((v) => v === undefined)) {
    return { winners: [], available: false };
  }
  const min = Math.min(...(values as number[]));
  return {
    winners: values.flatMap((v, i) => (v === min ? [i] : [])),
    available: true,
  };
}

export function compareProposals(inputs: ProposalInput[]): ComparisonResult {
  if (inputs.length < 2 || inputs.length > 3) {
    throw new Error("Compare 2 ou 3 propostas.");
  }
  const allErrors = inputs.flatMap(validateProposal);
  if (allErrors.length > 0) {
    throw new Error(allErrors.join(" "));
  }

  const proposals = inputs.map(computeProposal);

  const criteria: CriterionResult[] = [
    { key: "lowestInstallment", ...winnersBy(proposals, (p) => p.installmentCents) },
    { key: "shortestTerm", ...winnersBy(proposals, (p) => p.installments) },
    { key: "lowestCet", ...winnersBy(proposals, (p) => p.cetAnnualPercent) },
    { key: "lowestTotalPaid", ...winnersBy(proposals, (p) => p.totalPaidCents) },
  ];

  const pairs: PairDifference[] = [];
  for (let a = 0; a < proposals.length; a++) {
    for (let b = a + 1; b < proposals.length; b++) {
      const pa = proposals[a]!;
      const pb = proposals[b]!;
      pairs.push({
        aIndex: a,
        bIndex: b,
        installmentDiffCents: pb.installmentCents - pa.installmentCents,
        termDiffMonths: pb.installments - pa.installments,
        totalPaidDiffCents: pb.totalPaidCents - pa.totalPaidCents,
        cetDiffPoints:
          pa.cetAnnualPercent !== undefined && pb.cetAnnualPercent !== undefined
            ? pb.cetAnnualPercent - pa.cetAnnualPercent
            : null,
      });
    }
  }

  const nets = proposals.map((p) => p.netAmountCents);
  const minNet = Math.min(...nets);
  const maxNet = Math.max(...nets);
  const netAmountSpread = maxNet === 0 ? 0 : (maxNet - minNet) / maxNet;

  const warnings: ComparisonWarnings = {
    differentNetAmounts: netAmountSpread > NET_AMOUNT_TOLERANCE,
    netAmountSpread,
    missingCet: proposals.some((p) => p.cetAnnualPercent === undefined),
    allMissingCet: proposals.every((p) => p.cetAnnualPercent === undefined),
    upfrontPaymentFlag: proposals.some((p) => p.upfrontPaymentRequested),
    totalBelowNet: proposals.flatMap((p, i) =>
      p.totalPaidCents < p.netAmountCents ? [i] : [],
    ),
  };

  // Dominante: vence (possivelmente empatada) todos os critérios avaliáveis.
  // Com valores líquidos diferentes, total pago não permite conclusão de
  // dominância — o conceito deixa de valer.
  let dominantIndex: number | null = null;
  if (!warnings.differentNetAmounts) {
    const available = criteria.filter((c) => c.available);
    if (available.length >= 3) {
      for (let i = 0; i < proposals.length; i++) {
        if (available.every((c) => c.winners.includes(i))) {
          dominantIndex = i;
          break;
        }
      }
    }
  }

  return { proposals, criteria, pairs, warnings, dominantIndex };
}

/* ---------- Formatação (apresentação apenas) ---------- */

export function formatCentsBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export function formatPercentBR(value: number, digits = 2): string {
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;
}

/** "R$ 1.234,56" / "1234,56" / "1234.56" / "1234" → centavos (inteiro). */
export function parseBRLToCents(raw: string): number | null {
  let s = raw.replace(/[R$\s]/g, "");
  if (s.includes(",")) {
    // Formato pt-BR: "." é milhar, "," é decimal.
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    // Sem vírgula: "." final com 1–2 dígitos é decimal ("1234.56");
    // com 3 dígitos é separador de milhar ("10.000").
    const lastDot = s.lastIndexOf(".");
    if (lastDot !== -1) {
      const decimals = s.length - lastDot - 1;
      s =
        decimals >= 1 && decimals <= 2
          ? s.slice(0, lastDot).replace(/\./g, "") + "." + s.slice(lastDot + 1)
          : s.replace(/\./g, "");
    }
  }
  if (s === "" || !/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

/** "32,4" / "32.4" → número; null se inválido. */
export function parsePercentBR(raw: string): number | null {
  const cleaned = raw.replace(/[%\s]/g, "").replace(",", ".");
  if (cleaned === "" || !/^\d+(\.\d+)?$/.test(cleaned)) return null;
  return Number(cleaned);
}

/** Resumo em texto puro para o botão "Copiar resumo" — sem recomendação. */
export function buildSummaryText(result: ComparisonResult): string {
  const lines = result.proposals.map((p) => {
    const cet =
      p.cetAnnualPercent !== undefined
        ? `CET informado ${formatPercentBR(p.cetAnnualPercent)} a.a.`
        : "CET não informado";
    const extras =
      p.externalCostsCents > 0
        ? `, custos fora das parcelas ${formatCentsBRL(p.externalCostsCents)}`
        : "";
    return `${p.label}: recebe ${formatCentsBRL(p.netAmountCents)}, ${p.installments}x ${formatCentsBRL(p.installmentCents)}, total ${formatCentsBRL(p.totalPaidCents)}${extras}, ${cet}`;
  });

  const diffs: string[] = [];
  for (const pair of result.pairs) {
    const a = result.proposals[pair.aIndex]?.label ?? "Proposta";
    const b = result.proposals[pair.bIndex]?.label ?? "Proposta";
    const parts: string[] = [];
    if (pair.installmentDiffCents !== 0) {
      const who = pair.installmentDiffCents < 0 ? b : a;
      parts.push(
        `${who} tem parcela ${formatCentsBRL(Math.abs(pair.installmentDiffCents))} menor`,
      );
    }
    if (pair.termDiffMonths !== 0) {
      const who = pair.termDiffMonths < 0 ? b : a;
      parts.push(`${who} termina ${Math.abs(pair.termDiffMonths)} meses antes`);
    }
    if (pair.totalPaidDiffCents !== 0) {
      const who = pair.totalPaidDiffCents < 0 ? b : a;
      parts.push(
        `${who} custa ${formatCentsBRL(Math.abs(pair.totalPaidDiffCents))} menos no total`,
      );
    }
    if (pair.cetDiffPoints !== null && pair.cetDiffPoints !== 0) {
      const who = pair.cetDiffPoints < 0 ? b : a;
      parts.push(
        `${who} tem CET informado ${formatPercentBR(Math.abs(pair.cetDiffPoints))} p.p. menor`,
      );
    }
    if (parts.length > 0) diffs.push(`${a} × ${b}: ${parts.join("; ")}.`);
  }

  return [
    ...lines,
    ...diffs,
    "Comparação feita no Comparador de Propostas do Crédito por Perto (valores informados pelo usuário; não é recomendação de contratação).",
  ].join("\n");
}
