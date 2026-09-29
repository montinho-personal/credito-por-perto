/**
 * Registro central da ferramenta "Essa proposta tem sinais de golpe?".
 *
 * Princípios:
 * - A ferramenta identifica SINAIS descritos em orientações oficiais e no
 *   material editorial verificado do portal. Ela NUNCA produz veredito
 *   ("é golpe" / "é seguro"), score numérico nem probabilidade.
 * - Motor 100% determinístico: resposta → regra conhecida → explicação com
 *   fonte. Sem IA, sem texto livre, sem coleta de dados.
 * - Severidade ordena e muda a manchete do resultado; na interface os
 *   rótulos são "Importante" / "Atenção" / "Verifique" (sem termos
 *   policialescos).
 * - Cada sinal carrega fonte e data de revisão. Golpes mudam: revisar
 *   este arquivo junto com os artigos de segurança.
 */

export type Severity = "critical" | "high" | "medium" | "low";

export type AnswerValue = "yes" | "no" | "unsure";

export interface FraudQuestion {
  id: string;
  /** Pergunta exibida (uma por tela) */
  question: string;
  /** Texto curto de apoio sob a pergunta, quando ajuda */
  hint?: string;
  /** Respostas oferecidas */
  options: AnswerValue[];
  /** Resposta(s) que acendem o sinal */
  trigger: AnswerValue[];
  severity: Severity;
  /** Título do card no resultado */
  signalTitle: string;
  /** Explicação: o que chamou atenção e por quê (sem veredito) */
  explanation: string;
  /** O que fazer antes de continuar */
  recommendedAction: string;
  /** Links de aprofundamento (internos ou oficiais) */
  links: Array<{ label: string; href: string; external?: boolean }>;
  /** Base editorial/oficial do sinal */
  source: string;
  reviewedAt: string;
}

const REVIEWED = "2026-09-29";

export const FRAUD_QUESTIONS: readonly FraudQuestion[] = [
  {
    id: "upfront-payment",
    question: "Pediram algum valor antes de liberar o empréstimo?",
    hint: "Qualquer nome vale: taxa de liberação, de cadastro ou de desbloqueio, IOF “antecipado”, seguro, caução, taxa de cartório, depósito de garantia. Por Pix, boleto ou transferência.",
    options: ["yes", "no", "unsure"],
    trigger: ["yes"],
    severity: "critical",
    signalTitle: "Pediram pagamento antes de liberar o crédito",
    explanation:
      "É o roteiro clássico do golpe do empréstimo, e o Banco Central alerta que instituição financeira não pede pagamento antecipado para liberar crédito. Custos legítimos, como IOF, tarifas e seguros contratados, entram na própria operação: são descontados do valor liberado ou incluídos nas parcelas e aparecem no CET. Não saem por Pix ou boleto à parte.",
    recommendedAction:
      "Não transfira nada antes de confirmar a instituição e o canal por conta própria.",
    links: [
      { label: "Depósito antecipado para liberar empréstimo é golpe?", href: "/credito-seguro/deposito-antecipado-e-golpe/" },
      { label: "Alerta do Banco Central (gov.br)", href: "https://www.gov.br/pt-br/noticias/financas-impostos-e-gestao-publica/2022/04/banco-central-auxilia-cidadao-a-nao-cair-em-golpes-de-falsos-emprestimos-e-a-verificar-se-seu-nome-foi-utilizado-indevidamente-para-contratacao-de-credito-por-um-golpista", external: true },
    ],
    source:
      "Banco Central, alerta sobre falsos empréstimos publicado no gov.br, e guia verificado do portal",
    reviewedAt: REVIEWED,
  },
  {
    id: "credentials",
    question: "Pediram sua senha bancária, token ou algum código recebido por SMS?",
    options: ["yes", "no"],
    trigger: ["yes"],
    severity: "critical",
    signalTitle: "Pedido de senha ou código de autenticação",
    explanation:
      "Senha, token e código por SMS são as chaves da sua conta. Nenhuma contratação legítima de crédito precisa deles fora do aplicativo oficial do seu próprio banco — pedir esses dados é o padrão do golpe da falsa central.",
    recommendedAction:
      "Não informe. Se já informou, troque as senhas e avise seu banco pelos canais oficiais imediatamente.",
    links: [
      { label: "O golpe da falsa central do banco", href: "/credito-seguro/golpe-da-falsa-central/" },
    ],
    source: "Orientações de segurança bancária (Banco Central), consolidadas no guia verificado do portal",
    reviewedAt: REVIEWED,
  },
  {
    id: "remote-access",
    question: "Pediram para instalar algum aplicativo de acesso ao seu celular ou computador?",
    hint: "Ex.: apps de 'suporte', 'atualização de segurança' ou acesso remoto.",
    options: ["yes", "no"],
    trigger: ["yes"],
    severity: "critical",
    signalTitle: "Pedido de instalação de acesso remoto",
    explanation:
      "Aplicativo de acesso remoto entrega o controle do seu dispositivo — e do seu banco — a um terceiro. Contratação de crédito não exige isso em nenhum fluxo legítimo.",
    recommendedAction:
      "Não instale. Se instalou, desinstale, revise as permissões e troque as senhas a partir de outro dispositivo.",
    links: [
      { label: "O teste dos 5 passos para apps de empréstimo", href: "/credito-seguro/app-de-emprestimo-e-confiavel/" },
    ],
    source: "Orientações de segurança digital consolidadas no guia verificado do portal",
    reviewedAt: REVIEWED,
  },
  {
    id: "guaranteed-approval",
    question: "Prometeram aprovação garantida, sem análise ou consulta?",
    options: ["yes", "no", "unsure"],
    trigger: ["yes"],
    severity: "high",
    signalTitle: "Promessa de aprovação garantida",
    explanation:
      "Instituição autorizada sempre faz algum tipo de análise. 'Aprovado na hora, sem consulta, para qualquer nome' é a isca clássica que antecede o pedido de pagamento antecipado.",
    recommendedAction:
      "Trate a promessa como convite à verificação: confirme a instituição antes de seguir a conversa.",
    links: [
      { label: "O que a promessa 'sem consulta' esconde", href: "/credito-seguro/emprestimo-sem-consulta/" },
    ],
    source: "Guia verificado do portal sobre ofertas 'sem consulta'",
    reviewedAt: REVIEWED,
  },
  {
    id: "pressure",
    question: "Estão pressionando você a pagar ou decidir imediatamente?",
    hint: "“Só vale hoje”, “última vaga”, “pague agora ou perde”.",
    options: ["yes", "no"],
    trigger: ["yes"],
    severity: "high",
    signalTitle: "Pressão para decidir na hora",
    explanation:
      "A pressa é sempre do golpista, nunca sua. Urgência artificial existe para impedir exatamente o que esta verificação faz: parar e conferir.",
    recommendedAction:
      "Proposta legítima aguenta 24 horas. Use esse tempo para verificar a instituição e comparar.",
    links: [
      { label: "Como identificar golpes de empréstimo", href: "/credito-seguro/como-identificar-golpes-de-emprestimo/" },
    ],
    source: "Guia verificado do portal sobre golpes de empréstimo",
    reviewedAt: REVIEWED,
  },
  {
    id: "recipient-mismatch",
    question: "O Pix, boleto ou conta indicada está em nome de outra pessoa ou empresa, diferente de quem ofereceu o crédito?",
    hint: "Veja o nome do recebedor na tela de confirmação do Pix ou no boleto, sem concluir o pagamento.",
    options: ["yes", "no", "unsure"],
    trigger: ["yes"],
    severity: "high",
    signalTitle: "Recebedor diferente da instituição",
    explanation:
      "Instituições financeiras recebem em contas da própria empresa. Pix, boleto ou conta em nome de uma pessoa física ou de outra empresa é um jeito comum de desviar o dinheiro para longe da marca que aparece na conversa.",
    recommendedAction:
      "Não pague. Confirme a proposta direto com a instituição, pelo canal oficial que você mesmo encontrar.",
    links: [
      { label: "O roteiro completo do depósito antecipado", href: "/credito-seguro/deposito-antecipado-e-golpe/" },
    ],
    source: "Guia verificado do portal sobre o golpe do depósito antecipado",
    reviewedAt: REVIEWED,
  },
  {
    id: "institution-check",
    question: "Você já confirmou que a instituição é autorizada pelo Banco Central?",
    hint: "A consulta é gratuita e leva minutos — mostramos o caminho no resultado.",
    options: ["yes", "no", "unsure"],
    trigger: ["no", "unsure"],
    severity: "medium",
    signalTitle: "Instituição ainda não confirmada",
    explanation:
      "Só quem é autorizado pelo Banco Central (ou atua como correspondente identificado) pode operar crédito. E atenção: encontrar uma instituição legítima no BC não confirma que o WhatsApp, site ou pessoa que falou com você pertença realmente a ela — golpistas usam nome, logo e CNPJ de empresas reais.",
    recommendedAction:
      "Faça a consulta gratuita no Banco Central e procure os canais oficiais da instituição por conta própria — nunca pelo número que enviou a proposta.",
    links: [
      { label: "Verificar agora por nome ou CNPJ", href: "/calculadoras/consultar-instituicao/" },
      { label: "Como consultar se a instituição é autorizada", href: "/credito-seguro/como-consultar-se-instituicao-e-autorizada/" },
      { label: "Consultar no Banco Central", href: "https://www.bcb.gov.br/meubc/encontreinstituicao", external: true },
    ],
    source: "Banco Central — consulta pública 'Encontre uma instituição'",
    reviewedAt: REVIEWED,
  },
  {
    id: "official-channel",
    question: "Você confirmou a proposta por um canal oficial que você mesmo encontrou?",
    hint: "App da instituição baixado da loja oficial, site digitado por você ou telefone do cartão. Número ou link enviado pelo próprio contato não vale.",
    options: ["yes", "no", "unsure"],
    trigger: ["no", "unsure"],
    severity: "medium",
    signalTitle: "Contato ainda não confirmado",
    explanation:
      "A instituição existir não prova que a pessoa, o WhatsApp ou o site pertençam a ela. Golpistas usam nome, logotipo, CNPJ, contrato em PDF e até dados verdadeiros seus para parecer legítimos. Só o canal oficial encontrado por você confirma que a proposta é da instituição.",
    recommendedAction:
      "Procure o canal oficial por conta própria e pergunte se a proposta existe. Não ligue para um número passado pelo mesmo contato.",
    links: [
      { label: "Verificar a instituição por nome ou CNPJ", href: "/calculadoras/consultar-instituicao/" },
      { label: "O golpe da falsa central do banco", href: "/credito-seguro/golpe-da-falsa-central/" },
    ],
    source: "Guia verificado do portal sobre golpes de empréstimo e falsa central",
    reviewedAt: REVIEWED,
  },
  {
    id: "public-body",
    question: "Disseram falar em nome de governo, órgão público ou programa oficial?",
    hint: "Ex.: renegociação “do governo”, INSS, Receita, programa de crédito ou de limpeza de nome.",
    options: ["yes", "no", "unsure"],
    trigger: ["yes"],
    severity: "medium",
    signalTitle: "Uso do nome de órgão ou programa público",
    explanation:
      "Nome de governo, órgão ou programa oficial dá aparência de seriedade e é usado com frequência para pedir dados ou pagamento. Programas públicos têm páginas próprias em domínios oficiais (gov.br), onde as regras e os canais podem ser conferidos.",
    recommendedAction:
      "Procure o programa no site oficial, digitando o endereço gov.br você mesmo, e confira se a oferta e o canal existem lá.",
    links: [
      { label: "Como identificar golpes de empréstimo", href: "/credito-seguro/como-identificar-golpes-de-emprestimo/" },
    ],
    source: "Guia verificado do portal sobre golpes de empréstimo",
    reviewedAt: REVIEWED,
  },
  {
    id: "unsolicited",
    question: "A oferta chegou sem você ter procurado essa empresa?",
    options: ["yes", "no"],
    trigger: ["yes"],
    severity: "low",
    signalTitle: "Contato não solicitado",
    explanation:
      "Sozinho, isso não significa golpe — ofertas ativas existem no mercado legítimo. Mas contato não solicitado é a porta de entrada preferida das fraudes, então os demais sinais pesam mais quando a conversa começou assim.",
    recommendedAction:
      "Siga a verificação normalmente e redobre a atenção nos sinais de pagamento e de dados.",
    links: [
      { label: "Como identificar golpes de empréstimo", href: "/credito-seguro/como-identificar-golpes-de-emprestimo/" },
    ],
    source: "Guia verificado do portal sobre golpes de empréstimo",
    reviewedAt: REVIEWED,
  },
  {
    id: "whatsapp-only",
    question: "A negociação está acontecendo só pelo WhatsApp?",
    options: ["yes", "no"],
    trigger: ["yes"],
    severity: "low",
    signalTitle: "Negociação apenas pelo WhatsApp",
    explanation:
      "WhatsApp, por si só, não significa fraude — instituições reais também atendem por lá. O ponto de atenção é quando ele é o ÚNICO canal: sem site verificável, sem aplicativo oficial e sem endereço, não há como confirmar quem está do outro lado.",
    recommendedAction:
      "Procure a instituição fora do WhatsApp: site oficial digitado por você, aplicativo nas lojas oficiais, consulta no BC.",
    links: [
      { label: "App de empréstimo é confiável? O teste em 5 passos", href: "/credito-seguro/app-de-emprestimo-e-confiavel/" },
    ],
    source: "Guia verificado do portal sobre apps e canais de contratação",
    reviewedAt: REVIEWED,
  },
  {
    id: "too-good",
    question: "A condição parece muito melhor do que as outras ofertas que você encontrou?",
    hint: "Juros muito abaixo do mercado, limite altíssimo, 'sem juros'.",
    options: ["yes", "no", "unsure"],
    trigger: ["yes"],
    severity: "low",
    signalTitle: "Condição muito fora do padrão",
    explanation:
      "Não é prova de nada — mas taxa muito abaixo do que o mercado pratica para o seu perfil é uma isca comum. Vale colocar o número em contexto antes de se empolgar.",
    recommendedAction:
      "Compare a taxa com a média oficial do Banco Central para a mesma modalidade.",
    links: [
      { label: "Minha taxa está cara? (comparar com o BC)", href: "/calculadoras/minha-taxa-esta-cara/" },
    ],
    source: "Séries oficiais de taxa média do Banco Central (ver ferramenta)",
    reviewedAt: REVIEWED,
  },
] as const;

/** Fluxo de quem JÁ PAGOU — dados centralizados (regras do MED mudam). */
export const EMERGENCY_FLOW = {
  reviewedAt: REVIEWED,
  reviewedLabel: "29/09/2026",
  pixSteps: [
    "Entre em contato imediatamente com o seu banco pelos canais oficiais: aplicativo, telefone no verso do cartão ou site que você mesmo digitou.",
    "Conteste o Pix como golpe. O aplicativo do banco deve ter uma opção para isso, sem precisar de atendente; se não achar, peça pelo atendimento oficial.",
    "Essa contestação aciona o MED, o Mecanismo Especial de Devolução do Pix, que permite pedir a tentativa de devolução em casos de fraude, em até 80 dias da transação. A devolução não é garantida, e quanto antes o pedido, maiores as chances. Pix enviado por engano ou desacordo comercial não entram no MED.",
    "Registre boletim de ocorrência, na delegacia ou pela delegacia eletrônica do seu estado.",
    "Guarde tudo: comprovantes, conversas, números, links e nomes usados na abordagem.",
    "Não envie novos valores e desconfie de quem aparecer oferecendo recuperar o dinheiro mediante pagamento: costuma ser a mesma quadrilha.",
  ],
  otherSteps: [
    "Entre em contato imediatamente com o seu banco pelos canais oficiais e conteste o pagamento (transferência, boleto ou cartão têm procedimentos próprios).",
    "Registre boletim de ocorrência, na delegacia ou pela delegacia eletrônica do seu estado.",
    "Registre a reclamação no consumidor.gov.br se houver empresa identificável.",
    "Guarde todos os comprovantes e conversas — são a base de qualquer contestação.",
    "Se você também informou senhas ou códigos, troque-as agora e avise o banco.",
    "Não envie novos valores e desconfie de quem aparecer oferecendo recuperar o dinheiro mediante pagamento.",
  ],
  accountSteps: [
    "Avise agora o seu banco pelos canais que você já conhece (aplicativo oficial, telefone no verso do cartão ou site digitado por você) e peça o bloqueio preventivo do acesso.",
    "Se instalou um aplicativo a pedido do contato, desinstale-o e, se puder, desligue o aparelho da internet enquanto resolve.",
    "Troque senhas do banco e do e-mail a partir de outro aparelho, e revise se há dispositivos ou chaves Pix novos na sua conta.",
    "Não envie novos valores e não repasse outros códigos, mesmo que alguém ligue dizendo ser do banco ou da polícia.",
    "Guarde conversas, números e links, registre boletim de ocorrência e acompanhe no Registrato do Banco Central se surgem contratos que você não fez.",
  ],
  medSource: {
    label: "Guia oficial do MED (Banco Central)",
    href: "https://www.bcb.gov.br/content/estabilidadefinanceira/pix/Guia_MED.pdf",
  },
} as const;
