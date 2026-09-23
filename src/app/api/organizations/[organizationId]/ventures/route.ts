import { NextResponse } from "next/server";

import { requireOrganizationAccess } from "@/lib/auth/organization-access";
import { errorResponse } from "@/lib/http";
import { createVentureSchema } from "@/lib/ventures/schemas";
import { createVenture, listOrganizationVentures } from "@/lib/ventures/service";

type RouteContext = { params: Promise<{ organizationId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { organizationId } = await context.params;
    await requireOrganizationAccess(organizationId);
    return NextResponse.json({ ventures: await listOrganizationVentures(organizationId) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { organizationId } = await context.params;
    await requireOrganizationAccess(organizationId, "MANAGER");
    const input = createVentureSchema.parse(await request.json());
    const venture = await createVenture(organizationId, input);
    return NextResponse.json({ venture }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
