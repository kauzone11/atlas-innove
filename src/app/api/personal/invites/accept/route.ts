import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";
import { acceptTeamInvite } from "@/lib/participants/service";

export async function POST(request: Request) {
  try {
    const auth = await requireAuthenticatedSession();
    return NextResponse.json({ team: await acceptTeamInvite(auth.user.id, await request.json()) });
  } catch (error) { return errorResponse(error); }
}
