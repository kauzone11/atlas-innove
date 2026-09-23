import { NextResponse } from "next/server";

import { requireOrganizationAccess } from "@/lib/auth/organization-access";
import { errorResponse, isUniqueConstraintError } from "@/lib/http";
import { createEnrollmentSchema } from "@/lib/ventures/schemas";
import { enrollVenture } from "@/lib/ventures/service";

type RouteContext = { params: Promise<{ organizationId: string; cohortId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { organizationId, cohortId } = await context.params;
    await requireOrganizationAccess(organizationId, "MANAGER");
    const input = createEnrollmentSchema.parse(await request.json());
    const enrollment = await enrollVenture(organizationId, cohortId, input);
    return NextResponse.json({ enrollment }, { status: 201 });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: "Este empreendimento já participa desta coorte." }, { status: 409 });
    }
    return errorResponse(error);
  }
}
