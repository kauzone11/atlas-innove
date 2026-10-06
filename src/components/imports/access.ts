import { redirect } from "next/navigation";
import { hasAtLeastRole } from "@/lib/auth/authorization";
import { getActiveOrganizationContext } from "@/lib/auth/session";

export async function getImportPageAccess() {
  const context = await getActiveOrganizationContext();
  if (!context) redirect("/app/organizations");
  return { context, canManage: hasAtLeastRole(context.membership.role, "MANAGER") };
}

export function importPageNumber(value: string | string[] | undefined) {
  const page = typeof value === "string" ? Number(value) : 1;
  return Number.isInteger(page) && page >= 1 && page <= 100000 ? page : 1;
}
