import type { NotificationKind, Prisma } from "@prisma/client";
import { createNotifications, MAX_NOTIFICATION_FANOUT } from "@/lib/notifications/service";

export async function projectManagerIds(client: Prisma.TransactionClient, projectId: string) {
  const project = await client.project.findUnique({ where: { id: projectId }, select: {
    memberships: { where: { leftAt: null, role: { in: ["OWNER", "LEAD"] } }, select: { userId: true }, orderBy: { userId: "asc" }, take: MAX_NOTIFICATION_FANOUT },
    primaryTeam: { select: { archivedAt: true, memberships: { where: { status: "ACTIVE", leftAt: null, role: { in: ["OWNER", "LEAD"] } }, select: { userId: true }, orderBy: { userId: "asc" }, take: MAX_NOTIFICATION_FANOUT } } },
  } });
  if (!project) return [];
  return [...new Set([...project.memberships, ...(!project.primaryTeam?.archivedAt ? project.primaryTeam?.memberships ?? [] : [])].map((member) => member.userId))].sort().slice(0, MAX_NOTIFICATION_FANOUT);
}

export async function notifyAwardManagers(client: Prisma.TransactionClient, input: {
  organizationId: string; awardId: string; actorUserId: string; kind: NotificationKind;
  dedupeKey: string; title: string;
}) {
  const award = await client.award.findFirst({ where: { organizationId: input.organizationId, id: input.awardId }, select: { application: { select: { projectId: true } } } });
  if (!award) return;
  const recipients = await projectManagerIds(client, award.application.projectId);
  await createNotifications(client, recipients.map((recipientUserId) => ({
    recipientUserId, actorUserId: input.actorUserId, kind: input.kind, entityType: "Award", entityId: input.awardId,
    title: input.title, href: `/app/personal/awards/${input.awardId}`, dedupeKey: input.dedupeKey,
  })));
}
