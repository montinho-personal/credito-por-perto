/**
 * ONDE CONSEGUIR EMPRÉSTIMO — as portas que não dependem da cidade
 * ============================================================================
 *
 * Os 48 guias locais respondiam "onde reclamar" (41 traziam o Procon com
 * endereço) e quase não respondiam "onde pegar". Quem digita "empréstimo em
 * [cidade]" quer a segunda pergunta. Este bloco é a resposta dela.
 *
 * POR QUE COMPONENTE, E NÃO TEXTO NO MDX
 *
 * A lista de instituições é idêntica em 48 páginas porque o fato é idêntico:
 * quem empresta em Jundiaí empresta em Santa Isabel, pelo mesmo aplicativo.
 * Copiar 250 palavras em 48 arquivos criaria manutenção em 48 lugares e
 * dispararia `audit:originality` — que existe justamente para impedir guias
 * locais quase iguais. Aqui o fato mora num lugar só, e o MDX de cada cidade
 * guarda o que é realmente daquela cidade: a unidade do Banco do Povo, o
 * Procon, o perfil econômico local.
 *
 * Trade-off registrado com honestidade: o Google lê a página renderizada, e
 * lá o bloco continua repetido. É boilerplate — proporção pequena num guia de
 * ~1.400 palavras, na mesma categoria de rodapé e navegação. O que sustenta
 * cada página como original continua sendo o miolo local.
 *
 * A REGRA DE VERDADE DESTE BLOCO (proprietário, 21/09/2026)
 *
 * Citar a instituição pelo nome, sem inventar nada sobre ela. Em particular:
 * NUNCA afirmar que a instituição X tem agência na cidade Y. Não existe fonte
 * oficial consultável em escala para isso — a API de agências do Banco
 * Central não é alcançável daqui, e os agregadores erram (o caso do Procon de
 * Santa Isabel, em que seis sites publicavam endereço desatualizado, é o
 * aviso permanente). O que se afirma aqui é outra coisa, e é verificável:
 * estas instituições operam em todo o país por canal digital, e a autorização
 * de qualquer uma se confere no "Encontre uma instituição" do BC.
 */

import Link from "next/link";

const GRUPOS: ReadonlyArray<{
  titulo: string;
  nota: string;
  instituicoes: string;
}> = [
  {
    titulo: "Bancos públicos",
    nota: "Atendem por agência, aplicativo e correspondentes. A Caixa também opera o Crédito do Trabalhador e o consignado do INSS.",
    instituicoes: "Caixa Econômica Federal · Banco do Brasil",
  },
  {
    titulo: "Bancos de rede",
    nota: "Costumam oferecer condição melhor a quem já recebe salário na conta — o que torna o seu banco atual uma cotação obrigatória, nunca a única.",
    instituicoes: "Itaú · Bradesco · Santander",
  },
  {
    titulo: "Bancos digitais",
    nota: "Não dependem de agência na cidade: a contratação inteira acontece no aplicativo, com o mesmo contrato e a mesma proteção legal.",
    instituicoes: "Nubank · Banco Inter · C6 Bank · Neon · PicPay · Mercado Pago",
  },
  {
    titulo: "Especializados em consignado",
    nota: "Trabalham com desconto em folha ou em benefício. Para o consignado do INSS, confira o banco na lista de conveniados antes de qualquer conversa.",
    instituicoes: "Banco BMG · Banco Pan · Daycoval · Agibank · Banco Safra",
  },
  {
    titulo: "Cooperativas de crédito",
    nota: "Funcionam com associados, não com clientes, e a região tem presença forte. Exigem filiação e costumam ter unidade física — vale checar se há uma na sua cidade.",
    instituicoes: "Sicredi · Sicoob · Cresol · Unicred",
  },
  {
    titulo: "Crédito com garantia",
    nota: "Imóvel ou veículo como garantia derruba o juro e aumenta o risco: o bem responde pela dívida. Modalidade para valores altos e prazo longo.",
    instituicoes: "Creditas · e os bancos de rede acima",
  },
];

/**
 * Regras do Banco do Povo Paulista, verificadas em fonte estadual oficial.
 *
 * Elas moram aqui, e não no MDX, pelo mesmo motivo da lista de instituições:
 * o programa é estadual e as condições não mudam de cidade para cidade — o
 * que muda é o endereço da unidade, que continua no texto de cada guia.
 *
 * O bloco existe por uma razão editorial, não decorativa. Quarenta guias
 * citavam o Banco do Povo como "a porta de crédito público da cidade" sem
 * dizer o essencial: é microcrédito PRODUTIVO, pede negócio em funcionamento
 * e exige CPF sem restrição. Ou seja, não serve para despesa pessoal e não
 * atende justamente o leitor negativado, que é quem mais chega a este site.
 * Deixar isso implícito é criar expectativa que o balcão vai desmentir.
 */
function BancoDoPovoRegras() {
  return (
    <div className="mt-5 rounded-lg border border-brand-warning/40 bg-brand-warning-soft/40 p-4">
      <p className="font-serif text-sm font-bold text-brand-navy">
        Antes de ir ao Banco do Povo: ele não é empréstimo pessoal
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-brand-text">
        O Banco do Povo Paulista é <strong>microcrédito produtivo</strong> — o
        dinheiro é para o negócio, não para despesa pessoal. O programa estadual
        pede atividade produtiva, formal ou informal,{" "}
        <strong>em funcionamento há pelo menos seis meses</strong>, residência
        ou empresa no município atendido, capacitação prévia gratuita e{" "}
        <strong>CPF e CNPJ sem restrição</strong>.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-brand-text">
        Essa última condição importa muito aqui: quem está com o nome
        negativado <strong>não é atendido</strong> pelo programa. Nesse caso, o
        caminho começa em{" "}
        <Link href="/emprestimos/emprestimo-para-negativado/">
          empréstimo para negativado
        </Link>
        , não na fila do balcão.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-brand-text">
        Para estimar a parcela antes de ir, use o{" "}
        <Link href="/calculadoras/simulador-banco-do-povo/">
          simulador independente para o Banco do Povo
        </Link>
        . A simulação oficial é a do atendimento.
      </p>
    </div>
  );
}

export function OndeConseguirCredito({
  localityName,
  bancoDoPovo = false,
}: {
  localityName: string;
  /** A cidade tem unidade do Banco do Povo citada no guia? */
  bancoDoPovo?: boolean;
}) {
  return (
    <aside
      data-track-area="onde-conseguir-credito"
      className="not-prose my-8 rounded-xl border border-brand-navy/20 bg-brand-navy/[0.03] p-5"
      aria-label={`Instituições que emprestam para quem mora em ${localityName}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-navy">
        Quem empresta para quem mora em {localityName}
      </p>

      <p className="mt-2.5 text-sm leading-relaxed text-brand-text">
        Nenhuma destas instituições depende de agência na cidade: todas
        contratam empréstimo pessoal pelo aplicativo, em qualquer município do
        país. O portal <strong>não indica nenhuma delas</strong> — a lista
        existe para você cotar em mais de uma e comparar pelo{" "}
        <Link href="/juros-e-cet/o-que-e-cet/">CET</Link>.
      </p>

      <dl className="mt-4 space-y-3.5">
        {GRUPOS.map((grupo) => (
          <div
            key={grupo.titulo}
            className="border-l-2 border-brand-navy/25 pl-3.5"
          >
            <dt className="font-serif text-sm font-bold text-brand-navy">
              {grupo.titulo}
            </dt>
            <dd className="mt-0.5 text-sm font-medium text-brand-text">
              {grupo.instituicoes}
            </dd>
            <dd className="mt-1 text-sm leading-relaxed text-brand-muted">
              {grupo.nota}
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-4 border-t border-brand-navy/15 pt-3 text-sm leading-relaxed text-brand-text">
        <strong>A checagem que vale para qualquer nome desta lista</strong>, e
        para qualquer oferta que chegar até você por telefone, WhatsApp ou
        balcão: confirme a autorização em{" "}
        <a
          href="https://www.bcb.gov.br/meubc/encontreinstituicao"
          target="_blank"
          rel="noopener noreferrer"
        >
          Encontre uma instituição
        </a>
        , do Banco Central. Quem não está lá não pode emprestar. E{" "}
        <Link href="/credito-seguro/deposito-antecipado-e-golpe/">
          nada de pagamento antecipado
        </Link>{" "}
        para liberar crédito, em hipótese nenhuma.
      </p>

      <p className="mt-2.5 text-xs leading-relaxed text-brand-muted">
        Presença física varia de cidade para cidade e muda com o tempo, então
        este guia não afirma quais têm agência em {localityName}. O endereço
        atual de qualquer uma sai do localizador oficial do próprio banco, no
        site ou no aplicativo, pelo seu CEP.
      </p>

      {bancoDoPovo ? <BancoDoPovoRegras /> : null}
    </aside>
  );
}
