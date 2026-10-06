import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";
import { updateDiscussionSubscription } from "@/lib/communication/discussions";
type Context = { params: Promise<{ projectId: string; discussionId: string }> };
export async function PATCH(request: Request, { params }: Context) { try { const { user } = await requireAuthenticatedSession(); const { projectId, discussionId } = await params; await updateDiscussionSubscription(user.id, projectId, discussionId, await request.json()); return NextResponse.json({ ok: true }); } catch (error) { return errorResponse(error); } }
