import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";
import { getTeam, updateTeamMember } from "@/lib/participants/service";

type RouteContext = { params: Promise<{ teamId: string; membershipId: string }> };
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const auth = await requireAuthenticatedSession();
    const { teamId, membershipId } = await context.params;
    await updateTeamMember(auth.user.id, teamId, membershipId, await request.json());
    return NextResponse.json({ team: await getTeam(auth.user.id, teamId) });
  } catch (error) { return errorResponse(error); }
}
