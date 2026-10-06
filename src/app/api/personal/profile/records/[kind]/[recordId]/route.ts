import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";
import { profileRecordKindSchema } from "@/lib/profiles/schemas";
import { deleteProfileRecord, saveProfileRecord } from "@/lib/profiles/service";

type Context = { params: Promise<{ kind: string; recordId: string }> };
export async function PATCH(request: Request, context: Context) {
  try {
    const { user } = await requireAuthenticatedSession(); const { kind, recordId } = await context.params;
    await saveProfileRecord(user.id, profileRecordKindSchema.parse(kind), await request.json(), recordId);
    return NextResponse.json({ saved: true });
  } catch (error) { return errorResponse(error); }
}
export async function DELETE(_request: Request, context: Context) {
  try {
    const { user } = await requireAuthenticatedSession(); const { kind, recordId } = await context.params;
    await deleteProfileRecord(user.id, profileRecordKindSchema.parse(kind), recordId);
    return NextResponse.json({ removed: true });
  } catch (error) { return errorResponse(error); }
}
