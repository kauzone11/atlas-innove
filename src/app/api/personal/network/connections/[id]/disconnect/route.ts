import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";
import { disconnectConnection } from "@/lib/network/connections";

type RouteContext = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: RouteContext) {
  try {
    const { user } = await requireAuthenticatedSession();
    const { id } = await context.params;
    const result = await disconnectConnection(user.id, id);
    return NextResponse.json(result ?? { success: true });
  } catch (error) { return errorResponse(error); }
}
