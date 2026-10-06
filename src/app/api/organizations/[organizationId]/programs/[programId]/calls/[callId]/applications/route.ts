import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { selectionContext, type SelectionRouteContext } from "@/lib/selection/api-context";
import { listCallApplications } from "@/lib/selection/service";
export async function GET(request: Request, context: SelectionRouteContext) {
  try { const { organizationId, programId, callId, userId } = await selectionContext(context); return NextResponse.json({ applications: await listCallApplications(organizationId, programId, callId, new URL(request.url).searchParams.get("search") ?? "", userId) }); }
  catch (error) { return errorResponse(error); }
}
