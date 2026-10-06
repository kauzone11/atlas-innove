import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";
import { removeProjectResource, updateProjectResource } from "@/lib/project-collaboration/service";
type Context = { params: Promise<{ projectId: string; resourceId: string }> };
export async function PATCH(request: Request, { params }: Context) {
  try { const { user } = await requireAuthenticatedSession(); const { projectId, resourceId } = await params;
    return NextResponse.json({ resource: await updateProjectResource(user.id, projectId, resourceId, await request.json()) });
  } catch (error) { return errorResponse(error); }
}
export async function DELETE(request: Request, { params }: Context) {
  try { const { user } = await requireAuthenticatedSession(); const { projectId, resourceId } = await params;
    await removeProjectResource(user.id, projectId, resourceId, await request.json());
    return NextResponse.json({ removed: true });
  } catch (error) { return errorResponse(error); }
}
