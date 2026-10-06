import { NextResponse } from "next/server";
import { requireOrganizationAccess } from "@/lib/auth/organization-access";
import { createMetric, listMetrics } from "@/lib/analytics/metrics";
import { metricDefinitionSchema } from "@/lib/analytics/metric-schemas";
import { errorResponse } from "@/lib/http";

type Context = { params: Promise<{ organizationId: string }> };
export async function GET(_request: Request, context: Context) {
  try {
    const { organizationId } = await context.params;
    const access = await requireOrganizationAccess(organizationId, "ANALYST");
    return NextResponse.json(await listMetrics({ organizationId, userId: access.auth.user.id, role: access.membership.role }));
  } catch (error) { return errorResponse(error); }
}
export async function POST(request: Request, context: Context) {
  try {
    const { organizationId } = await context.params;
    const access = await requireOrganizationAccess(organizationId, "MANAGER");
    const input = metricDefinitionSchema.parse(await request.json());
    return NextResponse.json(await createMetric({ organizationId, userId: access.auth.user.id, role: access.membership.role }, input), { status: 201 });
  } catch (error) { return errorResponse(error); }
}
