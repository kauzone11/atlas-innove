import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { clearSessionCookie } from "@/lib/auth/session";
import { hashToken } from "@/lib/security";

const schema = z.object({
  token: z.string().min(32).max(128),
  password: z.string().min(12).max(128),
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const resetToken = await db.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(input.token) },
    });
    if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= new Date()) {
      return NextResponse.json({ error: "Token de recuperação inválido ou expirado." }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    await db.$transaction([
      db.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash, sessionVersion: { increment: 1 } },
      }),
      db.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
      db.session.updateMany({ where: { userId: resetToken.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    await clearSessionCookie();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
