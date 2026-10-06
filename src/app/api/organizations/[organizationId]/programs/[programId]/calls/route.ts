import { NextResponse } from "next/server";

import { requireOrganizationAccess } from "@/lib/auth/organization-access";
import { errorResponse, isUniqueConstraintError } from "@/lib/http";
import { createFundingCallSchema } from "@/lib/funding-calls/schemas";
import { createFundingCall, listProgramFundingCalls } from "@/lib/funding-calls/service";

type RouteContext = { params: Promise<{ organizationId: string; programId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { organizationId, programId } = await context.params;
    await requireOrganizationAccess(organizationId);
    return NextResponse.json({ calls: await listProgramFundingCalls(organizationId, programId) });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { organizationId, programId } = await context.params;
    await requireOrganizationAccess(organizationId, "MANAGER");
    const input = createFundingCallSchema.parse(await request.json());
    return NextResponse.json({ call: await createFundingCall(organizationId, programId, input) }, { status: 201 });
  } catch (error) {
    if (isUniqueConstraintError(error)) return NextResponse.json({ error: "Este número de edital já está em uso nesta organização." }, { status: 409 });
    return errorResponse(error);
  }
}
