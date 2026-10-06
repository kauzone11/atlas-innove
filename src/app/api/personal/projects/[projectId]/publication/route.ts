import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { errorResponse, isUniqueConstraintError } from "@/lib/http";
import { updateProjectPublication } from "@/lib/participants/service";

export async function PATCH(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { user } = await requireAuthenticatedSession();
    const { projectId } = await context.params;
    return NextResponse.json({ project: await updateProjectPublication(user.id, projectId, await request.json()) });
  } catch (error) {
    if (isUniqueConstraintError(error)) return NextResponse.json({ error: "Este endereço de projeto já está em uso. Escolha outro." }, { status: 409 });
    return errorResponse(error);
  }
}
