import { NextResponse } from "next/server";

import { requireOrganizationAccess } from "@/lib/auth/organization-access";
import { errorResponse } from "@/lib/http";
import { updateFollowUpWaveStatusSchema } from "@/lib/follow-up/schemas";
import { updateFollowUpWaveStatus } from "@/lib/follow-up/service";

type RouteContext = { params: Promise<{ organizationId: string; cohortId: string; waveId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { organizationId, cohortId, waveId } = await context.params;
    await requireOrganizationAccess(organizationId, "MANAGER");
    const { status } = updateFollowUpWaveStatusSchema.parse(await request.json());
    const wave = await updateFollowUpWaveStatus(organizationId, cohortId, waveId, status);
    return NextResponse.json({ wave });
  } catch (error) {
    return errorResponse(error);
  }
}
