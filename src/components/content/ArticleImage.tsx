import { ZoomableImage } from "@/components/content/ZoomableImage";

/**
 * Imagem editorial dentro do corpo do artigo. Regra do proprietário
 * (21/08/2026): toda imagem tem `alt` descritivo obrigatório (auditado por
 * audit:metadata) e entra no ponto do texto em que agrega — nunca solta.
 * O clique amplia a imagem em tela cheia (ZoomableImage).
 */
export function ArticleImage({
  src,
  alt,
  caption,
  width = 1600,
  height = 900,
  priority = false,
}: {
  src: string;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
  priority?: boolean;
}) {
  return (
    <figure className="my-8">
      <ZoomableImage
        src={src}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        className="w-full rounded-xl border border-brand-border"
      />
      {caption ? (
        <figcaption className="mt-2 text-center text-sm text-brand-muted">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
