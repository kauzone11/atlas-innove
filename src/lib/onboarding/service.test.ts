import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { db } from "@/lib/db";
import { getInstitutionOnboarding } from "@/lib/onboarding/service";

test("institutional guidance derives current tenant data and fails closed after access changes", async (context) => {
  if (!process.env.DATABASE_URL) { assert.notEqual(process.env.REQUIRE_DOMAIN_DATABASE, "true"); context.skip("Disposable PostgreSQL required"); return; }
  const suffix = randomUUID();
  const user = await db.user.create({ data: { email: `onboarding-${suffix}@example.test`, passwordHash: "test-only", platformRole: "SUPER_ADMIN" } });
  const organizations = await Promise.all(["a", "b"].map((name) => db.organization.create({ data: { name, slug: `onboarding-${name}-${suffix}` } })));
  const [org, other] = organizations;
  try {
    await assert.rejects(() => getInstitutionOnboarding(user.id, org.id), /ORGANIZATION_ACCESS_DENIED/);
    const member = await db.organizationMembership.create({ data: { userId: user.id, organizationId: org.id, role: "MANAGER" } });
    const empty = await getInstitutionOnboarding(user.id, org.id);
    assert.equal(empty.steps.length, 8); assert.deepEqual(empty.steps.filter((step) => step.complete).map((step) => step.key), ["organization"]);
    await db.fundingProgram.create({ data: { organizationId: other.id, createdByUserId: user.id, name: "Other program", slug: "other" } });
    assert.equal((await getInstitutionOnboarding(user.id, org.id)).steps.find((step) => step.key === "program")?.complete, false);
    const program = await db.fundingProgram.create({ data: { organizationId: org.id, createdByUserId: user.id, name: "Own program", slug: "own" } });
    const configured = await getInstitutionOnboarding(user.id, org.id);
    assert.equal(configured.steps.find((step) => step.key === "program")?.complete, true);
    assert.ok(configured.steps.find((step) => step.key === "cohort")?.href.includes(program.id));
    await db.fundingProgram.delete({ where: { organizationId: org.id, id: program.id } });
    assert.equal((await getInstitutionOnboarding(user.id, org.id)).steps.find((step) => step.key === "program")?.complete, false);
    await db.organizationMembership.update({ where: { id: member.id }, data: { role: "ANALYST" } });
    await assert.rejects(() => getInstitutionOnboarding(user.id, org.id), /ROLE_FORBIDDEN/);
    await db.organizationMembership.update({ where: { id: member.id }, data: { role: "MANAGER", status: "DISABLED" } });
    await assert.rejects(() => getInstitutionOnboarding(user.id, org.id), /MEMBERSHIP_DISABLED/);
  } finally {
    await db.organization.deleteMany({ where: { id: { in: organizations.map((item) => item.id) } } });
    await db.user.delete({ where: { id: user.id } });
  }
});
