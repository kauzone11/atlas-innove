import type { Metadata } from "next";
import { SocialProfile } from "@/components/social/profile";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { getOwnProfile, getOwnVisibleProfile } from "@/lib/profiles/service";
export const metadata: Metadata = { title: "Meu perfil" };
export default async function PersonalProfilePage() {
  const { user } = await requireAuthenticatedSession();
  const own = await getOwnProfile(user.id); const profile = await getOwnVisibleProfile(user.id);
  return <SocialProfile profile={profile} viewerUserId={user.id} own publicProfile={own.profileVisibility === "PUBLIC" && Boolean(own.publishedAt)} />;
}
