import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";
import { listPersonalOpportunities } from "@/lib/selection/service";
export async function GET(request: Request) {
  try { const auth = await requireAuthenticatedSession(); return NextResponse.json({ opportunities: await listPersonalOpportunities(auth.user.id, new URL(request.url).searchParams.get("search") ?? "") }); }
  catch (error) { return errorResponse(error); }
}
