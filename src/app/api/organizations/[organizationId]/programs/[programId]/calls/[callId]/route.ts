import { NextResponse } from "next/server";

import { requireOrganizationAccess } from "@/lib/auth/organization-access";
import { errorResponse, isUniqueConstraintError } from "@/lib/http";
import { updateFundingCallSchema } from "@/lib/funding-calls/schemas";
import { getFundingCall, updateFundingCall } from "@/lib/funding-calls/service";

type RouteContext = { params: Promise<{ organizationId: string; programId: string; callId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { organizationId, programId, callId } = await context.params;
    await requireOrganizationAccess(organizationId);
    const call = await getFundingCall(organizationId, programId, callId);
    return call ? NextResponse.json({ call }) : NextResponse.json({ error: "Edital não encontrado." }, { status: 404 });
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { organizationId, programId, callId } = await context.params;
    await requireOrganizationAccess(organizationId, "MANAGER");
    const input = updateFundingCallSchema.parse(await request.json());
    return NextResponse.json({ call: await updateFundingCall(organizationId, programId, callId, input) });
  } catch (error) {
    if (isUniqueConstraintError(error)) return NextResponse.json({ error: "Este número de edital já está em uso nesta organização." }, { status: 409 });
    return errorResponse(error);
  }
}
