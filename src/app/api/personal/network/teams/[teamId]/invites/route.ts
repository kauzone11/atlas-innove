import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";
import { inviteKnownUserToTeam } from "@/lib/network/invites";
type RouteContext = { params: Promise<{ teamId: string }> };
export async function POST(request: Request, context: RouteContext) {
  try {
    const { user } = await requireAuthenticatedSession();
    const { teamId } = await context.params;
    const result = await inviteKnownUserToTeam(user.id, teamId, await request.json());
    return NextResponse.json(result ?? { success: true }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
