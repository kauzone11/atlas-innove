import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";
import { revokeTeamInvite } from "@/lib/participants/service";

type RouteContext = { params: Promise<{ teamId: string; inviteId: string }> };
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const auth = await requireAuthenticatedSession();
    const { teamId, inviteId } = await context.params;
    await revokeTeamInvite(auth.user.id, teamId, inviteId);
    return NextResponse.json({ success: true });
  } catch (error) { return errorResponse(error); }
}
