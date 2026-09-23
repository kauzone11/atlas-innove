import { NextResponse } from "next/server";
import { z } from "zod";

import { AuthorizationError } from "@/lib/auth/authorization";
import { requireAuthenticatedSession, selectActiveOrganization } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { hashToken } from "@/lib/security";

const schema = z.object({ token: z.string().min(32).max(128) });

export async function POST(request: Request) {
  try {
    const auth = await requireAuthenticatedSession();
    const { token } = schema.parse(await request.json());
    const invite = await db.organizationInvite.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { organization: true },
    });
    if (!invite || invite.status !== "PENDING" || invite.expiresAt <= new Date()) {
      throw new AuthorizationError("INVITATION_INVALID_OR_EXPIRED");
    }
    if (invite.organization.status !== "ACTIVE" || invite.email !== auth.user.email) {
      throw new AuthorizationError("INVITATION_ACCESS_DENIED");
    }

    await db.$transaction(async (tx) => {
      const current = await tx.organizationMembership.findUnique({
        where: { organizationId_userId: { organizationId: invite.organizationId, userId: auth.user.id } },
      });
      if (!current) {
        await tx.organizationMembership.create({
          data: { organizationId: invite.organizationId, userId: auth.user.id, role: invite.role, status: "ACTIVE" },
        });
      } else if (current.status !== "ACTIVE") {
        await tx.organizationMembership.update({
          where: { id: current.id },
          data: { role: invite.role, status: "ACTIVE" },
        });
      }
      await tx.organizationInvite.update({
        where: { id: invite.id },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      });
    });
    await selectActiveOrganization(invite.organizationId);
    return NextResponse.json({ ok: true, organizationId: invite.organizationId });
  } catch (error) {
    return errorResponse(error);
  }
}
