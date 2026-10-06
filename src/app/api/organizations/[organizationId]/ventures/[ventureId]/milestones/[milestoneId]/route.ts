import { NextResponse } from "next/server";

import { requireOrganizationAccess } from "@/lib/auth/organization-access";
import { errorResponse, isUniqueConstraintError } from "@/lib/http";
import { updateMilestoneSchema } from "@/lib/milestones/schemas";
import { updateVentureMilestone } from "@/lib/milestones/service";

type RouteContext = { params: Promise<{ organizationId: string; ventureId: string; milestoneId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { organizationId, ventureId, milestoneId } = await context.params;
    await requireOrganizationAccess(organizationId, "MANAGER");
    const input = updateMilestoneSchema.parse(await request.json());
    return NextResponse.json({ milestone: await updateVentureMilestone(organizationId, ventureId, milestoneId, input) });
  } catch (error) {
    if (isUniqueConstraintError(error)) return NextResponse.json({ error: "Já existe um marco com este título e data para o empreendimento." }, { status: 409 });
    return errorResponse(error);
  }
}
