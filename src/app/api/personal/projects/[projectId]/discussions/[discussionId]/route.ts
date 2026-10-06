import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";
import { getProjectDiscussion, updateDiscussionStatus } from "@/lib/communication/discussions";
type Context = { params: Promise<{ projectId: string; discussionId: string }> };
export async function GET(request: Request, { params }: Context) { try { const { user } = await requireAuthenticatedSession(); const { projectId, discussionId } = await params; return NextResponse.json(await getProjectDiscussion(user.id, projectId, discussionId, new URL(request.url).searchParams.get("before") ?? undefined)); } catch (error) { return errorResponse(error); } }
export async function PATCH(request: Request, { params }: Context) { try { const { user } = await requireAuthenticatedSession(); const { projectId, discussionId } = await params; return NextResponse.json({ discussion: await updateDiscussionStatus(user.id, projectId, discussionId, await request.json()) }); } catch (error) { return errorResponse(error); } }
