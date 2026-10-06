import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";
import { respondConnectionRequest } from "@/lib/network/connections";
type RouteContext = { params: Promise<{ requestId: string }> };
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { user } = await requireAuthenticatedSession();
    const { requestId } = await context.params;
    const result = await respondConnectionRequest(user.id, requestId, await request.json());
    return NextResponse.json(result ?? { success: true });
  } catch (error) { return errorResponse(error); }
}
