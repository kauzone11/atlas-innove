import { NextResponse } from "next/server";

import { requireOrganizationAccess } from "@/lib/auth/organization-access";
import { errorResponse } from "@/lib/http";
import { saveObservationValuesSchema } from "@/lib/observations/schemas";
import { getObservationWorkspace, saveObservationValues } from "@/lib/observations/service";

type RouteContext = { params: Promise<{ organizationId: string; observationId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { organizationId, observationId } = await context.params;
    await requireOrganizationAccess(organizationId);
    const observation = await getObservationWorkspace(organizationId, observationId);
    if (!observation) return NextResponse.json({ error: "Observação não encontrada." }, { status: 404 });
    return NextResponse.json({ observation });
  } catch (error) { return errorResponse(error); }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { organizationId, observationId } = await context.params;
    await requireOrganizationAccess(organizationId, "MANAGER");
    const input = saveObservationValuesSchema.parse(await request.json());
    return NextResponse.json({ observation: await saveObservationValues(organizationId, observationId, input) });
  } catch (error) { return errorResponse(error); }
}
