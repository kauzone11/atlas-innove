"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAnalyticsAccess } from "@/components/analytics/access";
import { generateAnalyticsReport, archiveAnalyticsReport } from "@/lib/analytics/reports";
import { generateAnalyticsReportSchema } from "@/lib/analytics/report-schemas";
import { publishPublicResult, unpublishPublicResult, updateAnalyticsSettings } from "@/lib/analytics/public-results";

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function actionError(error: unknown) {
  const code = error instanceof Error && "code" in error ? String(error.code) : "";
  if (code === "ANALYTICS_EXECUTIVE_METRIC_LIMIT") return "executive";
  if (code.includes("PREVIEW_CHANGED")) return "preview";
  if (code.includes("SLUG_UNAVAILABLE")) return "conflict";
  if (code.includes("TOO_LARGE") || code.includes("LIMIT")) return "limit";
  if (code.includes("ROLE") || code.includes("ACCESS")) return "permission";
  if (code.includes("NOT_FOUND") || code.includes("SCOPE")) return "scope";
  return "failed";
}

export async function generateReportAction(formData: FormData) {
  const { access } = await getAnalyticsAccess("ANALYST");
  const parsed = generateAnalyticsReportSchema.safeParse({ type: field(formData, "type"), title: field(formData, "title"), programId: field(formData, "programId") || undefined, callId: field(formData, "callId") || undefined, cohortId: field(formData, "cohortId") || undefined, metricId: field(formData, "metricId") || undefined, year: field(formData, "year") ? Number(field(formData, "year")) : undefined, supersedesId: field(formData, "supersedesId") || undefined });
  if (!parsed.success) redirect("/app/analytics/reports?error=invalid");
  let destination = "/app/analytics/reports?error=failed";
  try {
    const report = await generateAnalyticsReport(access, parsed.data);
    revalidatePath("/app/analytics/reports");
    destination = `/app/analytics/reports/${report.id}?success=generated`;
  } catch (error) { destination = `/app/analytics/reports?error=${actionError(error)}`; }
  redirect(destination);
}

export async function archiveReportAction(formData: FormData) {
  const { access } = await getAnalyticsAccess("MANAGER");
  const reportId = field(formData, "reportId");
  let destination = "/app/analytics/reports?success=archived";
  try { await archiveAnalyticsReport(access, reportId); revalidatePath("/app/analytics/reports"); }
  catch (error) { destination = `/app/analytics/reports?error=${actionError(error)}`; }
  redirect(destination);
}

export async function publishResultAction(formData: FormData) {
  const { access } = await getAnalyticsAccess("MANAGER");
  const reportId = field(formData, "reportId");
  if (field(formData, "confirm") !== "on") redirect(`/app/analytics/reports/${encodeURIComponent(reportId)}?publish=preview&error=invalid`);
  let destination = `/app/analytics/reports/${encodeURIComponent(reportId)}?success=published`;
  try {
    await publishPublicResult(access, reportId, { slug: field(formData, "slug"), title: field(formData, "title"), summary: field(formData, "summary") || null, previewDigest: field(formData, "previewDigest") });
    revalidatePath("/results"); revalidatePath("/app/analytics/reports");
  } catch (error) { destination = `/app/analytics/reports/${encodeURIComponent(reportId)}?publish=preview&error=${actionError(error)}`; }
  redirect(destination);
}

export async function unpublishResultAction(formData: FormData) {
  const { access } = await getAnalyticsAccess("MANAGER");
  let destination = "/app/analytics/reports?success=unpublished";
  try { await unpublishPublicResult(access, field(formData, "publicationId")); revalidatePath("/results"); revalidatePath("/app/analytics/reports"); }
  catch (error) { destination = `/app/analytics/reports?error=${actionError(error)}`; }
  redirect(destination);
}

export async function updateAnalyticsSettingsAction(formData: FormData) {
  const { access } = await getAnalyticsAccess("MANAGER");
  let destination = "/app/analytics/reports?success=settings";
  try { await updateAnalyticsSettings(access, { publicMinimumCellSize: Number(field(formData, "publicMinimumCellSize")) }); revalidatePath("/app/analytics/reports"); }
  catch (error) { destination = `/app/analytics/reports?error=${actionError(error)}`; }
  redirect(destination);
}
