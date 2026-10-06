import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";
import { sendConnectionRequest } from "@/lib/network/connections";

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedSession();

    const result = await sendConnectionRequest(user.id, await request.json());
    return NextResponse.json(result ?? { success: true }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
