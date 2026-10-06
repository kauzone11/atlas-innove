import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { awardContext, type AwardRouteContext } from "@/lib/awards/api-context";
import { reviewSubmission } from "@/lib/awards/service";
export async function POST(request: Request, context: AwardRouteContext) {
  try {
    const { access, awardId, submissionId } = await awardContext(context, "ANALYST");
    return NextResponse.json({ award: await reviewSubmission(access, awardId, submissionId!, await request.json()) });
  } catch (error) { return errorResponse(error); }
}
