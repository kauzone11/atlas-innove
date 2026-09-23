import { AuthorizationError } from "@/lib/auth/authorization";

export function assertSameOrganization(...organizationIds: string[]): void {
  if (!organizationIds.length || organizationIds.some((id) => !id || id !== organizationIds[0])) {
    throw new AuthorizationError("TENANT_SCOPE_MISMATCH");
  }
}

export function assertEnrollmentIsUnique(existingEnrollmentId: string | null): void {
  if (existingEnrollmentId) {
    throw new AuthorizationError("VENTURE_ALREADY_ENROLLED");
  }
}
