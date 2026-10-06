import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { selectionContext, type SelectionRouteContext } from "@/lib/selection/api-context";
import { criterionSchema } from "@/lib/selection/schemas";
import { createCallCriterion, listCallCriteria } from "@/lib/selection/service";
export async function GET(_request: Request, context: SelectionRouteContext) {
  try { const { organizationId, programId, callId } = await selectionContext(context); return NextResponse.json({ criteria: await listCallCriteria(organizationId, programId, callId) }); }
  catch (error) { return errorResponse(error); }
}
export async function POST(request: Request, context: SelectionRouteContext) {
  try { const { organizationId, programId, callId, userId } = await selectionContext(context, "MANAGER"); return NextResponse.json({ criterion: await createCallCriterion(organizationId, programId, callId, userId, criterionSchema.parse(await request.json())) }, { status: 201 }); }
  catch (error) { return errorResponse(error); }
}
