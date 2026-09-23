import { NextResponse } from "next/server";

import { requireOrganizationAccess } from "@/lib/auth/organization-access";
import { errorResponse } from "@/lib/http";
import { listCohortVentures } from "@/lib/ventures/service";

type RouteContext = { params: Promise<{ organizationId: string; cohortId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { organizationId, cohortId } = await context.params;
    await requireOrganizationAccess(organizationId);
    return NextResponse.json({ ventures: await listCohortVentures(organizationId, cohortId) });
  } catch (error) {
    return errorResponse(error);
  }
}
