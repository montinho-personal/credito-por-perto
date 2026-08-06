import Link from "next/link";
import Image from "next/image";

/**
 * Logo oficial (docs/brand/): horizontal no header/footer, ícone isolado em
 * espaços mínimos. Sem sombras, gradientes, contornos ou distorções.
 */
export function Logo({ variant = "light" }: { variant?: "light" | "dark" }) {
  const src =
    variant === "light"
      ? "/brand/credito-por-perto-logo-horizontal.svg"
      : "/brand/credito-por-perto-logo-horizontal-fundo-escuro.svg";
  return (
    <Link
      href="/"
      className="flex items-center"
      aria-label="Crédito por Perto — página inicial"
    >
      <Image
        src={src}
        alt="Crédito por Perto"
        width={184}
        height={44}
        priority={variant === "light"}
        className="h-9 w-auto md:h-10"
      />
    </Link>
  );
}

/** Símbolo isolado (CP), para espaços muito pequenos. */
export function LogoIcon({ size = 36 }: { size?: number }) {
  return (
    <Image
      src="/brand/credito-por-perto-icon.svg"
      alt="Crédito por Perto"
      width={size}
      height={size}
    />
  );
}
