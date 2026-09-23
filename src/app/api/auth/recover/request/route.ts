import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { createOpaqueToken, hashToken, normalizeEmail } from "@/lib/security";

const schema = z.object({ email: z.string().email().max(254) });
const RESET_TTL_MS = 1000 * 60 * 30;

export async function POST(request: Request) {
  try {
    const { email: rawEmail } = schema.parse(await request.json());
    const email = normalizeEmail(rawEmail);
    const user = await db.user.findUnique({ where: { email }, select: { id: true } });
    const response: { message: string; developmentToken?: string } = {
      message: "Se o e-mail estiver cadastrado, você receberá as instruções de recuperação.",
    };

    if (user) {
      const rawToken = createOpaqueToken();
      await db.$transaction([
        db.passwordResetToken.updateMany({
          where: { userId: user.id, usedAt: null },
          data: { usedAt: new Date() },
        }),
        db.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash: hashToken(rawToken),
            expiresAt: new Date(Date.now() + RESET_TTL_MS),
          },
        }),
      ]);
      if (process.env.NODE_ENV !== "production" && process.env.ALLOW_DEV_RESET_TOKEN === "true") {
        response.developmentToken = rawToken;
      }
    }

    return NextResponse.json(response);
  } catch (error) {
    return errorResponse(error);
  }
}
