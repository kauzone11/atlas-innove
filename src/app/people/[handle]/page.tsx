import type { Metadata } from "next";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { notFound } from "next/navigation";
import { PublicShell } from "@/components/public-shell";
import { SocialProfile } from "@/components/social/profile";
import { getPublicProfile } from "@/lib/profiles/service";
import { appMetadataUrl } from "@/lib/app-base-url";

type Context = { params: Promise<{ handle: string }> };
export async function generateMetadata({ params }: Context): Promise<Metadata> {
  const { handle } = await params; const profile = await getPublicProfile(handle);
  if (!profile) return { title: "Perfil não encontrado", robots: { index: false, follow: false } };
  return {
    title: profile.fullName, description: profile.headline ?? undefined,
    alternates: { canonical: appMetadataUrl(`/people/${profile.handle}`) },
    robots: { index: true, follow: true },
  };
}
export default async function PublicProfilePage({ params }: Context) {
  const { handle } = await params; const auth = await getAuthenticatedSession(); const profile = await getPublicProfile(handle, auth?.user.id);
  if (!profile) notFound();
  return <PublicShell><SocialProfile profile={profile} viewerUserId={auth?.user.id} publicOnly own={profile.userId === auth?.user.id} /></PublicShell>;
}
