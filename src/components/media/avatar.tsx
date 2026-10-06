"use client";

import { useState } from "react";
import type { MediaDto } from "@/lib/media/types";
import { avatarMonogram } from "@/lib/media/identity";

const dimensions = { small: 32, medium: 44, large: 64, profile: 112 };

export function Avatar({ name, media, size = "medium", className = "" }: { name: string; media?: MediaDto | null; size?: keyof typeof dimensions; className?: string }) {
  const [failedId, setFailedId] = useState<string | null>(null);
  const dimension = dimensions[size];
  return <span className={`atlas-avatar atlas-avatar-${size} ${className}`} aria-hidden="true">
    {media && failedId !== media.id ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={media.url} srcSet={media.srcSet} sizes={`${dimension}px`} width={dimension} height={dimension} alt="" loading={size === "profile" ? "eager" : "lazy"} decoding="async" onError={() => setFailedId(media.id)} />
    ) : avatarMonogram(name)}
  </span>;
}
