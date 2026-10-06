import { db } from "@/lib/db";
import { calendarToday } from "@/lib/execution/state";
import { requireAwardInstitutionRole, type OrganizationAccess } from "@/lib/awards/service";

export async function getInstitutionExecutionAttention(access: OrganizationAccess) {
  const { organizationId } = await requireAwardInstitutionRole(db, access);
  const active = { organizationId, status: { in: ["ACTIVE", "SUSPENDED"] as Array<"ACTIVE" | "SUSPENDED"> } };
  const [pendingReviews, overdueObligations] = await Promise.all([
    db.awardSubmission.count({ where: { organizationId, status: "SUBMITTED", reviewStatus: "PENDING", obligation: { waivedAt: null, award: active } } }),
    db.awardObligation.count({ where: { organizationId, award: active, waivedAt: null, dueAt: { lt: new Date(`${calendarToday()}T00:00:00Z`) }, submissions: { none: { status: "SUBMITTED", reviewStatus: { in: ["PENDING", "APPROVED"] } } } } }),
  ]);
  return { pendingReviews, overdueObligations };
}
