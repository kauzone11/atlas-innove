import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { DomainConflictError, ResourceNotFoundError } from "@/lib/errors";
import { isUniqueConstraintError } from "@/lib/http";
import { normalizeTag, publicHandleSchema } from "@/lib/identity/normalization";
import { getVerifiedParticipations } from "@/lib/participants/trajectory";
import { profileEducationSchema, profileExperienceSchema, profileLinkSchema, profileRecordKindSchema, profileUpdateSchema, type ProfileRecordKind } from "@/lib/profiles/schemas";
import { resolveProfileVisibility, type ProfileViewer, type VisibilityScope } from "@/lib/profiles/visibility";

const profileSelect = {
  id: true, userId: true, handle: true, headline: true, bio: true, city: true, state: true, country: true,
  directoryEnabled: true, collaborationStatus: true, collaborationNote: true,
  profileVisibility: true, skillsVisibility: true, experienceVisibility: true, educationVisibility: true,
  linksVisibility: true, verifiedParticipationVisibility: true, projectsVisibility: true, publishedAt: true,
  user: { select: { profile: { select: { fullName: true } } } },
  topics: { select: { type: true, label: true, position: true }, orderBy: [{ position: "asc" }, { id: "asc" }] },
  experience: { select: { id: true, organizationName: true, title: true, startsAt: true, endsAt: true, current: true, description: true, visibility: true, position: true }, orderBy: [{ current: "desc" }, { startsAt: "desc" }, { position: "asc" }, { id: "asc" }] },
  education: { select: { id: true, institution: true, course: true, degree: true, startsAt: true, endsAt: true, description: true, visibility: true, position: true }, orderBy: [{ endsAt: "desc" }, { startsAt: "desc" }, { position: "asc" }, { id: "asc" }] },
  links: { select: { id: true, label: true, url: true, type: true, visibility: true, position: true }, orderBy: [{ position: "asc" }, { id: "asc" }] },
} satisfies Prisma.InnovationProfileSelect;
const profileScopeSelect = {
  id: true, userId: true, profileVisibility: true, skillsVisibility: true, experienceVisibility: true,
  educationVisibility: true, linksVisibility: true, verifiedParticipationVisibility: true, projectsVisibility: true, publishedAt: true, directoryEnabled: true,
} satisfies Prisma.InnovationProfileSelect;

function dateOnly(value: Date | null): string | null { return value?.toISOString().slice(0, 10) ?? null; }
function parseDate(value: string | null): Date | null { return value ? new Date(`${value}T00:00:00.000Z`) : null; }
function sortedEducation<T extends { startsAt: Date | null; endsAt: Date | null; position: number; id: string }>(records: T[]): T[] {
  return [...records].sort((a, b) => ((b.endsAt ?? b.startsAt)?.getTime() ?? 0) - ((a.endsAt ?? a.startsAt)?.getTime() ?? 0) || a.position - b.position || a.id.localeCompare(b.id));
}

async function ensureProfile(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new ResourceNotFoundError("PROFILE_NOT_FOUND");
  return db.innovationProfile.upsert({ where: { userId }, create: { userId }, update: {}, select: { id: true } });
}

export async function hasCurrentProfileCollaboration(profileUserId: string, viewerUserId: string): Promise<boolean> {
  if (profileUserId === viewerUserId) return true;
  const participant = (userId: string): Prisma.ProjectWhereInput => ({ OR: [
    { memberships: { some: { userId, leftAt: null } } },
    { primaryTeam: { archivedAt: null, memberships: { some: { userId, status: "ACTIVE", leftAt: null } } } },
  ] });
  const [team, project] = await Promise.all([
    db.team.findFirst({ where: { archivedAt: null, AND: [
      { memberships: { some: { userId: profileUserId, status: "ACTIVE", leftAt: null } } },
      { memberships: { some: { userId: viewerUserId, status: "ACTIVE", leftAt: null } } },
    ] }, select: { id: true } }),
    db.project.findFirst({ where: { archivedAt: null, status: { not: "ARCHIVED" }, AND: [participant(profileUserId), participant(viewerUserId)] }, select: { id: true } }),
  ]);
  return Boolean(team || project);
}

export async function canViewProfileSection(input: Omit<ProfileViewer, "sharedCollaboration"> & { scope: VisibilityScope }): Promise<boolean> {
  if (input.scope !== "TEAM" || !input.viewerUserId || input.viewerUserId === input.profileUserId) return resolveProfileVisibility(input);
  return resolveProfileVisibility({ ...input, sharedCollaboration: await hasCurrentProfileCollaboration(input.profileUserId, input.viewerUserId) });
}

async function listPublicProfileProjects(userId: string) {
  const projects = await db.project.findMany({
    where: { visibility: "PUBLIC", publishedAt: { not: null }, publicSlug: { not: null }, archivedAt: null, status: { not: "ARCHIVED" }, OR: [
      { memberships: { some: { userId, leftAt: null } } },
      { primaryTeam: { archivedAt: null, memberships: { some: { userId, status: "ACTIVE", leftAt: null } } } },
    ] },
    select: { name: true, summary: true, publicSlug: true, status: true, thematicAreas: true },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }], take: 24,
  });
  return projects.map((project) => ({ name: project.name, summary: project.summary, url: `/projects/${project.publicSlug}`, status: project.status, thematicAreas: project.thematicAreas }));
}

export async function getOwnProfile(userId: string) {
  await ensureProfile(userId);
  const profile = await db.innovationProfile.findUniqueOrThrow({ where: { userId }, select: profileSelect });
  const [verifiedParticipations, publicProjects] = await Promise.all([getVerifiedParticipations(userId), listPublicProfileProjects(userId)]);
  return {
    id: profile.id, fullName: profile.user.profile?.fullName ?? "", handle: profile.handle, headline: profile.headline,
    bio: profile.bio, city: profile.city, state: profile.state, country: profile.country,
    directoryEnabled: profile.directoryEnabled, collaborationStatus: profile.collaborationStatus, collaborationNote: profile.collaborationNote,
    profileVisibility: profile.profileVisibility, skillsVisibility: profile.skillsVisibility,
    experienceVisibility: profile.experienceVisibility, educationVisibility: profile.educationVisibility,
    linksVisibility: profile.linksVisibility, verifiedParticipationVisibility: profile.verifiedParticipationVisibility,
    projectsVisibility: profile.projectsVisibility, publishedAt: profile.publishedAt?.toISOString() ?? null,
    skills: profile.topics.filter((topic) => topic.type === "SKILL").map((topic) => topic.label),
    interests: profile.topics.filter((topic) => topic.type === "INTEREST").map((topic) => topic.label),
    experience: profile.experience.map((record) => ({ ...record, startsAt: dateOnly(record.startsAt)!, endsAt: dateOnly(record.endsAt) })),
    education: sortedEducation(profile.education).map((record) => ({ ...record, startsAt: dateOnly(record.startsAt), endsAt: dateOnly(record.endsAt) })),
    links: profile.links, verifiedParticipations, publicProjects,
  };
}
export type OwnProfile = Awaited<ReturnType<typeof getOwnProfile>>;

async function buildVisibleProfile(profile: Prisma.InnovationProfileGetPayload<{ select: typeof profileScopeSelect }>, viewerUserId?: string | null, preview = false) {
  const sharedCollaboration = Boolean(viewerUserId && viewerUserId !== profile.userId && await hasCurrentProfileCollaboration(profile.userId, viewerUserId));
  const visible = (scope: VisibilityScope) => resolveProfileVisibility({ scope, profileUserId: profile.userId, viewerUserId: preview ? null : viewerUserId, sharedCollaboration });
  const allowedScopes: VisibilityScope[] = ["PUBLIC", "PLATFORM", "TEAM", "PRIVATE"].filter((scope) => visible(scope as VisibilityScope)) as VisibilityScope[];
  const showVerification = visible(profile.verifiedParticipationVisibility);
  const showProjects = visible(profile.projectsVisibility);
  const [identity, topics, experience, education, links, verifiedParticipations, publicProjects] = await Promise.all([
    db.innovationProfile.findUniqueOrThrow({ where: { id: profile.id }, select: { handle: true, headline: true, bio: true, city: true, state: true, country: true, user: { select: { profile: { select: { fullName: true } } } } } }),
    visible(profile.skillsVisibility) ? db.profileTopic.findMany({ where: { profileId: profile.id }, select: { type: true, label: true }, orderBy: [{ position: "asc" }, { id: "asc" }], take: 40 }) : Promise.resolve([]),
    visible(profile.experienceVisibility) ? db.profileExperience.findMany({ where: { profileId: profile.id, visibility: { in: allowedScopes } }, select: { id: true, organizationName: true, title: true, startsAt: true, endsAt: true, current: true, description: true }, orderBy: [{ current: "desc" }, { startsAt: "desc" }, { position: "asc" }, { id: "asc" }], take: 30 }) : Promise.resolve([]),
    visible(profile.educationVisibility) ? db.profileEducation.findMany({ where: { profileId: profile.id, visibility: { in: allowedScopes } }, select: { id: true, institution: true, course: true, degree: true, startsAt: true, endsAt: true, description: true, position: true }, orderBy: [{ position: "asc" }, { id: "asc" }], take: 30 }) : Promise.resolve([]),
    visible(profile.linksVisibility) ? db.profileLink.findMany({ where: { profileId: profile.id, visibility: { in: allowedScopes } }, select: { label: true, url: true, type: true }, orderBy: [{ position: "asc" }, { id: "asc" }], take: 20 }) : Promise.resolve([]),
    showVerification ? getVerifiedParticipations(profile.userId, { publicOnly: preview || viewerUserId !== profile.userId }) : Promise.resolve([]),
    showProjects ? listPublicProfileProjects(profile.userId) : Promise.resolve([]),
  ]);
  // Public DTOs select safe identity explicitly; account contacts and source application details never enter serialization.
  return {
    fullName: identity.user.profile?.fullName ?? "Participante", handle: identity.handle, headline: identity.headline, bio: identity.bio,
    location: [identity.city, identity.state, identity.country].filter((value): value is string => Boolean(value)),
    ...(visible(profile.skillsVisibility) ? {
      skills: topics.filter((topic) => topic.type === "SKILL").map((topic) => topic.label),
      interests: topics.filter((topic) => topic.type === "INTEREST").map((topic) => topic.label),
    } : {}),
    ...(visible(profile.experienceVisibility) ? { experience: experience.map((record) => ({
      id: record.id, organizationName: record.organizationName, title: record.title, startsAt: dateOnly(record.startsAt)!, endsAt: dateOnly(record.endsAt), current: record.current, description: record.description,
    })) } : {}),
    ...(visible(profile.educationVisibility) ? { education: sortedEducation(education).map((record) => ({
      id: record.id, institution: record.institution, course: record.course, degree: record.degree, startsAt: dateOnly(record.startsAt), endsAt: dateOnly(record.endsAt), description: record.description,
    })) } : {}),
    ...(visible(profile.linksVisibility) ? { links } : {}),
    ...(showVerification ? { verifiedParticipations } : {}), ...(showProjects ? { publicProjects } : {}),
  };
}
export type VisibleProfile = Awaited<ReturnType<typeof buildVisibleProfile>>;

export async function getVisibleProfile(handle: string, viewerUserId?: string | null): Promise<VisibleProfile | null> {
  const parsed = publicHandleSchema.safeParse(handle);
  if (!parsed.success) return null;
  const profile = await db.innovationProfile.findUnique({ where: { handle: parsed.data }, select: profileScopeSelect });
  if (!profile) return null;
  if (viewerUserId !== profile.userId && profile.profileVisibility === "PUBLIC" && !profile.publishedAt && !(viewerUserId && profile.directoryEnabled)) return null;
  if (!await canViewProfileSection({ scope: profile.profileVisibility, profileUserId: profile.userId, viewerUserId })) return null;
  return buildVisibleProfile(profile, viewerUserId);
}

export async function getPublicProfile(handle: string): Promise<VisibleProfile | null> {
  const parsed = publicHandleSchema.safeParse(handle);
  if (!parsed.success) return null;
  const profile = await db.innovationProfile.findFirst({ where: { handle: parsed.data, profileVisibility: "PUBLIC", publishedAt: { not: null } }, select: profileScopeSelect });
  return profile ? buildVisibleProfile(profile) : null;
}

export async function getPublicProfilePreview(userId: string): Promise<VisibleProfile | null> {
  const profile = await db.innovationProfile.findUnique({ where: { userId }, select: { ...profileScopeSelect, handle: true, headline: true, user: { select: { profile: { select: { fullName: true } } } } } });
  if (!profile?.handle || !profile.headline || !profile.user.profile?.fullName.trim()) return null;
  return buildVisibleProfile(profile, null, true);
}

export async function updateProfile(userId: string, input: unknown): Promise<void> {
  const parsed = profileUpdateSchema.parse(input);
  const profile = await ensureProfile(userId);
  try {
    await db.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT "id" FROM "InnovationProfile" WHERE "id" = ${profile.id} AND "userId" = ${userId} FOR UPDATE`;
      const existing = await transaction.innovationProfile.findUniqueOrThrow({ where: { userId }, select: { id: true, handle: true, headline: true, publishedAt: true, directoryEnabled: true, profileVisibility: true, user: { select: { profile: { select: { fullName: true } } } } } });
      if (parsed.section === "identity") {
        if (existing.publishedAt && (!parsed.data.handle || !parsed.data.headline)) throw new DomainConflictError("PROFILE_PUBLISHED_IDENTITY_REQUIRED");
        if (existing.directoryEnabled && (!parsed.data.handle || !parsed.data.headline)) throw new DomainConflictError("PROFILE_DIRECTORY_IDENTITY_REQUIRED");
        await transaction.innovationProfile.update({ where: { userId }, data: parsed.data });
      } else if (parsed.section === "about") {
        await transaction.innovationProfile.update({ where: { userId }, data: parsed.data });
      } else if (parsed.section === "privacy") {
        await transaction.innovationProfile.update({ where: { userId }, data: { ...parsed.data, ...(parsed.data.profileVisibility !== "PUBLIC" ? { publishedAt: null } : {}), ...(["PRIVATE", "TEAM"].includes(parsed.data.profileVisibility) ? { directoryEnabled: false } : {}) } });
      } else if (parsed.section === "discovery") {
        if (parsed.data.directoryEnabled && (!existing.handle || !publicHandleSchema.safeParse(existing.handle).success || !existing.headline?.trim() || !existing.user.profile?.fullName.trim())) throw new DomainConflictError("PROFILE_DISCOVERY_INCOMPLETE");
        if (parsed.data.directoryEnabled && !["PUBLIC", "PLATFORM"].includes(existing.profileVisibility)) throw new DomainConflictError("PROFILE_DISCOVERY_VISIBILITY_REQUIRED");
        await transaction.innovationProfile.update({ where: { userId }, data: parsed.data });
      } else if (parsed.section === "topics") {
        await transaction.profileTopic.deleteMany({ where: { profileId: existing.id } });
        const topics = [
          ...parsed.data.skills.map((label, position) => ({ profileId: existing.id, type: "SKILL" as const, label, normalizedKey: normalizeTag(label), position })),
          ...parsed.data.interests.map((label, position) => ({ profileId: existing.id, type: "INTEREST" as const, label, normalizedKey: normalizeTag(label), position })),
        ];
        if (topics.length) await transaction.profileTopic.createMany({ data: topics });
      } else if (parsed.section === "publish") {
        if (!existing.handle || !publicHandleSchema.safeParse(existing.handle).success || !existing.headline?.trim() || !existing.user.profile?.fullName.trim()) throw new DomainConflictError("PROFILE_PUBLICATION_INCOMPLETE");
        await transaction.innovationProfile.update({ where: { userId }, data: { profileVisibility: "PUBLIC", publishedAt: existing.publishedAt ?? new Date() } });
      } else {
        await transaction.innovationProfile.update({ where: { userId }, data: { publishedAt: null } });
      }
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) throw new DomainConflictError("PROFILE_HANDLE_UNAVAILABLE");
    throw error;
  }
}

export async function saveProfileRecord(userId: string, kindInput: ProfileRecordKind, input: unknown, recordId?: string): Promise<void> {
  const kind = profileRecordKindSchema.parse(kindInput);
  const parsed = kind === "experience" ? profileExperienceSchema.parse(input) : kind === "education" ? profileEducationSchema.parse(input) : profileLinkSchema.parse(input);
  const profile = await ensureProfile(userId);
  await db.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT "id" FROM "InnovationProfile" WHERE "id" = ${profile.id} AND "userId" = ${userId} FOR UPDATE`;
    if (kind === "experience") {
      const data = profileExperienceSchema.parse(parsed);
      const values = { ...data, startsAt: parseDate(data.startsAt)!, endsAt: parseDate(data.endsAt) };
      if (recordId) { const result = await transaction.profileExperience.updateMany({ where: { id: recordId, profileId: profile.id }, data: values }); if (!result.count) throw new ResourceNotFoundError("PROFILE_RECORD_NOT_FOUND"); }
      else { const position = await transaction.profileExperience.count({ where: { profileId: profile.id } }); if (position >= 30) throw new DomainConflictError("PROFILE_RECORD_LIMIT"); await transaction.profileExperience.create({ data: { ...values, profileId: profile.id, position } }); }
    } else if (kind === "education") {
      const data = profileEducationSchema.parse(parsed);
      const values = { ...data, startsAt: parseDate(data.startsAt), endsAt: parseDate(data.endsAt) };
      if (recordId) { const result = await transaction.profileEducation.updateMany({ where: { id: recordId, profileId: profile.id }, data: values }); if (!result.count) throw new ResourceNotFoundError("PROFILE_RECORD_NOT_FOUND"); }
      else { const position = await transaction.profileEducation.count({ where: { profileId: profile.id } }); if (position >= 30) throw new DomainConflictError("PROFILE_RECORD_LIMIT"); await transaction.profileEducation.create({ data: { ...values, profileId: profile.id, position } }); }
    } else {
      const data = profileLinkSchema.parse(parsed);
      if (recordId) { const result = await transaction.profileLink.updateMany({ where: { id: recordId, profileId: profile.id }, data }); if (!result.count) throw new ResourceNotFoundError("PROFILE_RECORD_NOT_FOUND"); }
      else { const position = await transaction.profileLink.count({ where: { profileId: profile.id } }); if (position >= 20) throw new DomainConflictError("PROFILE_RECORD_LIMIT"); await transaction.profileLink.create({ data: { ...data, profileId: profile.id, position } }); }
    }
  });
}

export async function deleteProfileRecord(userId: string, kindInput: ProfileRecordKind, recordId: string): Promise<void> {
  const kind = profileRecordKindSchema.parse(kindInput);
  const profile = await db.innovationProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!profile) throw new ResourceNotFoundError("PROFILE_NOT_FOUND");
  const where = { id: recordId, profileId: profile.id };
  const result = kind === "experience" ? await db.profileExperience.deleteMany({ where }) : kind === "education" ? await db.profileEducation.deleteMany({ where }) : await db.profileLink.deleteMany({ where });
  if (!result.count) throw new ResourceNotFoundError("PROFILE_RECORD_NOT_FOUND");
}
