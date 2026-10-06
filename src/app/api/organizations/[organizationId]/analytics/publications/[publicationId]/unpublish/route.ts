import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { analyticsRouteContext, type AnalyticsRouteContext } from "@/lib/analytics/api-context";
import { unpublishPublicResult } from "@/lib/analytics/public-results";

export async function POST(_request: Request, context: AnalyticsRouteContext) {
  try { const { access, publicationId } = await analyticsRouteContext(context); return NextResponse.json({ publication: await unpublishPublicResult(access, publicationId!) }); } catch (error) { return errorResponse(error); }
}
