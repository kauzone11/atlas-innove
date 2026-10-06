import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { awardContext, type AwardRouteContext } from "@/lib/awards/api-context";
import { createDisbursement } from "@/lib/awards/service";
export async function POST(request: Request, context: AwardRouteContext) {
  try {
    const { access, awardId } = await awardContext(context, "MANAGER");
    return NextResponse.json({ award: await createDisbursement(access, awardId, await request.json()) });
  } catch (error) { return errorResponse(error); }
}
