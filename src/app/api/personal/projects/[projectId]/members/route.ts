import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";
import { addProjectMember, getProject } from "@/lib/participants/service";

type RouteContext = { params: Promise<{ projectId: string }> };
export async function POST(request: Request, context: RouteContext) {
  try {
    const auth = await requireAuthenticatedSession();
    const { projectId } = await context.params;
    await addProjectMember(auth.user.id, projectId, await request.json());
    return NextResponse.json({ project: await getProject(auth.user.id, projectId) }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
