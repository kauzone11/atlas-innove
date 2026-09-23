import { NextResponse } from "next/server";

import { requireOrganizationAccess } from "@/lib/auth/organization-access";
import { errorResponse, isUniqueConstraintError } from "@/lib/http";
import { createCohortSchema } from "@/lib/cohorts/schemas";
import { createCohort, listProgramCohorts } from "@/lib/cohorts/service";

type RouteContext = { params: Promise<{ organizationId: string; programId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { organizationId, programId } = await context.params;
    await requireOrganizationAccess(organizationId);
    return NextResponse.json({ cohorts: await listProgramCohorts(organizationId, programId) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { organizationId, programId } = await context.params;
    await requireOrganizationAccess(organizationId, "MANAGER");
    const input = createCohortSchema.parse(await request.json());
    const cohort = await createCohort(organizationId, programId, input);
    return NextResponse.json({ cohort }, { status: 201 });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: "Este código já está em uso neste programa." }, { status: 409 });
    }
    return errorResponse(error);
  }
}
