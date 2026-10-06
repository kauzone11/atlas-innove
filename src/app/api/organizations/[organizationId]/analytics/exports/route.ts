import { errorResponse } from "@/lib/http";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthorizationError } from "@/lib/auth/authorization";
import { DomainConflictError, ResourceNotFoundError } from "@/lib/errors";
import { analyticsRequestInput, analyticsReturnUrl, analyticsRouteContext, type AnalyticsRouteContext } from "@/lib/analytics/api-context";
import { createAnalyticsExport } from "@/lib/analytics/exports";

export async function POST(request: Request, context: AnalyticsRouteContext) {
  try {
    const { access } = await analyticsRouteContext(context);
    const result = await createAnalyticsExport(access, await analyticsRequestInput(request));
    return new Response(result.csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${result.filename}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "X-Export-Audit-Id": result.auditId } });
  } catch (error) {
    if (request.headers.get("content-type")?.includes("application/json")) return errorResponse(error);
    const code = error instanceof ZodError ? "invalid" : error instanceof AuthorizationError ? "permission" : error instanceof ResourceNotFoundError ? "scope" : error instanceof DomainConflictError ? error.code.includes("LIMIT") || error.code.includes("TOO_LARGE") ? "limit" : "scope" : "failed";
    if (code === "failed") console.error(error);
    return NextResponse.redirect(analyticsReturnUrl(request, code), 303);
  }
}
