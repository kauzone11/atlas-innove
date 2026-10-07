import type { Prisma } from "@prisma/client";
import { ResourceNotFoundError } from "@/lib/errors";

export function unblockedUserWhere(viewerUserId?: string | null): Prisma.UserWhereInput {
  return viewerUserId ? {
    blocksInitiated: { none: { blockedUserId: viewerUserId } },
    blocksReceived: { none: { blockerUserId: viewerUserId } },
  } : {};
}

export function connectedUserWhere(viewerUserId: string): Prisma.UserWhereInput {
  return { OR: [
    { connectionsA: { some: { userBId: viewerUserId, endedAt: null } } },
    { connectionsB: { some: { userAId: viewerUserId, endedAt: null } } },
  ] };
}

// Every social read and mutation uses current audience and bilateral blocks; organization roles confer no social access.
export function visiblePostWhere(viewerUserId?: string | null, publicOnly = false, managementOrganizationId?: string): Prisma.SocialPostWhereInput {
  if (!viewerUserId || publicOnly) return {
    deletedAt: null, visibility: "PUBLIC",
    OR: [
      { authorUserId: { not: null }, author: { ...unblockedUserWhere(viewerUserId), innovationProfile: { is: { profileVisibility: "PUBLIC", publishedAt: { not: null } } } } },
      { authorOrganizationId: { not: null }, authorOrganization: { status: "ACTIVE", publicProfile: { is: { publishedAt: { not: null } } } },
        OR: [{ fundingProgramId: null }, { fundingProgram: { publicPageEnabled: true, publishedAt: { not: null }, status: { not: "DRAFT" } } }] },
    ],
  };
  return { deletedAt: null, OR: [
    { authorUserId: { not: null }, author: unblockedUserWhere(viewerUserId), OR: [
      { authorUserId: viewerUserId }, { visibility: { in: ["PUBLIC", "PLATFORM"] } },
      { visibility: "CONNECTIONS", author: connectedUserWhere(viewerUserId) },
    ] },
    { authorOrganizationId: { not: null }, authorOrganization: { status: "ACTIVE" }, OR: [
      { visibility: "PLATFORM" },
      { visibility: "PUBLIC", authorOrganization: { publicProfile: { is: { publishedAt: { not: null } } } },
        OR: [{ fundingProgramId: null }, { fundingProgram: { publicPageEnabled: true, publishedAt: { not: null }, status: { not: "DRAFT" } } }] },
    ] },
    ...(managementOrganizationId ? [{ authorOrganizationId: managementOrganizationId, authorOrganization: { status: "ACTIVE" as const, memberships: { some: { userId: viewerUserId, status: "ACTIVE" as const } } } }] : []),
  ] };
}

export async function requireVisiblePost(client: Prisma.TransactionClient, id: string, viewerUserId: string) {
  const post = await client.socialPost.findFirst({ where: { AND: [{ id }, visiblePostWhere(viewerUserId)] } });
  if (!post) throw new ResourceNotFoundError("SOCIAL_POST_NOT_FOUND");
  return post;
}
