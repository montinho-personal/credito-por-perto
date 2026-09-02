/**
 * Auditoria de qualidade das páginas locais (docs/local-content-policy.md).
 *
 * Uma página local só pode estar publicada/indexável com: classificação
 * administrativa correta, dossiê com fontes oficiais verificadas, recurso
 * local acionável, data de verificação e conteúdo que não dependa da troca
 * do nome da cidade (essa última checagem vive em audit-originality).
 */
import { getAllLocalGuides, getLocalDossier } from "../src/lib/content/local";
import { getLocalities } from "../src/lib/local-seo/states";
import {
  buildReport,
  finishAudit,
  writeJsonReport,
  type Finding,
} from "./lib/audit-helpers";

const findings: Finding[] = [];
const localities = getLocalities();

for (const guide of getAllLocalGuides()) {
  const fm = guide.frontmatter;
  const published = fm.status === "published";

  /* Classificação administrativa deve bater com a base de localidades */
  const locality = localities.find(
    (l) =>
      l.stateCode === fm.stateCode &&
      (l.citySlug ?? "") === (fm.citySlug ?? "") &&
      (l.districtSlug ?? "") === (fm.districtSlug ?? ""),
  );
  if (!locality) {
    findings.push({
      severity: "critical",
      rule: "localidade-fora-da-base",
      pages: [guide.urlPath],
      detail: "Localidade não cadastrada em data/localities.json.",
    });
  } else if (locality.localityType !== fm.localityType) {
    findings.push({
      severity: "critical",
      rule: "classificacao-administrativa-divergente",
      pages: [guide.urlPath],
      detail: `Frontmatter diz "${fm.localityType}", base diz "${locality.localityType}".`,
    });
  }

  /* Regiões multi-município (ex.: Alphaville) precisam declarar municípios */
  if (
    fm.localityType === "region" &&
    (!fm.municipalitiesInvolved || fm.municipalitiesInvolved.length === 0)
  ) {
    findings.push({
      severity: "critical",
      rule: "regiao-sem-municipios-declarados",
      pages: [guide.urlPath],
      detail: "Região sem municipalitiesInvolved no frontmatter.",
    });
  }

  const dossier = fm.dossierId ? getLocalDossier(fm.dossierId) : undefined;
  if (!dossier) {
    findings.push({
      severity: published ? "critical" : "warning",
      rule: "sem-dossie-local",
      pages: [guide.urlPath],
      detail: "Guia local sem dossiê estruturado (LocalEvidence).",
    });
    continue;
  }

  if (published) {
    if (dossier.officialSources.length === 0) {
      findings.push({
        severity: "critical",
        rule: "publicada-sem-fonte-oficial",
        pages: [guide.urlPath],
        detail: "Página local publicada sem fonte oficial verificada no dossiê.",
      });
    }
    if (dossier.consumerProtectionResources.length === 0) {
      findings.push({
        severity: "critical",
        rule: "publicada-sem-recurso-local-acionavel",
        pages: [guide.urlPath],
        detail:
          "Página local publicada sem canal de proteção ao consumidor verificado.",
      });
    }
    if (!fm.lastVerifiedAt) {
      findings.push({
        severity: "critical",
        rule: "publicada-sem-data-de-verificacao",
        pages: [guide.urlPath],
        detail: "Página local publicada sem data real de verificação.",
      });
    }
    if (fm.noindex) {
      findings.push({
        severity: "warning",
        rule: "publicada-com-noindex",
        pages: [guide.urlPath],
        detail: "Guia publicado mas marcado noindex — estado inconsistente.",
      });
    }
  } else {
    if (!fm.noindex) {
      findings.push({
        severity: "critical",
        rule: "rascunho-sem-noindex",
        pages: [guide.urlPath],
        detail: "Guia local em rascunho sem noindex explícito.",
      });
    }
    if ((dossier.pendingVerification ?? []).length === 0) {
      findings.push({
        severity: "warning",
        rule: "rascunho-sem-pendencias-registradas",
        pages: [guide.urlPath],
        detail:
          "Rascunho sem lista de verificações pendentes — registrar o que falta.",
      });
    }
  }
}

/* ------------------------------------------------------------------ */
/* Ponte regional: todo guia publicado aponta para os vizinhos         */
/* ------------------------------------------------------------------ */

/**
 * A seção "Região: os guias vizinhos" nasceu no lote de Campinas, em 24/08, e
 * nunca foi aplicada aos guias anteriores. Ninguém percebeu por dez dias
 * porque nada olhava — e o efeito medido foi duro: 10 dos 24 guias não
 * recebiam link editorial de lugar nenhum, contra ZERO artigos órfãos do lado
 * nacional. A camada mais defensável do portal era a que recebia menos
 * autoridade interna.
 *
 * O índice do estado lista todos os guias, então nenhum era invisível ao
 * rastreamento. Mas listagem programática não é o mesmo que link editorial:
 * é o segundo que diz ao buscador, e ao leitor, que aquela página vale a
 * visita — e é o segundo que faltava.
 *
 * A regra é AVISO e não crítico porque existe um caso legítimo de guia sem
 * vizinho: a primeira cidade de um estado novo. Por isso a checagem só fala
 * quando há outro guia publicado no mesmo estado — aí a ausência é esquecimento,
 * não geografia.
 *
 * POR QUE CONTAR LINK, E NÃO PROCURAR O TÍTULO DA SEÇÃO
 *
 * A primeira versão desta regra procurava o cabeçalho "Região: os guias
 * vizinhos" e acusou Campinas e Valinhos, que TÊM a ponte — só que sob
 * "Região metropolitana: os guias vizinhos" e "Vizinhos: Campinas e Vinhedo".
 * Estava medindo a formatação em vez do efeito.
 *
 * O que importa é o link existir: é ele que leva o leitor à cidade vizinha e
 * transfere autoridade. Contar links também fecha a brecha oposta — um
 * cabeçalho certo com lista vazia passaria pela busca de texto e não passa
 * por esta.
 */
const MIN_VIZINHOS = 2;

const publicados = getAllLocalGuides().filter(
  (g) => g.frontmatter.status === "published" && !g.frontmatter.noindex,
);
const porEstado = new Map<string, number>();
for (const g of publicados) {
  const uf = g.frontmatter.stateCode;
  porEstado.set(uf, (porEstado.get(uf) ?? 0) + 1);
}

for (const guide of publicados) {
  if ((porEstado.get(guide.frontmatter.stateCode) ?? 0) < 2) continue;

  /* Casamento exato do link markdown: `/emprestimos/sp/barueri/` é prefixo de
     `/emprestimos/sp/barueri/alphaville/`, e um `includes` solto contaria a
     região como se fosse o município. */
  const vizinhos = publicados.filter(
    (outro) =>
      outro.urlPath !== guide.urlPath &&
      outro.frontmatter.stateCode === guide.frontmatter.stateCode &&
      guide.content.includes(`](${outro.urlPath})`),
  );

  if (vizinhos.length >= MIN_VIZINHOS) continue;

  findings.push({
    severity: "warning",
    rule: "guia-sem-ponte-regional",
    pages: [guide.urlPath],
    detail: `O guia aponta para ${vizinhos.length} guia(s) vizinho(s); o mínimo é ${MIN_VIZINHOS}. Sem essa ponte a cidade fica fora da malha de links do cluster local — o índice do estado ainda a lista, mas nenhum guia vizinho aponta para ela, e é o link editorial que transfere autoridade.`,
  });
}

const report = buildReport("qualidade-local", findings);
writeJsonReport("local-quality-report.json", report);
finishAudit(report);
