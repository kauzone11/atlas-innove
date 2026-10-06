import { test, expect, request, type APIRequestContext, type Page, type BrowserContext, type Locator, type TestInfo } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";

const password = "Disposable-social-browser-2026!";
const baseURL = process.env.INNOVE_BROWSER_BASE_URL ?? "http://127.0.0.1:3000";

async function fixture() {
  if (process.env.REQUIRE_DOMAIN_DATABASE !== "true" || !process.env.DATABASE_URL?.includes("atlas_innove_ci")) throw new Error("Social browser fixtures require the designated disposable CI database");
  const suffix = randomUUID().slice(0, 8);
  const passwordHash = await hash(password, 10);
  const users = await Promise.all(["Ana", "Bruno"].map((name) => db.user.create({ data: {
    email: `social-browser-${name.toLowerCase()}-${suffix}@example.test`, passwordHash,
    profile: { create: { fullName: `${name} Pesquisa`, phone: "private-social-marker" } },
    innovationProfile: { create: { handle: `${name.toLowerCase()}-social-${suffix}`, headline: "Pesquisa e desenvolvimento de soluções para inovação", bio: "Atuação em pesquisa aplicada e colaboração profissional.", profileVisibility: "PUBLIC", publishedAt: new Date(), directoryEnabled: true, collaborationStatus: "OPEN", experienceVisibility: "PUBLIC",
      experience: { create: { organizationName: "Laboratório de pesquisa aplicada", title: "Pesquisadora de inovação", startsAt: new Date("2020-01-01"), current: true, visibility: "PUBLIC", description: "Pesquisa, experimentação e desenvolvimento responsável. ".repeat(25) } },
    } },
  }, include: { innovationProfile: true } })));
  const ids = users.map((user) => user.id);
  return { a: users[0], b: users[1], ids, async cleanup() {
    await db.safetyReport.deleteMany({ where: { reporterUserId: { in: ids } } });
    await db.notification.deleteMany({ where: { OR: [{ recipientUserId: { in: ids } }, { actorUserId: { in: ids } }] } });
    await db.socialPost.deleteMany({ where: { authorUserId: { in: ids }, repostOfPostId: { not: null } } });
    await db.socialPost.deleteMany({ where: { authorUserId: { in: ids } } });
    await db.userBlock.deleteMany({ where: { OR: [{ blockerUserId: { in: ids } }, { blockedUserId: { in: ids } }] } });
    await db.networkConnection.deleteMany({ where: { OR: [{ userAId: { in: ids } }, { userBId: { in: ids } }] } });
    await db.connectionRequest.deleteMany({ where: { requesterUserId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
  } };
}

async function login(page: Page, email: string) {
  await page.goto("/login?next=/app/personal/feed");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  const loginResponse = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/auth/login" && response.request().method() === "POST");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  expect((await loginResponse).status()).toBe(200);
  await expect(page).toHaveURL(new URL("/app/personal/feed", baseURL).toString());
  await expect(page.getByRole("heading", { name: "Início", exact: true })).toBeVisible();
  expect((await page.context().cookies()).some((cookie) => cookie.name === "atlas_innove_session")).toBe(true);
}

async function authenticatedApi(context: BrowserContext) {
  const session = (await context.cookies()).find((cookie) => cookie.name === "atlas_innove_session");
  expect(session?.httpOnly).toBe(true);
  expect(session?.secure).toBe(true);
  expect(session?.sameSite).toBe("Lax");
  if (!session) throw new Error("The browser login did not establish a session");
  // APIRequestContext does not send a secure cookie over the disposable HTTP runtime.
  return request.newContext({ baseURL, extraHTTPHeaders: { Cookie: `${session.name}=${session.value}`, Origin: baseURL } });
}

function recordErrors(page: Page, errors: string[]) {
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error" && !message.text().includes("net::ERR_FAILED") && !/Failed to load resource: the server responded with a status of 4\d\d/.test(message.text())) errors.push(message.text()); });
  page.on("response", (response) => { if (response.status() >= 500) errors.push(`HTTP ${response.status()} ${response.url()}`); });
}

async function expectReadableWords(locator: Locator) {
  await expect(locator).toBeVisible();
  const issues = await locator.evaluate((element) => {
    const bounds = element.getBoundingClientRect(); const failures: string[] = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      for (const match of (node.textContent ?? "").matchAll(/\p{L}[\p{L}\p{M}]*/gu)) {
        const range = document.createRange(); range.setStart(node, match.index); range.setEnd(node, match.index + match[0].length);
        const rects = [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0);
        if (new Set(rects.map((rect) => Math.round(rect.top))).size > 1 || rects.some((rect) => rect.left < bounds.left - 1 || rect.right > bounds.right + 1)) failures.push(match[0]);
      }
    }
    return failures;
  });
  expect(issues, `Words must remain readable without splitting or clipping: ${await locator.innerText()}`).toEqual([]);
}

async function screenshot(page: Page, info: TestInfo, name: string, widths = [1600, 1440, 1280, 1024, 768, 430, 390, 375, 320]) {
  const heights: Record<number, number> = { 1600: 1000, 1440: 900, 1280: 800, 1024: 768, 768: 1024, 430: 932, 390: 844, 375: 812, 320: 568 };
  for (const width of widths) {
    await page.setViewportSize({ width, height: heights[width] });
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement && document.activeElement.getAttribute("aria-expanded") !== "true") document.activeElement.blur();
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      document.querySelectorAll<HTMLElement>('[role="dialog"]').forEach((dialog) => dialog.scrollTo({ top: 0, left: 0, behavior: "instant" }));
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${name} overflow at ${width}`).toBe(true);
    await page.screenshot({ path: info.outputPath(`${name}-${width}.png`), fullPage: true });
  }
}

test.afterAll(async () => { await db.$disconnect(); });

test("professional social journey preserves audiences, notifications, keyboard interaction and mobile layout", async ({ page, browser }, info) => {
  test.setTimeout(240_000);
  const f = await fixture(); const errors: string[] = [];
  const bContext = await browser.newContext({ baseURL, locale: "pt-BR" }); const bPage = await bContext.newPage();
  const publicContext = await browser.newContext({ baseURL, locale: "pt-BR" }); const publicPage = await publicContext.newPage();
  recordErrors(page, errors); recordErrors(bPage, errors); recordErrors(publicPage, errors);
  try {
    await login(page, f.a.email);
    await screenshot(page, info, "empty-feed");
    await page.goto("/app/personal/profile"); await screenshot(page, info, "profile-no-activity", [1440, 390]);
    await page.goto("/app/personal/profile/edit");
    await page.getByRole("combobox", { name: /^Quem pode seguir você/ }).selectOption("EVERYONE");
    await page.getByRole("combobox", { name: /^Ação principal no perfil/ }).selectOption("FOLLOW");
    await page.getByRole("button", { name: "Salvar preferências", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Preferências salvas.");
    await page.reload(); await expect(page.getByRole("combobox", { name: /^Ação principal no perfil/ })).toHaveValue("FOLLOW");
    await page.goto("/app/personal/feed");
    const trigger = page.getByRole("button", { name: "Compartilhe uma atualização…", exact: true });
    await trigger.focus(); await page.keyboard.press("Enter");
    const composer = page.getByRole("dialog", { name: "Criar publicação", exact: true });
    await expect(composer).toBeVisible();
    await page.keyboard.press("Escape"); await expect(composer).not.toBeVisible(); await expect(trigger).toBeFocused();
    await trigger.click();
    await composer.getByRole("textbox", { name: /^Publicação/ }).fill("Nova pesquisa aplicada com parceiros do ecossistema. Compartilhamos aprendizados e evidências desta etapa.");
    await composer.getByRole("combobox", { name: /^Visibilidade/ }).selectOption("PUBLIC");
    await composer.getByRole("button", { name: "Adicionar link", exact: true }).click();
    await composer.getByLabel("Link externo (opcional)", { exact: true }).fill("https://example.test/pesquisa");
    await screenshot(page, info, "composer");
    await composer.getByRole("button", { name: "Publicar", exact: true }).focus();
    await page.keyboard.press("Tab"); await expect(composer.getByRole("button", { name: "Fechar janela", exact: true })).toBeFocused();
    await composer.getByRole("button", { name: "Publicar", exact: true }).click(); await expect(composer).not.toBeVisible();
    const created = await db.socialPost.findFirstOrThrow({ where: { authorUserId: f.a.id, deletedAt: null } });
    const postPath = `/posts/${created.id}`;
    const ownCard = page.getByRole("article", { name: "Publicação de Ana Pesquisa", exact: true });
    await ownCard.getByLabel("Mais ações na publicação de Ana Pesquisa", { exact: true }).click();
    await ownCard.getByRole("button", { name: "Destacar no perfil", exact: true }).click();
    await expect(ownCard.getByRole("button", { name: "Retirar do destaque", exact: true })).toBeVisible();
    await ownCard.getByRole("button", { name: "Editar publicação", exact: true }).click();
    const editor = page.getByRole("dialog", { name: "Editar publicação", exact: true });
    await editor.getByRole("textbox", { name: /^Publicação/ }).fill("Nova pesquisa aplicada com parceiros do ecossistema. Síntese atualizada com aprendizados e evidências desta etapa.");
    await editor.getByRole("button", { name: "Salvar alterações", exact: true }).click(); await expect(editor).not.toBeVisible();
    await expect(ownCard).toContainText("Síntese atualizada"); await expect(ownCard.getByText("Editado", { exact: true })).toBeVisible();
    expect((await db.socialPost.findUniqueOrThrow({ where: { id: created.id } })).externalUrl).toBe("https://example.test/pesquisa");
    await ownCard.getByRole("button", { name: "Editar publicação", exact: true }).click();
    await expect(editor.getByRole("textbox", { name: /^Publicação/ })).toHaveValue(/Síntese atualizada/);
    await expect(editor.getByLabel("Link externo (opcional)", { exact: true })).toHaveValue("https://example.test/pesquisa");
    await editor.getByRole("textbox", { name: /^Publicação/ }).fill("Nova pesquisa aplicada com parceiros do ecossistema. Síntese atualizada e revisada com aprendizados e evidências desta etapa.");
    await editor.getByRole("button", { name: "Salvar alterações", exact: true }).click(); await expect(editor).not.toBeVisible();
    await expect(ownCard).toContainText("Síntese atualizada e revisada");
    await ownCard.getByRole("button", { name: "Editar publicação", exact: true }).click();
    await expect(editor.getByRole("textbox", { name: /^Publicação/ })).toHaveValue(/Síntese atualizada e revisada/);
    await expect(editor.getByLabel("Link externo (opcional)", { exact: true })).toHaveValue("https://example.test/pesquisa");
    await editor.getByRole("button", { name: "Cancelar", exact: true }).click(); await expect(editor).not.toBeVisible();
    await login(bPage, f.b.email);
    await bPage.goto(`/app/personal/network/people/${f.a.innovationProfile!.handle}`);
    await expect(bPage.getByRole("heading", { name: "Ana Pesquisa", exact: true })).toBeVisible();
    await screenshot(bPage, info, "other-profile");
    await bPage.getByRole("button", { name: "Seguir", exact: true }).focus(); await bPage.keyboard.press("Enter");
    await expect(bPage.getByRole("button", { name: "Seguindo", exact: true })).toHaveAttribute("aria-pressed", "true");
    expect(await db.networkConnection.count({ where: { OR: [{ userAId: f.b.id }, { userBId: f.b.id }] } })).toBe(0);
    await bPage.goto("/app/personal/feed");
    const card = bPage.getByRole("article", { name: "Publicação de Ana Pesquisa", exact: true });
    await expect(card).toBeVisible(); await expect(card).toContainText("Nova pesquisa aplicada");
    await card.getByRole("button", { name: "Escolher reação", exact: true }).click();
    await screenshot(bPage, info, "reaction-menu", [1440, 390, 320]);
    for (const label of ["Parabéns", "Divertido"]) await expectReadableWords(card.getByRole("group", { name: "Reações", exact: true }).getByRole("button", { name: label, exact: true }));
    await card.getByRole("group", { name: "Reações", exact: true }).getByRole("button", { name: "Genial", exact: true }).click();
    await expect(card.getByRole("button", { name: "Genial", exact: true })).toHaveAttribute("aria-pressed", "true");
    await card.getByRole("button", { name: "1 reação", exact: true }).click();
    const reactionPeople = bPage.getByRole("dialog", { name: "Reações", exact: true });
    await expect(reactionPeople).toContainText("Bruno Pesquisa"); await expect(reactionPeople).toContainText("Genial");
    await reactionPeople.getByRole("button", { name: "Fechar janela", exact: true }).click();
    await card.getByLabel("Mais ações na publicação de Ana Pesquisa", { exact: true }).click();
    await card.getByRole("button", { name: "Salvar publicação", exact: true }).click();
    await expect(card.getByRole("button", { name: "Remover dos salvos", exact: true })).toBeVisible();
    await bPage.goto("/app/personal/saved-posts"); await expect(bPage.getByRole("article", { name: "Publicação de Ana Pesquisa", exact: true })).toBeVisible();
    await bPage.goto("/app/personal/feed");
    await card.getByRole("button", { name: "Comentar", exact: true }).click();
    const comments = card.getByRole("region", { name: "Comentários da publicação", exact: true });
    await comments.getByLabel("Comentário", { exact: true }).fill("Quais aprendizados poderão ser compartilhados com outras equipes?");
    await comments.getByRole("button", { name: "Comentar", exact: true }).click();
    await expect(comments).toContainText("Quais aprendizados"); await expect(card.getByRole("button", { name: "1 comentário", exact: true })).toBeVisible();
    await screenshot(bPage, info, "feed-comments");
    await card.getByRole("button", { name: "Repostar", exact: true }).click();
    const repost = bPage.getByRole("dialog", { name: "Repostar publicação", exact: true });
    await repost.getByRole("textbox", { name: /^Seu comentário \(opcional\)/ }).fill("Uma contribuição para nossa colaboração profissional.");
    await repost.getByRole("button", { name: "Repostar", exact: true }).click(); await expect(repost).not.toBeVisible();
    await expect(bPage.getByRole("article", { name: "Publicação de Bruno Pesquisa", exact: true })).toContainText("Repostagem de");
    await screenshot(bPage, info, "repost");
    await bContext.grantPermissions(["clipboard-read", "clipboard-write"]);
    await card.getByRole("button", { name: "Compartilhar", exact: true }).click();
    await expect(card.getByRole("status")).toContainText("Link da publicação copiado");
    expect(await bPage.evaluate(() => navigator.clipboard.readText())).toBe(`${baseURL}${postPath}`);
    await page.goto("/app/notifications");
    await expect(page.getByText("Sua publicação recebeu um comentário", { exact: true })).toBeVisible();
    await expect(page.getByText("Sua publicação foi repostada", { exact: true })).toBeVisible();
    await page.goto(postPath);
    const aComments = page.getByRole("region", { name: "Comentários da publicação", exact: true });
    await aComments.getByRole("button", { name: "Responder", exact: true }).click();
    await aComments.getByLabel("Resposta", { exact: true }).fill("Vamos publicar a síntese desta etapa para compartilhar o aprendizado.");
    await aComments.getByRole("button", { name: "Responder", exact: true }).last().click();
    await expect(aComments).toContainText("Vamos publicar a síntese");
    await screenshot(page, info, "post-comments");
    await page.goto("/app/personal/profile/followers"); await expect(page.getByRole("heading", { name: "Seguidores", exact: true })).toBeVisible(); await expect(page.getByRole("link", { name: "Bruno Pesquisa", exact: true })).toBeVisible(); await screenshot(page, info, "followers");
    await bPage.goto("/app/personal/profile/following"); await expect(bPage.getByRole("heading", { name: "Seguindo", exact: true })).toBeVisible(); await expect(bPage.getByRole("link", { name: "Ana Pesquisa", exact: true })).toBeVisible(); await screenshot(bPage, info, "following");
    await page.goto("/app/personal/profile/activity"); await expect(page.getByRole("heading", { name: "Atividade", exact: true })).toBeVisible(); await expect(page.getByRole("article", { name: "Publicação de Ana Pesquisa", exact: true })).toBeVisible(); await screenshot(page, info, "activity");
    await page.goto("/app/personal/profile"); await expect(page.getByRole("heading", { name: "Em destaque", exact: true })).toBeVisible(); await screenshot(page, info, "own-profile");
    await publicPage.goto(`/people/${f.a.innovationProfile!.handle}`); await screenshot(publicPage, info, "public-profile");
    await publicPage.goto(postPath); await expect(publicPage.getByRole("article", { name: "Publicação de Ana Pesquisa", exact: true })).toBeVisible();
    await expect(publicPage.getByRole("link", { name: "Entrar para interagir", exact: true })).toBeVisible();
    await publicPage.getByRole("link", { name: "Ver respostas", exact: true }).click();
    await expect(publicPage).toHaveURL((url) => url.pathname === postPath && Boolean(url.searchParams.get("parentCommentId"))); await expect(publicPage.getByText("Vamos publicar a síntese desta etapa para compartilhar o aprendizado.", { exact: true })).toBeVisible();
    await publicPage.getByRole("link", { name: "Voltar aos comentários", exact: true }).click();
    await expect(publicPage).toHaveURL(new URL(postPath, baseURL).toString());
    await expect(publicPage.getByText("Quais aprendizados poderão ser compartilhados com outras equipes?", { exact: true })).toBeVisible(); await screenshot(publicPage, info, "public-post"); await page.emulateMedia({ reducedMotion: "reduce" }); await page.setViewportSize({ width: 1280, height: 900 });
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    await expectReadableWords(page.getByRole("heading", { name: "Ana Pesquisa", exact: true }));
    const compactMonograms = page.getByRole("article", { name: "Publicação de Ana Pesquisa", exact: true }).locator("header .atlas-avatar-small");
    expect(await compactMonograms.count()).toBeGreaterThan(0);
    for (const monogram of await compactMonograms.all()) {
      await expect(monogram).toHaveText("AP");
      const geometry = await monogram.evaluate((element) => {
        const bounds = element.getBoundingClientRect(); const range = document.createRange(); range.selectNodeContents(element);
        const rects = [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0);
        return { lines: new Set(rects.map((rect) => Math.round(rect.top))).size, contained: rects.every((rect) => rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1 && rect.top >= bounds.top - 1 && rect.bottom <= bounds.bottom + 1) };
      });
      expect(geometry, "Both decorative avatar initials must remain on one line inside the avatar at 200% text").toEqual({ lines: 1, contained: true });
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.screenshot({ path: info.outputPath("profile-text-200-percent.png"), fullPage: true });
    await page.goto(`/app/personal/network/people/${f.b.innovationProfile!.handle}`);
    await page.getByText("Outras ações", { exact: true }).click(); await page.getByRole("button", { name: "Bloquear pessoa", exact: true }).click();
    await page.getByRole("dialog", { name: "Bloquear pessoa", exact: true }).getByRole("button", { name: "Confirmar", exact: true }).click();
    await expect.poll(() => db.userBlock.count({ where: { blockerUserId: f.a.id, blockedUserId: f.b.id } })).toBe(1);
    await bPage.goto("/app/personal/feed"); await expect(bPage.getByRole("article", { name: "Publicação de Ana Pesquisa", exact: true })).toHaveCount(0);
    const apiB = await authenticatedApi(bContext);
    try {
      const denied = await apiB.post(`/api/personal/social/posts/${created.id}/reaction`, { data: { type: "LIKE" } });
      expect(denied.status()).toBe(404);
    } finally { await apiB.dispose(); }
    expect(errors).toEqual([]);
  } finally { await bContext.close(); await publicContext.close(); await f.cleanup(); }
});

test("social HTTP rejects forged ownership, restricted public content, foreign origins and invalid targets", async ({ page, browser }) => {
  const f = await fixture(); let other: BrowserContext | undefined; let apiA: APIRequestContext | undefined; let apiB: APIRequestContext | undefined;
  try {
    await login(page, f.a.email);
    other = await browser.newContext({ baseURL }); const bPage = await other.newPage(); await login(bPage, f.b.email);
    apiA = await authenticatedApi(page.context()); apiB = await authenticatedApi(other); const headers = { Origin: baseURL };
    const created = await apiA.post("/api/personal/social/posts", { headers, data: { body: "Private-social-content-marker", visibility: "CONNECTIONS" } });
    expect(created.status()).toBe(200); const post = await created.json() as { id: string };
    const authGet = await apiB.get(`/api/personal/social/posts/${post.id}`); expect(authGet.status()).toBe(404); expect(await authGet.text()).not.toContain("Private-social-content-marker");
    const anonymous = await browser.newContext({ baseURL });
    try { const response = await anonymous.request.get(`/posts/${post.id}`); expect(response.status()).toBe(404); expect(await response.text()).not.toContain("Private-social-content-marker"); } finally { await anonymous.close(); }
    for (const method of ["patch", "delete"] as const) expect((await apiB[method](`/api/personal/social/posts/${post.id}`, { headers, data: { body: "Forged update" } })).status()).toBe(404);
    expect((await apiA.post("/api/personal/social/posts", { headers: { Origin: "https://foreign.example.test" }, data: { body: "Foreign origin" } })).status()).toBe(403);
    expect((await apiA.post("/api/personal/social/posts", { headers, data: { body: "x".repeat(3001) } })).status()).toBe(400);
    expect((await apiA.post("/api/personal/social/posts", { headers, data: { externalUrl: "http://example.test/unsafe" } })).status()).toBe(400);
    const deleted = await apiA.delete(`/api/personal/social/posts/${post.id}`, { headers }); expect(deleted.status()).toBe(200);
    expect((await apiA.get(`/api/personal/social/posts/${post.id}`)).status()).toBe(404);
    expect((await apiB.post("/api/personal/social/reports", { headers, data: { postId: "foreign-target", reason: "SPAM" } })).status()).toBe(404);
  } finally { await apiA?.dispose(); await apiB?.dispose(); await other?.close(); await f.cleanup(); }
});
