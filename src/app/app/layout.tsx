import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { AppShell } from "@/components/app-shell";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { unreadNotificationCount } from "@/lib/notifications/service";
import { db } from "@/lib/db";
import { mediaDto, mediaSelect } from "@/lib/media/presentation";

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const auth = await getAuthenticatedSession();
  if (!auth) {
    const returnTo = (await headers()).get("x-atlas-return-to");
    redirect(returnTo?.startsWith("/app") && !/[\\\r\n]/.test(returnTo) ? `/login?next=${encodeURIComponent(returnTo)}` : "/login");
  }
  const activeOrganization = auth.memberships.find(
    (membership) => membership.organizationId === auth.session.activeOrganizationId,
  ) ?? (auth.memberships.length === 1 ? auth.memberships[0] : null);

  const [unread, profileMedia] = await Promise.all([
    unreadNotificationCount(auth.user.id),
    db.innovationProfile.findUnique({ where: { userId: auth.user.id }, select: { avatarMedia: { select: mediaSelect } } }),
  ]);
  return <AppShell organizationName={activeOrganization?.organization.name} userName={auth.user.profile?.fullName ?? auth.user.email} avatarMedia={mediaDto(profileMedia?.avatarMedia)} hasOrganization={Boolean(activeOrganization)} unreadNotifications={unread} isPlatformAdmin={auth.user.platformRole === "SUPER_ADMIN"}>{children}</AppShell>;
}
