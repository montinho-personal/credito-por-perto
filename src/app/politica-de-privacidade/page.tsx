import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import {
  InstitutionalShell,
  LegalTemplateNotice,
} from "@/components/layout/InstitutionalShell";
import { CONTACT_EMAIL, LEGAL_OWNER } from "@/lib/site";

export const metadata: Metadata = buildMetadata({
  title: "Política de privacidade",
  description:
    "Como o Crédito por Perto trata dados pessoais: o que coletamos (muito pouco), para quê, com que base legal e como exercer seus direitos previstos na LGPD.",
  path: "/politica-de-privacidade/",
});

// TEMPLATE LEGAL — pendente apenas de revisão jurídica.
// Ver PENDENCIAS_CRITICAS.md antes do lançamento.
export default function PoliticaDePrivacidadePage() {
  return (
    <InstitutionalShell
      title="Política de privacidade"
      description="Tratamento de dados pessoais no Crédito por Perto."
      path="/politica-de-privacidade/"
    >
      <LegalTemplateNotice />
      <h2>Quem somos</h2>
      <p>
        O Crédito por Perto (www.creditoporperto.com.br) é um portal editorial
        de educação financeira. O controlador dos dados tratados neste site é{" "}
        <strong>{LEGAL_OWNER.name}</strong> (CPF {LEGAL_OWNER.cpfMasked}), com
        endereço em {LEGAL_OWNER.address}. Contato:{" "}
        <strong>{LEGAL_OWNER.email}</strong>.
      </p>
      <h2>O que coletamos — e o que não coletamos</h2>
      <p>
        O portal foi construído para funcionar com o mínimo de dados pessoais:
      </p>
      <ul>
        <li>
          <strong>Não</strong> pedimos CPF, RG, renda, holerite, dados bancários
          ou documentos;
        </li>
        <li>
          <strong>Não</strong> há formulário de solicitação de empréstimo — o
          portal não concede crédito;
        </li>
        <li>
          Os valores digitados nas calculadoras são processados no seu navegador
          e <strong>não são enviados nem armazenados</strong>;
        </li>
        <li>
          Se você nos escreve por e-mail, tratamos o endereço e o conteúdo da
          mensagem apenas para responder.
        </li>
      </ul>
      <h2>Cookies e ferramentas de terceiros</h2>
      <p>
        Enquanto ferramentas de análise de audiência e publicidade não estiverem
        ativas, o portal não utiliza cookies opcionais. Quando forem ativadas
        (por exemplo, Google Analytics e Google AdSense), esta política e a{" "}
        <Link href="/politica-de-cookies/">política de cookies</Link> serão
        atualizadas para listar exatamente as ferramentas em uso, e scripts
        opcionais dependerão da sua decisão de consentimento.
      </p>
      <h2>Bases legais</h2>
      <p>
        Tratamos dados com base no legítimo interesse (funcionamento e segurança
        do site), no consentimento (cookies opcionais, quando houver) e no
        cumprimento de obrigações legais, conforme a Lei nº 13.709/2018 (LGPD).
      </p>
      <h2>Seus direitos</h2>
      <p>
        A LGPD garante a você confirmação de tratamento, acesso, correção,
        anonimização, portabilidade, eliminação e informação sobre
        compartilhamentos. Para exercer qualquer direito, escreva para{" "}
        <strong>{CONTACT_EMAIL}</strong>. Responderemos no prazo legal.
      </p>
      <h2>Retenção e segurança</h2>
      <p>
        Mensagens de contato são mantidas apenas pelo tempo necessário ao
        atendimento — prazos específicos serão definidos com a revisão jurídica.
        O site utiliza HTTPS e cabeçalhos de segurança modernos.
      </p>
      <h2>Alterações</h2>
      <p>
        Esta política pode mudar para refletir novas ferramentas ou exigências
        legais. Alterações relevantes serão indicadas nesta página com data.
      </p>
    </InstitutionalShell>
  );
}
