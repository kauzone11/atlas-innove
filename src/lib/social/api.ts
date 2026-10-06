import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";
import { AuthorizationError } from "@/lib/auth/authorization";

export type SocialRouteContext<Key extends string> = { params: Promise<Record<Key, string>> };
export async function socialRead(action: (userId: string) => Promise<unknown>) {
  try {
    const { user } = await requireAuthenticatedSession();
    return NextResponse.json(await action(user.id), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
export async function socialWrite(request: Request, action: (userId: string, input: unknown) => Promise<unknown>) {
  try {
    const { user } = await requireAuthenticatedSession();
    const origin = request.headers.get("origin");
    if (origin) {
      let allowed = false;
      try {
        const source = new URL(origin);
        // Reverse proxies preserve the browser-facing Host while Next may use an internal request URL.
        const target = new URL(`${source.protocol}//${request.headers.get("host") ?? new URL(request.url).host}`);
        allowed = ["http:", "https:"].includes(source.protocol) && !source.username && !source.password
          && source.pathname === "/" && !source.search && !source.hash && source.host === target.host;
      } catch { allowed = false; }
      if (!allowed) throw new AuthorizationError("SOCIAL_ORIGIN_FORBIDDEN");
    }
    const text = await request.text();
    if (text.length > 16000) return NextResponse.json({ error: "O conteúdo enviado é muito longo." }, { status: 413 });
    let input: unknown = {};
    if (text) { try { input = JSON.parse(text); } catch { return NextResponse.json({ error: "Envie um conteúdo válido." }, { status: 400 }); } }
    return NextResponse.json((await action(user.id, input)) ?? { saved: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
export const reactionInput = z.object({ type: z.enum(["LIKE", "CELEBRATE", "SUPPORT", "LOVE", "INSIGHTFUL", "FUNNY"]).nullable() }).strict();
