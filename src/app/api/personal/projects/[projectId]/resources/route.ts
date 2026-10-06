import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";
import { createProjectResource, getProjectCollaboration } from "@/lib/project-collaboration/service";
type Context = { params: Promise<{ projectId: string }> };
export async function GET(_request: Request, { params }: Context) {
  try { const { user } = await requireAuthenticatedSession(); const { projectId } = await params;
    return NextResponse.json({ resources: (await getProjectCollaboration(user.id, projectId)).resources });
  } catch (error) { return errorResponse(error); }
}
export async function POST(request: Request, { params }: Context) {
  try { const { user } = await requireAuthenticatedSession(); const { projectId } = await params;
    return NextResponse.json({ resource: await createProjectResource(user.id, projectId, await request.json()) }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
