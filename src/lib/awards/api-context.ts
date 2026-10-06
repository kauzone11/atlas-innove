import { requireOrganizationAccess } from "@/lib/auth/organization-access";
import type { OrganizationRole } from "@/lib/domain";
export type AwardRouteContext = { params: Promise<{ organizationId: string; awardId: string; obligationId?: string; submissionId?: string; disbursementId?: string }> };
export async function awardContext(context: AwardRouteContext, minimumRole?: OrganizationRole) {
  const params = await context.params;
  const access = await requireOrganizationAccess(params.organizationId, minimumRole);
  return { ...params, access };
}
