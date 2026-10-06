import type { Metadata } from "next";
import { ActivityPage } from "@/components/social/activity-page";
import { requireAuthenticatedSession } from "@/lib/auth/session";
export const metadata: Metadata = { title: "Minha atividade" };
export default async function OwnActivity({ searchParams }: { searchParams: Promise<{ filter?: string; page?: string }> }) {
  const { user } = await requireAuthenticatedSession();
  return <ActivityPage userId={user.id} viewerUserId={user.id} fullName={user.profile?.fullName ?? "Minha atividade"} path="/app/personal/profile/activity" profileHref="/app/personal/profile" {...await searchParams} />;
}
