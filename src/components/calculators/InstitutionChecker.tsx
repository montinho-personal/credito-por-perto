"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRevealResult } from "./use-reveal-result";
import {
  isValidCnpj,
  looksLikeCnpj,
  normalizeCnpjInput,
} from "@/lib/institutions/search";

/* Eventos de uso — nunca o termo pesquisado, nunca a instituição escolhida. */
interface GtagWindow extends Window {
  gtag?: (...args: unknown[]) => void;
}
function gtag(...args: unknown[]) {
  const w = window as GtagWindow;
  if (typeof w.gtag === "function") w.gtag(...args);
}

const BCB_FIND_URL = "https://www.bcb.gov.br/meubc/encontreinstituicao";

interface ApiMatch {
  id: string;
  name: string;
  shortName: string | null;
  cnpj: string | null;
  cnpjKind: "full" | "root" | "none";
  type: string | null;
  uf: string | null;
  municipio: string | null;
  situacao: string | null;
  sourceLabel: string;
  quality: "exact" | "strong" | "related";
}

interface ApiOk {
  status: "ok";
  mode: "cnpj" | "name";
  partial: boolean;
  fetchedAt: string;
  matches: ApiMatch[];
}

type ViewState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "invalid-cnpj" }
  | { kind: "incomplete-cnpj" }
  | { kind: "results"; data: ApiOk }
  | { kind: "not-found"; partial: boolean; fetchedAt: string; wasCnpj: boolean }
  | { kind: "unavailable" };

function ContactWarning() {
  return (
    <div className="mt-4 rounded-xl border border-brand-warning/40 bg-brand-warning-soft p-5">
      <p className="font-bold text-brand-navy">Isso confirma a instituição — não o contato.</p>
      <p className="mt-1 text-sm leading-relaxed text-brand-text">
        Uma empresa real pode ter nome, logotipo e CNPJ usados por golpistas. Encontrar a
        instituição nos registros do Banco Central <strong>não confirma</strong> que o site,
        WhatsApp, telefone ou pessoa que entrou em contato com você realmente pertença a ela.
      </p>
      <p className="mt-3 font-semibold text-brand-navy">Agora confirme o contato:</p>
      <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-brand-text">
        <li>Não use o telefone, link ou WhatsApp enviados por quem fez a proposta;</li>
        <li>
          Procure por conta própria o canal oficial da instituição — site digitado por você,
          aplicativo nas lojas oficiais, telefone no cartão ou em documento que você já possua;
        </li>
        <li>Confirme a proposta por esse canal antes de qualquer pagamento ou envio de dados;</li>
        <li>Se ficar dúvida, encerre o contato até conseguir verificar.</li>
      </ol>
      <p className="mt-2 text-sm leading-relaxed text-brand-text">
        O caminho completo está em{" "}
        <Link href="/credito-seguro/como-consultar-se-instituicao-e-autorizada/" className="font-semibold underline">
          como consultar se uma instituição é autorizada
        </Link>
        .
      </p>
    </div>
  );
}

function NextActions({ found }: { found: boolean }) {
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      {found ? (
        <>
          <div className="rounded-xl bg-brand-surface-soft p-4 text-sm leading-relaxed">
            <p className="font-bold text-brand-navy">A proposta tem sinais estranhos?</p>
            <p className="mt-1 text-brand-text">
              <Link
                href="/calculadoras/sinais-de-golpe/"
                onClick={() => gtag("event", "institution_check_fraud_click")}
                className="font-semibold text-brand-teal-dark underline"
              >
                Verificar sinais de golpe
              </Link>{" "}
              — 10 perguntas, menos de um minuto.
            </p>
          </div>
          <div className="rounded-xl bg-brand-surface-soft p-4 text-sm leading-relaxed">
            <p className="font-bold text-brand-navy">Os números fazem sentido?</p>
            <p className="mt-1 text-brand-text">
              <Link
                href="/calculadoras/minha-taxa-esta-cara/"
                onClick={() => gtag("event", "institution_check_rate_click")}
                className="font-semibold text-brand-teal-dark underline"
              >
                Compare a taxa com a média do BC
              </Link>{" "}
              ou{" "}
              <Link
                href="/calculadoras/comparador-de-propostas/"
                onClick={() => gtag("event", "institution_check_comparator_click")}
                className="font-semibold text-brand-teal-dark underline"
              >
                compare propostas lado a lado
              </Link>
              .
            </p>
          </div>
        </>
      ) : (
        <div className="rounded-xl bg-brand-surface-soft p-4 text-sm leading-relaxed sm:col-span-2">
          <p className="font-bold text-brand-navy">Enquanto houver dúvida, não pague nada.</p>
          <p className="mt-1 text-brand-text">
            <Link
              href="/calculadoras/sinais-de-golpe/"
              onClick={() => gtag("event", "institution_check_fraud_click")}
              className="font-semibold text-brand-teal-dark underline"
            >
              Verifique os sinais de golpe da proposta
            </Link>{" "}
            — principalmente se pediram pagamento antecipado.
          </p>
        </div>
      )}
    </div>
  );
}

function MatchCard({ match, fetchedAt }: { match: ApiMatch; fetchedAt: string }) {
  return (
    <article className="rounded-xl border border-brand-border bg-white p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-brand-teal-dark">
        ✓ Encontrada na base consultada
      </p>
      <h3 className="mt-1 font-serif text-lg font-bold text-brand-navy">{match.name}</h3>
      <dl className="mt-3 space-y-1 text-sm text-brand-text">
        {match.cnpj ? (
          <div>
            <dt className="inline font-semibold">CNPJ: </dt>
            <dd className="inline">{match.cnpj}</dd>
          </div>
        ) : match.cnpjKind === "root" ? (
          <div>
            <dt className="inline font-semibold">CNPJ: </dt>
            <dd className="inline">a base consultada informa apenas a raiz do CNPJ</dd>
          </div>
        ) : null}
        {match.type ? (
          <div>
            <dt className="inline font-semibold">Tipo: </dt>
            <dd className="inline">{match.type}</dd>
          </div>
        ) : null}
        {match.situacao ? (
          <div>
            <dt className="inline font-semibold">Situação na base: </dt>
            <dd className="inline">{match.situacao}</dd>
          </div>
        ) : null}
        {match.municipio || match.uf ? (
          <div>
            <dt className="inline font-semibold">Sede: </dt>
            <dd className="inline">{[match.municipio, match.uf].filter(Boolean).join(" — ")}</dd>
          </div>
        ) : null}
        <div>
          <dt className="inline font-semibold">Base consultada: </dt>
          <dd className="inline">{match.sourceLabel} (relação de instituições em funcionamento, Banco Central)</dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-brand-muted">
        Fonte: Banco Central do Brasil. Dados obtidos em {fetchedAt}.
      </p>
      <p className="mt-3 text-sm">
        <a
          href={BCB_FIND_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => gtag("event", "institution_check_bcb_click")}
          className="font-semibold text-brand-teal-dark underline"
        >
          Ver no Banco Central →
        </a>
      </p>
    </article>
  );
}

export function InstitutionChecker() {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewState>({ kind: "idle" });
  const [selected, setSelected] = useState<ApiMatch | null>(null);
  const startedRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeq = useRef(0);

  const isCnpjInput = looksLikeCnpj(query);

  const { ref: resultRef, reveal } = useRevealResult();

  const runSearch = useCallback(async (term: string) => {
    const trimmed = term.trim();
    if (trimmed.length < 3) return;
    if (!startedRef.current) {
      startedRef.current = true;
      gtag("event", "institution_check_start");
    }
    if (looksLikeCnpj(trimmed)) {
      const digits = normalizeCnpjInput(trimmed);
      if (digits.length < 14) {
        setSelected(null);
        setView({ kind: "incomplete-cnpj" });
        reveal();
        return;
      }
      if (!isValidCnpj(digits)) {
        setSelected(null);
        setView({ kind: "invalid-cnpj" });
        reveal();
        return;
      }
    }
    const seq = ++requestSeq.current;
    setSelected(null);
    setView({ kind: "loading" });
    try {
      const response = await fetch(`/api/instituicoes?q=${encodeURIComponent(trimmed)}`);
      if (seq !== requestSeq.current) return;
      if (response.status === 503) {
        gtag("event", "institution_check_unavailable");
        setView({ kind: "unavailable" });
        reveal();
        return;
      }
      const data = (await response.json()) as ApiOk | { status: string };
      if (seq !== requestSeq.current) return;
      if (data.status === "invalid_cnpj") {
        setView({ kind: "invalid-cnpj" });
        reveal();
        return;
      }
      if (data.status === "incomplete_cnpj") {
        setView({ kind: "incomplete-cnpj" });
        reveal();
        return;
      }
      if (data.status !== "ok") {
        setView({ kind: "unavailable" });
        reveal();
        return;
      }
      const ok = data as ApiOk;
      if (ok.matches.length === 0) {
        gtag("event", "institution_check_not_found");
        setView({
          kind: "not-found",
          partial: ok.partial,
          fetchedAt: ok.fetchedAt,
          wasCnpj: ok.mode === "cnpj",
        });
        return;
      }
      gtag("event", "institution_check_result");
      if (ok.matches.length > 1) gtag("event", "institution_check_multiple_results");
      setView({ kind: "results", data: ok });
      reveal();
      if (ok.matches.length === 1 && ok.matches[0] && ok.matches[0].quality === "exact") {
        setSelected(ok.matches[0]);
      }
    } catch {
      if (seq === requestSeq.current) setView({ kind: "unavailable" });
    }
  }, [reveal]);

  // Busca automática com debounce; o botão dispara imediatamente.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (trimmed.length < 4 || looksLikeCnpj(trimmed)) return;
    debounceRef.current = setTimeout(() => {
      void runSearch(trimmed);
    }, 450);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  const results = view.kind === "results" ? view.data : null;

  return (
    <section
      aria-label="Consulta de instituição nos registros do Banco Central"
      className="rounded-2xl border border-brand-border bg-brand-surface-soft/50 p-4 sm:p-6"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void runSearch(query);
        }}
        role="search"
      >
        <label htmlFor="instituicao-busca" className="font-serif text-xl font-bold text-brand-navy">
          Pesquise a instituição
        </label>
        <p className="mt-1 text-sm text-brand-muted">
          Grátis, sem cadastro. O que você digita não é salvo nem enviado a serviços de análise.
        </p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            id="instituicao-busca"
            type="text"
            inputMode={isCnpjInput ? "numeric" : "text"}
            autoComplete="off"
            spellCheck={false}
            maxLength={120}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Digite o nome ou CNPJ"
            className="w-full rounded-xl border border-brand-border bg-white px-4 py-3.5 text-base text-brand-text outline-none focus:border-brand-teal"
          />
          <button
            type="submit"
            className="rounded-xl bg-brand-navy px-6 py-3.5 font-semibold text-white transition-colors hover:bg-brand-navy/90"
          >
            Verificar
          </button>
        </div>
      </form>

      <div ref={resultRef} aria-live="polite" className="mt-4 scroll-mt-24">
        {view.kind === "loading" ? (
          <p className="text-sm text-brand-muted">Consultando a base oficial…</p>
        ) : null}

        {view.kind === "incomplete-cnpj" ? (
          <p className="rounded-xl border border-brand-border bg-white p-4 text-sm leading-relaxed text-brand-text">
            Esse CNPJ parece estar incompleto — o número completo tem 14 posições. Confira o
            documento recebido ou pesquise pelo nome da instituição.
          </p>
        ) : null}

        {view.kind === "invalid-cnpj" ? (
          <p className="rounded-xl border border-brand-border bg-white p-4 text-sm leading-relaxed text-brand-text">
            Esse CNPJ possui dígitos verificadores inválidos — provavelmente há um erro de
            digitação. Vale lembrar: mesmo um CNPJ com formato válido não prova que a empresa
            seja legítima; a validação só confere a estrutura do número.
          </p>
        ) : null}

        {results ? (
          <div>
            <p className="text-sm font-semibold text-brand-navy">
              {results.matches.length === 1
                ? "1 instituição encontrada."
                : `${results.matches.length} instituições com nome semelhante encontradas.`}
            </p>
            {results.matches.length > 1 ? (
              <p className="mt-1 text-sm text-brand-muted">
                Selecione a que corresponde ao CNPJ ou documento que você recebeu — em caso de
                dúvida, prefira pesquisar pelo CNPJ.
              </p>
            ) : null}
            {results.matches.length > 1 && !selected ? (
              <ul className="mt-3 space-y-2">
                {results.matches.map((match) => (
                  <li key={match.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(match)}
                      className="w-full rounded-xl border border-brand-border bg-white px-4 py-3 text-left transition-colors hover:border-brand-teal"
                    >
                      <span className="block font-semibold text-brand-navy">{match.name}</span>
                      <span className="mt-0.5 block text-xs text-brand-muted">
                        {[match.cnpj ? `CNPJ ${match.cnpj}` : null, match.type, match.uf]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {selected ? (
              <div className="mt-3">
                <MatchCard match={selected} fetchedAt={results.fetchedAt} />
                <ContactWarning />
                <NextActions found />
                {results.matches.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="mt-3 text-sm font-medium text-brand-muted underline"
                  >
                    ← Ver as outras instituições encontradas
                  </button>
                ) : null}
              </div>
            ) : null}
            {results.partial ? (
              <p className="mt-3 text-xs text-brand-muted">
                Parte da base oficial está temporariamente indisponível — a busca pode não cobrir
                todos os tipos de instituição neste momento.
              </p>
            ) : null}
          </div>
        ) : null}

        {view.kind === "not-found" ? (
          <div className="rounded-xl border border-brand-border bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-brand-warning">
              ⚠ Não localizada na base consultada
            </p>
            <p className="mt-2 text-sm leading-relaxed text-brand-text">
              {view.wasCnpj
                ? "Não localizamos esse CNPJ na relação de instituições em funcionamento do Banco Central (bancos, financeiras, SCDs, cooperativas e consórcios)."
                : "Não encontramos esse nome na relação de instituições em funcionamento do Banco Central (bancos, financeiras, SCDs, cooperativas e consórcios)."}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-brand-text">
              Isso merece verificação adicional, mas <strong>não é suficiente por si só para
              concluir que existe fraude</strong>. O nome informado pode estar diferente da razão
              social, pode haver erro de digitação — e nem toda empresa que intermedeia uma
              operação (como um correspondente bancário) aparece nesta base. Nesse caso, confirme
              quem é a instituição responsável pelo crédito.
            </p>
            {view.partial ? (
              <p className="mt-2 text-sm leading-relaxed text-brand-text">
                <strong>Atenção:</strong> parte da base oficial está indisponível agora, então a
                busca não cobriu todos os tipos de instituição. Confirme diretamente no Banco
                Central.
              </p>
            ) : null}
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-relaxed text-brand-text">
              <li>Confira o CNPJ no contrato ou documento recebido e pesquise por ele;</li>
              <li>Tente pesquisar pela razão social completa, não pela marca;</li>
              <li>
                Consulte diretamente o{" "}
                <a
                  href={BCB_FIND_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => gtag("event", "institution_check_bcb_click")}
                  className="font-semibold underline"
                >
                  Banco Central
                </a>
                ;
              </li>
              <li>Não envie dinheiro enquanto houver dúvida sobre quem oferece o crédito.</li>
            </ul>
            <p className="mt-2 text-xs text-brand-muted">
              Base consultada: relação de instituições em funcionamento (Banco Central), obtida em{" "}
              {view.fetchedAt}.
            </p>
            <NextActions found={false} />
          </div>
        ) : null}

        {view.kind === "unavailable" ? (
          <div className="rounded-xl border border-brand-border bg-white p-5">
            <p className="font-bold text-brand-navy">
              Não conseguimos consultar a base oficial agora.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-brand-text">
              Isso é uma indisponibilidade técnica — <strong>não</strong> significa que a
              instituição não exista. Tente novamente em alguns minutos ou faça a consulta
              diretamente no Banco Central.
            </p>
            <p className="mt-3 text-sm">
              <a
                href={BCB_FIND_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => gtag("event", "institution_check_bcb_click")}
                className="font-semibold text-brand-teal-dark underline"
              >
                Consultar no Banco Central →
              </a>
            </p>
          </div>
        ) : null}
      </div>

      <p className="mt-6 rounded-lg border border-brand-warning/30 bg-brand-warning-soft p-4 text-sm leading-relaxed text-brand-warning">
        Consulta educativa baseada em dados públicos do Banco Central. Ela informa o que consta na
        base consultada — não avalia reputação, não recomenda instituição e não confirma que um
        contato específico pertença à empresa encontrada.
      </p>
    </section>
  );
}
