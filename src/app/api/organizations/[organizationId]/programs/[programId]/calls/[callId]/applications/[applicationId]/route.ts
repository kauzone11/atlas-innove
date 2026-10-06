import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { selectionContext, type SelectionRouteContext } from "@/lib/selection/api-context";
import { getCallApplication } from "@/lib/selection/service";
export async function GET(_request: Request, context: SelectionRouteContext) {
  try { const { organizationId, programId, callId, applicationId, userId } = await selectionContext(context); const application = await getCallApplication(organizationId, programId, callId, applicationId!, userId); return application ? NextResponse.json({ application }) : NextResponse.json({ error: "Candidatura não encontrada." }, { status: 404 }); }
  catch (error) { return errorResponse(error); }
}
