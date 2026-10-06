import { NextResponse } from "next/server";
import { requireOrganizationAccess } from "@/lib/auth/organization-access";
import { mapIndicatorToMetric } from "@/lib/analytics/metrics";
import { metricMappingSchema } from "@/lib/analytics/metric-schemas";
import { errorResponse } from "@/lib/http";
type Context = { params: Promise<{ organizationId: string }> };
export async function POST(request: Request, context: Context) {
  try {
    const { organizationId } = await context.params;
    const access = await requireOrganizationAccess(organizationId, "MANAGER");
    const input = metricMappingSchema.parse(await request.json());
    return NextResponse.json(await mapIndicatorToMetric({ organizationId, userId: access.auth.user.id, role: access.membership.role }, input.indicatorDefinitionId, input.metricDefinitionId));
  } catch (error) { return errorResponse(error); }
}
