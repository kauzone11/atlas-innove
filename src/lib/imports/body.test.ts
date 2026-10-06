import assert from "node:assert/strict";
import test from "node:test";
import { readImportForm, readImportJson } from "@/lib/imports/body";
import { IMPORT_LIMITS } from "@/lib/imports/limits";

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
