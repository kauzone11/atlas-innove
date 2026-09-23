import { AuthorizationError } from "@/lib/auth/authorization";

export function assertTenantBoundary(requestedOrganizationId: string, recordOrganizationId: string): void {
  if (!requestedOrganizationId || requestedOrganizationId !== recordOrganizationId) {
    throw new AuthorizationError("TENANT_SCOPE_MISMATCH");
  }
}

export function organizationOwnedWhere(organizationId: string): { organizationId: string } {
  if (!organizationId) {
    throw new AuthorizationError("TENANT_SCOPE_REQUIRED");
  }
  return { organizationId };
}
