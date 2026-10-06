import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";
import { getOwnProfile, updateProfile } from "@/lib/profiles/service";

export async function GET() {
  try { const { user } = await requireAuthenticatedSession(); return NextResponse.json({ profile: await getOwnProfile(user.id) }); }
  catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request) {
  try { const { user } = await requireAuthenticatedSession(); await updateProfile(user.id, await request.json()); return NextResponse.json({ saved: true }); }
  catch (error) { return errorResponse(error); }
}
