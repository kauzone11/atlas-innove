import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";
import { createProjectDiscussion, listProjectDiscussions } from "@/lib/communication/discussions";
type Context = { params: Promise<{ projectId: string }> };
export async function GET(request: Request, { params }: Context) { try { const { user } = await requireAuthenticatedSession(); const { projectId } = await params; return NextResponse.json(await listProjectDiscussions(user.id, projectId, new URL(request.url).searchParams.get("page") ?? 1)); } catch (error) { return errorResponse(error); } }
export async function POST(request: Request, { params }: Context) { try { const { user } = await requireAuthenticatedSession(); const { projectId } = await params; return NextResponse.json({ discussion: await createProjectDiscussion(user.id, projectId, await request.json()) }, { status: 201 }); } catch (error) { return errorResponse(error); } }
