import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";
import { getProject, updateProjectMember } from "@/lib/participants/service";

type RouteContext = { params: Promise<{ projectId: string; membershipId: string }> };
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const auth = await requireAuthenticatedSession();
    const { projectId, membershipId } = await context.params;
    await updateProjectMember(auth.user.id, projectId, membershipId, await request.json());
    return NextResponse.json({ project: await getProject(auth.user.id, projectId) });
  } catch (error) { return errorResponse(error); }
}
