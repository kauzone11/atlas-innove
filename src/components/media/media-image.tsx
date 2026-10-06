"use client";

import { useState, type CSSProperties } from "react";
import { ImageOff } from "lucide-react";
import type { MediaDto } from "@/lib/media/types";

export function MediaImage({ media, alt, className = "", sizes = "(max-width: 767px) 100vw, 700px", loading = "lazy", detail = false, style }: {
  media: MediaDto; alt: string; className?: string; sizes?: string; loading?: "lazy" | "eager"; detail?: boolean; style?: CSSProperties;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = detail ? media.detailUrl : media.url;
  if (failedUrl === url) return <span className={`media-unavailable ${className}`} style={{ aspectRatio: `${media.width} / ${media.height}`, ...style }} role="img" aria-label={alt ? `Imagem indisponível: ${alt}` : "Imagem indisponível"}><ImageOff size={24} aria-hidden="true" /><span>Imagem indisponível</span></span>;
  // Generated derivatives retain cookie authorization; a shared image optimizer must never cache these URLs.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} srcSet={detail ? undefined : media.srcSet} sizes={detail ? undefined : sizes} width={media.width} height={media.height} alt={alt} className={className} style={style} loading={loading} decoding="async" onError={() => setFailedUrl(url)} />;
}
