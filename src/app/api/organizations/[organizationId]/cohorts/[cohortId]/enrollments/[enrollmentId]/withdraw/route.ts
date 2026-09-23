import { NextResponse } from "next/server";

import { requireOrganizationAccess } from "@/lib/auth/organization-access";
import { errorResponse } from "@/lib/http";
import { withdrawEnrollment } from "@/lib/ventures/service";

type RouteContext = { params: Promise<{ organizationId: string; cohortId: string; enrollmentId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { organizationId, cohortId, enrollmentId } = await context.params;
    await requireOrganizationAccess(organizationId, "MANAGER");
    const enrollment = await withdrawEnrollment(organizationId, cohortId, enrollmentId);
    return NextResponse.json({ enrollment });
  } catch (error) {
    return errorResponse(error);
  }
}
