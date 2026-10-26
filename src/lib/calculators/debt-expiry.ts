/**
 * QUANDO A DÍVIDA SAI DO NOME
 * ============================================================================
 *
 * Duas datas de referência a partir do vencimento informado:
 *
 * 1. Fim do prazo de permanência no cadastro de inadimplentes. O CDC limita
 *    as informações negativas a 5 anos (art. 43, § 1º; Súmula 323 do STJ). A
 *    Quarta Turma do STJ (REsp 2.095.414, 2024, por maioria, Informativo 817)
 *    fixou que os 5 anos contam do primeiro dia seguinte ao vencimento.
 *
 * 2. Prescrição da cobrança judicial de dívida líquida em documento: 5 anos
 *    (Código Civil, art. 206, § 5º, I), a partir do vencimento, quando nasce a
 *    pretensão (art. 189).
 *
 * Contagem: prazos em anos expiram no dia de igual número do de início, ou
 * no imediato se faltar correspondência (Código Civil, art. 132, § 3º):
 * 29/02 + 5 anos cai em 01/03, ver `addYearsCivil`.
 *
 * O módulo NÃO conclui nada sobre a cobrança: interrupção da prescrição
 * (art. 202), protesto em cartório e novos acordos mudam as datas, e a
 * página diz isso ao lado do resultado.
 */
import { addDays, addMonths, daysBetween, isIsoDate } from "@/lib/calculators/civil-date";

export const REGISTRY_YEARS = 5;
export const PRESCRIPTION_YEARS = 5;

/**
 * Soma anos pela regra do art. 132, § 3º: expira no dia de igual número; se
 * o dia não existir no ano final (29/02), expira no imediato (01/03).
 */
export function addYearsCivil(isoDate: string, years: number): string {
  const [, m, d] = isoDate.split("-").map(Number) as [number, number, number];
  const target = addMonths(isoDate, years * 12);
  const [, tm, td] = target.split("-").map(Number) as [number, number, number];
  // addMonths encosta no último dia do mês; o Código Civil manda para o dia seguinte.
  if (tm === m && td !== d) return addDays(target, 1);
  return target;
}

export type DebtExpiryInput = {
  /** Vencimento da dívida (AAAA-MM-DD). */
  dueIso: string;
  /** Hoje (AAAA-MM-DD), injetado para teste. */
  todayIso: string;
};

export type DeadlineStatus =
  | { kind: "futuro"; days: number }
  | { kind: "hoje" }
  | { kind: "passou"; days: number };

export type DebtExpiryResult = {
  /** Primeiro dia da contagem do cadastro: dia seguinte ao vencimento. */
  registryStartIso: string;
  /** Dia em que se completam os 5 anos de permanência no cadastro. */
  registryEndIso: string;
  registryStatus: DeadlineStatus;
  /** Dia em que se completam os 5 anos da prescrição da cobrança judicial. */
  prescriptionEndIso: string;
  prescriptionStatus: DeadlineStatus;
};

export type DebtExpiryIssue = "data-invalida" | "vencimento-no-futuro" | "vencimento-muito-antigo";

export type DebtExpiryOutcome =
  | { kind: "ok"; result: DebtExpiryResult }
  | { kind: "invalid"; issue: DebtExpiryIssue };

/** Vencimentos anteriores a isto ficam fora: a conta perde sentido prático. */
export const OLDEST_DUE_ISO = "1990-01-01";

function status(todayIso: string, deadlineIso: string): DeadlineStatus {
  const diff = daysBetween(todayIso, deadlineIso);
  if (diff > 0) return { kind: "futuro", days: diff };
  if (diff === 0) return { kind: "hoje" };
  return { kind: "passou", days: -diff };
}

export function computeDebtExpiry(input: DebtExpiryInput): DebtExpiryOutcome {
  const { dueIso, todayIso } = input;
  if (!isIsoDate(dueIso) || !isIsoDate(todayIso)) return { kind: "invalid", issue: "data-invalida" };
  if (dueIso < OLDEST_DUE_ISO) return { kind: "invalid", issue: "vencimento-muito-antigo" };
  if (dueIso > todayIso) return { kind: "invalid", issue: "vencimento-no-futuro" };

  const registryStartIso = addDays(dueIso, 1);
  const registryEndIso = addYearsCivil(registryStartIso, REGISTRY_YEARS);
  const prescriptionEndIso = addYearsCivil(dueIso, PRESCRIPTION_YEARS);

  return {
    kind: "ok",
    result: {
      registryStartIso,
      registryEndIso,
      registryStatus: status(todayIso, registryEndIso),
      prescriptionEndIso,
      prescriptionStatus: status(todayIso, prescriptionEndIso),
    },
  };
}

/** "3 anos, 2 meses e 5 dias" aproximado por dias, para leitura humana. */
export function describeDays(days: number): string {
  if (days < 31) return days === 1 ? "1 dia" : `${days} dias`;
  const years = Math.floor(days / 365);
  const months = Math.floor((days - years * 365) / 30.44);
  const parts: string[] = [];
  if (years > 0) parts.push(years === 1 ? "1 ano" : `${years} anos`);
  if (months > 0) parts.push(months === 1 ? "1 mês" : `${months} meses`);
  if (parts.length === 0) parts.push(`${days} dias`);
  return `cerca de ${parts.join(" e ")}`;
}
