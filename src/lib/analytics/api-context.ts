import { requireOrganizationAccess } from "@/lib/auth/organization-access";

export type AnalyticsRouteContext = { params: Promise<{ organizationId: string; reportId?: string; publicationId?: string }> };
export async function analyticsRouteContext(context: AnalyticsRouteContext) {
  const params = await context.params;
  const organizationAccess = await requireOrganizationAccess(params.organizationId);
  return { ...params, access: { organizationId: params.organizationId, userId: organizationAccess.auth.user.id, role: organizationAccess.membership.role } };
}

export async function analyticsRequestInput(request: Request) {
  if (request.headers.get("content-type")?.includes("application/json")) return request.json();
  const data = await request.formData();
  const input: Record<string, unknown> = {};
  for (const [key, value] of data.entries()) if (typeof value === "string" && value !== "") input[key] = key === "year" || key === "publicMinimumCellSize" ? Number(value) : value;
  return input;
}

export function analyticsReturnUrl(request: Request, errorCode: "limit" | "invalid" | "scope" | "permission" | "failed") {
  const origin = new URL(request.url).origin;
  let destination = new URL("/app/analytics", origin);
  try {
    const referer = new URL(request.headers.get("referer") ?? "");
    if (referer.origin === origin && (referer.pathname === "/app/analytics" || referer.pathname.startsWith("/app/analytics/"))) destination = new URL(`${referer.pathname}${referer.search}`, origin);
  } catch { /* An absent or malformed return address uses the analytics home. */ }
  destination.searchParams.set("error", errorCode);
  return destination;
}
