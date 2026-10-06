import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { setSavedOpportunity } from "@/lib/opportunities/service";
import { errorResponse } from "@/lib/http";
import { ResourceNotFoundError } from "@/lib/errors";
type Context = { params: Promise<{ kind: string; id: string }> };
async function change(context: Context, saved: boolean) {
  try { const { user } = await requireAuthenticatedSession(); const params = await context.params; const kind = z.enum(["INTERNAL", "EXTERNAL"]).parse(params.kind); return NextResponse.json(await setSavedOpportunity(user.id, kind, params.id, saved)); }
  catch (error) { if (error instanceof ResourceNotFoundError && error.code === "OPPORTUNITY_UNAVAILABLE") return NextResponse.json({ error: "Esta oportunidade não está disponível publicamente. Os registros já salvos permanecem preservados." }, { status: 404 }); return errorResponse(error); }
}
export function PUT(_request: Request, context: Context) { return change(context, true); }
export function DELETE(_request: Request, context: Context) { return change(context, false); }
