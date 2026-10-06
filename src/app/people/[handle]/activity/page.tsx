import type { Metadata } from "next";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { notFound } from "next/navigation";
import { PublicShell } from "@/components/public-shell";
import { ActivityPage } from "@/components/social/activity-page";
import { getPublicProfile } from "@/lib/profiles/service";
export const metadata: Metadata = { title: "Atividade pública", robots: { index: false, follow: true } };
export default async function PublicActivity({ params, searchParams }: { params: Promise<{ handle: string }>; searchParams: Promise<{ filter?: string; page?: string }> }) {
  const { handle } = await params; const auth = await getAuthenticatedSession(); const profile = await getPublicProfile(handle, auth?.user.id); if (!profile) notFound();
  return <PublicShell><ActivityPage publicOnly viewerUserId={auth?.user.id} userId={profile.userId} fullName={profile.fullName} path={`/people/${handle}/activity`} profileHref={`/people/${handle}`} {...await searchParams} /></PublicShell>;
}
