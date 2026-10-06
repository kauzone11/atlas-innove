import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { analyticsRouteContext, type AnalyticsRouteContext } from "@/lib/analytics/api-context";
import { previewPublicResult } from "@/lib/analytics/public-results";

export async function POST(_request: Request, context: AnalyticsRouteContext) {
  try { const { access, reportId } = await analyticsRouteContext(context); return NextResponse.json(await previewPublicResult(access, reportId!), { headers: { "Cache-Control": "private, no-store" } }); } catch (error) { return errorResponse(error); }
}
