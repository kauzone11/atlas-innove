import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";
import { createProjectTask, getProjectCollaboration } from "@/lib/project-collaboration/service";
type Context = { params: Promise<{ projectId: string }> };
export async function GET(request: Request, { params }: Context) {
  try { const { user } = await requireAuthenticatedSession(); const { projectId } = await params;
    const query = new URL(request.url).searchParams;
    const filter = query.get("filter"); const taskFilter = filter === "pending" || filter === "completed" ? filter : "all";
    const workspace = await getProjectCollaboration(user.id, projectId, { taskFilter, taskPage: Number(query.get("page") ?? 1) });
    return NextResponse.json({ tasks: workspace.tasks, collaborators: workspace.collaborators, page: workspace.taskPage, pageSize: workspace.taskPageSize, total: workspace.taskTotal, filter: workspace.taskFilter });
  } catch (error) { return errorResponse(error); }
}
export async function POST(request: Request, { params }: Context) {
  try { const { user } = await requireAuthenticatedSession(); const { projectId } = await params;
    return NextResponse.json({ task: await createProjectTask(user.id, projectId, await request.json()) }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
