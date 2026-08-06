import Link from "next/link";

export function Logo({ variant = "light" }: { variant?: "light" | "dark" }) {
  const navy = variant === "light" ? "text-brand-navy" : "text-white";
  const teal = variant === "light" ? "text-brand-teal-dark" : "text-brand-teal-soft";
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5"
      aria-label="Crédito Por Perto — página inicial"
    >
      <svg
        viewBox="0 0 64 64"
        className="h-9 w-9 shrink-0"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M32 5c11.6 0 21 9.2 21 20.7 0 8.4-5.6 16.6-11.2 22.8A85 85 0 0 1 32 58.4a85 85 0 0 1-9.8-9.9C16.6 42.3 11 34.1 11 25.7 11 14.2 20.4 5 32 5Z"
          fill={variant === "light" ? "#10263F" : "#FDFBF7"}
        />
        <path
          d="M22.5 28.5 29 35l13-15"
          fill="none"
          stroke={variant === "light" ? "#2DB89E" : "#0E7C6B"}
          strokeWidth="5.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className={`font-serif text-xl font-bold leading-none ${navy}`}>
        Crédito <span className={teal}>Por Perto</span>
      </span>
    </Link>
  );
}
