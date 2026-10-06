import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";
import { replyProjectDiscussion } from "@/lib/communication/discussions";
type Context = { params: Promise<{ projectId: string; discussionId: string }> };
export async function POST(request: Request, { params }: Context) { try { const { user } = await requireAuthenticatedSession(); const { projectId, discussionId } = await params; return NextResponse.json(await replyProjectDiscussion(user.id, projectId, discussionId, await request.json()), { status: 201 }); } catch (error) { return errorResponse(error); } }
