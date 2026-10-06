import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { analyticsRequestInput, analyticsRouteContext, type AnalyticsRouteContext } from "@/lib/analytics/api-context";
import { publishPublicResult } from "@/lib/analytics/public-results";

export async function POST(request: Request, context: AnalyticsRouteContext) {
  try { const { access, reportId } = await analyticsRouteContext(context); return NextResponse.json({ publication: await publishPublicResult(access, reportId!, await analyticsRequestInput(request)) }, { status: 201 }); } catch (error) { return errorResponse(error); }
}
