"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

/**
 * Imagem editorial ampliável: o clique abre a arte em tela cheia sobre um
 * fundo escuro (lightbox), sem bibliotecas externas. Fecha com clique em
 * qualquer ponto, no botão X ou com Esc. Enquanto aberta, o scroll da
 * página fica travado.
 */
export function ZoomableImage({
  src,
  alt,
  width = 1600,
  height = 900,
  priority = false,
  sizes = "(max-width: 768px) 100vw, 768px",
  className = "",
}: {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  priority?: boolean;
  sizes?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Ampliar imagem: ${alt}`}
        className="block w-full cursor-zoom-in border-0 bg-transparent p-0"
      >
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          priority={priority}
          sizes={sizes}
          className={className}
        />
      </button>
      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 sm:p-8"
          onClick={() => setOpen(false)}
        >
          <button
            type="button"
            aria-label="Fechar imagem ampliada"
            onClick={() => setOpen(false)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-2xl leading-none text-white transition-colors hover:bg-white/30"
          >
            ×
          </button>
          <Image
            src={src}
            alt={alt}
            width={width}
            height={height}
            sizes="100vw"
            className="max-h-full w-auto max-w-full cursor-zoom-out rounded-lg object-contain"
          />
        </div>
      ) : null}
    </>
  );
}
