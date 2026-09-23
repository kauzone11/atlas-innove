import { NextResponse } from "next/server";

import { requireOrganizationAccess } from "@/lib/auth/organization-access";
import { errorResponse, isUniqueConstraintError } from "@/lib/http";
import { createFundingProgramSchema } from "@/lib/programs/schemas";
import { createFundingProgram, listOrganizationPrograms } from "@/lib/programs/service";

type RouteContext = { params: Promise<{ organizationId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { organizationId } = await context.params;
    await requireOrganizationAccess(organizationId);
    return NextResponse.json({ programs: await listOrganizationPrograms(organizationId) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { organizationId } = await context.params;
    const access = await requireOrganizationAccess(organizationId, "MANAGER");
    const input = createFundingProgramSchema.parse(await request.json());
    const program = await createFundingProgram(organizationId, access.auth.user.id, input);
    return NextResponse.json({ program }, { status: 201 });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: "Este identificador já está em uso nesta organização." }, { status: 409 });
    }
    return errorResponse(error);
  }
}
