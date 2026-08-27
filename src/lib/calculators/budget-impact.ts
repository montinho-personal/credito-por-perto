/**
 * Motor da ferramenta "Quanto de parcela cabe no meu orçamento?".
 *
 * SIMULADOR DE IMPACTO — não um aprovador de parcela.
 *
 * Princípios:
 * - Nenhum percentual fixo de renda funciona como veredito ("até 30% é
 *   seguro" NÃO existe aqui). Percentuais aparecem só como contexto, e a
 *   métrica central é a FOLGA: o que sobra depois que a vida acontece.
 * - "Folga com base nos valores informados" — nunca "renda disponível real"
 *   ou "capacidade financeira": a ferramenta organiza o que a pessoa
 *   informou, não conhece o que ela não informou.
 * - Orçamento negativo é aceito e mostrado sem julgamento.
 * - Dinheiro em centavos inteiros; percentuais calculados apenas quando o
 *   denominador é positivo (renda zero não divide nada).
 * - Determinístico e auditável — sem IA, sem score, sem semáforo.
 */

export interface BudgetInput {
  /** Renda líquida mensal (o que efetivamente entra) */
  monthlyNetIncomeCents: number;
  /** Despesas essenciais e recorrentes */
  recurringExpensesCents: number;
  /** Parcelas/dívidas já existentes */
  existingDebtPaymentsCents: number;
  /** Provisão mensal para gastos que não acontecem todo mês (opcional) */
  monthlyProvisionsCents: number;
  /** Reserva/folga que a pessoa quer preservar por mês (opcional) */
  desiredBufferCents: number | null;
  /** Nova parcela avaliada */
  newInstallmentCents: number;
  /** A renda varia bastante de um mês para outro? */
  incomeVaries: boolean;
}

export type BudgetWarning =
  | "already-negative"
  | "installment-exceeds-free-cash"
  | "consumes-all-free-cash"
  | "buffer-not-preserved"
  | "income-varies"
  | "income-zero";

export interface BudgetImpactResult {
  /** R − D − P − O: folga antes da nova parcela */
  freeCashBeforeCents: number;
  /** folga − nova parcela */
  freeCashAfterCents: number;
  /** folga após parcela − reserva desejada (null sem reserva) */
  freeCashAfterBufferCents: number | null;
  /** nova parcela / renda (%; null quando renda = 0) */
  installmentIncomeRatio: number | null;
  /** (parcelas existentes + nova) / renda (%; null quando renda = 0) */
  totalDebtIncomeRatio: number | null;
  /** nova parcela / folga antes (%; null quando folga antes ≤ 0) */
  installmentFreeCashRatio: number | null;
  /** Quanto a parcela ultrapassa a folga (0 quando não ultrapassa) */
  monthlyDeficitCents: number;
  warnings: BudgetWarning[];
  /** Frases determinísticas do resultado, em ordem */
  sentences: string[];
}

function brl(cents: number): string {
  const abs = Math.abs(cents);
  const reais = Math.floor(abs / 100);
  const c = String(abs % 100).padStart(2, "0");
  return `R$ ${reais.toLocaleString("pt-BR")},${c}`;
}

function pct(value: number): string {
  return `${value.toFixed(1).replace(".", ",")}%`;
}

export function computeBudgetImpact(input: BudgetInput): BudgetImpactResult {
  const {
    monthlyNetIncomeCents: income,
    recurringExpensesCents: expenses,
    existingDebtPaymentsCents: debts,
    monthlyProvisionsCents: provisions,
    desiredBufferCents: buffer,
    newInstallmentCents: installment,
    incomeVaries,
  } = input;

  const warnings: BudgetWarning[] = [];
  const sentences: string[] = [];

  const freeCashBeforeCents = income - expenses - debts - provisions;
  const freeCashAfterCents = freeCashBeforeCents - installment;
  const freeCashAfterBufferCents = buffer !== null ? freeCashAfterCents - buffer : null;

  const installmentIncomeRatio = income > 0 ? (installment / income) * 100 : null;
  const totalDebtIncomeRatio = income > 0 ? ((debts + installment) / income) * 100 : null;
  const installmentFreeCashRatio =
    freeCashBeforeCents > 0 ? (installment / freeCashBeforeCents) * 100 : null;

  const monthlyDeficitCents = freeCashAfterCents < 0 ? -freeCashAfterCents : 0;

  if (income === 0) warnings.push("income-zero");
  if (incomeVaries) warnings.push("income-varies");

  /* --- frases --- */
  if (freeCashBeforeCents < 0) {
    warnings.push("already-negative");
    sentences.push(
      `Pelos valores informados, seu orçamento já está negativo em aproximadamente ${brl(freeCashBeforeCents)} antes da nova parcela.`,
    );
    if (installment > 0) {
      sentences.push(
        `Uma nova parcela de ${brl(installment)} aumentaria esse déficit para aproximadamente ${brl(freeCashAfterCents)} por mês.`,
      );
    }
  } else if (installment > freeCashBeforeCents) {
    warnings.push("installment-exceeds-free-cash");
    sentences.push(
      `A nova parcela ultrapassaria a folga mensal informada em aproximadamente ${brl(monthlyDeficitCents)}: despesas, compromissos e nova parcela somariam mais que a renda.`,
    );
  } else if (installment === freeCashBeforeCents && installment > 0) {
    warnings.push("consumes-all-free-cash");
    sentences.push(
      "A nova parcela consumiria toda a folga informada. Isso não significa automaticamente inadimplência, mas deixa menos espaço para gastos não previstos.",
    );
  } else if (installment > 0) {
    sentences.push(
      `A parcela reduziria sua folga mensal de ${brl(freeCashBeforeCents)} para ${brl(freeCashAfterCents)}.`,
    );
  } else {
    sentences.push(
      `Sem nova parcela, sua folga mensal informada é de ${brl(freeCashBeforeCents)}.`,
    );
  }

  if (installmentIncomeRatio !== null && installmentFreeCashRatio !== null && installment > 0) {
    sentences.push(
      `Pela renda, a parcela representa ${pct(installmentIncomeRatio)}. Pela folga informada, ela consome ${pct(installmentFreeCashRatio)}.`,
    );
  } else if (income === 0) {
    sentences.push(
      "Sem renda mensal informada, não conseguimos calcular o impacto percentual da parcela.",
    );
  }

  if (
    buffer !== null &&
    freeCashAfterBufferCents !== null &&
    freeCashAfterCents >= 0 &&
    freeCashAfterBufferCents < 0
  ) {
    warnings.push("buffer-not-preserved");
    sentences.push(
      `A parcela não consumiria toda a folga, mas deixaria ${brl(freeCashAfterBufferCents)} a menos do que a margem de ${brl(buffer)} que você gostaria de preservar.`,
    );
  }

  if (incomeVaries) {
    sentences.push(
      "Como sua renda varia, considere também como essa parcela se comportaria em um mês mais fraco.",
    );
  }

  return {
    freeCashBeforeCents,
    freeCashAfterCents,
    freeCashAfterBufferCents,
    installmentIncomeRatio,
    totalDebtIncomeRatio,
    installmentFreeCashRatio,
    monthlyDeficitCents,
    warnings,
    sentences,
  };
}
