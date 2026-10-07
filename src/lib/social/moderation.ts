import { AuthorizationError } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import { DomainConflictError } from "@/lib/errors";
import { lockSocialComment } from "@/lib/social/comments";
import { socialReportSchema } from "@/lib/social/schemas";
import { lockPost } from "@/lib/social/transaction";

export async function reportSocialContent(userId: string, value: unknown, expectedReportedUserId?: string) {
  const input = socialReportSchema.parse(value);
  return db.$transaction(async (client) => {
    const context = input.commentId ? await lockSocialComment(client, userId, input.commentId) : { post: await lockPost(client, userId, input.postId!), comment: null };
    if (input.postId && input.postId !== context.post.id) throw new AuthorizationError("SAFETY_CONTEXT_UNAVAILABLE");
    const reportedUserId = context.comment?.authorUserId ?? context.post.authorUserId;
    const reportedOrganizationId = context.comment ? null : context.post.authorOrganizationId;
    if (expectedReportedUserId && expectedReportedUserId !== reportedUserId) throw new AuthorizationError("SAFETY_CONTEXT_UNAVAILABLE");
    if (reportedUserId === userId) throw new AuthorizationError("SAFETY_CONTEXT_UNAVAILABLE");
    if (!reportedUserId && !reportedOrganizationId) throw new AuthorizationError("SAFETY_CONTEXT_UNAVAILABLE");
    if (await client.safetyReport.count({ where: { reporterUserId: userId, createdAt: { gte: new Date(Date.now() - 86_400_000) } } }) >= 10) throw new DomainConflictError("SAFETY_REPORT_RATE_LIMIT");
    return client.safetyReport.create({ data: { reporterUserId: userId, reportedUserId, reportedOrganizationId, postId: context.post.id, commentId: context.comment?.id, reason: input.reason, details: input.details }, select: { id: true } });
  });
}
