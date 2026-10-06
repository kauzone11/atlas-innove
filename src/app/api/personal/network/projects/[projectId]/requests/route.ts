import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";
import { sendProjectRequest } from "@/lib/network/requests";
type RouteContext = { params: Promise<{ projectId: string }> };
export async function POST(request: Request, context: RouteContext) {
  try {
    const { user } = await requireAuthenticatedSession();
    const { projectId } = await context.params;
    const result = await sendProjectRequest(user.id, projectId, await request.json());
    return NextResponse.json(result ?? { success: true }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
