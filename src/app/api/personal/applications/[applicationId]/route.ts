import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";
import { updateApplicationSchema } from "@/lib/selection/schemas";
import { getPersonalApplication, updatePersonalApplication } from "@/lib/selection/service";
type Context = { params: Promise<{ applicationId: string }> };
export async function GET(_request: Request, context: Context) {
  try { const auth = await requireAuthenticatedSession(); const { applicationId } = await context.params; const application = await getPersonalApplication(auth.user.id, applicationId); return application ? NextResponse.json({ application }) : NextResponse.json({ error: "Candidatura não encontrada." }, { status: 404 }); }
  catch (error) { return errorResponse(error); }
}
export async function PATCH(request: Request, context: Context) {
  try { const auth = await requireAuthenticatedSession(); const { applicationId } = await context.params; return NextResponse.json({ application: await updatePersonalApplication(auth.user.id, applicationId, updateApplicationSchema.parse(await request.json())) }); }
  catch (error) { return errorResponse(error); }
}
