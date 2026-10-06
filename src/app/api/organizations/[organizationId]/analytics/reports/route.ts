import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { analyticsRequestInput, analyticsRouteContext, type AnalyticsRouteContext } from "@/lib/analytics/api-context";
import { generateAnalyticsReport, listAnalyticsReports } from "@/lib/analytics/reports";

export async function GET(_request: Request, context: AnalyticsRouteContext) {
  try { const { access } = await analyticsRouteContext(context); return NextResponse.json({ reports: await listAnalyticsReports(access) }, { headers: { "Cache-Control": "private, no-store" } }); } catch (error) { return errorResponse(error); }
}
export async function POST(request: Request, context: AnalyticsRouteContext) {
  try { const { access } = await analyticsRouteContext(context); return NextResponse.json({ report: await generateAnalyticsReport(access, await analyticsRequestInput(request)) }, { status: 201 }); } catch (error) { return errorResponse(error); }
}
