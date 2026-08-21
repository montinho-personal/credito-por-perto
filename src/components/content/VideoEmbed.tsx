"use client";

import { useState } from "react";

/**
 * Vídeo do YouTube com clique-para-carregar. Antes do clique, nenhuma
 * requisição sai para o YouTube (nem thumbnail): a fachada é 100% local,
 * coerente com a política de privacidade do portal. Ao clicar, o player
 * carrega via youtube-nocookie.com (modo de privacidade avançada).
 * `title` é obrigatório (acessibilidade + contexto; auditado).
 */
export function VideoEmbed({
  videoId,
  title,
  channel,
}: {
  videoId: string;
  title: string;
  channel?: string;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <figure className="my-8">
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-brand-border bg-brand-navy">
        {loaded ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => setLoaded(true)}
            aria-label={`Assistir vídeo: ${title}`}
            className="group absolute inset-0 flex h-full w-full flex-col items-center justify-center gap-4 px-6 text-center"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-gold transition-transform group-hover:scale-110">
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="ml-1 h-7 w-7 fill-brand-navy"
              >
                <path d="M8 5.14v13.72L19 12 8 5.14z" />
              </svg>
            </span>
            <span className="text-base font-semibold text-white">{title}</span>
            <span className="text-xs text-white/70">
              O player do YouTube só carrega depois do clique
              {channel ? ` · ${channel}` : ""}
            </span>
          </button>
        )}
      </div>
      <figcaption className="mt-2 text-center text-sm text-brand-muted">
        Vídeo{channel ? ` do canal ${channel}` : ""}: {title}
      </figcaption>
    </figure>
  );
}
