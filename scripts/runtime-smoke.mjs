import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout } from "node:timers/promises";

const base = new URL(process.argv[2] ?? "http://127.0.0.1:3000");
assert.ok(["http:", "https:"].includes(base.protocol));
let checks = 0;
const failures = [];
async function check(label, action) {
  checks++;
  try { await action(); } catch (error) { failures.push(`${label}: ${error.message}`); }
}
async function request(route, method = "GET") {
  return fetch(new URL(route, base), { method, redirect: "manual", signal: AbortSignal.timeout(10000), ...(method === "GET" || method === "HEAD" ? {} : { headers: { "content-type": "application/json" }, body: "{}" }) });
}
for (let attempt = 0; ; attempt++) {
  try { const response = await request("/api/health"); assert.equal(response.status, 200); break; }
  catch (error) { if (attempt >= 29) throw error; await setTimeout(1000); }
}
for (const [route, payload] of [["/api/health", { status: "ok" }], ["/api/ready", { status: "ready" }]]) {
  await check(route, async () => {
    const response = await request(route); assert.equal(response.status, 200, route); assert.deepEqual(await response.json(), payload); assert.equal(response.headers.get("cache-control"), "no-store");
  });
}
await check("/", async () => {
  const response = await request("/"); assert.equal(response.status, 307); assert.equal(new URL(response.headers.get("location"), base).pathname, "/login"); await response.arrayBuffer();
});
for (const route of ["/login", "/signup", "/recover", "/opportunities", "/results"]) {
  await check(route, async () => {
    const response = await request(route); assert.equal(response.status, 200, route); assert.match(response.headers.get("content-type") ?? "", /text\/html/); assert.equal(response.headers.get("x-content-type-options"), "nosniff"); await response.arrayBuffer();
  });
}
for (const route of ["/demo", "/demo/programas", "/demo/oportunidades", "/demo/acompanhamentos"]) {
  await check(route, async () => {
    const response = await request(route); assert.equal(response.status, process.env.DEMO_ENABLED === "true" ? 200 : 404, route); await response.arrayBuffer();
  });
}
for (const route of ["/opportunities/calls/runtime-missing", "/results/runtime-missing", "/people/runtime-missing", "/projects/runtime-missing", "/posts/nonexistent-safe-id"]) {
  await check(route, async () => { const response = await request(route); assert.equal(response.status, 404, route); await response.arrayBuffer(); });
}
for (const route of ["/app", "/app/personal", "/app/personal/feed", "/app/analytics/quality", "/app/personal/network/requests", "/app/messages", "/app/programs/runtime-missing/cohorts/runtime-missing"]) {
  await check(route, async () => {
    const response = await request(route); assert.ok([302, 303, 307, 308].includes(response.status), `${route}: ${response.status}`);
    const location = new URL(response.headers.get("location"), base); assert.equal(location.pathname, "/login"); assert.equal(location.searchParams.get("next"), route); await response.arrayBuffer();
  });
}
async function routes(directory) {
  const entries = await readdir(directory, { withFileTypes: true }); const output = [];
  for (const entry of entries) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await routes(filename)); else if (entry.name === "route.ts") output.push(filename);
  }
  return output.sort();
}
for (const filename of await routes(path.resolve("src/app/api"))) {
  const route = `/${path.relative(path.resolve("src/app"), filename).replaceAll(path.sep, "/").replace(/\/route\.ts$/, "").replace(/\[[^\]]+\]/g, "runtime-missing")}`;
  if (!/^\/api\/(organizations|personal|messages|notifications|network|platform)(\/|$)/.test(route)) continue;
  const source = await readFile(filename, "utf8");
  const methods = [...source.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*\(/g)].map((match) => match[1]);
  assert.ok(methods.length, `No methods inventoried for ${filename}`);
  for (const method of methods) {
    await check(`${method} ${route}`, async () => {
      const response = await request(route, method);
      assert.equal(response.status, 401, `${method} ${route}: anonymous access must be rejected`);
      const body = await response.text(); assert.ok(!/Prisma|DATABASE_URL|passwordHash|stack trace/i.test(body), `${route}: internal details in response`);
    });
  }
}
assert.deepEqual(failures, [], `${failures.length} of ${checks} runtime checks failed`);
console.log(`PASS: ${checks} production-mode HTTP checks, including every protected API handler.`);
