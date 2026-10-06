import assert from "node:assert/strict";
import test from "node:test";
import { readImportForm, readImportJson } from "@/lib/imports/body";
import { IMPORT_LIMITS } from "@/lib/imports/limits";
import { assertImportOrigin } from "@/lib/imports/api";

test("import origin checks use the incoming host preserved by Next and reject foreign origins", () => {
  assert.doesNotThrow(() => assertImportOrigin(new Request("http://localhost:3000/upload", { headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" } })));
  assert.doesNotThrow(() => assertImportOrigin(new Request("http://localhost:3000/upload", { headers: { host: "innove.example.test", origin: "https://innove.example.test" } })));
  for (const origin of ["https://foreign.example.test", "null", "file://innove.example.test", "https://innove.example.test.attacker.test"]) {
    assert.throws(() => assertImportOrigin(new Request("http://localhost:3000/upload", { headers: { host: "innove.example.test", origin } })), /IMPORT_ORIGIN_REJECTED/);
  }
});

test("import HTTP bodies enforce actual streamed size and unambiguous form fields", async () => {
  const form = new FormData(); form.set("type", "VENTURES"); form.set("namespace", "history"); form.set("file", new File(["external_id,name,kind\nv1,Example,COMPANY"], "ventures.csv"));
  const parsed = await readImportForm(new Request("https://innove.example.test/upload", { method: "POST", body: form }));
  assert.equal(parsed.type, "VENTURES"); assert.equal(parsed.namespace, "history"); assert.equal(parsed.sourceName, "ventures.csv"); assert.ok(parsed.bytes.byteLength);
  form.append("namespace", "other");
  await assert.rejects(() => readImportForm(new Request("https://innove.example.test/upload", { method: "POST", body: form })), /IMPORT_FORM_INVALID/);
  const large = new FormData(); large.set("type", "VENTURES"); large.set("namespace", "history"); large.set("file", new File([new Uint8Array(IMPORT_LIMITS.maxBytes + 1)], "large.csv"));
  await assert.rejects(() => readImportForm(new Request("https://innove.example.test/upload", { method: "POST", body: large })), /CSV_FILE_TOO_LARGE/);
  await assert.rejects(() => readImportJson(new Request("https://innove.example.test/mapping", { method: "POST", body: "x".repeat(70000), headers: { "content-type": "application/json", "content-length": "2" } })), /IMPORT_BODY_TOO_LARGE/);
  await assert.rejects(() => readImportJson(new Request("https://innove.example.test/mapping", { method: "POST", body: "{invalid", headers: { "content-type": "application/json" } })), /IMPORT_JSON_INVALID/);
});
