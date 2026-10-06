import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { awardContext, type AwardRouteContext } from "@/lib/awards/api-context";
import { updateDisbursement } from "@/lib/awards/service";
export async function PATCH(request: Request, context: AwardRouteContext) {
  try {
    const { access, awardId, disbursementId } = await awardContext(context, "MANAGER");
    return NextResponse.json({ award: await updateDisbursement(access, awardId, disbursementId!, await request.json()) });
  } catch (error) { return errorResponse(error); }
}
