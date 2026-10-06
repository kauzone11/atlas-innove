import { test, expect, request, type APIRequestContext, type BrowserContext, type Page, type Route, type TestInfo } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import sharp from "sharp";
import { DeleteObjectsCommand, GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { db } from "@/lib/db";
import type { MediaDto } from "@/lib/media/types";

const baseURL = process.env.INNOVE_BROWSER_BASE_URL ?? "http://127.0.0.1:3000";
const password = "Disposable-media-browser-2026!";
const enabled = process.env.INNOVE_MEDIA_BROWSER_TESTS === "true";
const storage = new S3Client({ endpoint: process.env.OBJECT_STORAGE_ENDPOINT, region: process.env.OBJECT_STORAGE_REGION ?? "us-east-1", forcePathStyle: true,
  credentials: { accessKeyId: process.env.OBJECT_STORAGE_ACCESS_KEY_ID ?? "", secretAccessKey: process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY ?? "" } });
const bucket = process.env.OBJECT_STORAGE_BUCKET ?? "";
const image = (color: string) => sharp({ create: { width: 1200, height: 800, channels: 3, background: color } }).png().withMetadata().toBuffer();

async function fixture() {
  if (process.env.REQUIRE_DOMAIN_DATABASE !== "true" || !process.env.DATABASE_URL?.includes("atlas_innove_ci")) throw new Error("Media browser fixtures require a designated disposable CI database");
  const suffix = randomUUID().slice(0, 8); const passwordHash = await hash(password, 10);
  const users = await Promise.all(["Ana", "Bruno"].map((name) => db.user.create({ data: {
    email: `media-browser-${name.toLowerCase()}-${suffix}@example.test`, passwordHash, profile: { create: { fullName: `${name} Imagem` } },
    innovationProfile: { create: { handle: `${name.toLowerCase()}-media-${suffix}`, headline: "Pesquisa aplicada e colaboração profissional", profileVisibility: "PUBLIC", publishedAt: new Date(), directoryEnabled: true, collaborationStatus: "OPEN", primaryProfileAction: "FOLLOW" } },
  }, include: { innovationProfile: true } })));
  const ids = users.map((user) => user.id);
  return { a: users[0], b: users[1], async cleanup() {
    const assets = await db.mediaAsset.findMany({ where: { ownerUserId: { in: ids } }, select: { id: true } });
    const keys = assets.flatMap(({ id }) => ["small", "medium", "large"].map((variant) => ({ Key: `media/${id}/${variant}.webp` })));
    if (keys.length) await storage.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys, Quiet: true } }));
    await db.safetyReport.deleteMany({ where: { reporterUserId: { in: ids } } });
    await db.notification.deleteMany({ where: { OR: [{ recipientUserId: { in: ids } }, { actorUserId: { in: ids } }] } });
    await db.socialPost.deleteMany({ where: { authorUserId: { in: ids }, repostOfPostId: { not: null } } });
    await db.socialPost.deleteMany({ where: { authorUserId: { in: ids } } });
    await db.innovationProfile.updateMany({ where: { userId: { in: ids } }, data: { avatarMediaId: null, coverMediaId: null } });
    await db.mediaAsset.deleteMany({ where: { ownerUserId: { in: ids } } });
    await db.userBlock.deleteMany({ where: { OR: [{ blockerUserId: { in: ids } }, { blockedUserId: { in: ids } }] } });
    await db.networkConnection.deleteMany({ where: { OR: [{ userAId: { in: ids } }, { userBId: { in: ids } }] } });
    await db.connectionRequest.deleteMany({ where: { OR: [{ requesterUserId: { in: ids } }, { recipientUserId: { in: ids } }] } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
  } };
}

async function login(page: Page, email: string) {
  await page.goto("/login?next=/app/personal/feed"); await page.getByLabel("E-mail", { exact: true }).fill(email); await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click(); await expect(page).toHaveURL(new URL("/app/personal/feed", baseURL).toString());
}
async function api(context: BrowserContext) {
  const session = (await context.cookies()).find((cookie) => cookie.name === "atlas_innove_session");
  if (!session) throw new Error("Browser login must establish the session");
  return request.newContext({ baseURL, extraHTTPHeaders: { Cookie: `${session.name}=${session.value}`, Origin: baseURL } });
}
async function upload(api: APIRequestContext, kind = "POST_IMAGE", color = "#BFCBC8") {
  const response = await api.post("/api/personal/media", { multipart: { kind, file: { name: "research.png", mimeType: "image/png", buffer: await image(color) } } });
  expect(response.status(), await response.text()).toBe(200); return (await response.json()).asset as MediaDto;
}
async function snapshot(page: Page, info: TestInfo, name: string) {
  for (const [width, height] of [[1600, 1000], [1440, 900], [1280, 800], [1024, 768], [768, 1024], [430, 932], [390, 844], [375, 812], [320, 568]]) {
    await page.setViewportSize({ width, height });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name} overflows at ${width}`).toBe(true);
    await page.screenshot({ path: info.outputPath(`${name}-${width}.png`), fullPage: true });
  }
}
async function stallUpload(page: Page) {
  let release!: () => void; let intercepted = false;
  const released = new Promise<void>((resolve) => { release = resolve; });
  const handler = async (route: Route) => {
    intercepted = true; let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([released, new Promise<void>((resolve) => { timeout = setTimeout(resolve, 15_000); })]);
      await route.abort("aborted").catch(() => undefined);
    } finally { clearTimeout(timeout); }
  };
  await page.route("**/api/personal/media", handler);
  return { wait: () => expect.poll(() => intercepted).toBe(true), async dispose() { release(); await page.unroute("**/api/personal/media", handler); } };
}
function recordErrors(page: Page, errors: string[]) {
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error" && /hydration|did not match|uncaught/i.test(message.text())) errors.push(message.text()); });
  page.on("response", (response) => { if (response.status() >= 500) errors.push(`HTTP ${response.status()} ${response.url()}`); });
}
async function composer(page: Page) {
  await page.goto("/app/personal/feed"); await page.getByRole("button", { name: /^Compartilhe uma atualização/ }).click();
  const dialog = page.getByRole("dialog", { name: "Criar publicação", exact: true }); await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Foto", exact: true })).toBeEnabled(); return dialog;
}

test.beforeEach(async () => { test.skip(!enabled, "Set INNOVE_MEDIA_BROWSER_TESTS=true with a private disposable S3-compatible bucket to run media browser proof"); });
test.afterAll(async () => { storage.destroy(); await db.$disconnect(); });

test("real object storage supports profile crop replacement, image composition and accessible social interaction", async ({ page, browser }, info) => {
  test.setTimeout(360_000); const f = await fixture(); const errors: string[] = [];
  const other = await browser.newContext({ baseURL, locale: "pt-BR" }); const visitor = await other.newPage();
  const anonymous = await browser.newContext({ baseURL }); let ownApi: APIRequestContext | undefined;
  recordErrors(page, errors); recordErrors(visitor, errors);
  try {
    await login(page, f.a.email); ownApi = await api(page.context());
    const configuration = await ownApi.get("/api/personal/media/config"); expect((await configuration.json()).enabled).toBe(true);
    await page.goto("/app/personal/profile/edit");
    await page.getByLabel("Selecionar foto de perfil", { exact: true }).setInputFiles({ name: "avatar.png", mimeType: "image/png", buffer: await image("#D8AA8A") });
    const crop = page.getByRole("dialog", { name: "Ajustar foto de perfil", exact: true }); await expect(crop).toBeVisible();
    await crop.getByLabel("Aproximar", { exact: true }).fill("1.5"); await crop.getByLabel("Posição horizontal", { exact: true }).fill("0.3");
    await snapshot(page, info, "avatar-crop"); await crop.getByRole("button", { name: "Salvar imagem", exact: true }).click(); await expect(crop).not.toBeVisible();
    const firstProfile = await db.innovationProfile.findUniqueOrThrow({ where: { userId: f.a.id } }); expect(firstProfile.avatarMediaId).toBeTruthy();
    const avatar = await db.mediaAsset.findUniqueOrThrow({ where: { id: firstProfile.avatarMediaId! } }); expect(avatar.width).toBe(avatar.height);
    const object = await storage.send(new GetObjectCommand({ Bucket: bucket, Key: avatar.storageKey })); const metadata = await sharp(await object.Body!.transformToByteArray()).metadata();
    expect(metadata.format).toBe("webp"); expect(metadata.exif).toBeUndefined(); expect(metadata.icc).toBeUndefined();
    expect((await anonymous.request.get(`${process.env.OBJECT_STORAGE_ENDPOINT}/${bucket}/${avatar.storageKey}`)).status()).toBe(403);
    expect((await anonymous.request.get(`/api/media/${avatar.id}`)).status()).toBe(200);
    await page.route("**/api/personal/media", (route) => route.abort("failed"));
    await page.getByLabel("Selecionar foto de perfil", { exact: true }).setInputFiles({ name: "replacement.png", mimeType: "image/png", buffer: await image("#BDAA92") });
    await crop.getByRole("button", { name: "Salvar imagem", exact: true }).click();
    await expect(crop.getByRole("alert")).toContainText("Confira sua conexão e tente novamente");
    expect((await db.innovationProfile.findUniqueOrThrow({ where: { userId: f.a.id } })).avatarMediaId).toBe(avatar.id);
    await page.unroute("**/api/personal/media");
    await crop.getByLabel("Aproximar", { exact: true }).fill("1.4");
    const stalledProfile = await stallUpload(page);
    try {
      await crop.getByRole("button", { name: "Salvar imagem", exact: true }).click(); await stalledProfile.wait();
      await expect(crop.getByRole("button", { name: "Cancelar envio", exact: true })).toBeEnabled();
      await crop.getByRole("button", { name: "Cancelar envio", exact: true }).click();
      await expect(crop.getByRole("alert")).toContainText("Envio interrompido");
      await expect(crop.getByLabel("Aproximar", { exact: true })).toHaveValue("1.4");
      await expect(crop.getByRole("button", { name: "Salvar imagem", exact: true })).toBeEnabled();
      expect((await db.innovationProfile.findUniqueOrThrow({ where: { userId: f.a.id } })).avatarMediaId).toBe(avatar.id);
    } finally { await stalledProfile.dispose(); }
    await crop.getByRole("button", { name: "Salvar imagem", exact: true }).click(); await expect(crop).not.toBeVisible();
    expect((await ownApi.get(`/api/media/${avatar.id}`)).status()).toBe(404);
    expect((await db.mediaAsset.findUniqueOrThrow({ where: { id: avatar.id } })).status).toBe("DELETED");
    await page.getByLabel("Selecionar imagem de capa", { exact: true }).setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: await image("#C7D5D0") });
    const coverCrop = page.getByRole("dialog", { name: "Ajustar imagem de capa", exact: true }); await coverCrop.getByLabel("Posição vertical", { exact: true }).fill("0.7");
    await coverCrop.getByRole("button", { name: "Salvar imagem", exact: true }).click(); await expect(coverCrop).not.toBeVisible();
    await page.reload(); await expect(page.getByRole("button", { name: "Alterar foto", exact: true })).toBeVisible(); await expect(page.getByRole("button", { name: "Alterar capa", exact: true })).toBeVisible();
    await page.goto("/app/personal/profile"); await snapshot(page, info, "profile-real-media");

    let dialog = await composer(page); await dialog.getByLabel("Selecionar imagens da publicação", { exact: true }).setInputFiles({ name: "one.png", mimeType: "image/png", buffer: await image("#D8CBB6") });
    await expect(dialog.getByLabel("Descrição da imagem (opcional)", { exact: true })).toHaveCount(1);
    await dialog.getByLabel("Descrição da imagem (opcional)", { exact: true }).fill("Protótipo usado pela equipe de pesquisa");
    const retryImage = { name: "retry.png", mimeType: "image/png", buffer: await image("#BCC8D5") };
    const stalledPost = await stallUpload(page);
    try {
      await dialog.getByLabel("Selecionar imagens da publicação", { exact: true }).setInputFiles(retryImage); await stalledPost.wait();
      await expect(dialog.getByRole("button", { name: "Publicar", exact: true })).toBeDisabled();
      await expect(dialog.getByRole("button", { name: "Cancelar envio", exact: true })).toBeEnabled();
      await dialog.getByRole("button", { name: "Cancelar envio", exact: true }).click();
      await expect(dialog.getByRole("alert")).toContainText("As imagens já preparadas foram mantidas");
      await expect(dialog.getByLabel("Descrição da imagem (opcional)", { exact: true })).toHaveCount(1);
      await expect(dialog.getByLabel("Descrição da imagem (opcional)", { exact: true })).toHaveValue("Protótipo usado pela equipe de pesquisa");
      await expect(dialog.getByRole("button", { name: "Foto", exact: true })).toBeEnabled();
    } finally { await stalledPost.dispose(); }
    await dialog.getByLabel("Selecionar imagens da publicação", { exact: true }).setInputFiles(retryImage);
    await expect(dialog.getByLabel("Descrição da imagem (opcional)", { exact: true })).toHaveCount(2);
    await dialog.getByRole("button", { name: "Remover imagem 2", exact: true }).click();
    await expect(dialog.getByLabel("Descrição da imagem (opcional)", { exact: true })).toHaveCount(1);
    await dialog.getByRole("combobox", { name: /^Visibilidade/ }).selectOption("PUBLIC"); await dialog.getByRole("button", { name: "Publicar", exact: true }).click(); await expect(dialog).not.toBeVisible();
    const single = await db.socialPost.findFirstOrThrow({ where: { authorUserId: f.a.id, media: { some: {} } }, include: { media: true } });
    expect(single.body).toBeNull(); expect(single.media).toHaveLength(1); await page.goto(`/posts/${single.id}`); await snapshot(page, info, "one-image-post");
    const singleImage = page.getByRole("button", { name: /^Ampliar imagem 1 de 1/ });
    const singleViewer = page.getByRole("dialog", { name: "Imagem 1 de 1", exact: true });
    await singleImage.click();
    await expect(singleViewer.getByRole("group", { name: "Imagem ampliada", exact: true })).toBeFocused();
    await page.keyboard.press("Tab"); await expect(singleViewer.getByRole("button", { name: "Fechar janela", exact: true })).toBeFocused();
    await page.keyboard.press("Escape"); await expect(singleViewer).not.toBeVisible(); await expect(singleImage).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(singleViewer.getByRole("group", { name: "Imagem ampliada", exact: true })).toBeFocused();
    await page.keyboard.press("Shift+Tab"); await expect(singleViewer.getByRole("button", { name: "Fechar janela", exact: true })).toBeFocused();
    await page.keyboard.press("Escape"); await expect(singleViewer).not.toBeVisible(); await expect(singleImage).toBeFocused();

    dialog = await composer(page); await dialog.getByLabel("Selecionar imagens da publicação", { exact: true }).setInputFiles(await Promise.all(["#BFCBC8", "#D8AA8A", "#C9C3D9", "#D8CBB6"].map(async (color, index) => ({ name: `image-${index + 1}.png`, mimeType: "image/png", buffer: await image(color) }))));
    const descriptions = dialog.getByLabel("Descrição da imagem (opcional)", { exact: true }); await expect(descriptions).toHaveCount(4);
    for (let index = 0; index < 4; index++) await descriptions.nth(index).fill(`Registro da pesquisa ${index + 1}`);
    await dialog.getByRole("button", { name: "Mover imagem 2 para antes", exact: true }).click(); await expect(descriptions.first()).toHaveValue("Registro da pesquisa 2");
    await dialog.getByRole("button", { name: "Remover imagem 4", exact: true }).click(); await expect(descriptions).toHaveCount(3);
    await dialog.getByLabel("Selecionar imagens da publicação", { exact: true }).setInputFiles({ name: "final.png", mimeType: "image/png", buffer: await image("#CEC7B7") }); await expect(descriptions).toHaveCount(4);
    await descriptions.nth(3).fill("Registro da pesquisa 5"); await dialog.getByRole("combobox", { name: /^Visibilidade/ }).selectOption("PUBLIC"); await snapshot(page, info, "four-image-composer");
    await dialog.getByRole("button", { name: "Publicar", exact: true }).click(); await expect(dialog).not.toBeVisible();
    const four = await db.socialPost.findFirstOrThrow({ where: { authorUserId: f.a.id, id: { not: single.id } }, include: { media: { orderBy: { position: "asc" } } } });
    expect(four.body).toBeNull(); expect(four.media.map((item) => item.altText)).toEqual(["Registro da pesquisa 2", "Registro da pesquisa 1", "Registro da pesquisa 3", "Registro da pesquisa 5"]);
    await page.goto(`/posts/${four.id}`); await snapshot(page, info, "four-image-post");
    const openImage = page.getByRole("button", { name: /^Ampliar imagem 1 de 4/ }); await openImage.focus(); await page.keyboard.press("Enter");
    const viewer = page.getByRole("dialog", { name: "Imagem 1 de 4", exact: true }); await expect(viewer).toBeVisible();
    await expect(viewer.getByRole("group", { name: "Imagem ampliada", exact: true })).toBeFocused();
    await page.keyboard.press("ArrowRight"); await expect(page.getByRole("dialog", { name: "Imagem 2 de 4", exact: true })).toBeVisible();
    await page.keyboard.press("ArrowLeft"); await expect(viewer).toBeVisible();
    await page.keyboard.press("Escape"); await expect(page.getByRole("dialog")).toHaveCount(0); await expect(openImage).toBeFocused();

    await login(visitor, f.b.email); await visitor.goto(`/app/personal/network/people/${f.a.innovationProfile!.handle}`); await visitor.getByRole("button", { name: "Seguir", exact: true }).click();
    await expect(visitor.getByRole("button", { name: "Seguindo", exact: true })).toHaveAttribute("aria-pressed", "true");
    await visitor.goto(`/posts/${four.id}`); await visitor.getByRole("button", { name: "Escolher reação", exact: true }).click(); await visitor.getByRole("group", { name: "Reações", exact: true }).getByRole("button", { name: "Genial", exact: true }).click();
    const comments = visitor.getByRole("region", { name: "Comentários da publicação", exact: true }); await comments.getByLabel("Comentário", { exact: true }).fill("As imagens ajudam a compreender o experimento."); await comments.getByRole("button", { name: "Comentar", exact: true }).click(); await expect(comments).toContainText("As imagens ajudam");
    await visitor.getByRole("button", { name: "Repostar", exact: true }).click(); const repost = visitor.getByRole("dialog", { name: "Repostar publicação", exact: true }); await repost.getByRole("textbox", { name: /^Seu comentário/ }).fill("Compartilhando os registros de pesquisa."); await repost.getByRole("button", { name: "Repostar", exact: true }).click(); await expect(repost).not.toBeVisible();
    await visitor.goto("/app/personal/feed"); await expect(visitor.getByRole("article", { name: "Publicação de Bruno Imagem", exact: true }).getByRole("button", { name: /^Ampliar imagem 1 de 4/ })).toBeVisible(); await snapshot(visitor, info, "image-repost-feed");
    await page.goto(`/posts/${four.id}`); await page.emulateMedia({ reducedMotion: "reduce" }); await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true); await page.screenshot({ path: info.outputPath("image-post-text-200-percent.png"), fullPage: true });
    expect(errors).toEqual([]);
  } finally { await ownApi?.dispose(); await other.close(); await anonymous.close(); await f.cleanup(); }
});

test("media HTTP preserves ownership, S3 privacy and current post/profile visibility after connection block deletion and unpublish", async ({ page, browser }) => {
  test.setTimeout(240_000); const f = await fixture(); const other = await browser.newContext({ baseURL }); const anonymous = await browser.newContext({ baseURL });
  let a: APIRequestContext | undefined; let b: APIRequestContext | undefined;
  try {
    await login(page, f.a.email); const otherPage = await other.newPage(); await login(otherPage, f.b.email); a = await api(page.context()); b = await api(other);
    const asset = await upload(a); const created = await a.post("/api/personal/social/posts", { data: { visibility: "CONNECTIONS", media: [{ mediaId: asset.id, altText: "Restricted research image" }] } }); expect(created.status(), await created.text()).toBe(200); const post = await created.json() as { id: string };
    expect((await a.get(asset.url)).status()).toBe(200); expect((await b.get(asset.url)).status()).toBe(404); expect((await anonymous.request.get(asset.url)).status()).toBe(404);
    expect((await b.post("/api/personal/social/posts", { data: { visibility: "PUBLIC", media: [{ mediaId: asset.id }] } })).status()).toBe(404);
    expect((await b.delete(`/api/personal/media/${asset.id}`)).status()).toBe(404);
    const requestConnection = await b.post("/api/personal/network/connections", { data: { recipientUserId: f.a.id } }); expect(requestConnection.status()).toBe(201); const connection = await requestConnection.json() as { id: string };
    expect((await a.patch(`/api/personal/network/connections/${connection.id}`, { data: { action: "accept" } })).status()).toBe(200); expect((await b.get(asset.url)).status()).toBe(200);
    expect((await a.post("/api/personal/network/blocks", { data: { blockedUserId: f.b.id } })).status()).toBe(200); expect((await b.get(asset.url)).status()).toBe(404); expect((await b.get(`/posts/${post.id}`)).status()).toBe(404);
    expect((await a.delete(`/api/personal/social/posts/${post.id}`)).status()).toBe(200); expect((await a.get(asset.url)).status()).toBe(404); expect((await anonymous.request.get(asset.url)).status()).toBe(404);

    const avatar = await upload(a, "PROFILE_AVATAR"); expect((await a.patch("/api/personal/profile/media", { data: { kind: "PROFILE_AVATAR", mediaId: avatar.id } })).status()).toBe(200);
    const cover = await upload(a, "PROFILE_COVER"); expect((await a.patch("/api/personal/profile/media", { data: { kind: "PROFILE_COVER", mediaId: cover.id } })).status()).toBe(200);
    expect((await b.patch("/api/personal/profile/media", { data: { kind: "PROFILE_AVATAR", mediaId: avatar.id } })).status()).toBe(404);
    const publicAsset = await upload(a); const publicCreated = await a.post("/api/personal/social/posts", { data: { visibility: "PUBLIC", media: [{ mediaId: publicAsset.id }] } }); expect(publicCreated.status()).toBe(200);
    for (const item of [avatar, cover, publicAsset]) { const response = await anonymous.request.get(item.url); expect(response.status()).toBe(200); expect(response.headers()["content-type"]).toContain("image/webp"); expect(response.headers()["x-content-type-options"]).toBe("nosniff"); expect(response.headers()["cache-control"]).toContain("no-store"); }
    expect((await a.patch("/api/personal/profile", { data: { section: "unpublish" } })).status()).toBe(200);
    for (const item of [avatar, cover, publicAsset]) expect((await anonymous.request.get(item.url)).status()).toBe(404);
    expect((await a.get(avatar.url)).status()).toBe(200);
    expect((await a.delete("/api/personal/network/blocks", { data: { blockedUserId: f.b.id } })).status()).toBe(200);
    expect((await a.patch("/api/personal/profile", { data: { section: "privacy", data: { profileVisibility: "PLATFORM", skillsVisibility: "PRIVATE", experienceVisibility: "PRIVATE", educationVisibility: "PRIVATE", linksVisibility: "PRIVATE", verifiedParticipationVisibility: "PRIVATE", projectsVisibility: "PRIVATE" } } })).status()).toBe(200);
    expect((await b.get(avatar.url)).status()).toBe(200); expect((await anonymous.request.get(avatar.url)).status()).toBe(404);

    const forged = await a.post("/api/personal/media", { multipart: { kind: "POST_IMAGE", file: { name: "fake.png", mimeType: "image/png", buffer: Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>") } } }); expect(forged.status()).toBe(400);
    expect((await a.post("/api/personal/media", { headers: { Origin: "https://foreign.example.test" }, multipart: { kind: "POST_IMAGE", file: { name: "image.png", mimeType: "image/png", buffer: await image("#ffffff") } } })).status()).toBe(403);
    for (const id of ["nonexistent", "..%2Fprivate", "invalid%3Cscript%3E"]) expect((await anonymous.request.get(`/api/media/${id}`)).status()).toBe(404);
  } finally { await a?.dispose(); await b?.dispose(); await other.close(); await anonymous.close(); await f.cleanup(); }
});
