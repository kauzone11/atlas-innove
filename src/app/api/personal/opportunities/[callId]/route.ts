import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";
import { getPersonalOpportunity } from "@/lib/selection/service";
export async function GET(_request: Request, context: { params: Promise<{ callId: string }> }) {
  try { const auth = await requireAuthenticatedSession(); const { callId } = await context.params; const opportunity = await getPersonalOpportunity(auth.user.id, callId); return opportunity ? NextResponse.json({ opportunity }) : NextResponse.json({ error: "Edital não encontrado." }, { status: 404 }); }
  catch (error) { return errorResponse(error); }
}
