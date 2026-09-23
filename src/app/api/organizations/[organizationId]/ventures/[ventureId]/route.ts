import { NextResponse } from "next/server";

import { requireOrganizationAccess } from "@/lib/auth/organization-access";
import { errorResponse } from "@/lib/http";
import { updateVentureSchema } from "@/lib/ventures/schemas";
import { getOrganizationVenture, updateVenture } from "@/lib/ventures/service";

type RouteContext = { params: Promise<{ organizationId: string; ventureId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { organizationId, ventureId } = await context.params;
    await requireOrganizationAccess(organizationId);
    const venture = await getOrganizationVenture(organizationId, ventureId);
    if (!venture) return NextResponse.json({ error: "Empreendimento não encontrado." }, { status: 404 });
    return NextResponse.json({ venture });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { organizationId, ventureId } = await context.params;
    await requireOrganizationAccess(organizationId, "MANAGER");
    const input = updateVentureSchema.parse(await request.json());
    const venture = await updateVenture(organizationId, ventureId, input);
    return NextResponse.json({ venture });
  } catch (error) {
    return errorResponse(error);
  }
}
