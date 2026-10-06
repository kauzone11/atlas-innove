import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { selectionContext, type SelectionRouteContext } from "@/lib/selection/api-context";
import { publishCallResults } from "@/lib/selection/service";
export async function POST(_request: Request, context: SelectionRouteContext) {
  try { const { organizationId, programId, callId, userId } = await selectionContext(context, "MANAGER"); return NextResponse.json(await publishCallResults(organizationId, programId, callId, userId)); }
  catch (error) { return errorResponse(error); }
}
