import { NextResponse } from "next/server";
import { requireOrganizationAccess } from "@/lib/auth/organization-access";
import { errorResponse } from "@/lib/http";
import { createAward, listCallExecution } from "@/lib/awards/service";
type Context = { params: Promise<{ organizationId: string; programId: string; callId: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const { organizationId, programId, callId } = await context.params;
    const access = await requireOrganizationAccess(organizationId);
    return NextResponse.json({ execution: await listCallExecution(access, programId, callId, Number(new URL(request.url).searchParams.get("page") ?? 1)) });
  } catch (error) { return errorResponse(error); }
}
export async function POST(request: Request, context: Context) {
  try {
    const { organizationId, programId, callId } = await context.params;
    const access = await requireOrganizationAccess(organizationId, "MANAGER");
    return NextResponse.json({ award: await createAward(access, programId, callId, await request.json()) }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
