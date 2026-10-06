import { NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";
import { listNotifications, unreadNotificationCount, updateNotification } from "@/lib/notifications/service";

export async function GET(request: Request) {
  try {
    const auth = await requireAuthenticatedSession();
    const page = Number(new URL(request.url).searchParams.get("page") ?? 1);
    const [list, unread] = await Promise.all([listNotifications(auth.user.id, page), unreadNotificationCount(auth.user.id)]);
    return NextResponse.json({ ...list, unread });
  } catch (error) { return errorResponse(error); }
}
export async function PATCH(request: Request) {
  try {
    const auth = await requireAuthenticatedSession();
    await updateNotification(auth.user.id, null, await request.json());
    return NextResponse.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
