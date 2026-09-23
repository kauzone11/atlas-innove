import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { db } from "@/lib/db";
import { createCohort } from "@/lib/cohorts/service";
import { createFollowUpWave } from "@/lib/follow-up/service";
import { ResourceNotFoundError } from "@/lib/errors";
import { enrollVenture, getOrganizationVenture, withdrawEnrollment } from "@/lib/ventures/service";

const databaseAvailable = Boolean(process.env.DATABASE_URL);

test("services and database preserve tenant, lifecycle and longitudinal invariants", async (context) => {
  if (!databaseAvailable) {
    context.skip("DATABASE_URL is not configured for the integration harness");
    return;
  }

  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  let userId: string | undefined;
  let organizationAId: string | undefined;
  let organizationBId: string | undefined;

  try {
    const user = await db.user.create({
      data: { email: `domain-${suffix}@example.test`, passwordHash: "test-only" },
      select: { id: true },
    });
    userId = user.id;
    const [organizationA, organizationB] = await Promise.all([
      db.organization.create({ data: { name: `Org A ${suffix}`, slug: `domain-a-${suffix}` }, select: { id: true } }),
      db.organization.create({ data: { name: `Org B ${suffix}`, slug: `domain-b-${suffix}` }, select: { id: true } }),
    ]);
    organizationAId = organizationA.id;
    organizationBId = organizationB.id;

    const [programA, programB] = await Promise.all([
      db.fundingProgram.create({ data: { organizationId: organizationA.id, createdByUserId: user.id, name: "Program A", slug: `program-a-${suffix}` }, select: { id: true } }),
      db.fundingProgram.create({ data: { organizationId: organizationB.id, createdByUserId: user.id, name: "Program B", slug: `program-b-${suffix}` }, select: { id: true } }),
    ]);
    const [cohortA, cohortB, cohortA2] = await Promise.all([
      db.cohort.create({ data: { organizationId: organizationA.id, fundingProgramId: programA.id, name: "Cohort A" }, select: { id: true } }),
      db.cohort.create({ data: { organizationId: organizationB.id, fundingProgramId: programB.id, name: "Cohort B" }, select: { id: true } }),
      db.cohort.create({ data: { organizationId: organizationA.id, fundingProgramId: programA.id, name: "Cohort A2" }, select: { id: true } }),
    ]);
    const [ventureA, ventureB, ventureC, ventureD] = await Promise.all([
      db.venture.create({ data: { organizationId: organizationA.id, name: "Venture A", kind: "COMPANY" }, select: { id: true } }),
      db.venture.create({ data: { organizationId: organizationB.id, name: "Venture B", kind: "COMPANY" }, select: { id: true } }),
      db.venture.create({ data: { organizationId: organizationA.id, name: "Venture C", kind: "COMPANY" }, select: { id: true } }),
      db.venture.create({ data: { organizationId: organizationA.id, name: "Venture D", kind: "COMPANY" }, select: { id: true } }),
    ]);

    assert.equal(await getOrganizationVenture(organizationA.id, ventureB.id), null);
    await assert.rejects(
      () => createCohort(organizationA.id, programB.id, { name: "Cross tenant", code: null, referenceYear: null, startsAt: null, endsAt: null, status: "PLANNED" }),
      (error) => error instanceof ResourceNotFoundError && error.code === "FUNDING_PROGRAM_NOT_FOUND",
    );
    await assert.rejects(
      () => enrollVenture(organizationA.id, cohortA.id, { ventureId: ventureB.id, externalReference: null }),
      (error) => error instanceof ResourceNotFoundError && error.code === "VENTURE_NOT_FOUND",
    );

    const enrollmentA = await enrollVenture(organizationA.id, cohortA.id, { ventureId: ventureA.id, externalReference: null });
    await assert.rejects(
      () => enrollVenture(organizationA.id, cohortA.id, { ventureId: ventureA.id, externalReference: null }),
      (error) => typeof error === "object" && error !== null && "code" in error && error.code === "VENTURE_ALREADY_ENROLLED",
    );
    const closedCohort = await db.cohort.create({ data: { organizationId: organizationA.id, fundingProgramId: programA.id, name: "Closed cohort", status: "CLOSED" }, select: { id: true } });
    const archivedCohort = await db.cohort.create({ data: { organizationId: organizationA.id, fundingProgramId: programA.id, name: "Archived cohort", status: "ARCHIVED" }, select: { id: true } });
    await assert.rejects(() => enrollVenture(organizationA.id, closedCohort.id, { ventureId: ventureC.id, externalReference: null }), /COHORT_NOT_ELIGIBLE_FOR_ENROLLMENT/);
    await assert.rejects(() => enrollVenture(organizationA.id, archivedCohort.id, { ventureId: ventureD.id, externalReference: null }), /COHORT_NOT_ELIGIBLE_FOR_ENROLLMENT/);

    await assert.rejects(
      () => createFollowUpWave(organizationA.id, cohortB.id, { name: "Cross tenant wave", kind: "BASELINE", sequence: 0, offsetMonths: null, scheduledFor: null, opensAt: null, closesAt: null }),
      (error) => error instanceof ResourceNotFoundError && error.code === "COHORT_NOT_FOUND",
    );
    const waveA = await createFollowUpWave(organizationA.id, cohortA.id, { name: "Baseline A", kind: "BASELINE", sequence: 0, offsetMonths: 0, scheduledFor: null, opensAt: null, closesAt: null });
    await enrollVenture(organizationA.id, cohortA2.id, { ventureId: ventureC.id, externalReference: null });
    const waveA2 = await createFollowUpWave(organizationA.id, cohortA2.id, { name: "Baseline A2", kind: "BASELINE", sequence: 0, offsetMonths: 0, scheduledFor: null, opensAt: null, closesAt: null });

    await assert.rejects(
      () => db.ventureObservation.create({ data: { organizationId: organizationA.id, cohortId: cohortA.id, ventureEnrollmentId: enrollmentA.id, followUpWaveId: waveA2.id } }),
    );
    await assert.rejects(
      () => db.ventureObservation.create({ data: { organizationId: organizationA.id, cohortId: cohortA.id, ventureEnrollmentId: enrollmentA.id, followUpWaveId: waveA.id } }),
    );
    await withdrawEnrollment(organizationA.id, cohortA.id, enrollmentA.id);
  } finally {
    if (organizationAId) await db.organization.delete({ where: { id: organizationAId } });
    if (organizationBId) await db.organization.delete({ where: { id: organizationBId } });
    if (userId) await db.user.delete({ where: { id: userId } });
  }
});
