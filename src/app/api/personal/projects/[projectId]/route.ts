import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { ResourceNotFoundError } from "@/lib/errors";
import { errorResponse } from "@/lib/http";
import { getProject, updateProject } from "@/lib/participants/service";

type RouteContext = { params: Promise<{ projectId: string }> };
export async function GET(_request: Request, context: RouteContext) {
  try {
    const auth = await requireAuthenticatedSession();
    const { projectId } = await context.params;
    const project = await getProject(auth.user.id, projectId);
    if (!project) throw new ResourceNotFoundError("PROJECT_NOT_FOUND");
    return NextResponse.json({ project });
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const auth = await requireAuthenticatedSession();
    const { projectId } = await context.params;
    return NextResponse.json({ project: await updateProject(auth.user.id, projectId, await request.json()) });
  } catch (error) { return errorResponse(error); }
}
