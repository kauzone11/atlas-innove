import { NextResponse } from "next/server";

import { requireOrganizationAccess } from "@/lib/auth/organization-access";
import { errorResponse, isUniqueConstraintError } from "@/lib/http";
import { updateCohortSchema } from "@/lib/cohorts/schemas";
import { getOrganizationCohort, updateCohort } from "@/lib/cohorts/service";

type RouteContext = { params: Promise<{ organizationId: string; cohortId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { organizationId, cohortId } = await context.params;
    await requireOrganizationAccess(organizationId);
    const cohort = await getOrganizationCohort(organizationId, cohortId);
    if (!cohort) return NextResponse.json({ error: "Coorte não encontrada." }, { status: 404 });
    return NextResponse.json({ cohort });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { organizationId, cohortId } = await context.params;
    await requireOrganizationAccess(organizationId, "MANAGER");
    const input = updateCohortSchema.parse(await request.json());
    const cohort = await updateCohort(organizationId, cohortId, input);
    return NextResponse.json({ cohort });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: "Este código já está em uso neste programa." }, { status: 409 });
    }
    return errorResponse(error);
  }
}
