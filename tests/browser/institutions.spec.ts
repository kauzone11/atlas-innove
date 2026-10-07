import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";

const password = "Disposable-institution-browser-2026!";
const baseURL = process.env.INNOVE_BROWSER_BASE_URL ?? "http://127.0.0.1:3000";

async function fixture() {
  if (process.env.REQUIRE_DOMAIN_DATABASE !== "true" || !process.env.DATABASE_URL?.includes("atlas_innove_ci")) {
    throw new Error("Institution browser fixtures require the designated disposable CI database");
  }
  const suffix = randomUUID().replaceAll("-", "").slice(0, 10);
  const passwordHash = await hash(password, 10);
  const manager = await db.user.create({ data: {
    email: `institution-manager-${suffix}@example.test`, passwordHash,
    profile: { create: { fullName: `Equipe Instituição ${suffix}` } },
  } });
  const participant = await db.user.create({ data: {
    email: `institution-participant-${suffix}@example.test`, passwordHash,
    profile: { create: { fullName: `Pessoa Participante ${suffix}` } },
  } });
  const organization = await db.organization.create({ data: { name: `Instituição de teste ${suffix}`, slug: `instituicao-teste-${suffix}` } });
  await db.organizationMembership.create({ data: { organizationId: organization.id, userId: manager.id, role: "ADMIN", status: "ACTIVE" } });
  const program = await db.fundingProgram.create({ data: {
    organizationId: organization.id, name: `Programa de inovação ${suffix}`, slug: `programa-${suffix}`,
    description: "Programa público de apoio à inovação.", status: "ACTIVE", createdByUserId: manager.id,
  } });
  await db.fundingCall.create({ data: {
    organizationId: organization.id, fundingProgramId: program.id, title: `Chamada pública ${suffix}`,
    callNumber: `PUB-${suffix}`, objective: "Apoio a iniciativas de inovação.", status: "OPEN", publicListingEnabled: true,
  } });
  await db.fundingCall.create({ data: {
    organizationId: organization.id, fundingProgramId: program.id, title: `Chamada interna ${suffix}`,
    callNumber: `INT-${suffix}`, status: "OPEN", publicListingEnabled: false,
  } });
  return { suffix, manager, participant, organization, program };
}

async function login(page: Page, email: string) {
  await page.goto("/login?next=/app/personal/feed");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.locator('input[type="password"]').fill(password);
  const response = page.waitForResponse((item) => new URL(item.url()).pathname === "/api/auth/login" && item.request().method() === "POST");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  expect((await response).status()).toBe(200);
  await expect(page).toHaveURL(new URL("/app/personal/feed", baseURL).toString());
  await expect(page.getByRole("heading", { name: "Início", exact: true })).toBeVisible();
}

async function screenshot(page: Page, info: TestInfo, name: string, width: number, height: number) {
  await page.setViewportSize({ width, height });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name} must not overflow at ${width}px`).toBe(true);
  await page.screenshot({ path: info.outputPath(`${name}-${width}.png`), fullPage: true });
}

test.afterAll(async () => { await db.$disconnect(); });

test("institution publication, discovery, program page and followed official feed journey", async ({ page, browser }, info) => {
  test.setTimeout(240_000);
  const f = await fixture();
  const participantContext = await browser.newContext({ baseURL, locale: "pt-BR" });
  const participantPage = await participantContext.newPage();
  const publicContext = await browser.newContext({ baseURL, locale: "pt-BR" });
  const publicPage = await publicContext.newPage();
  const publicText = `Atualização pública da instituição ${f.suffix}`;
  const platformText = `Atualização restrita à plataforma ${f.suffix}`;
  try {
    await login(page, f.manager.email);
    await page.getByRole("link", { name: "Participante", exact: true }).click();
    await expect(page).toHaveURL(new URL("/app/personal/feed", baseURL).toString());
    await expect(page.getByRole("heading", { name: "Início", exact: true })).toBeVisible();
    await page.goto("/app/settings/public-page");
    await expect(page.getByRole("heading", { name: "Página institucional", exact: true })).toBeVisible();

    await page.getByLabel("Apresentação curta", { exact: true }).fill("Apoio a iniciativas de inovação no Brasil");
    await page.getByLabel("Sobre a instituição", { exact: true }).fill("A instituição apoia programas e iniciativas de inovação.");
    await page.getByLabel("Cidade", { exact: true }).fill("Aracaju");
    await page.getByLabel("Estado", { exact: true }).fill("Sergipe");
    await page.getByPlaceholder("Tecnologia, empreendedorismo, pesquisa", { exact: true }).fill("Pesquisa, Tecnologia");
    await page.getByRole("button", { name: "Salvar informações", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Informações institucionais salvas.");
    const logoUpload = page.getByRole("button", { name: "Adicionar logotipo", exact: true });
    const storageNotice = page.getByText("O armazenamento de imagens não está configurado.", { exact: false });
    if (await logoUpload.isDisabled()) await expect(storageNotice).toBeVisible();
    else await expect(storageNotice).toHaveCount(0);
    await page.getByRole("button", { name: "Publicar página", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Página institucional publicada.");
    await page.getByRole("button", { name: "Publicar programa", exact: true }).click();
    await expect(page.getByRole("status")).toContainText(`Programa “${f.program.name}” publicado.`);

    await page.getByRole("button", { name: "Criar publicação oficial", exact: true }).click();
    const composer = page.getByRole("form", { name: "Criar publicação institucional", exact: true });
    await composer.getByPlaceholder("Compartilhe uma atualização institucional.", { exact: true }).fill(publicText);
    await composer.getByRole("button", { name: "Publicar", exact: true }).click();
    await expect(page.getByText(publicText, { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Criar publicação oficial", exact: true }).click();
    const restrictedComposer = page.getByRole("form", { name: "Criar publicação institucional", exact: true });
    await restrictedComposer.getByPlaceholder("Compartilhe uma atualização institucional.", { exact: true }).fill(platformText);
    await restrictedComposer.getByRole("combobox", { name: /^Visibilidade/ }).selectOption("PLATFORM");
    await restrictedComposer.getByRole("button", { name: "Publicar", exact: true }).click();
    await expect(page.getByText(platformText, { exact: true })).toBeVisible();
    const auditedPost = await db.socialPost.findFirstOrThrow({ where: { authorOrganizationId: f.organization.id, body: publicText }, select: { id: true, createdByUserId: true, revision: true } });
    expect(auditedPost).toEqual({ id: expect.any(String), createdByUserId: f.manager.id, revision: 1 });

    await login(participantPage, f.participant.email);
    await participantPage.goto("/institutions");
    await expect(participantPage.getByRole("heading", { name: "Instituições", exact: true })).toBeVisible();
    await participantPage.getByLabel("Buscar por instituição ou localização", { exact: true }).fill(f.organization.name);
    await participantPage.getByRole("button", { name: "Buscar", exact: true }).click();
    await expect(participantPage.getByRole("link").filter({ hasText: f.organization.name }).first()).toBeVisible();
    await participantPage.getByRole("link").filter({ hasText: f.organization.name }).first().click();
    await expect(participantPage.getByRole("heading", { name: f.organization.name, exact: true })).toBeVisible();
    await participantPage.getByRole("button", { name: "Seguir instituição", exact: true }).click();
    await expect(participantPage.getByRole("button", { name: "Seguindo", exact: true })).toHaveAttribute("aria-pressed", "true");
    await participantPage.goto("/app/personal/feed");
    const feedPost = participantPage.getByRole("article", { name: `Publicação de ${f.organization.name}`, exact: true }).filter({ hasText: publicText });
    await expect(feedPost).toBeVisible();
    await expect(participantPage.getByRole("article", { name: `Publicação de ${f.organization.name}`, exact: true }).filter({ hasText: platformText })).toBeVisible();
    await feedPost.getByRole("button", { name: "Curtir", exact: true }).click();
    await expect(feedPost.getByRole("button", { name: "Curtir", exact: true })).toHaveAttribute("aria-pressed", "true");
    await feedPost.getByRole("button", { name: "Comentar", exact: true }).click();
    const comments = feedPost.getByRole("region", { name: "Comentários da publicação", exact: true });
    await comments.getByLabel("Comentário", { exact: true }).fill("Acompanhar esta iniciativa ajuda a conhecer o programa.");
    await comments.getByRole("button", { name: "Comentar", exact: true }).click();
    await expect(comments).toContainText("Acompanhar esta iniciativa");
    expect(await db.organizationFollow.count({ where: { followerUserId: f.participant.id, organizationId: f.organization.id, endedAt: null } })).toBe(1);

    const accountTrigger = participantPage.getByRole("button", { name: `Abrir menu de Pessoa Participante ${f.suffix}`, exact: true });
    await accountTrigger.click();
    await expect(participantPage.getByRole("menu")).toBeVisible();
    await participantPage.keyboard.press("Escape");
    await expect(participantPage.getByRole("menu")).toHaveCount(0);
    await expect(accountTrigger).toBeFocused();
    await participantPage.setViewportSize({ width: 390, height: 844 });
    const mobileMenu = participantPage.getByRole("button", { name: "Abrir menu de navegação", exact: true });
    await mobileMenu.click();
    const drawer = participantPage.getByRole("dialog", { name: "Menu de navegação", exact: true });
    await expect(drawer).toBeVisible();
    const firstDrawerLink = drawer.getByRole("link", { name: "Atlas Innove", exact: true });
    const lastDrawerControl = drawer.getByRole("button", { name: `Abrir menu de Pessoa Participante ${f.suffix}`, exact: true });
    await expect(firstDrawerLink).toBeFocused();
    await participantPage.keyboard.press("Shift+Tab");
    await expect(lastDrawerControl).toBeFocused();
    await participantPage.keyboard.press("Tab");
    await expect(firstDrawerLink).toBeFocused();
    await participantPage.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
    await expect(mobileMenu).toBeFocused();

    await publicPage.goto(`/institutions/${f.organization.slug}`);
    await expect(publicPage.getByRole("heading", { name: f.organization.name, exact: true })).toBeVisible();
    await expect(publicPage.getByText(publicText, { exact: true })).toBeVisible();
    await expect(publicPage.getByText(platformText, { exact: true })).toHaveCount(0);
    await expect(publicPage.getByText(`Chamada pública ${f.suffix}`, { exact: true })).toBeVisible();
    await expect(publicPage.getByText(`Chamada interna ${f.suffix}`, { exact: true })).toHaveCount(0);
    await publicPage.getByRole("link", { name: /Ver programa/ }).click();
    await expect(publicPage).toHaveURL(new URL(`/institutions/${f.organization.slug}/programs/${f.program.slug}`, baseURL).toString());
    await expect(publicPage.getByRole("heading", { name: f.program.name, exact: true })).toBeVisible();
    await expect(publicPage.getByText(`Chamada pública ${f.suffix}`, { exact: true })).toBeVisible();
    await screenshot(publicPage, info, "institution-program", 1440, 1000);
    await screenshot(publicPage, info, "institution-program", 390, 844);
  } finally {
    await participantContext.close();
    await publicContext.close();
  }
});
