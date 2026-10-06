import type { Prisma } from "@prisma/client";
import { assertActiveOrganizationAccess, AuthorizationError } from "@/lib/auth/authorization";
import type { OrganizationRole } from "@/lib/domain";
import { db } from "@/lib/db";

export type AnalyticsAccess = { organizationId: string; userId: string; role: OrganizationRole };

export async function assertAnalyticsAccess(access: AnalyticsAccess, minimumRole?: OrganizationRole, client: Prisma.TransactionClient = db) {
  // Transactional reads hold membership and organization locks through mutations and snapshot generation.
  if (client !== db) {
    await client.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${access.organizationId} FOR SHARE`;
    await client.$queryRaw`SELECT "id" FROM "OrganizationMembership" WHERE "organizationId" = ${access.organizationId} AND "userId" = ${access.userId} FOR SHARE`;
  }
  const membership = await client.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId: access.organizationId, userId: access.userId } },
    select: { status: true, role: true, organization: { select: { status: true } } },
  });
  if (!membership) throw new AuthorizationError("ORGANIZATION_ACCESS_DENIED");
  assertActiveOrganizationAccess({ organizationStatus: membership.organization.status, membershipStatus: membership.status, role: membership.role, minimumRole });
  return { organizationId: access.organizationId, userId: access.userId, role: membership.role };
}
