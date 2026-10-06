import { redirect } from "next/navigation";

import { hasAtLeastRole } from "@/lib/auth/authorization";
import { getActiveOrganizationContext } from "@/lib/auth/session";
import { DomainConflictError, ResourceNotFoundError } from "@/lib/errors";
import { ZodError } from "zod";

export async function getAnalyticsAccess(minimumRole: "VIEWER" | "ANALYST" | "MANAGER" = "VIEWER") {
  const context = await getActiveOrganizationContext();
  if (!context) redirect("/app/organizations");
  if (!hasAtLeastRole(context.membership.role, minimumRole)) redirect("/app/analytics?error=permission");
  return {
    context,
    access: { organizationId: context.organization.id, userId: context.auth.user.id, role: context.membership.role },
    canAnalyze: hasAtLeastRole(context.membership.role, "ANALYST"),
    canManage: hasAtLeastRole(context.membership.role, "MANAGER"),
  };
}

export type AnalyticsSearchParams = Record<string, string | string[] | undefined>;

export function queryValue(parameters: AnalyticsSearchParams, key: string): string {
  const value = parameters[key];
  return typeof value === "string" ? value : "";
}

export function queryValues(parameters: AnalyticsSearchParams, key: string): string[] {
  const value = parameters[key];
  return typeof value === "string" ? [value] : value ?? [];
}

export async function readAnalytics<T>(read: () => Promise<T>): Promise<{ data: T | null; error: string }> {
  try { return { data: await read(), error: "" }; }
  catch (error) {
    if (error instanceof ResourceNotFoundError) return { data: null, error: "scope" };
    if (error instanceof ZodError) return { data: null, error: "invalid" };
    if (error instanceof DomainConflictError) return { data: null, error: /LIMIT|TOO_LARGE/.test(error.code) ? "limit" : "scope" };
    throw error;
  }
}
