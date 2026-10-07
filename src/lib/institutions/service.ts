import { Prisma, type OrganizationRole } from "@prisma/client";
import { AuthorizationError, hasAtLeastRole } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import { DomainConflictError, ResourceNotFoundError } from "@/lib/errors";
import { mediaDto, mediaSelect } from "@/lib/media/presentation";
import { lockMedia } from "@/lib/media/service";
import { loadPosts } from "@/lib/social/read-model";
import type { SocialPostDto } from "@/lib/social/types";
import { boundedPage } from "@/lib/communication/schemas";
import { institutionDirectoryQuerySchema, organizationProfileInputSchema, organizationProfileMediaSchema } from "@/lib/institutions/schemas";

const roleRank: Record<OrganizationRole, number> = { OWNER: 50, ADMIN: 40, MANAGER: 30, ANALYST: 20, VIEWER: 10 };

async function lockOrganization(client: Prisma.TransactionClient, organizationId: string) {
  const rows = await client.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Organization" WHERE "id" = ${organizationId} FOR UPDATE`;
  if (!rows.length) throw new ResourceNotFoundError("ORGANIZATION_NOT_FOUND");
  return rows[0];
}

async function requireCurrentOrganizationRole(client: Prisma.TransactionClient, organizationId: string, userId: string, minimumRole: OrganizationRole) {
  const membership = await client.organizationMembership.findFirst({
    where: { organizationId, userId, status: "ACTIVE", organization: { status: "ACTIVE" } },
    select: { role: true },
  });
  if (!membership || roleRank[membership.role] < roleRank[minimumRole]) throw new AuthorizationError("ROLE_FORBIDDEN");
}

export async function getPublicPageManagement(organizationId: string, userId: string) {
  const membership = await db.organizationMembership.findFirst({ where: { organizationId, userId, status: "ACTIVE", organization: { status: "ACTIVE" } }, select: { role: true } });
  if (!membership) throw new AuthorizationError("ORGANIZATION_ACCESS_DENIED");
  const organization = await db.organization.findFirst({ where: { id: organizationId, status: "ACTIVE" }, select: {
    id: true, name: true, slug: true,
    publicProfile: { select: { headline: true, description: true, city: true, state: true, country: true, websiteUrl: true, focusAreas: true, publishedAt: true,
      logoMedia: { select: mediaSelect }, coverMedia: { select: mediaSelect } } },
    _count: { select: { organizationFollows: { where: { endedAt: null } },
      fundingCalls: { where: { publicListingEnabled: true, status: { in: ["OPEN", "IN_REVIEW", "CLOSED", "RESULT_PUBLISHED"] } } },
      resultPublications: { where: { publishedAt: { not: null }, unpublishedAt: null } } } },
    fundingPrograms: { select: { id: true, name: true, slug: true, status: true, publicPageEnabled: true, publishedAt: true }, orderBy: [{ name: "asc" }, { id: "asc" }], take: 100 },
  } });
  if (!organization) throw new ResourceNotFoundError("ORGANIZATION_NOT_FOUND");
  const posts = await loadPosts({ authorOrganizationId: organizationId }, userId, { take: 30, managementOrganizationId: organizationId });
  return {
    id: organization.id, name: organization.name, slug: organization.slug,
    profile: organization.publicProfile ? { ...organization.publicProfile, publishedAt: organization.publicProfile.publishedAt?.toISOString() ?? null,
      logoMedia: mediaDto(organization.publicProfile.logoMedia), coverMedia: mediaDto(organization.publicProfile.coverMedia) } : null,
    followerCount: organization._count.organizationFollows,
    publicCallCount: organization._count.fundingCalls,
    publicResultCount: organization._count.resultPublications,
    programs: organization.fundingPrograms.map((program) => ({ ...program, publishedAt: program.publishedAt?.toISOString() ?? null })),
    posts,
    permissions: { canManageProfile: hasAtLeastRole(membership.role, "ADMIN"), canManagePosts: hasAtLeastRole(membership.role, "MANAGER") },
  };
}

export async function updateOrganizationProfile(organizationId: string, userId: string, rawInput: unknown) {
  const input = organizationProfileInputSchema.parse(rawInput);
  return db.$transaction(async (client) => {
    await lockOrganization(client, organizationId);
    await requireCurrentOrganizationRole(client, organizationId, userId, "ADMIN");
    const org = await client.organization.findFirst({ where: { id: organizationId, status: "ACTIVE" }, select: { id: true } });
    if (!org) throw new ResourceNotFoundError("ORGANIZATION_NOT_FOUND");
    const profile = await client.organizationProfile.upsert({
      where: { organizationId },
      create: { organizationId, ...input },
      update: input,
      select: { id: true, publishedAt: true },
    });
    return { saved: true, publishedAt: profile.publishedAt?.toISOString() ?? null };
  });
}

export async function setOrganizationPublication(organizationId: string, userId: string, published: boolean) {
  return db.$transaction(async (client) => {
    await lockOrganization(client, organizationId);
    await requireCurrentOrganizationRole(client, organizationId, userId, "ADMIN");
    const organization = await client.organization.findFirst({ where: { id: organizationId, status: "ACTIVE" }, select: { name: true, slug: true } });
    if (!organization) throw new ResourceNotFoundError("ORGANIZATION_NOT_FOUND");
    const profile = await client.organizationProfile.findUnique({ where: { organizationId }, select: { id: true, headline: true, description: true, publishedAt: true } });
    if (!profile) throw new DomainConflictError("INSTITUTION_PROFILE_REQUIRED");
    if (published && (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(organization.slug) || !(profile.headline?.trim() || profile.description?.trim()))) {
      throw new DomainConflictError("INSTITUTION_PUBLICATION_INCOMPLETE");
    }
    if (published && !profile.publishedAt) await client.organizationProfile.update({ where: { organizationId }, data: { publishedAt: new Date() } });
    if (!published && profile.publishedAt) await client.organizationProfile.update({ where: { organizationId }, data: { publishedAt: null } });
    return { published, slug: organization.slug };
  });
}

export async function setProgramPublication(organizationId: string, programId: string, userId: string, published: boolean) {
  return db.$transaction(async (client) => {
    await lockOrganization(client, organizationId);
    await requireCurrentOrganizationRole(client, organizationId, userId, "MANAGER");
    const institution = await client.organization.findFirst({ where: { id: organizationId, status: "ACTIVE", publicProfile: { is: { publishedAt: { not: null } } } }, select: { id: true } });
    if (published && !institution) throw new DomainConflictError("INSTITUTION_PAGE_NOT_PUBLISHED");
    await client.$queryRaw`SELECT "id" FROM "FundingProgram" WHERE "organizationId" = ${organizationId} AND "id" = ${programId} FOR UPDATE`;
    const program = await client.fundingProgram.findFirst({ where: { organizationId, id: programId }, select: { status: true, publishedAt: true } });
    if (!program) throw new ResourceNotFoundError("PROGRAM_NOT_FOUND");
    if (published && !["ACTIVE", "CLOSED"].includes(program.status)) throw new DomainConflictError("PROGRAM_PUBLICATION_INCOMPLETE");
    await client.fundingProgram.update({ where: { id: programId }, data: published
      ? { publicPageEnabled: true, publishedAt: program.publishedAt ?? new Date() }
      : { publicPageEnabled: false, publishedAt: null } });
    return { published, programId };
  });
}

export async function setOrganizationProfileMedia(organizationId: string, userId: string, rawInput: unknown) {
  const { kind, mediaId } = organizationProfileMediaSchema.parse(rawInput);
  return db.$transaction(async (client) => {
    await lockOrganization(client, organizationId);
    await requireCurrentOrganizationRole(client, organizationId, userId, "ADMIN");
    const org = await client.organization.findFirst({ where: { id: organizationId, status: "ACTIVE" }, select: { id: true } });
    if (!org) throw new ResourceNotFoundError("ORGANIZATION_NOT_FOUND");
    await client.organizationProfile.upsert({ where: { organizationId }, create: { organizationId }, update: {} });
    await client.$queryRaw`SELECT "id" FROM "OrganizationProfile" WHERE "organizationId" = ${organizationId} FOR UPDATE`;
    const profile = await client.organizationProfile.findUniqueOrThrow({ where: { organizationId }, select: { logoMediaId: true, coverMediaId: true } });
    const oldId = kind === "ORGANIZATION_LOGO" ? profile.logoMediaId : profile.coverMediaId;
    await lockMedia(client, [mediaId, oldId].filter((id): id is string => Boolean(id)));
    if (mediaId) {
      const asset = await client.mediaAsset.findFirst({ where: { id: mediaId, ownerOrganizationId: organizationId, ownerUserId: null, kind, status: "READY", deletedAt: null }, select: { id: true } });
      if (!asset) throw new ResourceNotFoundError("MEDIA_UNAVAILABLE");
    }
    await client.organizationProfile.update({ where: { organizationId }, data: kind === "ORGANIZATION_LOGO" ? { logoMediaId: mediaId } : { coverMediaId: mediaId } });
    if (oldId && oldId !== mediaId) await client.mediaAsset.update({ where: { id: oldId }, data: { status: "DELETED", deletedAt: new Date() } });
    return { saved: true };
  });
}

const institutionSelect = {
  id: true, name: true, slug: true, status: true,
  publicProfile: { select: { headline: true, description: true, city: true, state: true, country: true, websiteUrl: true, focusAreas: true, publishedAt: true,
    logoMedia: { select: mediaSelect }, coverMedia: { select: mediaSelect } } },
  _count: { select: { organizationFollows: { where: { endedAt: null } } } },
} satisfies Prisma.OrganizationSelect;

export async function listPublicInstitutions(viewerUserId: string | null, rawQuery: unknown = {}) {
  const query = institutionDirectoryQuerySchema.parse(rawQuery);
  const q = query.q?.trim();
  const where: Prisma.OrganizationWhereInput = {
    status: "ACTIVE", publicProfile: { is: { publishedAt: { not: null } } },
    ...(q ? { OR: [
      { name: { contains: q, mode: "insensitive" } },
      { publicProfile: { is: { headline: { contains: q, mode: "insensitive" } } } },
      { publicProfile: { is: { city: { contains: q, mode: "insensitive" } } } },
      { publicProfile: { is: { state: { contains: q, mode: "insensitive" } } } },
    ] } : {}),
  };
  const [records, total] = await Promise.all([
    db.organization.findMany({ where, select: institutionSelect, orderBy: [{ name: "asc" }, { slug: "asc" }], skip: (query.page - 1) * 20, take: 21 }),
    db.organization.count({ where }),
  ]);
  const ids = records.slice(0, 20).map((record) => record.id);
  const follows = viewerUserId && ids.length ? await db.organizationFollow.findMany({ where: { followerUserId: viewerUserId, organizationId: { in: ids }, endedAt: null }, select: { organizationId: true } }) : [];
  const following = new Set(follows.map((row) => row.organizationId));
  return { page: query.page, total, hasNext: records.length > 20, items: records.slice(0, 20).map((record) => ({
    id: record.id, name: record.name, slug: record.slug, headline: record.publicProfile!.headline,
    city: record.publicProfile!.city, state: record.publicProfile!.state, focusAreas: record.publicProfile!.focusAreas,
    logoMedia: mediaDto(record.publicProfile!.logoMedia), followerCount: record._count.organizationFollows,
    following: following.has(record.id),
  })) };
}

export async function getPublicInstitution(slug: string, viewerUserId?: string | null, preview = false) {
  const safeSlug = slug.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(safeSlug)) return null;
  const organization = await db.organization.findFirst({
    where: { slug: safeSlug, status: "ACTIVE", publicProfile: { is: preview ? {} : { publishedAt: { not: null } } } },
    select: { ...institutionSelect, fundingPrograms: { where: { publicPageEnabled: true, publishedAt: { not: null }, status: { in: ["ACTIVE", "CLOSED"] } },
      select: { id: true, name: true, slug: true, description: true, status: true }, orderBy: [{ name: "asc" }, { slug: "asc" }], take: 50 } },
  });
  if (!organization?.publicProfile) return null;
  if (preview && viewerUserId) {
    const membership = await db.organizationMembership.findFirst({ where: { organizationId: organization.id, userId: viewerUserId, status: "ACTIVE", organization: { status: "ACTIVE" } }, select: { id: true } });
    if (!membership) return null;
  } else if (preview) return null;
  const published = Boolean(organization.publicProfile.publishedAt);
  const [following, calls, results, posts] = await Promise.all([
    viewerUserId ? db.organizationFollow.findFirst({ where: { followerUserId: viewerUserId, organizationId: organization.id, endedAt: null }, select: { id: true } }) : null,
    db.fundingCall.findMany({ where: { organizationId: organization.id, publicListingEnabled: true, status: { in: ["OPEN", "IN_REVIEW", "CLOSED", "RESULT_PUBLISHED"] } }, select: {
      id: true, title: true, callNumber: true, objective: true, status: true, publishedAt: true, applicationEndsAt: true,
      sourceUrl: true, fundingProgram: { select: { name: true, slug: true, publicPageEnabled: true, publishedAt: true } },
    }, orderBy: [{ applicationEndsAt: { sort: "asc", nulls: "last" } }, { id: "asc" }], take: 6 }),
    db.publicResultPublication.findMany({ where: { organizationId: organization.id, publishedAt: { not: null }, unpublishedAt: null }, select: {
      slug: true, title: true, summary: true, publishedAt: true,
    }, orderBy: [{ publishedAt: "desc" }, { slug: "asc" }], take: 5 }),
    published || preview ? loadPosts({ authorOrganizationId: organization.id }, viewerUserId, { take: 5, publicOnly: !preview }) : Promise.resolve([] as SocialPostDto[]),
  ]);
  const programs = organization.fundingPrograms.map((program) => ({ id: program.id, name: program.name, slug: program.slug, description: program.description, status: program.status }));
  return {
    id: organization.id, name: organization.name, slug: organization.slug,
    headline: organization.publicProfile.headline, description: organization.publicProfile.description,
    city: organization.publicProfile.city, state: organization.publicProfile.state, country: organization.publicProfile.country,
    websiteUrl: organization.publicProfile.websiteUrl, focusAreas: organization.publicProfile.focusAreas,
    published, logoMedia: mediaDto(organization.publicProfile.logoMedia), coverMedia: mediaDto(organization.publicProfile.coverMedia),
    followerCount: organization._count.organizationFollows, following: Boolean(following),
    programs, calls: calls.map((call) => ({ id: call.id, title: call.title, callNumber: call.callNumber, objective: call.objective,
      status: call.status, publishedAt: call.publishedAt?.toISOString() ?? null, applicationEndsAt: call.applicationEndsAt?.toISOString() ?? null,
      sourceUrl: call.sourceUrl?.startsWith("https://") ? call.sourceUrl : null,
      program: call.fundingProgram.publicPageEnabled && call.fundingProgram.publishedAt ? { name: call.fundingProgram.name, slug: call.fundingProgram.slug } : null })),
    results: results.map((result) => ({ ...result, publishedAt: result.publishedAt?.toISOString() ?? null })),
    posts,
  };
}

export async function listFollowedInstitutions(userId: string, rawPage: unknown = 1) {
  const page = boundedPage(rawPage);
  const rows = await db.organizationFollow.findMany({ where: { followerUserId: userId, endedAt: null }, select: {
    organizationId: true, createdAt: true, organization: { select: { name: true, slug: true, status: true, publicProfile: { select: { headline: true, logoMedia: { select: mediaSelect }, publishedAt: true } } } },
  }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 20, take: 21 });
  return { page, hasNext: rows.length > 20, items: rows.slice(0, 20).map((row) => ({ id: row.organizationId, name: row.organization.name,
    slug: row.organization.slug, active: row.organization.status === "ACTIVE" && Boolean(row.organization.publicProfile?.publishedAt),
    headline: row.organization.publicProfile?.headline ?? null, logoMedia: mediaDto(row.organization.publicProfile?.logoMedia), followedAt: row.createdAt.toISOString() })) };
}

export async function followOrganization(userId: string, organizationId: string) {
  return db.$transaction(async (client) => {
    await lockOrganization(client, organizationId);
    const organization = await client.organization.findFirst({ where: { id: organizationId, status: "ACTIVE", publicProfile: { is: { publishedAt: { not: null } } } }, select: { id: true } });
    if (!organization) throw new ResourceNotFoundError("INSTITUTION_NOT_FOUND");
    const current = await client.organizationFollow.findFirst({ where: { followerUserId: userId, organizationId, endedAt: null }, select: { id: true } });
    if (!current) await client.organizationFollow.create({ data: { followerUserId: userId, organizationId } });
    return { following: true };
  });
}

export async function unfollowOrganization(userId: string, organizationId: string) {
  return db.$transaction(async (client) => {
    await lockOrganization(client, organizationId);
    await client.organizationFollow.updateMany({ where: { followerUserId: userId, organizationId, endedAt: null }, data: { endedAt: new Date() } });
    return { following: false };
  });
}

export async function getPublicProgram(organizationSlug: string, programSlug: string, viewerUserId?: string | null) {
  const organization = await db.organization.findFirst({ where: { slug: organizationSlug, status: "ACTIVE", publicProfile: { is: { publishedAt: { not: null } } } }, select: {
    id: true, name: true, slug: true, publicProfile: { select: { headline: true, logoMedia: { select: mediaSelect } } },
  } });
  if (!organization) return null;
  const program = await db.fundingProgram.findFirst({ where: { organizationId: organization.id, slug: programSlug, publicPageEnabled: true, publishedAt: { not: null }, status: { in: ["ACTIVE", "CLOSED"] } }, select: {
    id: true, name: true, slug: true, description: true, status: true,
  } });
  if (!program) return null;
  const [calls, results, posts] = await Promise.all([
    db.fundingCall.findMany({ where: { organizationId: organization.id, fundingProgramId: program.id, publicListingEnabled: true, status: { in: ["OPEN", "IN_REVIEW", "CLOSED", "RESULT_PUBLISHED"] } },
      select: { id: true, title: true, callNumber: true, objective: true, status: true, publishedAt: true, applicationEndsAt: true, sourceUrl: true },
      orderBy: [{ applicationEndsAt: { sort: "asc", nulls: "last" } }, { id: "asc" }], take: 25 }),
    db.publicResultPublication.findMany({ where: { organizationId: organization.id, publishedAt: { not: null }, unpublishedAt: null, reportSnapshot: { fundingProgramId: program.id } },
      select: { slug: true, title: true, summary: true, publishedAt: true }, orderBy: [{ publishedAt: "desc" }, { slug: "asc" }], take: 10 }),
    loadPosts({ authorOrganizationId: organization.id, fundingProgramId: program.id }, viewerUserId, { take: 10, publicOnly: true }),
  ]);
  return { institution: { id: organization.id, name: organization.name, slug: organization.slug, headline: organization.publicProfile?.headline ?? null,
    logoMedia: mediaDto(organization.publicProfile?.logoMedia) }, program, calls: calls.map((call) => ({ ...call, publishedAt: call.publishedAt?.toISOString() ?? null,
      applicationEndsAt: call.applicationEndsAt?.toISOString() ?? null, sourceUrl: call.sourceUrl?.startsWith("https://") ? call.sourceUrl : null })),
    results: results.map((result) => ({ ...result, publishedAt: result.publishedAt?.toISOString() ?? null })), posts };
}

export async function getInstitutionActivity(slug: string, rawPage: unknown = 1, viewerUserId?: string | null) {
  const institution = await db.organization.findFirst({ where: { slug, status: "ACTIVE", publicProfile: { is: { publishedAt: { not: null } } } }, select: { id: true } });
  if (!institution) return null;
  const page = boundedPage(rawPage);
  const [posts, total] = await Promise.all([
    loadPosts({ authorOrganizationId: institution.id }, viewerUserId, { skip: (page - 1) * 20, take: 21, publicOnly: true }),
    db.socialPost.count({ where: { authorOrganizationId: institution.id, deletedAt: null, visibility: "PUBLIC", authorOrganization: { status: "ACTIVE", publicProfile: { is: { publishedAt: { not: null } } } } } }),
  ]);
  return { page, hasNext: posts.length > 20, total, items: posts.slice(0, 20) };
}
