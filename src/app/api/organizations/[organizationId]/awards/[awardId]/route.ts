import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { awardContext, type AwardRouteContext } from "@/lib/awards/api-context";
import { getInstitutionAward, updateAward } from "@/lib/awards/service";
export async function GET(_request: Request, context: AwardRouteContext) {
  try {
    const { access, awardId } = await awardContext(context);
    return NextResponse.json({ award: await getInstitutionAward(access, awardId) });
  } catch (error) { return errorResponse(error); }
}
export async function PATCH(request: Request, context: AwardRouteContext) {
  try {
    const { access, awardId } = await awardContext(context, "MANAGER");
    return NextResponse.json({ award: await updateAward(access, awardId, await request.json()) });
  } catch (error) { return errorResponse(error); }
}
