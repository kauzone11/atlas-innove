import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import { createOpaqueToken, hashToken, signValue } from "@/lib/security";
import { createProtocolVersion } from "@/lib/tracking-protocols/service";
import type { ImportBatch, ImportType } from "@prisma/client";

const password = "Disposable-browser-password-2026!";
const baseURL = "http://127.0.0.1:3000";
async function fixture() {
  if (process.env.REQUIRE_DOMAIN_DATABASE !== "true" || !process.env.DATABASE_URL?.includes("atlas_innove_ci")) throw new Error("Browser fixtures require the designated disposable CI database");
  const suffix = randomUUID();
  const user = await db.user.create({ data: { email: `browser-${suffix}@example.test`, passwordHash: await hash(password, 10), profile: { create: { fullName: "Gestora de teste" } } } });
  const org = await db.organization.create({ data: { name: "Instituição de teste", slug: `browser-${suffix}` } });
  const other = await db.organization.create({ data: { name: "Outra instituição", slug: `browser-other-${suffix}` } });
  const member = await db.organizationMembership.create({ data: { userId: user.id, organizationId: org.id, role: "MANAGER" } });
  const raw = createOpaqueToken();
  const session = await db.session.create({ data: { userId: user.id, tokenHash: hashToken(raw), sessionVersion: user.sessionVersion, activeOrganizationId: org.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000) } });
  const value = `${session.id}.${raw}`;
  return { user, org, other, member, cookie: `atlas_innove_session=${value}.${signValue(value)}`, async cleanup() { await db.organization.deleteMany({ where: { id: { in: [org.id, other.id] } } }); await db.user.delete({ where: { id: user.id } }); } };
}
function csv(rows: Record<string, string>[]) {
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return { headers, content: [headers, ...rows.map((row) => headers.map((key) => row[key] ?? ""))].map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\r\n") };
}
async function json<T>(response: Awaited<ReturnType<APIRequestContext["get"]>>, status = 200): Promise<T> {
  const payload = await response.json(); expect(response.status(), JSON.stringify(payload)).toBe(status); return payload as T;
}
async function stage(api: APIRequestContext, orgId: string, type: ImportType, rows: Record<string, string>[]) {
  const source = csv(rows); const base = `/api/organizations/${orgId}/imports`;
  const batch = await json<ImportBatch>(await api.post(base, { multipart: { type, namespace: "browser-history", file: { name: "history.csv", mimeType: "text/csv", buffer: Buffer.from(source.content) } } }), 201);
  const mapped = await json<ImportBatch>(await api.patch(`${base}/${batch.id}/mapping`, { data: { expectedRevision: batch.revision, mapping: Object.fromEntries(source.headers.map((header) => [header, header])) } }));
  return json<ImportBatch>(await api.post(`${base}/${batch.id}/validate`, { data: { expectedRevision: mapped.revision } }));
}
async function login(page: Page, email: string) {
  await page.goto("/login?next=/app/imports");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/imports$/);
  await expect(page.getByRole("heading", { name: "Importações", exact: true })).toBeVisible();
}
test.afterAll(async () => { await db.$disconnect(); });

test("actual HTTP enforces tenants, revisions, all eight historical import types and atomic reversal", async ({ playwright }) => {
  const f = await fixture(); const api = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { Cookie: f.cookie, Origin: baseURL } });
  const base = `/api/organizations/${f.org.id}/imports`;
  const apply = async (type: ImportType, rows: Record<string, string>[]) => {
    const ready = await stage(api, f.org.id, type, rows); expect(ready.status).toBe("READY");
    return json<ImportBatch>(await api.post(`${base}/${ready.id}/apply`, { data: { expectedRevision: ready.revision, confirmed: true } }));
  };
  try {
    expect((await api.get(`/api/organizations/${f.other.id}/imports`)).status()).toBe(403);
    expect((await api.get(`${base}/missing`)).status()).toBe(404);
    expect((await api.post(base, { headers: { Origin: "https://foreign.example.test" }, data: {} })).status()).toBe(403);
    const program = await apply("FUNDING_PROGRAMS", [{ external_id: "p1", name: "Programa histórico", slug: "historic", status: "CLOSED" }]);
    expect((await api.post(`${base}/${program.id}/apply`, { data: { expectedRevision: program.revision, confirmed: true } })).status()).toBe(409);
    const call = await apply("FUNDING_CALLS", [{ external_id: "call1", funding_program_external_id: "p1", title: "Edital histórico", call_number: "2024/01", status: "CLOSED" }]);
    const protocol = await createProtocolVersion(f.org.id, { name: "Protocolo de teste", indicators: [{ key: "headcount", label: "Equipe", valueType: "INTEGER" }] });
    const cohort = await apply("COHORTS", [{ external_id: "co1", funding_program_external_id: "p1", funding_call_external_id: "call1", tracking_protocol_version_id: protocol.versions[0].id, name: "Coorte histórica", status: "CLOSED" }]);
    const venture = await apply("VENTURES", [{ external_id: "v1", name: "Empreendimento histórico", kind: "COMPANY" }]);
    const enrollment = await apply("VENTURE_ENROLLMENTS", [{ external_id: "e1", cohort_external_id: "co1", venture_external_id: "v1", enrolled_at: "2024-01-01T00:00:00Z" }]);
    const wave = await apply("FOLLOW_UP_WAVES", [{ external_id: "w1", cohort_external_id: "co1", name: "Baseline", kind: "BASELINE", sequence: "0", offset_months: "0", scheduled_for: "2024-02-01", status: "CLOSED" }]);
    const milestone = await apply("MILESTONES", [{ external_id: "m1", venture_external_id: "v1", type: "FIRST_CUSTOMER", title: "Primeiro cliente", occurred_at: "2024-02-15T09:00:00-03:00" }]);
    const observation = await apply("OBSERVATIONS", [{ external_id: "o1", venture_enrollment_external_id: "e1", follow_up_wave_external_id: "w1", indicator_key: "headcount", value: "0", status: "SUBMITTED", submitted_at: "2024-02-20T09:00:00-03:00" }]);
    const savedCall = await db.fundingCall.findFirstOrThrow({ where: { organizationId: f.org.id } });
    expect(savedCall.publicListingEnabled).toBe(false); expect(savedCall.applicationsEnabled).toBe(false);
    expect(await db.application.count({ where: { organizationId: f.org.id } })).toBe(0);
    expect(await db.project.count({ where: { createdByUserId: f.user.id } })).toBe(0);
    const saved = await db.ventureObservation.findFirstOrThrow({ where: { organizationId: f.org.id }, include: { values: true } });
    expect(saved.status).toBe("SUBMITTED"); expect(saved.values[0].integerValue).toBe(0); expect(saved.submittedAt?.toISOString()).toBe("2024-02-20T12:00:00.000Z");
    const blocked = await json<{ canRollback: boolean }>(await api.get(`${base}/${program.id}/rollback`)); expect(blocked.canRollback).toBe(false);
    expect((await api.post(`${base}/${program.id}/rollback`, { data: { expectedRevision: program.revision, confirmed: true } })).status()).toBe(409);
    const invalid = await stage(api, f.org.id, "VENTURES", [{ external_id: "bad", name: "=1+1", kind: "INVALID" }]); expect(invalid.status).toBe("FAILED");
    const exported = await api.get(`${base}/${invalid.id}/errors`); expect(exported.status()).toBe(200); expect(await exported.text()).toContain("'=1+1"); expect(exported.headers()["cache-control"]).toContain("no-store");
    await db.organizationMembership.create({ data: { organizationId: f.other.id, userId: f.user.id, role: "OWNER" } });
    for (const suffix of ["", "/audit", "/errors", "/rollback"]) expect((await api.get(`/api/organizations/${f.other.id}/imports/${program.id}${suffix}`)).status()).toBe(404);
    for (const batch of [observation, milestone, wave, enrollment, venture, cohort, call, program]) {
      const preview = await json<{ canRollback: boolean; revision: number }>(await api.get(`${base}/${batch.id}/rollback`)); expect(preview.canRollback).toBe(true);
      const reversed = await json<ImportBatch>(await api.post(`${base}/${batch.id}/rollback`, { data: { expectedRevision: preview.revision, confirmed: true } })); expect(reversed.status).toBe("ROLLED_BACK");
    }
    expect(await db.externalReference.count({ where: { organizationId: f.org.id } })).toBe(0);
    expect(await db.importBatch.count({ where: { organizationId: f.org.id, status: "ROLLED_BACK" } })).toBe(8);
    await db.organizationMembership.update({ where: { id: f.member.id }, data: { status: "DISABLED" } });
    expect((await api.get(`${base}/${program.id}`)).status()).toBe(403);
  } finally { await api.dispose(); await f.cleanup(); }
});

test("browser upload, invalid preview, keyboard confirmations, lost response recovery and responsive reflow", async ({ page }, testInfo) => {
  const f = await fixture(); const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error" && /hydration|uncaught|react|chunk/i.test(message.text())) runtimeErrors.push(message.text()); });
  try {
    await login(page, f.user.email);
    const cookies = await page.context().cookies(); const session = cookies.find((cookie) => cookie.name === "atlas_innove_session"); expect(session?.httpOnly).toBe(true); expect(session?.secure).toBe(true); expect(session?.sameSite).toBe("Lax");
    await page.getByLabel("Identificador da origem", { exact: true }).fill("browser-history");
    const content = csv(Array.from({ length: 21 }, (_, index) => ({ external_id: `p${index}`, name: `Programa ${index}`, slug: `program-${index}` })));
    await page.getByLabel("Arquivo CSV", { exact: true }).setInputFiles({ name: "programas.csv", mimeType: "text/csv", buffer: Buffer.from(content.content) });
    await page.getByRole("button", { name: "Carregar e revisar" }).click();
    await expect(page).toHaveURL(/\/app\/imports\/[^/?]+$/);
    const batchUrl = page.url(); const batchId = batchUrl.split("/").at(-1)!;
    await page.getByRole("button", { name: "Confirmar mapeamento", exact: true }).click();
    await expect(page.getByRole("button", { name: "Validar dados", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Validar dados", exact: true }).click();
    await expect(page.getByText("Pronto para aplicar", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Próxima", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Linha 22", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Anterior", exact: true }).click();
    for (const width of [1600, 1440, 1280, 1024, 768, 430, 390, 375, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.getByRole("heading", { name: "programas.csv", exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `horizontal overflow at ${width}`).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`import-preview-${width}.png`) });
    }
    await page.getByRole("button", { name: "Revisar confirmação de aplicação" }).click();
    const dialog = page.getByRole("dialog", { name: "Aplicar este lote?" }); await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("checkbox")).toBeFocused();
    await expect(dialog.getByRole("button", { name: "Confirmar aplicação", exact: true })).toBeDisabled();
    await page.keyboard.press("Escape"); await expect(dialog).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Revisar confirmação de aplicação" })).toBeFocused();
    await page.getByRole("button", { name: "Revisar confirmação de aplicação" }).click();
    await dialog.getByRole("checkbox").check();
    await dialog.getByRole("button", { name: "Confirmar aplicação", exact: true }).focus(); await page.keyboard.press("Tab");
    await expect(dialog.getByRole("button", { name: "Fechar janela" })).toBeFocused();
    await page.route(`**/imports/${batchId}/apply`, async (route) => { const response = await route.fetch(); expect(response.status()).toBe(200); await route.abort("failed"); });
    await dialog.getByRole("button", { name: "Confirmar aplicação", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("conexão foi interrompida");
    expect(await db.fundingProgram.count({ where: { organizationId: f.org.id } })).toBe(21);
    await page.unroute(`**/imports/${batchId}/apply`);
    await page.getByRole("button", { name: "Consultar estado atual" }).click();
    await expect(page.getByText("Aplicado", { exact: true })).toBeVisible();
    await page.reload(); await expect(page.getByText("Aplicado", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Conferir possibilidade de reversão" }).click();
    await page.getByRole("button", { name: "Revisar confirmação de reversão" }).click();
    const reverse = page.getByRole("dialog", { name: "Reverter este lote?" });
    await reverse.getByRole("checkbox").check(); await reverse.getByRole("button", { name: "Confirmar reversão", exact: true }).click();
    await expect(page.getByText("Revertido", { exact: true })).toBeVisible();
    expect(await db.fundingProgram.count({ where: { organizationId: f.org.id } })).toBe(0);
    await page.goto("/app/settings/onboarding"); await expect(page.getByRole("heading", { name: "Preparação institucional", exact: true })).toBeVisible();
    const routes = ["/app/settings", "/app/settings/onboarding", "/app/imports", "/app", "/app/analytics", "/app/analytics/quality", "/opportunities", "/results"];
    for (const path of routes) { const response = await page.goto(path); expect(response?.status(), path).toBe(200); await expect(page.locator("h1").first()).toBeVisible(); }
    expect(runtimeErrors).toEqual([]);
  } finally { await f.cleanup(); }
});
