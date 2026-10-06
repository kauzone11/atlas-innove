import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";
import { blockUser, listBlockedUsers, unblockUser } from "@/lib/network/blocks";
export async function GET() {
  try { const { user } = await requireAuthenticatedSession(); return NextResponse.json({ blocked: await listBlockedUsers(user.id) }); }
  catch (error) { return errorResponse(error); }
}
export async function POST(request: Request) {
  try { const { user } = await requireAuthenticatedSession(); await blockUser(user.id, await request.json()); return NextResponse.json({ success: true }); }
  catch (error) { return errorResponse(error); }
}
export async function DELETE(request: Request) {
  try { const { user } = await requireAuthenticatedSession(); await unblockUser(user.id, await request.json()); return NextResponse.json({ success: true }); }
  catch (error) { return errorResponse(error); }
}
