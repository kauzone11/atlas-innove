import { NextResponse } from "next/server";

import { requireOrganizationAccess } from "@/lib/auth/organization-access";
import { errorResponse, isUniqueConstraintError } from "@/lib/http";
import { createFundingCallDocumentSchema } from "@/lib/funding-calls/schemas";
import { addFundingCallDocument } from "@/lib/funding-calls/service";

type RouteContext = { params: Promise<{ organizationId: string; programId: string; callId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { organizationId, programId, callId } = await context.params;
    await requireOrganizationAccess(organizationId, "MANAGER");
    const input = createFundingCallDocumentSchema.parse(await request.json());
    return NextResponse.json({ call: await addFundingCallDocument(organizationId, programId, callId, input) }, { status: 201 });
  } catch (error) {
    if (isUniqueConstraintError(error)) return NextResponse.json({ error: "Já existe um documento com este título no edital." }, { status: 409 });
    return errorResponse(error);
  }
}
