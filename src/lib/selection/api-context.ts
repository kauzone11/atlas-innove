import { requireOrganizationAccess } from "@/lib/auth/organization-access";
import type { OrganizationRole } from "@/lib/domain";

export type SelectionRouteContext = { params: Promise<{ organizationId: string; programId: string; callId: string; applicationId?: string; criterionId?: string }> };
export async function selectionContext(context: SelectionRouteContext, minimumRole?: OrganizationRole) {
  const params = await context.params;
  const access = await requireOrganizationAccess(params.organizationId, minimumRole);
  return { ...params, userId: access.auth.user.id, role: access.membership.role };
}
