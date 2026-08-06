import type { NextConfig } from "next";

const isProduction = process.env.VERCEL_ENV === "production";

/**
 * Headers de segurança aplicados a todas as rotas.
 * A CSP é permissiva o suficiente para GA4/GTM/AdSense quando forem ativados
 * (os scripts só são carregados com consentimento e com IDs reais configurados).
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // 'unsafe-inline' é exigido pelo runtime do Next.js e pelos snippets do GA/AdSense.
      "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://pagead2.googlesyndication.com https://www.google-analytics.com https://ep2.adtrafficquality.google",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://www.google-analytics.com https://pagead2.googlesyndication.com https://ep1.adtrafficquality.google",
      "frame-src https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://www.google.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

/**
 * Em qualquer ambiente que não seja produção (previews do Vercel, branch deploys),
 * nenhuma página pode ser indexada.
 */
const previewHeaders = [
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
];

const nextConfig: NextConfig = {
  trailingSlash: true,
  poweredByHeader: false,
  async headers() {
    const rules = [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
    if (!isProduction) {
      rules.push({
        source: "/:path*",
        headers: previewHeaders,
      });
    }
    return rules;
  },
  async redirects() {
    return [
      // Domínio sem www redireciona permanentemente para o domínio canônico.
      {
        source: "/:path*",
        has: [{ type: "host", value: "creditoporperto.com.br" }],
        destination: "https://www.creditoporperto.com.br/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
