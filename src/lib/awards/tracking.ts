import { z } from "zod";
import type { OrganizationAccess } from "@/lib/awards/service";
import { db } from "@/lib/db";
import { DomainConflictError, ResourceNotFoundError } from "@/lib/errors";
import { enrollmentMappingSchema } from "@/lib/selection/schemas";
import { enrollCallApplications, getCallEnrollmentPreview, requireInstitutionApplicationAccess } from "@/lib/selection/service";

export const awardTrackingSchema = z.object({
  cohortId: z.string().min(1).max(200),
  mapping: enrollmentMappingSchema.omit({ applicationId: true }).optional(),
}).strict();

async function trackingContext(access: OrganizationAccess, awardId: string) {
  const organizationId = access.organization.id;
  const award = await db.award.findFirst({
    where: { organizationId, id: awardId },
    select: { id: true, applicationId: true, status: true, fundingCallId: true, fundingCall: { select: { fundingProgramId: true } } },
  });
  if (!award) throw new ResourceNotFoundError("AWARD_NOT_FOUND");
  await requireInstitutionApplicationAccess(access.auth.user.id, organizationId, award.fundingCall.fundingProgramId, award.fundingCallId, award.applicationId, "MANAGER");
  if (award.status !== "ACTIVE") throw new DomainConflictError("AWARD_TRACKING_ACTIVE_REQUIRED");
  return award;
}

export async function getAwardTrackingPreview(access: OrganizationAccess, awardId: string, cohortId: string) {
  const award = await trackingContext(access, awardId);
  return getCallEnrollmentPreview(access.organization.id, award.fundingCall.fundingProgramId, award.fundingCallId, cohortId, [award.applicationId]);
}

export async function enrollAward(access: OrganizationAccess, awardId: string, rawInput: z.infer<typeof awardTrackingSchema>) {
  const input = awardTrackingSchema.parse(rawInput);
  const award = await trackingContext(access, awardId);
  const result = await enrollCallApplications(
    access.organization.id, award.fundingCall.fundingProgramId, award.fundingCallId,
    access.auth.user.id, input.cohortId, [award.applicationId],
    input.mapping ? [{ ...input.mapping, applicationId: award.applicationId }] : [], award.id,
  );
  const enrollments = await db.ventureEnrollment.findMany({
    where: { organizationId: access.organization.id, id: { in: result.enrollments.map((entry) => entry.enrollmentId) } },
    select: { awardId: true },
  });
  return { ...result, historicalTrackingPreserved: enrollments.some((entry) => entry.awardId === null) };
}
