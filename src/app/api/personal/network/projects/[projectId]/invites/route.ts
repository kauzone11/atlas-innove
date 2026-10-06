import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";
import { inviteToProject } from "@/lib/network/invites";
type RouteContext = { params: Promise<{ projectId: string }> };
export async function POST(request: Request, context: RouteContext) {
  try {
    const { user } = await requireAuthenticatedSession();
    const { projectId } = await context.params;
    const result = await inviteToProject(user.id, projectId, await request.json());
    return NextResponse.json(result ?? { success: true }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
