import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";

export async function POST() {
  try {
    await requireAuthenticatedSession();
    return NextResponse.json({ error: "Envie um convite pela rede para que a pessoa aceite colaborar no projeto.", code: "PROJECT_INVITATION_REQUIRED" }, { status: 410 });
  } catch (error) { return errorResponse(error); }
}
