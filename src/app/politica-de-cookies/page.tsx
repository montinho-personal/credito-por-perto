import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata/build";
import {
  InstitutionalShell,
  LegalTemplateNotice,
} from "@/components/layout/InstitutionalShell";

export const metadata: Metadata = buildMetadata({
  title: "Política de cookies",
  description:
    "Quais cookies o Crédito Por Perto utiliza hoje, quais poderão ser utilizados com analytics e publicidade, e como gerenciar suas preferências.",
  path: "/politica-de-cookies/",
});

// TEMPLATE LEGAL — pendente de revisão jurídica. Atualizar a lista de cookies
// quando GA4/GTM/AdSense forem efetivamente ativados.
export default function PoliticaDeCookiesPage() {
  return (
    <InstitutionalShell
      title="Política de cookies"
      description="Uso de cookies no Crédito Por Perto."
      path="/politica-de-cookies/"
    >
      <LegalTemplateNotice />
      <h2>O que são cookies</h2>
      <p>
        Cookies são pequenos arquivos que o navegador armazena para lembrar
        informações entre visitas. Eles podem ser essenciais (necessários ao
        funcionamento) ou opcionais (estatísticas e publicidade).
      </p>
      <h2>Situação atual</h2>
      <p>
        Hoje o portal funciona <strong>sem cookies opcionais</strong>: não há
        ferramentas de análise de audiência nem publicidade ativas. Preferências
        locais (como escolhas de consentimento) podem ser guardadas no
        armazenamento do próprio navegador, sem identificar você.
      </p>
      <h2>Cookies que poderão ser usados</h2>
      <ul>
        <li>
          <strong>Estatísticas (Google Analytics 4):</strong> medem visitas e
          páginas mais lidas, de forma agregada;
        </li>
        <li>
          <strong>Publicidade (Google AdSense):</strong> exibem e medem anúncios
          — podem envolver personalização conforme as configurações do Google e
          o seu consentimento.
        </li>
      </ul>
      <p>
        Quando essas ferramentas forem ativadas, os scripts opcionais só serão
        carregados após sua decisão em um aviso de consentimento, e esta página
        listará os cookies efetivamente em uso.
      </p>
      <h2>Como gerenciar</h2>
      <p>
        Você pode apagar ou bloquear cookies nas configurações do navegador a
        qualquer momento. Veja também a{" "}
        <Link href="/politica-de-privacidade/">política de privacidade</Link>.
      </p>
    </InstitutionalShell>
  );
}
