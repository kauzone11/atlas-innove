import { NextResponse } from "next/server";

import { requireOrganizationAccess } from "@/lib/auth/organization-access";
import { errorResponse, isUniqueConstraintError } from "@/lib/http";
import { createFollowUpWaveSchema } from "@/lib/follow-up/schemas";
import { createFollowUpWave, listCohortFollowUpWaves } from "@/lib/follow-up/service";

type RouteContext = { params: Promise<{ organizationId: string; cohortId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { organizationId, cohortId } = await context.params;
    await requireOrganizationAccess(organizationId);
    return NextResponse.json({ waves: await listCohortFollowUpWaves(organizationId, cohortId) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { organizationId, cohortId } = await context.params;
    await requireOrganizationAccess(organizationId, "MANAGER");
    const input = createFollowUpWaveSchema.parse(await request.json());
    const wave = await createFollowUpWave(organizationId, cohortId, input);
    return NextResponse.json({ wave }, { status: 201 });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: "Esta sequência já está em uso nesta coorte." }, { status: 409 });
    }
    return errorResponse(error);
  }
}
