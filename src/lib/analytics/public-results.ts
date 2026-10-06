import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { DomainConflictError, ResourceNotFoundError } from "@/lib/errors";
import { isUniqueConstraintError } from "@/lib/http";
import { publicHandleSchema } from "@/lib/identity/normalization";
import { assertAnalyticsAccess } from "@/lib/analytics/access";
import type { AnalyticsAccess } from "@/lib/analytics/types";
import { parseAnalyticsReportPayload, publicReportPayloadSchema } from "@/lib/analytics/report-schemas";
import { buildPublicReportPayload, publicPayloadDigest } from "@/lib/analytics/public-payload";
export type { PublicReportPayload } from "@/lib/analytics/report-schemas";

export const analyticsSettingsSchema = z.object({ publicMinimumCellSize: z.number().int().min(3, "Use no mínimo 3 registros por grupo.").max(20, "Use até 20 registros por grupo.") }).strict();
export const publishPublicResultSchema = z.object({ slug: publicHandleSchema, title: z.string().trim().min(3).max(160), summary: z.string().trim().max(1200).nullable().optional(), previewDigest: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export type PublishPublicResultInput = z.input<typeof publishPublicResultSchema>;

async function previewInTransaction(client: Prisma.TransactionClient, access: AnalyticsAccess, reportId: string) {
  await assertAnalyticsAccess(access, "MANAGER", client);
  const report = await client.analyticsReportSnapshot.findFirst({ where: { organizationId: access.organizationId, id: reportId, archivedAt: null }, select: { type: true, payload: true, analyticsSchemaVersion: true } });
  if (!report) throw new ResourceNotFoundError("ANALYTICS_REPORT_NOT_FOUND");
  const setting = await client.organizationAnalyticsSettings.findUnique({ where: { organizationId: access.organizationId }, select: { publicMinimumCellSize: true } });
  const minimumCellSize = setting?.publicMinimumCellSize ?? 5;
  const payload = buildPublicReportPayload(parseAnalyticsReportPayload(report.type, report.analyticsSchemaVersion, report.payload), minimumCellSize);
  return { payload, digest: publicPayloadDigest(payload), minimumCellSize };
}

export async function previewPublicResult(access: AnalyticsAccess, reportId: string) {
  return db.$transaction((client) => previewInTransaction(client, access, reportId), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

export async function publishPublicResult(access: AnalyticsAccess, reportId: string, rawInput: PublishPublicResultInput) {
  const input = publishPublicResultSchema.parse(rawInput);
  try {
    return await db.$transaction(async (client) => {
      await assertAnalyticsAccess(access, "MANAGER", client);
      // Settings and archive state remain fixed between the approved preview check and publication.
      await client.$queryRaw`SELECT "id" FROM "AnalyticsReportSnapshot" WHERE "organizationId" = ${access.organizationId} AND "id" = ${reportId} FOR SHARE`;
      await client.$queryRaw`SELECT "organizationId" FROM "OrganizationAnalyticsSettings" WHERE "organizationId" = ${access.organizationId} FOR SHARE`;
      const preview = await previewInTransaction(client, access, reportId);
      if (input.previewDigest !== preview.digest) throw new DomainConflictError("ANALYTICS_PUBLIC_PREVIEW_CHANGED");
      const publication = await client.publicResultPublication.create({ data: { organizationId: access.organizationId, reportSnapshotId: reportId, slug: input.slug, title: input.title, summary: input.summary || null, publicPayload: preview.payload as unknown as Prisma.InputJsonObject, publicPayloadDigest: preview.digest, publicMinimumCellSize: preview.minimumCellSize, createdByUserId: access.userId, publishedByUserId: access.userId, publishedAt: new Date() }, select: { id: true, slug: true } });
      return publication;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (isUniqueConstraintError(error)) throw new DomainConflictError("ANALYTICS_PUBLIC_SLUG_UNAVAILABLE");
    throw error;
  }
}

export async function unpublishPublicResult(access: AnalyticsAccess, publicationId: string) {
  return db.$transaction(async (client) => {
    await assertAnalyticsAccess(access, "MANAGER", client);
    const existing = await client.publicResultPublication.findFirst({ where: { organizationId: access.organizationId, id: publicationId }, select: { id: true, unpublishedAt: true } });
    if (!existing) throw new ResourceNotFoundError("ANALYTICS_PUBLIC_RESULT_NOT_FOUND");
    if (!existing.unpublishedAt) await client.publicResultPublication.updateMany({ where: { organizationId: access.organizationId, id: publicationId, unpublishedAt: null }, data: { unpublishedAt: new Date() } });
    return { id: existing.id };
  });
}

export async function getAnalyticsSettings(access: AnalyticsAccess) {
  await assertAnalyticsAccess(access, "MANAGER");
  const settings = await db.organizationAnalyticsSettings.findUnique({ where: { organizationId: access.organizationId }, select: { publicMinimumCellSize: true } });
  return { publicMinimumCellSize: settings?.publicMinimumCellSize ?? 5 };
}

export async function updateAnalyticsSettings(access: AnalyticsAccess, rawInput: z.input<typeof analyticsSettingsSchema>) {
  const input = analyticsSettingsSchema.parse(rawInput);
  return db.$transaction(async (client) => {
    await assertAnalyticsAccess(access, "MANAGER", client);
    return client.organizationAnalyticsSettings.upsert({ where: { organizationId: access.organizationId }, create: { organizationId: access.organizationId, ...input }, update: input, select: { publicMinimumCellSize: true } });
  });
}

export async function listInstitutionPublicResults(access: AnalyticsAccess) {
  await assertAnalyticsAccess(access);
  const records = await db.publicResultPublication.findMany({ where: { organizationId: access.organizationId }, select: { id: true, reportSnapshotId: true, slug: true, title: true, summary: true, publishedAt: true, unpublishedAt: true, publicMinimumCellSize: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100 });
  return records.map((record) => ({ ...record, publishedAt: record.publishedAt?.toISOString() ?? null, unpublishedAt: record.unpublishedAt?.toISOString() ?? null }));
}

const publicMetadataSelect = { slug: true, title: true, summary: true, publishedAt: true, organization: { select: { name: true } }, reportSnapshot: { select: { generatedAt: true } } } satisfies Prisma.PublicResultPublicationSelect;
const publishedWhere = { publishedAt: { not: null }, unpublishedAt: null, organization: { status: "ACTIVE" as const } };
function metadata(record: Prisma.PublicResultPublicationGetPayload<{ select: typeof publicMetadataSelect }>) {
  return { slug: record.slug, title: record.title, summary: record.summary, institutionName: record.organization.name, publishedAt: record.publishedAt!.toISOString(), reportGeneratedAt: record.reportSnapshot.generatedAt.toISOString() };
}

export async function listPublicResults() {
  const records = await db.publicResultPublication.findMany({ where: publishedWhere, select: publicMetadataSelect, orderBy: [{ publishedAt: "desc" }, { slug: "asc" }], take: 100 });
  return records.map(metadata);
}

export async function getPublicResult(slug: string) {
  const safeSlug = publicHandleSchema.safeParse(slug);
  if (!safeSlug.success) return null;
  const record = await db.publicResultPublication.findFirst({ where: { ...publishedWhere, slug: safeSlug.data }, select: { ...publicMetadataSelect, publicPayload: true, publicPayloadDigest: true, publicMinimumCellSize: true } });
  if (!record) return null;
  const validation = publicReportPayloadSchema.safeParse(record.publicPayload);
  if (!validation.success || validation.data.minimumCellSize !== record.publicMinimumCellSize || publicPayloadDigest(validation.data) !== record.publicPayloadDigest) return null;
  return { ...metadata(record), payload: validation.data };
}
