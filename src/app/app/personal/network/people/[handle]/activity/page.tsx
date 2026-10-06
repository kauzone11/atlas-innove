import { notFound } from "next/navigation";
import { ActivityPage } from "@/components/social/activity-page";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { getVisibleProfile } from "@/lib/profiles/service";
export default async function PersonActivity({ params, searchParams }: { params: Promise<{ handle: string }>; searchParams: Promise<{ filter?: string; page?: string }> }) {
  const { user } = await requireAuthenticatedSession(); const { handle } = await params; const profile = await getVisibleProfile(handle, user.id); if (!profile) notFound();
  return <ActivityPage userId={profile.userId} viewerUserId={user.id} fullName={profile.fullName} path={`/app/personal/network/people/${handle}/activity`} profileHref={`/app/personal/network/people/${handle}`} {...await searchParams} />;
}
