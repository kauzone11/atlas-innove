import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { selectionContext, type SelectionRouteContext } from "@/lib/selection/api-context";
import { reorderCriteriaSchema } from "@/lib/selection/schemas";
import { reorderCallCriteria } from "@/lib/selection/service";
export async function POST(request: Request, context: SelectionRouteContext) {
  try { const { organizationId, programId, callId, userId } = await selectionContext(context, "MANAGER"); return NextResponse.json({ criteria: await reorderCallCriteria(organizationId, programId, callId, userId, reorderCriteriaSchema.parse(await request.json()).criterionIds) }); }
  catch (error) { return errorResponse(error); }
}
