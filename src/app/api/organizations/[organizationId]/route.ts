import { NextResponse } from "next/server";
import { z } from "zod";

import { requireOrganizationAccess } from "@/lib/auth/organization-access";
import { errorResponse, isUniqueConstraintError } from "@/lib/http";
import { db } from "@/lib/db";

const updateSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(2).max(64).optional(),
}).refine((input) => input.name !== undefined || input.slug !== undefined, {
  message: "Informe ao menos uma alteração.",
});

type RouteContext = { params: Promise<{ organizationId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { organizationId } = await context.params;
    const access = await requireOrganizationAccess(organizationId);
    return NextResponse.json({
      organization: access.organization,
      membership: { id: access.membership.id, role: access.membership.role, status: access.membership.status },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { organizationId } = await context.params;
    await requireOrganizationAccess(organizationId, "ADMIN");
    const input = updateSchema.parse(await request.json());
    const organization = await db.organization.update({ where: { id: organizationId }, data: input });
    return NextResponse.json({ organization });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: "Este identificador já está em uso." }, { status: 409 });
    }
    return errorResponse(error);
  }
}
