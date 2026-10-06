import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { errorResponse, isUniqueConstraintError } from "@/lib/http";
import { createOrganizationSlug } from "@/lib/organizations/slug";
import { createUserSession } from "@/lib/auth/session";
import { normalizeEmail } from "@/lib/security";

const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().email().max(254),
  password: z.string().min(12).max(128),
  organizationName: z.preprocess((value) => typeof value === "string" && !value.trim() ? undefined : value, z.string().trim().min(2).max(160).optional()),
});

export async function POST(request: Request) {
  try {
    const input = registerSchema.parse(await request.json());
    const email = normalizeEmail(input.email);
    const passwordHash = await bcrypt.hash(input.password, 12);

    const result = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          profile: { create: { fullName: input.fullName } },
        },
      });
      const organization = input.organizationName ? await tx.organization.create({ data: { name: input.organizationName, slug: createOrganizationSlug(input.organizationName) } }) : null;
      if (organization) await tx.organizationMembership.create({ data: { userId: user.id, organizationId: organization.id, role: "OWNER" } });
      return { user, organization };
    });

    await createUserSession(result.user.id, result.organization?.id);
    return NextResponse.json(
      { user: { id: result.user.id, email: result.user.email }, organization: result.organization, redirectTo: result.organization ? "/app" : "/app/personal" },
      { status: 201 },
    );
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: "Já existe uma conta com este e-mail." }, { status: 409 });
    }
    return errorResponse(error);
  }
}
