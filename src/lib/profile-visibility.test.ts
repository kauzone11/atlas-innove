import assert from "node:assert/strict";
import test from "node:test";
import { resolveProfileVisibility, type VisibilityScope } from "@/lib/profiles/visibility";
import { dateOnlySchema, profileEducationSchema, profileExperienceSchema, profileLinkSchema, profileTopicsSchema, profileUpdateSchema } from "@/lib/profiles/schemas";
import { normalizeTag, publicHandleSchema } from "@/lib/identity/normalization";

test("profile scopes resolve anonymous, platform, collaborator and owner visibility", () => {
  const scopes: VisibilityScope[] = ["PUBLIC", "PLATFORM", "TEAM", "PRIVATE"];
  const resolve = (viewerUserId: string | null, sharedCollaboration: boolean) => scopes.map((scope) => resolveProfileVisibility({ scope, profileUserId: "owner", viewerUserId, sharedCollaboration }));
  assert.deepEqual(resolve(null, false), [true, false, false, false]);
  assert.deepEqual(resolve(null, true), [true, false, false, false]);
  assert.deepEqual(resolve("visitor", false), [true, true, false, false]);
  assert.deepEqual(resolve("collaborator", true), [true, true, true, false]);
  assert.deepEqual(resolve("owner", false), [true, true, true, true]);
});

test("profile content accepts valid dates, safe links and normalized unique topics", () => {
  assert.equal(publicHandleSchema.parse(" Marina-Duarte "), "marina-duarte");
  for (const handle of ["api", "people", "projects", "admin", "bad_handle", "-leading", "trailing-", "double--hyphen"]) assert.equal(publicHandleSchema.safeParse(handle).success, false, handle);
  assert.equal(normalizeTag("Inteligência Artificial"), normalizeTag("inteligencia artificial"));
  assert.equal(profileTopicsSchema.safeParse({ skills: ["Inteligência Artificial", "inteligencia artificial"], interests: [] }).success, false);
  assert.equal(profileTopicsSchema.safeParse({ skills: Array.from({ length: 21 }, (_, i) => `Topic ${i}`), interests: [] }).success, false);
  assert.equal(dateOnlySchema.safeParse("2024-02-29").success, true);
  for (const value of ["2025-02-29", "2026-04-31", "2026-1-01", "2026-10-06T00:00:00Z"]) assert.equal(dateOnlySchema.safeParse(value).success, false, value);
  const link = { label: "Portfolio", type: "WEBSITE", visibility: "PRIVATE" };
  assert.equal(profileLinkSchema.safeParse({ ...link, url: "https://example.test/path" }).success, true);
  for (const url of ["javascript:alert(1)", "data:text/html,unsafe", "http://example.test", "https://user:secret@example.test"]) assert.equal(profileLinkSchema.safeParse({ ...link, url }).success, false, url);
  const experience = { organizationName: "Research lab", title: "Researcher", startsAt: "2026-01-01", endsAt: "2025-01-01", current: false, description: null };
  assert.equal(profileExperienceSchema.safeParse(experience).success, false);
  assert.equal(profileExperienceSchema.safeParse({ ...experience, endsAt: "2026-05-01", current: true }).success, false);
  assert.equal(profileEducationSchema.safeParse({ institution: "University", course: "Innovation", degree: null, startsAt: "2026-01-01", endsAt: "2025-01-01", description: null }).success, false);
  assert.equal(profileUpdateSchema.safeParse({ section: "publish", confirmed: false }).success, false);
  assert.equal(profileUpdateSchema.safeParse({ section: "publish", confirmed: true, userId: "other" }).success, false);
});
