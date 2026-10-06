import { NextResponse } from "next/server";

import { requireOrganizationAccess } from "@/lib/auth/organization-access";
import { errorResponse } from "@/lib/http";
import { updateObservationStatusSchema } from "@/lib/follow-up/schemas";
import { updateObservationStatus } from "@/lib/follow-up/service";

type RouteContext = { params: Promise<{ organizationId: string; observationId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { organizationId, observationId } = await context.params;
    await requireOrganizationAccess(organizationId, "MANAGER");
    const { status, expectedRevision } = updateObservationStatusSchema.parse(await request.json());
    const observation = await updateObservationStatus(organizationId, observationId, status, expectedRevision);
    return NextResponse.json({ observation });
  } catch (error) {
    return errorResponse(error);
  }
}
