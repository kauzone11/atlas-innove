import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { submitSubmission } from "@/lib/awards/service";
import { errorResponse } from "@/lib/http";
type Context = { params: Promise<{ awardId: string; submissionId: string }> };
export async function POST(request: Request, context: Context) {
  try {
    const auth = await requireAuthenticatedSession();
    const { awardId, submissionId } = await context.params;
    return NextResponse.json({ submission: await submitSubmission(auth.user.id, awardId, submissionId, await request.json()) });
  } catch (error) { return errorResponse(error); }
}
