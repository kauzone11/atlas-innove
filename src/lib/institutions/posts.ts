import { Prisma, type OrganizationRole } from "@prisma/client";
import { AuthorizationError } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import { DomainConflictError, ResourceNotFoundError } from "@/lib/errors";
import { attachPostMedia } from "@/lib/media/attachments";
import { lockMedia } from "@/lib/media/service";
import { lockNetworkUsers } from "@/lib/network/locking";
import { consumeSocialRate } from "@/lib/social/transaction";
import { loadPosts } from "@/lib/social/read-model";
import { organizationPostSchema, organizationPostUpdateSchema } from "@/lib/institutions/schemas";

const roleRank: Record<OrganizationRole, number> = { OWNER: 50, ADMIN: 40, MANAGER: 30, ANALYST: 20, VIEWER: 10 };

async function lockOrganization(client: Prisma.TransactionClient, organizationId: string) {
  const rows = await client.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Organization" WHERE "id" = ${organizationId} FOR UPDATE`;
  if (!rows.length) throw new ResourceNotFoundError("ORGANIZATION_NOT_FOUND");
}

async function requirePostManager(client: Prisma.TransactionClient, organizationId: string, userId: string) {
  const membership = await client.organizationMembership.findFirst({ where: { organizationId, userId, status: "ACTIVE", organization: { status: "ACTIVE" } }, select: { role: true } });
  if (!membership || roleRank[membership.role] < roleRank.MANAGER) throw new AuthorizationError("ROLE_FORBIDDEN");
}

async function requireProgram(client: Prisma.TransactionClient, organizationId: string, programId: string | null, visibility: "PUBLIC" | "PLATFORM") {
  if (!programId) return;
  await client.$queryRaw`SELECT "id" FROM "FundingProgram" WHERE "organizationId" = ${organizationId} AND "id" = ${programId} FOR SHARE`;
  const program = await client.fundingProgram.findFirst({ where: { organizationId, id: programId }, select: { id: true, status: true, publicPageEnabled: true, publishedAt: true } });
  if (!program) throw new ResourceNotFoundError("PROGRAM_NOT_FOUND");
  if (visibility === "PUBLIC" && (!program.publicPageEnabled || !program.publishedAt || program.status === "DRAFT")) throw new DomainConflictError("PROGRAM_PUBLICATION_REQUIRED");
}

async function snapshot(client: Prisma.TransactionClient, postId: string): Promise<Prisma.InputJsonObject> {
  const post = await client.socialPost.findUnique({ where: { id: postId }, select: {
    body: true, externalUrl: true, visibility: true, commentPolicy: true, allowReposts: true, fundingProgramId: true,
    media: { select: { mediaId: true, position: true, altText: true }, orderBy: { position: "asc" } },
  } });
  if (!post) throw new ResourceNotFoundError("SOCIAL_POST_NOT_FOUND");
  return { body: post.body, externalUrl: post.externalUrl, visibility: post.visibility, commentPolicy: post.commentPolicy,
    allowReposts: post.allowReposts, fundingProgramId: post.fundingProgramId,
    media: post.media.map((item) => ({ mediaId: item.mediaId, position: item.position, altText: item.altText })) };
}

async function appendRevision(client: Prisma.TransactionClient, input: { organizationId: string; postId: string; revision: number; action: "CREATE" | "UPDATE" | "DELETE"; userId: string }) {
  await client.organizationPostRevision.create({ data: { organizationId: input.organizationId, postId: input.postId, revision: input.revision,
    action: input.action, changedByUserId: input.userId, snapshot: await snapshot(client, input.postId) } });
}

export async function createInstitutionPost(userId: string, organizationId: string, rawInput: unknown) {
  const input = organizationPostSchema.parse(rawInput);
  const post = await db.$transaction(async (client) => {
    await lockNetworkUsers(client, [userId]);
    await lockOrganization(client, organizationId);
    await requirePostManager(client, organizationId, userId);
    await requireProgram(client, organizationId, input.fundingProgramId ?? null, input.visibility);
    await consumeSocialRate(client, userId, "POST");
    const created = await client.socialPost.create({ data: {
      authorOrganizationId: organizationId, createdByUserId: userId,
      body: input.body ?? null, externalUrl: input.externalUrl ?? null, visibility: input.visibility,
      commentPolicy: input.commentPolicy, allowReposts: input.allowReposts, fundingProgramId: input.fundingProgramId ?? null, revision: 1,
    }, select: { id: true, revision: true } });
    if (input.media.length) await attachPostMedia(client, { organizationId }, created.id, input.media);
    await appendRevision(client, { organizationId, postId: created.id, revision: created.revision, action: "CREATE", userId });
    return created;
  });
  const items = await loadPosts({ id: post.id }, userId, { take: 1 });
  return items[0] ?? { id: post.id, revision: post.revision };
}

export async function updateInstitutionPost(userId: string, organizationId: string, postId: string, rawInput: unknown) {
  const input = organizationPostUpdateSchema.parse(rawInput);
  return db.$transaction(async (client) => {
    await lockNetworkUsers(client, [userId]);
    await lockOrganization(client, organizationId);
    await requirePostManager(client, organizationId, userId);
    await client.$queryRaw`SELECT "id" FROM "SocialPost" WHERE "id" = ${postId} AND "authorOrganizationId" = ${organizationId} FOR UPDATE`;
    const post = await client.socialPost.findFirst({ where: { id: postId, authorOrganizationId: organizationId, repostOfPostId: null }, select: { revision: true, deletedAt: true } });
    if (!post) throw new ResourceNotFoundError("SOCIAL_POST_NOT_FOUND");
    if (post.deletedAt) throw new ResourceNotFoundError("SOCIAL_POST_NOT_FOUND");
    if (post.revision !== input.revision) throw new DomainConflictError("INSTITUTION_POST_REVISION_CONFLICT");
    await requireProgram(client, organizationId, input.fundingProgramId ?? null, input.visibility);
    await client.socialPost.update({ where: { id: postId }, data: {
      body: input.body ?? null, externalUrl: input.externalUrl ?? null, visibility: input.visibility,
      commentPolicy: input.commentPolicy, allowReposts: input.allowReposts, fundingProgramId: input.fundingProgramId ?? null,
      revision: { increment: 1 }, editedAt: new Date(),
    } });
    const currentMedia = await client.socialPostMedia.findMany({ where: { postId }, select: { mediaId: true } });
    await lockMedia(client, currentMedia.map((item) => item.mediaId));
    await attachPostMedia(client, { organizationId }, postId, input.media);
    const updated = await client.socialPost.findUniqueOrThrow({ where: { id: postId }, select: { revision: true } });
    await appendRevision(client, { organizationId, postId, revision: updated.revision, action: "UPDATE", userId });
    return { id: postId, revision: updated.revision };
  });
}

export async function deleteInstitutionPost(userId: string, organizationId: string, postId: string) {
  return db.$transaction(async (client) => {
    await lockNetworkUsers(client, [userId]);
    await lockOrganization(client, organizationId);
    await requirePostManager(client, organizationId, userId);
    await client.$queryRaw`SELECT "id" FROM "SocialPost" WHERE "id" = ${postId} AND "authorOrganizationId" = ${organizationId} FOR UPDATE`;
    const post = await client.socialPost.findFirst({ where: { id: postId, authorOrganizationId: organizationId }, select: { revision: true, deletedAt: true } });
    if (!post || post.deletedAt) throw new ResourceNotFoundError("SOCIAL_POST_NOT_FOUND");
    await client.socialPost.update({ where: { id: postId }, data: { deletedAt: new Date(), editedAt: new Date(), revision: { increment: 1 } } });
    const media = await client.socialPostMedia.findMany({ where: { postId }, select: { mediaId: true } });
    await lockMedia(client, media.map((item) => item.mediaId));
    await client.mediaAsset.updateMany({ where: { id: { in: media.map((item) => item.mediaId) }, ownerOrganizationId: organizationId }, data: { status: "DELETED", deletedAt: new Date() } });
    await client.featuredPost.deleteMany({ where: { postId } });
    await appendRevision(client, { organizationId, postId, revision: post.revision + 1, action: "DELETE", userId });
    return { id: postId, revision: post.revision + 1 };
  });
}
