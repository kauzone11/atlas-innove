import type { Prisma } from "@prisma/client";
import { AuthorizationError } from "@/lib/auth/authorization";
import { requireSuperAdminUser } from "@/lib/auth/platform-access";
import { db } from "@/lib/db";
import { DomainConflictError, ResourceNotFoundError } from "@/lib/errors";
import { boundedPage, reviewSafetyReportSchema, safetyReportSchema } from "@/lib/communication/schemas";
import { canonicalUserPair, lockUserPair } from "@/lib/network/locking";
import { reportSocialContent } from "@/lib/social/moderation";

async function canReferencePerson(client: Prisma.TransactionClient, userId: string, otherUserId: string): Promise<boolean> {
  const pair = canonicalUserPair(userId, otherUserId);
  const [discoverable, relationship, request, block, projectInvite, teamInvite, collaboration] = await Promise.all([
    client.innovationProfile.findFirst({ where: { userId: otherUserId, directoryEnabled: true, profileVisibility: { in: ["PUBLIC", "PLATFORM"] }, handle: { not: null }, headline: { not: null } }, select: { id: true } }),
    client.networkConnection.findFirst({ where: pair, select: { id: true } }),
    client.connectionRequest.findFirst({ where: { userAId: pair.userAId, userBId: pair.userBId }, select: { id: true } }),
    client.userBlock.findUnique({ where: { blockerUserId_blockedUserId: { blockerUserId: userId, blockedUserId: otherUserId } }, select: { blockedUserId: true } }),
    client.projectInvite.findFirst({ where: { OR: [{ invitedByUserId: userId, invitedUserId: otherUserId }, { invitedByUserId: otherUserId, invitedUserId: userId }] }, select: { id: true } }),
    client.teamInvite.findFirst({ where: { OR: [{ invitedByUserId: userId, invitedUserId: otherUserId }, { invitedByUserId: otherUserId, invitedUserId: userId }] }, select: { id: true } }),
    client.project.findFirst({ where: { AND: [
      { OR: [{ memberships: { some: { userId, leftAt: null } } }, { primaryTeam: { archivedAt: null, memberships: { some: { userId, leftAt: null, status: "ACTIVE" } } } }] },
      { OR: [{ memberships: { some: { userId: otherUserId, leftAt: null } } }, { primaryTeam: { archivedAt: null, memberships: { some: { userId: otherUserId, leftAt: null, status: "ACTIVE" } } } }] },
    ] }, select: { id: true } }),
  ]);
  return Boolean(discoverable || relationship || request || block || projectInvite || teamInvite || collaboration);
}

export async function createSafetyReport(userId: string, value: unknown, now = new Date()) {
  const input = safetyReportSchema.parse(value);
  if (input.postId || input.commentId) return reportSocialContent(userId, { postId: input.postId, commentId: input.commentId, reason: input.reason, details: input.details }, input.reportedUserId);
  const reportedUserId = input.reportedUserId;
  if (!reportedUserId || reportedUserId === userId) throw new AuthorizationError("SAFETY_CONTEXT_UNAVAILABLE");
  return db.$transaction(async (client) => {
    await lockUserPair(client, userId, reportedUserId);
    if (input.conversationId) {
      const conversation = await client.conversation.findFirst({ where: { id: input.conversationId, participants: { some: { userId } }, ...canonicalUserPair(userId, reportedUserId) }, select: { id: true, participants: { select: { userId: true } } } });
      if (!conversation || conversation.participants.length !== 2 || conversation.participants.some((entry) => ![userId, reportedUserId].includes(entry.userId))) throw new AuthorizationError("SAFETY_CONTEXT_UNAVAILABLE");
      if (input.messageId && !(await client.directMessage.findFirst({ where: { id: input.messageId, conversationId: conversation.id, senderUserId: reportedUserId }, select: { id: true } }))) throw new AuthorizationError("SAFETY_CONTEXT_UNAVAILABLE");
    } else if (!(await canReferencePerson(client, userId, reportedUserId))) throw new AuthorizationError("SAFETY_CONTEXT_UNAVAILABLE");
    if (await client.safetyReport.count({ where: { reporterUserId: userId, createdAt: { gte: new Date(now.getTime() - 86_400_000) } } }) >= 10) throw new DomainConflictError("SAFETY_REPORT_RATE_LIMIT");
    return client.safetyReport.create({ data: { ...input, reportedUserId, reportedOrganizationId: null, reporterUserId: userId, createdAt: now }, select: { id: true } });
  });
}

export async function listSafetyReports(userId: string, options: { page?: unknown; status?: string } = {}) {
  await requireSuperAdminUser(userId);
  const page = boundedPage(options.page); const pageSize = 30;
  const status = ["OPEN", "REVIEWED", "DISMISSED", "ACTIONED"].includes(options.status ?? "") ? options.status as "OPEN" | "REVIEWED" | "DISMISSED" | "ACTIONED" : "OPEN";
  const where = { status };
  const [records, total] = await Promise.all([
    db.safetyReport.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize, select: {
      id: true, reason: true, details: true, status: true, conversationId: true, messageId: true, postId: true, commentId: true, createdAt: true, reviewedAt: true,
      post: { select: { body: true, deletedAt: true } }, comment: { select: { body: true, deletedAt: true, hiddenByPostAuthorAt: true } },
      reporter: { select: { id: true, profile: { select: { fullName: true } } } }, reported: { select: { id: true, profile: { select: { fullName: true } } } },
      reportedOrganization: { select: { id: true, name: true } },
      message: { select: { body: true, createdAt: true, deletedAt: true } }, reviewedBy: { select: { profile: { select: { fullName: true } } } },
    } }), db.safetyReport.count({ where }),
  ]);
  return { page, pageSize, status, total, reports: records.map((record) => ({ id: record.id, reason: record.reason, details: record.details, status: record.status, conversationId: record.conversationId, messageId: record.messageId, postId: record.postId, commentId: record.commentId, socialContent: record.comment ? { body: record.comment.body, deleted: Boolean(record.comment.deletedAt), hidden: Boolean(record.comment.hiddenByPostAuthorAt) } : record.post ? { body: record.post.body, deleted: Boolean(record.post.deletedAt), hidden: false } : null, createdAt: record.createdAt.toISOString(), reviewedAt: record.reviewedAt?.toISOString() ?? null, reporter: { userId: record.reporter.id, fullName: record.reporter.profile?.fullName ?? "Pessoa da plataforma" }, reported: record.reported ? { type: "PERSON" as const, userId: record.reported.id, organizationId: null, fullName: record.reported.profile?.fullName ?? "Pessoa da plataforma" } : { type: "ORGANIZATION" as const, userId: null, organizationId: record.reportedOrganization?.id ?? null, fullName: record.reportedOrganization?.name ?? "Instituição da plataforma" }, message: record.message ? { body: record.message.body, createdAt: record.message.createdAt.toISOString(), deleted: Boolean(record.message.deletedAt) } : null, reviewedByName: record.reviewedBy?.profile?.fullName ?? null })) };
}

export async function reviewSafetyReport(userId: string, reportId: string, value: unknown, now = new Date()): Promise<void> {
  const { status } = reviewSafetyReportSchema.parse(value);
  await db.$transaction(async (client) => {
    await requireSuperAdminUser(userId, client);
    const report = await client.safetyReport.findUnique({ where: { id: reportId }, select: { id: true } });
    if (!report) throw new ResourceNotFoundError("SAFETY_REPORT_NOT_FOUND");
    await client.safetyReport.update({ where: { id: reportId }, data: { status, reviewedAt: now, reviewedByUserId: userId } });
  });
}
