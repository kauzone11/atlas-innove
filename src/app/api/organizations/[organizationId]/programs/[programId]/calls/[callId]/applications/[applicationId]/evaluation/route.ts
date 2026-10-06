import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { selectionContext, type SelectionRouteContext } from "@/lib/selection/api-context";
import { evaluationSchema } from "@/lib/selection/schemas";
import { saveApplicationEvaluation } from "@/lib/selection/service";
export async function POST(request: Request, context: SelectionRouteContext) {
  try { const { organizationId, programId, callId, applicationId, userId } = await selectionContext(context, "ANALYST"); return NextResponse.json({ evaluation: await saveApplicationEvaluation(organizationId, programId, callId, applicationId!, userId, evaluationSchema.parse(await request.json())) }); }
  catch (error) { return errorResponse(error); }
}
