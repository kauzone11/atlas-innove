import Link from "next/link";
import type { Metadata } from "next";
import { SocialProfile } from "@/components/social/profile";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { getPublicProfilePreview } from "@/lib/profiles/service";

export const metadata: Metadata = { title: "Prévia do perfil", robots: { index: false, follow: false } };
export default async function ProfilePreviewPage() {
  const { user } = await requireAuthenticatedSession(); const profile = await getPublicProfilePreview(user.id);
  return <div className="space-y-7"><div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-5 py-4"><p className="max-w-2xl text-sm leading-6 text-slate">Prévia para visitantes sem login. Somente seções e registros configurados como públicos aparecem aqui.</p><Link className="button-secondary" href="/app/personal/profile">Voltar ao perfil</Link></div>{profile ? <SocialProfile profile={profile} preview publicOnly /> : <p className="text-sm text-slate">Complete seu nome na conta, o endereço e a apresentação para visualizar seu perfil público.</p>}</div>;
}
