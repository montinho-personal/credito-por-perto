/**
 * Auditoria de fontes: todo artigo publicado precisa de registro de fontes
 * (SourceLedger) com datas de consulta válidas; gera relatório de frescor
 * para orientar re-verificação periódica.
 */
import { getAllArticles } from "../src/lib/content/articles";
import { getSourceLedger } from "../src/lib/content/ledgers";
import { ADVANCE_RULES, SAQUE_TABLE, TERMINATION_RULES } from "../src/lib/calculators/fgts-rules";
import { IOF_RULES_VERIFIED_AT } from "../src/lib/calculators/iof-credit-rules";
import { CET_RULES } from "../src/lib/calculators/cet";
import { BPP_RULES } from "../src/lib/calculators/bpp-rules";
import {
  buildReport,
  finishAudit,
  writeJsonReport,
  type Finding,
} from "./lib/audit-helpers";

const STALE_AFTER_DAYS = 180;

const findings: Finding[] = [];
const today = new Date();

for (const article of getAllArticles()) {
  const fm = article.frontmatter;
  const published = fm.status === "published";
  const ledger = getSourceLedger(fm.slug);

  if (!ledger || ledger.claims.length === 0) {
    findings.push({
      severity: published ? "critical" : "warning",
      rule: "sem-registro-de-fontes",
      pages: [article.urlPath],
      detail: "Artigo sem SourceLedger com afirmações e fontes.",
    });
    continue;
  }

  if (ledger.articleSlug !== fm.slug) {
    findings.push({
      severity: "critical",
      rule: "ledger-slug-divergente",
      pages: [article.urlPath],
      detail: `Ledger aponta para "${ledger.articleSlug}".`,
    });
  }

  for (const claim of ledger.claims) {
    const accessed = new Date(`${claim.accessedAt}T00:00:00Z`);
    if (Number.isNaN(accessed.getTime())) {
      findings.push({
        severity: "critical",
        rule: "data-de-consulta-invalida",
        pages: [article.urlPath],
        detail: `Claim ${claim.claimId} com accessedAt inválido.`,
      });
      continue;
    }
    if (accessed.getTime() > today.getTime()) {
      findings.push({
        severity: "critical",
        rule: "data-de-consulta-futura",
        pages: [article.urlPath],
        detail: `Claim ${claim.claimId} com data de consulta no futuro.`,
      });
    }
    const ageDays = (today.getTime() - accessed.getTime()) / 86_400_000;
    if (published && ageDays > STALE_AFTER_DAYS) {
      findings.push({
        severity: "warning",
        rule: "fonte-precisa-reverificacao",
        pages: [article.urlPath],
        detail: `Claim ${claim.claimId} consultado há ${Math.round(ageDays)} dias — re-verificar.`,
      });
    }
  }

  if (published && !fm.sourceCheckedAt) {
    findings.push({
      severity: "warning",
      rule: "sem-source-checked-at",
      pages: [article.urlPath],
      detail: "Artigo publicado sem data de verificação de fontes no frontmatter.",
    });
  }
}

/*
 * Regras normativas das ferramentas: o módulo guarda a data de verificação
 * (DD/MM/AAAA). Velha demais vira aviso — e aviso segura a publicação, que é
 * o lembrete de reler a fonte oficial. Troca de regra próxima vira nota.
 */
const RULE_MODULES: Array<{ name: string; verifiedAt: string; page?: string }> = [
  { name: "FGTS — tabela do Saque-Aniversário", verifiedAt: SAQUE_TABLE.verifiedAt },
  { name: "FGTS — antecipação do Saque-Aniversário", verifiedAt: ADVANCE_RULES.verifiedAt },
  { name: "FGTS — rescisão e retorno", verifiedAt: TERMINATION_RULES.verifiedAt },
  { name: "IOF-crédito — alíquotas, limite e decisão judicial", verifiedAt: IOF_RULES_VERIFIED_AT, page: "/calculadoras/iof-emprestimo/" },
  { name: "CET — Resolução CMN 4.881 e IN BCB 83", verifiedAt: CET_RULES.verifiedAt, page: "/calculadoras/cet/" },
  { name: "Banco do Povo Paulista — valores, juros, prazo e requisitos", verifiedAt: BPP_RULES.verifiedAt, page: "/calculadoras/simulador-banco-do-povo/" },
];
const RULE_STALE_DAYS = 120;
for (const rule of RULE_MODULES) {
  const [d, m, y] = rule.verifiedAt.split("/").map(Number);
  const verified = new Date(Date.UTC(y!, m! - 1, d!));
  const age = Math.floor((today.getTime() - verified.getTime()) / 86_400_000);
  if (Number.isNaN(age)) {
    findings.push({ severity: "critical", rule: "regra-sem-data", pages: [rule.page ?? "/calculadoras/antecipacao-fgts/"], detail: `${rule.name}: data de verificação inválida.` });
  } else if (age > RULE_STALE_DAYS) {
    findings.push({ severity: "warning", rule: "regra-precisa-reverificacao", pages: [rule.page ?? "/calculadoras/antecipacao-fgts/"], detail: `${rule.name}: verificada há ${age} dias — reler a fonte oficial e atualizar verifiedAt.` });
  }
}
for (const period of ADVANCE_RULES.periods) {
  const days = Math.ceil((new Date(`${period.from}T00:00:00Z`).getTime() - today.getTime()) / 86_400_000);
  if (days > 0 && days <= 45) {
    findings.push({ severity: "info", rule: "troca-de-regra-proxima", pages: ["/calculadoras/antecipacao-fgts/"], detail: `FGTS: a partir de ${period.from}, até ${period.maxSaques} saques (em ${days} dias). Conferir se a norma continua a mesma.` });
  }
}

const report = buildReport("frescor-de-fontes", findings);
writeJsonReport("source-freshness-report.json", report);
finishAudit(report);
