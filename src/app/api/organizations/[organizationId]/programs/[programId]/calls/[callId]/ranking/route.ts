import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { selectionContext, type SelectionRouteContext } from "@/lib/selection/api-context";
import { getCallRanking } from "@/lib/selection/service";
export async function GET(_request: Request, context: SelectionRouteContext) {
  try { const { organizationId, programId, callId, userId } = await selectionContext(context); return NextResponse.json({ ranking: await getCallRanking(organizationId, programId, callId, userId) }); }
  catch (error) { return errorResponse(error); }
}
