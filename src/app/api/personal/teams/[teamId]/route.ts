import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { ResourceNotFoundError } from "@/lib/errors";
import { errorResponse } from "@/lib/http";
import { getTeam, updateTeam } from "@/lib/participants/service";

type RouteContext = { params: Promise<{ teamId: string }> };
export async function GET(_request: Request, context: RouteContext) {
  try {
    const auth = await requireAuthenticatedSession();
    const { teamId } = await context.params;
    const team = await getTeam(auth.user.id, teamId);
    if (!team) throw new ResourceNotFoundError("TEAM_NOT_FOUND");
    return NextResponse.json({ team });
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const auth = await requireAuthenticatedSession();
    const { teamId } = await context.params;
    return NextResponse.json({ team: await updateTeam(auth.user.id, teamId, await request.json()) });
  } catch (error) { return errorResponse(error); }
}
