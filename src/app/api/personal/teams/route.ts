import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";
import { createTeam, listTeams } from "@/lib/participants/service";

export async function GET() {
  try {
    const auth = await requireAuthenticatedSession();
    return NextResponse.json({ teams: await listTeams(auth.user.id) });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthenticatedSession();
    return NextResponse.json({ team: await createTeam(auth.user.id, await request.json()) }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
