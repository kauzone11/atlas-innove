import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";
import { sendDirectMessage } from "@/lib/communication/messages";
type Context = { params: Promise<{ conversationId: string }> };
export async function POST(request: Request, { params }: Context) { try { const { user } = await requireAuthenticatedSession(); const { conversationId } = await params; return NextResponse.json({ message: await sendDirectMessage(user.id, conversationId, await request.json()) }, { status: 201 }); } catch (error) { return errorResponse(error); } }
