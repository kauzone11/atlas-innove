import assert from "node:assert/strict";
import test from "node:test";

import { normalizeTag, publicHandleSchema, tagListSchema } from "./normalization";

test("one normalized vocabulary matches accents, spaces and display labels across domains", () => {
  assert.equal(normalizeTag(" Inteligência Artificial "), normalizeTag("inteligencia-artificial"));
  assert.equal(normalizeTag("Empresa Júnior"), "empresa-junior");
  assert.deepEqual(tagListSchema.parse([" Saúde ", "Energia"]), ["Saúde", "Energia"]);
  assert.equal(tagListSchema.safeParse(["Saúde", "saude"]).success, false);
  assert.equal(tagListSchema.safeParse(["___"]).success, false);
  assert.equal(tagListSchema.safeParse(Array.from({ length: 21 }, (_, index) => `tema-${index}`)).success, false);
});

test("public addresses normalize case and reject route names or unsafe URL segments", () => {
  assert.equal(publicHandleSchema.parse(" Marina-Duarte "), "marina-duarte");
  for (const handle of ["api", "projects", "../../app", "ana--silva", "ana/", "-ana", "javascript:alert(1)"]) {
    assert.equal(publicHandleSchema.safeParse(handle).success, false, handle);
  }
});
