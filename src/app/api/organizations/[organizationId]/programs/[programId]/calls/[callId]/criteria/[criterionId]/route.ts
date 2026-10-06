import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { selectionContext, type SelectionRouteContext } from "@/lib/selection/api-context";
import { criterionSchema } from "@/lib/selection/schemas";
import { updateCallCriterion, deleteCallCriterion } from "@/lib/selection/service";
export async function PUT(request: Request, context: SelectionRouteContext) {
  try { const { organizationId, programId, callId, criterionId, userId } = await selectionContext(context, "MANAGER"); return NextResponse.json({ criterion: await updateCallCriterion(organizationId, programId, callId, userId, criterionId!, criterionSchema.parse(await request.json())) }); }
  catch (error) { return errorResponse(error); }
}
export async function DELETE(_request: Request, context: SelectionRouteContext) {
  try { const { organizationId, programId, callId, criterionId, userId } = await selectionContext(context, "MANAGER"); await deleteCallCriterion(organizationId, programId, callId, userId, criterionId!); return NextResponse.json({ success: true }); }
  catch (error) { return errorResponse(error); }
}
