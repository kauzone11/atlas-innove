import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { analyticsRequestInput, analyticsRouteContext, type AnalyticsRouteContext } from "@/lib/analytics/api-context";
import { getAnalyticsSettings, updateAnalyticsSettings } from "@/lib/analytics/public-results";

export async function GET(_request: Request, context: AnalyticsRouteContext) {
  try { const { access } = await analyticsRouteContext(context); return NextResponse.json({ settings: await getAnalyticsSettings(access) }, { headers: { "Cache-Control": "private, no-store" } }); } catch (error) { return errorResponse(error); }
}
export async function PATCH(request: Request, context: AnalyticsRouteContext) {
  try { const { access } = await analyticsRouteContext(context); return NextResponse.json({ settings: await updateAnalyticsSettings(access, await analyticsRequestInput(request)) }); } catch (error) { return errorResponse(error); }
}
