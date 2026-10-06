"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { MediaImage } from "@/components/media/media-image";
import type { SocialPostMediaDto } from "@/lib/media/types";

export function PostImages({ images, compact = false }: { images: SocialPostMediaDto[]; compact?: boolean }) {
  const [selected, setSelected] = useState<number | null>(null);
  const visible = images.slice(0, 4);
  if (!visible.length) return null;
  const current = selected === null ? null : visible[selected];
  return <>
    <div className={`post-images post-images-${visible.length}${compact ? " post-images-compact" : ""}`}>
      {visible.map((media, index) => <button className="post-image-open" key={media.id} type="button" aria-label={`Ampliar imagem ${index + 1} de ${visible.length}${media.altText ? `: ${media.altText}` : ""}`} onClick={() => setSelected(index)}>
        <MediaImage media={media} alt={media.altText ?? ""} sizes={compact ? "(max-width: 767px) 90vw, 540px" : "(max-width: 767px) 100vw, 700px"} />
      </button>)}
    </div>
    <Dialog open={Boolean(current)} onClose={() => setSelected(null)} title={`Imagem ${(selected ?? 0) + 1} de ${visible.length}`} size="image">
      {current ? <div className="media-viewer" tabIndex={-1} data-autofocus role="group" aria-label="Imagem ampliada" onKeyDown={(event) => { if (event.key === "ArrowRight" && selected! < visible.length - 1) { event.preventDefault(); setSelected(selected! + 1); } else if (event.key === "ArrowLeft" && selected! > 0) { event.preventDefault(); setSelected(selected! - 1); } }}>
        <MediaImage media={current} alt={current.altText ?? "Imagem da publicação"} detail loading="eager" className="media-viewer-image" />
        {current.altText ? <p className="mt-3 text-sm leading-6 text-slate">{current.altText}</p> : null}
        {visible.length > 1 ? <div className="mt-4 flex items-center justify-between gap-3"><button type="button" className="button-secondary" disabled={selected === 0} onClick={() => setSelected((value) => Math.max(0, (value ?? 0) - 1))}><ChevronLeft size={18} aria-hidden="true" />Anterior</button><span role="status" className="text-sm tabular-nums text-slate">{selected! + 1} / {visible.length}</span><button type="button" className="button-secondary" disabled={selected === visible.length - 1} onClick={() => setSelected((value) => Math.min(visible.length - 1, (value ?? 0) + 1))}>Próxima<ChevronRight size={18} aria-hidden="true" /></button></div> : null}
      </div> : null}
    </Dialog>
  </>;
}
