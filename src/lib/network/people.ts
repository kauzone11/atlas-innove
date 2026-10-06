import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { normalizeTag, publicHandleSchema } from "@/lib/identity/normalization";
import { getVisibleProfile } from "@/lib/profiles/service";
import { getDiscoveryContext } from "@/lib/network/discovery-context";
import { peopleDiscoverySchema } from "@/lib/network/discovery-schemas";
import { explainPeopleRelevance } from "@/lib/network/relevance";
import { matchesTopicsSql, normalizedTagSql } from "@/lib/network/discovery-sql";
import { mediaDto, mediaSelect } from "@/lib/media/presentation";

const discoverableScopes = ["PUBLIC", "PLATFORM"] as const;
const personSelect = {
  userId: true, handle: true, headline: true, city: true, state: true, country: true,
  avatarMedia: { select: mediaSelect },
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
    avatarMedia: mediaDto(profile.avatarMedia),
    headline: profile.headline!, location: [profile.city, profile.state, profile.country].filter((value): value is string => Boolean(value)),
    skills: topics.filter((topic) => topic.type === "SKILL").map((topic) => topic.label),
    interests: topics.filter((topic) => topic.type === "INTEREST").map((topic) => topic.label),
    state: profile.state, collaborationStatus: profile.collaborationStatus, collaborationNote: profile.collaborationNote,
  };
}
export type DiscoverablePerson = ReturnType<typeof personDto> & { relevance: ReturnType<typeof explainPeopleRelevance> };

export async function listDiscoverablePeople(viewerUserId: string, value: unknown = {}) {
  const filters = peopleDiscoverySchema.parse(value);
  const context = await getDiscoveryContext(viewerUserId, filters.projectId);
  const conditions: Prisma.Sql[] = [];
  const visibleTopics = Prisma.sql`p."skillsVisibility" IN ('PUBLIC', 'PLATFORM')`;
  if (filters.collaborationStatus) conditions.push(Prisma.sql`p."collaborationStatus"::text = ${filters.collaborationStatus}`);
  if (filters.state) conditions.push(Prisma.sql`lower(p."state") = lower(${filters.state})`);
  if (filters.topic) conditions.push(Prisma.sql`(${visibleTopics} AND EXISTS (SELECT 1 FROM "ProfileTopic" topic WHERE topic."profileId" = p."id" AND strpos(topic."normalizedKey", ${normalizeTag(filters.topic) || "__invalid_topic__"}) > 0))`);
  if (filters.q) {
    conditions.push(Prisma.sql`(strpos(lower(p."headline"), lower(${filters.q})) > 0 OR strpos(lower(identity."fullName"), lower(${filters.q})) > 0
      OR strpos(lower(p."city"), lower(${filters.q})) > 0 OR strpos(lower(p."state"), lower(${filters.q})) > 0 OR strpos(lower(p."country"), lower(${filters.q})) > 0
      OR (${visibleTopics} AND EXISTS (SELECT 1 FROM "ProfileTopic" topic WHERE topic."profileId" = p."id" AND strpos(topic."normalizedKey", ${normalizeTag(filters.q) || "__invalid_topic__"}) > 0)))`);
  }
  const topics = [...context.interests, ...(context.projectTopics ?? [])];
  const topicSignal = (type: "SKILL" | "INTEREST") => Prisma.sql`(${visibleTopics} AND EXISTS (
    SELECT 1 FROM (SELECT "type", "label" FROM "ProfileTopic" WHERE "profileId" = p."id" ORDER BY "position", "id" LIMIT 40) topic
    WHERE topic."type"::text = ${type} AND ${matchesTopicsSql(normalizedTagSql(Prisma.sql`topic."label"`), topics)}
  ))::int`;
  const stateSignal = context.state ? Prisma.sql`COALESCE((${normalizedTagSql(Prisma.sql`p."state"`)} = ${normalizeTag(context.state)})::int, 0)` : Prisma.sql`0`;
  // Rank all eligible candidates before pagination; the cap mirrors the public HIGH/RELATED/GENERAL tiers.
  const ids = await db.$queryRaw<Array<{ userId: string }>>(Prisma.sql`
    SELECT p."userId" FROM "InnovationProfile" p JOIN "UserProfile" identity ON identity."userId" = p."userId"
    WHERE p."userId" <> ${viewerUserId} AND p."directoryEnabled" AND p."profileVisibility" IN ('PUBLIC', 'PLATFORM')
      AND p."handle" IS NOT NULL AND p."handle" <> '' AND p."headline" IS NOT NULL AND p."headline" <> '' AND identity."fullName" <> ''
      AND NOT EXISTS (SELECT 1 FROM "UserBlock" block WHERE (block."blockerUserId" = ${viewerUserId} AND block."blockedUserId" = p."userId") OR (block."blockedUserId" = ${viewerUserId} AND block."blockerUserId" = p."userId"))
      ${conditions.length ? Prisma.sql`AND ${Prisma.join(conditions, " AND ")}` : Prisma.empty}
    ORDER BY (p."collaborationStatus" = 'NOT_AVAILABLE'), LEAST(2, ${topicSignal("SKILL")} + ${topicSignal("INTEREST")} + ${stateSignal}) DESC,
      p."handle" COLLATE "C", p."userId" COLLATE "C"
    LIMIT ${filters.pageSize + 1} OFFSET ${(filters.page - 1) * filters.pageSize}
  `);
  const profiles = ids.length ? await db.innovationProfile.findMany({ where: { ...eligiblePeopleWhere(viewerUserId), userId: { in: ids.slice(0, filters.pageSize).map((row) => row.userId) } }, select: personSelect }) : [];
  const positions = new Map(ids.map((row, index) => [row.userId, index]));
  profiles.sort((left, right) => positions.get(left.userId)! - positions.get(right.userId)!);
  const people: DiscoverablePerson[] = profiles.map((profile) => {
    const person = personDto(profile);
    return { ...person, relevance: explainPeopleRelevance(context, person) };
  });
  return { people, page: filters.page, pageSize: filters.pageSize, hasNext: ids.length > filters.pageSize };
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
