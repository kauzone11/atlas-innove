import { NextResponse } from "next/server";
import { z } from "zod";

import { requireOrganizationAccess } from "@/lib/auth/organization-access";
import { assertCanManageMembership } from "@/lib/auth/authorization";
import type { OrganizationRole } from "@/lib/domain";
import { db } from "@/lib/db";
import { errorResponse, isUniqueConstraintError } from "@/lib/http";
import { createOpaqueToken, hashToken, normalizeEmail } from "@/lib/security";

const roleSchema = z.enum(["OWNER", "ADMIN", "MANAGER", "ANALYST", "VIEWER"]);
const inviteSchema = z.object({
  email: z.string().email().max(254),
  role: roleSchema,
});

type RouteContext = { params: Promise<{ organizationId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { organizationId } = await context.params;
    await requireOrganizationAccess(organizationId);
    const memberships = await db.organizationMembership.findMany({
      where: { organizationId },
      include: { user: { include: { profile: true } } },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json({
      members: memberships.map((membership) => ({
        id: membership.id,
        role: membership.role,
        status: membership.status,
        user: {
          id: membership.user.id,
          email: membership.user.email,
          fullName: membership.user.profile?.fullName ?? membership.user.email,
        },
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { organizationId } = await context.params;
    const access = await requireOrganizationAccess(organizationId, "ADMIN");
    const input = inviteSchema.parse(await request.json());
    assertCanManageMembership(access.membership.role, "VIEWER", input.role);
    const email = normalizeEmail(input.email);
    const rawToken = createOpaqueToken();

    const existingUser = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (existingUser) {
      const existingMembership = await db.organizationMembership.findUnique({
        where: { organizationId_userId: { organizationId, userId: existingUser.id } },
      });
      if (existingMembership?.status === "ACTIVE") {
        return NextResponse.json({ error: "Este usuário já pertence à organização." }, { status: 409 });
      }
    }

    const invite = await db.$transaction(async (tx) => {
      await tx.organizationInvite.updateMany({
        where: { organizationId, email, status: "PENDING" },
        data: { status: "REVOKED" },
      });
      return tx.organizationInvite.create({
        data: {
          organizationId,
          invitedByUserId: access.auth.user.id,
          email,
          role: input.role as OrganizationRole,
          tokenHash: hashToken(rawToken),
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 72),
        },
      });
    });

    const response: { invite: { id: string; email: string; role: string; expiresAt: Date }; developmentToken?: string } = {
      invite: { id: invite.id, email: invite.email, role: invite.role, expiresAt: invite.expiresAt },
    };
    if (process.env.NODE_ENV !== "production" && process.env.ALLOW_DEV_INVITE_TOKEN === "true") {
      response.developmentToken = rawToken;
    }
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: "Já existe um convite equivalente pendente." }, { status: 409 });
    }
    return errorResponse(error);
  }
}
