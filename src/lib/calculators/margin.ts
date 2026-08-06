/**
 * Cálculo educativo de margem consignável.
 *
 * Os percentuais são definidos em lei/normas e MUDAM ao longo do tempo.
 * Mantenha-os aqui (única fonte no código), com a data de verificação, e
 * confirme a regra vigente nas fontes oficiais antes de qualquer atualização.
 */

export const MARGIN_RULES = {
  /** Verificado em fontes oficiais nesta data — ver docs/pauta-seo.md e ledger do artigo. */
  verifiedAt: "2026-08-06",
  inss: {
    label: "Aposentado ou pensionista do INSS",
    loanPercent: 35,
    cardPercent: 5,
    benefitCardPercent: 5,
    legalBasis: "Lei nº 10.820/2003 e normas do INSS (percentuais vigentes na data de verificação)",
  },
  clt: {
    label: "Trabalhador CLT (Crédito do Trabalhador)",
    loanPercent: 35,
    cardPercent: 5,
    benefitCardPercent: 0,
    legalBasis: "Lei nº 10.820/2003, alterada pela Lei nº 15.179/2025",
  },
} as const;

export type MarginProfile = keyof Omit<typeof MARGIN_RULES, "verifiedAt">;

export interface MarginInput {
  profile: MarginProfile;
  /** Renda/benefício líquido mensal em reais */
  netIncome: number;
  /** Soma das parcelas mensais de consignados já ativos */
  currentLoanPayments: number;
}

export interface MarginResult {
  loanLimit: number;
  loanAvailable: number;
  cardReserve: number;
  benefitCardReserve: number;
  totalCommittable: number;
}

export function validateMarginInput(input: MarginInput): string[] {
  const errors: string[] = [];
  if (!Number.isFinite(input.netIncome) || input.netIncome <= 0) {
    errors.push("Informe uma renda ou benefício líquido maior que zero.");
  }
  if (
    !Number.isFinite(input.currentLoanPayments) ||
    input.currentLoanPayments < 0
  ) {
    errors.push("As parcelas atuais não podem ser negativas.");
  }
  return errors;
}

export function calculateMargin(input: MarginInput): MarginResult {
  const errors = validateMarginInput(input);
  if (errors.length > 0) throw new Error(errors.join(" "));
  const rule = MARGIN_RULES[input.profile];
  const loanLimit = (input.netIncome * rule.loanPercent) / 100;
  const cardReserve = (input.netIncome * rule.cardPercent) / 100;
  const benefitCardReserve = (input.netIncome * rule.benefitCardPercent) / 100;
  return {
    loanLimit,
    loanAvailable: Math.max(0, loanLimit - input.currentLoanPayments),
    cardReserve,
    benefitCardReserve,
    totalCommittable: loanLimit + cardReserve + benefitCardReserve,
  };
}
