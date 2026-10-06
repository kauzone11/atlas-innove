import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { saveSubmissionDraft } from "@/lib/awards/service";
import { errorResponse } from "@/lib/http";
type Context = { params: Promise<{ awardId: string; obligationId: string }> };
export async function PUT(request: Request, context: Context) {
  try {
    const auth = await requireAuthenticatedSession();
    const { awardId, obligationId } = await context.params;
    return NextResponse.json({ submission: await saveSubmissionDraft(auth.user.id, awardId, obligationId, await request.json()) });
  } catch (error) { return errorResponse(error); }
}
