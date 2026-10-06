import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/ui";
import { SocialProfile } from "@/components/social/profile";

import { requireAuthenticatedSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

import { hasUserBlock } from "@/lib/network/locking";
import { getVisibleProfile } from "@/lib/profiles/service";

export default async function ConnectionProfile({ params }: { params: Promise<{ connectionId: string }> }) {
  const { user } = await requireAuthenticatedSession(); const { connectionId } = await params;
  const connection = await db.networkConnection.findFirst({ where: { id: connectionId, endedAt: null, OR: [{ userAId: user.id }, { userBId: user.id }] }, select: { userAId: true, userBId: true } });
  if (!connection) notFound(); const targetUserId = connection.userAId === user.id ? connection.userBId : connection.userAId;
  if (await hasUserBlock(db, user.id, targetUserId)) notFound();
  const identity = await db.innovationProfile.findUnique({ where: { userId: targetUserId }, select: { handle: true } });
  const profile = identity?.handle ? await getVisibleProfile(identity.handle, user.id) : null; if (!profile) notFound();

  return <div className="min-w-0 space-y-6"><Breadcrumbs items={[{ label: "Rede", href: "/app/personal/network" }, { label: "Conexões", href: "/app/personal/network/connections" }, { label: profile.fullName }]} /><SocialProfile profile={profile} viewerUserId={user.id} /></div>;
}
