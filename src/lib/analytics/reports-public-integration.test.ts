import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { createProtocolVersion } from "@/lib/tracking-protocols/service";
import { createFollowUpWave, updateFollowUpWaveStatus } from "@/lib/follow-up/service";
import { saveObservationValues } from "@/lib/observations/service";
import { previewAnalyticsReport, generateAnalyticsReport, getAnalyticsReport, listAnalyticsReports, archiveAnalyticsReport, getAnalyticsReportSourceStatus } from "@/lib/analytics/reports";
import { previewPublicResult, publishPublicResult, unpublishPublicResult, getPublicResult, listPublicResults, getAnalyticsSettings, updateAnalyticsSettings } from "@/lib/analytics/public-results";
import { createAnalyticsExport } from "@/lib/analytics/exports";
import { getAnalyticsSourceDigest } from "@/lib/analytics/read-model";
import type { AnalyticsAccess } from "@/lib/analytics/access";

if ((process.env.REQUIRE_DOMAIN_DATABASE === "true" || process.env.CI === "true") && !process.env.DATABASE_URL) throw new Error("Disposable PostgreSQL is required for report and publication tests");

test("report snapshots, safe exports and controlled publication preserve evidence and privacy through the real database", async (context) => {
  if (!process.env.DATABASE_URL) { context.skip("DATABASE_URL is not configured"); return; }
  const suffix = randomUUID().replaceAll("-", "");
  const user = await db.user.create({ data: { email: `report-${suffix}@example.test`, passwordHash: "test-only", profile: { create: { fullName: "Report manager" } } } });
  const [org, other] = await Promise.all(["main", "other"].map((label) => db.organization.create({ data: { name: `Report ${label} institution`, slug: `report-${label}-${suffix}` } })));
  const access: AnalyticsAccess = { organizationId: org.id, userId: user.id, role: "OWNER" };
  const otherAccess: AnalyticsAccess = { ...access, organizationId: other.id };
  const projectIds: string[] = [];
  try {
    await db.organizationMembership.createMany({ data: [org, other].map((organization) => ({ organizationId: organization.id, userId: user.id, role: "MANAGER" })) });
    const program = await db.fundingProgram.create({ data: { organizationId: org.id, name: "Evidence program", slug: "evidence-program", status: "ACTIVE", createdByUserId: user.id } });
    const call = await db.fundingCall.create({ data: { organizationId: org.id, fundingProgramId: program.id, title: "Evidence call", callNumber: "report-1", status: "RESULT_PUBLISHED", applicationsEnabled: true, publishedAt: new Date("2026-01-01T00:00:00Z"), resultsPublishedAt: new Date("2026-09-01T00:00:00Z") } });
    const protocol = await createProtocolVersion(org.id, { name: "Evidence protocol", indicators: [{ key: "revenue", label: "Receita mensal", valueType: "CURRENCY", unit: "R$" }, { key: "stage", label: "Estágio", valueType: "ENUM", allowedValues: ["Ideia", "Produto"] }] });
    const version = protocol.versions[0];
    const cohort = await db.cohort.create({ data: { organizationId: org.id, fundingProgramId: program.id, fundingCallId: call.id, name: "Evidence cohort", trackingProtocolVersionId: version.id, status: "ACTIVE" } });
    const revenue = version.indicators.find((indicator) => indicator.key === "revenue")!;
    const stage = version.indicators.find((indicator) => indicator.key === "stage")!;
    const enrollmentIds: string[] = [];
    for (let index = 0; index < 6; index++) {
      const venture = await db.venture.create({ data: { organizationId: org.id, name: index === 0 ? "  =HYPERLINK(\"https://example.test\")" : `PRIVATE_VENTURE_${index}`, kind: "COMPANY" } });
      const enrollment = await db.ventureEnrollment.create({ data: { organizationId: org.id, cohortId: cohort.id, ventureId: venture.id, enrolledAt: new Date("2026-01-01T00:00:00Z") } });
      enrollmentIds.push(enrollment.id);
    }
    const wave = await createFollowUpWave(org.id, cohort.id, { name: "Baseline", kind: "BASELINE", sequence: 0, offsetMonths: 0, scheduledFor: new Date("2026-01-01T00:00:00Z") });
    await updateFollowUpWaveStatus(org.id, cohort.id, wave.id, "OPEN");
    for (let index = 0; index < enrollmentIds.length; index++) {
      const observation = await db.ventureObservation.findFirstOrThrow({ where: { organizationId: org.id, ventureEnrollmentId: enrollmentIds[index], followUpWaveId: wave.id }, select: { id: true, revision: true } });
      const values = [{ indicatorDefinitionId: revenue.id, value: "0.10" }, ...(index < 5 ? [{ indicatorDefinitionId: stage.id, value: index === 0 ? "Produto" : "Ideia" }] : [])];
      await saveObservationValues(org.id, observation.id, { expectedRevision: observation.revision, submit: true, values });
    }
    const project = await db.project.create({ data: { name: "PRIVATE_PROJECT", summary: "PRIVATE_PROJECT_SUMMARY", createdByUserId: user.id } }); projectIds.push(project.id);
    const application = await db.application.create({ data: { organizationId: org.id, fundingCallId: call.id, projectId: project.id, submittedByUserId: user.id, status: "DECIDED", submittedAt: new Date(), decision: "SELECTED", decidedAt: new Date(), decisionNote: "PRIVATE_DECISION_NOTE", projectNameSnapshot: "@PRIVATE_PROJECT", projectSummarySnapshot: "PRIVATE_PROJECT_SUMMARY" } });
    const award = await db.award.create({ data: { organizationId: org.id, fundingCallId: call.id, applicationId: application.id, createdByUserId: user.id, startsAt: new Date("2026-01-01T00:00:00Z"), approvedAmount: new Prisma.Decimal("1234.50"), statusHistory: { create: { toStatus: "PREPARING", awardRevision: 1, changedByUserId: user.id } } } });
    await db.award.update({ where: { id: award.id }, data: { status: "ACTIVE", revision: 2, activatedAt: new Date(), statusHistory: { create: { fromStatus: "PREPARING", toStatus: "ACTIVE", awardRevision: 2, changedByUserId: user.id } } } });
    await db.awardDisbursement.create({ data: { organizationId: org.id, awardId: award.id, label: "Installment", amount: new Prisma.Decimal("0.10"), createdByUserId: user.id, note: "PRIVATE_DISBURSEMENT_NOTE" } });
    const obligation = await db.awardObligation.create({ data: { organizationId: org.id, awardId: award.id, title: "Progress", type: "PROGRESS_REPORT", createdByUserId: user.id } });
    await db.awardSubmission.create({ data: { organizationId: org.id, awardId: award.id, obligationId: obligation.id, version: 1, summary: "PRIVATE_DRAFT_SUMMARY", details: "PRIVATE_DRAFT_DETAILS", createdByUserId: user.id } });
    const reviewedObligation = await db.awardObligation.create({ data: { organizationId: org.id, awardId: award.id, title: "Reviewed progress", type: "PROGRESS_REPORT", createdByUserId: user.id } });
    const reviewedSubmission = await db.awardSubmission.create({ data: { organizationId: org.id, awardId: award.id, obligationId: reviewedObligation.id, version: 1, summary: "PRIVATE_SUBMITTED_SUMMARY", details: "PRIVATE_SUBMITTED_DETAILS", createdByUserId: user.id } });
    await db.awardSubmission.update({ where: { id: reviewedSubmission.id }, data: { status: "SUBMITTED", revision: 2, submittedAt: new Date(), submittedByUserId: user.id } });
    await db.awardSubmission.update({ where: { id: reviewedSubmission.id }, data: { reviewStatus: "APPROVED", reviewedAt: new Date(), reviewedByUserId: user.id, internalNote: "PRIVATE_REVIEW_NOTE" } });

    const input = { type: "COHORT_LONGITUDINAL" as const, title: "Evidências observadas", cohortId: cohort.id };
    const preview = await previewAnalyticsReport(access, input);
    assert.equal(preview.type, "COHORT_LONGITUDINAL"); assert.equal(await db.analyticsReportSnapshot.count({ where: { organizationId: org.id } }), 0);
    const report = await generateAnalyticsReport(access, input);
    assert.equal(report.type, "COHORT_LONGITUDINAL");
    if (report.payload.type !== "COHORT_LONGITUDINAL") throw new Error("Unexpected report type");
    assert.equal(report.payload.cohort.waves[0].metrics.find((metric) => metric.metricId === revenue.metricDefinitionId)?.sum, "0.6");
    assert.equal(report.payload.scope.programId, program.id); assert.equal(report.payload.scope.callName, call.title);
    assert.equal(report.payload.cohort.waves[0].metrics.find((metric) => metric.metricId === stage.metricDefinitionId)?.missingCount, 1);

    await context.test("all predefined generators are typed and snapshots enforce tenant scope and database immutability", async () => {
      for (const type of ["PORTFOLIO_EXECUTIVE", "PROGRAM_SUMMARY", "DATA_QUALITY", "EXECUTION_SUMMARY"] as const) {
        const result = await generateAnalyticsReport(access, { type, title: `Report ${type}`, programId: type === "PROGRAM_SUMMARY" ? program.id : undefined });
        assert.equal(result.payload.type, type); assert.equal(result.analyticsSchemaVersion, 1);
      }
      await assert.rejects(() => generateAnalyticsReport(access, { ...input, payload: { raw: "USER_PAYLOAD" } } as typeof input), /Unrecognized key/);
      await assert.rejects(() => getAnalyticsReport(otherAccess, report.id), /ANALYTICS_REPORT_NOT_FOUND/);
      await assert.rejects(() => db.analyticsReportSnapshot.update({ where: { id: report.id }, data: { title: "Overwrite" } }), /REPORT_SNAPSHOT_IMMUTABLE/);
      await assert.rejects(() => db.analyticsReportSnapshot.delete({ where: { id: report.id } }), /REPORT_SNAPSHOT_IMMUTABLE/);
      assert.equal((await listAnalyticsReports(access)).length, 5);
      const scoped = await generateAnalyticsReport(access, { type: "DATA_QUALITY", title: "Qualidade do recorte", cohortId: cohort.id, callId: call.id, year: 2026, metricId: revenue.metricDefinitionId! });
      assert.equal(scoped.payload.scope.callName, call.title); assert.equal(scoped.payload.scope.year, 2026);
      assert.equal((await getAnalyticsReportSourceStatus(access, scoped.id)).stale, false);
    });

    await context.test("execution source digest follows Fortaleza deadline state while stored reports remain immutable", async () => {
      const executionReport = (await listAnalyticsReports(access)).find((record) => record.type === "EXECUTION_SUMMARY")!;
      await db.awardObligation.update({ where: { organizationId_awardId_id: { organizationId: org.id, awardId: award.id, id: obligation.id } }, data: { dueAt: new Date("2026-10-06T00:00:00Z"), revision: { increment: 1 } } });
      const before = await getAnalyticsSourceDigest(access, { programId: program.id }, db, "EXECUTION", new Date("2026-10-06T15:00:00Z"));
      const after = await getAnalyticsSourceDigest(access, { programId: program.id }, db, "EXECUTION", new Date("2026-10-07T15:00:00Z"));
      assert.notEqual(before, after);
      assert.equal(before, await getAnalyticsSourceDigest(access, { programId: program.id }, db, "EXECUTION", new Date("2026-10-06T15:00:00Z")));
      assert.deepEqual((await getAnalyticsReport(access, executionReport.id)).payload, executionReport.payload);
    });

    await context.test("long CSV includes missing indicator cells, exact decimals, safe text, scoped metadata and metadata-only audit", async () => {
      const exported = await createAnalyticsExport(access, { type: "COHORT_OBSERVATIONS", cohortId: cohort.id, metricId: revenue.metricDefinitionId! });
      assert.equal(exported.rowCount, 6); assert.ok(exported.csv.includes('"0.10"')); assert.ok(exported.csv.includes('"\'  =HYPERLINK'));
      const withMissing = await createAnalyticsExport(access, { type: "COHORT_OBSERVATIONS", cohortId: cohort.id });
      assert.equal(withMissing.rowCount, 12);
      const missingLine = withMissing.csv.split("\r\n").find((line) => line.includes("PRIVATE_VENTURE_5") && line.includes('"stage"'))!;
      assert.ok(missingLine.includes('"true";"";"ENUM"'));
      for (const type of ["COHORT_AGGREGATES", "PROGRAM_SUMMARY", "EXECUTION_SUMMARY", "APPLICATIONS_SUMMARY", "PORTFOLIO_SUMMARY"] as const) {
        const result = await createAnalyticsExport(access, { type, cohortId: type === "COHORT_AGGREGATES" ? cohort.id : undefined, programId: type === "PROGRAM_SUMMARY" ? program.id : undefined });
        assert.ok(result.csv.includes('"data_as_of"')); assert.ok(result.csv.includes('"source_digest"'));
        for (const secret of ["PRIVATE_DECISION_NOTE", "PRIVATE_DISBURSEMENT_NOTE", "PRIVATE_DRAFT_SUMMARY", "PRIVATE_DRAFT_DETAILS", "PRIVATE_REVIEW_NOTE", user.email]) assert.equal(result.csv.includes(secret), false, secret);
      }
      const audit = await db.dataExportAudit.findUniqueOrThrow({ where: { id: exported.auditId } });
      assert.equal(audit.rowCount, 6); assert.equal(audit.format, "CSV"); assert.equal(audit.scopeType, "COHORT"); assert.equal(audit.scopeId, cohort.id); assert.equal(audit.exportedByUserId, user.id);
      assert.equal(Object.hasOwn(audit, "csv"), false);
      await assert.rejects(() => db.dataExportAudit.update({ where: { id: audit.id }, data: { rowCount: 0 } }), /EXPORT_AUDIT_IMMUTABLE/);
      await assert.rejects(() => createAnalyticsExport(otherAccess, { type: "COHORT_OBSERVATIONS", cohortId: cohort.id }), /COHORT_NOT_FOUND/);
      const narrowed = await createAnalyticsExport(access, { type: "PORTFOLIO_SUMMARY", callId: call.id, year: 2026 });
      const narrowAudit = await db.dataExportAudit.findUniqueOrThrow({ where: { id: narrowed.auditId } });
      assert.deepEqual(narrowAudit.parameters, { type: "PORTFOLIO_SUMMARY", callId: call.id, year: 2026 });
    });

    await context.test("raw observation export digest tracks exported venture names without changing aggregate report provenance", async () => {
      const filters = { cohortId: cohort.id, metricId: revenue.metricDefinitionId! };
      const aggregateBefore = await getAnalyticsSourceDigest(access, filters, db, "COHORT");
      const before = await createAnalyticsExport(access, { type: "COHORT_OBSERVATIONS", ...filters });
      const enrollment = await db.ventureEnrollment.findFirstOrThrow({ where: { organizationId: org.id, id: enrollmentIds[0] }, select: { ventureId: true } });
      await db.venture.update({ where: { organizationId_id: { organizationId: org.id, id: enrollment.ventureId } }, data: { name: "Renamed private venture" } });
      const after = await createAnalyticsExport(access, { type: "COHORT_OBSERVATIONS", ...filters });
      const [beforeAudit, afterAudit] = await Promise.all([before, after].map((result) => db.dataExportAudit.findUniqueOrThrow({ where: { id: result.auditId } })));
      assert.notEqual(beforeAudit.sourceDigest, afterAudit.sourceDigest); assert.ok(after.csv.includes("Renamed private venture"));
      assert.equal(await getAnalyticsSourceDigest(access, filters, db, "COHORT"), aggregateBefore);
      assert.equal((await getAnalyticsReportSourceStatus(access, report.id)).stale, false);
      assert.deepEqual((await getAnalyticsReport(access, report.id)).payload, report.payload);
    });

    const publicPreview = await previewPublicResult(access, report.id);
    const slug = `report-results-${suffix}`;
    await context.test("only exact manager-approved sanitized snapshots become public and cross-tenant report substitution fails", async () => {
      assert.equal((await getAnalyticsSettings(access)).publicMinimumCellSize, 5);
      const serialized = JSON.stringify(publicPreview.payload);
      for (const secret of ["PRIVATE_VENTURE", "PRIVATE_PROJECT", "PRIVATE_DECISION", "PRIVATE_DRAFT", user.email, wave.id, revenue.id, cohort.id, application.id, award.id]) assert.equal(serialized.includes(secret), false, secret);
      assert.ok(serialized.includes("0.6"));
      assert.equal(publicPreview.payload.sections.find((section) => section.title.endsWith("Estágio"))?.suppressed, true);
      assert.equal(await getPublicResult(slug), null);
      await assert.rejects(() => publishPublicResult(access, report.id, { slug, title: "Resultados observados", previewDigest: "0".repeat(64) }), /ANALYTICS_PUBLIC_PREVIEW_CHANGED/);
      await assert.rejects(() => publishPublicResult(otherAccess, report.id, { slug, title: "Resultados observados", previewDigest: publicPreview.digest }), /ANALYTICS_REPORT_NOT_FOUND/);
      await assert.rejects(() => db.publicResultPublication.create({ data: { organizationId: other.id, reportSnapshotId: report.id, slug: `${slug}-cross`, title: "Cross tenant", publicPayload: publicPreview.payload as unknown as Prisma.InputJsonObject, publicPayloadDigest: publicPreview.digest, createdByUserId: user.id } }));
      const draft = await db.publicResultPublication.create({ data: { organizationId: org.id, reportSnapshotId: report.id, slug: `${slug}-draft`, title: "Unpublished", publicPayload: publicPreview.payload as unknown as Prisma.InputJsonObject, publicPayloadDigest: publicPreview.digest, createdByUserId: user.id } });
      assert.equal(await getPublicResult(draft.slug), null);
      await updateAnalyticsSettings(access, { publicMinimumCellSize: 6 });
      await assert.rejects(() => publishPublicResult(access, report.id, { slug, title: "Resultados observados", previewDigest: publicPreview.digest }), /ANALYTICS_PUBLIC_PREVIEW_CHANGED/);
      await assert.rejects(() => updateAnalyticsSettings(access, { publicMinimumCellSize: 1 }));
      await updateAnalyticsSettings(access, { publicMinimumCellSize: 5 });
    });

    const publication = await publishPublicResult(access, report.id, { slug, title: "Resultados observados", summary: "Evidências registradas pela instituição.", previewDigest: publicPreview.digest });
    await context.test("source changes create staleness without mutating report or public payload; unpublish preserves history", async () => {
      const publishedBefore = await getPublicResult(slug); assert.ok(publishedBefore);
      assert.equal((await listPublicResults()).some((record) => record.slug === slug), true);
      assert.equal((await getAnalyticsReportSourceStatus(access, report.id)).stale, false);
      await createFollowUpWave(org.id, cohort.id, { name: "New follow-up", kind: "FOLLOW_UP", sequence: 1, offsetMonths: 6, scheduledFor: new Date("2026-07-01T00:00:00Z") });
      assert.equal((await getAnalyticsReportSourceStatus(access, report.id)).stale, true);
      assert.deepEqual((await getAnalyticsReport(access, report.id)).payload, report.payload);
      const updated = await generateAnalyticsReport(access, { ...input, supersedesId: report.id });
      assert.equal(updated.supersedesId, report.id); assert.notEqual(updated.id, report.id);
      await updateAnalyticsSettings(access, { publicMinimumCellSize: 10 });
      assert.deepEqual(await getPublicResult(slug), publishedBefore);
      await assert.rejects(() => db.publicResultPublication.update({ where: { id: publication.id }, data: { publicPayloadDigest: "0".repeat(64) } }), /PUBLIC_PAYLOAD_IMMUTABLE/);
      await archiveAnalyticsReport(access, report.id);
      assert.ok((await getAnalyticsReport(access, report.id)).archivedAt); assert.ok(await getPublicResult(slug));
      await unpublishPublicResult(access, publication.id);
      assert.equal(await getPublicResult(slug), null);
      assert.equal((await listPublicResults()).some((record) => record.slug === slug), false);
      assert.ok(await db.analyticsReportSnapshot.findUnique({ where: { id: report.id } }));
      await assert.rejects(() => db.publicResultPublication.update({ where: { id: publication.id }, data: { unpublishedAt: null } }), /PUBLICATION_HISTORY_IMMUTABLE/);
    });

    await context.test("oversized long-format scope is rejected before cell loading and no export audit is recorded", async () => {
      const boundedProtocol = await db.trackingProtocol.create({ data: { organizationId: org.id, name: "Bounded export protocol", slug: `bounded-${suffix}` } });
      const boundedVersion = await db.trackingProtocolVersion.create({ data: { organizationId: org.id, trackingProtocolId: boundedProtocol.id, version: 1 } });
      await db.indicatorDefinition.createMany({ data: Array.from({ length: 400 }, (_, index) => ({ organizationId: org.id, trackingProtocolVersionId: boundedVersion.id, key: `bounded_${index}`, label: `Bounded ${index}`, valueType: "INTEGER" as const, position: index })) });
      const largeCohort = await db.cohort.create({ data: { organizationId: org.id, fundingProgramId: program.id, trackingProtocolVersionId: boundedVersion.id, name: "Bounded export cohort" } });
      const largeWave = await db.followUpWave.create({ data: { organizationId: org.id, cohortId: largeCohort.id, name: "Bounded baseline", kind: "BASELINE", sequence: 0, offsetMonths: 0, scheduledFor: new Date("2026-01-01T00:00:00Z") } });
      await db.venture.createMany({ data: Array.from({ length: 126 }, (_, index) => ({ id: `bounded-venture-${suffix}-${index}`, organizationId: org.id, name: `Bounded venture ${index}`, kind: "PROJECT" as const })) });
      await db.ventureEnrollment.createMany({ data: Array.from({ length: 126 }, (_, index) => ({ id: `bounded-enrollment-${suffix}-${index}`, organizationId: org.id, cohortId: largeCohort.id, ventureId: `bounded-venture-${suffix}-${index}`, enrolledAt: new Date("2026-01-01T00:00:00Z") })) });
      await db.ventureObservation.createMany({ data: Array.from({ length: 126 }, (_, index) => ({ organizationId: org.id, cohortId: largeCohort.id, followUpWaveId: largeWave.id, ventureEnrollmentId: `bounded-enrollment-${suffix}-${index}`, status: "SUBMITTED" as const, submittedAt: new Date("2026-01-02T00:00:00Z") })) });
      const auditCount = await db.dataExportAudit.count({ where: { organizationId: org.id } });
      await assert.rejects(() => createAnalyticsExport(access, { type: "COHORT_OBSERVATIONS", cohortId: largeCohort.id }), /ANALYTICS_EXPORT_ROW_LIMIT/);
      assert.equal(await db.dataExportAudit.count({ where: { organizationId: org.id } }), auditCount);
      for (let index = 0; index < 6; index++) {
        const metric = await db.metricDefinition.create({ data: { organizationId: org.id, key: `bounded_metric_${index}`, label: `Bounded metric ${index}`, valueType: "INTEGER", primaryAggregation: "TOTAL" } });
        await db.indicatorDefinition.update({ where: { organizationId_trackingProtocolVersionId_key: { organizationId: org.id, trackingProtocolVersionId: boundedVersion.id, key: `bounded_${index}` } }, data: { metricDefinitionId: metric.id } });
      }
      const reportCount = await db.analyticsReportSnapshot.count({ where: { organizationId: org.id } });
      await assert.rejects(() => generateAnalyticsReport(access, { type: "PORTFOLIO_EXECUTIVE", title: "Too many executive metrics" }), /ANALYTICS_EXECUTIVE_METRIC_LIMIT/);
      assert.equal(await db.analyticsReportSnapshot.count({ where: { organizationId: org.id } }), reportCount);
      await generateAnalyticsReport(access, { type: "PORTFOLIO_EXECUTIVE", title: "Selected executive metric", metricId: revenue.metricDefinitionId! });
    });

    await context.test("current role and disabled membership govern every institutional capability", async () => {
      await db.organizationMembership.update({ where: { organizationId_userId: { organizationId: org.id, userId: user.id } }, data: { role: "VIEWER" } });
      await getAnalyticsReport(access, report.id);
      await assert.rejects(() => generateAnalyticsReport(access, input), /ROLE_FORBIDDEN/);
      await assert.rejects(() => createAnalyticsExport(access, { type: "COHORT_OBSERVATIONS", cohortId: cohort.id }), /ROLE_FORBIDDEN/);
      await assert.rejects(() => getAnalyticsSettings(access), /ROLE_FORBIDDEN/);
      await db.organizationMembership.update({ where: { organizationId_userId: { organizationId: org.id, userId: user.id } }, data: { role: "ANALYST" } });
      await createAnalyticsExport(access, { type: "COHORT_AGGREGATES", cohortId: cohort.id });
      await generateAnalyticsReport(access, input);
      await assert.rejects(() => previewPublicResult(access, report.id), /ROLE_FORBIDDEN/);
      await assert.rejects(() => unpublishPublicResult(access, publication.id), /ROLE_FORBIDDEN/);
      await db.organizationMembership.update({ where: { organizationId_userId: { organizationId: org.id, userId: user.id } }, data: { status: "DISABLED" } });
      await assert.rejects(() => getAnalyticsReport(access, report.id), /MEMBERSHIP_DISABLED/);
    });

    await context.test("oversized current sources preserve stored report access without swallowing authorization failures", async () => {
      await db.organizationMembership.update({ where: { organizationId_userId: { organizationId: org.id, userId: user.id } }, data: { role: "MANAGER", status: "ACTIVE" } });
      await db.followUpWave.createMany({ data: Array.from({ length: 500 }, (_, index) => ({ organizationId: org.id, cohortId: cohort.id, name: `Bounded current source ${index}`, kind: "FOLLOW_UP" as const, sequence: index + 2, scheduledFor: new Date("2026-10-01T00:00:00Z") })) });
      const source = await getAnalyticsReportSourceStatus(access, report.id);
      assert.deepEqual(source, { available: false, stale: null, sourceDigest: report.sourceDigest, currentDigest: null, reason: "SOURCE_SCOPE_TOO_LARGE" });
      assert.deepEqual((await getAnalyticsReport(access, report.id)).payload, report.payload);
      await assert.rejects(() => getAnalyticsReportSourceStatus(otherAccess, report.id), /ANALYTICS_REPORT_NOT_FOUND/);
      await db.organizationMembership.update({ where: { organizationId_userId: { organizationId: org.id, userId: user.id } }, data: { status: "DISABLED" } });
      await assert.rejects(() => getAnalyticsReportSourceStatus(access, report.id), /MEMBERSHIP_DISABLED/);
    });
  } finally {
    await db.organization.delete({ where: { id: org.id } });
    await db.organization.delete({ where: { id: other.id } });
    await db.project.deleteMany({ where: { id: { in: projectIds } } });
    await db.user.delete({ where: { id: user.id } });
    await db.$disconnect();
  }
});
