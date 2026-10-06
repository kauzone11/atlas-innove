import type { NotificationKind, Prisma } from "@prisma/client";
import { createNotification } from "@/lib/notifications/service";

export async function notifySocial(client: Prisma.TransactionClient, input: { actorUserId: string; recipientUserId: string; kind: NotificationKind; postId: string; dedupeKey: string; title: string }) {
  await createNotification(client, { actorUserId: input.actorUserId, recipientUserId: input.recipientUserId, kind: input.kind, entityType: "SOCIAL_POST", entityId: input.postId, href: `/posts/${input.postId}`, dedupeKey: input.dedupeKey, title: input.title });
}
