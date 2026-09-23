import assert from "node:assert/strict";
import test from "node:test";

import { assertTenantBoundary, organizationOwnedWhere } from "@/lib/auth/tenant";

test("tenant-owned queries require an explicit organization boundary", () => {
  assert.deepEqual(organizationOwnedWhere("org-a"), { organizationId: "org-a" });
  assert.throws(() => organizationOwnedWhere(""), { code: "TENANT_SCOPE_REQUIRED" });
  assert.throws(() => assertTenantBoundary("org-a", "org-b"), { code: "TENANT_SCOPE_MISMATCH" });
  assert.doesNotThrow(() => assertTenantBoundary("org-a", "org-a"));
});
