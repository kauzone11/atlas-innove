import assert from "node:assert/strict";
import test from "node:test";

import { assertEnrollmentIsUnique, assertSameOrganization } from "@/lib/domain-invariants";

test("domain relationships cannot cross organization boundaries", () => {
  assert.doesNotThrow(() => assertSameOrganization("org-a", "org-a", "org-a"));
  assert.throws(() => assertSameOrganization("org-a", "org-b"), { code: "TENANT_SCOPE_MISMATCH" });
});

test("a venture cannot be enrolled twice in the same cohort", () => {
  assert.doesNotThrow(() => assertEnrollmentIsUnique(null));
  assert.throws(() => assertEnrollmentIsUnique("enrollment-1"), { code: "VENTURE_ALREADY_ENROLLED" });
});
