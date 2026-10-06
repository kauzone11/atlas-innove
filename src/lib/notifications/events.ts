import type { NotificationKind, Prisma } from "@prisma/client";
import { createNotifications } from "@/lib/notifications/service";
import { projectManagerIds } from "@/lib/network/project-contact";
export { projectManagerIds } from "@/lib/network/project-contact";

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
