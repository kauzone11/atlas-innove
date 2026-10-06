import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { selectionContext, type SelectionRouteContext } from "@/lib/selection/api-context";
import { decisionSchema } from "@/lib/selection/schemas";
import { decideCallApplications } from "@/lib/selection/service";
export async function POST(request: Request, context: SelectionRouteContext) {
  try { const { organizationId, programId, callId, userId } = await selectionContext(context, "MANAGER"); return NextResponse.json({ applications: await decideCallApplications(organizationId, programId, callId, userId, decisionSchema.parse(await request.json())) }); }
  catch (error) { return errorResponse(error); }
}
