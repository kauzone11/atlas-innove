import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { selectionContext, type SelectionRouteContext } from "@/lib/selection/api-context";
import { enrollApplicationsSchema } from "@/lib/selection/schemas";
import { enrollCallApplications, getCallEnrollmentPreview } from "@/lib/selection/service";
export async function GET(request: Request, context: SelectionRouteContext) {
  try { const { organizationId, programId, callId } = await selectionContext(context, "MANAGER"); const params = new URL(request.url).searchParams; const input = enrollApplicationsSchema.parse({ cohortId: params.get("cohortId"), applicationIds: (params.get("applicationIds") ?? "").split(",").filter(Boolean) }); return NextResponse.json({ preview: await getCallEnrollmentPreview(organizationId, programId, callId, input.cohortId, input.applicationIds) }); }
  catch (error) { return errorResponse(error); }
}
export async function POST(request: Request, context: SelectionRouteContext) {
  try { const { organizationId, programId, callId, userId } = await selectionContext(context, "MANAGER"); const input = enrollApplicationsSchema.parse(await request.json()); return NextResponse.json(await enrollCallApplications(organizationId, programId, callId, userId, input.cohortId, input.applicationIds, input.mappings)); }
  catch (error) { return errorResponse(error); }
}
