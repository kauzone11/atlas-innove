import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { createUserSession } from "@/lib/auth/session";
import { normalizeEmail } from "@/lib/security";

const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
});

export async function POST(request: Request) {
  try {
    const input = loginSchema.parse(await request.json());
    const email = normalizeEmail(input.email);
    const user = await db.user.findUnique({
      where: { email },
      include: {
        memberships: {
          where: { status: "ACTIVE", organization: { status: "ACTIVE" } },
          select: { organizationId: true },
        },
      },
    });
    const validPassword = user ? await bcrypt.compare(input.password, user.passwordHash) : false;
    if (!user || !validPassword) {
      return NextResponse.json({ error: "E-mail ou senha inválidos." }, { status: 401 });
    }

    await createUserSession(user.id, user.memberships.length === 1 ? user.memberships[0].organizationId : undefined);
    return NextResponse.json({ user: { id: user.id, email: user.email } });
  } catch (error) {
    return errorResponse(error);
  }
}
