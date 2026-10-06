import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";
import { respondProjectRequest } from "@/lib/network/requests";
type RouteContext = { params: Promise<{ projectId: string; requestId: string }> };
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { user } = await requireAuthenticatedSession();
    const { projectId, requestId } = await context.params;
    const result = await respondProjectRequest(user.id, projectId, requestId, await request.json());
    return NextResponse.json(result ?? { success: true });
  } catch (error) { return errorResponse(error); }
}
