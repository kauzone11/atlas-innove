import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";
import { inviteToTeam } from "@/lib/participants/service";

type RouteContext = { params: Promise<{ teamId: string }> };
export async function POST(request: Request, context: RouteContext) {
  try {
    const auth = await requireAuthenticatedSession();
    const { teamId } = await context.params;
    const invite = await inviteToTeam(auth.user.id, teamId, await request.json());
    return NextResponse.json(invite, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
