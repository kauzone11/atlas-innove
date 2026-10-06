import { NextResponse } from "next/server";

import { requireOrganizationAccess } from "@/lib/auth/organization-access";
import { errorResponse, isUniqueConstraintError } from "@/lib/http";
import { createMilestoneSchema } from "@/lib/milestones/schemas";
import { createVentureMilestone, listVentureMilestones } from "@/lib/milestones/service";

type RouteContext = { params: Promise<{ organizationId: string; ventureId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { organizationId, ventureId } = await context.params;
    await requireOrganizationAccess(organizationId);
    return NextResponse.json({ milestones: await listVentureMilestones(organizationId, ventureId) });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { organizationId, ventureId } = await context.params;
    await requireOrganizationAccess(organizationId, "MANAGER");
    const input = createMilestoneSchema.parse(await request.json());
    return NextResponse.json({ milestone: await createVentureMilestone(organizationId, ventureId, input) }, { status: 201 });
  } catch (error) {
    if (isUniqueConstraintError(error)) return NextResponse.json({ error: "Já existe um marco com este título e data para o empreendimento." }, { status: 409 });
    return errorResponse(error);
  }
}
