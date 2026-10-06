import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { normalizeTag, publicHandleSchema } from "@/lib/identity/normalization";
import { getVisibleProfile } from "@/lib/profiles/service";
import { getDiscoveryContext } from "@/lib/network/discovery-context";
import { peopleDiscoverySchema } from "@/lib/network/discovery-schemas";
import { compareRelevance, explainPeopleRelevance } from "@/lib/network/relevance";

const discoverableScopes = ["PUBLIC", "PLATFORM"] as const;
const personSelect = {
  userId: true, handle: true, headline: true, city: true, state: true, country: true,
  skillsVisibility: true, collaborationStatus: true, collaborationNote: true,
  user: { select: { profile: { select: { fullName: true } } } },
  topics: { select: { type: true, label: true }, orderBy: [{ position: "asc" }, { id: "asc" }], take: 40 },
} satisfies Prisma.InnovationProfileSelect;

function eligiblePeopleWhere(viewerUserId: string): Prisma.InnovationProfileWhereInput {
  return {
    directoryEnabled: true, profileVisibility: { in: [...discoverableScopes] },
    handle: { not: null, notIn: [""] }, headline: { not: null, notIn: [""] },
    user: {
      blocksInitiated: { none: { blockedUserId: viewerUserId } },
      blocksReceived: { none: { blockerUserId: viewerUserId } },
      profile: { is: { fullName: { not: "" } } },
    },
  };
}

function personDto(profile: Prisma.InnovationProfileGetPayload<{ select: typeof personSelect }>) {
  const topics = discoverableScopes.some((scope) => scope === profile.skillsVisibility) ? profile.topics : [];
  return {
    userId: profile.userId, handle: profile.handle!, fullName: profile.user.profile!.fullName,
    headline: profile.headline!, location: [profile.city, profile.state, profile.country].filter((value): value is string => Boolean(value)),
    skills: topics.filter((topic) => topic.type === "SKILL").map((topic) => topic.label),
    interests: topics.filter((topic) => topic.type === "INTEREST").map((topic) => topic.label),
    state: profile.state, collaborationStatus: profile.collaborationStatus, collaborationNote: profile.collaborationNote,
  };
}
export type DiscoverablePerson = ReturnType<typeof personDto> & { relevance: ReturnType<typeof explainPeopleRelevance> };

export async function listDiscoverablePeople(viewerUserId: string, value: unknown = {}) {
  const filters = peopleDiscoverySchema.parse(value);
  const where: Prisma.InnovationProfileWhereInput = { ...eligiblePeopleWhere(viewerUserId), userId: { not: viewerUserId } };
  const conditions: Prisma.InnovationProfileWhereInput[] = [];
  if (filters.collaborationStatus) where.collaborationStatus = filters.collaborationStatus;
  if (filters.state) where.state = { equals: filters.state, mode: "insensitive" };
  if (filters.topic) conditions.push({ skillsVisibility: { in: [...discoverableScopes] }, topics: { some: { normalizedKey: { contains: normalizeTag(filters.topic) || "__invalid_topic__" } } } });
  if (filters.q) {
    const query = { contains: filters.q, mode: "insensitive" as const };
    conditions.push({ OR: [
      { headline: query }, { user: { profile: { is: { fullName: query } } } },
      { city: query }, { state: query }, { country: query },
      ...(normalizeTag(filters.q) ? [{ skillsVisibility: { in: [...discoverableScopes] }, topics: { some: { normalizedKey: { contains: normalizeTag(filters.q) } } } }] : []),
    ] });
  }
  if (conditions.length) where.AND = conditions;
  const [profiles, context] = await Promise.all([
    db.innovationProfile.findMany({ where, select: personSelect, orderBy: [{ handle: "asc" }, { userId: "asc" }], skip: (filters.page - 1) * filters.pageSize, take: filters.pageSize + 1 }),
    getDiscoveryContext(viewerUserId, filters.projectId),
  ]);
  const people: DiscoverablePerson[] = profiles.slice(0, filters.pageSize).map((profile) => {
    const person = personDto(profile);
    return { ...person, relevance: explainPeopleRelevance(context, person) };
  });
  people.sort((left, right) => Number(left.collaborationStatus === "NOT_AVAILABLE") - Number(right.collaborationStatus === "NOT_AVAILABLE") || compareRelevance(left.relevance, right.relevance) || left.handle.localeCompare(right.handle) || left.userId.localeCompare(right.userId));
  return { people, page: filters.page, pageSize: filters.pageSize, hasNext: profiles.length > filters.pageSize };
}

export async function getDiscoverablePerson(viewerUserId: string, handle: string) {
  const parsed = publicHandleSchema.safeParse(handle);
  if (!parsed.success) return null;
  const record = await db.innovationProfile.findFirst({ where: { ...eligiblePeopleWhere(viewerUserId), handle: parsed.data }, select: personSelect });
  if (!record) return null;
  const [profile, context] = await Promise.all([getVisibleProfile(parsed.data, viewerUserId), getDiscoveryContext(viewerUserId)]);
  if (!profile) return null;
  const person = personDto(record);
  return { person: { ...person, relevance: explainPeopleRelevance(context, person) }, profile };
}
