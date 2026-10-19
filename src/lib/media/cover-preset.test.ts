import assert from "node:assert/strict";
import test from "node:test";
import { profileCoverPresetSchema } from "@/lib/media/schemas";

test("cover preset input accepts only known presets", () => {
  for (const preset of ["ATLAS", "CONTOUR", "SIGNAL", "GRID"]) assert.equal(profileCoverPresetSchema.parse({ preset }).preset, preset);
  assert.equal(profileCoverPresetSchema.safeParse({ preset: "NEON" }).success, false);
  assert.equal(profileCoverPresetSchema.safeParse({ preset: "ATLAS", mediaId: "abc" }).success, false);
  assert.equal(profileCoverPresetSchema.safeParse({}).success, false);
});
