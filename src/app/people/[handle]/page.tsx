import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicShell } from "@/components/public-shell";
import { ProfileRenderer } from "@/components/profiles/profile-renderer";
import { getPublicProfile } from "@/lib/profiles/service";

type Context = { params: Promise<{ handle: string }> };
export async function generateMetadata({ params }: Context): Promise<Metadata> {
  const { handle } = await params; const profile = await getPublicProfile(handle);
  if (!profile) return { title: "Perfil não encontrado", robots: { index: false, follow: false } };
  return {
    title: profile.fullName, description: profile.headline ?? undefined,
    alternates: { canonical: `https://innove.ouseagency.com/people/${profile.handle}` },
    robots: { index: true, follow: true },
  };
}
export default async function PublicProfilePage({ params }: Context) {
  const { handle } = await params; const profile = await getPublicProfile(handle);
  if (!profile) notFound();
  return <PublicShell><ProfileRenderer profile={profile} /></PublicShell>;
}
