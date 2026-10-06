import assert from "node:assert/strict";
import test from "node:test";
import { db } from "@/lib/db";
import { GET as health } from "@/app/api/health/route";

test("readiness reports database failure without exposing internals while liveness remains available", async () => {
  const { GET: ready } = await import("@/app/api/ready/route");
  const original = db.$queryRaw;
  db.$queryRaw = (async () => { throw new Error("private-database-host-and-credentials"); }) as typeof db.$queryRaw;
  try {
    const response = await ready();
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { status: "unavailable" });
    assert.equal(response.headers.get("cache-control"), "no-store");
    const live = health(); assert.equal(live.status, 200); assert.deepEqual(await live.json(), { status: "ok" });
  } finally { db.$queryRaw = original; }
});

test("readiness reports a successful database probe", async () => {
  const { GET: ready } = await import("@/app/api/ready/route");
  const original = db.$queryRaw;
  db.$queryRaw = (async () => [{ ready: 1 }]) as unknown as typeof db.$queryRaw;
  try {
    const response = await ready(); assert.equal(response.status, 200); assert.deepEqual(await response.json(), { status: "ready" });
  } finally { db.$queryRaw = original; }
});
