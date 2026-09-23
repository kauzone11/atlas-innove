import { assertActiveOrganizationAccess, AuthorizationError } from "@/lib/auth/authorization";
import type { OrganizationRole } from "@/lib/domain";
import { requireAuthenticatedSession } from "@/lib/auth/session";

export async function requireOrganizationAccess(
  organizationId: string,
  minimumRole?: OrganizationRole,
) {
  const auth = await requireAuthenticatedSession();
  const membership = auth.memberships.find((candidate) => candidate.organizationId === organizationId);
  if (!membership) {
    throw new AuthorizationError("ORGANIZATION_ACCESS_DENIED");
  }
  assertActiveOrganizationAccess({
    organizationStatus: membership.organization.status,
    membershipStatus: membership.status,
    role: membership.role,
    minimumRole,
  });
  return { auth, membership, organization: membership.organization };
}
