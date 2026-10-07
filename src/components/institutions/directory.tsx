import Link from "next/link";
import { Building2, MapPin } from "lucide-react";
import { Avatar } from "@/components/media/avatar";
import { MediaImage } from "@/components/media/media-image";
import { InstitutionFollowButton } from "@/components/institutions/follow-button";
import type { MediaDto } from "@/lib/media/types";

export type InstitutionDirectoryItem = { id: string; slug: string; name: string; headline: string | null; city: string | null; state: string | null; focusAreas: string[]; followerCount: number; following: boolean; logoMedia: MediaDto | null };

export function InstitutionDirectory({ items, viewerUserId }: { items: InstitutionDirectoryItem[]; viewerUserId?: string | null }) {
  if (!items.length) return <div className="social-feed-empty"><Building2 size={22} aria-hidden="true" /><h2 className="mt-3 text-lg font-semibold">Nenhuma instituição encontrada</h2><p className="mt-2 text-sm leading-6 text-slate">Tente outro termo ou volte mais tarde.</p></div>;
  return <ul className="divide-y divide-line border-y border-line">{items.map((item) => <li key={item.id} className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center">
    <Link href={`/institutions/${item.slug}`} className="flex min-w-0 flex-1 items-start gap-4 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
      {item.logoMedia ? <MediaImage media={item.logoMedia} alt={`${item.name} — logotipo`} className="h-14 w-14 shrink-0 rounded-lg border border-line bg-white object-contain p-1" sizes="56px" /> : <Avatar name={item.name} media={null} size="medium" />}
      <div className="min-w-0"><h2 className="break-words font-semibold">{item.name}</h2>{item.headline ? <p className="mt-1 break-words text-sm leading-6 text-slate">{item.headline}</p> : null}{item.city || item.state ? <p className="mt-1 flex items-start gap-1.5 text-xs text-slate"><MapPin size={14} className="mt-0.5 shrink-0" aria-hidden="true" />{[item.city, item.state].filter(Boolean).join(", ")}</p> : null}<p className="mt-2 text-xs text-slate">{item.followerCount} {item.followerCount === 1 ? "seguidor" : "seguidores"}</p>{item.focusAreas.length ? <p className="mt-2 text-xs leading-5 text-slate">{item.focusAreas.slice(0, 4).join(" · ")}</p> : null}</div>
    </Link>
    {viewerUserId ? <InstitutionFollowButton organizationId={item.id} following={item.following} /> : <Link className="button-secondary" href="/login">Entrar para seguir</Link>}
  </li>)}</ul>;
}
