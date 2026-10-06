import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { errorResponse, isUniqueConstraintError } from "@/lib/http";
import { createApplicationSchema } from "@/lib/selection/schemas";
import { createPersonalApplication, listPersonalApplications } from "@/lib/selection/service";

export async function GET() {
  try { const auth = await requireAuthenticatedSession(); return NextResponse.json({ applications: await listPersonalApplications(auth.user.id) }); }
  catch (error) { return errorResponse(error); }
}
export async function POST(request: Request) {
  try { const auth = await requireAuthenticatedSession(); return NextResponse.json({ application: await createPersonalApplication(auth.user.id, createApplicationSchema.parse(await request.json())) }, { status: 201 }); }
  catch (error) { if (isUniqueConstraintError(error)) return NextResponse.json({ error: "Este projeto já tem uma candidatura neste edital." }, { status: 409 }); return errorResponse(error); }
}
