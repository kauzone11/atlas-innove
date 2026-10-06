import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";
import { getConversation, markConversationRead } from "@/lib/communication/messages";
import { markConversationReadSchema } from "@/lib/communication/schemas";
type Context = { params: Promise<{ conversationId: string }> };
export async function GET(request: Request, { params }: Context) { try { const { user } = await requireAuthenticatedSession(); const { conversationId } = await params; return NextResponse.json(await getConversation(user.id, conversationId, new URL(request.url).searchParams.get("before") ?? undefined)); } catch (error) { return errorResponse(error); } }
export async function PATCH(request: Request, { params }: Context) { try { const { user } = await requireAuthenticatedSession(); const { conversationId } = await params; const { lastMessageId } = markConversationReadSchema.parse(await request.json()); await markConversationRead(user.id, conversationId, lastMessageId); return NextResponse.json({ ok: true }); } catch (error) { return errorResponse(error); } }
