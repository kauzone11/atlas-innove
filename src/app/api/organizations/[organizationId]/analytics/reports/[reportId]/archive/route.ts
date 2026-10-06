import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { analyticsRouteContext, type AnalyticsRouteContext } from "@/lib/analytics/api-context";
import { archiveAnalyticsReport } from "@/lib/analytics/reports";

export async function POST(_request: Request, context: AnalyticsRouteContext) {
  try { const { access, reportId } = await analyticsRouteContext(context); return NextResponse.json({ report: await archiveAnalyticsReport(access, reportId!) }); } catch (error) { return errorResponse(error); }
}
