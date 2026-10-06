import type { Prisma } from "@prisma/client";
import { assertActiveOrganizationAccess, AuthorizationError } from "@/lib/auth/authorization";
import { db } from "@/lib/db";

export async function assertImportAccess(userId: string, organizationId: string, client: Prisma.TransactionClient = db, exclusive = false) {
  // These locks coordinate consequential writes with membership revocation and organization suspension.
  if (client !== db) {
    if (exclusive) await client.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${organizationId} FOR NO KEY UPDATE`;
    else await client.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${organizationId} FOR SHARE`;
    await client.$queryRaw`SELECT "id" FROM "OrganizationMembership" WHERE "organizationId" = ${organizationId} AND "userId" = ${userId} FOR SHARE`;
  }
  const membership = await client.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { status: true, role: true, organization: { select: { status: true } } },
  });
  if (!membership) throw new AuthorizationError("ORGANIZATION_ACCESS_DENIED");
  assertActiveOrganizationAccess({ organizationStatus: membership.organization.status, membershipStatus: membership.status, role: membership.role, minimumRole: "MANAGER" });
  return membership;
}
