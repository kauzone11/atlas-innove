import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { getPersonalAward } from "@/lib/awards/service";
import { errorResponse } from "@/lib/http";
type Context = { params: Promise<{ awardId: string }> };
export async function GET(_request: Request, context: Context) {
  try {
    const auth = await requireAuthenticatedSession();
    const { awardId } = await context.params;
    return NextResponse.json({ award: await getPersonalAward(auth.user.id, awardId) });
  } catch (error) { return errorResponse(error); }
}
