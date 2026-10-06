import { NextResponse } from "next/server";
import { requireOrganizationAccess } from "@/lib/auth/organization-access";
import { awardTrackingSchema, enrollAward, getAwardTrackingPreview } from "@/lib/awards/tracking";
import { errorResponse } from "@/lib/http";

type Context = { params: Promise<{ organizationId: string; awardId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { organizationId, awardId } = await context.params;
    const access = await requireOrganizationAccess(organizationId, "MANAGER");
    const input = awardTrackingSchema.parse({ cohortId: new URL(request.url).searchParams.get("cohortId") });
    return NextResponse.json({ preview: await getAwardTrackingPreview(access, awardId, input.cohortId) });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request, context: Context) {
  try {
    const { organizationId, awardId } = await context.params;
    const access = await requireOrganizationAccess(organizationId, "MANAGER");
    return NextResponse.json(await enrollAward(access, awardId, awardTrackingSchema.parse(await request.json())));
  } catch (error) { return errorResponse(error); }
}
