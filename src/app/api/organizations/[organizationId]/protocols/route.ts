import { NextResponse } from "next/server";

import { requireOrganizationAccess } from "@/lib/auth/organization-access";
import { errorResponse } from "@/lib/http";
import { createProtocolVersionSchema } from "@/lib/tracking-protocols/schemas";
import { createProtocolVersion, listTrackingProtocols } from "@/lib/tracking-protocols/service";

type RouteContext = { params: Promise<{ organizationId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { organizationId } = await context.params;
    await requireOrganizationAccess(organizationId);
    return NextResponse.json({ protocols: await listTrackingProtocols(organizationId) });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { organizationId } = await context.params;
    await requireOrganizationAccess(organizationId, "ADMIN");
    const input = createProtocolVersionSchema.parse(await request.json());
    return NextResponse.json({ protocol: await createProtocolVersion(organizationId, input) }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
