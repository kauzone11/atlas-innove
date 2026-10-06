import { getAuthenticatedSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";
import { readMedia } from "@/lib/media/service";
import { unavailableMedia } from "@/lib/media/errors";
import type { SocialRouteContext } from "@/lib/social/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "Vary": "Cookie", "X-Content-Type-Options": "nosniff" };
export async function GET(request: Request, context: SocialRouteContext<"id">) {
  try {
    const variant = new URL(request.url).searchParams.get("variant") ?? "medium";
    if (variant !== "small" && variant !== "medium" && variant !== "large") throw unavailableMedia();
    const session = await getAuthenticatedSession();
    const bytes = await readMedia((await context.params).id, session?.user.id, variant);
    return new Response(new Uint8Array(bytes), { headers: { ...headers, "Content-Type": "image/webp", "Content-Disposition": 'inline; filename="image.webp"', "Content-Length": String(bytes.byteLength) } });
  } catch (error) { const response = errorResponse(error); for (const [key, value] of Object.entries(headers)) response.headers.set(key, value); return response; }
}
