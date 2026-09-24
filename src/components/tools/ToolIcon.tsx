import type { ToolType } from "@/lib/tools/registry";

/**
 * Um ícone por TIPO de ferramenta, não por ferramenta: o leitor aprende oito
 * formas e reconhece "isto compara", "isto verifica" em qualquer card. SVG
 * inline, monocromático, sem biblioteca: pesa menos que uma fonte de ícones.
 * Decorativo: o nome da ferramenta ao lado já diz tudo.
 */
const PATHS: Record<ToolType, string> = {
  calculadora: "M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm1 3v3h8V6H8Zm0 6h2v2H8v-2Zm3 0h2v2h-2v-2Zm3 0h2v5h-2v-5Zm-6 3h2v2H8v-2Zm3 0h2v2h-2v-2Z",
  simulador: "M4 5h16v11H4V5Zm2 2v7h12V7H6Zm2 12h8v2H8v-2Zm0-7 3-3 2 2 3-4v6H8Z",
  comparador: "M4 4h7v16H4V4Zm2 2v12h3V6H6Zm7-2h7v16h-7V4Zm2 2v12h3V6h-3Z",
  conversor: "M7 7h10l-3-3 1.5-1.5L21 8l-5.5 5.5L14 12l3-3H7V7Zm10 10H7l3 3-1.5 1.5L3 16l5.5-5.5L10 12l-3 3h10v2Z",
  planejador: "M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm1 2v12h12V6H6Zm2 3h2v2H8V9Zm3 0h5v2h-5V9Zm-3 4h2v2H8v-2Zm3 0h5v2h-5v-2Z",
  radar: "M12 3a9 9 0 1 1-9 9h2a7 7 0 1 0 7-7V3Zm0 4a5 5 0 1 1-5 5h2a3 3 0 1 0 3-3V7Zm-1 5h2v2h-2v-2Z",
  verificador: "M12 2 20 6v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4Zm0 2.3L6 7.3V12c0 3.8 2.5 6.6 6 7.9 3.5-1.3 6-4.1 6-7.9V7.3l-6-3ZM11 8h2v5h-2V8Zm0 6h2v2h-2v-2Z",
  consulta: "M10 3a7 7 0 0 1 5.6 11.2l5.1 5.1-1.4 1.4-5.1-5.1A7 7 0 1 1 10 3Zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z",
};

export function ToolIcon({ type, className = "h-6 w-6" }: { type: ToolType; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d={PATHS[type]} />
    </svg>
  );
}
