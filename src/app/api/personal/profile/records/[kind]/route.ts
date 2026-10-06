import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";
import { profileRecordKindSchema } from "@/lib/profiles/schemas";
import { saveProfileRecord } from "@/lib/profiles/service";

export async function POST(request: Request, context: { params: Promise<{ kind: string }> }) {
  try {
    const { user } = await requireAuthenticatedSession(); const { kind } = await context.params;
    await saveProfileRecord(user.id, profileRecordKindSchema.parse(kind), await request.json());
    return NextResponse.json({ saved: true }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
