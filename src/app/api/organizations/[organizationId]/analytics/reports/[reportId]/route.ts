import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { analyticsRouteContext, type AnalyticsRouteContext } from "@/lib/analytics/api-context";
import { getAnalyticsReport } from "@/lib/analytics/reports";

export async function GET(_request: Request, context: AnalyticsRouteContext) {
  try { const { access, reportId } = await analyticsRouteContext(context); return NextResponse.json({ report: await getAnalyticsReport(access, reportId!) }, { headers: { "Cache-Control": "private, no-store" } }); } catch (error) { return errorResponse(error); }
}
