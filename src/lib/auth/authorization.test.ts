import assert from "node:assert/strict";
import test from "node:test";

import {
  assertActiveOrganizationAccess,
  assertCanManageMembership,
  canManageMembership,
  hasAtLeastRole,
} from "@/lib/auth/authorization";

test("organization access fails closed for inactive tenants and memberships", () => {
  assert.throws(
    () =>
      assertActiveOrganizationAccess({
        organizationStatus: "INACTIVE",
        membershipStatus: "ACTIVE",
        role: "OWNER",
      }),
    { code: "ORGANIZATION_INACTIVE" },
  );
  assert.throws(
    () =>
      assertActiveOrganizationAccess({
        organizationStatus: "ACTIVE",
        membershipStatus: "DISABLED",
        role: "OWNER",
      }),
    { code: "MEMBERSHIP_DISABLED" },
  );
});

test("role checks prevent escalation", () => {
  assert.equal(hasAtLeastRole("ADMIN", "MANAGER"), true);
  assert.equal(hasAtLeastRole("MANAGER", "ADMIN"), false);
  assert.equal(canManageMembership("ADMIN", "MANAGER", "ANALYST"), true);
  assert.equal(canManageMembership("ADMIN", "MANAGER", "OWNER"), false);
  assert.throws(() => assertCanManageMembership("ADMIN", "MANAGER", "OWNER"), {
    code: "ROLE_ESCALATION_REJECTED",
  });
});
