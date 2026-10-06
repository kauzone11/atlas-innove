import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { analyticsRequestInput, analyticsRouteContext, type AnalyticsRouteContext } from "@/lib/analytics/api-context";
import { previewAnalyticsReport } from "@/lib/analytics/reports";

export async function POST(request: Request, context: AnalyticsRouteContext) {
  try { const { access } = await analyticsRouteContext(context); return NextResponse.json({ payload: await previewAnalyticsReport(access, await analyticsRequestInput(request)) }, { headers: { "Cache-Control": "private, no-store" } }); } catch (error) { return errorResponse(error); }
}
