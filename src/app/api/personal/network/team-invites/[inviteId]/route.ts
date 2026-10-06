import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";
import { respondTargetedTeamInvite } from "@/lib/network/invites";
type RouteContext = { params: Promise<{ inviteId: string }> };
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { user } = await requireAuthenticatedSession();
    const { inviteId } = await context.params;
    const result = await respondTargetedTeamInvite(user.id, inviteId, await request.json());
    return NextResponse.json(result ?? { success: true });
  } catch (error) { return errorResponse(error); }
}
