import type { MembershipStatus, OrganizationRole, OrganizationStatus } from "@/lib/domain";

export class AuthorizationError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "AuthorizationError";
  }
}

const ROLE_RANK: Record<OrganizationRole, number> = {
  OWNER: 50,
  ADMIN: 40,
  MANAGER: 30,
  ANALYST: 20,
  VIEWER: 10,
};

export function roleRank(role: OrganizationRole): number {
  return ROLE_RANK[role];
}

export function hasAtLeastRole(actual: OrganizationRole, required: OrganizationRole): boolean {
  return roleRank(actual) >= roleRank(required);
}

export function assertActiveOrganizationAccess(input: {
  organizationStatus: OrganizationStatus;
  membershipStatus: MembershipStatus;
  role: OrganizationRole;
  minimumRole?: OrganizationRole;
}): void {
  if (input.organizationStatus !== "ACTIVE") {
    throw new AuthorizationError("ORGANIZATION_INACTIVE");
  }
  if (input.membershipStatus !== "ACTIVE") {
    throw new AuthorizationError("MEMBERSHIP_DISABLED");
  }
  if (input.minimumRole && !hasAtLeastRole(input.role, input.minimumRole)) {
    throw new AuthorizationError("ROLE_FORBIDDEN");
  }
}

export function canManageMembership(
  actorRole: OrganizationRole,
  currentRole: OrganizationRole,
  nextRole: OrganizationRole,
): boolean {
  if (actorRole === "OWNER") {
    return true;
  }
  if (actorRole !== "ADMIN") {
    return false;
  }
  return currentRole !== "OWNER" && nextRole !== "OWNER" && roleRank(nextRole) <= roleRank(actorRole);
}

export function assertCanManageMembership(
  actorRole: OrganizationRole,
  currentRole: OrganizationRole,
  nextRole: OrganizationRole,
): void {
  if (!canManageMembership(actorRole, currentRole, nextRole)) {
    throw new AuthorizationError("ROLE_ESCALATION_REJECTED");
  }
}
