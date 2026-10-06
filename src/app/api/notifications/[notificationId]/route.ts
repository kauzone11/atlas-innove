import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";
import { updateNotification } from "@/lib/notifications/service";

export async function PATCH(request: Request, context: { params: Promise<{ notificationId: string }> }) {
  try {
    const auth = await requireAuthenticatedSession();
    await updateNotification(auth.user.id, (await context.params).notificationId, await request.json());
    return NextResponse.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
