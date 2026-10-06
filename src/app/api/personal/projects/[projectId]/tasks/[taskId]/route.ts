import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";
import { updateProjectTask } from "@/lib/project-collaboration/service";
type Context = { params: Promise<{ projectId: string; taskId: string }> };
export async function PATCH(request: Request, { params }: Context) {
  try { const { user } = await requireAuthenticatedSession(); const { projectId, taskId } = await params;
    return NextResponse.json({ task: await updateProjectTask(user.id, projectId, taskId, await request.json()) });
  } catch (error) { return errorResponse(error); }
}
