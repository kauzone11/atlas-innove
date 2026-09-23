import { NextResponse } from "next/server";

import { requireOrganizationAccess } from "@/lib/auth/organization-access";
import { errorResponse, isUniqueConstraintError } from "@/lib/http";
import { updateFundingProgramSchema } from "@/lib/programs/schemas";
import { getOrganizationProgram, updateFundingProgram } from "@/lib/programs/service";

type RouteContext = { params: Promise<{ organizationId: string; programId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { organizationId, programId } = await context.params;
    await requireOrganizationAccess(organizationId);
    const program = await getOrganizationProgram(organizationId, programId);
    if (!program) return NextResponse.json({ error: "Programa não encontrado." }, { status: 404 });
    return NextResponse.json({ program });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { organizationId, programId } = await context.params;
    await requireOrganizationAccess(organizationId, "MANAGER");
    const input = updateFundingProgramSchema.parse(await request.json());
    const program = await updateFundingProgram(organizationId, programId, input);
    return NextResponse.json({ program });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: "Este identificador já está em uso nesta organização." }, { status: 409 });
    }
    return errorResponse(error);
  }
}
