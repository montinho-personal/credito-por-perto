/**
 * Mapa Financeiro da Cidade — apresentação.
 *
 * Regras que o desenho carrega:
 *
 * - cada card diz de quem é o serviço, o que ele resolve e como chegar. Nunca
 *   "o melhor", "recomendado" ou qualquer ordenação de qualidade. A ordem é a
 *   do alcance: cidade → estado → país;
 * - a etiqueta de alcance é obrigatória. Um leitor precisa distinguir num
 *   relance o Procon da rua dele de uma plataforma federal;
 * - a data de verificação aparece em todo card. Informação de serviço público
 *   envelhece, e esconder isso seria o mesmo que mentir devagar;
 * - nenhum bloco de publicidade entra nesta seção. Um anúncio ao lado de uma
 *   lista de órgãos públicos seria lido como serviço oficial — é a confusão
 *   mais cara que uma página de utilidade pode provocar.
 */
import {
  CATEGORY_LABEL,
  groupByCategory,
  isLocalCoverage,
  type CoverageType,
  type FinancialResource,
} from "@/lib/local/financial-map";
import { stalenessNotice } from "@/lib/local/resource-health";
import type { CityFinancialMap as CityMap } from "@/lib/local/city-map";
import { formatDateBR, OfficialSourceLink } from "@/components/content/sources";

const COVERAGE_LABEL: Record<CoverageType, string> = {
  IN_CITY: "Na cidade",
  SERVES_CITY: "Atende a cidade",
  REGIONAL: "Regional",
  STATEWIDE: "Estadual",
  NATIONAL: "Nacional",
};

const COVERAGE_HINT: Record<CoverageType, string> = {
  IN_CITY: "Serviço com atendimento no próprio município.",
  SERVES_CITY: "Fica fora do município, mas atende oficialmente quem mora aqui.",
  REGIONAL: "Atende um conjunto de municípios que inclui este.",
  STATEWIDE: "Vale para quem mora em qualquer cidade do estado.",
  NATIONAL: "Vale para qualquer pessoa no país.",
};

const ACCESS_LABEL: Record<FinancialResource["accessMode"], string> = {
  presencial: "Presencial",
  online: "On-line",
  telefone: "Telefone",
  misto: "Presencial e on-line",
};

function CoverageBadge({ coverage }: { coverage: CoverageType }) {
  const local = isLocalCoverage(coverage);
  return (
    <span
      title={COVERAGE_HINT[coverage]}
      className={[
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        local
          ? "bg-brand-teal-soft text-brand-teal-dark"
          : "bg-brand-surface text-brand-muted ring-1 ring-brand-border",
      ].join(" ")}
    >
      {COVERAGE_LABEL[coverage]}
    </span>
  );
}

function ResourceCard({ resource }: { resource: FinancialResource }) {
  const notice = stalenessNotice(resource);
  return (
    <li className="rounded-xl border border-brand-border bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h4 className="font-serif text-base font-bold leading-snug text-brand-navy">
          {resource.name}
        </h4>
        <CoverageBadge coverage={resource.coverage} />
      </div>

      <p className="mt-2 text-sm leading-relaxed text-brand-text">{resource.whatItSolves}</p>

      <dl className="mt-3 space-y-1.5 text-sm leading-relaxed">
        {/* No dossiê, o Procon da cidade é ao mesmo tempo nome e responsável —
            repetir a linha só ocuparia espaço no celular. */}
        {resource.operator !== resource.name ? (
          <div>
            <dt className="inline font-semibold text-brand-navy">Responsável: </dt>
            <dd className="inline text-brand-muted">{resource.operator}</dd>
          </div>
        ) : null}
        <div>
          <dt className="inline font-semibold text-brand-navy">
            Como acessar ({ACCESS_LABEL[resource.accessMode]}):{" "}
          </dt>
          <dd className="inline text-brand-muted">{resource.howToAccess}</dd>
        </div>
        {resource.eligibilityNote ? (
          <div>
            <dt className="inline font-semibold text-brand-navy">Quem pode usar: </dt>
            <dd className="inline text-brand-muted">{resource.eligibilityNote}</dd>
          </div>
        ) : null}
      </dl>

      {notice ? (
        <p className="mt-3 rounded-lg border border-brand-warning/40 bg-brand-warning-soft px-3 py-2 text-xs leading-relaxed text-brand-warning">
          {notice}
        </p>
      ) : null}

      <p className="mt-3 text-xs text-brand-muted">
        <OfficialSourceLink href={resource.officialSource}>Fonte oficial</OfficialSourceLink> ·
        verificado em {formatDateBR(resource.verifiedAt)}
      </p>
    </li>
  );
}

export function CityFinancialMapSection({ map }: { map: CityMap }) {
  if (map.resources.length === 0) return null;
  const groups = groupByCategory(map.resources);
  const localCount = map.resources.filter((r) => isLocalCoverage(r.coverage)).length;

  return (
    <section
      data-track-area="mapa-cidade"
      data-track="mapa-financeiro"
      aria-labelledby="mapa-financeiro"
      className="mt-12 scroll-mt-24"
    >
      <h2 id="mapa-financeiro" className="font-serif text-2xl font-bold text-brand-navy">
        Onde pedir ajuda em {map.city.localityName}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-brand-muted">
        Serviços públicos e gratuitos que atendem quem mora aqui, quando o assunto é dívida,
        cobrança ou contrato de crédito. Não é lista de bancos: nenhuma empresa aparece nesta
        seção, e não há ordem de preferência —{" "}
        {localCount > 0
          ? "o que fica na cidade vem primeiro apenas por ser mais perto de você."
          : "os canais abaixo valem para qualquer município."}
      </p>

      {groups.map((group) => (
        <div key={group.category} className="mt-6">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-brand-teal-dark">
            {CATEGORY_LABEL[group.category]}
          </h3>
          <ul className="mt-3 grid gap-3 md:grid-cols-2">
            {group.resources.map((resource) => (
              <ResourceCard key={resource.id} resource={resource} />
            ))}
          </ul>
        </div>
      ))}

      {map.serviceNotes.length > 0 ? (
        <div className="mt-6 rounded-xl border border-brand-border bg-brand-surface p-4">
          <h3 className="text-sm font-semibold text-brand-navy">
            Detalhes de atendimento verificados
          </h3>
          <ul className="mt-2 space-y-2 text-sm leading-relaxed text-brand-muted">
            {map.serviceNotes.map((note) => (
              <li key={`${note.institution}-${note.checkedAt}`}>
                {note.information}{" "}
                <OfficialSourceLink href={note.officialSource}>Fonte</OfficialSourceLink> (
                {formatDateBR(note.checkedAt)})
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-6 text-xs leading-relaxed text-brand-muted">
        Horário, endereço e canal de atendimento mudam sem aviso. Confirme na fonte oficial antes
        de se deslocar. Encontrou algo desatualizado? A{" "}
        <a href="/politica-de-correcoes/" className="underline underline-offset-2">
          política de correções
        </a>{" "}
        explica como avisar.
      </p>
    </section>
  );
}
