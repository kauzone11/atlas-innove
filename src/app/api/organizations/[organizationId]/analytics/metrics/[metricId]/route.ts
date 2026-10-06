import { NextResponse } from "next/server";
import { requireOrganizationAccess } from "@/lib/auth/organization-access";
import { archiveMetric, updateMetric } from "@/lib/analytics/metrics";
import { metricDefinitionSchema } from "@/lib/analytics/metric-schemas";
import { errorResponse } from "@/lib/http";
type Context = { params: Promise<{ organizationId: string; metricId: string }> };
export async function PATCH(request: Request, context: Context) {
  try {
    const { organizationId, metricId } = await context.params;
    const access = await requireOrganizationAccess(organizationId, "MANAGER");
    return NextResponse.json(await updateMetric({ organizationId, userId: access.auth.user.id, role: access.membership.role }, metricId, metricDefinitionSchema.parse(await request.json())));
  } catch (error) { return errorResponse(error); }
}
export async function DELETE(_request: Request, context: Context) {
  try {
    const { organizationId, metricId } = await context.params;
    const access = await requireOrganizationAccess(organizationId, "MANAGER");
    return NextResponse.json(await archiveMetric({ organizationId, userId: access.auth.user.id, role: access.membership.role }, metricId));
  } catch (error) { return errorResponse(error); }
}
