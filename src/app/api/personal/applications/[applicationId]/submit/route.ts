import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";
import { applicationRevisionSchema } from "@/lib/selection/schemas";
import { submitPersonalApplication } from "@/lib/selection/service";
export async function POST(request: Request, context: { params: Promise<{ applicationId: string }> }) {
  try { const auth = await requireAuthenticatedSession(); const { applicationId } = await context.params; const { revision } = applicationRevisionSchema.parse(await request.json()); return NextResponse.json({ application: await submitPersonalApplication(auth.user.id, applicationId, revision) }); }
  catch (error) { return errorResponse(error); }
}
