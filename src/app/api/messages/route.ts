import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";
import { listConversations, startConversation } from "@/lib/communication/messages";
export async function GET(request: Request) { try { const { user } = await requireAuthenticatedSession(); return NextResponse.json(await listConversations(user.id, new URL(request.url).searchParams.get("page") ?? 1)); } catch (error) { return errorResponse(error); } }
export async function POST(request: Request) { try { const { user } = await requireAuthenticatedSession(); return NextResponse.json({ conversationId: await startConversation(user.id, await request.json()) }, { status: 201 }); } catch (error) { return errorResponse(error); } }
