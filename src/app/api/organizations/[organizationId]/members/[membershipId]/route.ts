import { NextResponse } from "next/server";
import { z } from "zod";

import { requireOrganizationAccess } from "@/lib/auth/organization-access";
import { assertCanManageMembership, AuthorizationError } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import { errorResponse } from "@/lib/http";

const schema = z.object({
  role: z.enum(["OWNER", "ADMIN", "MANAGER", "ANALYST", "VIEWER"]).optional(),
  status: z.enum(["ACTIVE", "DISABLED"]).optional(),
}).refine((input) => input.role !== undefined || input.status !== undefined, {
  message: "Informe uma alteração.",
});

type RouteContext = { params: Promise<{ organizationId: string; membershipId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { organizationId, membershipId } = await context.params;
    const input = schema.parse(await request.json());
    const access = await requireOrganizationAccess(organizationId, "ADMIN");
    const current = await db.organizationMembership.findFirst({ where: { id: membershipId, organizationId } });
    if (!current) {
      throw new AuthorizationError("MEMBERSHIP_NOT_FOUND");
    }
    const nextRole = input.role ?? current.role;
    assertCanManageMembership(access.membership.role, current.role, nextRole);
    if (input.status === "DISABLED" && current.userId === access.auth.user.id) {
      throw new AuthorizationError("CANNOT_DISABLE_CURRENT_MEMBERSHIP");
    }
    if (current.role === "OWNER" && (input.status === "DISABLED" || nextRole !== "OWNER")) {
      const activeOwnerCount = await db.organizationMembership.count({
        where: { organizationId, role: "OWNER", status: "ACTIVE" },
      });
      if (activeOwnerCount <= 1) {
        throw new AuthorizationError("LAST_OWNER_REQUIRED");
      }
    }
    const membership = await db.organizationMembership.update({
      where: { id: membershipId },
      data: { role: nextRole, ...(input.status ? { status: input.status } : {}) },
    });
    return NextResponse.json({ membership });
  } catch (error) {
    return errorResponse(error);
  }
}
