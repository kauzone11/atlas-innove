import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { db } from "@/lib/db";
import { createCohort } from "@/lib/cohorts/service";
import { createFollowUpWave } from "@/lib/follow-up/service";
import { updateFundingCall } from "@/lib/funding-calls/service";
import { createProject, createTeam, getProject, updateProject } from "@/lib/participants/service";
import {
  createPersonalApplication, updatePersonalApplication, submitPersonalApplication, withdrawPersonalApplication,
  getPersonalApplication, listPersonalApplications, listPersonalOpportunities, listCallApplications, getCallApplication,
  requireInstitutionApplicationAccess,
  createCallCriterion, updateCallCriterion, deleteCallCriterion, reorderCallCriteria, saveApplicationEvaluation,
  getCallRanking, decideCallApplications, publishCallResults, getCallEnrollmentPreview, enrollCallApplications,
} from "@/lib/selection/service";
import { createProtocolVersion } from "@/lib/tracking-protocols/service";

test("selection connects private participants to tenant-scoped frozen evaluation and longitudinal tracking", async (context) => {
  if (!process.env.DATABASE_URL) {
    assert.notEqual(process.env.CI, "true", "CI requires DATABASE_URL for selection integration tests");
    context.skip("DATABASE_URL is required for PostgreSQL proof");
    return;
  }
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const userIds: string[] = [];
  const organizationIds: string[] = [];
  const projectIds: string[] = [];
  const teamIds: string[] = [];
  try {
    const users = [];
    for (const label of ["participant", "outsider", "manager-a", "manager-b", "analyst-one", "analyst-two"]) {
      const user = await db.user.create({ data: { email: `selection-${label}-${suffix}@example.test`, passwordHash: "test-only", profile: { create: { fullName: label } } } });
      users.push(user);
      userIds.push(user.id);
    }
    const [participant, outsider, managerA, managerB, analystOne, analystTwo] = users;
    const organizationA = await db.organization.create({ data: { name: "Selection institution A", slug: `selection-a-${suffix}` } });
    organizationIds.push(organizationA.id);
    const organizationB = await db.organization.create({ data: { name: "Selection institution B", slug: `selection-b-${suffix}` } });
    organizationIds.push(organizationB.id);
    const [programA, programB] = await Promise.all([organizationA, organizationB].map((organization, index) => db.fundingProgram.create({ data: { organizationId: organization.id, createdByUserId: index ? managerB.id : managerA.id, name: "Innovation program", slug: `selection-${suffix}`, status: "ACTIVE" } })));
    await db.organizationMembership.createMany({ data: [
      { organizationId: organizationA.id, userId: managerA.id, role: "MANAGER" },
      { organizationId: organizationB.id, userId: managerB.id, role: "MANAGER" },
      { organizationId: organizationA.id, userId: analystOne.id, role: "ANALYST" },
      { organizationId: organizationA.id, userId: analystTwo.id, role: "ANALYST" },
    ] });
    const callA = await db.fundingCall.create({ data: { organizationId: organizationA.id, fundingProgramId: programA.id, title: "Selection call A", callNumber: "A", status: "OPEN", publicListingEnabled: true, applicationsEnabled: true } });
    const callA2 = await db.fundingCall.create({ data: { organizationId: organizationA.id, fundingProgramId: programA.id, title: "Second cycle", callNumber: "A2", status: "OPEN", publicListingEnabled: true, applicationsEnabled: true } });
    const callB = await db.fundingCall.create({ data: { organizationId: organizationB.id, fundingProgramId: programB.id, title: "Selection call B", callNumber: "B", status: "OPEN", publicListingEnabled: true, applicationsEnabled: true } });
    const disabled = await db.fundingCall.create({ data: { organizationId: organizationA.id, fundingProgramId: programA.id, title: "Externally tracked call", callNumber: "disabled", status: "OPEN", publicListingEnabled: true } });
    const expired = await db.fundingCall.create({ data: { organizationId: organizationA.id, fundingProgramId: programA.id, title: "Expired applications", callNumber: "expired", status: "OPEN", publicListingEnabled: true, applicationsEnabled: true, applicationEndsAt: new Date(Date.now() - 3 * 86400000) } });
    const future = await db.fundingCall.create({ data: { organizationId: organizationA.id, fundingProgramId: programA.id, title: "Future applications", callNumber: "future", status: "OPEN", publicListingEnabled: true, applicationsEnabled: true, applicationStartsAt: new Date(Date.now() + 3 * 86400000) } });
    const team = await createTeam(participant.id, { name: "Persistent participants" });
    teamIds.push(team.id);
    const projects = [];
    for (const name of ["Alpha project", "Beta project", "Gamma unscored", "Withdrawn project", "Concurrent project", "Late project"]) {
      const project = await createProject(participant.id, { name, summary: `${name} develops a durable innovation initiative.`, primaryTeamId: team.id });
      projects.push(project);
      projectIds.push(project.id);
    }
    const [alpha, beta, gamma, withdrawing, concurrent, late] = projects;

    await context.test("eligible calls and private project access are enforced without institutional membership", async () => {
      assert.equal(await db.organizationMembership.count({ where: { userId: participant.id } }), 0);
      await assert.rejects(() => createPersonalApplication(outsider.id, { projectId: alpha.id, fundingCallId: callA.id }), /PROJECT_NOT_FOUND/);
      await assert.rejects(() => createPersonalApplication(participant.id, { projectId: alpha.id, fundingCallId: callB.id, organizationId: organizationA.id }), /TENANT_SCOPE_MISMATCH/);
      await assert.rejects(() => createPersonalApplication(participant.id, { projectId: alpha.id, fundingCallId: disabled.id }), /APPLICATION_CALL_NOT_OPEN/);
      await assert.rejects(() => createPersonalApplication(participant.id, { projectId: alpha.id, fundingCallId: expired.id }), /APPLICATION_DEADLINE_PASSED/);
      await assert.rejects(() => createPersonalApplication(participant.id, { projectId: alpha.id, fundingCallId: future.id }), /APPLICATION_WINDOW_NOT_STARTED/);
      assert.equal(await getProject(managerA.id, alpha.id), null);
      const opportunities = await listPersonalOpportunities(participant.id);
      assert.equal(opportunities.find((entry) => entry.id === callA.id)?.canApply, true);
      assert.equal(opportunities.find((entry) => entry.id === disabled.id)?.canApply, false);
    });

    let alphaApplication = await createPersonalApplication(participant.id, { projectId: alpha.id, fundingCallId: callA.id });
    const betaApplication = await createPersonalApplication(participant.id, { projectId: beta.id, fundingCallId: callA.id });
    const gammaApplication = await createPersonalApplication(participant.id, { projectId: gamma.id, fundingCallId: callA.id });
    const withdrawalApplication = await createPersonalApplication(participant.id, { projectId: withdrawing.id, fundingCallId: callA.id });
    const concurrentApplication = await createPersonalApplication(participant.id, { projectId: concurrent.id, fundingCallId: callA.id });
    const lateApplication = await createPersonalApplication(participant.id, { projectId: late.id, fundingCallId: expired.id }).catch(() => null);
    assert.equal(lateApplication, null);
    const applicationB = await createPersonalApplication(participant.id, { projectId: alpha.id, fundingCallId: callB.id });
    const applicationA2 = await createPersonalApplication(participant.id, { projectId: alpha.id, fundingCallId: callA2.id });

    await context.test("withdrawing an unsubmitted draft preserves participant history without exposing it to the institution", async () => {
      const draft = await createPersonalApplication(participant.id, { projectId: late.id, fundingCallId: callA.id });
      const withdrawn = await withdrawPersonalApplication(participant.id, draft.id, draft.revision);
      assert.equal(withdrawn.status, "WITHDRAWN");
      assert.equal(withdrawn.submittedAt, null);
      assert.ok(withdrawn.withdrawnAt);
      assert.equal((await getPersonalApplication(participant.id, draft.id))?.projectNameSnapshot, late.name);
      assert.equal(await getCallApplication(organizationA.id, programA.id, callA.id, draft.id, managerA.id), null);
      assert.equal((await listCallApplications(organizationA.id, programA.id, callA.id, "", managerA.id)).some((record) => record.id === draft.id), false);
      assert.equal((await getCallRanking(organizationA.id, programA.id, callA.id, managerA.id)).some((record) => record.id === draft.id), false);
      await assert.rejects(() => requireInstitutionApplicationAccess(managerA.id, organizationA.id, programA.id, callA.id, draft.id), /APPLICATION_NOT_FOUND/);
    });

    await context.test("draft revision, frozen submission, cross-tenant privacy and live identity edits preserve history", async () => {
      assert.equal(await getPersonalApplication(outsider.id, alphaApplication.id), null);
      assert.deepEqual(await listPersonalApplications(outsider.id), []);
      assert.deepEqual(await listCallApplications(organizationA.id, programA.id, callA.id), []);
      alphaApplication = await updatePersonalApplication(participant.id, alphaApplication.id, { revision: 0, projectNameSnapshot: "Frozen Alpha submission", projectSummarySnapshot: "The institution receives this exact submitted information." });
      await assert.rejects(() => updatePersonalApplication(participant.id, alphaApplication.id, { revision: 0, projectNameSnapshot: "Stale" }), /APPLICATION_REVISION_CONFLICT/);
      alphaApplication = await submitPersonalApplication(participant.id, alphaApplication.id, alphaApplication.revision);
      await assert.rejects(() => updatePersonalApplication(participant.id, alphaApplication.id, { revision: alphaApplication.revision, projectNameSnapshot: "Overwrite history" }), /APPLICATION_SNAPSHOT_FROZEN/);
      await assert.rejects(() => db.application.update({ where: { id: alphaApplication.id }, data: { projectSummarySnapshot: "Direct overwrite" } }));
      await updateProject(participant.id, alpha.id, { name: "Alpha live identity changed", summary: "Live progress may change without overwriting submitted history." });
      assert.equal((await getPersonalApplication(participant.id, alphaApplication.id))?.projectNameSnapshot, "Frozen Alpha submission");
      await submitPersonalApplication(participant.id, applicationB.id, applicationB.revision);
      assert.equal(await getCallApplication(organizationA.id, programA.id, callA.id, applicationB.id, managerA.id), null);
      assert.equal(await getCallApplication(organizationB.id, programB.id, callB.id, alphaApplication.id, managerB.id), null);
      const institution = await getCallApplication(organizationA.id, programA.id, callA.id, alphaApplication.id, managerA.id);
      assert.ok(institution);
      assert.equal("projectId" in institution, false);
      assert.equal("passwordHash" in institution, false);
    });

    await context.test("concurrent draft update and submission reject stale writes and withdrawal keeps history", async () => {
      const results = await Promise.allSettled([
        updatePersonalApplication(participant.id, concurrentApplication.id, { revision: 0, projectSummarySnapshot: "Concurrent draft content with a preserved revision." }),
        submitPersonalApplication(participant.id, concurrentApplication.id, 0),
      ]);
      assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
      let state = await getPersonalApplication(participant.id, concurrentApplication.id);
      assert.ok(state);
      if (state.status === "DRAFT") state = await submitPersonalApplication(participant.id, state.id, state.revision);
      assert.equal(state.status, "SUBMITTED");
      const submitted = await submitPersonalApplication(participant.id, withdrawalApplication.id, 0);
      const withdrawn = await withdrawPersonalApplication(participant.id, submitted.id, submitted.revision);
      assert.equal(withdrawn.status, "WITHDRAWN");
      assert.ok(withdrawn.withdrawnAt);
      assert.ok(withdrawn.submittedAt);
      await submitPersonalApplication(participant.id, betaApplication.id, 0);
      await submitPersonalApplication(participant.id, gammaApplication.id, 0);
      await submitPersonalApplication(participant.id, applicationA2.id, 0);
    });

    const criterionOne = await createCallCriterion(organizationA.id, programA.id, callA.id, managerA.id, { name: "Technical merit", weight: "3", maxScore: "10", position: 0 });
    const criterionTwo = await createCallCriterion(organizationA.id, programA.id, callA.id, managerA.id, { name: "Potential value", weight: "1", maxScore: "5", position: 1 });
    const foreignCriterion = await createCallCriterion(organizationB.id, programB.id, callB.id, managerB.id, { name: "Other call criterion", weight: "1", maxScore: "10", position: 0 });
    await context.test("criterion administration validates values and draft evaluations freeze call criteria", async () => {
      await assert.rejects(() => createCallCriterion(organizationA.id, programA.id, callA.id, analystOne.id, { name: "Unauthorized", weight: "1", maxScore: "10", position: 2 }), /ROLE_FORBIDDEN/);
      await assert.rejects(() => createCallCriterion(organizationA.id, programA.id, callA.id, managerA.id, { name: "Invalid weight", weight: "0", maxScore: "10", position: 2 }));
      await assert.rejects(() => createCallCriterion(organizationA.id, programA.id, callA.id, managerA.id, { name: "Invalid maximum", weight: "1", maxScore: "0", position: 2 }));
      await updateCallCriterion(organizationA.id, programA.id, callA.id, managerA.id, criterionTwo.id, { name: "Potential value revised", weight: "1", maxScore: "5", position: 1 });
      await assert.rejects(() => reorderCallCriteria(organizationA.id, programA.id, callA.id, managerA.id, [criterionOne.id, foreignCriterion.id]), /EVALUATION_CRITERIA_ORDER_INVALID/);
      assert.deepEqual((await reorderCallCriteria(organizationA.id, programA.id, callA.id, managerA.id, [criterionTwo.id, criterionOne.id])).map((criterion) => criterion.id), [criterionTwo.id, criterionOne.id]);
      await updateFundingCall(organizationA.id, programA.id, callA.id, { status: "IN_REVIEW" });
      const draft = await saveApplicationEvaluation(organizationA.id, programA.id, callA.id, alphaApplication.id, analystOne.id, { revision: 0, scores: [{ criterionId: criterionOne.id, score: "8" }], submit: false });
      assert.equal(draft.status, "DRAFT");
      assert.equal((await getCallRanking(organizationA.id, programA.id, callA.id)).find((row) => row.id === alphaApplication.id)?.score, null);
      await assert.rejects(() => updateCallCriterion(organizationA.id, programA.id, callA.id, managerA.id, criterionOne.id, { name: "Changed scoring", weight: "5", maxScore: "10", position: 0 }), /EVALUATION_CRITERIA_FROZEN/);
      await assert.rejects(() => deleteCallCriterion(organizationA.id, programA.id, callA.id, managerA.id, criterionOne.id), /EVALUATION_CRITERIA_FROZEN/);
      await assert.rejects(() => reorderCallCriteria(organizationA.id, programA.id, callA.id, managerA.id, [criterionOne.id, criterionTwo.id]), /EVALUATION_CRITERIA_FROZEN/);
      await assert.rejects(() => db.evaluationCriterion.update({ where: { id: criterionOne.id }, data: { weight: "7" } }));
    });

    await context.test("evaluation permissions, completeness, call scope and submitted history fail closed", async () => {
      const validScores = [{ criterionId: criterionOne.id, score: "8", comment: "Technical evidence" }, { criterionId: criterionTwo.id, score: "4" }];
      await assert.rejects(() => saveApplicationEvaluation(organizationA.id, programA.id, callA.id, alphaApplication.id, managerB.id, { revision: 0, scores: validScores, submit: true }), /ORGANIZATION_ACCESS_DENIED/);
      await assert.rejects(() => saveApplicationEvaluation(organizationA.id, programA.id, callA.id, applicationB.id, analystOne.id, { revision: 0, scores: validScores, submit: true }), /APPLICATION_NOT_EVALUABLE/);
      await assert.rejects(() => saveApplicationEvaluation(organizationA.id, programA.id, callA.id, alphaApplication.id, analystOne.id, { revision: 1, scores: [validScores[0]], submit: true }), /EVALUATION_INCOMPLETE/);
      await assert.rejects(() => saveApplicationEvaluation(organizationA.id, programA.id, callA.id, alphaApplication.id, analystOne.id, { revision: 1, scores: [validScores[0], validScores[0]], submit: true }), /EVALUATION_CRITERION_DUPLICATE/);
      await assert.rejects(() => saveApplicationEvaluation(organizationA.id, programA.id, callA.id, alphaApplication.id, analystOne.id, { revision: 1, scores: [{ criterionId: foreignCriterion.id, score: "8" }], submit: false }), /EVALUATION_CRITERION_CALL_MISMATCH/);
      await assert.rejects(() => saveApplicationEvaluation(organizationA.id, programA.id, callA.id, alphaApplication.id, analystOne.id, { revision: 1, scores: [{ criterionId: criterionOne.id, score: "11" }], submit: false }), /EVALUATION_SCORE_RANGE_INVALID/);
      const submitted = await saveApplicationEvaluation(organizationA.id, programA.id, callA.id, alphaApplication.id, analystOne.id, { revision: 1, scores: validScores, submit: true });
      assert.equal(submitted.status, "SUBMITTED");
      await assert.rejects(() => saveApplicationEvaluation(organizationA.id, programA.id, callA.id, alphaApplication.id, analystOne.id, { revision: submitted.revision, scores: validScores, submit: false }), /EVALUATION_SUBMITTED_IMMUTABLE/);
      await assert.rejects(() => db.applicationEvaluationScore.updateMany({ where: { evaluationId: submitted.id }, data: { score: "0" } }));
      await assert.rejects(() => db.applicationEvaluationScore.deleteMany({ where: { evaluationId: submitted.id } }));
      await assert.rejects(() => db.applicationEvaluation.update({ where: { id: submitted.id }, data: { status: "DRAFT" } }));
      await assert.rejects(() => db.applicationEvaluationScore.create({ data: { organizationId: organizationA.id, fundingCallId: callA.id, evaluationId: submitted.id, criterionId: foreignCriterion.id, score: "8" } }));
      const one = await getCallApplication(organizationA.id, programA.id, callA.id, alphaApplication.id, analystOne.id);
      assert.equal(one?.ownEvaluation?.id, submitted.id);
      assert.deepEqual(one?.evaluations, []);
      assert.equal((await getCallApplication(organizationA.id, programA.id, callA.id, alphaApplication.id, analystTwo.id))?.ownEvaluation, null);
      const concurrentEvaluation = await Promise.allSettled(["8", "9"].map((score) => saveApplicationEvaluation(organizationA.id, programA.id, callA.id, betaApplication.id, analystOne.id, { revision: 0, scores: [{ criterionId: criterionOne.id, score }, { criterionId: criterionTwo.id, score: "4.5" }], submit: false })));
      assert.equal(concurrentEvaluation.filter((result) => result.status === "fulfilled").length, 1);
      const betaDraft = await db.applicationEvaluation.findUniqueOrThrow({ where: { organizationId_applicationId_evaluatorUserId: { organizationId: organizationA.id, applicationId: betaApplication.id, evaluatorUserId: analystOne.id } } });
      await saveApplicationEvaluation(organizationA.id, programA.id, callA.id, betaApplication.id, analystOne.id, { revision: betaDraft.revision, scores: [{ criterionId: criterionOne.id, score: "9" }, { criterionId: criterionTwo.id, score: "4.5" }], submit: true });
      await saveApplicationEvaluation(organizationA.id, programA.id, callA.id, alphaApplication.id, analystTwo.id, { revision: 0, scores: [{ criterionId: criterionOne.id, score: "10" }, { criterionId: criterionTwo.id, score: "5" }], submit: true });
    });

    await context.test("ranking uses submitted normalized weighted averages, ties and absent scores without deciding", async () => {
      const ranking = await getCallRanking(organizationA.id, programA.id, callA.id);
      const alphaRank = ranking.find((entry) => entry.id === alphaApplication.id);
      const betaRank = ranking.find((entry) => entry.id === betaApplication.id);
      assert.equal(alphaRank?.score, 90);
      assert.equal(alphaRank?.evaluationCount, 2);
      assert.equal(betaRank?.score, 90);
      assert.equal(betaRank?.evaluationCount, 1);
      assert.equal(alphaRank?.tied, true);
      assert.equal(betaRank?.tied, true);
      assert.equal(alphaRank?.position, 1);
      assert.equal(betaRank?.position, 1);
      assert.equal(ranking.find((entry) => entry.id === gammaApplication.id)?.score, null);
      assert.equal(ranking.find((entry) => entry.id === gammaApplication.id)?.position, null);
      assert.equal(ranking.some((entry) => entry.id === withdrawalApplication.id), false);
      assert.ok(ranking.every((entry) => entry.decision === "PENDING"));
    });

    await context.test("decisions are explicit, private until publication and hide internal notes from participants", async () => {
      await assert.rejects(() => publishCallResults(organizationA.id, programA.id, callA.id, managerA.id), /APPLICATION_DECISIONS_INCOMPLETE/);
      await assert.rejects(() => decideCallApplications(organizationA.id, programA.id, callA.id, analystOne.id, { applicationIds: [alphaApplication.id], decision: "SELECTED" }), /ROLE_FORBIDDEN/);
      await assert.rejects(() => decideCallApplications(organizationA.id, programA.id, callA.id, managerA.id, { applicationIds: [applicationB.id], decision: "SELECTED" }), /APPLICATION_DECISION_SCOPE_INVALID/);
      await decideCallApplications(organizationA.id, programA.id, callA.id, managerA.id, { applicationIds: [alphaApplication.id], decision: "SELECTED", decisionNote: "Internal committee rationale" });
      await decideCallApplications(organizationA.id, programA.id, callA.id, managerA.id, { applicationIds: [betaApplication.id], decision: "WAITLIST" });
      await decideCallApplications(organizationA.id, programA.id, callA.id, managerA.id, { applicationIds: [gammaApplication.id, concurrentApplication.id], decision: "NOT_SELECTED" });
      const unpublished = await getPersonalApplication(participant.id, alphaApplication.id);
      assert.equal(unpublished?.decision, null);
      assert.equal(JSON.stringify(unpublished).includes("Internal committee rationale"), false);
      assert.equal("decisionNote" in (unpublished ?? {}), false);
      assert.equal((await getCallApplication(organizationA.id, programA.id, callA.id, alphaApplication.id, managerA.id))?.decisionNote, "Internal committee rationale");
      assert.equal((await getCallApplication(organizationA.id, programA.id, callA.id, alphaApplication.id, analystOne.id))?.decisionNote, null);
      assert.equal((await listCallApplications(organizationA.id, programA.id, callA.id, "", managerA.id)).find((record) => record.id === alphaApplication.id)?.decisionNote, "Internal committee rationale");
      assert.equal((await listCallApplications(organizationA.id, programA.id, callA.id, "", analystOne.id)).find((record) => record.id === alphaApplication.id)?.decisionNote, null);
      assert.equal((await listCallApplications(organizationA.id, programA.id, callA.id)).find((record) => record.id === alphaApplication.id)?.decisionNote, null);
      assert.equal((await getCallRanking(organizationA.id, programA.id, callA.id, managerA.id)).find((record) => record.id === alphaApplication.id)?.decisionNote, "Internal committee rationale");
      assert.equal((await getCallRanking(organizationA.id, programA.id, callA.id, analystOne.id)).find((record) => record.id === alphaApplication.id)?.decisionNote, null);
      assert.equal((await getCallRanking(organizationA.id, programA.id, callA.id)).find((record) => record.id === alphaApplication.id)?.decisionNote, null);
      const published = await publishCallResults(organizationA.id, programA.id, callA.id, managerA.id);
      assert.ok(published.resultsPublishedAt);
      assert.equal((await getPersonalApplication(participant.id, alphaApplication.id))?.decision, "SELECTED");
      await assert.rejects(() => db.application.update({ where: { id: alphaApplication.id }, data: { decision: "NOT_SELECTED" } }));
      await assert.rejects(() => db.application.update({ where: { id: alphaApplication.id }, data: { decisionNote: "Rewritten after publication" } }));
      await assert.rejects(() => decideCallApplications(organizationA.id, programA.id, callA.id, managerA.id, { applicationIds: [alphaApplication.id], decision: "NOT_SELECTED" }), /DECISION_PHASE_INVALID/);
      const current = await getPersonalApplication(participant.id, alphaApplication.id);
      await assert.rejects(() => withdrawPersonalApplication(participant.id, alphaApplication.id, current!.revision), /APPLICATION_WITHDRAWAL_UNAVAILABLE/);
    });

    await context.test("selected applications enroll atomically, reuse project origin and preserve existing observations", async () => {
      const protocol = await createProtocolVersion(organizationA.id, { name: "Selected project tracking", indicators: [{ key: "revenue", label: "Faturamento", valueType: "CURRENCY" }] });
      const cohort = await createCohort(organizationA.id, programA.id, { name: "Selection cohort", status: "ACTIVE", fundingCallId: callA.id, trackingProtocolVersionId: protocol.versions[0].id });
      const closed = await db.cohort.create({ data: { organizationId: organizationA.id, fundingProgramId: programA.id, fundingCallId: callA.id, name: "Closed historical cohort", status: "CLOSED" } });
      const archived = await db.cohort.create({ data: { organizationId: organizationA.id, fundingProgramId: programA.id, fundingCallId: callA.id, name: "Archived historical cohort", status: "ARCHIVED" } });
      const otherCallCohort = await db.cohort.create({ data: { organizationId: organizationA.id, fundingProgramId: programA.id, fundingCallId: callA2.id, name: "Other cycle", status: "ACTIVE" } });
      const wave = await createFollowUpWave(organizationA.id, cohort.id, { name: "Baseline", kind: "BASELINE", sequence: 0, scheduledFor: new Date(Date.now() + 86400000) });
      await assert.rejects(() => enrollCallApplications(organizationA.id, programA.id, callA.id, analystOne.id, cohort.id, [alphaApplication.id]), /ROLE_FORBIDDEN/);
      await assert.rejects(() => enrollCallApplications(organizationA.id, programA.id, callA.id, managerA.id, otherCallCohort.id, [alphaApplication.id]), /APPLICATION_COHORT_CALL_MISMATCH/);
      await assert.rejects(() => enrollCallApplications(organizationA.id, programA.id, callA.id, managerA.id, closed.id, [alphaApplication.id]), /COHORT_NOT_ELIGIBLE_FOR_ENROLLMENT/);
      await assert.rejects(() => enrollCallApplications(organizationA.id, programA.id, callA.id, managerA.id, archived.id, [alphaApplication.id]), /COHORT_NOT_ELIGIBLE_FOR_ENROLLMENT/);
      await assert.rejects(() => enrollCallApplications(organizationA.id, programA.id, callA.id, managerA.id, cohort.id, [betaApplication.id]), /APPLICATION_SELECTION_SCOPE_INVALID/);
      const preview = await getCallEnrollmentPreview(organizationA.id, programA.id, callA.id, cohort.id, [alphaApplication.id]);
      assert.equal(preview.applications[0].venture, null);
      assert.equal(preview.applications[0].projectNameSnapshot, "Frozen Alpha submission");
      const results = await Promise.all([enrollCallApplications(organizationA.id, programA.id, callA.id, managerA.id, cohort.id, [alphaApplication.id]), enrollCallApplications(organizationA.id, programA.id, callA.id, managerA.id, cohort.id, [alphaApplication.id])]);
      assert.equal(results[0].enrollments[0].enrollmentId, results[1].enrollments[0].enrollmentId);
      assert.equal(await db.venture.count({ where: { organizationId: organizationA.id, sourceProjectId: alpha.id } }), 1);
      assert.equal(await db.ventureEnrollment.count({ where: { organizationId: organizationA.id, applicationId: alphaApplication.id } }), 1);
      assert.equal(await db.ventureObservation.count({ where: { organizationId: organizationA.id, followUpWaveId: wave.id } }), 1);
      const enrollmentId = results[0].enrollments[0].enrollmentId;
      await assert.rejects(() => db.ventureEnrollment.update({ where: { id: enrollmentId }, data: { applicationId: null } }));
      await assert.rejects(() => db.ventureEnrollment.update({ where: { id: enrollmentId }, data: { cohortId: closed.id } }));
      const unrelatedVenture = await db.venture.create({ data: { organizationId: organizationA.id, name: "Unrelated tracked identity", kind: "PROJECT" } });
      await assert.rejects(() => db.ventureEnrollment.update({ where: { id: enrollmentId }, data: { ventureId: unrelatedVenture.id } }));
      const observation = await db.ventureObservation.findFirstOrThrow({ where: { organizationId: organizationA.id, followUpWaveId: wave.id } });
      await enrollCallApplications(organizationA.id, programA.id, callA.id, managerA.id, cohort.id, [alphaApplication.id]);
      assert.deepEqual(await db.ventureObservation.findUnique({ where: { id: observation.id } }), observation);
      assert.equal((await getCallEnrollmentPreview(organizationA.id, programA.id, callA.id, cohort.id, [alphaApplication.id])).applications[0].enrollmentId, results[0].enrollments[0].enrollmentId);
      await updateFundingCall(organizationA.id, programA.id, callA2.id, { status: "IN_REVIEW" });
      await decideCallApplications(organizationA.id, programA.id, callA2.id, managerA.id, { applicationIds: [applicationA2.id], decision: "SELECTED" });
      await publishCallResults(organizationA.id, programA.id, callA2.id, managerA.id);
      const source = await db.venture.findUniqueOrThrow({ where: { organizationId_sourceProjectId: { organizationId: organizationA.id, sourceProjectId: alpha.id } } });
      await assert.rejects(() => enrollCallApplications(organizationA.id, programA.id, callA2.id, managerA.id, otherCallCohort.id, [applicationA2.id], [{ applicationId: applicationA2.id, ventureId: null, kind: "PROJECT" }]), /APPLICATION_VENTURE_MAPPING_CHANGED/);
      assert.equal(await db.ventureEnrollment.count({ where: { organizationId: organizationA.id, applicationId: applicationA2.id } }), 0);
      const archivedAt = new Date();
      await db.venture.update({ where: { id: source.id }, data: { archivedAt } });
      const archivedPreview = await getCallEnrollmentPreview(organizationA.id, programA.id, callA2.id, otherCallCohort.id, [applicationA2.id]);
      assert.equal(archivedPreview.applications[0].venture?.id, source.id);
      assert.equal(archivedPreview.applications[0].venture?.archivedAt, archivedAt.toISOString());
      assert.equal(archivedPreview.availableVentures.some((venture) => venture.id === source.id), false);
      await assert.rejects(() => enrollCallApplications(organizationA.id, programA.id, callA2.id, managerA.id, otherCallCohort.id, [applicationA2.id]), /APPLICATION_VENTURE_ARCHIVED/);
      assert.equal(await db.venture.count({ where: { organizationId: organizationA.id, sourceProjectId: alpha.id } }), 1);
      await db.venture.update({ where: { id: source.id }, data: { archivedAt: null } });
      await enrollCallApplications(organizationA.id, programA.id, callA2.id, managerA.id, otherCallCohort.id, [applicationA2.id]);
      assert.equal(await db.venture.count({ where: { organizationId: organizationA.id, sourceProjectId: alpha.id } }), 1);
      assert.equal(await db.ventureEnrollment.count({ where: { organizationId: organizationA.id, venture: { sourceProjectId: alpha.id } } }), 2);
      await updateFundingCall(organizationB.id, programB.id, callB.id, { status: "IN_REVIEW" });
      await decideCallApplications(organizationB.id, programB.id, callB.id, managerB.id, { applicationIds: [applicationB.id], decision: "SELECTED" });
      await publishCallResults(organizationB.id, programB.id, callB.id, managerB.id);
      const cohortB = await createCohort(organizationB.id, programB.id, { name: "Institution B cohort", fundingCallId: callB.id, status: "ACTIVE" });
      await enrollCallApplications(organizationB.id, programB.id, callB.id, managerB.id, cohortB.id, [applicationB.id]);
      assert.equal(await db.venture.count({ where: { sourceProjectId: alpha.id, organizationId: { in: organizationIds } } }), 2);
    });

    await context.test("manual venture mapping validates tenant and origin, preserves identity and rolls back mixed batches", async () => {
      const mappingCall = await db.fundingCall.create({ data: { organizationId: organizationA.id, fundingProgramId: programA.id, title: "Explicit mapping cycle", callNumber: "mapping", status: "OPEN", publicListingEnabled: true, applicationsEnabled: true } });
      const repeatCall = await db.fundingCall.create({ data: { organizationId: organizationA.id, fundingProgramId: programA.id, title: "Concurrent mapping cycle", callNumber: "mapping-repeat", status: "OPEN", publicListingEnabled: true, applicationsEnabled: true } });
      const mappingProjects: Awaited<ReturnType<typeof createProject>>[] = [];
      for (const name of ["Mapped identity", "New chosen kind", "Concurrent source one", "Concurrent source two"]) {
        const project = await createProject(participant.id, { name, summary: `${name} is a persistent participant identity.`, primaryTeamId: team.id });
        mappingProjects.push(project);
        projectIds.push(project.id);
      }
      const mappingApplications: Awaited<ReturnType<typeof createPersonalApplication>>[] = [];
      for (const project of mappingProjects) {
        const application = await createPersonalApplication(participant.id, { projectId: project.id, fundingCallId: mappingCall.id });
        mappingApplications.push(await submitPersonalApplication(participant.id, application.id, application.revision));
      }
      const repeatedApplications: Awaited<ReturnType<typeof createPersonalApplication>>[] = [];
      for (const project of [mappingProjects[3], mappingProjects[2]]) {
        const application = await createPersonalApplication(participant.id, { projectId: project.id, fundingCallId: repeatCall.id });
        repeatedApplications.push(await submitPersonalApplication(participant.id, application.id, application.revision));
      }
      for (const [call, applications] of [[mappingCall, mappingApplications], [repeatCall, repeatedApplications]] as const) {
        await updateFundingCall(organizationA.id, programA.id, call.id, { status: "IN_REVIEW" });
        await decideCallApplications(organizationA.id, programA.id, call.id, managerA.id, { applicationIds: applications.map((application) => application.id), decision: "SELECTED" });
        await publishCallResults(organizationA.id, programA.id, call.id, managerA.id);
      }
      const mappingCohort = await createCohort(organizationA.id, programA.id, { name: "Manual mapping cohort", fundingCallId: mappingCall.id, status: "ACTIVE" });
      const repeatedCohort = await createCohort(organizationA.id, programA.id, { name: "Concurrent source cohort", fundingCallId: repeatCall.id, status: "ACTIVE" });
      const manual = await db.venture.create({ data: { organizationId: organizationA.id, name: "Existing tracked company", legalName: "Established legal identity", externalReference: "manual-source", kind: "COMPANY" } });
      const foreign = await db.venture.create({ data: { organizationId: organizationB.id, name: "Foreign tracked entity", kind: "PROJECT" } });
      const archived = await db.venture.create({ data: { organizationId: organizationA.id, name: "Archived tracked entity", kind: "PROJECT", archivedAt: new Date() } });
      const wrongSource = await db.venture.findUniqueOrThrow({ where: { organizationId_sourceProjectId: { organizationId: organizationA.id, sourceProjectId: alpha.id } } });
      const [mappedApplication, newKindApplication] = mappingApplications;
      const preview = await getCallEnrollmentPreview(organizationA.id, programA.id, mappingCall.id, mappingCohort.id, [mappedApplication.id]);
      assert.ok(preview.availableVentures.some((venture) => venture.id === manual.id));
      assert.equal(preview.availableVentures.some((venture) => venture.id === foreign.id), false);
      assert.equal(JSON.stringify(preview).includes("sourceProjectId"), false);
      for (const ventureId of [foreign.id, archived.id, wrongSource.id]) {
        await assert.rejects(() => enrollCallApplications(organizationA.id, programA.id, mappingCall.id, managerA.id, mappingCohort.id, [mappedApplication.id], [{ applicationId: mappedApplication.id, ventureId }]), /APPLICATION_VENTURE_MAPPING_INVALID/);
      }
      await assert.rejects(() => enrollCallApplications(organizationA.id, programA.id, mappingCall.id, managerA.id, mappingCohort.id, [mappedApplication.id], [{ applicationId: mappedApplication.id, ventureId: manual.id }, { applicationId: mappedApplication.id, kind: "PROJECT" }]), /APPLICATION_VENTURE_MAPPING_INVALID/);
      await assert.rejects(() => enrollCallApplications(organizationA.id, programA.id, mappingCall.id, managerA.id, mappingCohort.id, [mappedApplication.id], [{ applicationId: newKindApplication.id, ventureId: manual.id }]), /APPLICATION_VENTURE_MAPPING_INVALID/);
      await assert.rejects(() => enrollCallApplications(organizationA.id, programA.id, mappingCall.id, managerA.id, mappingCohort.id, [mappedApplication.id, newKindApplication.id], [{ applicationId: mappedApplication.id, ventureId: manual.id }, { applicationId: newKindApplication.id, ventureId: archived.id }]), /APPLICATION_VENTURE_MAPPING_INVALID/);
      assert.equal((await db.venture.findUniqueOrThrow({ where: { id: manual.id } })).sourceProjectId, null);
      assert.equal(await db.ventureEnrollment.count({ where: { organizationId: organizationA.id, cohortId: mappingCohort.id } }), 0);
      const mapped = await enrollCallApplications(organizationA.id, programA.id, mappingCall.id, managerA.id, mappingCohort.id, [mappedApplication.id, newKindApplication.id], [{ applicationId: mappedApplication.id, ventureId: manual.id, kind: "INITIATIVE" }, { applicationId: newKindApplication.id, kind: "INITIATIVE" }]);
      const preserved = await db.venture.findUniqueOrThrow({ where: { id: manual.id } });
      assert.equal(preserved.name, manual.name);
      assert.equal(preserved.legalName, manual.legalName);
      assert.equal(preserved.externalReference, manual.externalReference);
      assert.equal(preserved.kind, "COMPANY");
      assert.equal(preserved.sourceProjectId, mappingProjects[0].id);
      const chosenKind = await db.venture.findUniqueOrThrow({ where: { organizationId_sourceProjectId: { organizationId: organizationA.id, sourceProjectId: mappingProjects[1].id } } });
      assert.equal(chosenKind.kind, "INITIATIVE");
      const replay = await enrollCallApplications(organizationA.id, programA.id, mappingCall.id, managerA.id, mappingCohort.id, [mappedApplication.id], [{ applicationId: mappedApplication.id, ventureId: manual.id }]);
      assert.equal(replay.enrollments[0].enrollmentId, mapped.enrollments.find((entry) => entry.applicationId === mappedApplication.id)?.enrollmentId);
      await assert.rejects(() => db.venture.update({ where: { id: manual.id }, data: { sourceProjectId: mappingProjects[1].id } }));
      const concurrentResults = await Promise.all([
        enrollCallApplications(organizationA.id, programA.id, mappingCall.id, managerA.id, mappingCohort.id, mappingApplications.slice(2).map((application) => application.id)),
        enrollCallApplications(organizationA.id, programA.id, repeatCall.id, managerA.id, repeatedCohort.id, repeatedApplications.map((application) => application.id)),
      ]);
      assert.equal(concurrentResults.flatMap((result) => result.enrollments).length, 4);
      assert.equal(await db.venture.count({ where: { organizationId: organizationA.id, sourceProjectId: { in: mappingProjects.slice(2).map((project) => project.id) } } }), 2);
    });
  } finally {
    await db.notification.deleteMany({ where: { OR: [{ recipientUserId: { in: userIds } }, { actorUserId: { in: userIds } }] } });
    if (organizationIds.length) {
      await db.cohort.deleteMany({ where: { organizationId: { in: organizationIds } } });
      await db.organization.deleteMany({ where: { id: { in: organizationIds } } });
    }
    if (projectIds.length) await db.project.deleteMany({ where: { id: { in: projectIds } } });
    if (teamIds.length) await db.team.deleteMany({ where: { id: { in: teamIds } } });
    if (userIds.length) await db.user.deleteMany({ where: { id: { in: userIds } } });
  }
});
